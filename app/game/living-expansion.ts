/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BUBBLE HEX — Forbidden Expansion, milestone 3: living bubbles (engine hooks).
 *
 * Special ammo variants of the hero's normal bubble plus procedural
 * personalities. Installed after M1/M2 using the same prototype-hook pattern.
 * When no special ammo is selected every hook short-circuits to the original
 * method, so the native fire/trap/pop rules are unchanged.
 */
import { expansionRuntime, fitText } from "./forbidden-expansion";
import {
  AMMO_DEFINITIONS, LIVING_LIMITS, addCharges, ammoById, awardBonus, awardTime, canSpawnBubble, childAllowance,
  clampStatus, consumeCharge, cycleAmmo, isAmmoType, newBonusLedger, newInventory, newMeta, personalityById,
  personalityFor, rollAmmoDrop, steer, thunderTargets, totalCharges,
  type AmmoInventory, type AmmoType, type BonusLedger, type LivingMeta,
} from "./living-bubbles";

const INSTALL_KEY = Symbol.for("bubblehex.forbidden-expansion.m3");
const W = 960;
export const AMMO_REWARD_KIND = "HEX_AMMO";
const AMMO_PER_ORB = 2;
const CYCLE_KEYS = new Set(["KeyV", "KeyS", "ArrowDown"]);

type EngineConstructor = { prototype: object };
type AnyEngine = Record<PropertyKey, any>;
type Fx = { kind: "bolt" | "cloud" | "frost" | "fire" | "fold" | "time"; x: number; y: number; x2: number; y2: number; age: number; life: number; tint: string; radius: number };
type Status = { freeze: number; slow: number };

export type LivingRuntime = {
  inv: AmmoInventory;
  meta: WeakMap<object, LivingMeta>;
  status: Map<number, Status>;
  globalSlow: number;
  fx: Fx[];
  ledger: BonusLedger;
  stageDrops: number;
  killsSinceDrop: number;
  chainSeq: number;
  chainOf: WeakMap<object, number>;
  rng: () => number;
  keyHandler: ((event: KeyboardEvent) => void) | null;
  stats: { childrenSpawned: number; thunderJumps: number; refusedSpawns: number };
};

const runtimes = new WeakMap<object, LivingRuntime>();

export function livingRuntime(engine: AnyEngine): LivingRuntime {
  let rt = runtimes.get(engine);
  if (!rt) {
    rt = {
      inv: newInventory(), meta: new WeakMap(), status: new Map(), globalSlow: 0, fx: [], ledger: newBonusLedger(),
      stageDrops: 0, killsSinceDrop: LIVING_LIMITS.minKillsBetweenDrops, chainSeq: 0, chainOf: new WeakMap(), rng: Math.random,
      keyHandler: null, stats: { childrenSpawned: 0, thunderJumps: 0, refusedSpawns: 0 },
    };
    runtimes.set(engine, rt);
  }
  return rt;
}

function resetStage(rt: LivingRuntime) {
  rt.status.clear(); rt.globalSlow = 0; rt.fx = []; rt.ledger = newBonusLedger(); rt.stageDrops = 0;
  rt.killsSinceDrop = LIVING_LIMITS.minKillsBetweenDrops;
}

/** Selected ammo with a live charge, else null (normal bubble). */
export function selectedAmmo(engine: AnyEngine): AmmoType | null {
  const inv = livingRuntime(engine).inv;
  return inv.selected && (inv.charges[inv.selected] ?? 0) > 0 ? inv.selected : null;
}

export function grantAmmo(engine: AnyEngine, type: AmmoType, amount: number): number {
  return addCharges(livingRuntime(engine).inv, type, amount);
}

export function metaFor(engine: AnyEngine, bubble: object): LivingMeta | undefined {
  return livingRuntime(engine).meta.get(bubble);
}

function pushFx(engine: AnyEngine, rt: LivingRuntime, fx: Omit<Fx, "age">) {
  rt.fx.push({ ...fx, age: 0, life: engine.settings?.reducedMotion ? Math.min(fx.life, 0.5) : fx.life });
  while (rt.fx.length > LIVING_LIMITS.maxFx) rt.fx.shift();
}

