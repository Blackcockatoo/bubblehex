/**
 * BUBBLE HEX — Forbidden Expansion, milestone 3: living bubbles (pure rules).
 *
 * Special AMMO types are variants of the hero's normal bubble. They are only
 * ever fired when the player has collected charges and selected that ammo, so
 * with "NORMAL" selected the original fire/trap/pop rules run untouched.
 *
 * NOTE: the "venom" ammo type is deliberately separate from the original
 * VENOM letters (engine.venom) and the venom mastery upgrade
 * (engine.upgrades.venom). Ammo state lives in its own namespace and never
 * spawns, counts or reads letters.
 *
 * Everything that can multiply (children, chains, score) is bounded by
 * LIVING_LIMITS, and every helper here is deterministic given its inputs so
 * unit tests can prove the bounds.
 */

export type AmmoType =
  | "venom" | "thunder" | "inferno" | "frost" | "gravity" | "phantom"
  | "mirror" | "recursive" | "time" | "widow" | "klein";

export type Personality =
  | "coward" | "glutton" | "lover" | "parasite" | "mimic" | "jester"
  | "sleeper" | "mother" | "vampire" | "ouroboros" | "impostor";

export const LIVING_LIMITS = {
  /** Hard cap on bubbles in the field. Expansion spawns (children, mirror shots) refuse above it. */
  maxActiveBubbles: 24,
  /** Children any single bubble may ever create (Mother, Recursive, Klein). */
  maxChildrenPerParent: 2,
  /** Generations below a fired shot (shot = depth 0). */
  maxRecursionDepth: 2,
  /** Extra bubbles a Thunder pop may arc into. */
  maxThunderJumps: 3,
  thunderRange: 240,
  /** Expansion bonus score (never the original kill score) caps. */
  perChainBonusCap: 3000,
  perStageBonusCap: 20000,
  /** Ammo inventory. */
  maxChargesPerType: 3,
  maxChargesTotal: 9,
  /** Ammo orbs. */
  dropChance: 0.18,
  minKillsBetweenDrops: 3,
  maxOrbsOnField: 1,
  maxOrbsPerStage: 4,
  orbLife: 9,
  /** Status effects on free enemies (seconds). */
  maxStatusSeconds: 3,
  /** Time ammo: seconds added per pop, capped per stage. */
  timePerPop: 2,
  timeBonusStageCap: 12,
  /** Personality tuning. */
  maxSteerSpeed: 70,
  gluttonMaxRadius: 30,
  vampireMaxLife: 8,
  motherInterval: 3,
  /** Code-drawn effect sprites (bolts, clouds, rings) alive at once. */
  maxFx: 12,
} as const;

export type AmmoDefinition = {
  id: AmmoType;
  name: string;
  sprite: string;
  tint: string;
  glyph: string;
  /** Earliest stage index this ammo can drop on. */
  minStage: number;
  weight: number;
  summary: string;
};

