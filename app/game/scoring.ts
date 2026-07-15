export type StageBreakdown = {
  kills: number;
  speedBonus: number;
  lifeBonus: number;
  noDamageBonus: number;
  secretBonus: number;
  total: number;
};

export type StageResultInput = {
  kills: number;
  remainingTime: number;
  lives: number;
  noDamage: boolean;
  secretFound: boolean;
  bonusRoom: boolean;
};

export function computeStageBreakdown(input: StageResultInput): StageBreakdown {
  const speedBonus = Math.round(Math.max(0, input.remainingTime) * 12);
  const lifeBonus = Math.max(0, input.lives) * 300;
  const noDamageBonus = input.noDamage ? 1000 : 0;
  const secretBonus = input.secretFound ? (input.bonusRoom ? 8000 : 5000) : 0;
  return { kills: input.kills, speedBonus, lifeBonus, noDamageBonus, secretBonus, total: input.kills + speedBonus + lifeBonus + noDamageBonus + secretBonus };
}

export function isNewStageRecord(previousBest: number | undefined, elapsedSeconds: number): boolean {
  return previousBest === undefined || elapsedSeconds < previousBest;
}

export function isNewCampaignRecord(previousHighScore: number, finalScore: number): boolean {
  return finalScore > previousHighScore;
}
