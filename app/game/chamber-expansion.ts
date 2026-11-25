/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BUBBLE HEX — Forbidden Expansion, milestone 6: the Widow's Chambers, interactive
 * props and the playable B$S special editions.
 *
 * Installed last (outermost) onto the native engine. Every hook calls the original
 * method. The original 12 stages and the vault are never edited: the Secret Door is
 * an overlay that only appears once a Widow's Key has been found, and a chamber is
 * loaded *between* two campaign stages without touching levelIndex.
 */
import {
  BEAT, CHAMBERS, PROP_DEFINITIONS, PROP_LIMITS, TAROT_LIMITS, beatScale, chamberById, chamberKey, cleanseTiles, doorAllowed,
  drawTarot, isEditionUnlocked, nextChamber, onBeat, seedTiles, spreadTiles, tileX,
  type ChamberDefinition, type ChamberId, type PropKind, type TarotCard, type Tile,
} from "./chambers";
import { chamberCopy, type ChamberCopy } from "./chambers-i18n";
import { interfaceRuntime, copyForEngine } from "./expansion-ui";
import { expansionRuntime, fitText } from "./forbidden-expansion";
import { THEMES, themeById } from "./jukebox";
import { LEVELS } from "./levels";
import { AMMO_DEFINITIONS, LIVING_LIMITS, type AmmoType } from "./living-bubbles";
import { grantAmmo } from "./living-expansion";
import { cabinetSave } from "./cabinet-expansion";

const INSTALL_KEY = Symbol.for("bubblehex.forbidden-expansion.m6");
const W = 960, H = 720;

type EngineConstructor = { prototype: object };
type AnyEngine = Record<PropertyKey, any>;

export type PropState = {
  kind: PropKind; x: number; y: number;
  /** chandelier: hanging | falling | fallen; door: closed | open; tarot: ready | used; coffin: ready | hidden | cooldown */
  mode: string;
  timer: number;
  vy: number;
  count: number;
};

type Orb = { x: number; y: number; vx: number; vy: number; life: number };
type Reveal = { card: TarotCard; life: number };
type Flash = { x: number; y: number; r: number; age: number; life: number; color: string };

export type ChamberRuntime = {
  chamber: ChamberDefinition | null;
  practice: boolean;
  pending: ChamberDefinition | null;
  keys: number;
  doorsThisRun: number;
  props: PropState[];
  tiles: Tile[];
  tileTimer: number;
  orbs: Orb[];
  held: Map<number, number>;
  haste: number;
  darkness: number;
  clock: number;
  lastBeat: number;
  beatBonus: number;
  duplicates: number;
  reflected: WeakSet<object>;
  veilTimer: number;
  reveal: Reveal | null;
  flashes: Flash[];
  lockedHint: boolean;
  rng: () => number;
  editionQueue: string[];
};

const runtimes = new WeakMap<object, ChamberRuntime>();
export function chamberRuntime(engine: AnyEngine): ChamberRuntime {
  let rt = runtimes.get(engine);
  if (!rt) {
    rt = {
      chamber: null, practice: false, pending: null, keys: 0, doorsThisRun: 0, props: [], tiles: [], tileTimer: 0, orbs: [], held: new Map(),
      haste: 0, darkness: 0, clock: 0, lastBeat: -1, beatBonus: 0, duplicates: 0, reflected: new WeakSet(), veilTimer: 0, reveal: null,
      flashes: [], lockedHint: false, rng: Math.random, editionQueue: [],
    };
    runtimes.set(engine, rt);
  }
  return rt;
}

const copy = (engine: AnyEngine): ChamberCopy => chamberCopy(interfaceRuntime(engine).lang);
const reduced = (engine: AnyEngine) => !!engine.settings?.reducedMotion;
const ctxOf = (engine: AnyEngine) => engine.ctx as CanvasRenderingContext2D;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MAX_FLASHES = 12;
const MAX_KEYS = 3;

function flash(engine: AnyEngine, rt: ChamberRuntime, x: number, y: number, color: string, r = 60, life = 0.5) {
  rt.flashes.push({ x, y, r, age: 0, life: reduced(engine) ? Math.min(life, 0.3) : life, color });
  while (rt.flashes.length > MAX_FLASHES) rt.flashes.shift();
}

function say(engine: AnyEngine, text: string, life = 1.6) { engine.message = text; engine.messageLife = life; }

function propRect(p: PropState) {
  const d = PROP_DEFINITIONS[p.kind];
  return { x: p.x - d.w / 2, y: p.y - d.h, w: d.w, h: d.h };
}
function touchesPlayer(engine: AnyEngine, p: PropState, pad = 0) {
  const r = propRect(p), pl = engine.player;
  return pl.x < r.x + r.w + pad && pl.x + pl.w > r.x - pad && pl.y < r.y + r.h && pl.y + pl.h > r.y;
}

/* ------------------------------------------------------------------ discovery */

const visitKey = (key: string) => `visit:${key}`;
export function chamberDiscovered(engine: AnyEngine, key: string) {
  const cab = cabinetSave(engine);
  return cab.chambers.includes(key) || (cab.counters[visitKey(key)] ?? 0) > 0;
}
const discoveredKeys = (engine: AnyEngine) => CHAMBERS.map(c => c.level.loreFragmentId).filter(k => chamberDiscovered(engine, k));
const everHadKey = (engine: AnyEngine) => (engine.settings?.collection?.items?.widow_key ?? 0) > 0;

/* ------------------------------------------------------------------ editions */

export const editionUnlocked = (engine: AnyEngine, id: string) => isEditionUnlocked(engine.settings ?? {}, id);
const unlockedEditions = (engine: AnyEngine) => THEMES.filter(t => editionUnlocked(engine, t.id)).map(t => t.id);
/** The theme actually worn: a locked edition (never chosen through play) falls back to the Original. */
export function wornTheme(engine: AnyEngine) {
  const id = engine.settings?.theme ?? "default";
  return themeById(editionUnlocked(engine, id) ? id : "default");
}

/* ------------------------------------------------------------------ chamber flow */

function cloneLevel(def: ChamberDefinition) {
  const l = def.level;
  return { ...l, platforms: l.platforms.map(p => ({ ...p })), enemies: l.enemies.map(e => ({ ...e })), current: { ...l.current } };
}

export function enterChamber(engine: AnyEngine, id: ChamberId | ChamberDefinition, practice = false) {
  const def = typeof id === "string" ? chamberById(id) : id;
  if (!def) return false;
  const rt = chamberRuntime(engine);
  rt.practice = practice;
  const cab = cabinetSave(engine), key = def.level.loreFragmentId;
  cab.counters[visitKey(key)] = Math.min(9999, (cab.counters[visitKey(key)] ?? 0) + 1);
  engine.loadLevelData(cloneLevel(def));
  engine.setState("stageIntro");
  return true;
}

/** Practice from the Collection: a discovered chamber, entered from the title with a fresh run. */
export function practiceChamber(engine: AnyEngine, id: ChamberId) {
  const def = chamberById(id);
  if (!def || engine.state !== "title" || !chamberDiscovered(engine, def.level.loreFragmentId)) return false;
  engine.hero = engine.selected ?? engine.hero;
  engine.lives = 3; engine.score = 0; engine.levelIndex = 0; engine.inBonus = false;
  engine.venom?.clear?.();
  engine.upgrades = { speed: false, rapid: false, range: false, velocity: false, shield: false, venom: false, chain: false, crown: false };
  engine.closeCabinet?.();
  return enterChamber(engine, def, true);
}

