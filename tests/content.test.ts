import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { LEVELS } from "../app/game/levels.ts";
import {
  ART_MANIFEST, CHARACTER_PROFILES, CODEX_ENTRIES, DEFAULT_SKIN, ENEMIES, HEROES,
  SKINS, STORY_FRAGMENTS, WORLD_PROFILES, WORLDS,
} from "../app/game/content.ts";
import { migrateSettings } from "../app/game/persistence.ts";
import {
  enemyRankForStage, enemyXp, levelFromXp, progressAfterXp, unlockedHeroUpgrades, xpForLevel,
} from "../app/game/progression.ts";

test("canon covers the complete playable roster and world progression",()=>{
  for(const id of [...HEROES,...ENEMIES,"widow"] as const)assert.equal(CHARACTER_PROFILES[id].id,id);
  for(const id of WORLDS)assert.equal(WORLD_PROFILES[id].id,id);
  assert.equal(new Set(Object.keys(CHARACTER_PROFILES)).size,9);
  assert.equal(new Set(Object.keys(WORLD_PROFILES)).size,5);
});

test("twelve fragments are chronological and mapped one-to-one to chambers",()=>{
  assert.equal(STORY_FRAGMENTS.length,12);
  assert.deepEqual(STORY_FRAGMENTS.map(fragment=>fragment.order),Array.from({length:12},(_,index)=>index+1));
  assert.equal(new Set(STORY_FRAGMENTS.map(fragment=>fragment.id)).size,12);
  assert.deepEqual(LEVELS.map(level=>level.loreFragmentId),STORY_FRAGMENTS.map(fragment=>fragment.id));
  for(const level of LEVELS)assert.equal(level.worldId,STORY_FRAGMENTS.find(fragment=>fragment.id===level.loreFragmentId)?.worldId);
});

test("skin ownership, defaults, and unlock routes are complete",()=>{
  assert.equal(SKINS.length,4);
  for(const hero of HEROES){
    const skins=SKINS.filter(skin=>skin.heroId===hero);
    assert.equal(skins.length,2);
    assert.ok(skins.some(skin=>skin.id===DEFAULT_SKIN[hero]&&skin.unlock==="default"));
    assert.ok(skins.some(skin=>skin.unlock==="clear-velvet-drain"));
  }
  assert.equal(new Set(SKINS.map(skin=>skin.id)).size,SKINS.length);
});

test("codex contains no orphan unlock references",()=>{
  const valid=new Set([...Object.keys(CHARACTER_PROFILES),...Object.keys(WORLD_PROFILES),...STORY_FRAGMENTS.map(fragment=>fragment.id),...SKINS.map(skin=>skin.id)]);
  assert.equal(new Set(CODEX_ENTRIES.map(entry=>entry.id)).size,CODEX_ENTRIES.length);
  for(const entry of CODEX_ENTRIES)assert.ok(valid.has(entry.unlockId),`orphan codex entry ${entry.id}`);
});

test("art manifest points at real PNGs with declared dimensions",()=>{
  for(const asset of Object.values(ART_MANIFEST)){
    const bytes=readFileSync(join(process.cwd(),"public",asset.src.replace(/^\//,"")));
    assert.equal(bytes.toString("ascii",1,4),"PNG");
    assert.equal(bytes.readUInt32BE(16),asset.width,`${asset.id} width`);
    assert.equal(bytes.readUInt32BE(20),asset.height,`${asset.id} height`);
  }
});

test("legacy settings migrate to v6 without losing preferences, records, mastery, or adaptive enemy consciousness",()=>{
  const settings=migrateSettings({muted:true,volume:.7,reducedMotion:true,highScore:108000,secrets:3});
  assert.equal(settings.version,6);assert.equal(settings.muted,true);assert.equal(settings.reducedMotion,true);assert.equal(settings.enemyConsciousness,0);
  assert.equal(settings.musicVolume,.7);assert.equal(settings.sfxVolume,.7);
  assert.equal(settings.highScore,108000);assert.equal(settings.secrets,3);assert.deepEqual(settings.selectedSkins,DEFAULT_SKIN);
  assert.ok(Object.values(DEFAULT_SKIN).every(id=>settings.unlockedSkins.includes(id)));
  assert.deepEqual(settings.bestStageTimes,{});assert.equal(settings.perfectClears,0);
  assert.deepEqual(settings.heroProgress,{vesper:{level:1,xp:0},jade:{level:1,xp:0}});
  assert.deepEqual(settings.leaderboard,[]);
});

test("v4 settings preserve independent music/sfx volumes and best-time records",()=>{
  const settings=migrateSettings({version:4,musicVolume:.3,sfxVolume:.9,bestStageTimes:{blueprint:41.2,bogus:-3},perfectClears:2});
  assert.equal(settings.musicVolume,.3);assert.equal(settings.sfxVolume,.9);
  assert.deepEqual(settings.bestStageTimes,{blueprint:41.2});assert.equal(settings.perfectClears,2);
});

test("enemy consciousness is validated and can override the campaign threat rank",()=>{
  assert.equal(migrateSettings({version:5,enemyConsciousness:4}).enemyConsciousness,4);
  assert.equal(migrateSettings({version:5,enemyConsciousness:99}).enemyConsciousness,0);
  assert.equal(enemyRankForStage(0,false,false,5),5);
  assert.equal(enemyRankForStage(11,true,false,1),1);
});

test("leaderboard entries are sorted, capped at 10, and sanitized",()=>{
  const many=Array.from({length:12},(_,i)=>({name:`p${i}`,score:i*100}));
  const settings=migrateSettings({leaderboard:[...many,{name:"bad",score:"oops"},{score:500}]});
  assert.equal(settings.leaderboard.length,10);
  assert.equal(settings.leaderboard[0].score,1100);
  assert.ok(settings.leaderboard.every((entry,i)=>i===0||entry.score<=settings.leaderboard[i-1].score));
  assert.equal(settings.leaderboard[0].name,"P11");
});

test("invalid selected skins fall back while valid unlocks persist",()=>{
  const settings=migrateSettings({selectedSkins:{vesper:"missing",jade:"jade-poison-current"},unlockedSkins:["jade-poison-current"],unlockedCodex:["dawn"],fragments:["dawn"]});
  assert.equal(settings.selectedSkins.vesper,DEFAULT_SKIN.vesper);assert.equal(settings.selectedSkins.jade,"jade-poison-current");
  assert.ok(settings.unlockedCodex.includes("dawn"));assert.deepEqual(settings.fragments,["dawn"]);
});

test("hero mastery has deterministic thresholds and distinct milestone perks",()=>{
  assert.equal(levelFromXp(0),1);
  assert.equal(levelFromXp(xpForLevel(2)),2);
  assert.equal(levelFromXp(xpForLevel(20)+999999),20);
  const raised=progressAfterXp({level:1,xp:0},xpForLevel(4));
  assert.deepEqual(raised,{level:4,xp:xpForLevel(4)});
  assert.deepEqual(unlockedHeroUpgrades("vesper",4),["rapid","velocity"]);
  assert.deepEqual(unlockedHeroUpgrades("jade",4),["range","venom"]);
});

test("enemy threat ranks rise across the campaign and reward dangerous echoes",()=>{
  assert.deepEqual(Array.from({length:12},(_,index)=>enemyRankForStage(index)),[
    1,1,1,2,2,2,3,3,3,4,4,4,
  ]);
  assert.equal(enemyRankForStage(11,true),5);
  assert.equal(enemyRankForStage(2,false,true),3);
  assert.ok(enemyXp("skull",5,true)>enemyXp("skull",1,false));
});