function spawnChild(engine: AnyEngine, rt: LivingRuntime, parent: LivingMeta, x: number, y: number, vx: number, vy: number, type: AmmoType | null, phase: "fired" | "slowing"): boolean {
  if (!canSpawnBubble(engine.bubbles.length)) { rt.stats.refusedSpawns++; return false; }
  const cx = Math.max(45, Math.min(W - 45, x)), cy = Math.max(100, y);
  const child = { id: engine.nextId++, x: cx, y: cy, prevX: cx, prevY: cy, vx, vy, r: 18, age: 0, phase, life: 4 };
  engine.bubbles.push(child);
  rt.meta.set(child, newMeta(type, null, parent.depth + 1, cx, cy));
  parent.children++; rt.stats.childrenSpawned++;
  return true;
}

function applyStatus(engine: AnyEngine, rt: LivingRuntime, x: number, y: number, radius: number, kind: "freeze" | "slow", seconds: number): number {
  let hit = 0;
  for (const e of engine.enemies as any[]) {
    if (e.state !== "normal" && e.state !== "furious") continue;
    if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) > radius) continue;
    const s = rt.status.get(e.id) ?? { freeze: 0, slow: 0 };
    s[kind] = clampStatus(s[kind], seconds);
    rt.status.set(e.id, s); hit++;
  }
  return hit;
}

function addBonus(engine: AnyEngine, rt: LivingRuntime, chainId: number, points: number, x: number, y: number) {
  const grant = awardBonus(rt.ledger, chainId, points);
  if (grant > 0) { engine.score += grant; engine.addScoreBurst?.(x, y - 24, grant); }
  return grant;
}

function onPop(engine: AnyEngine, rt: LivingRuntime, b: AnyEngine, meta: LivingMeta, killPoints: number) {
  const chainId = rt.chainOf.get(b) ?? -1;
  const type = meta.type!;
  const def = ammoById(type)!;
  switch (type) {
    case "venom":
      applyStatus(engine, rt, b.x, b.y, 130, "slow", 3);
      pushFx(engine, rt, { kind: "cloud", x: b.x, y: b.y, x2: 0, y2: 0, life: 1.2, tint: def.tint, radius: 130 });
      break;
    case "frost":
      applyStatus(engine, rt, b.x, b.y, 150, "freeze", 2.5);
      pushFx(engine, rt, { kind: "frost", x: b.x, y: b.y, x2: 0, y2: 0, life: 0.9, tint: def.tint, radius: 150 });
      break;
    case "inferno": {
      const hit = applyStatus(engine, rt, b.x, b.y, 130, "freeze", 1.5);
      if (hit) addBonus(engine, rt, chainId, 200 * hit, b.x, b.y);
      pushFx(engine, rt, { kind: "fire", x: b.x, y: b.y, x2: 0, y2: 0, life: 0.7, tint: def.tint, radius: 130 });
      break;
    }
    case "time": {
      const t = awardTime(rt.ledger, LIVING_LIMITS.timePerPop);
      if (t > 0) engine.levelTime = Math.min(engine.level?.time ?? 99, (engine.levelTime ?? 0) + t);
      rt.globalSlow = clampStatus(rt.globalSlow, 2);
      pushFx(engine, rt, { kind: "time", x: b.x, y: b.y, x2: 0, y2: 0, life: 1, tint: def.tint, radius: 90 });
      break;
    }
    case "klein": {
      if (killPoints > 0) addBonus(engine, rt, chainId, killPoints * 0.5, b.x, b.y);
      if (childAllowance(meta, engine.bubbles.length, 1) > 0) spawnChild(engine, rt, meta, W - b.x, b.y, 0, -30, null, "slowing");
      pushFx(engine, rt, { kind: "fold", x: b.x, y: b.y, x2: W - b.x, y2: b.y, life: 0.8, tint: def.tint, radius: 40 });
      break;
    }
    case "recursive": {
      const n = childAllowance(meta, engine.bubbles.length, 2);
      const childType: AmmoType | null = meta.depth + 1 < LIVING_LIMITS.maxRecursionDepth ? "recursive" : null;
      for (let i = 0; i < n; i++) spawnChild(engine, rt, meta, b.x + (i ? 20 : -20), b.y, (i ? 1 : -1) * 320, -50, childType, "fired");
      break;
    }
    default:
      break; // thunder (handled at chain time), gravity, phantom, mirror, widow: no pop effect
  }
}

