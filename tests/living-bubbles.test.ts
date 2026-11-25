import test from "node:test";
import assert from "node:assert/strict";
import {
  AMMO_DEFINITIONS, AMMO_ORDER, LIVING_LIMITS, PERSONALITIES, PERSONALITY_ORDER, addCharges, awardBonus, awardTime,
  canSpawnBubble, childAllowance, clampStatus, consumeCharge, cycleAmmo, newBonusLedger, newInventory, newMeta,
  personalityFor, rollAmmoDrop, steer, thunderTargets, totalCharges, type LivingMeta, type SteerBubble,
} from "../app/game/living-bubbles.ts";

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

test("registry: 11 ammo types with pack sprites and 11 personalities", () => {
  assert.deepEqual([...AMMO_ORDER].sort(), ["frost", "gravity", "inferno", "klein", "mirror", "phantom", "recursive", "thunder", "time", "venom", "widow"]);
  for (const a of AMMO_DEFINITIONS) assert.equal(a.sprite, `bubble_${a.id}`);
  assert.deepEqual([...PERSONALITY_ORDER].sort(), ["coward", "glutton", "impostor", "jester", "lover", "mimic", "mother", "ouroboros", "parasite", "sleeper", "vampire"]);
  assert.equal(PERSONALITIES.length, 11);
});

test("venom ammo is namespaced away from the VENOM letters and venom upgrade", () => {
  const inv = newInventory();
  addCharges(inv, "venom", 2);
  assert.deepEqual(Object.keys(inv), ["charges", "selected"]);
  assert.equal(inv.selected, "venom");
});

test("inventory caps per type and in total; consume and cycle", () => {
  const inv = newInventory();
  assert.equal(addCharges(inv, "frost", 10), LIVING_LIMITS.maxChargesPerType);
  assert.equal(addCharges(inv, "frost", 1), 0);
  addCharges(inv, "thunder", 9); addCharges(inv, "venom", 9); addCharges(inv, "mirror", 9);
  assert.equal(totalCharges(inv), LIVING_LIMITS.maxChargesTotal);
  assert.equal(inv.selected, "frost", "first ammo collected is auto-selected");
  // owned in registry order: venom, thunder, frost (mirror refused by the total cap)
  assert.equal(inv.charges.mirror, undefined);
  assert.equal(cycleAmmo(inv), null, "NORMAL sits in the cycle");
  assert.equal(cycleAmmo(inv), "venom");
  for (let i = 0; i < LIVING_LIMITS.maxChargesPerType; i++) assert.equal(consumeCharge(inv), "venom");
  assert.equal(inv.selected, null, "empty ammo falls back to normal");
  assert.equal(consumeCharge(inv), null);
});

test("ammo drops respect field, stage, spacing caps and stage gating", () => {
  const always = () => 0;
  assert.equal(rollAmmoDrop(0, { onField: 1, stageDrops: 0, killsSinceDrop: 9 }, always), null);
  assert.equal(rollAmmoDrop(0, { onField: 0, stageDrops: LIVING_LIMITS.maxOrbsPerStage, killsSinceDrop: 9 }, always), null);
  assert.equal(rollAmmoDrop(0, { onField: 0, stageDrops: 0, killsSinceDrop: 1 }, always), null);
  const rng = seeded(4);
  for (let i = 0; i < 400; i++) {
    const t = rollAmmoDrop(0, { onField: 0, stageDrops: 0, killsSinceDrop: 9 }, rng);
    if (t) assert.ok(AMMO_DEFINITIONS.find(a => a.id === t)!.minStage === 0, `${t} not gated`);
  }
});

test("children: per-parent cap, recursion depth and global field cap", () => {
  const m = newMeta("recursive", null, 0, 0, 0);
  assert.equal(childAllowance(m, 0, 99), LIVING_LIMITS.maxChildrenPerParent);
  m.children = LIVING_LIMITS.maxChildrenPerParent; assert.equal(childAllowance(m, 0, 1), 0);
  assert.equal(childAllowance(newMeta(null, null, LIVING_LIMITS.maxRecursionDepth, 0, 0), 0, 2), 0);
  assert.equal(childAllowance(newMeta(null, null, 0, 0, 0), LIVING_LIMITS.maxActiveBubbles - 1, 2), 1);
  assert.equal(childAllowance(newMeta(null, null, 0, 0, 0), LIVING_LIMITS.maxActiveBubbles, 2), 0);
  assert.equal(canSpawnBubble(LIVING_LIMITS.maxActiveBubbles), false);
});

test("recursive split tree from one shot is finite (≤ 1+2+4) even when simulated exhaustively", () => {
  type Node = { meta: LivingMeta; type: string | null };
  const queue: Node[] = [{ meta: newMeta("recursive", null, 0, 0, 0), type: "recursive" }];
  let total = 0, guard = 0;
  while (queue.length) {
    assert.ok(++guard < 1000, "no infinite loop");
    const n = queue.shift()!; total++;
    if (n.type !== "recursive") continue;
    const k = childAllowance(n.meta, total + queue.length, 2);
    for (let i = 0; i < k; i++) { n.meta.children++; const d = n.meta.depth + 1; queue.push({ meta: newMeta(d < LIVING_LIMITS.maxRecursionDepth ? "recursive" : null, null, d, 0, 0), type: d < LIVING_LIMITS.maxRecursionDepth ? "recursive" : null }); }
  }
  assert.ok(total <= 7, `tree size ${total}`);
});