function setupStage(engine: AnyEngine) {
  const rt = chamberRuntime(engine), level = engine.level;
  const def = level?.chamberId ? chamberById(level.chamberId) ?? null : null;
  rt.chamber = def;
  if (!def) rt.practice = false;
  rt.held.clear(); rt.haste = 0; rt.darkness = 0; rt.clock = 0; rt.lastBeat = -1; rt.beatBonus = 0; rt.duplicates = 0;
  rt.reflected = new WeakSet(); rt.veilTimer = 0; rt.reveal = null; rt.flashes = []; rt.orbs = []; rt.lockedHint = false;
  rt.props = [];
  const specs = def ? def.props.slice(0, PROP_LIMITS.maxPropsPerChamber) : [];
  for (const s of specs) rt.props.push({ kind: s.kind, x: s.x, y: s.y, mode: initialMode(s.kind), timer: s.kind === "serpent_statue" ? 3 : 0, vy: 0, count: 0 });
  if (!def && engine.levelIndex !== undefined) {
    const allowed = doorAllowed({ levelIndex: engine.levelIndex, lastIndex: LEVELS.length - 1, boss: !!level?.boss, bonus: !!level?.bonus, inChamber: false, attract: engine.state === "attract" });
    if (allowed) rt.props.push({ kind: "secret_door", x: 878, y: level.platforms?.[0]?.y ?? 650, mode: "closed", timer: 0, vy: 0, count: 0 });
  }
  rt.tiles = def?.seeds ? seedTiles(level.platforms, def.seeds) : [];
  rt.tileTimer = PROP_LIMITS.tileSpreadSeconds;
}

function initialMode(kind: PropKind) {
  return kind === "chandelier" ? "hanging" : kind === "tarot" ? "ready" : kind === "coffin" ? "ready" : kind === "secret_door" ? "closed" : "idle";
}

const doorVisible = (engine: AnyEngine, rt: ChamberRuntime) => engine.state !== "attract" && (rt.keys > 0 || everHadKey(engine) || !!rt.pending);

/* ------------------------------------------------------------------ enemy holds */

function holdEnemies(engine: AnyEngine, rt: ChamberRuntime, x: number, y: number, radius: number, seconds: number) {
  let n = 0;
  for (const e of engine.enemies ?? []) {
    if (e.state !== "normal" && e.state !== "furious") continue;
    if (Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) > radius) continue;
    if (rt.held.size >= PROP_LIMITS.maxHeld && !rt.held.has(e.id)) break;
    rt.held.set(e.id, Math.max(rt.held.get(e.id) ?? 0, seconds)); n++;
  }
  return n;
}

/* ------------------------------------------------------------------ per-frame props */

function tickProps(engine: AnyEngine, rt: ChamberRuntime, dt: number) {
  const cc = copy(engine), pl = engine.player;
  rt.clock += dt;
  for (const [id, t] of rt.held) { const left = t - dt; if (left <= 0) rt.held.delete(id); else rt.held.set(id, left); }
  rt.haste = Math.max(0, rt.haste - dt); rt.darkness = Math.max(0, rt.darkness - dt);
  for (const f of rt.flashes) f.age += dt;
  rt.flashes = rt.flashes.filter(f => f.age < f.life);
  if (rt.reveal) { rt.reveal.life -= dt; if (rt.reveal.life <= 0) rt.reveal = null; }

  const beat = Math.floor(rt.clock / BEAT.seconds);
  const newBeat = beat !== rt.lastBeat; if (newBeat) rt.lastBeat = beat;

  for (const p of rt.props) {
    switch (p.kind) {
      case "jukebox":
        if (newBeat && beat > 0 && beat % PROP_LIMITS.jukeboxPulseEvery === 0) {
          const held = holdEnemies(engine, rt, p.x, p.y - 45, PROP_LIMITS.jukeboxPulseRadius, PROP_LIMITS.holdSeconds);
          flash(engine, rt, p.x, p.y - 45, "#FF2A9D", PROP_LIMITS.jukeboxPulseRadius, 0.45);
          if (held) engine.audio?.tone?.(196, 0.08, "square", 0, 0.04);
        }
        break;
      case "chandelier":
        if (p.mode === "falling") {
          p.vy = Math.min(900, p.vy + 1400 * dt); p.y += p.vy * dt;
          const land = (engine.level.platforms as { x: number; y: number; w: number }[]).filter(pf => p.x > pf.x && p.x < pf.x + pf.w && pf.y >= p.y - p.vy * dt - 1).sort((a, b) => a.y - b.y)[0];
          const groundY = land ? land.y : 650;
          if (p.y >= groundY) {
            p.y = groundY; p.mode = "fallen";
            const n = holdEnemies(engine, rt, p.x, groundY - 20, 140, PROP_LIMITS.chandelierHold);
            const pts = Math.min(PROP_LIMITS.chandelierMaxScore, n * PROP_LIMITS.chandelierScore);
            if (pts > 0) { engine.score += pts; engine.addScoreBurst?.(p.x, groundY - 60, pts); }
            flash(engine, rt, p.x, groundY - 20, "#FFD36A", 140, 0.6);
            if (!reduced(engine)) engine.shake = Math.max(engine.shake ?? 0, 6);
            engine.audio?.pop?.(3);
          }
        }
        break;
      case "coffin": {
        p.timer = Math.max(0, p.timer - dt);
        const inside = touchesPlayer(engine, p) && pl.grounded && Math.abs(pl.vx) < 25;
        if (p.mode === "ready") {
          p.count = inside ? p.count + dt : 0;
          if (p.count >= PROP_LIMITS.coffinSettle) {
            p.mode = "hidden"; p.timer = PROP_LIMITS.coffinHideSeconds; p.count = 0;
            pl.invuln = Math.max(pl.invuln ?? 0, PROP_LIMITS.coffinHideSeconds);
            say(engine, cc.coffinHide, 1.2); engine.audio?.tone?.(110, 0.2, "sine", -30, 0.06);
          }
        } else if (p.mode === "hidden") {
          if (p.timer <= 0 || !touchesPlayer(engine, p, 6)) {
            p.mode = "cooldown"; p.timer = PROP_DEFINITIONS.coffin.cooldown;
            holdEnemies(engine, rt, p.x, p.y - 48, 170, 1);
            flash(engine, rt, p.x, p.y - 48, "#B57BFF", 170, 0.5);
            say(engine, cc.coffinOut, 1);
          }
        } else if (p.mode === "cooldown" && p.timer <= 0) p.mode = "ready";
        break;
      }
      case "serpent_statue":
        p.timer -= dt;
        if (p.timer <= 0) {
          p.timer = PROP_DEFINITIONS.serpent_statue.cooldown;
          if (rt.orbs.length < PROP_LIMITS.maxOrbs) {
            const mx = p.x - 22, my = p.y - 82;
            rt.orbs.push({ x: mx, y: my, vx: clamp((pl.x + pl.w / 2 - mx) * 0.6, -170, 170), vy: -300, life: PROP_LIMITS.orbLife });
            engine.audio?.tone?.(330, 0.1, "sawtooth", -120, 0.04);
          }
        }
        break;
      case "tarot":
        if (p.mode === "ready" && touchesPlayer(engine, p)) { p.mode = "used"; applyTarot(engine, rt, drawTarot(rt.rng), p); }
        break;
      case "secret_door":
        if (!doorVisible(engine, rt)) break;
        if (p.mode === "closed" && touchesPlayer(engine, p)) {
          if (rt.keys > 0) {
            rt.keys--; p.mode = "open";
            rt.pending = nextChamber(discoveredKeys(engine), rt.doorsThisRun); rt.doorsThisRun++;
            say(engine, cc.doorOpen, 2.2); engine.audio?.secret?.();
            flash(engine, rt, p.x, p.y - 46, "#FFD36A", 90, 0.7);
          } else if (!rt.lockedHint) { rt.lockedHint = true; say(engine, cc.doorLocked, 1.6); }
        }
        break;
      default:
        break;
    }
  }

  // Venom orbs from the serpent statue.
  for (const o of rt.orbs) {
    o.life -= dt; o.vy = Math.min(600, o.vy + 600 * dt);
    const oldY = o.y; o.x = clamp(o.x + o.vx * dt, 36, W - 36); o.y += o.vy * dt;
    for (const pf of engine.level.platforms) if (o.x > pf.x && o.x < pf.x + pf.w && oldY <= pf.y - 8 && o.y >= pf.y - 8 && o.vy > 0) { o.y = pf.y - 8; o.vy *= -0.35; o.vx *= 0.7; }
    if (Math.hypot(pl.x + pl.w / 2 - o.x, pl.y + pl.h / 2 - o.y) < 36) {
      o.life = 0; grantAmmo(engine, "venom", 1); say(engine, cc.venomOrb, 1);
      engine.audio?.reward?.(); flash(engine, rt, o.x, o.y, "#7CFF4F", 40, 0.4);
    }
  }
  rt.orbs = rt.orbs.filter(o => o.life > 0).slice(0, PROP_LIMITS.maxOrbs);

  // Poison Conservatory: spreading venom tiles.
  if (rt.chamber?.mechanic === "poison") {
    rt.tileTimer -= dt;
    if (rt.tileTimer <= 0) { rt.tileTimer = PROP_LIMITS.tileSpreadSeconds; spreadTiles(rt.tiles, engine.level.platforms, rt.rng); }
    if (engine.state === "playing" && pl.grounded && pl.currentPlatformId != null && (pl.invuln ?? 0) <= 0 && (pl.flying ?? 0) <= 0) {
      const pf = engine.level.platforms[pl.currentPlatformId], cx = pl.x + pl.w / 2;
      if (pf && rt.tiles.some(t => t.platform === pl.currentPlatformId && Math.abs(tileX(pf, t.slot) - cx) < PROP_LIMITS.tileWidth / 2)) engine.damagePlayer();
    }
  }

  // Widow's Cathedral: the Widow veil-steps across the nave while she chases.
  const w = engine.widow;
  if (rt.chamber?.mechanic === "cathedral" && w && engine.level.boss && w.phase === "chase") {
    rt.veilTimer += dt;
    if (rt.veilTimer >= 3.4) {
      rt.veilTimer = 0;
      flash(engine, rt, w.x, w.y, "#C4133D", 60, 0.5);
      w.x = clamp(W - w.x, 60, W - 60); w.y = clamp(w.y - 40, 110, H - 90); w.prevX = w.x; w.prevY = w.y; w.vx *= -0.5;
      flash(engine, rt, w.x, w.y, "#FF2A9D", 60, 0.5);
      engine.audio?.tone?.(740, 0.12, "triangle", -300, 0.05);
    }
  }
}

