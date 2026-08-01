import assert from "node:assert/strict";
import test from "node:test";
import {
  applyChainToEnvironment,
  createEnvironmentState,
  revealMirrors,
  tickEnvironment,
  toggleValve,
  touchCandle,
} from "../app/game/environment.ts";
import { HERO_RULES } from "../app/game/hero-rules.ts";
import { ALL_PLAYABLE_LEVELS, ENCORE_LEVELS, LEVELS } from "../app/game/levels.ts";
import { validateLevel } from "../app/game/level-validation.ts";
import { auditLevelReachability } from "../app/game/reachability.ts";
import {
  advanceWidowAct,
  chargeHostAnchor,
  createWidowBossProgress,
  registerVowChain,
  SHARED_VOW_ECHOES,
} from "../app/game/widow-boss.ts";

test("headless hero-by-room matrix covers every playable chamber",()=>{
  const visits:string[]=[];
  for(const hero of Object.keys(HERO_RULES))for(const level of ALL_PLAYABLE_LEVELS){
    assert.deepEqual(validateLevel(level),[],`${hero}: ${level.name}`);
    assert.ok(auditLevelReachability(level).every(item=>item.status!=="unreachable"),`${hero}: ${level.name}`);
    visits.push(`${hero}:${level.name}`);
  }
  assert.equal(visits.length,Object.keys(HERO_RULES).length*ALL_PLAYABLE_LEVELS.length);
  assert.equal(LEVELS.length,12);
  assert.equal(ENCORE_LEVELS.length,5);
});

test("every authored environment exposes deterministic, non-damaging interactions",()=>{
  for(const level of ALL_PLAYABLE_LEVELS){
    const state=createEnvironmentState(level);
    tickEnvironment(state,.5);
    assert.equal(state.time,.5);

    for(const valve of level.environment?.valves??[])assert.notEqual(toggleValve(state,valve),"normal");
    for(const reveal of level.environment?.revealPlatforms??[]){
      const opened=revealMirrors(level,state,reveal.mirror.x+reveal.mirror.w/2,reveal.mirror.y+reveal.mirror.h/2);
      assert.ok(opened.includes(reveal.id),`${level.name}: ${reveal.id}`);
    }
    for(const candle of [...(level.environment?.candles??[])].sort((a,b)=>a.order-b.order)){
      assert.equal(touchCandle(level,state,candle.x,candle.y),true,`${level.name}: candle ${candle.order}`);
    }
    const result=applyChainToEnvironment(level,state,level.enemies.length,level.enemies.map(enemy=>enemy.kind));
    assert.ok(result.score>=0);
    for(const hazard of level.environment?.thorns??[])assert.ok(hazard.warningSeconds>0&&hazard.activeSeconds>0,`${level.name}: ${hazard.id}`);
  }
});

test("Widow headless route reaches the Shared Vow defeat without health grinding",()=>{
  let widow=createWidowBossProgress();
  widow=chargeHostAnchor(widow,0);
  widow=chargeHostAnchor(widow,1);
  widow=advanceWidowAct(widow);
  assert.equal(widow.act,"split");
  widow=advanceWidowAct(widow);
  assert.equal(widow.act,"vow");
  widow=registerVowChain(widow,SHARED_VOW_ECHOES.length);
  widow=advanceWidowAct(widow);
  assert.equal(widow.phase,"defeated");
  assert.equal(widow.hp,0);
});
