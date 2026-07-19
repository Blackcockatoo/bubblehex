// The active Night Run: the part of a campaign playthrough that lives in progress
// between chambers, can be checkpointed, and must survive closing the browser.
import type { HeroId } from "./content.ts";
import { CAMPAIGN_CHAMBERS } from "./campaign.ts";
import { equipNewCard, isCardMaxRank, replaceCard, upgradeCard, type EquippedHexCard, type HexCardId } from "./hex-cards.ts";
import { freshRunSeed } from "./run-rng.ts";
import { normalizeHeroProgress, type DifficultyMode, type EnemyConsciousness, isDifficultyMode } from "./progression.ts";

const VENOM_LETTERS = ["V","E","N","O","M"];

export type NightRunCheckpoint = {
  atChamberIndex: number;
  hero: HeroId;
  lives: number;
  score: number;
  equippedCards: EquippedHexCard[];
  venomLetters: string[];
  secretsFoundThisRun: string[];
  heroXpAtCheckpoint: number;
};

export type NightRunState = {
  active: boolean;
  valid: boolean;
  seed: number;
  hero: HeroId;
  currentChamberIndex: number;
  lives: number;
  score: number;
  equippedCards: EquippedHexCard[];
  venomLetters: string[];
  secretsFoundThisRun: string[];
  consciousness: EnemyConsciousness;
  difficultyMode: DifficultyMode;
  checkpoint: NightRunCheckpoint | null;
  createdAt: number;
  updatedAt: number;
};

export function createNightRun(opts: { hero: HeroId; consciousness: EnemyConsciousness; difficultyMode: DifficultyMode; seed?: number }): NightRunState {
  const now = Date.now();
  return {
    active: true, valid: true, seed: opts.seed ?? freshRunSeed(), hero: opts.hero,
    currentChamberIndex: 0, lives: 3, score: 0, equippedCards: [], venomLetters: [],
    secretsFoundThisRun: [], consciousness: opts.consciousness, difficultyMode: opts.difficultyMode,
    checkpoint: null, createdAt: now, updatedAt: now,
  };
}

export function isRunResumable(run: NightRunState | null | undefined): run is NightRunState {
  return !!run && run.active && run.valid && run.currentChamberIndex >= 0 && run.currentChamberIndex < CAMPAIGN_CHAMBERS.length;
}

export function isChamberDueForHexCardOffer(chamberNumberJustCleared: number): boolean {
  return chamberNumberJustCleared > 0 && chamberNumberJustCleared % 2 === 0;
}

export function isCheckpointChamber(chamberNumberJustCleared: number): boolean {
  return CAMPAIGN_CHAMBERS.find(chamber => chamber.number === chamberNumberJustCleared)?.checkpoint ?? false;
}

/** Snapshots the run's current state as its new last-safe-checkpoint. `heroXp` is the
 * *current absolute* xp value of the run's hero at this moment, needed so a later
 * restore can roll xp back without re-deriving it from anywhere else. */
export function captureCheckpoint(run: NightRunState, heroXp: number): NightRunState {
  const checkpoint: NightRunCheckpoint = {
    atChamberIndex: run.currentChamberIndex, hero: run.hero, lives: run.lives, score: run.score,
    equippedCards: run.equippedCards.map(card => ({ ...card })), venomLetters: [...run.venomLetters],
    secretsFoundThisRun: [...run.secretsFoundThisRun], heroXpAtCheckpoint: heroXp,
  };
  return { ...run, checkpoint, updatedAt: Date.now() };
}

/** Restores a run to its last checkpoint. Returns null if there is no checkpoint yet
 * (caller should fall back to restarting the run from chamber 1 instead). The returned
 * `heroXp` must be written back onto the hero's persisted progress so XP earned after
 * the checkpoint (in the attempt that failed) is not kept — otherwise replaying the
 * same chambers would earn it a second time. */
export function restoreFromCheckpoint(run: NightRunState): { run: NightRunState; heroXp: number } | null {
  const cp = run.checkpoint;
  if (!cp) return null;
  const restored: NightRunState = {
    ...run, active: true, valid: true, currentChamberIndex: cp.atChamberIndex, hero: cp.hero,
    lives: cp.lives, score: cp.score, equippedCards: cp.equippedCards.map(card => ({ ...card })),
    venomLetters: [...cp.venomLetters], secretsFoundThisRun: [...cp.secretsFoundThisRun], updatedAt: Date.now(),
  };
  return { run: restored, heroXp: cp.heroXpAtCheckpoint };
}

export function retryCurrentChamber(run: NightRunState): NightRunState {
  return { ...run, active: true, valid: true, lives: Math.max(run.lives, 3), updatedAt: Date.now() };
}

export function endRun(run: NightRunState): NightRunState {
  return { ...run, active: false, valid: false, updatedAt: Date.now() };
}

export function advanceToChamber(run: NightRunState, chamberIndex: number, scoreAfterChamber: number): NightRunState {
  return { ...run, currentChamberIndex: chamberIndex, score: scoreAfterChamber, updatedAt: Date.now() };
}

