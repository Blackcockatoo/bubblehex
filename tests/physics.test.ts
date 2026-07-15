import test from "node:test";
import assert from "node:assert/strict";
import {
  DOUBLE_JUMP_MULTIPLIER,
  GRAVITY,
  JUMP_VELOCITY,
  TARGET_JUMP_HEIGHT,
  TIME_TO_APEX,
  theoreticalDoubleJumpHeight,
  theoreticalJumpHeight,
} from "../app/game/physics.ts";

test("jump constants are derived from the authored platform scale", () => {
  assert.ok(Math.abs(theoreticalJumpHeight() - TARGET_JUMP_HEIGHT) < 0.001);
  assert.ok(Math.abs(-JUMP_VELOCITY / GRAVITY - TIME_TO_APEX) < 0.001);
  assert.ok(TARGET_JUMP_HEIGHT >= 150 && TARGET_JUMP_HEIGHT <= 152);
});

test("the recovery jump is weaker but makes the full level range reachable", () => {
  const secondJumpOnly = theoreticalJumpHeight(JUMP_VELOCITY * DOUBLE_JUMP_MULTIPLIER);
  assert.ok(secondJumpOnly < TARGET_JUMP_HEIGHT);
  assert.ok(theoreticalDoubleJumpHeight() > 270);
});

test("fixed-step simulation holds its apex across display frame rates", () => {
  const simulate = (displayHz:number) => {
    let y=0, velocity=JUMP_VELOCITY, accumulator=0, minimum=0;
    const displayStep=1/displayHz, fixed=1/60;
    for(let elapsed=0;elapsed<1;elapsed+=displayStep){
      accumulator+=displayStep;
      while(accumulator>=fixed){velocity+=GRAVITY*fixed;y+=velocity*fixed;minimum=Math.min(minimum,y);accumulator-=fixed;}
    }
    return -minimum;
  };
  const heights=[30,60,120].map(simulate);
  assert.ok(Math.max(...heights)-Math.min(...heights)<0.01);
  assert.ok(heights[0]>140);
});
