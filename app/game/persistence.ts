import type { HeroId } from "./content";
import type { EnemyConsciousness, HeroProgress } from "./progression";
import { isJukeboxChoice, isThemeId, type JukeboxChoice, type ThemeId } from "./jukebox.ts";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

/** Forbidden Expansion collection: discovery counts keyed by stable item id. */
export type PersistedCollection = {
  items:Record<string,number>;
};

/** Forbidden Expansion familiars (v7). Ids are kept as strings so newer builds' ids survive. */
export type PersistedFamiliars = {
  unlocked:string[];
  /** null = never chosen (auto-equip the first unlock); "none" = explicitly no familiar. */
  selected:string|null;
  /** false = cosmetic mode: familiars animate but never assist. */
  assists:boolean;
  bestChain:number;
};

export const SETTINGS_VERSION = 7;

export type PersistedSettings = {
  version:7;
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
  collection:PersistedCollection;
  /** Forbidden Expansion jukebox override for chamber music ("auto" = chamber default). */
  jukeboxTrack:JukeboxChoice;
  /** Forbidden Expansion visual theme (B$S Special Editions). */
  theme:ThemeId;
  familiars:PersistedFamiliars;
};

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:7,muted:false,musicVolume:.5,sfxVolume:.6,reducedMotion:false,enemyConsciousness:0,highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
  bestStageTimes:{},perfectClears:0,heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
  collection:{items:{}},
  jukeboxTrack:"auto",
  theme:"default",
  familiars:{unlocked:[],selected:null,assists:true,bestChain:0},
};

/** Keep every well-formed count (including ids from newer builds) so v5→v6 and v6→v6 are lossless. */
export function normalizeCollection(value:unknown):PersistedCollection {
  const items:Record<string,number>={};
  const raw=value&&typeof value==="object"?(value as {items?:unknown}).items:undefined;
  if(raw&&typeof raw==="object"&&!Array.isArray(raw)){
    for(const [key,count] of Object.entries(raw as Record<string,unknown>)){
      if(typeof count==="number"&&Number.isFinite(count)&&count>0)items[key]=Math.min(999999,Math.floor(count));
    }
  }
  return {items};
}

export function normalizeFamiliars(value:unknown):PersistedFamiliars {
  const raw=value&&typeof value==="object"?value as Partial<PersistedFamiliars>:{};
  const unlocked=Array.isArray(raw.unlocked)?[...new Set(raw.unlocked.filter((id):id is string=>typeof id==="string"&&id.length>0&&id.length<40))]:[];
  const selected=typeof raw.selected==="string"&&(raw.selected==="none"||unlocked.includes(raw.selected))?raw.selected:null;
  const bestChain=typeof raw.bestChain==="number"&&Number.isFinite(raw.bestChain)?Math.max(0,Math.min(999,Math.floor(raw.bestChain))):0;
  return {unlocked,selected,assists:typeof raw.assists==="boolean"?raw.assists:true,bestChain};
}

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

export function migrateSettings(input:unknown,prefersReducedMotion=false):PersistedSettings {
  const raw=input&&typeof input==="object"?input as Partial<PersistedSettings>&{volume?:number}:{};
  const selectedSkins={...DEFAULT_SKIN,...(raw.selectedSkins&&typeof raw.selectedSkins==="object"?raw.selectedSkins:{})};
  const unlockedSkins=[...new Set([...Object.values(DEFAULT_SKIN),...unique(raw.unlockedSkins,[])])];
  for(const hero of ["vesper","jade"] as HeroId[])if(!unlockedSkins.includes(selectedSkins[hero]))selectedSkins[hero]=DEFAULT_SKIN[hero];
  // v2 stored a single `volume`; split it evenly across the new music/sfx buses.
  const legacyVolume=typeof raw.volume==="number"?raw.volume:undefined;
  return {
    ...DEFAULT_SETTINGS,...raw,version:7,
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
    collection:normalizeCollection(raw.collection),
    jukeboxTrack:isJukeboxChoice(raw.jukeboxTrack)?raw.jukeboxTrack:"auto",
    theme:isThemeId(raw.theme)?raw.theme:"default",
    familiars:normalizeFamiliars(raw.familiars),
  };
}