function applyTarot(engine: AnyEngine, rt: ChamberRuntime, card: TarotCard, p: PropState) {
  switch (card.id) {
    case "sun": engine.levelTime = Math.min(engine.level?.time ?? 99, (engine.levelTime ?? 0) + TAROT_LIMITS.sunSeconds); break;
    case "star": engine.lives = Math.min(TAROT_LIMITS.maxLives, (engine.lives ?? 0) + 1); break;
    case "magician": {
      const pool = AMMO_DEFINITIONS.filter(a => a.id !== ("normal" as AmmoType));
      const pick = pool[Math.floor(rt.rng() * pool.length) % pool.length];
      grantAmmo(engine, pick.id, TAROT_LIMITS.magicianCharges);
      break;
    }
    case "lovers": for (const e of engine.enemies ?? []) if (e.state === "normal" || e.state === "furious") holdEnemies(engine, rt, e.x + e.w / 2, e.y + e.h / 2, 1, TAROT_LIMITS.loversHold); break;
    case "tower": rt.haste = PROP_LIMITS.tarotEffectSeconds; break;
    case "death": engine.levelTime = Math.max(Math.min(engine.levelTime ?? 0, TAROT_LIMITS.deathFloor), (engine.levelTime ?? 0) - TAROT_LIMITS.deathSeconds); break;
    case "moon": rt.darkness = TAROT_LIMITS.moonSeconds; break;
  }
  rt.reveal = { card, life: 2.2 };
  flash(engine, rt, p.x, p.y - 30, card.boon ? "#FFD36A" : "#8E1F4B", 70, 0.6);
  if (card.boon) engine.audio?.reward?.(); else engine.audio?.tone?.(150, 0.25, "sawtooth", -60, 0.06);
}

/* ------------------------------------------------------------------ bubbles */

function afterBubbles(engine: AnyEngine, rt: ChamberRuntime, dt: number) {
  const mech = rt.chamber?.mechanic;
  const mirrors = rt.props.filter(p => p.kind === "mirror"), glass = rt.props.filter(p => p.kind === "stained_glass");
  const born: any[] = [];
  for (const b of engine.bubbles as any[]) {
    const free = b.phase === "fired" || b.phase === "slowing" || b.phase === "floating";
    const held = b.phase === "occupied" || b.phase === "warning";
    if (free) {
      for (const m of mirrors) {
        const r = propRect(m), half = r.w / 2;
        if (b.y < r.y || b.y > r.y + r.h) continue;
        const side = Math.sign(b.prevX - m.x) || (b.vx > 0 ? -1 : 1);
        if ((b.x - m.x) * side >= half + b.r * 0.6) continue;
        if (Math.sign(b.vx) === side) continue; // already moving away
        const speed = Math.abs(b.vx);
        b.x = m.x + side * (half + b.r * 0.6); b.vx = side * speed; b.impact = 0.16;
        if (b.phase !== "floating" && !rt.reflected.has(b) && rt.duplicates < PROP_LIMITS.mirrorMaxDuplicatesPerStage
          && engine.bubbles.length + born.length < LIVING_LIMITS.maxActiveBubbles) {
          const tx = m.x - side * (half + b.r * 0.6);
          const twin = { id: engine.nextId++, x: tx, y: b.y, prevX: tx, prevY: b.y, vx: -side * speed, vy: b.vy, r: b.r, age: b.age, phase: b.phase, life: Math.min(b.life, 5.2) };
          rt.reflected.add(twin); born.push(twin); rt.duplicates++;
          flash(engine, rt, m.x, b.y, "#E0E6FF", 36, 0.35);
        }
        rt.reflected.add(b);
      }
      if (b.phase !== "floating") for (const g of glass) {
        const r = propRect(g);
        if (rt.reflected.has(b) && (b as any).__glass) continue;
        if (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h && !(b as any).__glass) {
          (b as any).__glass = true;
          b.vx = Math.sign(b.vx || 1) * Math.min(640, Math.abs(b.vx) * PROP_LIMITS.glassSpeedBoost + 60);
          b.vy = -110; b.phase = "fired"; b.age = 0; b.life = Math.min(9, b.life + PROP_LIMITS.glassLifeBonus);
          flash(engine, rt, b.x, b.y, ["#FF2A4F", "#FFD36A", "#4FF3FF"][b.id % 3], 44, 0.4);
          engine.audio?.tone?.(1046, 0.06, "triangle", 200, 0.04);
        }
      }
    }
    if (mech === "water" && (free || held)) {
      if (b.phase === "fired" || b.phase === "slowing") b.vx *= Math.pow(0.55, dt);
      else {
        const band = Math.floor((b.y - 70) / 120) % 2 === 0 ? 1 : -1;
        b.x = clamp(b.x + band * 55 * dt, b.r + 25, W - b.r - 25);
        b.y = Math.min(b.y + 14 * dt, 620);
      }
    }
    if (mech === "klein" && (free || held)) {
      const left = b.r + 25, right = W - b.r - 25;
      if (b.x <= left + 0.01 && b.vx >= 0 && b.prevX >= left) { b.x = right - 1; b.prevX = b.x; b.vx = -Math.abs(b.vx) / 0.75; }
      else if (b.x >= right - 0.01 && b.vx <= 0 && b.prevX <= right) { b.x = left + 1; b.prevX = b.x; b.vx = Math.abs(b.vx) / 0.75; }
      if (b.y <= 94.01 && (b.phase === "floating" || held)) { b.y = 600; b.prevY = 600; }
    }
  }
  for (const twin of born) engine.bubbles.push(twin);
}

