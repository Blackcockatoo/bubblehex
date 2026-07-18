import assert from "node:assert/strict";
import test from "node:test";
import { CHECKPOINT_INTERVAL, checkpointLevelAfterClear } from "../app/game/checkpoints.ts";

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