function drawAmmoSprite(engine: AnyEngine, type: AmmoType, x: number, y: number, size: number, alpha = 1) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const def = ammoById(type)!;
  c.save(); c.globalAlpha *= alpha;
  if (!expansionRuntime(engine).assets.draw(c, def.sprite, x, y, size)) {
    c.fillStyle = def.tint + "44"; c.strokeStyle = def.tint; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, size * 0.42, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = def.tint; c.font = `bold ${Math.round(size * 0.4)}px monospace`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(def.glyph, x, y + 1);
  }
  c.restore();
}

/** Code-drawn per-type accent around a living bubble (static under reduced motion). */
function drawTypeAccent(engine: AnyEngine, b: AnyEngine, type: AmmoType) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const rm = !!engine.settings?.reducedMotion;
  const def = ammoById(type)!;
  const t = rm ? 0 : b.age;
  const r = b.r + 4;
  c.save(); c.strokeStyle = def.tint; c.fillStyle = def.tint; c.lineWidth = 3; c.globalAlpha = 0.9;
  // Type ring in the ammo tint so every variant reads at a glance.
  c.beginPath(); c.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 2; c.globalAlpha = 0.85;
  switch (type) {
    case "thunder": for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; c.beginPath(); c.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); c.lineTo(b.x + Math.cos(a + .25) * (r + 7), b.y + Math.sin(a + .25) * (r + 7)); c.lineTo(b.x + Math.cos(a + .4) * (r + 2), b.y + Math.sin(a + .4) * (r + 2)); c.stroke(); } break;
    case "frost": for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * .4; c.beginPath(); c.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); c.lineTo(b.x + Math.cos(a) * (r + 6), b.y + Math.sin(a) * (r + 6)); c.stroke(); } break;
    case "inferno": c.globalAlpha = rm ? .5 : .35 + .25 * Math.sin(t * 14); c.beginPath(); c.arc(b.x, b.y, r + 3, 0, Math.PI * 2); c.stroke(); break;
    case "gravity": c.setLineDash([4, 6]); c.lineDashOffset = -t * 30; c.beginPath(); c.arc(b.x, b.y, r + 10, 0, Math.PI * 2); c.stroke(); break;
    case "time": { const a = t * 2; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + Math.cos(a - Math.PI / 2) * (r - 6), b.y + Math.sin(a - Math.PI / 2) * (r - 6)); c.stroke(); break; }
    case "widow": for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(b.x + Math.cos(a) * (r - 2), b.y + Math.sin(a) * (r - 2)); c.lineTo(b.x + Math.cos(a) * (r + 8), b.y + Math.sin(a) * (r + 8)); c.stroke(); } break;
    case "venom": c.globalAlpha = .4; c.beginPath(); c.arc(b.x - 4, b.y + r + 3 + (rm ? 0 : Math.sin(t * 3) * 2), 3, 0, Math.PI * 2); c.fill(); break;
    case "klein": c.beginPath(); c.ellipse(b.x, b.y, r + 4, (r + 4) * .45, rm ? 0 : t, 0, Math.PI * 2); c.stroke(); break;
    default: break;
  }
  c.restore();
}

