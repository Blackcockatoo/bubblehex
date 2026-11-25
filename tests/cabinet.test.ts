import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACHIEVEMENTS, CABINET_LIMITS, CABINET_SECTIONS, CABINET_STAT_KEYS, MEMORABILIA, TIER_THRESHOLDS, WARDROBE,
  cabinetTier, emptyStats, equippedWardrobe, evaluateAchievements, isWardrobeUnlocked, memorabiliaOwned,
  newRemarkClock, resetCollection, rollRemark, stepWeb, titleWalkerCap,
} from "../app/game/cabinet.ts";
import { CABINET_COPY, loreName } from "../app/game/cabinet-i18n.ts";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, migrateSettings, normalizeCabinet } from "../app/game/persistence.ts";
import { ITEM_DEFINITIONS } from "../app/game/items.ts";
import { AMMO_DEFINITIONS, PERSONALITIES } from "../app/game/living-bubbles.ts";
import { FAMILIARS } from "../app/game/familiars.ts";

const manifest = JSON.parse(readFileSync(new URL("../public/game/expansion/manifest.json", import.meta.url), "utf8")) as {assets:{id:string;category:string}[]};
const props = JSON.parse(readFileSync(new URL("../public/game/expansion/atlases/props.json", import.meta.url), "utf8")) as {frames:Record<string,unknown>};

const V5 = {
  version:5,muted:false,musicVolume:.4,sfxVolume:.6,reducedMotion:false,enemyConsciousness:1,highScore:999,secrets:2,
  selectedSkins:{vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"},unlockedSkins:["vesper-crimson-thorn","jade-glass-tide"],
  unlockedCodex:["vesper","jade","velvet-drain","vesper-crimson-thorn","jade-glass-tide"],fragments:["blueprint","dawn"],
  bestStageTimes:{blueprint:30,"sisters-dream":41,bonus:12},perfectClears:3,heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
};

test("save v8: v5, v6 and v7 saves seed the cabinet from campaign records, everything else intact", () => {
  assert.equal(SETTINGS_VERSION, 9);
  for (const version of [5, 6, 7]) {
    const extra = version >= 6 ? {collection:{items:{black_pearl:1}}, jukeboxTrack:"boss", theme:"klein"} : {};
    const fam = version >= 7 ? {familiars:{unlocked:["hex_cat"],selected:"hex_cat",assists:false,bestChain:6}} : {};
    const m = migrateSettings(JSON.parse(JSON.stringify({...V5, version, ...extra, ...fam})));
    assert.equal(m.version, 9);
    assert.deepEqual(m.cabinet.chambers.sort(), ["blueprint", "bonus", "sisters-dream"]);
    assert.deepEqual(m.cabinet.secretRooms, ["blueprint", "dawn"]);
    assert.equal(m.cabinet.counters.perfects, 3);
    assert.deepEqual(m.cabinet.achievements, []);
    assert.equal(m.highScore, 999); assert.deepEqual(m.bestStageTimes, V5.bestStageTimes); assert.deepEqual(m.fragments, V5.fragments);
    if (version >= 6) { assert.deepEqual(m.collection.items, {black_pearl:1}); assert.equal(m.theme, "klein"); }
    if (version >= 7) assert.deepEqual(m.familiars, {unlocked:["hex_cat"],selected:"hex_cat",assists:false,bestChain:6});
  }
});

test("save v8 → v9 round-trips losslessly, keeping ids from newer builds", () => {
  const cabinet = {achievements:["first_pop","future_badge"],wardrobeEquipped:"future_hat",ammoSeen:["venom","future_ammo"],personalitiesSeen:["lover"],
    counters:{pops:12,futureCounter:3},chambers:["blueprint"],secretRooms:[],web:.42,titleSecret:true};
  const first = migrateSettings({...V5, version:8, cabinet});
  const second = migrateSettings(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(second, first);
  assert.deepEqual(first.cabinet, {...cabinet, themesUnlocked:first.theme === "default" ? [] : [first.theme]});
});

test("normalizeCabinet rejects garbage and clamps", () => {
  const n = normalizeCabinet({achievements:[1,"a","a",""],counters:{x:-1,y:"2",z:3.7,pops:Infinity},web:9,titleSecret:"yes",wardrobeEquipped:5,chambers:"no"});
  assert.deepEqual(n, {achievements:["a"],wardrobeEquipped:null,ammoSeen:[],personalitiesSeen:[],counters:{z:3},chambers:[],secretRooms:[],web:1,titleSecret:false,themesUnlocked:[]});
  assert.deepEqual(normalizeCabinet(null), DEFAULT_SETTINGS.cabinet);
});

test("achievements: ~20 data-driven, unique, tied to real stats, never re-awarded", () => {
  assert.ok(ACHIEVEMENTS.length >= 20 && ACHIEVEMENTS.length <= 25);
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) { assert.ok(CABINET_STAT_KEYS.includes(a.stat)); assert.ok(a.need >= 1); }
  const stats = emptyStats();
  assert.deepEqual(evaluateAchievements(stats, []), []);
  stats.pops = 1; stats.bestChain = 6;
  assert.deepEqual(evaluateAchievements(stats, []), ["first_pop", "chain_reaction", "heartbreaker"]);
  assert.deepEqual(evaluateAchievements(stats, ["first_pop", "chain_reaction", "heartbreaker"]), []);
  const all = emptyStats(); for (const k of CABINET_STAT_KEYS) all[k] = 1e6;
  assert.equal(evaluateAchievements(all, []).length, ACHIEVEMENTS.length);
});

test("wardrobe items are earned only through achievements, and only drawn when earned", () => {
  for (const w of WARDROBE) assert.equal(ACHIEVEMENTS.find(a => a.id === w.unlockedBy)?.reward, w.id);
  for (const a of ACHIEVEMENTS.filter(a => a.reward)) assert.ok(WARDROBE.some(w => w.id === a.reward));
  assert.equal(isWardrobeUnlocked("crown", []), false);
  assert.equal(isWardrobeUnlocked("crown", ["heartbreaker"]), true);
  assert.equal(equippedWardrobe({wardrobeEquipped:"crown",achievements:[]}), undefined);
  assert.equal(equippedWardrobe({wardrobeEquipped:"crown",achievements:["heartbreaker"]})?.id, "crown");
  assert.equal(equippedWardrobe({wardrobeEquipped:"future_hat",achievements:["heartbreaker"]}), undefined);
});

test("memorabilia use pack props and unlock from stats", () => {
  for (const m of MEMORABILIA) { assert.ok(props.frames[m.prop], m.prop); assert.ok(manifest.assets.some(a => a.id === m.prop && a.category === "props")); }
  const s = emptyStats(); assert.equal(memorabiliaOwned(MEMORABILIA[0], s), false);
  s.titleSecret = 1; assert.equal(memorabiliaOwned(MEMORABILIA[0], s), true);
});

test("living cabinet tiers, walker cap and web growth are bounded", () => {
  assert.equal(cabinetTier(0), 0); assert.equal(cabinetTier(TIER_THRESHOLDS[0]), 1); assert.equal(cabinetTier(999), TIER_THRESHOLDS.length);
  assert.ok(TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1] <= ACHIEVEMENTS.length);
  assert.equal(titleWalkerCap(0), 3); assert.equal(titleWalkerCap(2), 6);
  assert.equal(stepWeb(0, -5), 0); assert.equal(stepWeb(0.99, 999), 1);
  assert.ok(Math.abs(stepWeb(0, CABINET_LIMITS.webSeconds / 2) - 0.5) < 1e-9);
});