export const AMMO_DEFINITIONS: readonly AmmoDefinition[] = [
  { id: "venom", name: "Venom Bubble", sprite: "bubble_venom", tint: "#7CFF4F", glyph: "☠", minStage: 0, weight: 5, summary: "Pop releases a toxic cloud that slows nearby enemies." },
  { id: "thunder", name: "Thunder Bubble", sprite: "bubble_thunder", tint: "#FFE14F", glyph: "ϟ", minStage: 0, weight: 5, summary: `Pop arcs into up to ${LIVING_LIMITS.maxThunderJumps} distant trapped bubbles.` },
  { id: "frost", name: "Frost Bubble", sprite: "bubble_frost", tint: "#8FE8FF", glyph: "❄", minStage: 0, weight: 5, summary: "Holds prey longer; pop freezes nearby enemies." },
  { id: "mirror", name: "Mirror Bubble", sprite: "bubble_mirror", tint: "#E0E6FF", glyph: "◐", minStage: 0, weight: 4, summary: "Fires a reflected twin behind you." },
  { id: "inferno", name: "Inferno Bubble", sprite: "bubble_inferno", tint: "#FF6A2A", glyph: "♨", minStage: 1, weight: 4, summary: "Fast shot; pop scorches and stuns nearby enemies." },
  { id: "gravity", name: "Gravity Bubble", sprite: "bubble_gravity", tint: "#B07CFF", glyph: "◎", minStage: 1, weight: 3, summary: "Pulls nearby bubbles together for bigger chains." },
  { id: "phantom", name: "Phantom Bubble", sprite: "bubble_phantom", tint: "#9AA8C8", glyph: "◌", minStage: 2, weight: 3, summary: "Drifts through the side walls and lingers." },
  { id: "time", name: "Time Bubble", sprite: "bubble_time", tint: "#FFD36A", glyph: "⧗", minStage: 2, weight: 3, summary: `Pop steals ${LIVING_LIMITS.timePerPop}s and slows every enemy.` },
  { id: "recursive", name: "Recursive Bubble", sprite: "bubble_recursive", tint: "#4FFFD2", glyph: "∞", minStage: 3, weight: 2, summary: `Pop divides into two hunting bubbles (depth ${LIVING_LIMITS.maxRecursionDepth}).` },
  { id: "widow", name: "Widow Bubble", sprite: "bubble_widow", tint: "#FF2A9D", glyph: "✶", minStage: 4, weight: 2, summary: "Wide web capture; prey stays wrapped longer." },
  { id: "klein", name: "Klein Bubble", sprite: "bubble_klein", tint: "#6AB8FF", glyph: "⌘", minStage: 4, weight: 1, summary: "Pop folds inside out: bonus score and a reborn bubble." },
];

export const AMMO_ORDER: readonly AmmoType[] = AMMO_DEFINITIONS.map(a => a.id);
const AMMO_BY_ID = new Map(AMMO_DEFINITIONS.map(a => [a.id, a]));
export const ammoById = (id: string | null | undefined): AmmoDefinition | undefined => (id ? AMMO_BY_ID.get(id as AmmoType) : undefined);
export const isAmmoType = (id: unknown): id is AmmoType => typeof id === "string" && AMMO_BY_ID.has(id as AmmoType);

export type PersonalityDefinition = { id: Personality; name: string; glyph: string; summary: string };
export const PERSONALITIES: readonly PersonalityDefinition[] = [
  { id: "coward", name: "Coward", glyph: "!", summary: "Repels: shies away from you." },
  { id: "glutton", name: "Glutton", glyph: "o", summary: "Merges: swallows empty bubbles and grows." },
  { id: "lover", name: "Lover", glyph: "♥", summary: "Attracts: drifts toward the nearest bubble." },
  { id: "parasite", name: "Parasite", glyph: "§", summary: "Latches beside a trapped bubble to join its chain." },
  { id: "mimic", name: "Mimic", glyph: "?", summary: "Disguise: copies the ammo of a nearby special bubble." },
  { id: "jester", name: "Jester", glyph: "※", summary: "Jitters unpredictably." },
  { id: "sleeper", name: "Sleeper", glyph: "z", summary: "Hangs still until it wakes." },
  { id: "mother", name: "Mother", glyph: "◇", summary: `Divides: buds up to ${LIVING_LIMITS.maxChildrenPerParent} empty bubbles.` },
  { id: "vampire", name: "Vampire", glyph: "¥", summary: "Drains life from empty bubbles to hold prey longer." },
  { id: "ouroboros", name: "Ouroboros", glyph: "@", summary: "Circles its own birthplace." },
  { id: "impostor", name: "Impostor", glyph: "·", summary: "Disguise: looks normal until it traps something." },
];
export const PERSONALITY_ORDER: readonly Personality[] = PERSONALITIES.map(p => p.id);
const PERSONALITY_BY_ID = new Map(PERSONALITIES.map(p => [p.id, p]));
export const personalityById = (id: string | null | undefined) => (id ? PERSONALITY_BY_ID.get(id as Personality) : undefined);

