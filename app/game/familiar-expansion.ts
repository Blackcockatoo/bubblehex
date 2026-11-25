/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BUBBLE HEX — Forbidden Expansion, milestone 4: familiars (engine hooks).
 *
 * Draws the equipped familiar on the world layer *behind* bubbles, enemies and
 * the hero (it never covers hitboxes or the HUD), steps its state machine,
 * forwards gameplay events, evaluates deterministic unlocks, runs one
 * cooldown-limited assist (never in attract mode, never in cosmetic mode),
 * adds the FAMILIARS pause tab and lets unlocked familiars wander the title.
 */
import { expansionRuntime, fitText } from "./forbidden-expansion";
import { copyForEngine, registerCollectionSuffix, registerPauseTab, type InterfaceRuntime, interfaceRuntime } from "./expansion-ui";
import { loreName } from "./cabinet-i18n";
import type { ExpansionCopy } from "./expansion-i18n";
import {
  FAMILIARS, FAMILIAR_LIMITS, assistReady, evaluateUnlocks, familiarById, frameIndex, isFamiliarId, newAssistClock, newBody,
  notify, resetAssistStage, spendAssist, stepFamiliar, stepWalker, tickAssist, unlockProgress,
  type AssistClock, type FamiliarBody, type FamiliarDefinition, type FamiliarEvent, type FamiliarId, type UnlockStats, type Walker,
} from "./familiars";
import { SECRET_WHISPERS, discoveredCount } from "./items";
import { livingRuntime } from "./living-expansion";

const INSTALL_KEY = Symbol.for("bubblehex.forbidden-expansion.m4");
const W = 960;
const WORLD_STATES = new Set(["stageIntro", "playing", "hurry", "dying", "stageClear", "paused", "attract"]);
const STEP_STATES = new Set(["stageIntro", "playing", "hurry", "dying", "stageClear", "attract"]);
const ASSIST_STATES = new Set(["playing", "hurry"]);

type EngineConstructor = { prototype: object };
type AnyEngine = Record<PropertyKey, any>;

export type FamiliarRuntime = {
  body: FamiliarBody | null;
  clock: AssistClock;
  walkers: Walker[];
  drainUsed: number;
  rng: () => number;
  lastUnlock: FamiliarId | null;
};

const runtimes = new WeakMap<object, FamiliarRuntime>();

export function familiarRuntime(engine: AnyEngine): FamiliarRuntime {
  let rt = runtimes.get(engine);
  if (!rt) { rt = { body: null, clock: newAssistClock(), walkers: [], drainUsed: 0, rng: Math.random, lastUnlock: null }; runtimes.set(engine, rt); }
  return rt;
}

function familiarsSave(engine: AnyEngine) {
  const s = engine.settings;
  if (!s.familiars || typeof s.familiars !== "object") s.familiars = { unlocked: [], selected: null, assists: true, bestChain: 0 };
  return s.familiars as { unlocked: string[]; selected: string | null; assists: boolean; bestChain: number };
}

/**
 * Unlock milestones. From save v8 these come from the expansion's own cabinet
 * counters (seeded from campaign records on migration) so a collection reset
 * really resets familiars instead of re-unlocking them from campaign records.
 */
export function unlockStats(engine: AnyEngine): UnlockStats {
  const s = engine.settings ?? {};
  const cab = s.cabinet;
  if (cab && typeof cab === "object") {
    return {
      stagesCleared: cab.chambers?.length ?? 0,
      itemsDiscovered: discoveredCount(s.collection?.items ?? {}),
      secrets: cab.secretRooms?.length ?? 0,
      bestChain: s.familiars?.bestChain ?? 0,
      perfectClears: cab.counters?.perfects ?? 0,
    };
  }
  return {
    stagesCleared: Object.keys(s.bestStageTimes ?? {}).length,
    itemsDiscovered: discoveredCount(s.collection?.items ?? {}),
    secrets: s.secrets ?? 0,
    bestChain: s.familiars?.bestChain ?? 0,
    perfectClears: s.perfectClears ?? 0,
  };
}

