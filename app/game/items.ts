/**
 * BUBBLE HEX — Forbidden Expansion item registry (M1).
 *
 * Pure data + rules: no DOM, canvas or audio access, so every rule here is unit
 * tested directly. The engine integration lives in forbidden-expansion.ts.
 *
 * Expansion items deliberately use the reward kind "HEX_ITEM" plus an `itemId`
 * so they never collide with the original CHERRY / RING / PERFUME rewards, the
 * VENOM letters, or the "venom" mastery upgrade.
 */

export type ItemRarity = "common" | "uncommon" | "rare" | "legendary" | "cursed";

export type ExpansionItemId =
  | "poison_apple" | "widow_cherries" | "forbidden_perfume" | "broken_heart"
  | "serpent_ring" | "widow_key" | "dead_rose" | "cursed_vinyl"
  | "black_pearl" | "golden_fang" | "widow_eye" | "stolen_minute"
  | "deadly_kiss" | "wicked_clover" | "midnight_moth" | "vanity_mirror";

/** Timed effects are tracked by ItemEffectState; instant effects resolve on pickup. */
export type TimedEffect = "comboBoost" | "magnet" | "rangeBoost" | "slowEnemies" | "charm" | "dropBoost" | "echo" | "reveal";
export type InstantEffect = "score" | "heal" | "timeBonus" | "hint" | "collect" | "unlockTrack" | "key";
export type ItemEffect = TimedEffect | InstantEffect;

/** Implemented = changes gameplay now. Proposed = registered + collectable, full mechanic lands with a later milestone. */
export type EffectStatus = "implemented" | "collection-only";

export type ItemCue = { notes: readonly number[]; wave: OscillatorType; step: number };

export type DropContext = {
  levelIndex: number;
  lives: number;
  levelTime: number;
  boss: boolean;
  bonus: boolean;
  chain: number;
  enemiesLeft: number;
  secretFound: boolean;
};

export type ItemDefinition = {
  id: ExpansionItemId;
  name: string;
  rarity: ItemRarity;
  /** Manifest id for the sprite (also the atlas frame name). */
  sprite: string;
  effect: ItemEffect;
  status: EffectStatus;
  /** Seconds for timed effects; 0 for instant effects. */
  duration: number;
  /** Base score granted on pickup (subject to the per-stage item score cap). */
  score: number;
  description: string;
  /** Player-facing discovery hint shown in the collection. */
  discovery: string;
  /** Memetic announcement shown with the pickup toast. */
  announce?: string;
  cue: ItemCue;
  /** Fallback glyph when the sprite atlas is unavailable. */
  glyph: string;
  tint: string;
  eligible: (ctx: DropContext) => boolean;
};

export const RARITY_ORDER: readonly ItemRarity[] = ["common", "uncommon", "rare", "legendary", "cursed"];
export const RARITY_WEIGHT: Record<ItemRarity, number> = { common: 60, uncommon: 28, rare: 10, legendary: 2, cursed: 6 };
export const RARITY_COLOR: Record<ItemRarity, string> = { common: "#C9C2D6", uncommon: "#20C98B", rare: "#7FB8FF", legendary: "#FFD36A", cursed: "#FF2A9D" };
/** Non-colour rarity marker: number of pips drawn around the pickup and toast. */
export const RARITY_PIPS: Record<ItemRarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3, cursed: 4 };
export const RARITY_BADGE: Record<ItemRarity, string> = { common: "badge_common", uncommon: "badge_uncommon", rare: "badge_rare", legendary: "badge_legendary", cursed: "badge_cursed" };

export const ITEM_LIMITS = {
  /** Expansion pickups alive on the playfield at once. */
  maxOnField: 2,
  /** Expansion pickups dropped per stage attempt. */
  maxPerStage: 4,
  /** Kills required between expansion drops. */
  minKillsBetween: 2,
  baseChance: 0.2,
  /** Wicked Clover doubles the chance but can never exceed this. */
  maxChance: 0.4,
  /** Total score any item can award in one stage attempt. */
  stageScoreCap: 15000,
  /** Total Widow Cherries pop bonus in one stage attempt. */
  comboBonusCap: 5000,
  comboBonusRate: 0.5,
  maxLives: 5,
  /** Vanity Mirror echo bubbles are skipped when this many bubbles exist. */
  maxBubblesForEcho: 18,
  timeBonusSeconds: 15,
  charmSeconds: 3,
  pickupLife: 9,
} as const;

