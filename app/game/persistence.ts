import type { HeroId, WorldId } from "./content";
import type { EnemyConsciousness, HeroProgress } from "./progression";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

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
  bestChamberScores:Record<string,number>;
  bestChains:Record<string,number>;
  perfectClears:number;
  storyClears:number;
  encoreMedals:Partial<Record<WorldId,EncoreMedal[]>>;
  heroProgress:Record<HeroId,HeroProgress>;
};

export type EncoreMedal = "clear" | "noDamage" | "targetScore" | "fullChain";

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:6,muted:false,musicVolume:.5,sfxVolume:.6,reducedMotion:false,enemyConsciousness:0,highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
  bestStageTimes:{},bestChamberScores:{},bestChains:{},perfectClears:0,storyClears:0,encoreMedals:{},
  heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
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
const ENCORE_MEDALS = new Set<EncoreMedal>(["clear","noDamage","targetScore","fullChain"]);
const WORLD_IDS:WorldId[]=["velvet-drain","heartbreak-hotel","jade-garden","crimson-chapel","black-bubble"];
const normalizeEncoreMedals=(value:unknown):Partial<Record<WorldId,EncoreMedal[]>>=>{
  if(!value||typeof value!=="object")return{};
  const raw=value as Record<string,unknown>,out:Partial<Record<WorldId,EncoreMedal[]>>={};
  for(const worldId of WORLD_IDS){
    const entries=raw[worldId];
    if(Array.isArray(entries))out[worldId]=[...new Set(entries.filter((entry):entry is EncoreMedal=>typeof entry==="string"&&ENCORE_MEDALS.has(entry as EncoreMedal)))];
  }
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
  const bestStageTimes=positiveRecord(raw.bestStageTimes);
  const legacyStoryClear=bestStageTimes.dawn!==undefined||unique(raw.fragments,[]).includes("dawn")||unique(raw.unlockedCodex,[]).includes("dawn");
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
    bestStageTimes,
    bestChamberScores:positiveRecord(raw.bestChamberScores),
    bestChains:positiveRecord(raw.bestChains),
    perfectClears:typeof raw.perfectClears==="number"?Math.max(0,raw.perfectClears):0,
    storyClears:typeof raw.storyClears==="number"?Math.max(0,Math.floor(raw.storyClears)):legacyStoryClear?1:0,
    encoreMedals:normalizeEncoreMedals(raw.encoreMedals),
    heroProgress:{vesper:normalizePersistedHeroProgress(raw.heroProgress?.vesper),jade:normalizePersistedHeroProgress(raw.heroProgress?.jade)},
  };
}
