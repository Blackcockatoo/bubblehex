/**
 * BUBBLE HEX — Forbidden Expansion, milestone 5: the living cabinet (pure logic).
 *
 * Data-driven achievements, the wardrobe they unlock, forbidden memorabilia,
 * living-cabinet tiers, the Widow's remark throttle and collection reset.
 * Everything here is deterministic and engine-free so unit tests can prove it.
 * Every reward is earned through play: there are no purchases or accounts.
 */
import type { ItemRarity } from "./items";
import { emptyCabinet, type PersistedCabinet } from "./persistence.ts";

/** Snapshot of the expansion's own milestone counters (what achievements read). */
export type CabinetStatKey =
  | "pops" | "bestChain" | "chambers" | "perfects" | "secrets" | "items" | "vinyls"
  | "ammoFired" | "ammoKinds" | "personalities" | "familiars" | "assists" | "naps"
  | "widowRemarks" | "titleSecret" | "dressed" | "venomSpelled" | "deaths" | "web";
export type CabinetStats = Record<CabinetStatKey, number>;
export const CABINET_STAT_KEYS: readonly CabinetStatKey[] = [
  "pops", "bestChain", "chambers", "perfects", "secrets", "items", "vinyls", "ammoFired", "ammoKinds", "personalities",
  "familiars", "assists", "naps", "widowRemarks", "titleSecret", "dressed", "venomSpelled", "deaths", "web",
];
export const emptyStats = (): CabinetStats => Object.fromEntries(CABINET_STAT_KEYS.map(k => [k, 0])) as CabinetStats;

export type WardrobeId = "crown" | "veil" | "halo" | "cat_ears" | "wings" | "aura_venom" | "aura_crimson";

export type AchievementDefinition = {
  id: string;
  /** Pack rarity badge used behind the code-drawn glyph. */
  rarity: ItemRarity;
  glyph: string;
  stat: CabinetStatKey;
  need: number;
  reward?: WardrobeId;
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: "first_pop", rarity: "common", glyph: "○", stat: "pops", need: 1 },
  { id: "chain_reaction", rarity: "common", glyph: "∴", stat: "bestChain", need: 3 },
  { id: "heartbreaker", rarity: "rare", glyph: "♥", stat: "bestChain", need: 6, reward: "crown" },
  { id: "opening_night", rarity: "common", glyph: "I", stat: "chambers", need: 1 },
  { id: "chamber_crawler", rarity: "uncommon", glyph: "VI", stat: "chambers", need: 6 },
  { id: "last_call", rarity: "legendary", glyph: "XII", stat: "chambers", need: 12 },
  { id: "untouchable", rarity: "uncommon", glyph: "◇", stat: "perfects", need: 1, reward: "veil" },
  { id: "flawless_five", rarity: "rare", glyph: "✧", stat: "perfects", need: 5 },
  { id: "secret_keeper", rarity: "uncommon", glyph: "?", stat: "secrets", need: 1, reward: "halo" },
  { id: "collector", rarity: "uncommon", glyph: "8", stat: "items", need: 8 },
  { id: "completionist", rarity: "legendary", glyph: "16", stat: "items", need: 16 },
  { id: "cursed_ears", rarity: "cursed", glyph: "♪", stat: "vinyls", need: 1 },
  { id: "living_ammo", rarity: "common", glyph: "◉", stat: "ammoFired", need: 1 },
  { id: "mad_scientist", rarity: "rare", glyph: "⚗", stat: "ammoKinds", need: 6, reward: "aura_venom" },
  { id: "personality_test", rarity: "uncommon", glyph: "☺", stat: "personalities", need: 6 },
  { id: "familiar_face", rarity: "common", glyph: "ᓚ", stat: "familiars", need: 1, reward: "cat_ears" },
  { id: "menagerie", rarity: "legendary", glyph: "6", stat: "familiars", need: 6, reward: "wings" },
  { id: "helping_paw", rarity: "uncommon", glyph: "✋", stat: "assists", need: 10 },
  { id: "night_owl", rarity: "common", glyph: "z", stat: "naps", need: 1 },
  { id: "widows_audience", rarity: "cursed", glyph: "✶", stat: "widowRemarks", need: 3, reward: "aura_crimson" },
  { id: "curiosity", rarity: "cursed", glyph: "◎", stat: "titleSecret", need: 1 },
  { id: "venom_ascension", rarity: "rare", glyph: "V", stat: "venomSpelled", need: 1 },
  { id: "dressed_to_hex", rarity: "common", glyph: "♛", stat: "dressed", need: 1 },
];
const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
export const achievementById = (id: string) => ACHIEVEMENT_BY_ID.get(id);

/** New achievement ids earned by these stats, in definition order. Never re-awards. */
export function evaluateAchievements(stats: CabinetStats, unlocked: readonly string[]): string[] {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter(a => !have.has(a.id) && (stats[a.stat] ?? 0) >= a.need).map(a => a.id);
}

export function achievementProgress(def: AchievementDefinition, stats: CabinetStats) {
  const have = Math.max(0, Math.min(def.need, Math.floor(stats[def.stat] ?? 0)));
  return { have, need: def.need, frac: have / def.need };
}

/* ------------------------------------------------------------------ wardrobe */