const cue = (notes: number[], wave: OscillatorType = "triangle", step = 0.06): ItemCue => ({ notes, wave, step });

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  { id: "poison_apple", name: "Poison Apple", rarity: "common", sprite: "poison_apple", effect: "score", status: "implemented", duration: 0, score: 500,
    description: "One bite. +500.", discovery: "Pops anywhere in the night.", announce: "POP RESPONSIBLY.", cue: cue([660, 880]), glyph: "A", tint: "#FF2A9D", eligible: () => true },
  { id: "widow_cherries", name: "Widow Cherries", rarity: "common", sprite: "widow_cherries", effect: "comboBoost", status: "implemented", duration: 12, score: 150,
    description: "Pops score +50% for 12s.", discovery: "Ripen on a chain of two or more.", cue: cue([740, 990, 740]), glyph: "C", tint: "#C4133D", eligible: c => c.chain >= 2 },
  { id: "forbidden_perfume", name: "Forbidden Perfume", rarity: "uncommon", sprite: "forbidden_perfume", effect: "magnet", status: "implemented", duration: 10, score: 200,
    description: "Rewards drift to you for 10s.", discovery: "Spilled after the first chamber.", cue: cue([520, 780, 1040], "sine"), glyph: "P", tint: "#B57BFF", eligible: c => c.levelIndex >= 1 },
  { id: "broken_heart", name: "Broken Heart", rarity: "rare", sprite: "broken_heart", effect: "heal", status: "implemented", duration: 0, score: 0,
    description: "+1 life (max 5). Full hearts: +1000.", discovery: "Only falls for the wounded.", announce: "THAT WAS PERSONAL.", cue: cue([392, 523, 659, 784], "sine", .08), glyph: "H", tint: "#FF5C8A", eligible: c => c.lives < 3 },
  { id: "serpent_ring", name: "Serpent Ring", rarity: "uncommon", sprite: "serpent_ring", effect: "rangeBoost", status: "implemented", duration: 15, score: 200,
    description: "Bubbles fly faster and last longer for 15s.", discovery: "Coils in any chamber.", cue: cue([880, 660, 990], "square", .05), glyph: "R", tint: "#FFD36A", eligible: () => true },
  { id: "widow_key", name: "Widow's Key", rarity: "rare", sprite: "widow_key", effect: "key", status: "collection-only", duration: 0, score: 1500,
    description: "Opens a door that does not exist yet.", discovery: "Chain three or more after stage four.", announce: "THE WIDOW APPROVES.", cue: cue([600, 900, 1200], "triangle", .07), glyph: "K", tint: "#FFD36A", eligible: c => c.levelIndex >= 3 && c.chain >= 3 },
  { id: "dead_rose", name: "Dead Rose", rarity: "rare", sprite: "dead_rose", effect: "slowEnemies", status: "implemented", duration: 4, score: 300,
    description: "Enemies wilt to half speed for 4s.", discovery: "Grows from stage three onward.", cue: cue([330, 247, 196], "sine", .09), glyph: "D", tint: "#8E1F4B", eligible: c => c.levelIndex >= 2 },
  { id: "cursed_vinyl", name: "Cursed Vinyl", rarity: "cursed", sprite: "cursed_vinyl", effect: "unlockTrack", status: "collection-only", duration: 0, score: 666,
    description: "A record for the jukebox. Do not play backwards.", discovery: "Spins out after stage five.", announce: "SIN. WIN. REPEAT.", cue: cue([440, 415, 392, 370], "sawtooth", .07), glyph: "V", tint: "#FF2A9D", eligible: c => c.levelIndex >= 4 },
  { id: "black_pearl", name: "Black Pearl", rarity: "legendary", sprite: "black_pearl", effect: "score", status: "implemented", duration: 0, score: 5000,
    description: "Priceless. +5000.", discovery: "Chain four, or dive past stage six.", announce: "ABSOLUTELY HEXED.", cue: cue([523, 659, 784, 1047, 1319], "sine", .06), glyph: "B", tint: "#9A8CFF", eligible: c => c.chain >= 4 || c.levelIndex >= 5 },
  { id: "golden_fang", name: "Golden Fang", rarity: "rare", sprite: "golden_fang", effect: "collect", status: "implemented", duration: 0, score: 750,
    description: "+750. Every fang is counted.", discovery: "Bitten loose in any chamber.", cue: cue([988, 1319], "square", .05), glyph: "F", tint: "#FFD36A", eligible: () => true },
  { id: "widow_eye", name: "Widow's Eye", rarity: "rare", sprite: "widow_eye", effect: "reveal", status: "implemented", duration: 6, score: 300,
    description: "Marks every enemy for 6s.", discovery: "Opens while three or more remain.", cue: cue([700, 1050], "triangle", .1), glyph: "E", tint: "#20C98B", eligible: c => c.enemiesLeft >= 3 },
  { id: "stolen_minute", name: "Stolen Minute", rarity: "uncommon", sprite: "stolen_minute", effect: "timeBonus", status: "implemented", duration: 0, score: 200,
    description: "+15 seconds on the clock.", discovery: "Only when time runs short.", cue: cue([1200, 900, 1200], "square", .05), glyph: "M", tint: "#FFD36A", eligible: c => c.levelTime < 25 && !c.boss },
  { id: "deadly_kiss", name: "Deadly Kiss", rarity: "cursed", sprite: "deadly_kiss", effect: "charm", status: "implemented", duration: 3, score: 300,
    description: "Untouchable for 3s.", discovery: "Blown from stage three onward.", announce: "YOU LITTLE MENACE.", cue: cue([880, 1175, 880], "sine", .07), glyph: "X", tint: "#FF2A9D", eligible: c => c.levelIndex >= 2 },
  { id: "wicked_clover", name: "Wicked Clover", rarity: "uncommon", sprite: "wicked_clover", effect: "dropBoost", status: "implemented", duration: 20, score: 200,
    description: "Expansion drops twice as likely for 20s.", discovery: "Sprouts anywhere, rarely.", cue: cue([784, 988, 1175], "triangle", .05), glyph: "L", tint: "#20C98B", eligible: () => true },
  { id: "midnight_moth", name: "Midnight Moth", rarity: "uncommon", sprite: "midnight_moth", effect: "hint", status: "implemented", duration: 0, score: 200,
    description: "Whispers this chamber's secret.", discovery: "Drawn to unfound secrets.", cue: cue([330, 494, 330], "sine", .1), glyph: "O", tint: "#9A8CFF", eligible: c => !c.secretFound && !c.bonus },
  { id: "vanity_mirror", name: "Vanity Mirror", rarity: "rare", sprite: "vanity_mirror", effect: "echo", status: "implemented", duration: 10, score: 300,
    description: "Every bubble fires a mirrored echo for 10s.", discovery: "Reflects after the first chamber.", announce: "BUBBLE BAD BEHAVIOUR.", cue: cue([660, 990, 660, 990], "triangle", .05), glyph: "I", tint: "#7FB8FF", eligible: c => c.levelIndex >= 1 },
];

