/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BUBBLE HEX — Forbidden Expansion, milestone 1: collectible item engine.
 *
 * Installed onto the native BubbleHexEngine prototype (the same extension
 * pattern as runtime-upgrades.ts) so the original engine, its drops, VENOM
 * letters and controls keep running unchanged. Every hook calls the original
 * method; expansion behaviour only applies to rewards carrying an `itemId`.
 */
import { ExpansionAssets } from "./expansion-assets";
import {
  EXPANSION_REWARD_KIND, ITEM_LIMITS, ItemEffectState, RARITY_BADGE, RARITY_COLOR, RARITY_PIPS, SECRET_WHISPERS,
  awardComboBonus, awardItemScore, discoveredCount, itemById, newLedger, recordDiscovery, rollItemDrop,
  type DropContext, type ItemDefinition, type ItemLedger, type TimedEffect,
} from "./items";

export const FORBIDDEN_EXPANSION_ENABLED = true;
const INSTALL_KEY = Symbol.for("bubblehex.forbidden-expansion.m1");
const W = 960;
const ITEM_SIZE = 36;
const TOAST_LIFE = 2.8;
const POP_FRAME = 0.06;
const MAX_TOASTS = 2;

const MAX_POPS = 6;

type EngineConstructor = { prototype: object };
type AnyEngine = Record<PropertyKey, any>;
type Toast = { item: ItemDefinition; age: number; firstTime: boolean; detail: string };
type PopFx = { x: number; y: number; age: number; tint: string };

export type ExpansionRuntime = {
  assets: ExpansionAssets;
  effects: ItemEffectState;
  ledger: ItemLedger;
  stageDrops: number;
  killsSinceDrop: number;
  toasts: Toast[];
  pops: PopFx[];
  rng: () => number;
  echoing: boolean;
};

const runtimes = new WeakMap<object, ExpansionRuntime>();

export function expansionRuntime(engine: AnyEngine): ExpansionRuntime {
  let rt = runtimes.get(engine);
  if (!rt) {
    rt = { assets: new ExpansionAssets(), effects: new ItemEffectState(), ledger: newLedger(), stageDrops: 0, killsSinceDrop: ITEM_LIMITS.minKillsBetween, toasts: [], pops: [], rng: Math.random, echoing: false };
    runtimes.set(engine, rt);
    if (typeof window !== "undefined" && typeof document !== "undefined" && typeof fetch === "function") void rt.assets.preload();
    if (engine.devTools && typeof window !== "undefined") {
      // Development-only hook for manual QA and screenshots. Not shipped behaviour.
      (window as any).__bubbleHexExpansion = {
        spawn: (id: string, x?: number, y?: number) => spawnItem(engine, rt!, id, x ?? engine.player.x + 120, y ?? engine.player.y - 40),
        state: () => ({ effects: rt!.effects.list(), ledger: { ...rt!.ledger }, stageDrops: rt!.stageDrops, collection: { ...engine.settings.collection.items } }),
      };
    }
  }
  return rt;
}

function resetStage(rt: ExpansionRuntime) {
  rt.effects.clear(); rt.ledger = newLedger(); rt.stageDrops = 0; rt.killsSinceDrop = ITEM_LIMITS.minKillsBetween; rt.pops = []; rt.echoing = false;
}

function itemsOnField(engine: AnyEngine): number {
  return (engine.rewards as any[]).filter(r => r.itemId).length;
}

function dropContext(engine: AnyEngine, chain: number): DropContext {
  return {
    levelIndex: engine.levelIndex ?? 0, lives: engine.lives ?? 3, levelTime: engine.levelTime ?? 99,
    boss: !!engine.level?.boss, bonus: !!engine.level?.bonus, chain,
    enemiesLeft: (engine.enemies as any[]).filter(e => e.state !== "dead").length,
    secretFound: !!engine.secretFound,
  };
}

function spawnItem(engine: AnyEngine, rt: ExpansionRuntime, id: string, x: number, y: number): boolean {
  const item = itemById(id);
  if (!item || itemsOnField(engine) >= ITEM_LIMITS.maxOnField) return false;
  engine.rewards.push({ x: Math.max(40, Math.min(W - 40, x)), y, vy: -140, kind: EXPANSION_REWARD_KIND, value: 0, life: ITEM_LIMITS.pickupLife, itemId: item.id });
  rt.stageDrops++; rt.killsSinceDrop = 0;
  return true;
}