/** Hooks for later milestones (M5 living cabinet): title walker cap, title dance, assist counting. */
export type FamiliarDecor = {
  walkerCap: (engine: AnyEngine) => number;
  dancing: (engine: AnyEngine) => boolean;
  onAssist: (engine: AnyEngine, def: FamiliarDefinition) => void;
};
const DECOR: FamiliarDecor = { walkerCap: () => FAMILIAR_LIMITS.maxTitleWalkers, dancing: () => false, onAssist: () => {} };
export function setFamiliarDecor(next: Partial<FamiliarDecor>) { Object.assign(DECOR, next); }

/** Equipped familiar: explicit choice, else the first unlocked (auto), else none. */
export function activeFamiliar(engine: AnyEngine): FamiliarDefinition | undefined {
  const f = familiarsSave(engine);
  if (f.selected === "none") return undefined;
  if (isFamiliarId(f.selected) && f.unlocked.includes(f.selected)) return familiarById(f.selected);
  return FAMILIARS.find(def => f.unlocked.includes(def.id));
}

function heroAnchor(engine: AnyEngine) {
  const p = engine.player;
  return { x: p.x + p.w / 2, y: p.y + p.h / 2, facing: (p.facing ?? 1) as 1 | -1, floor: p.y + p.h };
}

function ensureBody(engine: AnyEngine, rt: FamiliarRuntime): FamiliarBody | null {
  const def = activeFamiliar(engine);
  if (!def) { rt.body = null; return null; }
  if (!rt.body || rt.body.id !== def.id) {
    const h = heroAnchor(engine);
    rt.body = newBody(def.id, h.x - h.facing * 50, def.flier ? h.y - 46 : h.floor);
  }
  return rt.body;
}

function event(engine: AnyEngine, ev: FamiliarEvent, say = "") {
  const rt = runtimes.get(engine);
  const body = rt ? ensureBody(engine, rt) : null;
  if (body) notify(body, ev, say);
}

/** Records milestones, unlocks familiars deterministically and announces them. */
export function checkUnlocks(engine: AnyEngine): FamiliarId[] {
  if (engine.state === "attract") return [];
  const save = familiarsSave(engine);
  const fresh = evaluateUnlocks(unlockStats(engine), save.unlocked);
  if (!fresh.length) return fresh;
  save.unlocked.push(...fresh);
  const rt = familiarRuntime(engine);
  rt.lastUnlock = fresh[fresh.length - 1];
  const copy = copyForEngine(engine);
  engine.message = `${copy.unlockedToast}: ${loreName(interfaceRuntime(engine).lang, rt.lastUnlock, familiarById(rt.lastUnlock)!.name).toUpperCase()}`;
  engine.messageLife = 2.6;
  ensureBody(engine, rt);
  event(engine, "unlock");
  engine.audio?.reward?.();
  engine.save?.();
  return fresh;
}

/* ------------------------------------------------------------- assists */

function trySpend(engine: AnyEngine, rt: FamiliarRuntime, def: FamiliarDefinition, say: string) {
  spendAssist(rt.clock, def);
  DECOR.onAssist(engine, def);
  if (rt.body) notify(rt.body, "assist", say);
  engine.audio?.tone?.(988, 0.07, "triangle", 120, 0.06);
}

function canAssist(engine: AnyEngine, rt: FamiliarRuntime, def: FamiliarDefinition | undefined): def is FamiliarDefinition {
  return !!def && ASSIST_STATES.has(engine.state) && assistReady(rt.clock, def, { attract: engine.state === "attract", enabled: familiarsSave(engine).assists !== false });
}

