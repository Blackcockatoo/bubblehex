// Assembles the data shown on the chamber results screen: the standalone chamber
// score/time/records plus what's new (XP, records, unlocks, a due Hex Card choice).
// Pure presentation-data assembly — no rendering, no engine state.
import type { HeroId } from "./content.ts";
import { defaultChamberRecord, mergeChamberRecord, type ChamberInfo, type ChamberRecord } from "./campaign.ts";
import type { EnemyConsciousness } from "./progression.ts";
import { isChamberDueForHexCardOffer } from "./run-state.ts";
import type { StageBreakdown } from "./scoring.ts";

export type ChamberResultSummary = {
  chamber: ChamberInfo;
  breakdown: StageBreakdown;
  clearTimeSeconds: number;
  bestChain: number;
  xpEarned: number;
  newScoreRecord: boolean;
  newTimeRecord: boolean;
  perfectClear: boolean;
  secretFound: boolean;
  newlyUnlockedSkins: string[];
  newlyUnlockedCodex: string[];
  hexCardOfferDue: boolean;
  updatedRecord: ChamberRecord;
};

export type ChamberResultInput = {
  chamber: ChamberInfo;
  breakdown: StageBreakdown;
  clearTimeSeconds: number;
  bestChain: number;
  xpEarned: number;
  noDamage: boolean;
  secretFound: boolean;
  hero: HeroId;
  consciousness: EnemyConsciousness;
  previousRecord: ChamberRecord | undefined;
  newlyUnlockedSkins: string[];
  newlyUnlockedCodex: string[];
};

export function computeChamberResult(input: ChamberResultInput): ChamberResultSummary {
  const previous = input.previousRecord ?? defaultChamberRecord();
  const finalScore = input.breakdown.total;
  const newScoreRecord = finalScore > previous.bestScore;
  const newTimeRecord = previous.bestTimeSeconds === null || input.clearTimeSeconds < previous.bestTimeSeconds;
  const perfectClear = input.noDamage && input.secretFound;
  const updatedRecord = mergeChamberRecord(previous, {
    score: finalScore, timeSeconds: input.clearTimeSeconds, secretFound: input.secretFound,
    consciousness: input.consciousness, hero: input.hero, perfectClear,
  });
  return {
    chamber: input.chamber, breakdown: input.breakdown, clearTimeSeconds: input.clearTimeSeconds,
    bestChain: input.bestChain, xpEarned: input.xpEarned, newScoreRecord, newTimeRecord, perfectClear,
    secretFound: input.secretFound, newlyUnlockedSkins: input.newlyUnlockedSkins, newlyUnlockedCodex: input.newlyUnlockedCodex,
    hexCardOfferDue: isChamberDueForHexCardOffer(input.chamber.number), updatedRecord,
  };
}
