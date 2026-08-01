const REWARD_INTRO_SCALE = 0.4;
const REWARD_INTRO_SECONDS = 0.22;

/**
 * Keeps reward spawn animation transforms bounded for both timed drops and
 * long-lived authored pickups.
 */
export const rewardSpawnScale = (
  remainingLife: number,
  initialLife: number,
  introSeconds = REWARD_INTRO_SECONDS,
) => {
  const elapsed = Math.max(0, initialLife - remainingLife);
  const progress = Math.min(1, elapsed / Math.max(Number.EPSILON, introSeconds));
  return REWARD_INTRO_SCALE + (1 - REWARD_INTRO_SCALE) * progress;
};
