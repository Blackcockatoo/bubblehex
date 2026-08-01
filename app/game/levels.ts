import type { WorldId } from "./content";

export type Platform = { x: number; y: number; w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type EnemyKind = "love" | "bat" | "eye" | "witch" | "doll" | "skull";
export type EnemyVariant =
  | "normal" | "paired" | "excited"
  | "tracker" | "feint" | "roost"
  | "aimed" | "sweep" | "shy"
  | "ranged" | "orbit" | "chorus"
  | "charge" | "windup" | "frayed"
  | "pursuit" | "anchor" | "briar";
export type EnemySpawn = { x: number; y: number; kind: EnemyKind; variant?: EnemyVariant; group?: string };

export type CurrentZone = Rect & {
  id: string;
  vector: { x: number; y: number };
  label: "LEFT" | "RIGHT" | "UP" | "DOWN";
  valveId?: string;
};
export type Valve = { id: string; x: number; y: number; mode: "reverse" | "stop" };
export type Drain = Rect & { id: string; pull: number };
export type MirrorDoor = Rect & { id: string; pairId: string; preview: "LEFT" | "RIGHT" | "UP" | "DOWN" };
export type Lift = { id: string; platform: Platform; toY: number; period: number; phase?: number };
export type RevealPlatform = { id: string; platform: Platform; mirror: Rect };
export type Vine = { id: string; platform: Platform; requiredChain: number; activeSeconds: number };
export type MoonPool = Rect & { id: string; bubbleLift: number };
export type ChainBloom = { id: string; x: number; y: number; requiredChain: number; value: number; kind: "rose" | "bud" };
export type Candle = { id: string; order: number; x: number; y: number };
export type WaxPlatform = { id: string; platform: Platform; sinkDistance: number; period: number };
export type ContractGate = Rect & { id: string; requiredKinds: EnemyKind[] };
export type ThornHazard = Rect & { id: string; period: number; warningSeconds: number; activeSeconds: number; phase?: number };
export type GravityZone = Rect & { id: string; gravityScale: number; bubbleLift: number; label: "HEAVY" | "FLOAT" };
export type PhasePlatform = { id: string; a: Platform; b: Platform; period: number; phase?: number };
export type RiskPickup = { id: string; x: number; y: number; value: number };

export type LevelEnvironment = {
  currents?: CurrentZone[];
  valves?: Valve[];
  drains?: Drain[];
  mirrorDoors?: MirrorDoor[];
  lifts?: Lift[];
  revealPlatforms?: RevealPlatform[];
  vines?: Vine[];
  moonPools?: MoonPool[];
  blooms?: ChainBloom[];
  candles?: Candle[];
  waxPlatforms?: WaxPlatform[];
  contractGates?: ContractGate[];
  thorns?: ThornHazard[];
  gravityZones?: GravityZone[];
  phasePlatforms?: PhasePlatform[];
  echoBubbles?: boolean;
  timeFracture?: { interval: number; replayDelay: number };
  riskPickups?: RiskPickup[];
  ritualTargetSeconds?: number;
};

export type ChamberDesign = {
  movementChallenge: string;
  enemyInteraction: string;
  safeChain: string;
  advancedChain: string;
  riskRoute: string;
  secretCondition: string;
  recoveryRoute: string;
  expectedSeconds: [number, number];
  beginnerDifficulty: 1 | 2 | 3 | 4 | 5;
  expertStrategy: string;
  routes: [string, string];
};

export type EncoreMedalTargets = { score: number; fullChain: number; time: number };

export type Level = {
  name: string;
  world: string;
  platforms: Platform[];
  enemies: EnemySpawn[];
  current: { x: number; y: number };
  time: number;
  tint: string;
  worldId: WorldId;
  backgroundId: string;
  loreFragmentId: string;
  secret: "noFloor" | "trapFirst" | "oneChain" | "widow13" | "mechanicMastery";
  design: ChamberDesign;
  environment?: LevelEnvironment;
  boss?: boolean;
  bonus?: boolean;
  approach?: boolean;
  encore?: boolean;
  encoreId?: WorldId;
  medalTargets?: EncoreMedalTargets;
};

const floor: Platform = { x: 24, y: 650, w: 912, h: 32 };
const p = (x: number, y: number, w: number): Platform => ({ x, y, w, h: 18 });
const e = (x: number, y: number, kind: EnemyKind, variant?: EnemyVariant, group?: string): EnemySpawn => ({ x, y, kind, variant, group });
const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const d = (
  movementChallenge: string,
  enemyInteraction: string,
  safeChain: string,
  advancedChain: string,
  riskRoute: string,
  secretCondition: string,
  recoveryRoute: string,
  expectedSeconds: [number, number],
  beginnerDifficulty: ChamberDesign["beginnerDifficulty"],
  expertStrategy: string,
  routes: [string, string],
): ChamberDesign => ({ movementChallenge, enemyInteraction, safeChain, advancedChain, riskRoute, secretCondition, recoveryRoute, expectedSeconds, beginnerDifficulty, expertStrategy, routes });

export const VALID_BACKGROUND_IDS = new Set([
  "velvet-first-sip", "velvet-chain-letter", "velvet-blue-pressure", "velvet-bonus-vault", "velvet-encore",
  "hotel-room-108", "hotel-mirror-teeth", "hotel-last-lift", "hotel-encore",
  "garden-poison-moon", "garden-black-roses", "garden-encore",
  "chapel-serpent-glass", "chapel-thirteen-candles", "chapel-encore",
  "bubble-event-horizon", "bubble-widow", "bubble-encore",
]);

export const LEVELS: Level[] = [
  {
    name: "The First Sip", world: "VELVET DRAIN", worldId: "velvet-drain", backgroundId: "velvet-first-sip", loreFragmentId: "blueprint", tint: "#087CFF", time: 62,
    platforms: [floor, p(90, 528, 240), p(480, 510, 240), p(270, 382, 260), p(650, 300, 190)],
    enemies: [e(190, 492, "love", "paired", "first-pair"), e(555, 474, "love", "paired", "first-pair"), e(380, 346, "love")], current: { x: .05, y: -.3 }, secret: "trapFirst",
    environment: {
      currents: [{ id: "sip-current", ...r(300, 310, 410, 270), vector: { x: .42, y: -.14 }, label: "RIGHT", valveId: "sip-valve" }],
      valves: [{ id: "sip-valve", x: 245, y: 495, mode: "stop" }],
      drains: [{ id: "sip-drain", ...r(735, 585, 120, 65), pull: 85 }],
      riskPickups: [{ id: "sip-shard", x: 795, y: 560, value: 900 }],
    },
    design: d("Read a single current, climb the centre shelf, then cross high right.", "Keep the paired Heartlings close enough to trap without letting the drain split them.", "Park two bubbles against the centre shelf and walk through both.", "Reverse the current, float all three echoes into one vertical cluster, then pop.", "The lower-right grate carries a memory shard but compresses the patrol lane.", "Trap every echo before the first pop.", "The full floor returns to the valve and both opening shelves.", [42, 62], 1, "Stop the current only after the third trap so all bubbles settle within one pulse radius.", ["central shelves", "low floor to right shelf"]),
  },
  {
    name: "Chain Letter", world: "VELVET DRAIN", worldId: "velvet-drain", backgroundId: "velvet-chain-letter", loreFragmentId: "sisters-dream", tint: "#087CFF", time: 66,
    platforms: [floor, p(80, 555, 220), p(370, 474, 220), p(660, 555, 220), p(170, 330, 230), p(560, 290, 230)],
    enemies: [e(150, 519, "love", "normal"), e(455, 438, "love", "excited"), e(745, 519, "bat", "roost"), e(650, 254, "love", "normal")], current: { x: -.08, y: -.34 }, secret: "oneChain",
    environment: {
      currents: [
        { id: "letter-up", ...r(315, 290, 315, 330), vector: { x: 0, y: -.62 }, label: "UP", valveId: "letter-valve" },
        { id: "letter-left", ...r(560, 150, 330, 170), vector: { x: -.38, y: -.1 }, label: "LEFT", valveId: "letter-valve" },
      ],
      valves: [{ id: "letter-valve", x: 110, y: 520, mode: "reverse" }],
      riskPickups: [{ id: "letter-shard", x: 815, y: 520, value: 1100 }],
    },
    design: d("Ride a vertical bubble lane while a horizontal return current feeds the top shelf.", "Wake the Roosting Bat deliberately after the Heartlings are staged.", "Trap the two floor Heartlings beside the centre shelf.", "Use the valve reversal to fold the top and bottom bubbles into a four-link letter shape.", "The far-right shard sits beneath the Bat's wake line.", "Release every enemy in one chain.", "Either lower shelf drops to the uninterrupted floor and valve.", [48, 66], 2, "Delay the Bat wake, reverse once, then touch the centre bubble during the grace window.", ["left shelf ascent", "right shelf and current return"]),
  },
  {
    name: "Blue Pressure", world: "VELVET DRAIN", worldId: "velvet-drain", backgroundId: "velvet-blue-pressure", loreFragmentId: "widow-invitation", tint: "#087CFF", time: 70,
    platforms: [floor, p(52, 478, 210), p(340, 570, 280), p(700, 454, 210), p(265, 320, 430), p(72, 210, 180)],
    enemies: [e(130, 442, "love", "excited"), e(440, 534, "bat", "feint"), e(770, 418, "love", "paired", "pressure-pair"), e(490, 284, "eye", "aimed", "pressure-pair")], current: { x: .12, y: -.26 }, secret: "noFloor",
    environment: {
      currents: [{ id: "pressure-window", ...r(245, 260, 500, 335), vector: { x: .58, y: -.22 }, label: "RIGHT", valveId: "pressure-valve" }],
      valves: [{ id: "pressure-valve", x: 905, y: 420, mode: "reverse" }],
      drains: [{ id: "pressure-drain", ...r(355, 610, 250, 40), pull: 120 }],
      ritualTargetSeconds: 45,
      riskPickups: [{ id: "pressure-shard", x: 115, y: 175, value: 1400 }],
    },
    design: d("Cross the broad pressure window without dropping to the drain floor.", "Read the Feinting Bat before committing to the exposed upper lane.", "Stage the left Heartling and Eye beneath the wide middle ledge.", "Reverse the pressure window as the paired echoes cross, catching all four in one moving chain.", "The upper-left invitation shard preserves the no-floor secret but costs time.", "Clear without touching the lowest floor.", "Missed upper jumps land on the middle slab, then the side shelves; the floor remains a nonfatal fallback.", [52, 70], 3, "Take the invitation first, trap on the return, and trigger the chain as the current crosses the centre seam.", ["upper invitation route", "middle slab pressure route"]),
  },
  {
    name: "Room 108", world: "HEARTBREAK HOTEL", worldId: "heartbreak-hotel", backgroundId: "hotel-room-108", loreFragmentId: "vesper-signs", tint: "#FF2A9D", time: 72,
    platforms: [floor, p(70, 530, 250), p(640, 530, 250), p(360, 410, 240), p(90, 270, 230), p(630, 245, 230)],
    enemies: [e(160, 494, "love", "paired", "room-pair"), e(720, 494, "doll", "windup"), e(440, 374, "witch", "ranged"), e(180, 234, "bat", "tracker", "room-pair")], current: { x: -.04, y: -.31 }, secret: "trapFirst",
    environment: {
      mirrorDoors: [
        { id: "108-a", pairId: "108-b", ...r(40, 430, 42, 92), preview: "RIGHT" },
        { id: "108-b", pairId: "108-a", ...r(878, 430, 42, 92), preview: "LEFT" },
      ],
      lifts: [{ id: "108-lift", platform: p(448, 565, 70), toY: 300, period: 5.4 }],
      riskPickups: [{ id: "108-shard", x: 480, y: 535, value: 1200 }],
    },
    design: d("Choose the slow centre lift or mirror-door cross-room transfer.", "Bait the Wind-up Doll away from the safe mirror exit before teleporting.", "Trap the floor pair on either side of the centre platform.", "Send two occupied bubbles through opposite mirrors and connect them at the lift apex.", "The lift-top shard is exposed to the Witch but shortens the chain route.", "Trap all echoes before the first pop.", "Both mirror exits are previewed and land on protected floor pockets.", [50, 72], 2, "Use a bubble to test the exit, bait the Doll, then carry the lift cluster into a four-chain.", ["safe centre lift", "fast mirror transfer"]),
  },
  {
    name: "Mirror Teeth", world: "HEARTBREAK HOTEL", worldId: "heartbreak-hotel", backgroundId: "hotel-mirror-teeth", loreFragmentId: "jade-tears", tint: "#FF2A9D", time: 74,
    platforms: [floor, p(45, 580, 190), p(275, 500, 180), p(505, 420, 180), p(735, 340, 180), p(505, 230, 180), p(205, 190, 190)],
    enemies: [e(105, 544, "doll", "frayed"), e(330, 464, "love", "normal"), e(560, 384, "eye", "shy"), e(790, 304, "witch", "orbit"), e(280, 154, "bat", "feint")], current: { x: .08, y: -.3 }, secret: "oneChain",
    environment: {
      mirrorDoors: [
        { id: "teeth-a", pairId: "teeth-b", ...r(25, 490, 38, 82), preview: "UP" },
        { id: "teeth-b", pairId: "teeth-a", ...r(890, 250, 38, 82), preview: "LEFT" },
      ],
      revealPlatforms: [{ id: "teeth-reveal", platform: p(420, 300, 105), mirror: r(785, 250, 75, 80) }],
      riskPickups: [{ id: "teeth-shard", x: 470, y: 265, value: 1500 }],
    },
    design: d("Climb a broken staircase whose missing tooth appears only in the upper mirror.", "Approach the Shy Eye from the side while the Orbit Witch previews its launch.", "Collect the Doll and Heartling on the two lowest steps.", "Reveal the missing tooth, route three bubbles through the mirror, then bridge to the Bat.", "The hidden-tooth shard sits on the fastest but least sheltered route.", "Release the full room in one chain.", "Every failed step falls to a wider step or the full floor.", [55, 74], 3, "Reveal before trapping, use the Frayed Doll's one turn to group the low pair, then portal the chain.", ["visible staircase", "mirror-revealed shortcut"]),
  },
  {
    name: "Last Lift", world: "HEARTBREAK HOTEL", worldId: "heartbreak-hotel", backgroundId: "hotel-last-lift", loreFragmentId: "memory-split", tint: "#FF2A9D", time: 76,
    platforms: [floor, p(90, 490, 220), p(375, 560, 210), p(650, 480, 220), p(260, 330, 420), p(70, 205, 170), p(720, 205, 170)],
    enemies: [e(170, 454, "doll", "windup"), e(455, 524, "love", "excited"), e(730, 444, "witch", "chorus", "lift-chorus"), e(350, 294, "eye", "sweep", "lift-chorus"), e(785, 169, "bat", "roost")], current: { x: -.1, y: -.28 }, secret: "widow13",
    environment: {
      lifts: [
        { id: "last-left", platform: p(225, 575, 80), toY: 215, period: 6.2 },
        { id: "last-right", platform: p(655, 575, 80), toY: 215, period: 6.2, phase: .5 },
      ],
      mirrorDoors: [
        { id: "last-a", pairId: "last-b", ...r(35, 115, 42, 85), preview: "RIGHT" },
        { id: "last-b", pairId: "last-a", ...r(883, 115, 42, 85), preview: "LEFT" },
      ],
      ritualTargetSeconds: 49,
      riskPickups: [{ id: "last-shard", x: 480, y: 295, value: 1600 }],
    },
    design: d("Transfer between two out-of-phase lifts and a mirrored top corridor.", "Break the Chorus pairing before the Sweeping Eye controls both lift lanes.", "Trap the Doll and Heartling under the central bridge.", "Carry the low pair up separate lifts and join them to the top Bat through a mirror transfer.", "The central bridge shard is fast but exposed to the sweep telegraph.", "Keep the roaming Widow present for thirteen seconds before clearing.", "Lift misses return to three floor shelves; mirror exits have clear landing pockets.", [58, 76], 4, "Score the risk shard during the Eye's closed sweep, then merge lift bubbles at the bridge edge.", ["alternating lifts", "mirror top corridor"]),
  },
  {
    name: "Poison Moon", world: "JADE GARDEN", worldId: "jade-garden", backgroundId: "garden-poison-moon", loreFragmentId: "venom-inheritance", tint: "#20C98B", time: 78,
    platforms: [floor, p(70, 545, 260), p(630, 545, 260), p(365, 430, 230), p(95, 295, 225), p(640, 270, 225)],
    enemies: [e(150, 509, "love", "paired", "moon-pair"), e(700, 509, "doll", "frayed"), e(440, 394, "witch", "orbit"), e(175, 259, "eye", "shy", "moon-pair"), e(730, 234, "bat", "tracker")], current: { x: .13, y: -.25 }, secret: "noFloor",
    environment: {
      moonPools: [
        { id: "moon-left", ...r(55, 575, 285, 75), bubbleLift: -125 },
        { id: "moon-right", ...r(620, 575, 285, 75), bubbleLift: 65 },
      ],
      vines: [{ id: "moon-vine", platform: p(360, 305, 240), requiredChain: 2, activeSeconds: 8 }],
      blooms: [{ id: "moon-bud", x: 480, y: 275, requiredChain: 3, value: 1700, kind: "bud" }],
      riskPickups: [{ id: "moon-shard", x: 800, y: 605, value: 1300 }],
    },
    design: d("Use two moon pools with opposite buoyancy to preserve bubbles at different heights.", "Circle the Shy Eye and Frayed Doll instead of firing straight into them.", "Float the paired Heartling and Doll over the calm left pool.", "Use a two-chain to grow the central vine, then preserve that pair until the upper three are staged.", "The right pool shard drags bubbles downward and pressures timing.", "Clear without touching the lowest floor.", "Side shelves catch missed vine jumps; both pools remain movement pressure, never damage.", [58, 78], 3, "Grow the vine with the minimum chain, collect the bud on the ascent, then use the preserved pair as the final link.", ["left buoyant pool", "right technical pool"]),
  },
  {
    name: "Black Roses", world: "JADE GARDEN", worldId: "jade-garden", backgroundId: "garden-black-roses", loreFragmentId: "jade-key", tint: "#20C98B", time: 78,
    platforms: [floor, p(40, 470, 170), p(250, 560, 170), p(460, 470, 170), p(670, 560, 240), p(210, 300, 220), p(560, 245, 230)],
    enemies: [e(95, 434, "doll", "windup"), e(305, 524, "love", "excited"), e(515, 434, "witch", "chorus", "rose-chorus"), e(735, 524, "love", "paired", "rose-pair"), e(285, 264, "bat", "roost", "rose-pair"), e(650, 209, "eye", "sweep", "rose-chorus")], current: { x: -.12, y: -.32 }, secret: "oneChain",
    environment: {
      vines: [
        { id: "rose-vine-a", platform: p(100, 360, 110), requiredChain: 2, activeSeconds: 7 },
        { id: "rose-vine-b", platform: p(745, 350, 110), requiredChain: 3, activeSeconds: 7 },
      ],
      blooms: [
        { id: "rose-left", x: 145, y: 330, requiredChain: 2, value: 900, kind: "rose" },
        { id: "rose-right", x: 800, y: 320, requiredChain: 4, value: 1800, kind: "rose" },
        { id: "jade-bud", x: 480, y: 620, requiredChain: 5, value: 2400, kind: "bud" },
      ],
      moonPools: [{ id: "rose-pool", ...r(420, 570, 180, 80), bubbleLift: -35 }],
      riskPickups: [{ id: "rose-shard", x: 480, y: 610, value: 1600 }],
    },
    design: d("Grow alternating vine ledges while keeping one bubble alive over the moon pool.", "Split the Chorus pair, then wake the Roosting Bat with the preserved bubble.", "Chain the Doll and excited Heartling beside the left rose.", "Open both roses in sequence and use their vine windows to assemble a six-bubble garden arc.", "The Jade bud below the centre pool rewards a full controlled chain.", "Release every enemy in one chain.", "The staggered low shelves and centre pool return every fall to floor height.", [60, 78], 4, "Do not pop the first pair immediately; use it to wake the Bat and bridge the two rose clusters.", ["left rose first", "right rose technical route"]),
  },
  {
    name: "Serpent Glass", world: "CRIMSON CHAPEL", worldId: "crimson-chapel", backgroundId: "chapel-serpent-glass", loreFragmentId: "staged-fight", tint: "#C4133D", time: 82,
    platforms: [floor, p(55, 550, 220), p(370, 530, 220), p(685, 550, 220), p(185, 370, 220), p(555, 350, 220), p(350, 205, 260)],
    enemies: [e(130, 514, "love", "paired", "glass-pair"), e(445, 494, "doll", "windup"), e(750, 514, "witch", "orbit"), e(260, 334, "eye", "aimed"), e(630, 314, "bat", "feint", "glass-pair"), e(440, 169, "skull", "anchor")], current: { x: .03, y: -.36 }, secret: "trapFirst",
    environment: {
      candles: [
        { id: "glass-candle-1", order: 1, x: 110, y: 520 },
        { id: "glass-candle-2", order: 2, x: 480, y: 500 },
        { id: "glass-candle-3", order: 3, x: 810, y: 520 },
      ],
      contractGates: [{ id: "glass-gate", ...r(455, 300, 48, 230), requiredKinds: ["love", "doll"] }],
      waxPlatforms: [{ id: "glass-wax", platform: p(345, 410, 270), sinkDistance: 70, period: 7 }],
      riskPickups: [{ id: "glass-shard", x: 480, y: 170, value: 1900 }],
    },
    design: d("Light three plainly numbered seals while a wax bridge slowly sinks.", "Trap the Heartling and Doll together to open the visible contract gate.", "Build the required two-kind chain beneath the wax bridge.", "Carry that gate-opening pair upward and add the Anchor Skull plus airborne echoes for six.", "The top serpent shard sits behind the gate and Anchor Skull.", "Trap every echo before the first pop.", "The sinking bridge returns to a central floor shelf and the gate never blocks the low route.", [62, 82], 3, "Touch seals on the first lap, open the gate with the low pair, then climb during the wax reset.", ["safe candle circuit", "gate-and-wax score route"]),
  },
  {
    name: "Thirteen Candles", world: "CRIMSON CHAPEL", worldId: "crimson-chapel", backgroundId: "chapel-thirteen-candles", loreFragmentId: "blame-feeds", tint: "#C4133D", time: 82,
    platforms: [floor, p(35, 440, 205), p(280, 570, 190), p(520, 440, 190), p(755, 570, 170), p(120, 260, 240), p(560, 235, 270)],
    enemies: [e(100, 404, "doll", "frayed"), e(335, 534, "skull", "briar"), e(575, 404, "witch", "chorus", "candle-chorus"), e(800, 534, "love", "excited"), e(200, 224, "eye", "sweep", "candle-chorus"), e(650, 199, "bat", "roost")], current: { x: -.13, y: -.29 }, secret: "widow13",
    environment: {
      candles: [
        { id: "thirteen-1", order: 1, x: 85, y: 410 }, { id: "thirteen-2", order: 2, x: 330, y: 540 },
        { id: "thirteen-3", order: 3, x: 575, y: 410 }, { id: "thirteen-4", order: 4, x: 820, y: 540 },
      ],
      thorns: [
        { id: "thorn-left", ...r(235, 620, 55, 30), period: 4.4, warningSeconds: .8, activeSeconds: 1.2 },
        { id: "thorn-right", ...r(710, 620, 45, 30), period: 4.4, warningSeconds: .8, activeSeconds: 1.2, phase: .5 },
      ],
      contractGates: [{ id: "thirteen-gate", ...r(465, 340, 42, 230), requiredKinds: ["skull", "witch"] }],
      ritualTargetSeconds: 56,
      riskPickups: [{ id: "thirteen-shard", x: 480, y: 310, value: 2200 }],
    },
    design: d("Cross two alternating thorn lanes while reading a four-seal order engraved in the room.", "Use the Briar Skull and Chorus Witch together to open the centre contract gate.", "Trap the Doll and Skull after the left thorn retracts.", "Keep the low pair alive through the ritual, open the gate with a Skull/Witch chain, then bridge both upper platforms.", "The ritual shard doubles the route through the thorn timing windows.", "Keep the roaming Widow present for thirteen seconds before clearing.", "Thorn gaps always have a waiting shelf; missed upper jumps land on lower platforms or floor.", [64, 82], 4, "Light seals during warnings, hold the Skull bubble as the gate key, and finish inside the ritual target.", ["outer seal circuit", "centre contract shortcut"]),
  },
  {
    name: "Event Horizon", world: "THE BLACK BUBBLE", worldId: "black-bubble", backgroundId: "bubble-event-horizon", loreFragmentId: "shared-vow", tint: "#756CFF", time: 86, approach: true,
    platforms: [floor, p(60, 550, 170), p(275, 455, 180), p(505, 550, 180), p(735, 445, 170), p(570, 280, 210), p(210, 245, 210)],
    enemies: [e(115, 514, "skull", "anchor"), e(330, 419, "witch", "orbit"), e(560, 514, "doll", "frayed"), e(785, 409, "eye", "shy"), e(625, 244, "bat", "feint"), e(270, 209, "love", "excited")], current: { x: .18, y: -.22 }, secret: "noFloor",
    environment: {
      gravityZones: [
        { id: "horizon-heavy", ...r(30, 330, 285, 320), gravityScale: 1.28, bubbleLift: 20, label: "HEAVY" },
        { id: "horizon-float", ...r(645, 250, 285, 400), gravityScale: .62, bubbleLift: -70, label: "FLOAT" },
      ],
      phasePlatforms: [{ id: "horizon-phase", a: p(375, 350, 210), b: p(375, 235, 210), period: 5.2 }],
      echoBubbles: true,
      timeFracture: { interval: 6, replayDelay: 1.1 },
      riskPickups: [{ id: "horizon-shard", x: 840, y: 380, value: 2400 }],
    },
    design: d("Move between clearly labelled heavy and float zones while a platform phases between previewed positions.", "Use the Anchor Skull as a stable chain endpoint and circle the Shy Eye through low gravity.", "Trap the Skull and Doll at floor height before entering either gravity zone.", "Preserve the heavy-zone pair, use its harmless echo pop as a bridge cue, and connect all six across the phase platform.", "The float-zone shard is quick to reach but changes jump and bubble timing.", "Clear without touching the lowest floor.", "The phase platform always previews its other position; both gravity zones drop to broad shelves.", [66, 86], 4, "Enter float on the platform's upward beat, collect the shard, then pop as the time fracture replays the Feinting Bat away from the chain.", ["heavy left ascent", "float right shortcut"]),
  },
  {
    name: "The Widow Unveiled", world: "THE BLACK BUBBLE", worldId: "black-bubble", backgroundId: "bubble-widow", loreFragmentId: "dawn", tint: "#C4133D", time: 108, boss: true,
    platforms: [floor, p(40, 525, 220), p(370, 560, 220), p(700, 525, 220), p(155, 340, 220), p(585, 340, 220), p(350, 180, 260)],
    enemies: [e(140, 489, "skull", "anchor"), e(455, 524, "doll", "windup"), e(770, 489, "skull", "briar"), e(230, 304, "witch", "chorus", "widow-chorus"), e(660, 304, "eye", "sweep", "widow-chorus"), e(440, 144, "bat", "roost")], current: { x: 0, y: -.38 }, secret: "oneChain",
    environment: {
      gravityZones: [{ id: "widow-float", ...r(325, 115, 310, 225), gravityScale: .78, bubbleLift: -40, label: "FLOAT" }],
      phasePlatforms: [
        { id: "widow-left", a: p(110, 430, 170), b: p(110, 300, 170), period: 5.8 },
        { id: "widow-right", a: p(680, 430, 170), b: p(680, 300, 170), period: 5.8, phase: .5 },
      ],
      echoBubbles: true,
      riskPickups: [{ id: "widow-shard", x: 480, y: 145, value: 3000 }],
    },
    design: d("Redirect bound echoes through contract anchors, mirrored clauses, and one final shared chain.", "Enemy formations are resources for breaking the Widow's contract rather than targets for direct damage.", "Feed the two floor echoes into the plainly marked Host anchors.", "Join the four Shared Vow echoes with deliberately placed vow bubbles, then release them together.", "The high dawn shard requires the phase-platform crossing during Split Clause.", "Release the room's bound echoes in one final chain.", "Each act restores from a fair phase checkpoint; all falls return to floor or wide side shelves.", [80, 108], 5, "Bank the risk shard in Split Clause, bridge the four central echoes without touching them early, then trigger the full chain.", ["outer phase platforms", "central float reconciliation route"]),
  },
];

// Hidden vault reached only through Original/Extra Mode — a short score-chase
// detour, not one of the twelve canonical chambers.
export const BONUS_LEVEL: Level = {
  name: "The Dirty Gold Vault", world: "VELVET DRAIN", worldId: "velvet-drain", backgroundId: "velvet-bonus-vault", loreFragmentId: "bonus-vault", tint: "#FFD36A", time: 34, bonus: true,
  platforms: [floor, p(100, 560, 210), p(650, 560, 210), p(375, 435, 210), p(100, 315, 210), p(650, 315, 210)],
  enemies: [e(170, 524, "love", "paired", "vault-a"), e(720, 524, "love", "paired", "vault-a"), e(420, 399, "love", "excited"), e(500, 399, "love", "excited"), e(170, 279, "love", "paired", "vault-b"), e(720, 279, "love", "paired", "vault-b")],
  current: { x: 0, y: -.15 }, secret: "oneChain",
  environment: { riskPickups: [{ id: "vault-shard", x: 480, y: 620, value: 1800 }] },
  design: d("Sweep two mirrored shelf stacks before the short vault timer expires.", "Keep paired Heartlings together while the excited pair reacts to each trap.", "Trap the two centre Heartlings and pop from the middle shelf.", "Preserve all six bubbles across the mirrored shelves for one vault chain.", "The floor gold shard costs a full descent and ascent.", "Release the full room in one chain.", "Every shelf drops to the full vault floor.", [24, 34], 3, "Trap from top to bottom, take the shard on the final descent, then pop the centre link.", ["left shelf loop", "right shelf loop"]),
};

const encore = (
  name: string,
  worldId: WorldId,
  world: string,
  backgroundId: string,
  tint: string,
  time: number,
  platforms: Platform[],
  enemies: EnemySpawn[],
  environment: LevelEnvironment,
  design: ChamberDesign,
  medalTargets: EncoreMedalTargets,
): Level => ({ name, worldId, world, backgroundId, tint, time, platforms, enemies, environment, design, medalTargets, current: { x: 0, y: -.28 }, secret: "mechanicMastery", loreFragmentId: `encore-${worldId}`, encore: true, encoreId: worldId });

export const ENCORE_LEVELS: Level[] = [
  encore("Pressure Encore", "velvet-drain", "VELVET DRAIN", "velvet-encore", "#087CFF", 48,
    [floor, p(50, 550, 185), p(275, 455, 180), p(505, 350, 180), p(730, 455, 180), p(390, 215, 180)],
    [e(120, 514, "love", "excited"), e(340, 419, "bat", "feint"), e(570, 314, "eye", "sweep"), e(790, 419, "love", "paired", "encore-pressure"), e(450, 179, "skull", "anchor", "encore-pressure")],
    { currents: [{ id: "encore-pressure", ...r(210, 180, 550, 410), vector: { x: .6, y: -.35 }, label: "RIGHT", valveId: "encore-pressure-valve" }], valves: [{ id: "encore-pressure-valve", x: 80, y: 515, mode: "reverse" }], drains: [{ id: "encore-pressure-drain", ...r(350, 610, 260, 40), pull: 130 }], riskPickups: [{ id: "encore-pressure-shard", x: 870, y: 600, value: 2200 }] },
    d("Reverse one strong current while the drain compresses the centre lane.", "Manage Feint and Sweep telegraphs without losing the paired anchor chain.", "Trap the two floor echoes beside the valve.", "Reverse mid-grace to sweep all five bubbles through one link.", "The far drain shard is worth the timer risk.", "Clear with a five-link chain.", "The full floor and stepped shelves recover every miss.", [35, 48], 5, "Take the shard on the opening read, then reverse only once for the full-room sweep.", ["shelf climb", "current carry"]),
    { score: 18000, fullChain: 5, time: 42 }),
  encore("Mirror Encore", "heartbreak-hotel", "HEARTBREAK HOTEL", "hotel-encore", "#FF2A9D", 50,
    [floor, p(70, 540, 185), p(350, 470, 260), p(705, 540, 185), p(120, 260, 210), p(630, 260, 210)],
    [e(135, 504, "doll", "frayed"), e(425, 434, "eye", "shy"), e(765, 504, "witch", "orbit"), e(190, 224, "bat", "feint"), e(690, 224, "love", "excited")],
    { mirrorDoors: [{ id: "encore-mirror-a", pairId: "encore-mirror-b", ...r(25, 450, 40, 82), preview: "RIGHT" }, { id: "encore-mirror-b", pairId: "encore-mirror-a", ...r(895, 170, 40, 82), preview: "LEFT" }], lifts: [{ id: "encore-mirror-lift", platform: p(445, 570, 70), toY: 245, period: 4.8 }], revealPlatforms: [{ id: "encore-mirror-reveal", platform: p(430, 305, 100), mirror: r(700, 175, 90, 75) }], riskPickups: [{ id: "encore-mirror-shard", x: 480, y: 275, value: 2300 }] },
    d("Portal a lift-carried chain through an asymmetrical mirror room.", "Circle the Shy Eye while Feint and Orbit warnings cross.", "Trap the low Doll and Eye at the lift base.", "Reveal the bridge, portal the upper trio, and meet the low pair at lift apex.", "The revealed bridge shard sits in the crossing fire.", "Clear with a five-link chain.", "Preview arrows and the full floor make every transfer recoverable.", [37, 50], 5, "Send bubbles first, take the revealed shard, then ride the lift into the portal chain.", ["lift safety", "mirror shortcut"]),
    { score: 19500, fullChain: 5, time: 44 }),
  encore("Garden Encore", "jade-garden", "JADE GARDEN", "garden-encore", "#20C98B", 52,
    [floor, p(45, 540, 200), p(715, 540, 200), p(285, 420, 180), p(505, 420, 180), p(365, 230, 230)],
    [e(115, 504, "love", "paired", "garden-encore"), e(770, 504, "doll", "windup", "garden-encore"), e(340, 384, "witch", "chorus", "garden-chorus"), e(560, 384, "eye", "sweep", "garden-chorus"), e(450, 194, "bat", "roost")],
    { moonPools: [{ id: "encore-pool-a", ...r(30, 575, 300, 75), bubbleLift: -120 }, { id: "encore-pool-b", ...r(630, 575, 300, 75), bubbleLift: 70 }], vines: [{ id: "encore-vine-a", platform: p(155, 330, 120), requiredChain: 2, activeSeconds: 6 }, { id: "encore-vine-b", platform: p(685, 315, 120), requiredChain: 3, activeSeconds: 6 }], blooms: [{ id: "encore-rose", x: 480, y: 200, requiredChain: 4, value: 2500, kind: "rose" }], riskPickups: [{ id: "encore-garden-shard", x: 835, y: 610, value: 2200 }] },
    d("Preserve bubbles across opposite moon pools while chain-grown vines expire.", "Break the Chorus and wake the Bat only when the chain is ready.", "Use the paired floor echoes for the first vine.", "Keep that pair, grow both vines, and close a five-link crown around the rose.", "The heavy-pool shard threatens the preserve timer.", "Open the rose with a four-chain and finish with five.", "Both pools are non-damaging and return to broad floor shelves.", [39, 52], 5, "Use Jade control or Vesper launch force deliberately; both routes meet at the rose.", ["buoyant preserve", "heavy-pool score line"]),
    { score: 21000, fullChain: 5, time: 46 }),
  encore("Contract Encore", "crimson-chapel", "CRIMSON CHAPEL", "chapel-encore", "#C4133D", 54,
    [floor, p(45, 525, 190), p(285, 450, 180), p(510, 450, 180), p(735, 525, 180), p(350, 235, 260)],
    [e(110, 489, "skull", "briar"), e(340, 414, "doll", "frayed"), e(565, 414, "witch", "chorus", "contract-chorus"), e(790, 489, "eye", "sweep", "contract-chorus"), e(440, 199, "bat", "feint")],
    { candles: [{ id: "encore-contract-1", order: 1, x: 90, y: 495 }, { id: "encore-contract-2", order: 2, x: 375, y: 420 }, { id: "encore-contract-3", order: 3, x: 580, y: 420 }, { id: "encore-contract-4", order: 4, x: 845, y: 495 }], contractGates: [{ id: "encore-contract-gate", ...r(455, 290, 46, 235), requiredKinds: ["skull", "witch"] }], thorns: [{ id: "encore-contract-thorn-a", ...r(235, 620, 48, 30), period: 4, warningSeconds: .75, activeSeconds: 1.1 }, { id: "encore-contract-thorn-b", ...r(690, 620, 45, 30), period: 4, warningSeconds: .75, activeSeconds: 1.1, phase: .5 }], waxPlatforms: [{ id: "encore-contract-wax", platform: p(360, 340, 240), sinkDistance: 85, period: 5.5 }], ritualTargetSeconds: 43, riskPickups: [{ id: "encore-contract-shard", x: 480, y: 200, value: 2600 }] },
    d("Execute a readable seal circuit between alternating thorns and a sinking wax bridge.", "Preserve Skull and Witch as the gate contract while the Chorus pair pressures lanes.", "Trap the Skull and Doll after the first thorn warning.", "Open the gate, light the last seal, and include every echo in the ritual chain.", "The top shard demands the wax bridge's shortest window.", "Complete the ritual target and a five-chain.", "Waiting shelves sit before both thorn lines; the floor stays continuous.", [41, 54], 5, "Light two seals per thorn cycle and open the gate just before the wax bridge resets.", ["outer seal circuit", "wax bridge gate"]),
    { score: 22500, fullChain: 5, time: 47 }),
  encore("Time Encore", "black-bubble", "THE BLACK BUBBLE", "bubble-encore", "#756CFF", 58,
    [floor, p(50, 540, 180), p(270, 430, 170), p(520, 540, 170), p(735, 420, 175), p(360, 225, 240)],
    [e(110, 504, "skull", "anchor"), e(325, 394, "witch", "orbit"), e(575, 504, "doll", "windup"), e(790, 384, "eye", "shy"), e(440, 189, "bat", "feint"), e(540, 189, "love", "excited")],
    { gravityZones: [{ id: "encore-time-heavy", ...r(25, 310, 280, 340), gravityScale: 1.3, bubbleLift: 25, label: "HEAVY" }, { id: "encore-time-float", ...r(655, 245, 280, 405), gravityScale: .58, bubbleLift: -80, label: "FLOAT" }], phasePlatforms: [{ id: "encore-time-phase-a", a: p(360, 365, 220), b: p(360, 245, 220), period: 4.6 }, { id: "encore-time-phase-b", a: p(120, 300, 120), b: p(720, 300, 120), period: 6.4 }], echoBubbles: true, timeFracture: { interval: 5, replayDelay: 1 }, riskPickups: [{ id: "encore-time-shard", x: 850, y: 610, value: 3000 }] },
    d("Cross two previewed phase paths while heavy and float timing alternate.", "Use the Anchor as a fixed endpoint while Shy and Feint threats replay.", "Trap the low Anchor and Doll outside the gravity zones.", "Carry six bubbles through both phase positions and trigger during the echo grace.", "The float-floor shard gives the highest medal value but the longest recovery.", "Clear with a six-link chain.", "Ghost previews show every platform destination; all falls return to broad floor.", [44, 58], 5, "Bank the shard first, trap from heavy to float, and let the delayed echo mark the final pop beat.", ["heavy phase climb", "float score route"]),
    { score: 26000, fullChain: 6, time: 50 }),
];

export const ALL_PLAYABLE_LEVELS = [...LEVELS, BONUS_LEVEL, ...ENCORE_LEVELS];