function runPassiveAssist(engine: AnyEngine, rt: FamiliarRuntime) {
  const def = activeFamiliar(engine);
  if (!canAssist(engine, rt, def)) return;
  const L = FAMILIAR_LIMITS;
  const h = heroAnchor(engine);
  switch (def.assist.kind) {
    case "coil": {
      const b = (engine.bubbles as any[]).find(x => x.phase === "warning" && x.enemyId);
      if (b) { b.life += L.coilSeconds; b.phase = "occupied"; trySpend(engine, rt, def, "COIL +1s"); }
      break;
    }
    case "spook": {
      const e = (engine.enemies as any[]).find(x => (x.state === "normal" || x.state === "furious") && Math.hypot(x.x + x.w / 2 - h.x, x.y + x.h / 2 - h.y) < L.spookRadius);
      if (e) { const st = livingRuntime(engine).status; const s = st.get(e.id) ?? { freeze: 0, slow: 0 }; s.freeze = Math.max(s.freeze, 1); st.set(e.id, s); trySpend(engine, rt, def, "BOO!"); }
      break;
    }
    case "silk": {
      const r = (engine.rewards as any[]).filter(x => x.life < L.silkMaxLife && x.life > 0 && Math.hypot(x.x - h.x, x.y - h.y) < L.silkRadius).sort((a, b) => a.life - b.life)[0];
      if (r) { r.x = h.x; r.y = engine.player.y + 24; r.vy = 0; trySpend(engine, rt, def, "SILK"); }
      break;
    }
    case "omen": {
      const whisper = SECRET_WHISPERS[engine.level?.secret];
      const elapsed = (engine.level?.time ?? 0) - (engine.levelTime ?? 0);
      if (whisper && elapsed >= L.omenAfter) { engine.message = whisper; engine.messageLife = 3; trySpend(engine, rt, def, "CAW!"); }
      break;
    }
    default: break; // ninelives (afterDeath) and drain (popChain) are event-driven
  }
}

/* ------------------------------------------------------------- drawing */

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath(); c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35); c.fill();
}

function drawSprite(engine: AnyEngine, def: FamiliarDefinition, frame: number, size: number) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const assets = expansionRuntime(engine).assets;
  if (assets.draw(c, def.frames[frame], 0, 0, size) || assets.draw(c, def.icon, 0, 0, size)) return;
  c.fillStyle = def.tint; c.beginPath(); c.arc(0, 0, size * 0.36, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#08040b"; c.beginPath(); c.arc(-size * 0.12, -size * 0.05, 3, 0, Math.PI * 2); c.arc(size * 0.12, -size * 0.05, 3, 0, Math.PI * 2); c.fill();
}

export function drawFamiliar(engine: AnyEngine, body: FamiliarBody, opts: { alpha?: number; size?: number } = {}) {
  const def = familiarById(body.id)!;
  const c = engine.ctx as CanvasRenderingContext2D;
  const rm = !!engine.settings?.reducedMotion;
  const size = opts.size ?? FAMILIAR_LIMITS.size;
  const cy = def.flier ? body.y : body.y - size / 2;
  const moving = Math.abs(body.vx) > 30 && !rm;
  const bob = moving && !def.flier ? Math.abs(Math.sin(body.motionClock * 14)) * -3 : 0;
  const sq = rm ? 0 : body.squash;
  const sleeping = body.state === "sleep";
  c.save();
  c.globalAlpha = (opts.alpha ?? 1) * (def.motion === "drift" ? 0.88 : 0.96) * (body.event === "death" ? 0.75 : 1);
  // Soft contact shadow for walkers keeps them grounded without hiding anything.
  if (!def.flier) { c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(body.x, body.y - 1, size * 0.32, 4, 0, 0, Math.PI * 2); c.fill(); }
  c.translate(body.x, cy + bob + (sleeping ? size * 0.06 : 0));
  c.rotate(body.tilt);
  c.scale(body.facing * (1 + sq * 0.5), (1 - sq * 0.4) * (sleeping ? 0.88 : 1));
  drawSprite(engine, def, sleeping ? 0 : frameIndex(body, rm), size);
  c.restore();
  drawExpression(engine, body, def, size, cy);
}

