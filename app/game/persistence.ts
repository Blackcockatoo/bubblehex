import type { HeroId } from "./content.ts";
import { defaultChamberRecord, type CampaignRecords, type ChamberRecord } from "./campaign.ts";
import type { DifficultyMode, EnemyConsciousness, HeroProgress } from "./progression.ts";
import { isDifficultyMode } from "./progression.ts";
import { normalizeNightRun, type NightRunState } from "./run-state.ts";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

export type PersistedSettings = {
  version:6;
  muted:boolean;
  musicVolume:number;
  sfxVolume:number;
  reducedMotion:boolean;
  enemyConsciousness:EnemyConsciousness;
  difficultyMode:DifficultyMode;
  highScore:number;
  secrets:number;
  selectedSkins:Record<HeroId,string>;
  unlockedSkins:string[];
  unlockedCodex:string[];
  fragments:string[];
  bestStageTimes:Record<string,number>;
  perfectClears:number;
  heroProgress:Record<HeroId,HeroProgress>;
  campaignRecords:CampaignRecords;
  activeRun:NightRunState|null;
};

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:6,muted:false,musicVolume:.5,sfxVolume:.6,reducedMotion:false,enemyConsciousness:0,difficultyMode:"arcade",highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
  bestStageTimes:{},perfectClears:0,heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
  campaignRecords:{},activeRun:null,
};

const unique=(values:unknown,fallback:string[])=>Array.isArray(values)?[...new Set(values.filter((item):item is string=>typeof item==="string"))]:[...fallback];
const clampVolume=(value:unknown,fallback:number)=>typeof value==="number"?Math.max(0,Math.min(1,value)):fallback;
const normalizeEnemyConsciousness=(value:unknown):EnemyConsciousness=>typeof value==="number"&&Number.isInteger(value)&&value>=0&&value<=5?value as EnemyConsciousness:0;
const positiveRecord=(value:unknown):Record<string,number>=>{
  if(!value||typeof value!=="object")return{};
  const out:Record<string,number>={};
  for(const [key,entry] of Object.entries(value as Record<string,unknown>))if(typeof entry==="number"&&entry>=0)out[key]=entry;
  return out;
};
const normalizePersistedHeroProgress=(value:unknown):HeroProgress=>{
  const raw=value&&typeof value==="object"?value as Partial<HeroProgress>:{};
  const xp=Math.max(0,typeof raw.xp==="number"&&Number.isFinite(raw.xp)?Math.floor(raw.xp):0);
  let level=1;
  while(level<20&&xp>=150*level*(level+1))level++;
  return {level,xp};
};
const normalizeChamberRecord=(value:unknown):ChamberRecord=>{
  const base=defaultChamberRecord();
  if(!value||typeof value!=="object")return base;
  const raw=value as Partial<ChamberRecord>;
  return {
    cleared:typeof raw.cleared==="boolean"?raw.cleared:base.cleared,
    bestScore:typeof raw.bestScore==="number"&&raw.bestScore>=0?raw.bestScore:base.bestScore,
    bestTimeSeconds:typeof raw.bestTimeSeconds==="number"&&raw.bestTimeSeconds>=0?raw.bestTimeSeconds:base.bestTimeSeconds,
    secretFound:typeof raw.secretFound==="boolean"?raw.secretFound:base.secretFound,
    highestConsciousnessCleared:typeof raw.highestConsciousnessCleared==="number"?normalizeEnemyConsciousness(raw.highestConsciousnessCleared):base.highestConsciousnessCleared,
    bestHero:raw.bestHero==="vesper"||raw.bestHero==="jade"?raw.bestHero:base.bestHero,
    perfectClear:typeof raw.perfectClear==="boolean"?raw.perfectClear:base.perfectClear,
  };
};
const normalizeCampaignRecords=(value:unknown):CampaignRecords=>{
  if(!value||typeof value!=="object")return{};
  const out:CampaignRecords={};
  for(const [key,entry] of Object.entries(value as Record<string,unknown>))out[key]=normalizeChamberRecord(entry);
  return out;
};

export function migrateSettings(input:unknown,prefersReducedMotion=false):PersistedSettings {
  const raw=input&&typeof input==="object"?input as Partial<PersistedSettings>&{volume?:number}:{};
  const selectedSkins={...DEFAULT_SKIN,...(raw.selectedSkins&&typeof raw.selectedSkins==="object"?raw.selectedSkins:{})};
  const unlockedSkins=[...new Set([...Object.values(DEFAULT_SKIN),...unique(raw.unlockedSkins,[])])];
  for(const hero of ["vesper","jade"] as HeroId[])if(!unlockedSkins.includes(selectedSkins[hero]))selectedSkins[hero]=DEFAULT_SKIN[hero];
  // v2 stored a single `volume`; split it evenly across the new music/sfx buses.
  const legacyVolume=typeof raw.volume==="number"?raw.volume:undefined;
  return {
    ...DEFAULT_SETTINGS,...raw,version:6,
    muted:typeof raw.muted==="boolean"?raw.muted:DEFAULT_SETTINGS.muted,
    musicVolume:clampVolume(raw.musicVolume,legacyVolume??DEFAULT_SETTINGS.musicVolume),
    sfxVolume:clampVolume(raw.sfxVolume,legacyVolume??DEFAULT_SETTINGS.sfxVolume),
    reducedMotion:prefersReducedMotion||(typeof raw.reducedMotion==="boolean"?raw.reducedMotion:false),
    enemyConsciousness:normalizeEnemyConsciousness(raw.enemyConsciousness),
    // v6: difficulty presentation modes and the Night Run campaign layer. Both are
    // additive — pre-v6 saves simply had neither, so they land on safe defaults
    // (no active run, "arcade" difficulty matching the pre-v6 default consciousness).
    difficultyMode:isDifficultyMode(raw.difficultyMode)?raw.difficultyMode:DEFAULT_SETTINGS.difficultyMode,
    campaignRecords:normalizeCampaignRecords(raw.campaignRecords),
    activeRun:normalizeNightRun(raw.activeRun),
    highScore:typeof raw.highScore==="number"?Math.max(0,raw.highScore):0,
    secrets:typeof raw.secrets==="number"?Math.max(0,raw.secrets):0,
    selectedSkins,unlockedSkins,
    unlockedCodex:[...new Set([...DEFAULT_SETTINGS.unlockedCodex,...unique(raw.unlockedCodex,[])])],
    fragments:unique(raw.fragments,[]),
    bestStageTimes:positiveRecord(raw.bestStageTimes),
    perfectClears:typeof raw.perfectClears==="number"?Math.max(0,raw.perfectClears):0,
    heroProgress:{vesper:normalizePersistedHeroProgress(raw.heroProgress?.vesper),jade:normalizePersistedHeroProgress(raw.heroProgress?.jade)},
  };
}
