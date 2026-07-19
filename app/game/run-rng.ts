// Small seeded PRNG used for Night Run determinism: Hex Card offers (and, later,
// daily-challenge seeds) must reproduce identically for the same run seed and
// chamber index without ever touching Math.random().

export type Rng = () => number;

/** Deterministic 32-bit string hash (FNV-1a) so string seeds behave like numeric ones. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const toSeedInt = (seed: number | string): number =>
  typeof seed === "number" ? (seed >>> 0) || 1 : hashSeed(seed) || 1;

/** mulberry32: tiny, fast, good-enough statistical quality for gameplay RNG. */
export function createRng(seed: number | string): Rng {
  let state = toSeedInt(seed);
  return () => {
    state |= 0; state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** New independent seed derived from a base seed plus arbitrary context (chamber index, salt). */
export function deriveSeed(baseSeed: number | string, ...context: (number | string)[]): number {
  let seed = toSeedInt(baseSeed);
  for (const part of context) seed = hashSeed(`${seed}:${part}`);
  return seed;
}

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

/** Fisher-Yates using a supplied deterministic rng — never mutates the input array. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministically picks `count` distinct items from `items` using `rng`. */
export function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return shuffled(items, rng).slice(0, Math.max(0, Math.min(count, items.length)));
}

/** A fresh, independently-seeded rng scoped to one deterministic decision point. */
export function scopedRng(runSeed: number | string, ...context: (number | string)[]): Rng {
  return createRng(deriveSeed(runSeed, ...context));
}

// Monotonic counter folded into fresh run seeds so two runs started in the same
// millisecond (e.g. rapid "New Night Run" presses) never collide.
let freshSeedCounter = 0;

/** A new run seed suitable for `NightRunState.seed` — unpredictable, not deterministic. */
export function freshRunSeed(): number {
  freshSeedCounter = (freshSeedCounter + 1) >>> 0;
  return hashSeed(`${Date.now()}:${freshSeedCounter}:${Math.random()}`);
}
