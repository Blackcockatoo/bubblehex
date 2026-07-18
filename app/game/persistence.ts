import type { HeroId } from "./content";
import { normalizeHeroProgress, type HeroProgress } from "./progression";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

export type PersistedSettings = {
  version:4;
  muted:boolean;
  musicVolume:number;
  sfxVolume:number;
  reducedMotion:boolean;
  highScore:number;
  secrets:number;
  selectedSkins:Record<HeroId,string>;
  unlockedSkins:string[];
  unlockedCodex:string[];
  fragments:string[];
  bestStageTimes:Record<string,number>;
  perfectClears:number;
  heroProgress:Record<HeroId,HeroProgress>;
};

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:4,muted:false,musicVolume:.5,sfxVolume:.6,reducedMotion:false,highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
  bestStageTimes:{},perfectClears:0,heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
};

const unique=(values:unknown,fallback:string[])=>Array.isArray(values)?[...new Set(values.filter((item):item is string=>typeof item==="string"))]:[...fallback];
const clampVolume=(value:unknown,fallback:number)=>typeof value==="number"?Math.max(0,Math.min(1,value)):fallback;
const positiveRecord=(value:unknown):Record<string,number>=>{
  if(!value||typeof value!=="object")return{};
  const out:Record<string,number>={};
  for(const [key,entry] of Object.entries(value as Record<string,unknown>))if(typeof entry==="number"&&entry>=0)out[key]=entry;
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
    ...DEFAULT_SETTINGS,...raw,version:4,
    muted:typeof raw.muted==="boolean"?raw.muted:DEFAULT_SETTINGS.muted,
    musicVolume:clampVolume(raw.musicVolume,legacyVolume??DEFAULT_SETTINGS.musicVolume),
    sfxVolume:clampVolume(raw.sfxVolume,legacyVolume??DEFAULT_SETTINGS.sfxVolume),
    reducedMotion:prefersReducedMotion||(typeof raw.reducedMotion==="boolean"?raw.reducedMotion:false),
    highScore:typeof raw.highScore==="number"?Math.max(0,raw.highScore):0,
    secrets:typeof raw.secrets==="number"?Math.max(0,raw.secrets):0,
    selectedSkins,unlockedSkins,
    unlockedCodex:[...new Set([...DEFAULT_SETTINGS.unlockedCodex,...unique(raw.unlockedCodex,[])])],
    fragments:unique(raw.fragments,[]),
    bestStageTimes:positiveRecord(raw.bestStageTimes),
    perfectClears:typeof raw.perfectClears==="number"?Math.max(0,raw.perfectClears):0,
    heroProgress:{vesper:normalizeHeroProgress(raw.heroProgress?.vesper),jade:normalizeHeroProgress(raw.heroProgress?.jade)},
  };
}
