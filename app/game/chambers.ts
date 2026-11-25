/**
 * BUBBLE HEX — Forbidden Expansion, milestone 6: the Widow's Chambers (pure data + logic).
 *
 * Six optional chambers reached through the Secret Door (opened by a Widow's Key)
 * plus a data-driven, bounded prop system. The original 12 stages and the vault
 * are never edited: chambers are separate Level objects carrying a `chamberId`.
 */
import type { Level, Platform } from "./levels";

export type ChamberId = "dead_disco" | "vanity_room" | "drowned_ballroom" | "poison_conservatory" | "klein_chamber" | "widow_cathedral";
export type PropKind = "jukebox" | "chandelier" | "stained_glass" | "coffin" | "mirror" | "serpent_statue" | "secret_door" | "tarot";

export type PropDefinition = {
  kind: PropKind;
  /** Pack sprite from the props atlas; null = code-drawn (the enchanted mirror). */
  sprite: string | null;
  w: number;
  h: number;
  /** Seconds between activations (0 = single use / passive). */
  cooldown: number;
};

export const PROP_DEFINITIONS: Record<PropKind, PropDefinition> = {
  jukebox: { kind: "jukebox", sprite: "jukebox", w: 70, h: 90, cooldown: 0 },
  chandelier: { kind: "chandelier", sprite: "chandelier", w: 96, h: 80, cooldown: 0 },
  stained_glass: { kind: "stained_glass", sprite: "stained_glass", w: 86, h: 130, cooldown: 0 },
  coffin: { kind: "coffin", sprite: "coffin", w: 54, h: 96, cooldown: 8 },
  mirror: { kind: "mirror", sprite: null, w: 18, h: 150, cooldown: 0 },
  serpent_statue: { kind: "serpent_statue", sprite: "serpent_statue", w: 70, h: 100, cooldown: 9 },
  secret_door: { kind: "secret_door", sprite: "secret_door", w: 60, h: 92, cooldown: 0 },
  tarot: { kind: "tarot", sprite: "tarot", w: 40, h: 60, cooldown: 0 },
};

/** Placement: (x, y) is the prop's bottom-centre (its feet), so floor props sit on a platform. */
export type PropSpec = { kind: PropKind; x: number; y: number };

export const PROP_LIMITS = {
  maxPropsPerChamber: 6,
  jukeboxPulseEvery: 4,
  jukeboxPulseRadius: 170,
  holdSeconds: 0.7,
  chandelierRadius: 110,
  chandelierHold: 2.5,
  chandelierScore: 500,
  chandelierMaxScore: 2500,
  glassSpeedBoost: 1.25,
  glassLifeBonus: 1.5,
  coffinHideSeconds: 3,
  coffinSettle: 0.4,
  mirrorMaxDuplicatesPerStage: 6,
  maxOrbs: 2,
  orbLife: 8,
  maxTiles: 18,
  tileWidth: 40,
  tileSpreadSeconds: 3.5,
  tileCleanseRadius: 90,
  tileSafeX: 200,
  tarotHasteScale: 1.3,
  tarotEffectSeconds: 6,
  maxHeld: 12,
} as const;

export type ChamberMechanic = "beat" | "mirrors" | "water" | "poison" | "klein" | "cathedral";

export type ChamberDefinition = {
  id: ChamberId;
  mechanic: ChamberMechanic;
  level: Level & { chamberId: ChamberId };
  props: readonly PropSpec[];
  /** Venom tile seeds (Poison Conservatory only): x positions on platform index. */
  seeds?: readonly { platform: number; x: number }[];
};

const floor: Platform = { x: 24, y: 650, w: 912, h: 32 };
const p = (x: number, y: number, w: number): Platform => ({ x, y, w, h: 18 });
const e = (x: number, y: number, kind: Level["enemies"][number]["kind"]) => ({ x, y, kind });

const level = (id: ChamberId, data: Omit<Level, "loreFragmentId">): Level & { chamberId: ChamberId } =>
  ({ ...data, loreFragmentId: `chamber-${id.replace(/_/g, "-")}`, chamberId: id });