export function collectVenomLetter(run: NightRunState, letter: string): { run: NightRunState; ascended: boolean } {
  if (!VENOM_LETTERS.includes(letter) || run.venomLetters.includes(letter)) return { run, ascended: false };
  const venomLetters = [...run.venomLetters, letter];
  if (venomLetters.length >= VENOM_LETTERS.length) return { run: { ...run, venomLetters: [], updatedAt: Date.now() }, ascended: true };
  return { run: { ...run, venomLetters, updatedAt: Date.now() }, ascended: false };
}

export function recordSecretFound(run: NightRunState, chamberKey: string): NightRunState {
  if (run.secretsFoundThisRun.includes(chamberKey)) return run;
  return { ...run, secretsFoundThisRun: [...run.secretsFoundThisRun, chamberKey], updatedAt: Date.now() };
}

export function applyRunScore(run: NightRunState, score: number): NightRunState {
  return { ...run, score, updatedAt: Date.now() };
}

export function applyRunLives(run: NightRunState, lives: number): NightRunState {
  return { ...run, lives, updatedAt: Date.now() };
}

// ---- Hex card slot management within a run -----------------------------------------

export function applyNewCard(run: NightRunState, id: HexCardId): NightRunState {
  return { ...run, equippedCards: equipNewCard(run.equippedCards, id), updatedAt: Date.now() };
}

export function applyUpgradeCard(run: NightRunState, id: HexCardId): NightRunState {
  return { ...run, equippedCards: upgradeCard(run.equippedCards, id), updatedAt: Date.now() };
}

export function applyReplaceCard(run: NightRunState, outgoingId: HexCardId, incomingId: HexCardId): NightRunState {
  return { ...run, equippedCards: replaceCard(run.equippedCards, outgoingId, incomingId), updatedAt: Date.now() };
}

export function hasFreeCardSlot(run: NightRunState): boolean {
  return run.equippedCards.length < 4;
}

export function upgradeableCards(run: NightRunState): EquippedHexCard[] {
  return run.equippedCards.filter(card => !isCardMaxRank(card));
}

// ---- Persistence / migration --------------------------------------------------------

const isHeroId = (value: unknown): value is HeroId => value === "vesper" || value === "jade";
const isConsciousness = (value: unknown): value is EnemyConsciousness =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;

function normalizeEquippedCards(value: unknown): EquippedHexCard[] {
  if (!Array.isArray(value)) return [];
  const out: EquippedHexCard[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as Partial<EquippedHexCard>).id;
    const rank = (entry as Partial<EquippedHexCard>).rank;
    if (typeof id !== "string" || typeof rank !== "number") continue;
    out.push({ id: id as HexCardId, rank: Math.max(1, Math.min(3, Math.round(rank))) });
  }
  return out.slice(0, 4);
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeCheckpoint(value: unknown): NightRunCheckpoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<NightRunCheckpoint>;
  if (!isHeroId(raw.hero) || typeof raw.atChamberIndex !== "number") return null;
  return {
    atChamberIndex: Math.max(0, Math.min(CAMPAIGN_CHAMBERS.length - 1, Math.floor(raw.atChamberIndex))),
    hero: raw.hero, lives: typeof raw.lives === "number" ? Math.max(0, raw.lives) : 3,
    score: typeof raw.score === "number" ? Math.max(0, raw.score) : 0,
    equippedCards: normalizeEquippedCards(raw.equippedCards), venomLetters: normalizeStringList(raw.venomLetters),
    secretsFoundThisRun: normalizeStringList(raw.secretsFoundThisRun),
    heroXpAtCheckpoint: typeof raw.heroXpAtCheckpoint === "number" ? Math.max(0, raw.heroXpAtCheckpoint) : 0,
  };
}

/** Defensively normalizes a persisted `activeRun` blob. Returns null (no active run)
 * for anything malformed, out-of-range, or otherwise no longer resumable, rather than
 * ever throwing during settings migration. */
export function normalizeNightRun(value: unknown): NightRunState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<NightRunState>;
  if (!raw.active || !isHeroId(raw.hero)) return null;
  const currentChamberIndex = typeof raw.currentChamberIndex === "number" ? Math.floor(raw.currentChamberIndex) : 0;
  if (currentChamberIndex < 0 || currentChamberIndex >= CAMPAIGN_CHAMBERS.length) return null;
  return {
    active: true, valid: raw.valid !== false, seed: typeof raw.seed === "number" ? raw.seed : freshRunSeed(),
    hero: raw.hero, currentChamberIndex,
    lives: typeof raw.lives === "number" ? Math.max(0, raw.lives) : 3,
    score: typeof raw.score === "number" ? Math.max(0, raw.score) : 0,
    equippedCards: normalizeEquippedCards(raw.equippedCards), venomLetters: normalizeStringList(raw.venomLetters),
    secretsFoundThisRun: normalizeStringList(raw.secretsFoundThisRun),
    consciousness: isConsciousness(raw.consciousness) ? raw.consciousness : 0,
    difficultyMode: isDifficultyMode(raw.difficultyMode) ? raw.difficultyMode : "arcade",
    checkpoint: normalizeCheckpoint(raw.checkpoint),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

/** Re-derives a valid absolute hero xp value from a checkpoint restore's raw xp,
 * for callers that want the normalized {level,xp} pair instead of the raw number. */
export function heroProgressFromXp(xp: number) {
  return normalizeHeroProgress({ xp });
}
