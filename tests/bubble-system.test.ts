import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CHAIN_RADIUS, CHAIN_GRACE_SECONDS, PULSE_CHAIN_RADIUS, bubbleLifetimeRatio, collectChain, resolveBubbleCollisions, type ChainableBubble } from "../app/game/bubble-system.ts";

const bubble=(id:number,x:number,phase="occupied"):ChainableBubble=>({id,x,y:200,vx:0,vy:0,r:25,life:4,lifeMax:5,phase});

test("bubble lifetime ratio gives a stable warning input",()=>{
  assert.equal(bubbleLifetimeRatio({life:1,lifeMax:5}),.2);
  assert.equal(bubbleLifetimeRatio({life:8,lifeMax:5}),1);
  assert.equal(bubbleLifetimeRatio({life:-1,lifeMax:5}),0);
});

test("chain graph previews only connected occupied bubbles",()=>{
  const bubbles=[bubble(1,100),bubble(2,100+BASE_CHAIN_RADIUS-1),bubble(3,100+BASE_CHAIN_RADIUS*2-2),bubble(4,500),bubble(5,130,"floating")];
  assert.deepEqual(collectChain(bubbles,1),[1,2,3]);
  assert.deepEqual(collectChain(bubbles,5),[]);
  assert.ok(PULSE_CHAIN_RADIUS>BASE_CHAIN_RADIUS);
  assert.ok(CHAIN_GRACE_SECONDS>0&&CHAIN_GRACE_SECONDS<.25);
});

test("overlapping bubbles separate deterministically without explosive velocity",()=>{
  const bubbles=[bubble(2,200),bubble(1,200)];bubbles[0].vx=-20;bubbles[1].vx=20;
  resolveBubbleCollisions(bubbles);
  assert.ok(Math.hypot(bubbles[0].x-bubbles[1].x,bubbles[0].y-bubbles[1].y)>=51.9);
  assert.ok(Math.abs(bubbles[0].vx)<60&&Math.abs(bubbles[1].vx)<60);
});