test("bonus ledger caps per chain and per stage; time cap per stage", () => {
  const l = newBonusLedger();
  assert.equal(awardBonus(l, 1, 10_000), LIVING_LIMITS.perChainBonusCap);
  assert.equal(awardBonus(l, 1, 10), 0, "chain exhausted");
  let granted = LIVING_LIMITS.perChainBonusCap;
  for (let c = 2; c < 50; c++) granted += awardBonus(l, c, 10_000);
  assert.equal(granted, LIVING_LIMITS.perStageBonusCap);
  assert.equal(awardBonus(l, 99, 500), 0);
  let t = 0; for (let i = 0; i < 20; i++) t += awardTime(l, LIVING_LIMITS.timePerPop);
  assert.equal(t, LIVING_LIMITS.timeBonusStageCap);
});

test("thunder picks at most maxThunderJumps targets in range, nearest first, excluding popping", () => {
  const cands = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, x: 100 + i * 30, y: 300 }));
  const ids = thunderTargets({ x: 100, y: 300 }, cands, new Set([1]));
  assert.deepEqual(ids, [2, 3, 4]);
  assert.deepEqual(thunderTargets({ x: 0, y: 0 }, [{ id: 1, x: 900, y: 700 }], new Set()), []);
});

test("status durations clamp to maxStatusSeconds", () => {
  assert.equal(clampStatus(0, 99), LIVING_LIMITS.maxStatusSeconds);
  assert.equal(clampStatus(2, 1), 2);
});

test("personalities are procedural, deterministic and all reachable", () => {
  assert.equal(personalityFor(17, 3), personalityFor(17, 3));
  const seen = new Set(Array.from({ length: 400 }, (_, i) => personalityFor(i, 2)));
  assert.equal(seen.size, 11);
});

test("steering is bounded for every personality; merge/divide/attract/repel behave", () => {
  const dt = 1 / 60, rng = seeded(9);
  const others: SteerBubble[] = [
    { id: 2, x: 230, y: 300, r: 18, life: 4, phase: "floating" },
    { id: 3, x: 300, y: 300, r: 25, life: 4, phase: "occupied", enemyId: 5 },
  ];
  for (const p of PERSONALITY_ORDER) {
    const b: SteerBubble = { id: 1, x: 200, y: 300, r: 18, life: 4, phase: "occupied", enemyId: 9 };
    const meta = newMeta("frost", p, 0, b.x, b.y);
    for (let i = 0; i < 600; i++) {
      const res = steer(b, meta, { dt, player: { x: 190, y: 320 }, others: [b, ...others], rng, reducedMotion: false });
      assert.ok(Number.isFinite(res.dx) && Number.isFinite(res.dy), p);
      assert.ok(Math.hypot(res.dx, res.dy) <= LIVING_LIMITS.maxSteerSpeed * dt + 1e-9, `${p} speed`);
      if (res.drain) assert.ok(res.drain.length <= 3);
    }
  }
  const glutton: SteerBubble = { id: 1, x: 215, y: 300, r: 18, life: 4, phase: "floating" };
  assert.equal(steer(glutton, newMeta("frost", "glutton", 0, 0, 0), { dt, player: { x: 0, y: 0 }, others: [glutton, ...others], rng, reducedMotion: false }).absorbId, 2, "merge");
  const big = { ...glutton, r: LIVING_LIMITS.gluttonMaxRadius };
  assert.equal(steer(big, newMeta("frost", "glutton", 0, 0, 0), { dt, player: { x: 0, y: 0 }, others: [big, ...others], rng, reducedMotion: false }).absorbId, undefined, "glutton growth capped");
  const coward: SteerBubble = { id: 1, x: 200, y: 300, r: 18, life: 4, phase: "floating" };
  assert.ok(steer(coward, newMeta("frost", "coward", 0, 0, 0), { dt, player: { x: 150, y: 300 }, others: [coward], rng, reducedMotion: false }).dx > 0, "repel");
  const lover: SteerBubble = { id: 1, x: 150, y: 300, r: 18, life: 4, phase: "floating" };
  assert.ok(steer(lover, newMeta("frost", "lover", 0, 0, 0), { dt, player: { x: 0, y: 0 }, others: [lover, ...others], rng, reducedMotion: false }).dx > 0, "attract");
  const mother = newMeta("frost", "mother", 0, 0, 0); let buds = 0;
  for (let i = 0; i < 60 * 30; i++) { const r = steer(coward, mother, { dt, player: { x: 0, y: 0 }, others: [], rng, reducedMotion: false }); if (r.bud) { buds++; mother.children++; } }
  assert.equal(buds, LIVING_LIMITS.maxChildrenPerParent, "divide capped");
  const sleeper = newMeta("frost", "sleeper", 0, 0, 0);
  assert.equal(steer(coward, sleeper, { dt, player: { x: 0, y: 0 }, others: [], rng, reducedMotion: false }).hold, true);
});