function drawFx(engine: AnyEngine, rt: LivingRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const rm = !!engine.settings?.reducedMotion;
  for (const fx of rt.fx) {
    const p = Math.min(1, fx.age / fx.life), fade = 1 - p;
    c.save(); c.globalAlpha = fade * 0.8; c.strokeStyle = fx.tint; c.fillStyle = fx.tint; c.lineWidth = 3;
    if (fx.kind === "bolt") {
      c.beginPath(); c.moveTo(fx.x, fx.y);
      const steps = 5;
      for (let i = 1; i < steps; i++) { const k = i / steps; const off = rm ? 0 : ((i * 37 + Math.floor(fx.age * 30)) % 19) - 9; c.lineTo(fx.x + (fx.x2 - fx.x) * k + off, fx.y + (fx.y2 - fx.y) * k - off); }
      c.lineTo(fx.x2, fx.y2); c.stroke();
    } else if (fx.kind === "fold") {
      c.setLineDash([6, 6]); c.beginPath(); c.moveTo(fx.x, fx.y); c.quadraticCurveTo(W / 2, fx.y - 120, fx.x2, fx.y2); c.stroke();
    } else {
      const radius = rm ? fx.radius : fx.radius * (0.4 + 0.6 * p);
      if (fx.kind === "cloud") { c.globalAlpha = fade * 0.22; c.beginPath(); c.arc(fx.x, fx.y, radius, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = fade * 0.7; c.beginPath(); c.arc(fx.x, fx.y, radius, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
  // Frozen / slowed enemies get a code-drawn outline.
  for (const e of engine.enemies as any[]) {
    const s = rt.status.get(e.id);
    if (!s || e.state === "dead" || e.state === "trapped") continue;
    c.save(); c.strokeStyle = s.freeze > 0 ? "#8FE8FF" : "#7CFF4F"; c.lineWidth = 2; c.globalAlpha = 0.8; c.setLineDash(s.freeze > 0 ? [] : [3, 3]);
    c.strokeRect(e.x - 3, e.y - 3, e.w + 6, e.h + 6); c.restore();
  }
}

/** Top-left ammo chip: only drawn once the player owns special ammo. */
function drawAmmoHud(engine: AnyEngine, rt: LivingRuntime) {
  const total = totalCharges(rt.inv);
  if (total <= 0) return;
  const c = engine.ctx as CanvasRenderingContext2D;
  const sel = selectedAmmo(engine);
  const x = 30, y = 92, w = 214, h = 56;
  c.save();
  c.fillStyle = "rgba(8,4,16,.86)"; c.fillRect(x, y, w, h);
  c.strokeStyle = sel ? ammoById(sel)!.tint : "#5f6f94"; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (sel) drawAmmoSprite(engine, sel, x + 28, y + h / 2, 42);
  else { c.strokeStyle = "#FFD6F1"; c.beginPath(); c.arc(x + 28, y + h / 2, 15, 0, Math.PI * 2); c.stroke(); }
  const name = sel ? ammoById(sel)!.name.replace(" Bubble", "").toUpperCase() : "NORMAL";
  engine.label(fitText(engine, name, 11, w - 70), x + 56, y + 24, 11, sel ? ammoById(sel)!.tint : "#FFD6F1");
  // Charge pips for the selected ammo; total owned on the right.
  const charges = sel ? rt.inv.charges[sel] ?? 0 : 0;
  for (let i = 0; i < LIVING_LIMITS.maxChargesPerType; i++) {
    c.fillStyle = i < charges ? (sel ? ammoById(sel)!.tint : "#FFD6F1") : "rgba(255,255,255,.15)";
    c.fillRect(x + 56 + i * 16, y + 36, 12, 8);
  }
  engine.label(`${total}/${LIVING_LIMITS.maxChargesTotal}`, x + w - 10, y + 46, 8, "#9fb3d1", "right");
  c.restore();
}

function drawOrb(engine: AnyEngine, r: AnyEngine) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const rm = !!engine.settings?.reducedMotion;
  const def = ammoById(r.ammoType)!;
  const bob = rm ? 0 : Math.sin((engine.animTime ?? 0) * 4) * 3;
  const blink = r.life < 2 && !rm && Math.floor(r.life * 8) % 2 === 0 ? 0.4 : 1;
  c.save(); c.globalAlpha = blink;
  c.strokeStyle = def.tint; c.lineWidth = 2; c.beginPath(); c.arc(r.x, r.y + bob, 22, 0, Math.PI * 2); c.stroke();
  drawAmmoSprite(engine, r.ammoType, r.x, r.y + bob, 36);
  c.restore();
}

export function installLivingBubbles(EngineClass: EngineConstructor) {
  const proto = EngineClass.prototype as AnyEngine;
  if (proto[INSTALL_KEY]) return;
  Object.defineProperty(proto, INSTALL_KEY, { value: true, configurable: false });
  const o = {
    start: proto.start, destroy: proto.destroy, fireBubble: proto.fireBubble, tryTrap: proto.tryTrap, updateBubbles: proto.updateBubbles,
    popChain: proto.popChain, resolveBubble: proto.resolveBubble, updateEnemies: proto.updateEnemies, spawnReward: proto.spawnReward,
    collectReward: proto.collectReward, drawReward: proto.drawReward, drawBubble: proto.drawBubble, drawProgressionHud: proto.drawProgressionHud,
    loadLevelData: proto.loadLevelData, toTitle: proto.toTitle, beginRun: proto.beginRun, update: proto.update, syncAuditData: proto.syncAuditData,
  };

  proto.cycleAmmo = function (this: AnyEngine, dir: 1 | -1 = 1) {
    const rt = livingRuntime(this);
    if (totalCharges(rt.inv) <= 0) return null;
    const next = cycleAmmo(rt.inv, dir);
    this.audio?.tone?.(next ? 520 : 330, 0.06, "triangle", 120, 0.06);
    return next;
  };

  proto.start = function (this: AnyEngine) {
    const rt = livingRuntime(this);
    if (typeof window !== "undefined" && !rt.keyHandler) {
      rt.keyHandler = (event: KeyboardEvent) => {
        if (event.repeat || !CYCLE_KEYS.has(event.code)) return;
        if (this.state !== "playing" && this.state !== "hurry") return;
        if ((event.target as HTMLElement | null)?.closest?.(".lang-menu")) return;
        this.cycleAmmo(1); event.preventDefault();
      };
      window.addEventListener("keydown", rt.keyHandler);
    }
    if (this.devTools && typeof window !== "undefined") {
      // Development-only QA hook (screenshots, manual testing). Not shipped behaviour.
      (window as any).__bubbleHexLiving = {
        grant: (type: AmmoType, n = 2) => grantAmmo(this, type, n),
        select: (type: AmmoType | null) => { rt.inv.selected = type && (rt.inv.charges[type] ?? 0) > 0 ? type : null; },
        burst: (type: AmmoType, x: number, y: number) => onPop(this, rt, { x, y }, newMeta(type, null, LIVING_LIMITS.maxRecursionDepth, x, y), 0),
        enemies: () => (this.enemies as any[]).filter(e => e.state === "normal" || e.state === "furious").map(e => ({ id: e.id, x: e.x + e.w / 2, y: e.y + e.h / 2 })),
        trap: (type: AmmoType, x: number, y: number, personality?: string) => {
          const enemy = (this.enemies as any[]).find(e => e.state === "normal" || e.state === "furious");
          if (!enemy) return false;
          enemy.state = "trapped"; enemy.timer = 0;
          const b = { id: this.nextId++, x, y, prevX: x, prevY: y, vx: 0, vy: -24, r: 25, age: 0, phase: "occupied", enemyId: enemy.id, life: 8 };
          this.bubbles.push(b); rt.meta.set(b, newMeta(type, (personalityById(personality)?.id ?? personalityFor(b.id, this.levelIndex ?? 0)), 0, x, y));
          return true;
        },
        pop: (type?: AmmoType) => { const b = (this.bubbles as any[]).find(x => x.phase === "occupied" && (!type || rt.meta.get(x)?.type === type)); if (b) this.popChain(b); return !!b; },
        orb: (type: AmmoType, x: number, y: number) => { this.rewards.push({ x, y, vy: -60, kind: AMMO_REWARD_KIND, value: 0, life: LIVING_LIMITS.orbLife, ammoType: type }); },
        state: () => ({ inv: JSON.parse(JSON.stringify(rt.inv)), living: (this.bubbles as any[]).filter(b => rt.meta.has(b)).map(b => ({ id: b.id, ...rt.meta.get(b)! })), stats: { ...rt.stats }, ledger: { ...rt.ledger }, bubbles: this.bubbles.length }),
      };
    }
    return o.start.call(this);
  };

  proto.destroy = function (this: AnyEngine) {
    const rt = runtimes.get(this);
    if (rt?.keyHandler && typeof window !== "undefined") { window.removeEventListener("keydown", rt.keyHandler); rt.keyHandler = null; }
    return o.destroy.call(this);
  };

  proto.fireBubble = function (this: AnyEngine) {
    const type = selectedAmmo(this);
    // No special ammo selected (or field full): the original shot, untouched.
    if (!type || !canSpawnBubble(this.bubbles.length)) return o.fireBubble.call(this);
    const rt = livingRuntime(this);
    const before = this.bubbles.length;
    o.fireBubble.call(this);
    const shot = this.bubbles.length > before ? this.bubbles[before] : undefined;
    if (!shot) return;
    consumeCharge(rt.inv);
    const meta = newMeta(type, personalityFor(shot.id, this.levelIndex ?? 0), 0, shot.x, shot.y);
    rt.meta.set(shot, meta);
    if (type === "inferno") shot.vx *= 1.25;
    if (type === "widow") shot.r = 26;
    if (type === "phantom") shot.life *= 1.3;
    if (type === "mirror" && childAllowance(meta, this.bubbles.length, 1) > 0) {
      const p = this.player, mx = p.x + p.w / 2 - p.facing * 28;
      if (spawnChild(this, rt, meta, mx, shot.y, -shot.vx, 0, null, "fired")) {
        const twin = this.bubbles[this.bubbles.length - 1]; twin.life = shot.life;
      }
    }
  };

  proto.tryTrap = function (this: AnyEngine, b: AnyEngine) {
    const wasOccupied = b.phase === "occupied";
    o.tryTrap.call(this, b);
    if (wasOccupied || b.phase !== "occupied") return;
    const meta = runtimes.get(this)?.meta.get(b);
    if (!meta) return;
    meta.revealed = true; // impostors show their colours once they catch something
    if (meta.type === "frost") b.life = Math.min(9, b.life * 1.5);
    if (meta.type === "widow") b.life = Math.min(9, b.life * 1.3);
  };

  proto.updateBubbles = function (this: AnyEngine, dt: number) {
    const rt = livingRuntime(this);
    const pre = new Map<object, { x: number; y: number }>();
    for (const b of this.bubbles as any[]) {
      const meta = rt.meta.get(b);
      if (!meta) continue;
      pre.set(b, { x: b.x, y: b.y });
      // Phantom ammo slips through the side walls instead of bouncing.
      if (meta.type === "phantom" && b.phase !== "popping") {
        if (b.x < b.r + 32 && b.vx < 0) { b.x = W - b.r - 33; b.prevX = b.x; }
        else if (b.x > W - b.r - 32 && b.vx > 0) { b.x = b.r + 33; b.prevX = b.x; }
      }
    }
    o.updateBubbles.call(this, dt);
    if (!pre.size) return;
    const list = this.bubbles as any[];
    const ctx = { dt, player: { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 }, others: list, rng: rt.rng, reducedMotion: !!this.settings?.reducedMotion };
    let removed = false;
    for (const b of [...list]) {
      const meta = rt.meta.get(b);
      if (!meta || b.phase === "popping" || b.phase === "burst") continue;
      if (meta.personality) {
        const res = steer(b, meta, ctx);
        if (res.hold) { const p = pre.get(b); if (p) { b.x = p.x; b.y = p.y; b.prevX = p.x; b.prevY = p.y; } }
        b.x += res.dx; b.y += res.dy;
        if (res.absorbId !== undefined) {
          const prey = list.find(x => x.id === res.absorbId);
          if (prey && !prey.enemyId && (prey.phase === "floating" || prey.phase === "slowing")) {
            prey.phase = "burst"; removed = true;
            b.r = Math.min(LIVING_LIMITS.gluttonMaxRadius, b.r + 3); b.life = Math.min(9, b.life + 1);
          }
        }
        if (res.drain) for (const d of res.drain) {
          const victim = list.find(x => x.id === d.id);
          if (victim && victim.phase !== "burst") { victim.life -= d.amount; b.life = Math.min(LIVING_LIMITS.vampireMaxLife, b.life + d.amount); }
        }
        if (res.bud && childAllowance(meta, list.length, 1) > 0) spawnChild(this, rt, meta, b.x + (rt.rng() < .5 ? -32 : 32), b.y, 0, -20, null, "slowing");
        if (meta.personality === "mimic" && !meta.mimicked) {
          const model = list.find(x => x !== b && rt.meta.get(x)?.type && rt.meta.get(x)!.type !== meta.type && Math.hypot(x.x - b.x, x.y - b.y) < 200);
          if (model) { meta.type = rt.meta.get(model)!.type; meta.mimicked = true; }
        }
      }
      if (meta.type === "gravity" && b.phase !== "fired") {
        for (const other of list) {
          if (other === b || other.phase === "popping" || other.phase === "burst" || other.phase === "fired") continue;
          const dx = b.x - other.x, dy = b.y - other.y, d = Math.hypot(dx, dy);
          if (d > b.r + other.r + 4 && d < 170) { const step = Math.min(d - b.r - other.r, 60 * dt); other.x += dx / d * step; other.y += dy / d * step; }
        }
      }
      b.x = Math.max(b.r + 25, Math.min(W - b.r - 25, b.x)); b.y = Math.max(94, b.y);
    }
    if (removed) this.bubbles = list.filter(b => b.phase !== "burst");
  };

  proto.popChain = function (this: AnyEngine, root: AnyEngine) {
    const rt = livingRuntime(this);
    const before = new Set((this.pendingPops as any[]).map(p => p.bubble));
    o.popChain.call(this, root);
    const added = (this.pendingPops as any[]).filter(p => !before.has(p.bubble));
    if (!added.length) return;
    const chainId = ++rt.chainSeq;
    for (const p of added) rt.chainOf.set(p.bubble, chainId);
    const thunders = added.filter(p => rt.meta.get(p.bubble)?.type === "thunder");
    if (!thunders.length) return;
    const popping = new Set<number>((this.bubbles as any[]).filter(b => b.phase === "popping").map(b => b.id));
    const candidates = (this.bubbles as any[]).filter(b => (b.phase === "occupied" || b.phase === "warning") && b.enemyId);
    const origin = thunders[0].bubble;
    const targets = thunderTargets(origin, candidates, popping);
    targets.forEach((id, k) => {
      const t = candidates.find(b => b.id === id)!;
      t.phase = "popping"; rt.chainOf.set(t, chainId); rt.stats.thunderJumps++;
      this.pendingPops.push({ bubble: t, mult: added[0].mult, chain: added.length + k + 1, delay: (added.length + k) * 0.055 + 0.08 });
      pushFx(this, rt, { kind: "bolt", x: origin.x, y: origin.y, x2: t.x, y2: t.y, life: 0.35, tint: ammoById("thunder")!.tint, radius: 0 });
    });
    if (targets.length) this.audio?.tone?.(880, 0.08, "sawtooth", 220, 0.07);
  };

  proto.resolveBubble = function (this: AnyEngine, b: AnyEngine, mult: number, chain: number) {
    const rt = runtimes.get(this);
    const meta = rt?.meta.get(b);
    const wasPopping = b.phase === "popping";
    const before = this.score;
    o.resolveBubble.call(this, b, mult, chain);
    if (!rt || !meta?.type || !wasPopping) return;
    onPop(this, rt, b, meta, this.score - before);
  };

  proto.updateEnemies = function (this: AnyEngine, dt: number) {
    const rt = runtimes.get(this);
    if (!rt || (!rt.status.size && rt.globalSlow <= 0)) return o.updateEnemies.call(this, dt);
    const snaps = new Map<any, { x: number; y: number; cooldown: number; timer: number; mode: "freeze" | "slow" }>();
    for (const e of this.enemies as any[]) {
      if (e.state === "dead" || e.state === "trapped") continue;
      const s = rt.status.get(e.id);
      const mode = s && s.freeze > 0 ? "freeze" : (s && s.slow > 0) || rt.globalSlow > 0 ? "slow" : null;
      if (mode) snaps.set(e, { x: e.x, y: e.y, cooldown: e.cooldown, timer: e.timer, mode });
    }
    o.updateEnemies.call(this, dt);
    for (const [e, s] of snaps) {
      const k = s.mode === "freeze" ? 0 : 0.5;
      e.x = s.x + (e.x - s.x) * k; e.y = s.y + (e.y - s.y) * k;
      e.cooldown = s.cooldown + (e.cooldown - s.cooldown) * k; e.timer = s.timer + (e.timer - s.timer) * k;
      if (s.mode === "freeze") { e.prevX = e.x; e.prevY = e.y; e.vy = 0; }
    }
    for (const [id, s] of rt.status) { s.freeze = Math.max(0, s.freeze - dt); s.slow = Math.max(0, s.slow - dt); if (s.freeze <= 0 && s.slow <= 0) rt.status.delete(id); }
    rt.globalSlow = Math.max(0, rt.globalSlow - dt);
  };

  proto.spawnReward = function (this: AnyEngine, x: number, y: number, chain: number) {
    o.spawnReward.call(this, x, y, chain);
    if (this.state === "attract") return;
    const rt = livingRuntime(this);
    rt.killsSinceDrop++;
    const onField = (this.rewards as any[]).filter(r => r.ammoType).length;
    const type = rollAmmoDrop(this.levelIndex ?? 0, { onField, stageDrops: rt.stageDrops, killsSinceDrop: rt.killsSinceDrop }, rt.rng);
    if (!type) return;
    this.rewards.push({ x: Math.max(40, Math.min(W - 40, x + (rt.rng() - .5) * 50)), y, vy: -160, kind: AMMO_REWARD_KIND, value: 0, life: LIVING_LIMITS.orbLife, ammoType: type });
    rt.stageDrops++; rt.killsSinceDrop = 0;
  };

  proto.collectReward = function (this: AnyEngine, r: AnyEngine) {
    if (!isAmmoType(r.ammoType)) return o.collectReward.call(this, r);
    const rt = livingRuntime(this);
    const def = ammoById(r.ammoType)!;
    const added = addCharges(rt.inv, r.ammoType, AMMO_PER_ORB);
    if (added > 0) { if (!selectedAmmo(this)) rt.inv.selected = r.ammoType; this.message = `${def.name.toUpperCase()} ×${added}`; }
    else { this.message = "AMMO FULL"; addBonus(this, rt, -2, 250, r.x, r.y); }
    this.messageLife = 1.4;
    this.audio?.tone?.(660, 0.08, "triangle", 330, 0.08);
  };

  proto.drawReward = function (this: AnyEngine, r: AnyEngine) {
    if (!isAmmoType(r.ammoType)) return o.drawReward.call(this, r);
    drawOrb(this, r);
  };

  proto.drawBubble = function (this: AnyEngine, b: AnyEngine) {
    // drawWorld passes interpolated copies, so resolve the live bubble by id.
    const rt = runtimes.get(this);
    const live = rt ? (rt.meta.has(b) ? b : (this.bubbles as any[]).find(x => x.id === b.id)) : undefined;
    const meta = live ? rt!.meta.get(live) : undefined;
    if (!meta?.type || !meta.revealed) return o.drawBubble.call(this, b);
    const c = this.ctx as CanvasRenderingContext2D;
    const ghost = meta.type === "phantom" ? 0.55 : 1;
    drawAmmoSprite(this, meta.type, b.x, b.y, b.r * 2.4, ghost);
    c.save(); c.globalAlpha = ghost; o.drawBubble.call(this, b); c.restore();
    drawTypeAccent(this, b, meta.type);
    const persona = personalityById(meta.personality);
    if (persona && b.phase !== "popping") {
      c.save(); c.font = "bold 13px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "rgba(8,4,16,.8)"; c.beginPath(); c.arc(b.x + b.r * .8, b.y - b.r * .8, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#FFD6F1"; c.fillText(persona.glyph, b.x + b.r * .8, b.y - b.r * .8 + 1); c.restore();
    }
  };

  proto.drawProgressionHud = function (this: AnyEngine) {
    o.drawProgressionHud.call(this);
    const rt = livingRuntime(this);
    drawFx(this, rt);
    if (this.state !== "paused") drawAmmoHud(this, rt);
  };

  proto.update = function (this: AnyEngine, dt: number) {
    const rt = runtimes.get(this);
    if (rt && this.state !== "paused") { for (const fx of rt.fx) fx.age += dt; rt.fx = rt.fx.filter(fx => fx.age < fx.life); }
    return o.update.call(this, dt);
  };

  proto.loadLevelData = function (this: AnyEngine, level: unknown) {
    o.loadLevelData.call(this, level);
    resetStage(livingRuntime(this));
  };

  proto.beginRun = function (this: AnyEngine, ...args: unknown[]) {
    const rt = livingRuntime(this);
    rt.inv = newInventory();
    return o.beginRun.apply(this, args);
  };

  proto.toTitle = function (this: AnyEngine) {
    o.toTitle.call(this);
    const rt = runtimes.get(this); if (rt) { resetStage(rt); rt.inv = newInventory(); }
  };

  proto.syncAuditData = function (this: AnyEngine) {
    o.syncAuditData.call(this);
    if (!this.canvas?.dataset) return;
    const rt = runtimes.get(this);
    const sel = rt ? selectedAmmo(this) : null;
    Object.assign(this.canvas.dataset, {
      expansionAmmo: sel ?? "normal",
      expansionAmmoCharges: rt ? AMMO_DEFINITIONS.filter(a => (rt.inv.charges[a.id] ?? 0) > 0).map(a => `${a.id}:${rt.inv.charges[a.id]}`).join(",") : "",
      expansionAmmoOwned: rt && totalCharges(rt.inv) > 0 ? "1" : "0",
      expansionLiving: rt ? String((this.bubbles as any[]).filter(b => rt.meta.has(b)).length) : "0",
    });
  };
}
