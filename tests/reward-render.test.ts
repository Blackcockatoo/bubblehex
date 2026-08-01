import assert from "node:assert/strict";
import test from "node:test";
import { rewardSpawnScale } from "../app/game/reward-render.ts";

test("timed reward spawn scale stays bounded",()=>{
  assert.equal(rewardSpawnScale(10,10),.4);
  assert.equal(rewardSpawnScale(9.78,10),1);
  assert.equal(rewardSpawnScale(0,10),1);
});

test("long-lived risk pickup never creates a runaway canvas transform",()=>{
  const samples=[999,998.95,998.78,900,0].map(life=>rewardSpawnScale(life,999));
  assert.ok(samples.every(scale=>scale>=.4&&scale<=1));
  assert.equal(samples[0],.4);
  assert.equal(samples.at(-1),1);
});
