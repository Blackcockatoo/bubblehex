import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_CHAMBERS, defaultChamberRecord } from "../app/game/campaign.ts";
import { computeChamberResult } from "../app/game/results.ts";
import { computeStageBreakdown } from "../app/game/scoring.ts";

const chamber = CAMPAIGN_CHAMBERS[0];

test("a first clear is always a new score and time record", () => {
  const breakdown = computeStageBreakdown({ kills: 900, remainingTime: 20, lives: 3, noDamage: true, secretFound: true, bonusRoom: false });
  const result = computeChamberResult({
    chamber, breakdown, clearTimeSeconds: 42, bestChain: 5, xpEarned: 260, noDamage: true, secretFound: true,
    hero: "vesper", consciousness: 2, previousRecord: undefined, newlyUnlockedSkins: [], newlyUnlockedCodex: [],
  });
  assert.equal(result.newScoreRecord, true);
  assert.equal(result.newTimeRecord, true);
  assert.equal(result.perfectClear, true);
  assert.equal(result.updatedRecord.cleared, true);
});

test("a slower, lower-scoring repeat clear reports no new records but still merges best-of", () => {
  const previous = { ...defaultChamberRecord(), cleared: true, bestScore: 5000, bestTimeSeconds: 30 };
  const breakdown = computeStageBreakdown({ kills: 100, remainingTime: 2, lives: 1, noDamage: false, secretFound: false, bonusRoom: false });
  const result = computeChamberResult({
    chamber, breakdown, clearTimeSeconds: 55, bestChain: 2, xpEarned: 90, noDamage: false, secretFound: false,
    hero: "jade", consciousness: 0, previousRecord: previous, newlyUnlockedSkins: [], newlyUnlockedCodex: [],
  });
  assert.equal(result.newScoreRecord, false);
  assert.equal(result.newTimeRecord, false);
  assert.equal(result.updatedRecord.bestScore, 5000, "best score must not regress");
  assert.equal(result.updatedRecord.bestTimeSeconds, 30, "best time must not regress");
});

test("hex card offers are flagged due exactly on even-numbered chambers", () => {
  const breakdown = computeStageBreakdown({ kills: 0, remainingTime: 0, lives: 0, noDamage: false, secretFound: false, bonusRoom: false });
  const chamber2 = CAMPAIGN_CHAMBERS[1];
  const chamber3 = CAMPAIGN_CHAMBERS[2];
  const resultFor = (c: typeof chamber2) => computeChamberResult({
    chamber: c, breakdown, clearTimeSeconds: 1, bestChain: 1, xpEarned: 0, noDamage: false, secretFound: false,
    hero: "vesper", consciousness: 0, previousRecord: undefined, newlyUnlockedSkins: [], newlyUnlockedCodex: [],
  });
  assert.equal(resultFor(chamber2).hexCardOfferDue, true);
  assert.equal(resultFor(chamber3).hexCardOfferDue, false);
});