/** Deterministic, procedural personality from bubble id + stage. */
export function personalityFor(bubbleId: number, stageIndex: number): Personality {
  let h = (bubbleId * 2654435761 + (stageIndex + 1) * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return PERSONALITY_ORDER[(h >>> 0) % PERSONALITY_ORDER.length];
}

/* ------------------------------------------------------------------ ammo */

export type AmmoInventory = { charges: Partial<Record<AmmoType, number>>; selected: AmmoType | null };
export const newInventory = (): AmmoInventory => ({ charges: {}, selected: null });
export const totalCharges = (inv: AmmoInventory) => AMMO_ORDER.reduce((s, id) => s + (inv.charges[id] ?? 0), 0);

/** Adds charges respecting per-type and total caps. Returns how many were actually added. */
export function addCharges(inv: AmmoInventory, type: AmmoType, amount: number): number {
  const have = inv.charges[type] ?? 0;
  const room = Math.max(0, Math.min(LIVING_LIMITS.maxChargesPerType - have, LIVING_LIMITS.maxChargesTotal - totalCharges(inv)));
  const add = Math.max(0, Math.min(room, Math.floor(amount)));
  if (add > 0) inv.charges[type] = have + add;
  if (add > 0 && inv.selected === null) inv.selected = type;
  return add;
}

/** Consumes one charge of the selected ammo. Returns the type fired, or null for a normal bubble. */
export function consumeCharge(inv: AmmoInventory): AmmoType | null {
  const type = inv.selected;
  if (!type) return null;
  const have = inv.charges[type] ?? 0;
  if (have <= 0) { inv.selected = null; return null; }
  inv.charges[type] = have - 1;
  if (have - 1 <= 0) { delete inv.charges[type]; inv.selected = null; }
  return type;
}

/** NORMAL → each owned ammo in registry order → NORMAL. */
export function cycleAmmo(inv: AmmoInventory, dir: 1 | -1 = 1): AmmoType | null {
  const owned: (AmmoType | null)[] = [null, ...AMMO_ORDER.filter(id => (inv.charges[id] ?? 0) > 0)];
  const at = Math.max(0, owned.indexOf(inv.selected));
  inv.selected = owned[(at + dir + owned.length) % owned.length];
  return inv.selected;
}

export type AmmoDropState = { onField: number; stageDrops: number; killsSinceDrop: number };

export function rollAmmoDrop(stageIndex: number, state: AmmoDropState, rng: () => number): AmmoType | null {
  if (state.onField >= LIVING_LIMITS.maxOrbsOnField) return null;
  if (state.stageDrops >= LIVING_LIMITS.maxOrbsPerStage) return null;
  if (state.killsSinceDrop < LIVING_LIMITS.minKillsBetweenDrops) return null;
  if (rng() >= LIVING_LIMITS.dropChance) return null;
  const pool = AMMO_DEFINITIONS.filter(a => a.minStage <= stageIndex);
  const total = pool.reduce((s, a) => s + a.weight, 0);
  let roll = rng() * total;
  for (const a of pool) { roll -= a.weight; if (roll < 0) return a.id; }
  return pool[pool.length - 1]?.id ?? null;
}

/* ----------------------------------------------------------------- bounds */

export type LivingMeta = {
  type: AmmoType | null;
  personality: Personality | null;
  depth: number;
  children: number;
  anchorX: number;
  anchorY: number;
  age: number;
  revealed: boolean;
  hostId?: number;
  mimicked?: boolean;
  nextBud: number;
  jitter: number;
  jitterTimer: number;
};

export function newMeta(type: AmmoType | null, personality: Personality | null, depth: number, x: number, y: number): LivingMeta {
  return { type, personality, depth, children: 0, anchorX: x, anchorY: y, age: 0, revealed: personality !== "impostor", nextBud: LIVING_LIMITS.motherInterval, jitter: 0, jitterTimer: 0 };
}

/** How many children `parent` may spawn now given the field population. */
export function childAllowance(parent: LivingMeta, activeBubbles: number, wanted: number): number {
  if (parent.depth >= LIVING_LIMITS.maxRecursionDepth) return 0;
  const byParent = LIVING_LIMITS.maxChildrenPerParent - parent.children;
  const byField = LIVING_LIMITS.maxActiveBubbles - activeBubbles;
  return Math.max(0, Math.min(wanted, byParent, byField));
}

export const canSpawnBubble = (activeBubbles: number) => activeBubbles < LIVING_LIMITS.maxActiveBubbles;

/** Ledger for expansion bonus score. */
export type BonusLedger = { stage: number; chain: number; chainId: number; timeAdded: number };
export const newBonusLedger = (): BonusLedger => ({ stage: 0, chain: 0, chainId: -1, timeAdded: 0 });

export function awardBonus(ledger: BonusLedger, chainId: number, points: number): number {
  if (ledger.chainId !== chainId) { ledger.chainId = chainId; ledger.chain = 0; }
  const want = Math.max(0, Math.floor(points));
  const grant = Math.max(0, Math.min(want, LIVING_LIMITS.perChainBonusCap - ledger.chain, LIVING_LIMITS.perStageBonusCap - ledger.stage));
  ledger.chain += grant; ledger.stage += grant;
  return grant;
}

export function awardTime(ledger: BonusLedger, seconds: number): number {
  const grant = Math.max(0, Math.min(seconds, LIVING_LIMITS.timeBonusStageCap - ledger.timeAdded));
  ledger.timeAdded += grant;
  return grant;
}

/** Pick up to maxThunderJumps candidate ids in range, nearest first. Pure and bounded. */
export function thunderTargets(origin: { x: number; y: number }, candidates: readonly { id: number; x: number; y: number }[], exclude: ReadonlySet<number>): number[] {
  return candidates
    .filter(c => !exclude.has(c.id))
    .map(c => ({ id: c.id, d: Math.hypot(c.x - origin.x, c.y - origin.y) }))
    .filter(c => c.d <= LIVING_LIMITS.thunderRange)
    .sort((a, b) => a.d - b.d || a.id - b.id)
    .slice(0, LIVING_LIMITS.maxThunderJumps)
    .map(c => c.id);
}

export const clampStatus = (current: number, add: number) => Math.min(LIVING_LIMITS.maxStatusSeconds, Math.max(current, add));

/* ----------------------------------------------------------- personalities */

export type SteerBubble = { id: number; x: number; y: number; r: number; life: number; phase: string; enemyId?: number };
export type SteerContext = {
  dt: number;
  player: { x: number; y: number };
  others: readonly SteerBubble[];
  rng: () => number;
  reducedMotion: boolean;
};
export type SteerResult = { dx: number; dy: number; hold?: boolean; absorbId?: number; drain?: { id: number; amount: number }[]; bud?: boolean };

const isEmpty = (b: SteerBubble) => (b.phase === "floating" || b.phase === "slowing") && !b.enemyId;
const isHeld = (b: SteerBubble) => (b.phase === "occupied" || b.phase === "warning") && !!b.enemyId;

function toward(from: SteerBubble, to: { x: number; y: number }, speed: number, dt: number, stopAt = 0) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d <= stopAt || d < 1e-6) return { dx: 0, dy: 0 };
  const step = Math.min(d - stopAt, speed * dt);
  return { dx: dx / d * step, dy: dy / d * step };
}

