import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, migrateSettings, normalizeCollection } from "../app/game/persistence.ts";

const V5_SAVE = {
  version:5,muted:true,musicVolume:.25,sfxVolume:.8,reducedMotion:false,enemyConsciousness:3,highScore:123456,secrets:4,
  selectedSkins:{vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"},unlockedSkins:["vesper-crimson-thorn","jade-glass-tide"],
  unlockedCodex:["vesper","jade","velvet-drain","vesper-crimson-thorn","jade-glass-tide","widow","blueprint"],fragments:["blueprint","dawn"],
  bestStageTimes:{blueprint:31.5},perfectClears:6,heroProgress:{vesper:{level:5,xp:3100},jade:{level:1,xp:40}},
};

test("v5 save migrates to v6 losslessly with an empty collection", () => {
  const migrated = migrateSettings(JSON.parse(JSON.stringify(V5_SAVE)));
  assert.equal(migrated.version, 6);
  assert.equal(SETTINGS_VERSION, 6);
  const rest:Record<string,unknown> = {...migrated}; delete rest.version; delete rest.collection; delete rest.jukeboxTrack; delete rest.theme;
  const expected:Record<string,unknown> = {...V5_SAVE}; delete expected.version;
  assert.deepEqual(rest, expected);
  assert.deepEqual(migrated.collection, {items:{}});
  assert.equal(migrated.jukeboxTrack, "auto");
  assert.equal(migrated.theme, "default");
});

test("v6 collection round-trips through JSON and migration", () => {
  const first = migrateSettings({...V5_SAVE, version:6, collection:{items:{black_pearl:2,poison_apple:7}}});
  const again = migrateSettings(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(again, first);
  assert.deepEqual(again.collection.items, {black_pearl:2,poison_apple:7});
});

test("corrupted collections are sanitised without dropping valid counts", () => {
  assert.deepEqual(normalizeCollection({items:{a:3,b:-1,c:"x",d:Number.NaN,e:2.7,f:0}}), {items:{a:3,e:2}});
  assert.deepEqual(normalizeCollection("garbage"), {items:{}});
  assert.deepEqual(normalizeCollection({items:[1,2]}), {items:{}});
  assert.deepEqual(migrateSettings({collection:null}).collection, {items:{}});
});

test("default settings never share the collection object", () => {
  const a = migrateSettings(undefined), b = migrateSettings(undefined);
  a.collection.items.poison_apple = 1;
  assert.deepEqual(b.collection.items, {});
  assert.deepEqual(DEFAULT_SETTINGS.collection.items, {});
});
