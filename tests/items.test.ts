import test from "node:test";
import assert from "node:assert/strict";
import {
  ITEM_DEFINITIONS, ITEM_LIMITS, ITEM_REGISTRY, ItemEffectState, RARITY_BADGE, awardComboBonus, awardItemScore,
  discoveredCount, dropChance, isTimedEffect, itemById, newLedger, recordDiscovery, rollItemDrop, type DropContext,
} from "../app/game/items.ts";
import { readFileSync } from "node:fs";

const BRIEF_ITEMS = ["Poison Apple","Widow Cherries","Forbidden Perfume","Broken Heart","Serpent Ring","Widow's Key","Dead Rose","Cursed Vinyl","Black Pearl","Golden Fang","Widow's Eye","Stolen Minute","Deadly Kiss","Wicked Clover","Midnight Moth","Vanity Mirror"];
const manifest = JSON.parse(readFileSync(new URL("../public/game/expansion/manifest.json", import.meta.url), "utf8")) as {assets:{id:string;category:string}[]};
const atlas = JSON.parse(readFileSync(new URL("../public/game/expansion/atlases/items.json", import.meta.url), "utf8")) as {frames:Record<string,unknown>};
const ctx = (over:Partial<DropContext>={}):DropContext => ({levelIndex:0,lives:3,levelTime:60,boss:false,bonus:false,chain:1,enemiesLeft:4,secretFound:false,...over});
const seq = (...values:number[]) => { let i=0; return () => values[i++ % values.length]; };

test("registry covers all 16 brief items with unique ids and complete metadata", () => {
  assert.equal(ITEM_DEFINITIONS.length, 16);
  assert.equal(ITEM_REGISTRY.size, 16);
  assert.deepEqual(ITEM_DEFINITIONS.map(i => i.name), BRIEF_ITEMS);
  for (const item of ITEM_DEFINITIONS) {
    assert.ok(item.description && item.discovery, item.id);
    assert.ok(item.cue.notes.length > 0, item.id);
    assert.ok(RARITY_BADGE[item.rarity], item.id);
    assert.ok(isTimedEffect(item.effect) ? item.duration > 0 : item.duration === 0, `${item.id} duration matches effect type`);
    assert.equal(itemById(item.id), item);
  }
  assert.equal(itemById("CHERRY"), undefined, "original reward kinds are not expansion items");
});

test("every item sprite exists in the asset manifest and the items atlas", () => {
  const ids = new Set(manifest.assets.filter(a => a.category === "items").map(a => a.id));
  for (const item of ITEM_DEFINITIONS) { assert.ok(ids.has(item.sprite), item.sprite); assert.ok(atlas.frames[item.sprite], item.sprite); }
  for (const badge of Object.values(RARITY_BADGE)) assert.ok(manifest.assets.some(a => a.id === badge), badge);
});

test("discovery conditions gate situational items", () => {
  const ids = (c:DropContext) => new Set(ITEM_DEFINITIONS.filter(i => i.eligible(c)).map(i => i.id));
  assert.equal(ids(ctx()).has("broken_heart"), false);
  assert.equal(ids(ctx({lives:2})).has("broken_heart"), true);
  assert.equal(ids(ctx()).has("stolen_minute"), false);
  assert.equal(ids(ctx({levelTime:10})).has("stolen_minute"), true);
  assert.equal(ids(ctx({levelTime:10,boss:true})).has("stolen_minute"), false);
  assert.equal(ids(ctx({secretFound:true})).has("midnight_moth"), false);
  assert.equal(ids(ctx()).has("widow_cherries"), false);
  assert.equal(ids(ctx({chain:2})).has("widow_cherries"), true);
});

test("drops are bounded by field, stage and kill-spacing limits", () => {
  const always = seq(0, 0);
  const base = {onField:0,stageDrops:0,killsSinceDrop:ITEM_LIMITS.minKillsBetween,dropBoost:false};
  assert.ok(rollItemDrop(ctx(), base, always));
  assert.equal(rollItemDrop(ctx(), {...base,onField:ITEM_LIMITS.maxOnField}, always), null);
  assert.equal(rollItemDrop(ctx(), {...base,stageDrops:ITEM_LIMITS.maxPerStage}, always), null);
  assert.equal(rollItemDrop(ctx(), {...base,killsSinceDrop:ITEM_LIMITS.minKillsBetween-1}, always), null);
  assert.equal(rollItemDrop(ctx(), base, seq(.99)), null, "roll above chance drops nothing");
  assert.equal(dropChance(base), ITEM_LIMITS.baseChance);
  assert.ok(dropChance({...base,dropBoost:true}) <= ITEM_LIMITS.maxChance);
});

test("simulated stage never exceeds maxPerStage drops", () => {
  let stageDrops=0,killsSinceDrop=ITEM_LIMITS.minKillsBetween,onField=0;
  for (let kill=0; kill<500; kill++) {
    killsSinceDrop++;
    const item = rollItemDrop(ctx({chain:5,levelIndex:8,lives:1,levelTime:5}), {onField,stageDrops,killsSinceDrop,dropBoost:true}, Math.random);
    if (item) { stageDrops++; killsSinceDrop=0; onField=Math.min(ITEM_LIMITS.maxOnField,onField+1); if (kill%3===0) onField=0; }
  }
  assert.ok(stageDrops <= ITEM_LIMITS.maxPerStage);
});

test("item score and Widow Cherries bonus are capped per stage", () => {
  const ledger = newLedger();
  let total = 0;
  for (let i=0; i<10; i++) total += awardItemScore(ledger, 5000);
  assert.equal(total, ITEM_LIMITS.stageScoreCap);
  assert.equal(awardItemScore(ledger, 5000), 0);
  assert.equal(awardItemScore(newLedger(), Number.NaN), 0);
  assert.equal(awardItemScore(newLedger(), -50), 0);
  const combo = newLedger();
  assert.equal(awardComboBonus(combo, 900), 450);
  let bonus = 450;
  for (let i=0; i<100; i++) bonus += awardComboBonus(combo, 10000);
  assert.equal(bonus, ITEM_LIMITS.comboBonusCap);
});

test("timed effects refresh rather than stack, and expire", () => {
  const fx = new ItemEffectState();
  const cherries = itemById("widow_cherries")!, rose = itemById("dead_rose")!, apple = itemById("poison_apple")!;
  assert.equal(fx.apply(apple), null, "instant items do not create timers");
  fx.apply(cherries); fx.tick(5); fx.apply(cherries);
  assert.equal(fx.remaining("comboBoost"), cherries.duration);
  assert.equal(fx.size, 1);
  fx.apply(rose);
  assert.deepEqual(fx.tick(rose.duration + .01), ["slowEnemies"]);
  assert.equal(fx.has("slowEnemies"), false);
  assert.equal(fx.has("comboBoost"), true);
  fx.tick(Number.NaN); assert.equal(fx.has("comboBoost"), true);
  fx.clear(); assert.equal(fx.size, 0);
});

test("collection discovery counts and first-time flag", () => {
  const items:Record<string,number> = {legacy_future_item: 2};
  assert.deepEqual(recordDiscovery(items, "black_pearl"), {firstTime:true,count:1});
  assert.deepEqual(recordDiscovery(items, "black_pearl"), {firstTime:false,count:2});
  assert.equal(discoveredCount(items), 1, "unknown ids are kept but not counted");
});
