export type StageBreakdown = {
  kills: number;
  trapScore: number;
  releaseScore: number;
  pickupScore: number;
  chainBonus: number;
  riskScore: number;
  fullRoomBonus: number;
  speedBonus: number;
  lifeBonus: number;
  noDamageBonus: number;
  secretBonus: number;
  total: number;
};

export type StageResultInput = {
  kills: number;
  trapScore?: number;
  releaseScore?: number;
  pickupScore?: number;
  chainBonus?: number;
  riskScore?: number;
  largestChain?: number;
  enemyCount?: number;
  remainingTime: number;
  lives: number;
  noDamage: boolean;
  secretFound: boolean;
  bonusRoom: boolean;
};

export function computeStageBreakdown(input: StageResultInput): StageBreakdown {
  const trapScore = Math.max(0, input.trapScore ?? 0);
  const releaseScore = Math.max(0, input.releaseScore ?? 0);
  const pickupScore = Math.max(0, input.pickupScore ?? 0);
  const chainBonus = Math.max(0, input.chainBonus ?? 0);
  const riskScore = Math.max(0, input.riskScore ?? 0);
  const fullRoomBonus = (input.enemyCount ?? 0) > 0 && (input.largestChain ?? 0) >= (input.enemyCount ?? 0)
    ? 3000 + (input.enemyCount ?? 0) * 250
    : 0;
  const speedBonus = Math.round(Math.max(0, input.remainingTime) * 12);
  const lifeBonus = Math.max(0, input.lives) * 300;
  const noDamageBonus = input.noDamage ? 1000 : 0;
  const secretBonus = input.secretFound ? (input.bonusRoom ? 8000 : 5000) : 0;
  return {
    kills: input.kills,
    trapScore,
    releaseScore,
    pickupScore,
    chainBonus,
    riskScore,
    fullRoomBonus,
    speedBonus,
    lifeBonus,
    noDamageBonus,
    secretBonus,
    total: input.kills + fullRoomBonus + speedBonus + lifeBonus + noDamageBonus + secretBonus,
  };
}

export function isNewStageRecord(previousBest: number | undefined, elapsedSeconds: number): boolean {
  return previousBest === undefined || elapsedSeconds < previousBest;
}

export function isNewCampaignRecord(previousHighScore: number, finalScore: number): boolean {
  return finalScore > previousHighScore;
}