function playCue(engine: AnyEngine, item: ItemDefinition) {
  const audio = engine.audio;
  if (!audio?.tone) return;
  item.cue.notes.forEach((note, i) => {
    const play = () => audio.tone(note, 0.1, item.cue.wave, 40, 0.09);
    if (i === 0) play(); else setTimeout(play, i * item.cue.step * 1000);
  });
}

function collectItem(engine: AnyEngine, rt: ExpansionRuntime, reward: AnyEngine, item: ItemDefinition) {
  const settings = engine.settings;
  if (!settings.collection || typeof settings.collection !== "object") settings.collection = { items: {} };
  if (!settings.collection.items) settings.collection.items = {};
  const { firstTime, count } = recordDiscovery(settings.collection.items, item.id);
  let detail = item.description;
  let points = item.score;

  switch (item.effect) {
    case "heal":
      if (engine.lives < ITEM_LIMITS.maxLives) { engine.lives++; detail = `+1 LIFE · ${engine.lives} LEFT`; }
      else { points = 1000; detail = "HEART FULL · +1000"; }
      break;
    case "timeBonus":
      engine.levelTime = Math.min((engine.level?.time ?? 99), (engine.levelTime ?? 0) + ITEM_LIMITS.timeBonusSeconds);
      detail = `+${ITEM_LIMITS.timeBonusSeconds}s STOLEN`;
      break;
    case "hint":
      detail = SECRET_WHISPERS[engine.level?.secret] ?? item.description;
      engine.message = detail; engine.messageLife = 2.8;
      break;
    case "collect":
      detail = `FANG ${count} · ${item.description}`;
      break;
    case "charm":
      engine.player.invuln = Math.max(engine.player.invuln ?? 0, ITEM_LIMITS.charmSeconds);
      rt.effects.apply(item);
      break;
    default:
      rt.effects.apply(item);
  }

  const granted = awardItemScore(rt.ledger, points);
  if (granted > 0) { engine.score += granted; engine.addScoreBurst?.(reward.x, reward.y, granted); }
  else if (points > 0) detail = `${detail} · SCORE CAP`;

  rt.toasts.push({ item, age: 0, firstTime, detail });
  while (rt.toasts.length > MAX_TOASTS) rt.toasts.shift();
  if (!settings.reducedMotion) {
    rt.pops.push({ x: reward.x, y: reward.y, age: 0, tint: RARITY_COLOR[item.rarity] });
    while (rt.pops.length > MAX_POPS) rt.pops.shift();
    engine.burstParticles?.(reward.x, reward.y, item.tint, item.rarity === "common" ? 8 : 14);
  }
  playCue(engine, item);
  engine.save?.();
}

function drawPips(c: CanvasRenderingContext2D, item: ItemDefinition, x: number, y: number, radius: number) {
  const pips = RARITY_PIPS[item.rarity];
  c.fillStyle = RARITY_COLOR[item.rarity];
  for (let i = 0; i < pips; i++) {
    const a = -Math.PI / 2 + (i - (pips - 1) / 2) * 0.55;
    const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
    c.beginPath(); c.moveTo(px, py - 4); c.lineTo(px + 3, py); c.lineTo(px, py + 4); c.lineTo(px - 3, py); c.closePath(); c.fill();
  }
}

