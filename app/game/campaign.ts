// Night Run campaign progression: chamber/world structure, unlock rules,
// checkpoint locations, and the per-chamber records shown on the campaign map.
import type { HeroId, WorldId } from "./content.ts";
import { WORLD_PROFILES, WORLDS } from "./content.ts";
import { LEVELS } from "./levels.ts";
import type { EnemyConsciousness } from "./progression.ts";

export type ChamberInfo = {
  index: number;
  number: number;
  key: string;
  name: string;
  worldId: WorldId;
  worldName: string;
  worldOrder: number;
  indexInWorld: number;
  boss: boolean;
  approach: boolean;
  checkpoint: boolean;
};

const worldOrderOf = (worldId: WorldId) => WORLDS.indexOf(worldId);

/** Hard checkpoints land after chambers 5 and 10 (1-indexed), i.e. after clearing
 * the chamber at 0-based index 4 and 9. */
export const CHECKPOINT_CHAMBER_NUMBERS = [5, 10];

export const CAMPAIGN_CHAMBERS: ChamberInfo[] = LEVELS.map((level, index) => {
  const worldChambers = LEVELS.filter(item => item.worldId === level.worldId);
  return {
    index,
    number: index + 1,
    key: level.loreFragmentId,
    name: level.name,
    worldId: level.worldId,
    worldName: WORLD_PROFILES[level.worldId].name,
    worldOrder: worldOrderOf(level.worldId),
    indexInWorld: worldChambers.indexOf(level),
    boss: !!level.boss,
    approach: !!level.approach,
    checkpoint: CHECKPOINT_CHAMBER_NUMBERS.includes(index + 1),
  };
});

export function chamberKey(index: number): string {
  return LEVELS[index]?.loreFragmentId ?? "";
}

export function chamberByKey(key: string): ChamberInfo | undefined {
  return CAMPAIGN_CHAMBERS.find(chamber => chamber.key === key);
}

export type ChamberRecord = {
  cleared: boolean;
  bestScore: number;
  bestTimeSeconds: number | null;
  secretFound: boolean;
  highestConsciousnessCleared: EnemyConsciousness | null;
  bestHero: HeroId | null;
  perfectClear: boolean;
};

export function defaultChamberRecord(): ChamberRecord {
  return { cleared:false, bestScore:0, bestTimeSeconds:null, secretFound:false, highestConsciousnessCleared:null, bestHero:null, perfectClear:false };
}

export type ChamberClearInput = {
  score: number;
  timeSeconds: number;
  secretFound: boolean;
  consciousness: EnemyConsciousness;
  hero: HeroId;
  perfectClear: boolean;
};

/** Merges a freshly-cleared chamber's result into its existing record, keeping the
 * best of every field independently (a slower run with a higher score still raises
 * bestScore; it never regresses bestTimeSeconds). */
export function mergeChamberRecord(existing: ChamberRecord | undefined, result: ChamberClearInput): ChamberRecord {
  const base = existing ?? defaultChamberRecord();
  const scoreImproved = result.score > base.bestScore;
  return {
    cleared: true,
    bestScore: Math.max(base.bestScore, result.score),
    bestTimeSeconds: base.bestTimeSeconds === null ? result.timeSeconds : Math.min(base.bestTimeSeconds, result.timeSeconds),
    secretFound: base.secretFound || result.secretFound,
    highestConsciousnessCleared: Math.max(base.highestConsciousnessCleared ?? 0, result.consciousness) as EnemyConsciousness,
    bestHero: scoreImproved || !base.bestHero ? result.hero : base.bestHero,
    perfectClear: base.perfectClear || result.perfectClear,
  };
}

export type CampaignRecords = Record<string, ChamberRecord>;

export function recordFor(records: CampaignRecords, index: number): ChamberRecord {
  return records[chamberKey(index)] ?? defaultChamberRecord();
}

/** Chamber 1 is always open; every later chamber unlocks once the one before it clears. */
export function isChamberUnlocked(records: CampaignRecords, index: number): boolean {
  if (index <= 0) return true;
  return recordFor(records, index - 1).cleared;
}

export type ChamberNodeState = "locked" | "unlocked" | "cleared";

export function chamberNodeState(records: CampaignRecords, index: number): ChamberNodeState {
  if (recordFor(records, index).cleared) return "cleared";
  return isChamberUnlocked(records, index) ? "unlocked" : "locked";
}

/** A world counts as complete for chamber-select purposes once every chamber in it
 * has been cleared at least once. */
export function worldCleared(records: CampaignRecords, worldId: WorldId): boolean {
  return CAMPAIGN_CHAMBERS.filter(chamber => chamber.worldId === worldId).every(chamber => recordFor(records, chamber.index).cleared);
}

export function clearedWorldIds(records: CampaignRecords): WorldId[] {
  return WORLDS.filter(worldId => worldCleared(records, worldId));
}

export function furthestUnlockedIndex(records: CampaignRecords): number {
  for (let i = CAMPAIGN_CHAMBERS.length - 1; i >= 0; i--) if (isChamberUnlocked(records, i)) return i;
  return 0;
}

export function campaignComplete(records: CampaignRecords): boolean {
  return CAMPAIGN_CHAMBERS.every(chamber => recordFor(records, chamber.index).cleared);
}