function nearest(b: SteerBubble, list: readonly SteerBubble[], range: number, pred: (o: SteerBubble) => boolean) {
  let best: SteerBubble | undefined, bestD = range;
  for (const o of list) { if (o.id === b.id || !pred(o)) continue; const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < bestD) { bestD = d; best = o; } }
  return best;
}

/**
 * One tick of personality behaviour. Returns a bounded displacement plus any
 * merge / drain / bud request; the engine applies these and enforces caps.
 * Never loops over more than `others` once and never moves faster than
 * LIVING_LIMITS.maxSteerSpeed.
 */
export function steer(b: SteerBubble, meta: LivingMeta, ctx: SteerContext): SteerResult {
  const { dt } = ctx;
  const v = LIVING_LIMITS.maxSteerSpeed;
  meta.age += dt;
  const out: SteerResult = { dx: 0, dy: 0 };
  if (b.phase === "popping" || b.phase === "burst" || b.phase === "fired") return out;
  switch (meta.personality) {
    case "coward": {
      const d = Math.hypot(b.x - ctx.player.x, b.y - ctx.player.y);
      if (d < 140 && b.phase !== "warning") { const m = toward(b, ctx.player, v * 0.7, dt); out.dx = -m.dx; out.dy = -m.dy; }
      break;
    }
    case "glutton": {
      if (!isEmpty(b)) break;
      const prey = nearest(b, ctx.others, b.r + 22, isEmpty);
      if (prey && b.r < LIVING_LIMITS.gluttonMaxRadius) out.absorbId = prey.id;
      break;
    }
    case "lover": {
      const mate = nearest(b, ctx.others, 220, o => isEmpty(o) || isHeld(o));
      if (mate) Object.assign(out, toward(b, mate, v * 0.6, dt, b.r + mate.r));
      break;
    }
    case "parasite": {
      const host = (meta.hostId !== undefined ? ctx.others.find(o => o.id === meta.hostId && isHeld(o)) : undefined) ?? nearest(b, ctx.others, 180, isHeld);
      meta.hostId = host?.id;
      if (host) Object.assign(out, toward(b, host, v, dt, 34));
      break;
    }
    case "jester": {
      meta.jitterTimer -= dt;
      if (meta.jitterTimer <= 0) { meta.jitterTimer = 0.8; meta.jitter = (ctx.rng() * 2 - 1) * (ctx.reducedMotion ? 15 : 40); }
      out.dx = meta.jitter * dt;
      break;
    }
    case "sleeper": {
      if (meta.age < 2.5) out.hold = true; // engine reverts this tick's drift
      break;
    }
    case "mother": {
      meta.nextBud -= dt;
      if (meta.nextBud <= 0) { meta.nextBud = LIVING_LIMITS.motherInterval; if (meta.children < LIVING_LIMITS.maxChildrenPerParent) out.bud = true; }
      break;
    }
    case "vampire": {
      if (!isHeld(b) || b.life >= LIVING_LIMITS.vampireMaxLife) break;
      const drain: { id: number; amount: number }[] = [];
      for (const o of ctx.others) if (o.id !== b.id && isEmpty(o) && Math.hypot(o.x - b.x, o.y - b.y) < 120) drain.push({ id: o.id, amount: 0.5 * dt });
      if (drain.length) out.drain = drain.slice(0, 3);
      break;
    }
    case "ouroboros": {
      const speed = ctx.reducedMotion ? 0.8 : 1.6;
      const a = meta.age * speed;
      const tx = meta.anchorX + Math.cos(a) * 40, ty = Math.min(b.y, meta.anchorY) + Math.sin(a) * 6;
      Object.assign(out, toward(b, { x: tx, y: ty }, v, dt));
      break;
    }
    case "mimic":
    case "impostor":
    default:
      break; // handled by the engine (type copy / reveal on trap)
  }
  const m = Math.hypot(out.dx, out.dy), cap = v * dt;
  if (m > cap && m > 0) { out.dx = out.dx / m * cap; out.dy = out.dy / m * cap; }
  return out;
}
