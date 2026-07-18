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
};

/** Returns the zero-based level to resume at after clearing a checkpoint stage. */
export function checkpointLevelAfterClear(clearedLevelIndex:number,totalLevels:number,isBonus=false):number|null {
  if(isBonus||!Number.isInteger(clearedLevelIndex)||clearedLevelIndex<0||!Number.isInteger(totalLevels)||totalLevels<=0)return null;
  const clearedLevelNumber=clearedLevelIndex+1;
  if(clearedLevelNumber>=totalLevels||clearedLevelNumber%CHECKPOINT_INTERVAL!==0)return null;
  return clearedLevelNumber;
}
