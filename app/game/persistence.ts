import type { HeroId } from "./content";
import type { EnemyConsciousness, HeroProgress, UpgradeKey } from "./progression";

const DEFAULT_SKIN:Record<HeroId,string> = {vesper:"vesper-crimson-thorn",jade:"jade-glass-tide"};

export type Checkpoint = {
  levelIndex:number;
  score:number;
  hero:HeroId;
  venom:string[];
  upgrades:Record<UpgradeKey,boolean>;
  lives:number;
};

export type LeaderboardEntry = { name:string; score:number };

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
  checkpoint:Checkpoint|null;
  leaderboard:LeaderboardEntry[];
};

export const LEADERBOARD_SIZE = 10;

export const DEFAULT_SETTINGS:PersistedSettings = {
  version:6,muted:false,musicVolume:.5,sfxVolume:.6,reducedMotion:false,enemyConsciousness:0,highScore:0,secrets:0,
  selectedSkins:{...DEFAULT_SKIN},unlockedSkins:Object.values(DEFAULT_SKIN),
  unlockedCodex:["vesper","jade","velvet-drain",...Object.values(DEFAULT_SKIN)],fragments:[],
  bestStageTimes:{},perfectClears:0,heroProgress:{vesper:{level:1,xp:0},jade:{level:1,xp:0}},
  checkpoint:null,leaderboard:[],
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
const UPGRADE_KEYS:UpgradeKey[]=["speed","rapid","range","velocity","shield","venom","chain","crown"];
const normalizeCheckpoint=(value:unknown):Checkpoint|null=>{
  if(!value||typeof value!=="object")return null;
  const raw=value as Partial<Checkpoint>;
  if(typeof raw.levelIndex!=="number"||!Number.isInteger(raw.levelIndex)||raw.levelIndex<0)return null;
  if(raw.hero!=="vesper"&&raw.hero!=="jade")return null;
  const upgrades={} as Record<UpgradeKey,boolean>;
  const rawUpgrades=raw.upgrades&&typeof raw.upgrades==="object"?raw.upgrades as Partial<Record<UpgradeKey,boolean>>:{};
  for(const key of UPGRADE_KEYS)upgrades[key]=rawUpgrades[key]===true;
  return {
    levelIndex:raw.levelIndex,
    score:typeof raw.score==="number"&&raw.score>=0?raw.score:0,
    hero:raw.hero,
    venom:unique(raw.venom,[]).filter(letter=>"VENOM".includes(letter)),
    upgrades,
    lives:typeof raw.lives==="number"&&raw.lives>0?Math.floor(raw.lives):3,
  };
};
const normalizeLeaderboard=(value:unknown):LeaderboardEntry[]=>{
  if(!Array.isArray(value))return[];
  return value
    .filter((entry):entry is LeaderboardEntry=>!!entry&&typeof entry==="object"&&typeof (entry as LeaderboardEntry).name==="string"&&typeof (entry as LeaderboardEntry).score==="number")
    .map(entry=>({name:entry.name.slice(0,3).toUpperCase(),score:Math.max(0,Math.floor(entry.score))}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,LEADERBOARD_SIZE);
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
    highScore:typeof raw.highScore==="number"?Math.max(0,raw.highScore):0,
    secrets:typeof raw.secrets==="number"?Math.max(0,raw.secrets):0,
    selectedSkins,unlockedSkins,
    unlockedCodex:[...new Set([...DEFAULT_SETTINGS.unlockedCodex,...unique(raw.unlockedCodex,[])])],
    fragments:unique(raw.fragments,[]),
    bestStageTimes:positiveRecord(raw.bestStageTimes),
    perfectClears:typeof raw.perfectClears==="number"?Math.max(0,raw.perfectClears):0,
    heroProgress:{vesper:normalizePersistedHeroProgress(raw.heroProgress?.vesper),jade:normalizePersistedHeroProgress(raw.heroProgress?.jade)},
    checkpoint:normalizeCheckpoint(raw.checkpoint),
    leaderboard:normalizeLeaderboard(raw.leaderboard),
  };
}