export const ITEM_REGISTRY: ReadonlyMap<ExpansionItemId, ItemDefinition> = new Map(ITEM_DEFINITIONS.map(item => [item.id, item]));
export const EXPANSION_REWARD_KIND = "HEX_ITEM";

export function itemById(id: string): ItemDefinition | undefined {
  return ITEM_REGISTRY.get(id as ExpansionItemId);
}

export const isTimedEffect = (effect: ItemEffect): effect is TimedEffect =>
  effect === "comboBoost" || effect === "magnet" || effect === "rangeBoost" || effect === "slowEnemies" || effect === "charm" || effect === "dropBoost" || effect === "echo" || effect === "reveal";

export type DropState = { onField: number; stageDrops: number; killsSinceDrop: number; dropBoost: boolean };

export function dropChance(state: DropState): number {
  return Math.min(ITEM_LIMITS.maxChance, ITEM_LIMITS.baseChance * (state.dropBoost ? 2 : 1));
}

/**
 * Decide whether a kill drops an expansion item and which one. Bounded: never
 * more than maxOnField alive, maxPerStage per attempt, and minKillsBetween kills
 * apart. `rng` returns [0,1) and is injected for deterministic tests.
 */
export function rollItemDrop(ctx: DropContext, state: DropState, rng: () => number): ItemDefinition | null {
  if (state.onField >= ITEM_LIMITS.maxOnField) return null;
  if (state.stageDrops >= ITEM_LIMITS.maxPerStage) return null;
  if (state.killsSinceDrop < ITEM_LIMITS.minKillsBetween) return null;
  if (rng() >= dropChance(state)) return null;
  const pool = ITEM_DEFINITIONS.filter(item => item.eligible(ctx));
  if (!pool.length) return null;
  const total = pool.reduce((sum, item) => sum + RARITY_WEIGHT[item.rarity], 0);
  let pick = rng() * total;
  for (const item of pool) { pick -= RARITY_WEIGHT[item.rarity]; if (pick < 0) return item; }
  return pool[pool.length - 1];
}

