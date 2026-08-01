import type { HeroId } from "./content";

export const CHECKPOINT_INTERVAL = 5;

export type CheckpointUpgrades = {
  speed:boolean;
  rapid:boolean;
  range:boolean;
  velocity:boolean;
  shield:boolean;
  venom:boolean;
  chain:boolean;
  crown:boolean;
};

export type RuntimeCheckpoint = {
  levelIndex:number;
  hero:HeroId;
  score:number;
  venom:string[];
  upgrades:CheckpointUpgrades;
  bubbleEffect?:"none"|"anchor"|"pulse"|"echo"|"venom";
};

export function createRuntimeCheckpoint(input:Omit<RuntimeCheckpoint,"venom"|"upgrades">&{venom:Iterable<string>;upgrades:CheckpointUpgrades}):RuntimeCheckpoint {
  return {levelIndex:input.levelIndex,hero:input.hero,score:Math.max(0,Math.floor(input.score)),venom:[...new Set(input.venom)],upgrades:{...input.upgrades},bubbleEffect:input.bubbleEffect??"none"};
}

export function cloneRuntimeCheckpoint(checkpoint:RuntimeCheckpoint):RuntimeCheckpoint {
  return createRuntimeCheckpoint(checkpoint);
}

/** Returns the zero-based level to resume at after clearing a checkpoint stage. */
export function checkpointLevelAfterClear(clearedLevelIndex:number,totalLevels:number,isBonus=false):number|null {
  if(isBonus||!Number.isInteger(clearedLevelIndex)||clearedLevelIndex<0||!Number.isInteger(totalLevels)||totalLevels<=0)return null;
  const clearedLevelNumber=clearedLevelIndex+1;
  if(clearedLevelNumber>=totalLevels||clearedLevelNumber%CHECKPOINT_INTERVAL!==0)return null;
  return clearedLevelNumber;
}
