import test from "node:test";
import assert from "node:assert/strict";
import {
  FAMILIARS, FAMILIAR_IDS, FAMILIAR_LIMITS, assistReady, evaluateUnlocks, frameIndex, newAssistClock, newBody, notify,
  resetAssistStage, spendAssist, stepFamiliar, stepWalker, tickAssist, type StepInput,
} from "../app/game/familiars.ts";

const input = (over: Partial<StepInput> = {}): StepInput => ({ dt: 1 / 60, hero: { x: 400, y: 600, facing: 1 }, floorY: 650, playerActive: true, reducedMotion: false, ...over });

test("six familiars, each with 4 pack idle frames, a distinct motion and one assist", () => {
  assert.deepEqual([...FAMILIAR_IDS], ["hex_cat", "blue_snake", "nevermore", "boo", "velvet", "vamp"]);
  for (const f of FAMILIARS) { assert.equal(f.frames.length, 4); assert.equal(f.frames[3], `${f.id}_idle_3`); assert.ok(f.assist.cooldown >= 14); }
  assert.equal(new Set(FAMILIARS.map(f => f.motion)).size, 6);
  assert.equal(new Set(FAMILIARS.map(f => f.assist.kind)).size, 6);
});

test("unlocks are deterministic gameplay milestones", () => {
  const none = { stagesCleared: 0, itemsDiscovered: 0, secrets: 0, bestChain: 0, perfectClears: 0 };
  assert.deepEqual(evaluateUnlocks(none, []), []);
  assert.deepEqual(evaluateUnlocks({ ...none, stagesCleared: 1 }, []), ["hex_cat"]);
  assert.deepEqual(evaluateUnlocks({ ...none, stagesCleared: 6, bestChain: 5 }, ["hex_cat"]), ["boo", "vamp"]);
  assert.deepEqual(evaluateUnlocks({ stagesCleared: 9, itemsDiscovered: 9, secrets: 9, bestChain: 9, perfectClears: 9 }, []).length, 6);
});

test("assist clock: cooldown, per-stage limit, never in attract or cosmetic mode", () => {
  const def = FAMILIARS[0], clock = newAssistClock();
  assert.equal(assistReady(clock, def, { attract: true, enabled: true }), false);
  assert.equal(assistReady(clock, def, { attract: false, enabled: false }), false);
  assert.equal(assistReady(clock, def, { attract: false, enabled: true }), true);
  spendAssist(clock, def);
  assert.equal(assistReady(clock, def, { attract: false, enabled: true }), false);
  tickAssist(clock, 999);
  assert.equal(assistReady(clock, def, { attract: false, enabled: true }), false, "Hex Cat: once per chamber");
  resetAssistStage(clock);
  assert.equal(assistReady(clock, def, { attract: false, enabled: true }), true);
});

test("follows the hero, idles when close, stays inside bounds and speed caps", () => {
  for (const def of FAMILIARS) {
    const f = newBody(def.id, 100, 650);
    for (let i = 0; i < 600; i++) {
      stepFamiliar(f, input({ hero: { x: 800, y: 600, facing: 1 } }));
      assert.ok(f.x >= FAMILIAR_LIMITS.bounds.minX && f.x <= FAMILIAR_LIMITS.bounds.maxX, def.id);
      assert.ok(f.y >= FAMILIAR_LIMITS.bounds.minY && f.y <= FAMILIAR_LIMITS.bounds.maxY, def.id);
      assert.ok(Math.abs(f.vx) <= FAMILIAR_LIMITS.maxSpeed, def.id);
    }
    assert.ok(Math.abs(f.x - 750) < 90, `${def.id} reached the hero (${f.x})`);
    assert.ok(f.state === "idle" || f.state === "follow");
  }
  const far = newBody("hex_cat", 100, 650); stepFamiliar(far, input({ hero: { x: 800, y: 600, facing: 1 } }));
  assert.equal(far.state, "follow");
});

test("sleep cycle: hero idle → sleep (Zzz); moving again startles awake", () => {
  const f = newBody("boo", 350, 554);
  for (let i = 0; i < 60 * (FAMILIAR_LIMITS.sleepAfter + 0.5); i++) stepFamiliar(f, input({ playerActive: false }));
  assert.equal(f.state, "sleep"); assert.equal(f.expression, "sleepy");
  stepFamiliar(f, input({ playerActive: true }));
  assert.equal(f.state, "react"); assert.equal(f.expression, "surprised");
  for (let i = 0; i < 60; i++) stepFamiliar(f, input());
  assert.notEqual(f.state, "sleep");
});

test("reactions and celebrations obey priority and expire", () => {
  const f = newBody("vamp", 350, 554);
  assert.ok(notify(f, "bigChain")); assert.equal(f.state, "celebrate"); assert.equal(f.expression, "love");
  assert.equal(notify(f, "combo"), false, "lower priority cannot interrupt");
  assert.ok(notify(f, "hurt")); assert.equal(f.state, "react"); assert.equal(f.expression, "sweat");
  assert.ok(notify(f, "death")); assert.equal(f.expression, "sad");
  for (let i = 0; i < 60 * 2.5; i++) stepFamiliar(f, input());
  assert.equal(f.event, null); assert.ok(f.state === "idle" || f.state === "follow");
  notify(f, "assist", "BOO!"); assert.equal(f.say, "BOO!");
});

test("reduced motion freezes the idle loop on frame 0 and removes squash", () => {
  const f = newBody("nevermore", 100, 650);
  for (let i = 0; i < 120; i++) stepFamiliar(f, input({ reducedMotion: true, hero: { x: 700, y: 600, facing: 1 } }));
  assert.equal(frameIndex(f, true), 0); assert.equal(f.squash, 0);
  const g = newBody("nevermore", 100, 650);
  for (let i = 0; i < 40; i++) stepFamiliar(g, input());
  assert.ok(frameIndex(g, false) >= 0 && frameIndex(g, false) < 4);
});

test("title walkers stay in their lane and stand still with reduced motion", () => {
  const w = { id: "hex_cat" as const, x: 300, dir: 1 as const, pause: 0, clock: 0 };
  let r = 3; const rng = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6000; i++) { stepWalker(w, 1 / 60, 210, 690, rng, false); assert.ok(w.x >= 210 && w.x <= 690); }
  const still = { id: "boo" as const, x: 400, dir: 1 as const, pause: 0, clock: 0 };
  for (let i = 0; i < 100; i++) stepWalker(still, 1 / 60, 210, 690, rng, true);
  assert.equal(still.x, 400);
});