function drawExpression(engine: AnyEngine, body: FamiliarBody, def: FamiliarDefinition, size: number, cy: number) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const rm = !!engine.settings?.reducedMotion;
  const t = rm ? 0 : body.stateTime;
  const top = cy - size / 2;
  c.save();
  c.font = "bold 13px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
  switch (body.state === "sleep" ? "sleepy" : body.expression) {
    case "sleepy":
      for (let i = 0; i < 3; i++) {
        const k = rm ? i / 3 : ((t * 0.6 + i / 3) % 1);
        c.globalAlpha = rm ? 0.85 : 1 - k; c.fillStyle = "#C8D6FF"; c.font = `bold ${13 + i * 4}px monospace`;
        c.fillText("z", body.x + size * 0.3 + k * 16, top + 4 - k * 26);
      }
      break;
    case "love": case "happy": {
      c.fillStyle = body.expression === "love" ? "#FF4F9A" : "#FFD36A";
      const n = body.expression === "love" ? 2 : 1;
      for (let i = 0; i < n; i++) { const k = rm ? 0.4 : (t * 0.9 + i * 0.5) % 1; c.globalAlpha = rm ? 0.9 : 1 - k * 0.8; heart(c, body.x + (i ? 15 : -13), top - 4 - k * 22, 9); }
      break;
    }
    case "sweat":
      c.fillStyle = "#7FD8FF"; c.beginPath(); const sx = body.x + size * 0.34, sy = top + 6 + (rm ? 0 : (t * 20) % 8);
      c.moveTo(sx, sy - 9); c.quadraticCurveTo(sx + 7, sy + 3, sx, sy + 6); c.quadraticCurveTo(sx - 7, sy + 3, sx, sy - 9); c.fill();
      break;
    case "sad":
      c.fillStyle = "#7FD8FF"; c.globalAlpha = 0.9; c.beginPath(); c.arc(body.x - 6, top + size * 0.55 + (rm ? 0 : (t * 14) % 10), 2.5, 0, Math.PI * 2); c.fill();
      break;
    case "surprised":
      c.fillStyle = "#FFD36A"; c.font = "bold 22px monospace"; c.fillText("!", body.x + size * 0.32, top - 4);
      break;
    default: break;
  }
  if (body.sayTime > 0 && body.say) {
    c.globalAlpha = Math.min(1, body.sayTime / 0.3); c.font = "bold 12px monospace";
    const w = Math.min(140, c.measureText(body.say).width + 12), bx = Math.max(30 + w / 2, Math.min(W - 30 - w / 2, body.x)), by = Math.max(110, top - 18);
    c.fillStyle = "rgba(8,4,16,.85)"; c.fillRect(bx - w / 2, by - 9, w, 18);
    c.strokeStyle = def.tint; c.lineWidth = 1.5; c.strokeRect(bx - w / 2, by - 9, w, 18);
    c.fillStyle = "#FFD6F1"; c.fillText(body.say, bx, by + 1);
  }
  c.restore();
}

/* ------------------------------------------------------------ pause tab */

const CARD = { w: 206, h: 118, gap: 12, top: 232 };

