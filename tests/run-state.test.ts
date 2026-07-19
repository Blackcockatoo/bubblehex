import assert from "node:assert/strict";
import test from "node:test";
import {
  applyNewCard, applyRunLives, applyRunScore, captureCheckpoint, createNightRun, endRun,
  hasFreeCardSlot, isChamberDueForHexCardOffer, isCheckpointChamber, isRunResumable,
  normalizeNightRun, restoreFromCheckpoint, retryCurrentChamber,
} from "../app/game/run-state.ts";

test("a freshly created run starts at chamber 1 with 3 lives, no cards, and is resumable", () => {
  const run = createNightRun({ hero: "vesper", consciousness: 2, difficultyMode: "arcade" });
  assert.equal(run.currentChamberIndex, 0);
  assert.equal(run.lives, 3);
  assert.equal(run.score, 0);
  assert.deepEqual(run.equippedCards, []);
  assert.equal(isRunResumable(run), true);
});

test("hex card offers land after every two cleared chambers, and checkpoints after 5 and 10", () => {
  assert.deepEqual([2, 4, 6, 8, 10, 12].map(isChamberDueForHexCardOffer), [true, true, true, true, true, true]);
  assert.deepEqual([1, 3, 5, 7, 9, 11].map(isChamberDueForHexCardOffer), [false, false, false, false, false, false]);
  assert.equal(isCheckpointChamber(5), true);
  assert.equal(isCheckpointChamber(10), true);
  assert.equal(isCheckpointChamber(6), false);
});

test("checkpoint capture snapshots the run and restore reproduces it exactly", () => {
  let run = createNightRun({ hero: "jade", consciousness: 1, difficultyMode: "story", seed: 777 });
  run = applyNewCard(run, "grave-bubble");
  run = applyRunScore(run, 4200);
  run = applyRunLives(run, 2);
  run = { ...run, currentChamberIndex: 5 };
  const checkpointed = captureCheckpoint(run, 1500);
  assert.ok(checkpointed.checkpoint);
  assert.equal(checkpointed.checkpoint?.score, 4200);
  assert.equal(checkpointed.checkpoint?.heroXpAtCheckpoint, 1500);

  // Simulate a failed attempt after the checkpoint: score/xp/chamber move on, then death.
  let afterFailedAttempt = applyRunScore(checkpointed, 9999);
  afterFailedAttempt = { ...afterFailedAttempt, currentChamberIndex: 8, lives: 0 };

  const restored = restoreFromCheckpoint(afterFailedAttempt);
  assert.ok(restored);
  assert.equal(restored?.run.score, 4200, "score after restore must be the checkpoint value, not the failed attempt's inflated score");
  assert.equal(restored?.heroXp, 1500, "restored heroXp must roll back xp earned after the checkpoint");
  assert.equal(restored?.run.currentChamberIndex, 5);
  assert.equal(restored?.run.lives, 2);
  assert.ok(restored?.run.equippedCards.some(c => c.id === "grave-bubble"));
});

test("restoring twice from the same checkpoint never compounds score or xp", () => {
  let run = createNightRun({ hero: "vesper", consciousness: 0, difficultyMode: "story" });
  run = captureCheckpoint(applyRunScore(run, 1000), 500);
  const firstRestore = restoreFromCheckpoint(run);
  const secondRestore = restoreFromCheckpoint(firstRestore!.run);
  assert.equal(firstRestore?.run.score, 1000);
  assert.equal(secondRestore?.run.score, 1000, "a second restore from an unchanged checkpoint must not add score");
  assert.equal(firstRestore?.heroXp, secondRestore?.heroXp);
});

test("restoring with no checkpoint yet returns null so the caller falls back to a fresh start", () => {
  const run = createNightRun({ hero: "vesper", consciousness: 0, difficultyMode: "story" });
  assert.equal(restoreFromCheckpoint(run), null);
});

test("retrying the current chamber restores full lives without touching score or chamber index", () => {
  let run = createNightRun({ hero: "vesper", consciousness: 0, difficultyMode: "story" });
  run = applyRunScore(run, 7000);
  run = { ...run, currentChamberIndex: 3, lives: 0 };
  const retried = retryCurrentChamber(run);
  assert.equal(retried.lives, 3);
  assert.equal(retried.score, 7000);
  assert.equal(retried.currentChamberIndex, 3);
});

test("ending a run marks it as no longer resumable", () => {
  const run = createNightRun({ hero: "vesper", consciousness: 0, difficultyMode: "story" });
  const ended = endRun(run);
  assert.equal(isRunResumable(ended), false);
});

test("card slot bookkeeping tracks free slots correctly", () => {
  let run = createNightRun({ hero: "vesper", consciousness: 0, difficultyMode: "story" });
  assert.equal(hasFreeCardSlot(run), true);
  for (const id of ["grave-bubble", "heart-magnet", "bubble-dash", "glass-fang"] as const) run = applyNewCard(run, id);
  assert.equal(hasFreeCardSlot(run), false);
});

test("normalizeNightRun rejects malformed or out-of-range saves instead of throwing", () => {
  assert.equal(normalizeNightRun(null), null);
  assert.equal(normalizeNightRun({}), null);
  assert.equal(normalizeNightRun({ active: true, hero: "vesper", currentChamberIndex: 999 }), null);
  assert.equal(normalizeNightRun({ active: true, hero: "not-a-hero", currentChamberIndex: 0 }), null);
  const valid = normalizeNightRun({ active: true, hero: "jade", currentChamberIndex: 2, lives: 2, score: 100 });
  assert.ok(valid);
  assert.equal(valid?.hero, "jade");
  assert.equal(valid?.difficultyMode, "arcade", "malformed/missing difficultyMode falls back to a safe default");
});