export const CHAMBERS: readonly ChamberDefinition[] = [
  {
    id: "dead_disco", mechanic: "beat",
    level: level("dead_disco", { name: "The Dead Disco", world: "THE DEAD DISCO", worldId: "heartbreak-hotel", backgroundId: "hotel-room-108", tint: "#FF2A9D", time: 70,
      platforms: [floor, p(80, 530, 230), p(650, 530, 230), p(330, 420, 300), p(90, 300, 220), p(650, 300, 220)],
      enemies: [e(160, 494, "love"), e(720, 494, "love"), e(420, 384, "doll"), e(170, 264, "bat")], current: { x: 0.04, y: -0.3 }, secret: "oneChain" }),
    props: [{ kind: "jukebox", x: 480, y: 650 }, { kind: "coffin", x: 860, y: 650 }, { kind: "tarot", x: 480, y: 420 }],
  },
  {
    id: "vanity_room", mechanic: "mirrors",
    level: level("vanity_room", { name: "The Vanity Room", world: "THE VANITY ROOM", worldId: "heartbreak-hotel", backgroundId: "hotel-mirror-teeth", tint: "#E0E6FF", time: 72,
      platforms: [floor, p(70, 540, 240), p(650, 540, 240), p(360, 430, 240), p(70, 320, 240), p(650, 320, 240)],
      enemies: [e(150, 504, "love"), e(430, 394, "witch"), e(720, 504, "doll"), e(730, 284, "eye")], current: { x: -0.05, y: -0.3 }, secret: "trapFirst" }),
    props: [{ kind: "mirror", x: 336, y: 640 }, { kind: "mirror", x: 624, y: 640 }, { kind: "tarot", x: 480, y: 430 }],
  },
  {
    id: "drowned_ballroom", mechanic: "water",
    level: level("drowned_ballroom", { name: "The Drowned Ballroom", world: "THE DROWNED BALLROOM", worldId: "velvet-drain", backgroundId: "velvet-blue-pressure", tint: "#2FD3E0", time: 74,
      platforms: [floor, p(60, 520, 250), p(650, 520, 250), p(330, 400, 300), p(120, 280, 200), p(640, 280, 200)],
      enemies: [e(150, 484, "love"), e(740, 484, "skull"), e(430, 330, "bat"), e(700, 244, "eye")], current: { x: 0.1, y: -0.2 }, secret: "noFloor" }),
    props: [{ kind: "chandelier", x: 480, y: 180 }, { kind: "coffin", x: 870, y: 650 }],
  },
  {
    id: "poison_conservatory", mechanic: "poison",
    level: level("poison_conservatory", { name: "Poison Conservatory", world: "POISON CONSERVATORY", worldId: "jade-garden", backgroundId: "garden-poison-moon", tint: "#7CFF4F", time: 72,
      platforms: [floor, p(80, 540, 220), p(380, 470, 200), p(660, 540, 220), p(180, 350, 220), p(560, 330, 220)],
      enemies: [e(150, 504, "love"), e(450, 434, "witch"), e(720, 504, "love"), e(620, 294, "doll")], current: { x: 0.06, y: -0.28 }, secret: "trapFirst" }),
    props: [{ kind: "serpent_statue", x: 870, y: 650 }],
    seeds: [{ platform: 1, x: 120 }, { platform: 3, x: 820 }, { platform: 5, x: 600 }],
  },
  {
    id: "klein_chamber", mechanic: "klein",
    level: level("klein_chamber", { name: "The Klein Chamber", world: "THE KLEIN CHAMBER", worldId: "black-bubble", backgroundId: "bubble-widow", tint: "#6AB8FF", time: 70,
      platforms: [floor, p(130, 540, 700), p(250, 430, 460), p(370, 320, 220), p(24, 300, 120), p(816, 300, 120)],
      enemies: [e(200, 504, "love"), e(700, 504, "love"), e(480, 394, "skull"), e(60, 264, "eye")], current: { x: 0, y: -0.3 }, secret: "oneChain" }),
    props: [{ kind: "tarot", x: 480, y: 320 }, { kind: "mirror", x: 480, y: 260 }],
  },
  {
    id: "widow_cathedral", mechanic: "cathedral",
    level: level("widow_cathedral", { name: "The Widow's Cathedral", world: "THE WIDOW'S CATHEDRAL", worldId: "crimson-chapel", backgroundId: "bubble-widow", tint: "#FF2A4F", time: 100, boss: true,
      platforms: [floor, p(40, 525, 220), p(370, 560, 220), p(700, 525, 220), p(155, 340, 220), p(585, 340, 220)],
      enemies: [e(140, 489, "skull"), e(770, 489, "skull"), e(230, 304, "witch"), e(660, 304, "eye")], current: { x: 0, y: -0.36 }, secret: "widow13" }),
    props: [{ kind: "stained_glass", x: 110, y: 300 }, { kind: "stained_glass", x: 850, y: 300 }, { kind: "chandelier", x: 480, y: 250 }],
  },
];

export const CHAMBER_IDS: readonly ChamberId[] = CHAMBERS.map(c => c.id);
export const chamberById = (id: unknown) => CHAMBERS.find(c => c.id === id);
export const chamberByKey = (key: unknown) => CHAMBERS.find(c => c.level.loreFragmentId === key);
export const chamberKey = (id: ChamberId) => chamberById(id)!.level.loreFragmentId;

/** Route: the first undiscovered chamber, else cycle by how many doors were opened this run. */
export function nextChamber(discoveredKeys: readonly string[], doorsThisRun: number): ChamberDefinition {
  const fresh = CHAMBERS.find(c => !discoveredKeys.includes(c.level.loreFragmentId));
  return fresh ?? CHAMBERS[doorsThisRun % CHAMBERS.length];
}

/** The door may appear only in an original, non-boss, non-final, non-bonus stage. */
export function doorAllowed(ctx: { levelIndex: number; lastIndex: number; boss: boolean; bonus: boolean; inChamber: boolean; attract: boolean }): boolean {
  return !ctx.attract && !ctx.inChamber && !ctx.boss && !ctx.bonus && ctx.levelIndex < ctx.lastIndex;
}