export type WardrobeLayer = "back" | "front";
export type WardrobeDefinition = { id: WardrobeId; layer: WardrobeLayer; color: string; unlockedBy: string };
export const WARDROBE: readonly WardrobeDefinition[] = [
  { id: "cat_ears", layer: "front", color: "#B07CFF", unlockedBy: "familiar_face" },
  { id: "veil", layer: "front", color: "#1A0F24", unlockedBy: "untouchable" },
  { id: "halo", layer: "front", color: "#8FE8FF", unlockedBy: "secret_keeper" },
  { id: "crown", layer: "front", color: "#FFD36A", unlockedBy: "heartbreaker" },
  { id: "aura_venom", layer: "back", color: "#7CFF4F", unlockedBy: "mad_scientist" },
  { id: "aura_crimson", layer: "back", color: "#FF2A4F", unlockedBy: "widows_audience" },
  { id: "wings", layer: "back", color: "#2A1036", unlockedBy: "menagerie" },
];
export const wardrobeById = (id: unknown) => WARDROBE.find(w => w.id === id);
export const isWardrobeUnlocked = (id: string, achievements: readonly string[]) => {
  const def = wardrobeById(id);
  return !!def && achievements.includes(def.unlockedBy);
};
/** The equipped accessory if (still) earned; anything else draws nothing. */
export function equippedWardrobe(cabinet: Pick<PersistedCabinet, "wardrobeEquipped" | "achievements">): WardrobeDefinition | undefined {
  const id = cabinet.wardrobeEquipped;
  return id && isWardrobeUnlocked(id, cabinet.achievements) ? wardrobeById(id) : undefined;
}

/* -------------------------------------------------------------- memorabilia */

export type MemorabiliaDefinition = { id: string; prop: string; stat: CabinetStatKey; need: number };
export const MEMORABILIA: readonly MemorabiliaDefinition[] = [
  { id: "secret_door", prop: "secret_door", stat: "titleSecret", need: 1 },
  { id: "tarot", prop: "tarot", stat: "widowRemarks", need: 1 },
  { id: "coffin", prop: "coffin", stat: "deaths", need: 1 },
  { id: "jukebox", prop: "jukebox", stat: "vinyls", need: 2 },
  { id: "chandelier", prop: "chandelier", stat: "bestChain", need: 8 },
  { id: "stained_glass", prop: "stained_glass", stat: "secrets", need: 3 },
  { id: "serpent_statue", prop: "serpent_statue", stat: "ammoKinds", need: 11 },
  { id: "clock", prop: "clock", stat: "web", need: 100 },
];
export const memorabiliaOwned = (def: MemorabiliaDefinition, stats: CabinetStats) => (stats[def.stat] ?? 0) >= def.need;

/* ---------------------------------------------------------- living cabinet */

/** Achievements needed for each living-cabinet tier (1..5). */
export const TIER_THRESHOLDS = [3, 6, 10, 15, 20] as const;
export function cabinetTier(achievementCount: number): number {
  return TIER_THRESHOLDS.filter(n => achievementCount >= n).length;
}

export const CABINET_LIMITS = {
  /** Seconds of title-screen time for the spiders to finish the web. */
  webSeconds: 150,
  /** Title idle seconds before the characters dance (attract starts at 15). */
  danceAfter: 5,
  /** The Widow interrupts at most this often. */
  remarkMinStages: 2,
  remarkMinSeconds: 45,
  remarkChance: 0.6,
  remarkMaxPerSession: 6,
  /** Seconds a remark may hold the stage intro (skippable). */
  remarkHold: 3.4,
  toastLife: 2.8,
  maxToasts: 3,
  titleWalkersBase: 3,
  titleWalkersTier2: 6,
} as const;

export const stepWeb = (web: number, dt: number) => Math.max(0, Math.min(1, web + Math.max(0, dt) / CABINET_LIMITS.webSeconds));
export const titleWalkerCap = (tier: number) => tier >= 2 ? CABINET_LIMITS.titleWalkersTier2 : CABINET_LIMITS.titleWalkersBase;

export type RemarkClock = { stagesSince: number; lastAt: number; shown: number };
export const newRemarkClock = (): RemarkClock => ({ stagesSince: 0, lastAt: -Infinity, shown: 0 });

/** Called once per stage transition. Returns true when the Widow may speak (and books it). */
export function rollRemark(clock: RemarkClock, now: number, rng: () => number, attract = false): boolean {
  if (attract) return false;
  clock.stagesSince++;
  if (clock.shown >= CABINET_LIMITS.remarkMaxPerSession) return false;
  if (clock.stagesSince < CABINET_LIMITS.remarkMinStages || now - clock.lastAt < CABINET_LIMITS.remarkMinSeconds) return false;
  if (rng() >= CABINET_LIMITS.remarkChance) return false;
  clock.stagesSince = 0; clock.lastAt = now; clock.shown++;
  return true;
}

/* -------------------------------------------------------------- cabinet UI */

export type CabinetSection = "items" | "familiars" | "bubbles" | "records" | "editions" | "chambers" | "achievements" | "memorabilia" | "wardrobe" | "reset";
export const CABINET_SECTIONS: readonly CabinetSection[] = ["items", "familiars", "bubbles", "records", "editions", "chambers", "achievements", "memorabilia", "wardrobe", "reset"];

/* ----------------------------------------------------------------- reset */

type ResettableSettings = {
  collection: { items: Record<string, number> };
  familiars: { unlocked: string[]; selected: string | null; assists: boolean; bestChain: number };
  cabinet: PersistedCabinet;
  jukeboxTrack: string;
  theme: string;
};

/**
 * Erase the Forbidden Expansion collection only: items, familiars, achievements,
 * wardrobe, discoveries, memorabilia progress and the living cabinet. Campaign
 * records (high score, best times, fragments, hero levels, skins) are untouched.
 * The familiar assist preference is a setting, not a collectible, so it is kept.
 */
export function resetCollection<T extends ResettableSettings>(settings: T): T {
  settings.collection = { items: {} };
  settings.familiars = { unlocked: [], selected: null, assists: settings.familiars?.assists !== false, bestChain: 0 };
  settings.cabinet = emptyCabinet();
  settings.jukeboxTrack = "auto";
  settings.theme = "default";
  return settings;
}
