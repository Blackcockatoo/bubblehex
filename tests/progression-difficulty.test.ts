import assert from "node:assert/strict";
import test from "node:test";
import { DIFFICULTY_MODES, DIFFICULTY_MODE_LABELS, consciousnessForMode, isDifficultyMode, nextDifficultyStep } from "../app/game/progression.ts";

test("every difficulty mode maps onto one of the six existing consciousness values", () => {
  for (const mode of DIFFICULTY_MODES) {
    const consciousness = consciousnessForMode(mode, 4);
    assert.ok(Number.isInteger(consciousness) && consciousness >= 0 && consciousness <= 5);
  }
});

test("story, arcade, and nightmare are fixed regardless of the stored custom value", () => {
  assert.equal(consciousnessForMode("story", 5), consciousnessForMode("story", 0));
  assert.equal(consciousnessForMode("arcade", 5), consciousnessForMode("arcade", 0));
  assert.equal(consciousnessForMode("nightmare", 0), consciousnessForMode("nightmare", 5));
});

test("nightmare maps to the highest consciousness and story to the lowest", () => {
  assert.equal(consciousnessForMode("nightmare", 0), 5);
  assert.equal(consciousnessForMode("story", 5), 0);
});

test("custom mode passes the player's directly-selected consciousness straight through", () => {
  for (let value = 0; value <= 5; value++) assert.equal(consciousnessForMode("custom", value as 0), value);
});

test("every mode has a player-facing label and the underlying names are untouched", () => {
  for (const mode of DIFFICULTY_MODES) assert.ok(DIFFICULTY_MODE_LABELS[mode].length > 0);
  assert.equal(DIFFICULTY_MODES.length, 4);
});

test("isDifficultyMode rejects anything outside the known set", () => {
  assert.equal(isDifficultyMode("arcade"), true);
  assert.equal(isDifficultyMode("hard"), false);
  assert.equal(isDifficultyMode(undefined), false);
  assert.equal(isDifficultyMode(3), false);
});

test("the single-button difficulty cycle visits every mode and every custom consciousness once before repeating", () => {
  let step: { mode: typeof DIFFICULTY_MODES[number]; consciousness: 0 } = { mode: "story", consciousness: 0 };
  const seen: string[] = [`${step.mode}:${step.consciousness}`];
  for (let i = 0; i < 8; i++) {
    step = nextDifficultyStep(step) as typeof step;
    seen.push(`${step.mode}:${step.consciousness}`);
  }
  assert.deepEqual(seen, [
    "story:0", "arcade:2", "nightmare:5",
    "custom:0", "custom:1", "custom:2", "custom:3", "custom:4", "custom:5",
  ]);
  const wrapped = nextDifficultyStep(step);
  assert.deepEqual(wrapped, { mode: "story", consciousness: 0 });
});
