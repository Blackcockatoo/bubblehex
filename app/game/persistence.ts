import type { HeroId } from "./content";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

export type PersistedSettings = {
  version:2;
  muted:boolean;
  volume:number;
  reducedMotion:boolean;
  highScore:number;
  secrets:number;
  selectedSkins:Record<HeroId,string>;
  unlockedSkins:string[];
  unlockedCodex:string[];
  fragments:string[];
};

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:2,muted:false,volume:.42,reducedMotion:false,highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
};

const unique=(values:unknown,fallback:string[])=>Array.isArray(values)?[...new Set(values.filter((item):item is string=>typeof item==="string"))]:[...fallback];

export function migrateSettings(input:unknown,prefersReducedMotion=false):PersistedSettings {
  const raw=input&&typeof input==="object"?input as Partial<PersistedSettings>:{};
  const selectedSkins={...DEFAULT_SKIN,...(raw.selectedSkins&&typeof raw.selectedSkins==="object"?raw.selectedSkins:{})};
  const unlockedSkins=[...new Set([...Object.values(DEFAULT_SKIN),...unique(raw.unlockedSkins,[])])];
  for(const hero of ["vesper","jade"] as HeroId[])if(!unlockedSkins.includes(selectedSkins[hero]))selectedSkins[hero]=DEFAULT_SKIN[hero];
  return {
    ...DEFAULT_SETTINGS,...raw,version:2,
    muted:typeof raw.muted==="boolean"?raw.muted:DEFAULT_SETTINGS.muted,
    volume:typeof raw.volume==="number"?Math.max(0,Math.min(1,raw.volume)):DEFAULT_SETTINGS.volume,
    reducedMotion:prefersReducedMotion||(typeof raw.reducedMotion==="boolean"?raw.reducedMotion:false),
    highScore:typeof raw.highScore==="number"?Math.max(0,raw.highScore):0,
    secrets:typeof raw.secrets==="number"?Math.max(0,raw.secrets):0,
    selectedSkins,unlockedSkins,
    unlockedCodex:[...new Set([...DEFAULT_SETTINGS.unlockedCodex,...unique(raw.unlockedCodex,[])])],
    fragments:unique(raw.fragments,[]),
  };
}