export function drawItemIcon(engine: AnyEngine, rt: ExpansionRuntime, item: ItemDefinition, x: number, y: number, size: number) {
  const c = engine.ctx as CanvasRenderingContext2D;
  if (rt.assets.draw(c, item.sprite, x, y, size)) return;
  c.fillStyle = item.tint; c.beginPath(); c.arc(x, y, size * 0.36, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#050509"; c.font = `bold ${Math.round(size * 0.4)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(item.glyph, x, y + 1);
  c.textBaseline = "alphabetic";
}

function drawItemPickup(engine: AnyEngine, rt: ExpansionRuntime, r: AnyEngine, item: ItemDefinition) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const reduced = !!engine.settings.reducedMotion;
  const t = engine.animTime ?? 0;
  if (r.life < 2 && Math.floor(r.life * 8) % 2 === 0) return;
  const bob = reduced ? 0 : Math.sin(t * 3 + r.x * 0.05) * 3;
  const y = r.y - 12 + bob;
  c.save();
  const color = RARITY_COLOR[item.rarity];
  c.globalAlpha = 0.85; c.strokeStyle = color; c.lineWidth = 2;
  if (item.rarity === "cursed") c.setLineDash([4, 3]);
  c.beginPath(); c.arc(r.x, y, ITEM_SIZE * 0.62, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  if (!reduced) { c.globalAlpha = 0.18 + 0.1 * Math.sin(t * 5); c.fillStyle = color; c.beginPath(); c.arc(r.x, y, ITEM_SIZE * 0.62, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  drawItemIcon(engine, rt, item, r.x, y, ITEM_SIZE);
  drawPips(c, item, r.x, y, ITEM_SIZE * 0.78);
  c.restore();
}

function drawEffectsHud(engine: AnyEngine, rt: ExpansionRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const list = rt.effects.list();
  list.forEach((fx, i) => {
    const item = itemById(fx.itemId); if (!item) return;
    const x = 40 + i * 44, y = 96;
    c.save();
    c.fillStyle = "rgba(5,5,9,.78)"; c.fillRect(x - 19, y - 19, 38, 44);
    c.strokeStyle = RARITY_COLOR[item.rarity]; c.lineWidth = 1.5; c.strokeRect(x - 19, y - 19, 38, 44);
    drawItemIcon(engine, rt, item, x, y, 28);
    const frac = Math.max(0, Math.min(1, fx.remaining / fx.duration));
    c.fillStyle = "#1c2b38"; c.fillRect(x - 15, y + 17, 30, 4);
    c.fillStyle = fx.remaining < 2 ? "#FF2A9D" : "#20C98B"; c.fillRect(x - 15, y + 17, 30 * frac, 4);
    c.restore();
  });
}

function drawReveal(engine: AnyEngine, rt: ExpansionRuntime) {
  if (!rt.effects.has("reveal")) return;
  const c = engine.ctx as CanvasRenderingContext2D;
  const t = engine.animTime ?? 0;
  c.save(); c.strokeStyle = "#20C98B"; c.lineWidth = 2; c.setLineDash([5, 4]);
  if (!engine.settings.reducedMotion) c.lineDashOffset = -t * 30;
  for (const e of engine.enemies as any[]) if (e.state === "normal" || e.state === "furious") { c.beginPath(); c.arc(e.x + e.w / 2, e.y + e.h / 2, 30, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}

function drawPops(engine: AnyEngine, rt: ExpansionRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  for (const pop of rt.pops) {
    const frame = Math.min(4, Math.floor(pop.age / POP_FRAME));
    if (!rt.assets.draw(c, `pop_${frame}`, pop.x, pop.y - 12, 64)) {
      c.save(); c.globalAlpha = Math.max(0, 1 - pop.age / 0.3); c.strokeStyle = pop.tint; c.lineWidth = 3;
      c.beginPath(); c.arc(pop.x, pop.y - 12, 12 + pop.age * 120, 0, Math.PI * 2); c.stroke(); c.restore();
    }
  }
}

/** Trim text with an ellipsis so it fits maxWidth at the engine's readable label size. */
export function fitText(engine: AnyEngine, text: string, size: number, maxWidth: number, family = "monospace"): string {
  const c = engine.ctx as CanvasRenderingContext2D;
  const scale = (engine.constructor as any)?.TEXT_SCALE ?? 1;
  c.save(); c.font = `900 ${Math.max(size * scale, 17)}px ${family}, monospace`;
  let out = text;
  while (out.length > 4 && c.measureText(out).width > maxWidth) out = out.slice(0, -2).trimEnd() + "…";
  c.restore();
  return out.length < text.length && !out.endsWith("…") ? out + "…" : out;
}

function drawToasts(engine: AnyEngine, rt: ExpansionRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const reduced = !!engine.settings.reducedMotion;
  rt.toasts.forEach((toast, i) => {
    const { item } = toast;
    const w = 392, h = item.announce ? 100 : 78, x = W - w - 14;
    const y = 80 + rt.toasts.slice(0, i).reduce((sum, t) => sum + (t.item.announce ? 108 : 86), 0);
    const fade = Math.min(1, (TOAST_LIFE - toast.age) / 0.4);
    const slide = reduced ? 0 : Math.max(0, 1 - toast.age / 0.18) * 40;
    const textX = x + 78, textW = w - 78 - 44;
    c.save();
    c.globalAlpha = Math.max(0, fade);
    c.translate(slide, 0);
    c.fillStyle = "rgba(10,4,18,.94)"; c.fillRect(x, y, w, h);
    c.strokeStyle = RARITY_COLOR[item.rarity]; c.lineWidth = 2;
    if (item.rarity === "cursed") c.setLineDash([6, 3]);
    c.strokeRect(x + 2, y + 2, w - 4, h - 4); c.setLineDash([]);
    // Pop-in scale for the item icon (disabled for reduced motion).
    const p = Math.min(1, toast.age / 0.32);
    const scale = reduced ? 1 : p < 1 ? 0.4 + 0.9 * Math.sin(p * Math.PI * 0.62) : 1;
    drawItemIcon(engine, rt, item, x + 40, y + 40, 52 * scale);
    if (!rt.assets.draw(c, RARITY_BADGE[item.rarity], x + w - 24, y + 24, 30)) drawPips(c, item, x + w - 24, y + 32, 8);
    engine.label(fitText(engine, `${item.rarity.toUpperCase()}${toast.firstTime ? " · NEW" : ""}`, 10, textW), textX, y + 24, 10, RARITY_COLOR[item.rarity]);
    engine.label(fitText(engine, item.name.toUpperCase(), 13, textW + 30, "Georgia"), textX, y + 47, 13, "#FFD6F1", "left", "Georgia");
    engine.label(fitText(engine, toast.detail, 9, w - 92), textX, y + 70, 9, "#9fb3d1");
    if (item.announce) engine.label(item.announce, x + w - 14, y + 92, 10, "#FF2A9D", "right");
    c.restore();
  });
}

export function installForbiddenExpansion(EngineClass: EngineConstructor) {
  if (!FORBIDDEN_EXPANSION_ENABLED) return;
  const proto = EngineClass.prototype as AnyEngine;
  if (proto[INSTALL_KEY]) return;
  Object.defineProperty(proto, INSTALL_KEY, { value: true, configurable: false });

  const original = {
    spawnReward: proto.spawnReward, collectReward: proto.collectReward, drawReward: proto.drawReward,
    updateWorld: proto.updateWorld, updateEnemies: proto.updateEnemies, fireBubble: proto.fireBubble,
    resolveBubble: proto.resolveBubble, damagePlayer: proto.damagePlayer, loadLevelData: proto.loadLevelData,
    toTitle: proto.toTitle, update: proto.update, drawProgressionHud: proto.drawProgressionHud, syncAuditData: proto.syncAuditData,
  };

  proto.spawnReward = function (this: AnyEngine, x: number, y: number, chain: number) {
    original.spawnReward.call(this, x, y, chain);
    if (this.state === "attract") return;
    const rt = expansionRuntime(this);
    rt.killsSinceDrop++;
    const item = rollItemDrop(dropContext(this, chain), { onField: itemsOnField(this), stageDrops: rt.stageDrops, killsSinceDrop: rt.killsSinceDrop, dropBoost: rt.effects.has("dropBoost") }, rt.rng);
    if (item) spawnItem(this, rt, item.id, x + (rt.rng() - 0.5) * 40, y);
  };

  proto.collectReward = function (this: AnyEngine, r: AnyEngine) {
    const item = r.itemId ? itemById(r.itemId) : undefined;
    if (!item) return original.collectReward.call(this, r);
    collectItem(this, expansionRuntime(this), r, item);
  };

  proto.drawReward = function (this: AnyEngine, r: AnyEngine) {
    const item = r.itemId ? itemById(r.itemId) : undefined;
    if (!item) return original.drawReward.call(this, r);
    drawItemPickup(this, expansionRuntime(this), r, item);
  };

  proto.updateWorld = function (this: AnyEngine, dt: number, allowDamage: boolean, demo: boolean) {
    const rt = expansionRuntime(this);
    if (rt.effects.has("magnet")) {
      const px = this.player.x + 17, py = this.player.y + 24;
      for (const r of this.rewards as any[]) {
        const dx = px - r.x, dy = py - r.y, d = Math.hypot(dx, dy);
        if (d > 4 && d < 360) { const pull = Math.min(d, 300 * dt); r.x += dx / d * pull; r.y += dy / d * pull; r.vy = Math.min(r.vy, 0); }
      }
    }
    original.updateWorld.call(this, dt, allowDamage, demo);
    rt.effects.tick(dt);
  };

  proto.updateEnemies = function (this: AnyEngine, dt: number) {
    const slowed = runtimes.get(this)?.effects.has("slowEnemies");
    return original.updateEnemies.call(this, slowed ? dt * 0.5 : dt);
  };

  proto.fireBubble = function (this: AnyEngine) {
    const rt = expansionRuntime(this);
    const before = this.bubbles.length;
    original.fireBubble.call(this);
    const shot = this.bubbles.length > before ? this.bubbles[this.bubbles.length - 1] : undefined;
    if (!shot) return;
    if (rt.effects.has("rangeBoost")) { shot.life *= 1.45; shot.vx *= 1.15; }
    if (rt.effects.has("echo") && this.bubbles.length < ITEM_LIMITS.maxBubblesForEcho) {
      const p = this.player, ex = p.x + p.w / 2 - p.facing * 28;
      this.bubbles.push({ ...shot, id: this.nextId++, x: ex, prevX: ex, vx: -shot.vx });
    }
  };

  proto.resolveBubble = function (this: AnyEngine, b: AnyEngine, mult: number, chain: number) {
    const before = this.score;
    original.resolveBubble.call(this, b, mult, chain);
    const rt = runtimes.get(this);
    const delta = this.score - before;
    if (rt && delta > 0 && rt.effects.has("comboBoost")) this.score += awardComboBonus(rt.ledger, delta);
  };

  proto.damagePlayer = function (this: AnyEngine) {
    const lives = this.lives;
    original.damagePlayer.call(this);
    if (this.lives < lives) runtimes.get(this)?.effects.clear();
  };

  proto.loadLevelData = function (this: AnyEngine, level: unknown) {
    original.loadLevelData.call(this, level);
    resetStage(expansionRuntime(this));
  };

  proto.toTitle = function (this: AnyEngine) {
    original.toTitle.call(this);
    const rt = runtimes.get(this); if (rt) { resetStage(rt); rt.toasts = []; }
  };

  proto.update = function (this: AnyEngine, dt: number) {
    const rt = runtimes.get(this);
    if (rt && this.state !== "paused") {
      for (const toast of rt.toasts) toast.age += dt;
      rt.toasts = rt.toasts.filter(toast => toast.age < TOAST_LIFE);
      for (const pop of rt.pops) pop.age += dt;
      rt.pops = rt.pops.filter(pop => pop.age < POP_FRAME * 5);
    }
    return original.update.call(this, dt);
  };

  proto.drawProgressionHud = function (this: AnyEngine) {
    original.drawProgressionHud.call(this);
    const rt = expansionRuntime(this);
    drawReveal(this, rt); drawPops(this, rt); drawEffectsHud(this, rt);
    if (this.state !== "paused") drawToasts(this, rt);
  };

  proto.syncAuditData = function (this: AnyEngine) {
    original.syncAuditData.call(this);
    const rt = runtimes.get(this);
    if (!this.canvas?.dataset) return;
    Object.assign(this.canvas.dataset, {
      expansionItems: String(itemsOnField(this)),
      expansionEffects: rt ? rt.effects.list().map(fx => fx.effect).join(",") : "",
      expansionDiscovered: String(discoveredCount(this.settings?.collection?.items ?? {})),
      expansionToast: rt?.toasts.at(-1)?.item.id ?? "",
      expansionAssets: rt?.assets.state ?? "idle",
    });
  };
}

export type { TimedEffect };
