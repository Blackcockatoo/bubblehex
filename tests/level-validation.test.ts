import assert from "node:assert/strict";
import test from "node:test";
import { WORLDS } from "../app/game/content.ts";
import { ENCORE_LEVELS, LEVELS } from "../app/game/levels.ts";
import { validateCampaign } from "../app/game/level-validation.ts";

test("all canonical, bonus and Encore chambers pass gameplay validation",()=>{
  assert.deepEqual(validateCampaign(),[]);
});

test("every canonical chamber documents two routes, chain plans and recovery",()=>{
  for(const level of LEVELS){
    assert.equal(level.design.routes.length,2,level.name);
    assert.ok(level.design.safeChain&&level.design.advancedChain,level.name);
    assert.ok(level.design.recoveryRoute,level.name);
    assert.ok(level.design.expectedSeconds[0]<level.design.expectedSeconds[1],level.name);
  }
});

test("story-clear Encore set has one optional medal chamber per world",()=>{
  assert.equal(ENCORE_LEVELS.length,5);
  assert.deepEqual(new Set(ENCORE_LEVELS.map(level=>level.encoreId)),new Set(WORLDS));
  assert.ok(ENCORE_LEVELS.every(level=>level.encore&&level.medalTargets&&!level.boss&&!level.bonus));
});