function drawFamiliarsTab(engine: AnyEngine, ui: InterfaceRuntime, copy: ExpansionCopy) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const save = familiarsSave(engine), stats = unlockStats(engine), active = activeFamiliar(engine);
  const rm = !!engine.settings?.reducedMotion;
  const accent = "#FFD36A";
  engine.label(fitText(engine, `${copy.familiarsTitle} · ${save.unlocked.filter(isFamiliarId).length}/${FAMILIARS.length}`, 13, 640, "Georgia"), W / 2, 188, 13, accent, "center", "Georgia");
  engine.label(save.assists === false ? copy.assistsOff : copy.assistsOn, W / 2, 216, 8, save.assists === false ? "#9fb3d1" : "#20C98B", "center");
  const startX = (W - (3 * CARD.w + 2 * CARD.gap)) / 2;
  FAMILIARS.forEach((def, i) => {
    const x = startX + (i % 3) * (CARD.w + CARD.gap), y = CARD.top + Math.floor(i / 3) * (CARD.h + CARD.gap);
    const unlocked = save.unlocked.includes(def.id), selected = ui.pick.familiars === i, equipped = active?.id === def.id;
    c.save();
    c.fillStyle = selected ? "rgba(48,14,56,.92)" : "rgba(14,8,22,.88)"; c.fillRect(x, y, CARD.w, CARD.h);
    c.strokeStyle = selected ? accent : equipped ? def.tint : "#3a3348"; c.lineWidth = selected ? 3 : 1.5; c.strokeRect(x, y, CARD.w, CARD.h);
    c.translate(x + 48, y + 52); c.globalAlpha = unlocked ? 1 : 0.18;
    drawSprite(engine, def, unlocked ? Math.floor(((engine.animTime ?? 0) / FAMILIAR_LIMITS.frameTime)) % 4 * (rm ? 0 : 1) : 0, 70);
    c.restore();
    if (!unlocked) engine.label("?", x + 48, y + 60, 16, "#8d7fa8", "center");
    engine.label(fitText(engine, unlocked ? loreName(interfaceRuntime(engine).lang, def.id, def.name).toUpperCase() : copy.familiarLocked, 10, 110), x + 92, y + 40, 10, unlocked ? def.tint : "#8d7fa8");
    const p = unlockProgress(def, stats);
    const status = equipped ? `${copy.equipped} ✓` : unlocked ? "" : `${p.have}/${p.need}`;
    if (status) engine.label(fitText(engine, status, 8, 110), x + 92, y + 72, 8, equipped ? "#20C98B" : "#9fb3d1");
    if (unlocked) engine.label(fitText(engine, def.assist.name.toUpperCase(), 8, 110), x + 92, y + 100, 8, "#c9d6ec");
  });
  const def = FAMILIARS[ui.pick.familiars] ?? FAMILIARS[0];
  const unlocked = save.unlocked.includes(def.id);
  engine.label(fitText(engine, unlocked ? `${def.assist.name.toUpperCase()} · ${def.assist.summary}` : def.unlock.hint, 9, 620), W / 2, 506, 9, unlocked ? "#FFD6F1" : "#9fb3d1", "center");
  engine.label(fitText(engine, unlocked ? def.idleBehaviour : `${def.name.toUpperCase()} · ${def.unlock.hint}`, 8, 620), W / 2, 540, 8, "#9fb3d1", "center");
}

function selectFamiliar(engine: AnyEngine, ui: InterfaceRuntime) {
  const def = FAMILIARS[ui.pick.familiars];
  const save = familiarsSave(engine);
  if (!def || !save.unlocked.includes(def.id)) { engine.audio?.tone?.(140, 0.18, "sawtooth", -40, 0.08); return; }
  save.selected = activeFamiliar(engine)?.id === def.id ? "none" : def.id;
  const rt = familiarRuntime(engine); rt.body = null; ensureBody(engine, rt);
  if (rt.body) notify(rt.body, "unlock");
  engine.save?.(); engine.audio?.reward?.(); engine.syncAuditData?.();
}

function toggleAssists(engine: AnyEngine) {
  const save = familiarsSave(engine);
  save.assists = save.assists === false;
  engine.save?.(); engine.audio?.tone?.(save.assists ? 660 : 330, 0.06, "triangle", 0, 0.06); engine.syncAuditData?.();
}

/* --------------------------------------------------------------- install */

