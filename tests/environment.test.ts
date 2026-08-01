import assert from "node:assert/strict";
import test from "node:test";
import { activePlatforms, applyChainToEnvironment, createEnvironmentState, currentAt, thornState, tickEnvironment, toggleValve, touchCandle } from "../app/game/environment.ts";
import { LEVELS } from "../app/game/levels.ts";

test("a labelled valve predictably stops and restores its current",()=>{
  const level=LEVELS[0],state=createEnvironmentState(level),valve=level.environment!.valves![0];
  assert.notDeepEqual(currentAt(level,state,400,400),{x:0,y:0});
  assert.equal(toggleValve(state,valve),"stopped");
  assert.deepEqual(currentAt(level,state,400,400),{x:0,y:0});
  assert.equal(toggleValve(state,valve),"normal");
});

test("moving platforms are deterministic fixed-time environment state",()=>{
  const level=LEVELS[3],state=createEnvironmentState(level);
  const before=activePlatforms(level,state).at(-1)!;tickEnvironment(state,1.2);const after=activePlatforms(level,state).at(-1)!;
  assert.notEqual(before.y,after.y);assert.equal(activePlatforms(level,createEnvironmentState(level)).at(-1)!.y,before.y);
});

test("candle order and contract combinations are explicit rather than trial-and-error",()=>{
  const level=LEVELS[8],state=createEnvironmentState(level),candles=level.environment!.candles!;
  assert.equal(touchCandle(level,state,candles[1].x,candles[1].y),false);
  for(const candle of candles)assert.equal(touchCandle(level,state,candle.x,candle.y),true);
  const result=applyChainToEnvironment(level,state,2,["love","doll"]);
  assert.ok(result.opened.includes("glass-gate"));assert.ok(state.openGates.has("glass-gate"));
});

test("thorn timing always exposes a warning before the active window",()=>{
  const hazard=LEVELS[9].environment!.thorns![0];
  const states=new Set(Array.from({length:100},(_,index)=>thornState(hazard,index*hazard.period/100)));
  assert.deepEqual(states,new Set(["idle","warning","active"]));
});
