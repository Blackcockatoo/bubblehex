/**
 * Campaign map progression.
 *
 * The chamber map lets a player revisit any chamber they have already opened.
 * A chamber is "open" when it is the first one, or when the chamber before it
 * has been cleared at least once on this device. Clears are persisted, so the
 * map survives a reload.
 *
 * Original Hex (the unforgiving mode) deliberately ignores all of this: it
 * always starts at chamber one and never grants a resume.
 */

export type CampaignMode = "chronicle" | "original";

/** Sorted, de-duplicated, in-range list of cleared chamber indices. */
export function normalizeClearedStages(value: unknown, totalLevels: number): number[] {
  if (!Array.isArray(value) || !Number.isInteger(totalLevels) || totalLevels <= 0) return [];
  const seen = new Set<number>();
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isInteger(entry)) continue;
    if (entry < 0 || entry >= totalLevels) continue;
    seen.add(entry);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Highest chamber index the player may jump straight to from the map. */
export function highestUnlockedLevel(cleared: readonly number[], totalLevels: number): number {
  if (!Number.isInteger(totalLevels) || totalLevels <= 0) return 0;
  let unlocked = 0;
  for (const index of cleared) {
    if (!Number.isInteger(index) || index < 0 || index >= totalLevels) continue;
    unlocked = Math.max(unlocked, Math.min(totalLevels - 1, index + 1));
  }
  return unlocked;
}

export function isLevelUnlocked(index: number, cleared: readonly number[], totalLevels: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= totalLevels) return false;
  return index <= highestUnlockedLevel(cleared, totalLevels);
}

/** Adds a clear, returning a new normalized list (the input is never mutated). */
export function withClearedStage(cleared: readonly number[], index: number, totalLevels: number): number[] {
  return normalizeClearedStages([...cleared, index], totalLevels);
}

/** 0–100, rounded, for the map header. */
export function campaignCompletion(cleared: readonly number[], totalLevels: number): number {
  if (!Number.isInteger(totalLevels) || totalLevels <= 0) return 0;
  const valid = normalizeClearedStages([...cleared], totalLevels);
  return Math.round((valid.length / totalLevels) * 100);
}

/**
 * Original Hex tuning. The mode keeps the same chambers but removes every
 * safety net: no chamber map, no checkpoint resume, no carried-over mastery
 * perks, less time on the clock and angrier enemies. Losing the last life
 * sends you back to chamber one.
 */
export const ORIGINAL_MODE = {
  lives: 3,
  /** Stage timers are cut to this fraction of their chronicle length. */
  timeScale: 0.82,
  /** Added on top of the normal stage threat rank (still capped at 5). */
  rankBoost: 1,
  /** Score multiplier applied to every point earned in the mode. */
  scoreMultiplier: 1.5,
} as const;

export function originalStageTime(baseTime: number): number {
  return Math.max(30, Math.round(baseTime * ORIGINAL_MODE.timeScale));
}

export function modeLabel(mode: CampaignMode): string {
  return mode === "original" ? "ORIGINAL HEX" : "CHRONICLE";
}
