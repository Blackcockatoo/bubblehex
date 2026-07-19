import assert from "node:assert/strict";
import test from "node:test";
import { createRng, deriveSeed, pickDistinct, scopedRng, shuffled } from "../app/game/run-rng.ts";

test("the same seed always produces the same sequence", () => {
  const a = createRng(1234); const b = createRng(1234);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test("different seeds diverge", () => {
  const a = createRng(1); const b = createRng(2);
  assert.notEqual(a(), b());
});

test("string seeds hash deterministically to the same numeric seed", () => {
  assert.equal(deriveSeed("run-seed", 1, "x"), deriveSeed("run-seed", 1, "x"));
  assert.notEqual(deriveSeed("run-seed", 1, "x"), deriveSeed("run-seed", 2, "x"));
});

test("scopedRng is deterministic per (seed, context) and independent of other rng consumption", () => {
  const first = scopedRng("seed-a", "hex-card-offer", 4);
  const second = scopedRng("seed-a", "hex-card-offer", 4);
  assert.deepEqual(Array.from({ length: 5 }, () => first()), Array.from({ length: 5 }, () => second()));
});

test("shuffled never mutates its input and preserves multiset membership", () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffled(input, createRng(9));
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test("pickDistinct returns unique items and is deterministic for a fixed rng seed", () => {
  const items = ["a", "b", "c", "d", "e"];
  const pickA = pickDistinct(items, 3, createRng(42));
  const pickB = pickDistinct(items, 3, createRng(42));
  assert.equal(pickA.length, 3);
  assert.equal(new Set(pickA).size, 3);
  assert.deepEqual(pickA, pickB);
});

test("pickDistinct clamps count to the available pool size", () => {
  assert.equal(pickDistinct(["only-one"], 3, createRng(1)).length, 1);
  assert.equal(pickDistinct([], 3, createRng(1)).length, 0);
});
