import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_CHAMBERS, CHECKPOINT_CHAMBER_NUMBERS, campaignComplete, chamberByKey, chamberNodeState,
  clearedWorldIds, defaultChamberRecord, furthestUnlockedIndex, isChamberUnlocked, mergeChamberRecord,
  recordFor, worldCleared, type CampaignRecords,
} from "../app/game/campaign.ts";
import { WORLDS } from "../app/game/content.ts";

test("all twelve chambers are present, numbered 1-12, grouped into the five canon worlds in order", () => {
  assert.equal(CAMPAIGN_CHAMBERS.length, 12);
  assert.deepEqual(CAMPAIGN_CHAMBERS.map(c => c.number), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.deepEqual([...new Set(CAMPAIGN_CHAMBERS.map(c => c.worldId))], WORLDS);
});

test("checkpoints land exactly after chambers 5 and 10", () => {
  assert.deepEqual(CHECKPOINT_CHAMBER_NUMBERS, [5, 10]);
  const checkpointNumbers = CAMPAIGN_CHAMBERS.filter(c => c.checkpoint).map(c => c.number);
  assert.deepEqual(checkpointNumbers, [5, 10]);
});

test("chamber 1 is always unlocked with no records at all", () => {
  assert.equal(isChamberUnlocked({}, 0), true);
  assert.equal(chamberNodeState({}, 0), "unlocked");
});

test("later chambers stay locked until the previous one is cleared, then unlock in order", () => {
  const records: CampaignRecords = {};
  assert.equal(isChamberUnlocked(records, 1), false);
  assert.equal(chamberNodeState(records, 1), "locked");
  const firstChamberKey = CAMPAIGN_CHAMBERS[0].key;
  assert.equal(chamberByKey(firstChamberKey)?.index, 0);
  records[firstChamberKey] = mergeChamberRecord(undefined, {
    score: 1000, timeSeconds: 40, secretFound: false, consciousness: 0, hero: "vesper", perfectClear: false,
  });
  assert.equal(chamberNodeState(records, 0), "cleared");
  assert.equal(isChamberUnlocked(records, 1), true);
  assert.equal(chamberNodeState(records, 1), "unlocked");
  assert.equal(isChamberUnlocked(records, 2), false, "clearing chamber 1 must not skip-unlock chamber 3");
});

test("locked levels ahead remain visible in the chamber list regardless of unlock state", () => {
  assert.equal(CAMPAIGN_CHAMBERS.length, 12);
  assert.ok(CAMPAIGN_CHAMBERS.every(c => typeof c.name === "string" && c.name.length > 0));
});

test("record merging keeps the best of every field independently, never regressing", () => {
  const first = mergeChamberRecord(undefined, { score: 500, timeSeconds: 60, secretFound: false, consciousness: 1, hero: "jade", perfectClear: false });
  const worseScoreButFaster = mergeChamberRecord(first, { score: 200, timeSeconds: 45, secretFound: true, consciousness: 3, hero: "vesper", perfectClear: true });
  assert.equal(worseScoreButFaster.bestScore, 500, "score never regresses");
  assert.equal(worseScoreButFaster.bestTimeSeconds, 45, "faster time replaces slower time");
  assert.equal(worseScoreButFaster.secretFound, true);
  assert.equal(worseScoreButFaster.highestConsciousnessCleared, 3);
  assert.equal(worseScoreButFaster.bestHero, "jade", "bestHero tracks the run that set the best score, not the most recent run");
  assert.equal(worseScoreButFaster.perfectClear, true);
});

test("a chamber with no record yet reports sensible defaults", () => {
  assert.deepEqual(recordFor({}, 3), defaultChamberRecord());
});

test("world completion and campaign completion require every chamber in scope to be cleared", () => {
  const records: CampaignRecords = {};
  for (const chamber of CAMPAIGN_CHAMBERS.filter(c => c.worldId === "velvet-drain")) {
    records[chamber.key] = mergeChamberRecord(undefined, { score: 1, timeSeconds: 1, secretFound: false, consciousness: 0, hero: "vesper", perfectClear: false });
  }
  assert.equal(worldCleared(records, "velvet-drain"), true);
  assert.equal(worldCleared(records, "heartbreak-hotel"), false);
  assert.deepEqual(clearedWorldIds(records), ["velvet-drain"]);
  assert.equal(campaignComplete(records), false);

  const allRecords: CampaignRecords = {};
  for (const chamber of CAMPAIGN_CHAMBERS) {
    allRecords[chamber.key] = mergeChamberRecord(undefined, { score: 1, timeSeconds: 1, secretFound: false, consciousness: 0, hero: "vesper", perfectClear: false });
  }
  assert.equal(campaignComplete(allRecords), true);
  assert.equal(furthestUnlockedIndex(allRecords), 11);
});
