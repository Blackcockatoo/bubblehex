import assert from "node:assert/strict";
import test from "node:test";
import { SHARED_VOW_ECHOES, advanceWidowAct, chargeHostAnchor, createWidowBossProgress, findVowBridgeAnchor, hostAnchorsComplete, makeWidowPhaseCheckpoint, registerVowChain, splitClauseCopies } from "../app/game/widow-boss.ts";

test("Widow advances through Host, Split Clause and Shared Vow in order",()=>{
  let widow=createWidowBossProgress();
  widow=chargeHostAnchor(widow,0);assert.equal(hostAnchorsComplete(widow),false);assert.equal(widow.phase,"host");
  widow=chargeHostAnchor(widow,1);assert.equal(hostAnchorsComplete(widow),true);assert.equal(widow.phase,"staggered");
  widow=advanceWidowAct(widow);assert.equal(widow.act,"split");assert.equal(widow.phase,"chase");
  widow=advanceWidowAct(widow);assert.equal(widow.act,"vow");assert.equal(widow.phase,"vow");
  widow=registerVowChain(widow,SHARED_VOW_ECHOES.length-1);assert.equal(widow.phase,"vow");
  widow=registerVowChain(widow,SHARED_VOW_ECHOES.length);assert.equal(widow.phase,"staggered");
  widow=advanceWidowAct(widow);assert.equal(widow.phase,"defeated");assert.equal(widow.hp,0);
});

test("Split Clause always has one animation-identifiable true copy",()=>{
  for(const time of [0,.5,2,9]){const copies=splitClauseCopies(480,220,time);assert.equal(copies.length,3);assert.equal(copies.filter(copy=>copy.trueCopy).length,1);assert.deepEqual(copies.find(copy=>copy.trueCopy),{x:480,y:220,trueCopy:true})}
});

test("boss phase checkpoint preserves act, hp and score",()=>{
  const widow=advanceWidowAct(createWidowBossProgress()),checkpoint=makeWidowPhaseCheckpoint(widow,12345.9);
  assert.deepEqual(checkpoint,{act:"split",hp:2,score:12345});
});

test("Shared Vow accepts deliberate empty-bubble bridges only in its final act",()=>{
  const seed={id:1,x:315,y:450,r:29,phase:"bound"};
  const bridge={id:2,x:360,y:450,r:18,phase:"floating"};
  const host=createWidowBossProgress();
  assert.equal(findVowBridgeAnchor(host,bridge,[seed,bridge]),undefined);
  const vow=advanceWidowAct(advanceWidowAct(host));
  assert.equal(findVowBridgeAnchor(vow,bridge,[seed,bridge])?.id,seed.id);
  assert.ok(SHARED_VOW_ECHOES.slice(1).every((echo,index)=>Math.hypot(echo.x-SHARED_VOW_ECHOES[index].x,echo.y-SHARED_VOW_ECHOES[index].y)>82));
  assert.ok(SHARED_VOW_ECHOES.slice(1).every((echo,index)=>Math.hypot(echo.x-SHARED_VOW_ECHOES[index].x,echo.y-SHARED_VOW_ECHOES[index].y)<166));
});