/* ------------------------------------------------------------------ drawing */

function drawPropSprite(engine: AnyEngine, p: PropState) {
  const c = ctxOf(engine), d = PROP_DEFINITIONS[p.kind], r = propRect(p), assets = expansionRuntime(engine).assets;
  const rm = reduced(engine), T = engine.animTime ?? 0;
  if (p.kind === "mirror") return drawMirror(engine, p);
  c.save();
  if (p.kind === "tarot" && p.mode === "used") { c.restore(); return; }
  if (p.kind === "chandelier" && p.mode === "fallen") { c.globalAlpha = 0.55; c.translate(p.x, p.y - d.h * 0.3); c.rotate(0.3); c.translate(-p.x, -(p.y - d.h * 0.3)); }
  if (p.kind === "coffin" && p.mode === "hidden") { c.shadowBlur = rm ? 0 : 16; c.shadowColor = "#B57BFF"; }
  if (p.kind === "secret_door" && p.mode === "open") { c.shadowBlur = rm ? 0 : 20; c.shadowColor = "#FFD36A"; }
  const bob = p.kind === "tarot" && !rm ? Math.sin(T * 3) * 3 : 0;
  const pulse = p.kind === "jukebox" && !rm ? 1 + (Math.max(0, 1 - ((T % BEAT.seconds) / BEAT.seconds)) * 0.04) : 1;
  const ok = d.sprite && assets.draw(c, d.sprite, p.x, r.y + d.h / 2 + bob, d.w * pulse, d.h * pulse);
  if (!ok) { c.fillStyle = "rgba(30,12,40,.9)"; c.fillRect(r.x, r.y + bob, r.w, r.h); c.strokeStyle = "#FFD36A"; c.lineWidth = 2; c.strokeRect(r.x, r.y + bob, r.w, r.h); }
  c.restore();
  if (p.kind === "secret_door") {
    if (p.mode === "open") { c.save(); c.fillStyle = "rgba(255,211,106,.28)"; c.fillRect(r.x + 10, r.y + 14, r.w - 20, r.h - 18); c.restore(); }
    else engine.label("⚿", p.x, r.y - 6, 10, "#FFD36A", "center");
  }
  if (p.kind === "coffin" && p.mode === "cooldown") { c.save(); c.globalAlpha = 0.6; c.fillStyle = "#0a0612"; c.fillRect(r.x, r.y + r.h * (1 - p.timer / PROP_DEFINITIONS.coffin.cooldown), r.w, 4); c.restore(); }
  if (p.kind === "chandelier" && p.mode === "hanging") { c.save(); c.strokeStyle = "#8d7fa8"; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, 72); c.lineTo(p.x, r.y + 6); c.stroke(); c.restore(); }
}

function drawMirror(engine: AnyEngine, p: PropState) {
  const c = ctxOf(engine), r = propRect(p), T = engine.animTime ?? 0, rm = reduced(engine);
  c.save();
  const g = c.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, "rgba(140,160,220,.35)"); g.addColorStop(0.5, "rgba(235,240,255,.75)"); g.addColorStop(1, "rgba(140,160,220,.35)");
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  c.strokeStyle = "#C9A24B"; c.lineWidth = 3; c.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  c.beginPath(); c.arc(p.x, r.y - 3, r.w / 2 + 3, Math.PI, 0); c.stroke();
  const sweep = rm ? 0.35 : (T * 0.4) % 1.4 - 0.2;
  c.globalAlpha = 0.6; c.fillStyle = "#fff"; c.fillRect(r.x + 2, r.y + r.h * clamp(sweep, 0, 1), r.w - 4, 10);
  c.restore();
}

