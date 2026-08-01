import assert from "node:assert/strict";
import test from "node:test";
import { HERO_RULES } from "../app/game/hero-rules.ts";
import { ALL_PLAYABLE_LEVELS } from "../app/game/levels.ts";
import { auditLevelReachability } from "../app/game/reachability.ts";

test("Vesper and Jade trade direct movement for bubble preparation",()=>{
  assert.ok(HERO_RULES.vesper.groundAcceleration>HERO_RULES.jade.groundAcceleration);
  assert.ok(HERO_RULES.vesper.earlyJumpInfluence>HERO_RULES.jade.earlyJumpInfluence);
  assert.ok(HERO_RULES.vesper.bubbleLaunch>HERO_RULES.jade.bubbleLaunch);
  assert.ok(HERO_RULES.jade.airAcceleration>HERO_RULES.vesper.airAcceleration);
  assert.ok(HERO_RULES.jade.bubbleLifetime>HERO_RULES.vesper.bubbleLifetime);
  assert.ok(HERO_RULES.jade.currentInfluence<HERO_RULES.vesper.currentInfluence);
});

test("both heroes retain the shared jump envelope across story, vault, and Encore rooms",()=>{
  for(const hero of Object.keys(HERO_RULES))for(const level of ALL_PLAYABLE_LEVELS){
    assert.ok(auditLevelReachability(level).every(platform=>platform.status!=="unreachable"),`${hero}: ${level.name}`);
  }
});