export function installFamiliars(EngineClass: EngineConstructor) {
  const proto = EngineClass.prototype as AnyEngine;
  if (proto[INSTALL_KEY]) return;
  Object.defineProperty(proto, INSTALL_KEY, { value: true, configurable: false });
  registerPauseTab("familiars", { size: () => FAMILIARS.length, select: selectFamiliar, jump: engine => toggleAssists(engine), draw: drawFamiliarsTab });
  registerCollectionSuffix((engine, copy) => copy.familiarsCount(familiarsSave(engine).unlocked.filter(isFamiliarId).length, FAMILIARS.length));

  const o = {
    start: proto.start, update: proto.update, drawPlatforms: proto.drawPlatforms, drawTitle: proto.drawTitle, popChain: proto.popChain,
    damagePlayer: proto.damagePlayer, afterDeath: proto.afterDeath, clearStage: proto.clearStage, collectReward: proto.collectReward,
    loadLevelData: proto.loadLevelData, toTitle: proto.toTitle, syncAuditData: proto.syncAuditData,
  };

  proto.start = function (this: AnyEngine) {
    if (this.devTools && typeof window !== "undefined") {
      // Development-only QA hook (screenshots, manual testing). Not shipped behaviour.
      (window as any).__bubbleHexFamiliars = {
        unlock: (id: string) => { const s = familiarsSave(this); for (const f of FAMILIARS) if ((id === "all" || f.id === id) && !s.unlocked.includes(f.id)) s.unlocked.push(f.id); this.save?.(); },
        select: (id: string) => { familiarsSave(this).selected = id; familiarRuntime(this).body = null; this.save?.(); },
        event: (ev: FamiliarEvent, say = "") => event(this, ev, say),
        nap: () => { const b = familiarRuntime(this).body; if (b) b.playerIdle = FAMILIAR_LIMITS.sleepAfter; },
        state: () => { const rt = familiarRuntime(this); return { body: rt.body ? { ...rt.body } : null, clock: { ...rt.clock }, save: JSON.parse(JSON.stringify(familiarsSave(this))), stats: unlockStats(this) }; },
      };
    }
    checkUnlocks(this);
    return o.start.call(this);
  };

  proto.update = function (this: AnyEngine, dt: number) {
    const result = o.update.call(this, dt);
    const rt = familiarRuntime(this);
    if (STEP_STATES.has(this.state)) {
      const body = ensureBody(this, rt);
      if (body) {
        const h = heroAnchor(this), p = this.player;
        const active = Math.abs(p.vx) > 25 || !p.grounded || !!this.held?.bubble || !!this.held?.jump || this.state !== "playing";
        stepFamiliar(body, { dt, hero: h, floorY: h.floor, playerActive: active, reducedMotion: !!this.settings?.reducedMotion, rng: rt.rng });
      }
      tickAssist(rt.clock, dt);
      runPassiveAssist(this, rt);
    } else if (this.state === "title") {
      const unlocked = FAMILIARS.filter(f => familiarsSave(this).unlocked.includes(f.id)).slice(0, Math.max(1, Math.min(FAMILIARS.length, DECOR.walkerCap(this))));
      const ids = unlocked.length ? unlocked.map(f => f.id) : ["hex_cat" as FamiliarId];
      if (rt.walkers.map(w => w.id).join() !== ids.join()) rt.walkers = ids.map((id, i) => ({ id, x: 230 + i * (ids.length > 3 ? 90 : 150), dir: i % 2 ? -1 : 1, pause: 0, clock: i * 0.37 }));
      for (const w of rt.walkers) stepWalker(w, dt, 210, 690, rt.rng, !!this.settings?.reducedMotion);
    }
    return result;
  };

  proto.drawPlatforms = function (this: AnyEngine) {
    o.drawPlatforms.call(this);
    // World layer: after platforms, before rewards / bubbles / enemies / hero.
    if (!WORLD_STATES.has(this.state)) return;
    const body = familiarRuntime(this).body;
    if (body && activeFamiliar(this)) drawFamiliar(this, body);
  };

  proto.drawTitle = function (this: AnyEngine) {
    o.drawTitle.call(this);
    const rt = familiarRuntime(this);
    const teaser = !FAMILIARS.some(f => familiarsSave(this).unlocked.includes(f.id));
    const dance = !teaser && DECOR.dancing(this) && !this.settings?.reducedMotion;
    rt.walkers.forEach((w, i) => {
      const body = newBody(w.id, w.x, 690);
      body.facing = w.dir; body.vx = w.pause > 0 ? 0 : w.dir * 46; body.motionClock = w.clock; body.frameClock = w.clock;
      if (w.pause > 0) body.expression = "happy";
      if (dance) {
        // Title idle dance: hop on the beat, sway, face the crowd.
        const t = (this.animTime ?? 0) * 5 + i * 0.9;
        body.y = 690 - Math.abs(Math.sin(t)) * 12; body.vx = 0; body.tilt = Math.sin(t * 0.5) * 0.18; body.expression = "happy";
        body.facing = Math.sin(t * 0.25) > 0 ? 1 : -1;
      }
      drawFamiliar(this, body, { alpha: teaser ? 0.3 : 0.95, size: 46 });
    });
  };

  proto.popChain = function (this: AnyEngine, root: AnyEngine) {
    const before = (this.pendingPops as any[]).length;
    o.popChain.call(this, root);
    const chain = (this.pendingPops as any[]).length - before;
    if (chain <= 0 || this.state === "attract") return;
    const save = familiarsSave(this);
    if (chain > save.bestChain) { save.bestChain = chain; checkUnlocks(this); }
    if (chain >= 5) event(this, "bigChain"); else if (chain >= 2) event(this, "combo");
    const rt = familiarRuntime(this), def = activeFamiliar(this);
    if (chain >= 3 && def?.assist.kind === "drain" && canAssist(this, rt, def)) {
      const add = Math.min(FAMILIAR_LIMITS.drainSeconds, Math.max(0, (this.level?.time ?? 99) - this.levelTime));
      if (add > 0) { this.levelTime += add; trySpend(this, rt, def, `+${Math.round(add)}s`); }
    }
  };

  proto.damagePlayer = function (this: AnyEngine) {
    const lives = this.lives, shield = this.upgrades?.shield;
    o.damagePlayer.call(this);
    if (this.lives < lives) event(this, this.lives <= 0 ? "death" : "hurt");
    else if (shield && !this.upgrades?.shield) event(this, "startle");
  };

  proto.afterDeath = function (this: AnyEngine) {
    o.afterDeath.call(this);
    if (this.state !== "playing") return;
    const rt = familiarRuntime(this), def = activeFamiliar(this);
    if (def?.assist.kind === "ninelives" && canAssist(this, rt, def)) {
      this.player.invuln = (this.player.invuln ?? 0) + FAMILIAR_LIMITS.ninelivesSeconds;
      trySpend(this, rt, def, "NINE LIVES");
    }
  };

  proto.clearStage = function (this: AnyEngine, demo: boolean) {
    o.clearStage.call(this, demo);
    if (demo || this.state !== "stageClear") return;
    event(this, "clear");
    checkUnlocks(this);
  };

  proto.collectReward = function (this: AnyEngine, r: AnyEngine) {
    o.collectReward.call(this, r);
    if (r.itemId) checkUnlocks(this);
  };

  proto.loadLevelData = function (this: AnyEngine, level: unknown) {
    o.loadLevelData.call(this, level);
    const rt = familiarRuntime(this);
    resetAssistStage(rt.clock); rt.drainUsed = 0; rt.body = null;
  };

  proto.toTitle = function (this: AnyEngine) {
    o.toTitle.call(this);
    const rt = runtimes.get(this); if (rt) rt.body = null;
  };

  proto.syncAuditData = function (this: AnyEngine) {
    o.syncAuditData.call(this);
    if (!this.canvas?.dataset) return;
    const rt = runtimes.get(this), def = activeFamiliar(this), save = familiarsSave(this);
    Object.assign(this.canvas.dataset, {
      familiar: def?.id ?? "none",
      familiarState: rt?.body?.state ?? "",
      familiarExpression: rt?.body?.expression ?? "",
      familiarUnlocked: String(save.unlocked.filter(isFamiliarId).length),
      familiarAssists: save.assists === false ? "off" : "on",
      familiarCooldown: rt ? rt.clock.cooldown.toFixed(1) : "0",
    });
  };
}
