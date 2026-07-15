import test from "node:test";
import assert from "node:assert/strict";
import { LEVELS, BONUS_LEVEL } from "../app/game/levels.ts";
import { auditLevelReachability } from "../app/game/reachability.ts";

test("twelve authored chambers have valid geometry and encounters", () => {
  assert.equal(LEVELS.length, 12);
  for (const [index, level] of LEVELS.entries()) {
    assert.ok(level.name && level.world, `stage ${index + 1} is named`);
    assert.ok(level.platforms.length >= 5, `stage ${index + 1} has deliberate platforming`);
    assert.ok(level.enemies.length >= 3, `stage ${index + 1} has a clearable encounter`);
    assert.ok(level.time >= 45, `stage ${index + 1} has a fair soft timer`);
    for (const platform of level.platforms) {
      assert.ok(platform.x >= 0 && platform.x + platform.w <= 960, `stage ${index + 1} platform is in bounds`);
      assert.ok(platform.y >= 70 && platform.y + platform.h <= 720, `stage ${index + 1} platform height is valid`);
    }
  }
});

test("every chamber has a traversable scaffold graph", () => {
  for (const [index, level] of LEVELS.entries()) {
    const unreachable = auditLevelReachability(level).filter(platform => platform.status === "unreachable");
    assert.deepEqual(unreachable, [], `stage ${index + 1} has no unreachable scaffold`);
  }
});

test("world progression and final challenge are present", () => {
  assert.deepEqual([...new Set(LEVELS.map(level => level.world))], [
    "VELVET DRAIN", "HEARTBREAK HOTEL", "JADE GARDEN", "CRIMSON CHAPEL", "THE BLACK BUBBLE",
  ]);
  assert.equal(LEVELS.at(-1)?.boss, true);
});

test("the Black Bubble opens with an approach chamber ahead of the boss", () => {
  const blackBubble = LEVELS.filter(level => level.worldId === "black-bubble");
  assert.equal(blackBubble.length, 2);
  assert.equal(blackBubble[0].approach, true);
  assert.equal(blackBubble[0].boss, undefined);
  assert.equal(blackBubble[1].boss, true);
});

test("the Original/Extra Mode bonus vault is a short, traversable, non-canonical detour", () => {
  assert.equal(BONUS_LEVEL.bonus, true);
  assert.ok(!LEVELS.includes(BONUS_LEVEL), "bonus vault is not one of the twelve canonical chambers");
  assert.ok(BONUS_LEVEL.time <= 40, "bonus room is a short change of pace");
  assert.ok(BONUS_LEVEL.enemies.length >= 4, "bonus room rewards a big chain");
  const unreachable = auditLevelReachability(BONUS_LEVEL).filter(platform => platform.status === "unreachable");
  assert.deepEqual(unreachable, []);
});
