import assert from "node:assert/strict";
import test from "node:test";
import {
  ORIGINAL_MODE, campaignCompletion, highestUnlockedLevel, isLevelUnlocked, modeLabel,
  normalizeClearedStages, originalStageTime, withClearedStage,
} from "../app/game/campaign.ts";
import { DEFAULT_SETTINGS, migrateSettings } from "../app/game/persistence.ts";

test("cleared chambers are sorted, de-duplicated and bounded", () => {
  assert.deepEqual(normalizeClearedStages([3, 0, 3, 11, 12, -1, 1.5, "2"], 12), [0, 3, 11]);
  assert.deepEqual(normalizeClearedStages("nope", 12), []);
  assert.deepEqual(normalizeClearedStages([0], 0), []);
});

test("the map opens exactly one chamber past the deepest clear", () => {
  assert.equal(highestUnlockedLevel([], 12), 0);
  assert.equal(highestUnlockedLevel([0], 12), 1);
  assert.equal(highestUnlockedLevel([0, 1, 2], 12), 3);
  // Clearing out of order (via a checkpoint resume) still only opens forward.
  assert.equal(highestUnlockedLevel([7], 12), 8);
  // The last chamber never unlocks a thirteenth.
  assert.equal(highestUnlockedLevel([11], 12), 11);
});

test("chamber one is always playable and sealed chambers are not", () => {
  assert.equal(isLevelUnlocked(0, [], 12), true);
  assert.equal(isLevelUnlocked(1, [], 12), false);
  assert.equal(isLevelUnlocked(1, [0], 12), true);
  assert.equal(isLevelUnlocked(2, [0], 12), false);
  assert.equal(isLevelUnlocked(-1, [0], 12), false);
  assert.equal(isLevelUnlocked(12, [11], 12), false);
});

test("recording a clear never mutates the stored list", () => {
  const before = [0, 1];
  const after = withClearedStage(before, 2, 12);
  assert.deepEqual(before, [0, 1]);
  assert.deepEqual(after, [0, 1, 2]);
  assert.deepEqual(withClearedStage(after, 2, 12), [0, 1, 2]);
});

test("completion is reported as a whole percentage", () => {
  assert.equal(campaignCompletion([], 12), 0);
  assert.equal(campaignCompletion([0, 1, 2], 12), 25);
  assert.equal(campaignCompletion([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 12), 100);
});

test("original mode shortens the clock but keeps every stage playable", () => {
  assert.ok(ORIGINAL_MODE.timeScale < 1);
  assert.equal(originalStageTime(62), 51);
  assert.equal(originalStageTime(108), 89);
  // Never so short that a chamber becomes impossible.
  assert.equal(originalStageTime(10), 30);
  assert.equal(modeLabel("original"), "ORIGINAL HEX");
  assert.equal(modeLabel("chronicle"), "CHRONICLE");
});

test("saves migrate forward with campaign progress intact", () => {
  const migrated = migrateSettings({
    version: 5,
    highScore: 4200,
    clearedStages: [2, 0, 99],
    campaignMode: "original",
    originalHighScore: 900,
    originalBestStage: 4,
    touchControls: "off",
  });
  assert.equal(migrated.version, 6);
  assert.equal(migrated.highScore, 4200);
  assert.deepEqual(migrated.clearedStages, [0, 2]);
  assert.equal(migrated.campaignMode, "original");
  assert.equal(migrated.originalHighScore, 900);
  assert.equal(migrated.originalBestStage, 4);
  assert.equal(migrated.touchControls, "off");
});

test("pre-map saves default to a fresh, forgiving campaign", () => {
  const migrated = migrateSettings({ version: 4, highScore: 10 });
  assert.deepEqual(migrated.clearedStages, []);
  assert.equal(migrated.campaignMode, "chronicle");
  assert.equal(migrated.originalHighScore, 0);
  assert.equal(migrated.touchControls, "auto");
  assert.equal(DEFAULT_SETTINGS.campaignMode, "chronicle");
});

test("hostile save payloads cannot corrupt campaign state", () => {
  const migrated = migrateSettings({
    clearedStages: { length: 3 },
    campaignMode: "godmode",
    originalHighScore: -5,
    originalBestStage: 999,
  });
  assert.deepEqual(migrated.clearedStages, []);
  assert.equal(migrated.campaignMode, "chronicle");
  assert.equal(migrated.originalHighScore, 0);
  assert.equal(migrated.originalBestStage, 12);
});