/** Per-stage-attempt score ledger; prevents item/score farming loops. */
export type ItemLedger = { itemScore: number; comboBonus: number };
export const newLedger = (): ItemLedger => ({ itemScore: 0, comboBonus: 0 });

export function awardItemScore(ledger: ItemLedger, amount: number): number {
  const safe = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  const granted = Math.min(safe, Math.max(0, ITEM_LIMITS.stageScoreCap - ledger.itemScore));
  ledger.itemScore += granted;
  return granted;
}

export function awardComboBonus(ledger: ItemLedger, popPoints: number): number {
  const safe = Math.max(0, Math.floor((Number.isFinite(popPoints) ? popPoints : 0) * ITEM_LIMITS.comboBonusRate));
  const granted = Math.min(safe, Math.max(0, ITEM_LIMITS.comboBonusCap - ledger.comboBonus));
  ledger.comboBonus += granted;
  return granted;
}

export type ActiveEffect = { effect: TimedEffect; itemId: ExpansionItemId; remaining: number; duration: number };

/** Timed effect container. Re-collecting refreshes (never stacks) a timer. */
export class ItemEffectState {
  private active = new Map<TimedEffect, ActiveEffect>();

  apply(item: ItemDefinition): ActiveEffect | null {
    if (!isTimedEffect(item.effect) || item.duration <= 0) return null;
    const effect: ActiveEffect = { effect: item.effect, itemId: item.id, remaining: item.duration, duration: item.duration };
    this.active.set(item.effect, effect);
    return effect;
  }

  has(effect: TimedEffect): boolean { return this.active.has(effect); }
  remaining(effect: TimedEffect): number { return this.active.get(effect)?.remaining ?? 0; }

  tick(dt: number): TimedEffect[] {
    const expired: TimedEffect[] = [];
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    for (const [key, value] of this.active) {
      value.remaining -= step;
      if (value.remaining <= 0) { this.active.delete(key); expired.push(key); }
    }
    return expired;
  }

  clear() { this.active.clear(); }
  list(): ActiveEffect[] { return [...this.active.values()]; }
  get size() { return this.active.size; }
}

/** Collection bookkeeping (counts persisted in settings.collection.items). */
export function recordDiscovery(items: Record<string, number>, id: ExpansionItemId): { firstTime: boolean; count: number } {
  const count = Math.min(999999, (items[id] ?? 0) + 1);
  items[id] = count;
  return { firstTime: count === 1, count };
}

export function discoveredCount(items: Record<string, number>): number {
  return ITEM_DEFINITIONS.filter(item => (items[item.id] ?? 0) > 0).length;
}

export const SECRET_WHISPERS: Record<string, string> = {
  trapFirst: "THE MOTH WHISPERS: CAGE THEM ALL BEFORE THE FIRST POP",
  oneChain: "THE MOTH WHISPERS: ONE CHAIN. NO SURVIVORS.",
  noFloor: "THE MOTH WHISPERS: THE FLOOR IS FOR MORTALS",
  widow13: "THE MOTH WHISPERS: DANCE WITH HER FOR THIRTEEN SECONDS",
};
