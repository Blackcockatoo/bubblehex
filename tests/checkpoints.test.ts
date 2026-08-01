import assert from "node:assert/strict";
import test from "node:test";
import { CHECKPOINT_INTERVAL, checkpointLevelAfterClear, cloneRuntimeCheckpoint, createRuntimeCheckpoint } from "../app/game/checkpoints.ts";

test("campaign checkpoints occur after every five canonical levels",()=>{
  assert.equal(CHECKPOINT_INTERVAL,5);
  assert.equal(checkpointLevelAfterClear(4,12),5);
  assert.equal(checkpointLevelAfterClear(9,12),10);
});

test("non-checkpoint, bonus, invalid, and final clears do not create resumes",()=>{
  assert.equal(checkpointLevelAfterClear(3,12),null);
  assert.equal(checkpointLevelAfterClear(4,12,true),null);
  assert.equal(checkpointLevelAfterClear(11,12),null);
  assert.equal(checkpointLevelAfterClear(-1,12),null);
});

test("checkpoint snapshots preserve hero, score, VENOM, upgrades and bubble effect without shared references",()=>{
  const upgrades={speed:true,rapid:false,range:true,velocity:false,shield:true,venom:false,chain:true,crown:false};
  const source=createRuntimeCheckpoint({levelIndex:5,hero:"jade",score:1234.9,venom:new Set(["V","E","V"]),upgrades,bubbleEffect:"pulse"});
  const restored=cloneRuntimeCheckpoint(source);upgrades.speed=false;source.venom.push("N");source.upgrades.range=false;
  assert.deepEqual(restored,{levelIndex:5,hero:"jade",score:1234,venom:["V","E"],upgrades:{speed:true,rapid:false,range:true,velocity:false,shield:true,venom:false,chain:true,crown:false},bubbleEffect:"pulse"});
});
