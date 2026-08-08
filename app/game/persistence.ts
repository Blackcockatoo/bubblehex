import { normalizeClearedStages, type CampaignMode } from "./campaign.ts";
import type { HeroId } from "./content";
import type { EnemyConsciousness, HeroProgress } from "./progression";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

/** Canonical chamber count; kept here so persistence stays free of level data. */
export const CAMPAIGN_LEVEL_COUNT = 12;

export type PersistedSettings = {
  version:6;
  muted:boolean;
  musicVolume:number;
  sfxVolume:number;
  reducedMotion:boolean;
  enemyConsciousness:EnemyConsciousness;
  highScore:number;
  secrets:number;
  selectedSkins:Record<HeroId,string>;
  unlockedSkins:string[];
  unlockedCodex:string[];
  fragments:string[];
  bestStageTimes:Record<string,number>;
  perfectClears:number;
  heroProgress:Record<HeroId,HeroProgress>;
  /** Chamber indices cleared at least once — drives the chamber map. */
  clearedStages:number[];
  /** Last mode the player chose on the title screen. */
  campaignMode:CampaignMode;
  /** Separate record board for the unforgiving mode. */
  originalHighScore:number;
  /** Deepest chamber ever reached in Original Hex, for bragging rights. */
  originalBestStage:number;
  /** Player preference for the on-screen touch pad ("auto" follows the device). */
  touchControls:"auto"|"on"|"off";
};

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:6,muted:false,musicVolume:.5,sfxVolume:.6,reducedMotion:false,enemyConsciousness:0,highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
  bestStageTimes:{},perfectClears:0,heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
  clearedStages:[],campaignMode:"chronicle",originalHighScore:0,originalBestStage:0,touchControls:"auto",
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

const normalizeCampaignMode=(value:unknown):CampaignMode=>value==="original"?"original":"chronicle";
const normalizeTouchPreference=(value:unknown):PersistedSettings["touchControls"]=>
  value==="on"||value==="off"?value:"auto";

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
    highScore:typeof raw.highScore==="number"?Math.max(0,raw.highScore):0,
    secrets:typeof raw.secrets==="number"?Math.max(0,raw.secrets):0,
    selectedSkins,unlockedSkins,
    unlockedCodex:[...new Set([...DEFAULT_SETTINGS.unlockedCodex,...unique(raw.unlockedCodex,[])])],
    fragments:unique(raw.fragments,[]),
    bestStageTimes:positiveRecord(raw.bestStageTimes),
    perfectClears:typeof raw.perfectClears==="number"?Math.max(0,raw.perfectClears):0,
    heroProgress:{vesper:normalizePersistedHeroProgress(raw.heroProgress?.vesper),jade:normalizePersistedHeroProgress(raw.heroProgress?.jade)},
    clearedStages:normalizeClearedStages(raw.clearedStages,CAMPAIGN_LEVEL_COUNT),
    campaignMode:normalizeCampaignMode(raw.campaignMode),
    originalHighScore:typeof raw.originalHighScore==="number"?Math.max(0,raw.originalHighScore):0,
    originalBestStage:typeof raw.originalBestStage==="number"?Math.max(0,Math.min(CAMPAIGN_LEVEL_COUNT,Math.floor(raw.originalBestStage))):0,
    touchControls:normalizeTouchPreference(raw.touchControls),
  };
}
