import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VARIANT, ENEMY_VARIANTS, normalizeEnemyVariant, variantCue, variantThreatValue } from "../app/game/enemy-grammar.ts";
import { LEVELS } from "../app/game/levels.ts";

test("each existing enemy family keeps a default plus two readable mutations",()=>{
  for(const [kind,variants] of Object.entries(ENEMY_VARIANTS)){assert.equal(variants.length,3,kind);assert.ok(variants.includes(DEFAULT_VARIANT[kind as keyof typeof DEFAULT_VARIANT]));assert.ok(variants.every(variant=>variantThreatValue(kind as keyof typeof ENEMY_VARIANTS,variant)>=1))}
});

test("invalid cross-family mutations fall back to the original role",()=>{
  assert.equal(normalizeEnemyVariant("witch","paired"),"ranged");assert.equal(normalizeEnemyVariant("bat","feint"),"feint");
});

test("mutations expose warnings or closed states before changing threat",()=>{
  assert.equal(variantCue("bat","feint",2.5),"warning");assert.equal(variantCue("doll","windup",2.7),"warning");assert.equal(variantCue("eye","shy",1,80),"closed");assert.equal(variantCue("eye","shy",1,180),"idle");
});

test("authored stages use selective mutation sets rather than every mutation everywhere",()=>{
  for(const level of LEVELS)assert.ok(new Set(level.enemies.map(enemy=>enemy.variant)).size<18,level.name);
});