/* --------------------------------------------------------------- beat */

export const BEAT = { seconds: 0.5, window: 0.18, fast: 2.2, slow: 0.35, popBonus: 150, stageBonusCap: 6000 } as const;
export const beatPhase = (clock: number) => ((clock % BEAT.seconds) + BEAT.seconds) % BEAT.seconds;
export const onBeat = (clock: number) => beatPhase(clock) < BEAT.window;
/** Enemy time scale in the Dead Disco: lunges on the beat, creeps between beats (average ≈ 1). */
export const beatScale = (clock: number) => (onBeat(clock) ? BEAT.fast : BEAT.slow);

/* --------------------------------------------------------------- venom tiles */

export type Tile = { platform: number; slot: number };

export function tileSlots(plat: Platform) { return Math.max(1, Math.floor(plat.w / PROP_LIMITS.tileWidth)); }
export const tileX = (plat: Platform, slot: number) => plat.x + slot * PROP_LIMITS.tileWidth + PROP_LIMITS.tileWidth / 2;

export function seedTiles(platforms: readonly Platform[], seeds: readonly { platform: number; x: number }[]): Tile[] {
  const out: Tile[] = [];
  for (const s of seeds) {
    const plat = platforms[s.platform];
    if (!plat) continue;
    const slot = Math.max(0, Math.min(tileSlots(plat) - 1, Math.floor((s.x - plat.x) / PROP_LIMITS.tileWidth)));
    if (!out.some(t => t.platform === s.platform && t.slot === slot)) out.push({ platform: s.platform, slot });
  }
  return out.slice(0, PROP_LIMITS.maxTiles);
}

/** One spread step: a random tile grows into an empty neighbouring slot. Bounded and spawn-safe. */
export function spreadTiles(tiles: Tile[], platforms: readonly Platform[], rng: () => number): Tile | null {
  if (!tiles.length || tiles.length >= PROP_LIMITS.maxTiles) return null;
  const start = Math.floor(rng() * tiles.length) % tiles.length, first = rng() < 0.5 ? -1 : 1;
  for (let k = 0; k < tiles.length; k++) {
    const from = tiles[(start + k) % tiles.length], plat = platforms[from.platform];
    if (!plat) continue;
    for (const dir of [first, -first]) {
      const slot = from.slot + dir;
      if (slot < 0 || slot >= tileSlots(plat)) continue;
      if (from.platform === 0 && tileX(plat, slot) < PROP_LIMITS.tileSafeX) continue;
      if (tiles.some(t => t.platform === from.platform && t.slot === slot)) continue;
      const tile = { platform: from.platform, slot };
      tiles.push(tile);
      return tile;
    }
  }
  return null;
}

export function cleanseTiles(tiles: Tile[], platforms: readonly Platform[], x: number, y: number): number {
  const before = tiles.length;
  const keep = tiles.filter(t => { const plat = platforms[t.platform]; return !plat || Math.hypot(tileX(plat, t.slot) - x, plat.y - y) > PROP_LIMITS.tileCleanseRadius; });
  tiles.length = 0; tiles.push(...keep);
  return before - tiles.length;
}

/* --------------------------------------------------------------- tarot */

export type TarotId = "sun" | "star" | "magician" | "lovers" | "tower" | "death" | "moon";
export type TarotCard = { id: TarotId; boon: boolean };
export const TAROT: readonly TarotCard[] = [
  { id: "sun", boon: true }, { id: "star", boon: true }, { id: "magician", boon: true }, { id: "lovers", boon: true },
  { id: "tower", boon: false }, { id: "death", boon: false }, { id: "moon", boon: false },
];
export const drawTarot = (rng: () => number): TarotCard => TAROT[Math.floor(rng() * TAROT.length) % TAROT.length];
/** Bounded tarot outcomes applied by the engine layer. */
export const TAROT_LIMITS = { sunSeconds: 10, maxLives: 5, magicianCharges: 2, loversHold: 2, deathSeconds: 6, deathFloor: 8, moonSeconds: 5 } as const;

/* --------------------------------------------------------------- editions */

export type EditionRule = { achievement?: string; chamber?: ChamberId };
/** Original is free; the four B$S special editions are earned through play. */
export const EDITION_UNLOCKS: Record<string, EditionRule> = {
  "old-vic": { achievement: "opening_night" },
  "civilian-signal": { achievement: "chamber_crawler" },
  klein: { chamber: "klein_chamber" },
  "widow-after-dark": { chamber: "widow_cathedral" },
};

type EditionSettings = { theme?: string; cabinet?: { achievements?: string[]; chambers?: string[]; themesUnlocked?: string[] } };
export function isEditionUnlocked(settings: EditionSettings, id: string): boolean {
  if (id === "default") return true;
  const cab = settings.cabinet ?? {};
  if (cab.themesUnlocked?.includes(id)) return true;
  const rule = EDITION_UNLOCKS[id];
  if (!rule) return false;
  if (rule.achievement && cab.achievements?.includes(rule.achievement)) return true;
  if (rule.chamber && cab.chambers?.includes(chamberKey(rule.chamber))) return true;
  return false;
}
