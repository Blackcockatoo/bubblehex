import type { HeroId } from "./content";
import type { EnemyKind } from "./levels";

export const MAX_HERO_LEVEL = 20;
export const MAX_ENEMY_RANK = 5;
export const ENEMY_CONSCIOUSNESS_NAMES = ["RISING","DORMANT","STIRRING","VICIOUS","CURSED","NIGHTMARE"] as const;

export type EnemyConsciousness = 0 | 1 | 2 | 3 | 4 | 5;

// Player-facing difficulty presentation. These map onto the same six underlying
// consciousness values (never removed) so existing saves and the direct
// consciousness cycle keep working; "custom" is the only mode where the player
// picks the consciousness value directly.
export const DIFFICULTY_MODES = ["story", "arcade", "nightmare", "custom"] as const;
export type DifficultyMode = typeof DIFFICULTY_MODES[number];

const DIFFICULTY_MODE_CONSCIOUSNESS: Record<Exclude<DifficultyMode,"custom">, EnemyConsciousness> = {
  story: 0, arcade: 2, nightmare: 5,
};

export const DIFFICULTY_MODE_LABELS: Record<DifficultyMode, string> = {
  story: "STORY", arcade: "ARCADE", nightmare: "NIGHTMARE", custom: "CUSTOM CONSCIOUSNESS",
};

/** Resolves a difficulty mode (plus, for "custom", a directly-chosen consciousness
 * value) down to the single EnemyConsciousness the simulation actually reads. */
export function consciousnessForMode(mode: DifficultyMode, customConsciousness: EnemyConsciousness): EnemyConsciousness {
  return mode === "custom" ? customConsciousness : DIFFICULTY_MODE_CONSCIOUSNESS[mode];
}

export function isDifficultyMode(value: unknown): value is DifficultyMode {
  return typeof value === "string" && (DIFFICULTY_MODES as readonly string[]).includes(value);
}

export type DifficultyStep = { mode: DifficultyMode; consciousness: EnemyConsciousness };

/** Single-control cycle used by the Options screen's "ENEMY LEVEL" button: steps
 * through Story -> Arcade -> Nightmare -> Custom@0..5 -> back to Story. This keeps
 * the whole difficulty presentation reachable from the arcade cabinet's existing
 * button set while still letting the player land on every consciousness value
 * directly once they reach Custom. */
export function nextDifficultyStep(current: DifficultyStep): DifficultyStep {
  if (current.mode === "story") return { mode:"arcade", consciousness: consciousnessForMode("arcade", current.consciousness) };
  if (current.mode === "arcade") return { mode:"nightmare", consciousness: consciousnessForMode("nightmare", current.consciousness) };
  if (current.mode === "nightmare") return { mode:"custom", consciousness:0 };
  const next = current.consciousness + 1;
  if (next > 5) return { mode:"story", consciousness: consciousnessForMode("story", 0) };
  return { mode:"custom", consciousness: next as EnemyConsciousness };
}

export type HeroProgress = { level:number; xp:number };
export type UpgradeKey = "speed" | "rapid" | "range" | "velocity" | "shield" | "venom" | "chain" | "crown";
export type HeroMilestone = { level:number; upgrade:UpgradeKey; name:string };

export const HERO_MILESTONES:Record<HeroId,HeroMilestone[]> = {
  vesper: [
    {level:2,upgrade:"rapid",name:"Quick Spark"},
    {level:4,upgrade:"velocity",name:"Crimson Comet"},
    {level:7,upgrade:"speed",name:"Thornstep"},
    {level:10,upgrade:"shield",name:"Stage Ward"},
    {level:15,upgrade:"chain",name:"Encore Chain"},
    {level:20,upgrade:"crown",name:"Showrunner's Crown"},
  ],
  jade: [
    {level:2,upgrade:"range",name:"Glass Reach"},
    {level:4,upgrade:"venom",name:"Patient Fang"},
    {level:7,upgrade:"chain",name:"Tidal Link"},
    {level:10,upgrade:"shield",name:"Mirror Ward"},
    {level:15,upgrade:"rapid",name:"Prism Current"},
    {level:20,upgrade:"crown",name:"Archivist's Crown"},
  ],
};

export const ENEMY_RANK_NAMES = ["DORMANT","STIRRING","VICIOUS","CURSED","NIGHTMARE"] as const;

const KIND_XP:Record<EnemyKind,number> = {love:20,bat:24,eye:28,witch:32,doll:30,skull:38};

export function xpForLevel(level:number):number {
  const safe=Math.max(1,Math.min(MAX_HERO_LEVEL,Math.floor(level)));
  return safe>=MAX_HERO_LEVEL?xpForLevelUnchecked(MAX_HERO_LEVEL):xpForLevelUnchecked(safe);
}

function xpForLevelUnchecked(level:number):number {
  return 150*(level-1)*level;
}

export function levelFromXp(xp:number):number {
  const safe=Math.max(0,Number.isFinite(xp)?xp:0);
  let level=1;
  while(level<MAX_HERO_LEVEL&&safe>=xpForLevelUnchecked(level+1))level++;
  return level;
}

export function normalizeHeroProgress(value:unknown):HeroProgress {
  const raw=value&&typeof value==="object"?value as Partial<HeroProgress>:{};
  const xp=Math.max(0,typeof raw.xp==="number"&&Number.isFinite(raw.xp)?Math.floor(raw.xp):0);
  return {xp,level:levelFromXp(xp)};
}

export function progressAfterXp(progress:HeroProgress,gain:number):HeroProgress {
  return normalizeHeroProgress({xp:progress.xp+Math.max(0,Math.floor(gain))});
}

export function unlockedHeroUpgrades(hero:HeroId,level:number):UpgradeKey[] {
  return HERO_MILESTONES[hero].filter(item=>level>=item.level).map(item=>item.upgrade);
}

export function nextHeroMilestone(hero:HeroId,level:number):HeroMilestone|undefined {
  return HERO_MILESTONES[hero].find(item=>item.level>level);
}

export function enemyRankForStage(stageIndex:number,boss=false,bonus=false,consciousness:EnemyConsciousness=0):number {
  if(consciousness>0)return consciousness;
  if(bonus)return 3;
  if(boss)return MAX_ENEMY_RANK;
  return Math.min(MAX_ENEMY_RANK,1+Math.floor(Math.max(0,stageIndex)/3));
}

export function isEliteEnemy(stageIndex:number,spawnIndex:number,rank:number):boolean {
  return rank>=3&&(stageIndex+spawnIndex)%3===0;
}

export function enemyXp(kind:EnemyKind,rank:number,elite=false):number {
  return Math.round(KIND_XP[kind]*(1+(Math.max(1,rank)-1)*.35)*(elite?1.75:1));
}

export function stageClearXp(rank:number,perfect:boolean,boss=false):number {
  return 80+Math.max(1,rank)*30+(perfect?60:0)+(boss?250:0);
}