function drawTiles(engine: AnyEngine, rt: ChamberRuntime) {
  if (!rt.tiles.length) return;
  const c = ctxOf(engine), T = engine.animTime ?? 0, rm = reduced(engine);
  c.save();
  for (const t of rt.tiles) {
    const pf = engine.level.platforms[t.platform]; if (!pf) continue;
    const x = tileX(pf, t.slot), w = PROP_LIMITS.tileWidth;
    c.fillStyle = "rgba(124,255,79,.55)"; c.fillRect(x - w / 2 + 2, pf.y - 6, w - 4, 7);
    c.strokeStyle = "#2f8f1f"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 8, pf.y - 4); c.quadraticCurveTo(x - 12, pf.y - 20, x - 4 + (rm ? 0 : Math.sin(T * 2 + x) * 3), pf.y - 26); c.stroke();
    c.beginPath(); c.moveTo(x + 7, pf.y - 4); c.quadraticCurveTo(x + 12, pf.y - 16, x + 6, pf.y - 20); c.stroke();
    if (!rm) { c.fillStyle = "rgba(180,255,120,.8)"; c.beginPath(); c.arc(x + Math.sin(T * 3 + x) * 8, pf.y - 8 - ((T * 18 + x) % 14), 2, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}

function drawChamberBackdrop(engine: AnyEngine, rt: ChamberRuntime) {
  const def = rt.chamber; if (!def) return;
  const c = ctxOf(engine), T = engine.animTime ?? 0, rm = reduced(engine);
  c.save(); c.beginPath(); c.rect(18, 70, W - 36, H - 92); c.clip();
  switch (def.mechanic) {
    case "beat": {
      const on = onBeat(rt.clock);
      for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) {
        const lit = (i + j + rt.lastBeat) % 3 === 0;
        c.fillStyle = lit ? (on ? "rgba(255,42,157,.32)" : "rgba(255,42,157,.16)") : "rgba(79,243,255,.07)";
        c.fillRect(24 + i * 76, 560 + j * 30, 74, 28);
      }
      c.globalAlpha = 0.5; c.fillStyle = "#c8c8d8"; c.beginPath(); c.arc(W / 2, 120, 26, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#555"; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(W / 2 - 26, 120 + k * 9); c.lineTo(W / 2 + 26, 120 + k * 9); c.stroke(); }
      if (!rm) for (let k = 0; k < 8; k++) { const a = T * 0.8 + k * 0.785; c.strokeStyle = k % 2 ? "rgba(255,42,157,.18)" : "rgba(79,243,255,.18)"; c.beginPath(); c.moveTo(W / 2, 120); c.lineTo(W / 2 + Math.cos(a) * 700, 120 + Math.abs(Math.sin(a)) * 600); c.stroke(); }
      break;
    }
    case "mirrors":
      for (let x = 70; x < W; x += 170) { c.strokeStyle = "rgba(201,162,75,.35)"; c.lineWidth = 3; c.strokeRect(x, 110, 90, 140); c.fillStyle = "rgba(224,230,255,.06)"; c.fillRect(x + 4, 114, 82, 132); }
      break;
    case "water":
      for (let y = 70, i = 0; y < H; y += 120, i++) {
        c.fillStyle = i % 2 ? "rgba(47,211,224,.07)" : "rgba(8,124,255,.09)"; c.fillRect(18, y, W - 36, 120);
        c.strokeStyle = "rgba(143,232,255,.22)"; c.lineWidth = 2; c.beginPath();
        for (let x = 18; x <= W - 18; x += 12) c.lineTo(x, y + 6 + (rm ? 0 : Math.sin(x * 0.03 + T * (i % 2 ? -1.4 : 1.4)) * 4));
        c.stroke();
        engine.label(i % 2 ? "‹ ‹ ‹" : "› › ›", i % 2 ? 60 : W - 60, y + 64, 9, "rgba(143,232,255,.35)", "center");
      }
      break;
    case "poison":
      for (let x = 50; x < W; x += 110) { c.strokeStyle = "rgba(124,255,79,.18)"; c.lineWidth = 3; c.beginPath(); c.moveTo(x, H); c.bezierCurveTo(x + 40, 520, x - 40, 300, x + (rm ? 0 : Math.sin(T * 0.7 + x) * 10), 90); c.stroke(); }
      c.strokeStyle = "rgba(124,255,79,.22)"; c.lineWidth = 2; for (let x = 80; x < W; x += 160) { c.beginPath(); c.arc(x, 90, 60, 0, Math.PI); c.stroke(); }
      break;
    case "klein":
      for (let k = 0; k < 6; k++) {
        const inset = 20 + k * 44 + (rm ? 0 : ((T * 12) % 44));
        c.strokeStyle = `rgba(106,184,255,${0.28 - k * 0.04})`; c.lineWidth = 2;
        c.strokeRect(18 + inset, 70 + inset * 0.7, W - 36 - inset * 2, H - 92 - inset * 1.4);
      }
      c.fillStyle = "rgba(106,184,255,.12)"; c.fillRect(18, 70, 10, H - 92); c.fillRect(W - 28, 70, 10, H - 92);
      engine.label("∞", 30, 380, 12, "rgba(106,184,255,.6)", "center"); engine.label("∞", W - 30, 380, 12, "rgba(106,184,255,.6)", "center");
      break;
    case "cathedral": {
      c.fillStyle = "rgba(196,19,61,.08)";
      for (let x = 60; x < W; x += 140) { c.fillRect(x, 160, 70, 300); c.strokeStyle = "rgba(196,19,61,.3)"; c.beginPath(); c.arc(x + 35, 160, 35, Math.PI, 0); c.stroke(); }
      c.strokeStyle = "rgba(255,211,106,.25)"; c.lineWidth = 2; c.beginPath(); c.arc(W / 2, 440, 70, 0, Math.PI * 2); c.stroke();
      for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + (rm ? 0 : T * 0.1); c.beginPath(); c.moveTo(W / 2, 440); c.lineTo(W / 2 + Math.cos(a) * 70, 440 + Math.sin(a) * 70); c.stroke(); }
      break;
    }
  }
  c.restore();
}

function drawFlashes(engine: AnyEngine, rt: ChamberRuntime) {
  const c = ctxOf(engine), rm = reduced(engine);
  c.save();
  for (const f of rt.flashes) {
    const k = f.age / f.life;
    c.globalAlpha = (1 - k) * 0.6; c.strokeStyle = f.color; c.lineWidth = 3;
    c.beginPath(); c.arc(f.x, f.y, rm ? f.r * 0.7 : f.r * (0.3 + k * 0.7), 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}

function drawFront(engine: AnyEngine, rt: ChamberRuntime) {
  const c = ctxOf(engine), cc = copy(engine);
  for (const p of rt.props) if (p.kind === "chandelier" && p.mode === "falling") drawPropSprite(engine, p);
  for (const o of rt.orbs) {
    c.save(); c.fillStyle = "#7CFF4F"; c.shadowBlur = reduced(engine) ? 0 : 10; c.shadowColor = "#7CFF4F";
    c.beginPath(); c.arc(o.x, o.y, 9, 0, Math.PI * 2); c.fill(); c.restore();
    engine.label("☠", o.x, o.y + 4, 7, "#0b2a06", "center");
  }
  drawFlashes(engine, rt);
  if (rt.darkness > 0) {
    const pl = engine.player, x = pl.x + pl.w / 2, y = pl.y + pl.h / 2;
    c.save();
    const g = c.createRadialGradient(x, y, 70, x, y, 260);
    g.addColorStop(0, "rgba(2,2,8,0)"); g.addColorStop(1, `rgba(2,2,8,${Math.min(0.88, rt.darkness * 0.6)})`);
    c.fillStyle = g; c.fillRect(18, 70, W - 36, H - 92); c.restore();
  }
  if (rt.reveal) {
    const { card, life } = rt.reveal, [name, effect] = cc.tarot[card.id];
    c.save(); c.globalAlpha = Math.min(1, life * 2);
    c.fillStyle = "rgba(10,6,18,.9)"; c.fillRect(W / 2 - 150, 120, 300, 92);
    c.strokeStyle = card.boon ? "#FFD36A" : "#8E1F4B"; c.lineWidth = 3; c.strokeRect(W / 2 - 150, 120, 300, 92);
    expansionRuntime(engine).assets.draw(c, "tarot", W / 2 - 112, 166, 44, 66);
    engine.label(fitText(engine, name, 16, 200, "Georgia"), W / 2 + 22, 158, 16, card.boon ? "#FFD36A" : "#FF5C8A", "center", "Georgia");
    engine.label(fitText(engine, effect, 11, 200), W / 2 + 22, 190, 11, "#e8e0ff", "center");
    c.restore();
  }
  if (rt.held.size && !reduced(engine)) {
    c.save(); c.strokeStyle = "rgba(255,211,106,.7)"; c.lineWidth = 2;
    for (const e of engine.enemies ?? []) if (rt.held.has(e.id) && (e.state === "normal" || e.state === "furious")) { c.beginPath(); c.arc(e.x + e.w / 2, e.y + e.h / 2, 24, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  if (rt.keys > 0 && rt.chamber == null) {
    const assets = expansionRuntime(engine).assets;
    c.save(); c.fillStyle = "rgba(5,5,9,.7)"; c.fillRect(W - 96, 76, 74, 30); c.restore();
    if (!assets.draw(c, "widow_key", W - 76, 91, 24, 24)) engine.label("⚿", W - 76, 96, 10, "#FFD36A", "center");
    engine.label(`× ${rt.keys}`, W - 58, 97, 9, "#FFD36A");
  }
}

/** HUD overdraw for chambers + the edition's HUD styling. */
function drawHudExtras(engine: AnyEngine, rt: ChamberRuntime) {
  const c = ctxOf(engine), cc = copy(engine);
  if (rt.chamber) {
    // Replace "STAGE n/12" (the world line below already names the chamber); stay clear of JUMP at x 594.
    c.save(); c.fillStyle = "#02030a"; c.fillRect(W / 2 - 108, 4, 216, 28); c.restore();
    engine.label(fitText(engine, `✦ ${cc.chamberLabel} ✦`, 13, 196), W / 2, 23, 13, "#FFD36A", "center");
    if (rt.chamber.mechanic === "beat") {
      const on = onBeat(rt.clock);
      c.save(); c.fillStyle = on ? "#FF2A9D" : "#3a1030"; c.beginPath(); c.arc(W / 2 - 150, 60, on ? 7 : 5, 0, Math.PI * 2); c.fill(); c.restore();
    }
  }
  drawThemeHud(engine);
}

/* ------------------------------------------------------------------ editions: whole-cabinet restyle */

export function drawThemeHud(engine: AnyEngine) {
  const t = wornTheme(engine); if (t.id === "default") return;
  const c = ctxOf(engine);
  c.save();
  c.strokeStyle = t.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 68); c.lineTo(W, 68); c.stroke();
  c.strokeStyle = t.secondary; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 2); c.lineTo(W, 2); c.stroke();
  if (t.id === "old-vic") {
    for (const x of [6, W - 6]) { c.strokeStyle = t.accent; c.beginPath(); c.arc(x, 34, 22, x < W / 2 ? -Math.PI / 2 : Math.PI / 2, x < W / 2 ? Math.PI / 2 : Math.PI * 1.5); c.stroke(); }
    c.fillStyle = t.accent; for (let x = 40; x < W; x += 80) { c.beginPath(); c.arc(x, 68, 2.5, 0, Math.PI * 2); c.fill(); }
  } else if (t.id === "civilian-signal") {
    c.globalAlpha = 0.12; c.fillStyle = t.accent; for (let y = 4; y < 68; y += 4) c.fillRect(0, y, W, 1);
    c.globalAlpha = 1; for (let i = 0; i < 4; i++) { c.fillStyle = i < 3 ? t.secondary : "#1c2b38"; c.fillRect(W - 30 + i * 6, 60 - i * 5, 4, 4 + i * 5); }
  } else if (t.id === "klein") {
    for (let k = 0; k < 3; k++) { c.strokeStyle = t.accent; c.globalAlpha = 0.7 - k * 0.2; c.strokeRect(4 + k * 5, 4 + k * 5, 40 - k * 10, 60 - k * 10); c.strokeRect(W - 44 + k * 5, 4 + k * 5, 40 - k * 10, 60 - k * 10); }
  } else if (t.id === "widow-after-dark") {
    c.strokeStyle = t.accent; c.globalAlpha = 0.7;
    for (const sx of [1, -1]) { const ox = sx > 0 ? 0 : W; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(ox, 0, k * 18, 0, Math.PI); c.stroke(); } for (let a = 0; a < 4; a++) { c.beginPath(); c.moveTo(ox, 0); c.lineTo(ox + sx * Math.cos(a * 0.4) * 56, Math.sin(a * 0.4 + 0.2) * 56); c.stroke(); } }
  }
  c.restore();
}

function drawThemePlayfield(engine: AnyEngine) {
  const t = wornTheme(engine); if (t.id === "default") return;
  const c = ctxOf(engine);
  c.save(); c.beginPath(); c.rect(18, 70, W - 36, H - 92); c.clip();
  if (t.id === "old-vic") {
    const g = c.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620); g.addColorStop(0, "rgba(80,50,10,0)"); g.addColorStop(1, "rgba(80,50,10,.32)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  } else if (t.id === "civilian-signal") {
    c.globalAlpha = 0.05; c.fillStyle = t.accent; for (let y = 72; y < H; y += 3) c.fillRect(18, y, W - 36, 1);
  } else if (t.id === "klein") {
    c.globalAlpha = 0.14; c.strokeStyle = t.accent; c.lineWidth = 2; for (let k = 1; k <= 3; k++) c.strokeRect(18 + k * 14, 70 + k * 10, W - 36 - k * 28, H - 92 - k * 20);
  } else if (t.id === "widow-after-dark") {
    const g = c.createRadialGradient(W / 2, H / 2, 240, W / 2, H / 2, 600); g.addColorStop(0, "rgba(60,0,16,0)"); g.addColorStop(1, "rgba(60,0,16,.38)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  c.restore();
}

function drawThemeFrame(engine: AnyEngine, x: number, y: number, w: number, h: number) {
  const t = wornTheme(engine); if (t.id === "default") return;
  const c = ctxOf(engine);
  c.save(); c.strokeStyle = t.accent; c.fillStyle = t.secondary; c.lineWidth = 2;
  const corners: [number, number, number, number][] = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    if (t.id === "old-vic") { c.beginPath(); c.arc(cx + sx * 14, cy + sy * 14, 8, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx + sx * 14, cy + sy * 14, 2.5, 0, Math.PI * 2); c.fill(); }
    else if (t.id === "civilian-signal") { c.fillRect(cx + sx * 6 - (sx < 0 ? 18 : 0), cy + sy * 6 - (sy < 0 ? 3 : 0), 18, 3); c.fillRect(cx + sx * 6 - (sx < 0 ? 3 : 0), cy + sy * 6 - (sy < 0 ? 18 : 0), 3, 18); }
    else if (t.id === "klein") { for (let k = 0; k < 3; k++) c.strokeRect(cx + sx * (6 + k * 5) - (sx < 0 ? 16 - k * 6 : 0), cy + sy * (6 + k * 5) - (sy < 0 ? 16 - k * 6 : 0), 16 - k * 6, 16 - k * 6); }
    else { for (let k = 1; k <= 2; k++) { c.beginPath(); c.arc(cx, cy, k * 12, sx > 0 ? (sy > 0 ? 0 : -Math.PI / 2) : (sy > 0 ? Math.PI / 2 : Math.PI), sx > 0 ? (sy > 0 ? Math.PI / 2 : 0) : (sy > 0 ? Math.PI : Math.PI * 1.5)); c.stroke(); } }
  }
  c.restore();
}

/* ------------------------------------------------------------------ chamber transition */

function drawChamberIntro(engine: AnyEngine, rt: ChamberRuntime) {
  const def = rt.chamber!; const c = ctxOf(engine), cc = copy(engine), rm = reduced(engine);
  const t = engine.stateTime ?? 0, [name, rule] = cc.chambers[def.id];
  c.save();
  c.fillStyle = "rgba(4,3,9,.78)"; c.fillRect(0, 70, W, H - 70);
  const open = rm ? 1 : clamp((t - 0.15) / 0.75, 0, 1), ease = 1 - Math.pow(1 - open, 3);
  if (open < 1) {
    const panelW = (W / 2) * (1 - ease);
    for (const side of [0, 1]) {
      const x = side ? W - panelW : 0;
      c.fillStyle = "#140a1c"; c.fillRect(x, 70, panelW, H - 70);
      c.strokeStyle = def.level.tint; c.lineWidth = 3; c.strokeRect(x + 6, 76, Math.max(0, panelW - 12), H - 82);
    }
  }
  c.globalAlpha = rm ? 1 : clamp((t - 0.35) / 0.4, 0, 1);
  c.fillStyle = "rgba(10,6,18,.92)"; c.fillRect(130, 250, 700, 200);
  c.strokeStyle = def.level.tint; c.lineWidth = 3; c.strokeRect(136, 256, 688, 188);
  engine.label(fitText(engine, `${cc.entering} · ${cc.props.secret_door.toUpperCase()}`, 11, 640), W / 2, 290, 11, "#FFD36A", "center");
  engine.label(fitText(engine, name.toUpperCase(), 28, 640, "Georgia"), W / 2, 340, 28, def.level.tint, "center", "Georgia");
  engine.label(fitText(engine, rule, 12, 640), W / 2, 384, 12, "#e8e0ff", "center");
  if (rt.practice) engine.label(fitText(engine, cc.practice, 9, 640), W / 2, 422, 9, "#9fb3d1", "center");
  c.restore();
}

/* ------------------------------------------------------------------ install */

export function installChambers(EngineClass: EngineConstructor) {
  const proto = EngineClass.prototype as AnyEngine;
  if (proto[INSTALL_KEY]) return;
  proto[INSTALL_KEY] = true;
  const o = {
    start: proto.start, loadLevelData: proto.loadLevelData, nextStage: proto.nextStage, restartCurrentStage: proto.restartCurrentStage,
    beginRun: proto.beginRun, toTitle: proto.toTitle, clearStage: proto.clearStage, updateWorld: proto.updateWorld,
    updateEnemies: proto.updateEnemies, updateBubbles: proto.updateBubbles, updatePlayer: proto.updatePlayer, popChain: proto.popChain,
    collectReward: proto.collectReward, drawBackground: proto.drawBackground, drawHud: proto.drawHud, drawStageIntro: proto.drawStageIntro,
    drawBossNameplate: proto.drawBossNameplate, drawGothicFrame: proto.drawGothicFrame, drawGothicBox: proto.drawGothicBox, syncAuditData: proto.syncAuditData,
  };

  proto.enterChamber = function (this: AnyEngine, id: ChamberId) { return enterChamber(this, id); };
  proto.practiceChamber = function (this: AnyEngine, id: ChamberId) { return practiceChamber(this, id); };

  proto.start = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    if (this.devTools && typeof window !== "undefined") {
      // Development-only QA hook (screenshots, manual testing). Not shipped behaviour.
      (window as any).__bubbleHexChambers = {
        enter: (id: ChamberId) => { if (this.state === "title" || this.state === "characterSelect") { this.hero = this.selected ?? this.hero; this.lives = 3; this.score = 0; } return enterChamber(this, id); },
        practice: (id: ChamberId) => practiceChamber(this, id),
        key: (n = 1) => { rt.keys = Math.min(MAX_KEYS, rt.keys + n); if (!this.settings.collection.items.widow_key) this.settings.collection.items.widow_key = 1; setupDoorIfNeeded(this); },
        discover: (ids: ChamberId[] | "all") => { const cab = cabinetSave(this); for (const c of CHAMBERS) if (ids === "all" || ids.includes(c.id)) cab.counters[visitKey(c.level.loreFragmentId)] = Math.max(1, cab.counters[visitKey(c.level.loreFragmentId)] ?? 0); },
        clear: (ids: ChamberId[] | "all") => { const cab = cabinetSave(this); for (const c of CHAMBERS) if (ids === "all" || ids.includes(c.id)) if (!cab.chambers.includes(chamberKey(c.id))) cab.chambers.push(chamberKey(c.id)); },
        tarot: (id: string) => { const p = rt.props.find(q => q.kind === "tarot") ?? { kind: "tarot" as PropKind, x: this.player.x, y: this.player.y + this.player.h, mode: "used", timer: 0, vy: 0, count: 0 }; applyTarot(this, rt, { id: id as any, boon: ["sun", "star", "magician", "lovers"].includes(id) }, p); },
        seed: (seq: number[]) => { let i = 0; rt.rng = () => seq[i++ % seq.length]; },
        clock: (t: number) => { rt.clock = t; },
        place: (x: number, y?: number) => { const p = this.player; p.x = clamp(x - p.w / 2, 24, W - 24 - p.w); if (y !== undefined) p.y = y - p.h; p.previousX = p.x; p.previousY = p.y; p.vx = 0; },
        invuln: (s: number) => { this.player.invuln = s; },
        state: () => ({ chamber: rt.chamber?.id ?? null, practice: rt.practice, pending: rt.pending?.id ?? null, keys: rt.keys, props: rt.props.map(p => ({ kind: p.kind, mode: p.mode, x: p.x, y: p.y, timer: p.timer })), tiles: rt.tiles.length, orbs: rt.orbs.length, held: rt.held.size, haste: rt.haste, darkness: rt.darkness, duplicates: rt.duplicates, beatBonus: rt.beatBonus, editions: unlockedEditions(this) }),
      };
    }
    return o.start.call(this);
  };

  proto.loadLevelData = function (this: AnyEngine, level: any) {
    const r = o.loadLevelData.call(this, level);
    setupStage(this);
    return r;
  };

  proto.beginRun = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    rt.keys = 0; rt.pending = null; rt.doorsThisRun = 0; rt.practice = false;
    return o.beginRun.call(this);
  };

  proto.toTitle = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    rt.practice = false;
    if (this.state === "gameOver" || this.state === "victory") { rt.keys = 0; rt.pending = null; }
    return o.toTitle.call(this);
  };

  proto.nextStage = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    if (rt.chamber && rt.practice) { rt.practice = false; rt.chamber = null; return this.toTitle(); }
    if (rt.chamber) { rt.chamber = null; return o.nextStage.call(this); }
    if (rt.pending && !this.inBonus) { const def = rt.pending; rt.pending = null; enterChamber(this, def); return; }
    return o.nextStage.call(this);
  };

  proto.restartCurrentStage = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    if (rt.chamber) { const def = rt.chamber, practice = rt.practice; enterChamber(this, def, practice); return; }
    return o.restartCurrentStage.call(this);
  };

  proto.clearStage = function (this: AnyEngine, demo: boolean) {
    const rt = chamberRuntime(this);
    const before = new Set(unlockedEditions(this));
    const fragments = [...(this.settings?.fragments ?? [])], secrets = this.settings?.secrets ?? 0;
    const r = o.clearStage.call(this, demo);
    if (rt.chamber && !demo) {
      // Chambers keep their secrets in the cabinet; the campaign's 12 Jade Doors stay exactly as they were.
      this.settings.fragments = fragments; this.settings.secrets = secrets;
      const cab = cabinetSave(this), key = rt.chamber.level.loreFragmentId;
      if (!cab.chambers.includes(key)) cab.chambers.push(key);
      if (this.secretFound && !cab.secretRooms.includes(key)) cab.secretRooms.push(key);
    }
    const fresh = unlockedEditions(this).filter(id => !before.has(id));
    if (fresh.length) {
      const xt = copyForEngine(this);
      rt.editionQueue.push(...fresh);
      say(this, copy(this).editionUnlocked(fresh.map(id => xt.themes[id as keyof typeof xt.themes] ?? id).join(" · ")), 2.6);
    }
    this.save?.();
    return r;
  };

  proto.updateWorld = function (this: AnyEngine, dt: number, allowDamage: boolean, demo: boolean) {
    const r = o.updateWorld.call(this, dt, allowDamage, demo);
    if (!demo && this.state !== "dying") tickProps(this, chamberRuntime(this), dt);
    return r;
  };

  proto.updateEnemies = function (this: AnyEngine, dt: number) {
    const rt = chamberRuntime(this);
    let scale = 1;
    if (rt.haste > 0) scale *= PROP_LIMITS.tarotHasteScale;
    if (rt.chamber?.mechanic === "beat") scale *= beatScale(rt.clock);
    const frozen: [any, string][] = [];
    if (rt.held.size) for (const e of this.enemies) if (rt.held.has(e.id) && (e.state === "normal" || e.state === "furious")) { frozen.push([e, e.state]); e.state = "trapped"; e.prevX = e.x; e.prevY = e.y; }
    const r = o.updateEnemies.call(this, dt * scale);
    for (const [e, s] of frozen) if (e.state === "trapped") e.state = s;
    if (rt.chamber?.mechanic === "klein") for (const e of this.enemies) {
      if (e.state !== "normal" && e.state !== "furious") continue;
      if (e.x <= 28 && e.vx > 0 && e.prevX >= 28) { e.x = W - e.w - 29; e.prevX = e.x; e.vx = -e.vx; }
      else if (e.x >= W - e.w - 28 && e.vx < 0 && e.prevX <= W - e.w - 28) { e.x = 29; e.prevX = e.x; e.vx = -e.vx; }
    }
    return r;
  };

  proto.updateBubbles = function (this: AnyEngine, dt: number) {
    const r = o.updateBubbles.call(this, dt);
    const rt = chamberRuntime(this);
    if (rt.chamber || rt.props.length) afterBubbles(this, rt, dt);
    return r;
  };

  proto.updatePlayer = function (this: AnyEngine, dt: number) {
    const r = o.updatePlayer.call(this, dt);
    const rt = chamberRuntime(this), p = this.player, mech = rt.chamber?.mechanic;
    if (mech === "water" && p.vy > 360) p.vy = 360;
    if (mech === "klein") {
      if (p.x <= 24.01 && this.held?.left) { p.x = W - 24 - p.w - 1; p.previousX = p.x; }
      else if (p.x >= W - 24 - p.w - 0.01 && this.held?.right) { p.x = 25; p.previousX = p.x; }
    }
    return r;
  };

  proto.popChain = function (this: AnyEngine, root: any) {
    const rt = chamberRuntime(this), x = root?.x ?? 0, y = root?.y ?? 0;
    const r = o.popChain.call(this, root);
    for (const p of rt.props) if (p.kind === "chandelier" && p.mode === "hanging" && Math.abs(x - p.x) < PROP_LIMITS.chandelierRadius && y < p.y + 260) {
      p.mode = "falling"; p.vy = 0; say(this, copy(this).chandelierFall, 1.2); this.audio?.tone?.(880, 0.15, "triangle", -500, 0.05);
    }
    if (rt.chamber?.mechanic === "beat" && onBeat(rt.clock) && rt.beatBonus < BEAT.stageBonusCap) {
      const pts = Math.min(BEAT.popBonus, BEAT.stageBonusCap - rt.beatBonus);
      rt.beatBonus += pts; this.score += pts; this.addScoreBurst?.(x, y - 30, pts);
      flash(this, rt, x, y, "#FF2A9D", 50, 0.35);
    }
    if (rt.tiles.length && cleanseTiles(rt.tiles, this.level.platforms, x, y) > 0) flash(this, rt, x, y, "#7CFF4F", PROP_LIMITS.tileCleanseRadius, 0.4);
    return r;
  };

  proto.collectReward = function (this: AnyEngine, reward: any) {
    const r = o.collectReward.call(this, reward);
    if (reward?.itemId === "widow_key") {
      const rt = chamberRuntime(this);
      rt.keys = Math.min(MAX_KEYS, rt.keys + 1);
      setupDoorIfNeeded(this);
      say(this, copy(this).keyHeld, 2.2);
    }
    return r;
  };

  proto.drawBackground = function (this: AnyEngine) {
    const r = o.drawBackground.call(this);
    const rt = chamberRuntime(this);
    drawChamberBackdrop(this, rt);
    drawThemePlayfield(this);
    for (const p of rt.props) {
      if (p.kind === "secret_door" && !doorVisible(this, rt)) continue;
      if (p.kind === "chandelier" && p.mode === "falling") continue;
      drawPropSprite(this, p);
    }
    drawTiles(this, rt);
    return r;
  };

  proto.drawHud = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    drawFront(this, rt);
    const r = o.drawHud.call(this);
    drawHudExtras(this, rt);
    return r;
  };

  proto.drawStageIntro = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    if (rt.chamber) return drawChamberIntro(this, rt);
    return o.drawStageIntro.call(this);
  };

  proto.drawBossNameplate = function (this: AnyEngine) {
    const rt = chamberRuntime(this);
    if (rt.chamber?.mechanic !== "cathedral") return o.drawBossNameplate.call(this);
    const w = this.widow; if (!w) return;
    const c = ctxOf(this), t = clamp(w.phaseTimer / 1.8, 0, 1), alpha = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
    c.save(); c.globalAlpha = alpha;
    this.label(fitText(this, copy(this).widowVariant, 30, 760, "Georgia"), W / 2, 150, 30, "#C4133D", "center", "Georgia");
    this.label(fitText(this, copy(this).chambers.widow_cathedral[1], 12, 760), W / 2, 182, 12, "#FFD36A", "center");
    c.restore();
  };

  proto.drawGothicFrame = function (this: AnyEngine, color: string) {
    const r = o.drawGothicFrame.call(this, color);
    drawThemeFrame(this, 14, 14, W - 28, H - 28);
    return r;
  };

  proto.drawGothicBox = function (this: AnyEngine, x: number, y: number, w: number, h: number, color: string) {
    const r = o.drawGothicBox.call(this, x, y, w, h, color);
    drawThemeFrame(this, x, y, w, h);
    return r;
  };

  proto.syncAuditData = function (this: AnyEngine) {
    const r = o.syncAuditData.call(this);
    const rt = chamberRuntime(this);
    if (this.canvas?.dataset) Object.assign(this.canvas.dataset, {
      expansionChamber: rt.chamber?.id ?? "",
      expansionChamberPractice: rt.practice ? "1" : "0",
      expansionKeys: String(rt.keys),
      expansionPendingChamber: rt.pending?.id ?? "",
      expansionWornTheme: wornTheme(this).id,
      expansionEditions: unlockedEditions(this).join(","),
    });
    return r;
  };
}

/** A key picked up mid-stage reveals the door in the current stage when it is eligible. */
function setupDoorIfNeeded(engine: AnyEngine) {
  const rt = chamberRuntime(engine);
  if (rt.chamber || rt.props.some(p => p.kind === "secret_door")) return;
  const level = engine.level;
  if (doorAllowed({ levelIndex: engine.levelIndex, lastIndex: LEVELS.length - 1, boss: !!level?.boss, bonus: !!level?.bonus, inChamber: false, attract: engine.state === "attract" }))
    rt.props.push({ kind: "secret_door", x: 878, y: level.platforms?.[0]?.y ?? 650, mode: "closed", timer: 0, vy: 0, count: 0 });
}