test("the Widow's remarks are throttled: stage gap, time gap, session cap, never in attract", () => {
  const clock = newRemarkClock();
  assert.equal(rollRemark(clock, 1000, () => 0), false); // first transition: needs 2 stages
  assert.equal(rollRemark(clock, 1000, () => 0), true);
  assert.equal(rollRemark(clock, 1001, () => 0), false); assert.equal(rollRemark(clock, 1002, () => 0), false); // too soon
  assert.equal(rollRemark(clock, 2000, () => 0.99), false); // chance
  assert.equal(rollRemark(clock, 2000, () => 0, true), false); // attract
  let shown = 1, t = 3000;
  for (let i = 0; i < 100; i++) { t += 100; if (rollRemark(clock, t, () => 0)) shown++; }
  assert.equal(shown, CABINET_LIMITS.remarkMaxPerSession);
});

test("collection reset erases the expansion collection only and keeps campaign records", () => {
  const s = migrateSettings({...V5, version:8, collection:{items:{black_pearl:3}}, jukeboxTrack:"boss", theme:"klein",
    familiars:{unlocked:["hex_cat"],selected:"hex_cat",assists:false,bestChain:9},
    cabinet:{achievements:["first_pop"],wardrobeEquipped:"crown",ammoSeen:["venom"],personalitiesSeen:["lover"],counters:{pops:4},chambers:["blueprint"],secretRooms:["blueprint"],web:1,titleSecret:true}});
  resetCollection(s);
  assert.deepEqual(s.collection, {items:{}});
  assert.deepEqual(s.familiars, {unlocked:[],selected:null,assists:false,bestChain:0});
  assert.deepEqual(s.cabinet, DEFAULT_SETTINGS.cabinet);
  assert.equal(s.jukeboxTrack, "auto"); assert.equal(s.theme, "default");
  assert.equal(s.highScore, 999); assert.deepEqual(s.bestStageTimes, V5.bestStageTimes); assert.deepEqual(s.fragments, V5.fragments);
  assert.deepEqual(migrateSettings(JSON.parse(JSON.stringify(s))), s);
});

test("cabinet copy is complete in en / ja / hi, with ja/hi lore names back-filled", () => {
  for (const lang of ["en", "ja", "hi"] as const) {
    const c = CABINET_COPY[lang];
    for (const sec of CABINET_SECTIONS) { assert.ok(c.sections[sec]); assert.ok(c.sectionsShort[sec]); }
    for (const a of ACHIEVEMENTS) { assert.ok(c.achievements[a.id], `${lang} ${a.id}`); assert.ok(c.stat[a.stat](a.need)); }
    for (const w of WARDROBE) assert.ok(c.wardrobe[w.id]);
    for (const m of MEMORABILIA) assert.equal(c.memorabilia[m.id].length, 2);
    assert.equal(c.remarks.length, CABINET_COPY.en.remarks.length);
    assert.equal(c.resetBody.length, 4);
    if (lang === "en") continue;
    assert.notEqual(c.title, CABINET_COPY.en.title);
    for (const item of ITEM_DEFINITIONS) assert.notEqual(loreName(lang, item.id, item.name), item.name, `${lang} ${item.id}`);
    for (const a of AMMO_DEFINITIONS) assert.notEqual(loreName(lang, `ammo:${a.id}`, a.name), a.name);
    for (const p of PERSONALITIES) assert.notEqual(loreName(lang, `p:${p.id}`, p.name), p.name);
    for (const f of FAMILIARS) assert.notEqual(loreName(lang, f.id, f.name), f.name);
  }
  assert.equal(loreName("en", "poison_apple", "Poison Apple"), "Poison Apple");
  assert.equal(loreName("ja", "unknown", "Fallback"), "Fallback");
});
