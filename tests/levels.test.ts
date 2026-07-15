import test from "node:test";
import assert from "node:assert/strict";
import { applySuperRemix, LEVELS } from "../app/game/levels.ts";
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

test("SUPER-mode remixed scaffolding stays fully traversable", () => {
  for (const [index, level] of LEVELS.entries()) {
    const remixed = applySuperRemix(level);
    const unreachable = auditLevelReachability(remixed).filter(platform => platform.status === "unreachable");
    assert.deepEqual(unreachable, [], `stage ${index + 1} has an unreachable scaffold once SUPER-mode remixes it`);
  }
});

test("world progression and final challenge are present", () => {
  assert.deepEqual([...new Set(LEVELS.map(level => level.world))], [
    "VELVET DRAIN", "HEARTBREAK HOTEL", "JADE GARDEN", "CRIMSON CHAPEL", "THE BLACK BUBBLE",
  ]);
  assert.equal(LEVELS.at(-1)?.boss, true);
});
