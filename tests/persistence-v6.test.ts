import assert from "node:assert/strict";
import test from "node:test";
import { migrateSettings } from "../app/game/persistence.ts";

test("v5 saves gain Encore records without losing existing progress",()=>{
  const migrated=migrateSettings({version:5,highScore:44400,secrets:8,fragments:["blueprint"],bestStageTimes:{blueprint:31.2},perfectClears:4,heroProgress:{vesper:{level:4,xp:1900},jade:{level:2,xp:400}}});
  assert.equal(migrated.version,6);assert.equal(migrated.highScore,44400);assert.equal(migrated.secrets,8);assert.deepEqual(migrated.fragments,["blueprint"]);
  assert.equal(migrated.bestStageTimes.blueprint,31.2);assert.equal(migrated.storyClears,0);assert.deepEqual(migrated.encoreMedals,{});
});

test("a legacy final-chamber record unlocks Encore without inventing medals",()=>{
  const migrated=migrateSettings({version:5,bestStageTimes:{blueprint:31.2,dawn:92.4},highScore:78000});
  assert.equal(migrated.storyClears,1);assert.deepEqual(migrated.encoreMedals,{});assert.equal(migrated.bestStageTimes.dawn,92.4);
});

test("v6 migration sanitizes medals and personal-best records",()=>{
  const migrated=migrateSettings({version:6,storyClears:2,bestChamberScores:{blueprint:12000,bad:-1},bestChains:{blueprint:6},encoreMedals:{"velvet-drain":["clear","clear","noDamage","made-up"],unknown:["clear"]}});
  assert.equal(migrated.storyClears,2);assert.deepEqual(migrated.bestChamberScores,{blueprint:12000});assert.deepEqual(migrated.bestChains,{blueprint:6});
  assert.deepEqual(migrated.encoreMedals["velvet-drain"],["clear","noDamage"]);assert.equal((migrated.encoreMedals as Record<string,unknown>).unknown,undefined);
});
