/**
 * BUBBLE HEX — Forbidden Expansion, milestone 4: familiars (pure rules).
 *
 * Six earnable companions with a small finite-state machine
 * (idle · follow · sleep · celebrate · react), a distinct way of moving,
 * expressions, deterministic gameplay unlocks and one small, cooldown-limited
 * assist each. Nothing here touches the engine; familiar-expansion.ts wires it in.
 */

export type FamiliarId = "hex_cat" | "blue_snake" | "nevermore" | "boo" | "velvet" | "vamp";
export type FamiliarMotion = "prowl" | "slither" | "hop" | "drift" | "skitter" | "flutter";
export type AssistKind = "ninelives" | "coil" | "omen" | "spook" | "silk" | "drain";
export type UnlockKind = "stagesCleared" | "itemsDiscovered" | "secrets" | "bestChain" | "perfectClears";

export type FamiliarDefinition = {
  id: FamiliarId;
  name: string;
  icon: string;
  frames: readonly [string, string, string, string];
  tint: string;
  motion: FamiliarMotion;
  /** Fliers hover near the hero's shoulder; walkers keep to the hero's floor. */
  flier: boolean;
  idleBehaviour: string;
  assist: { kind: AssistKind; name: string; cooldown: number; perStage: number; summary: string };
  unlock: { kind: UnlockKind; need: number; hint: string };
};

const frames = (id: string) => [0, 1, 2, 3].map(i => `${id}_idle_${i}`) as unknown as readonly [string, string, string, string];

export const FAMILIARS: readonly FamiliarDefinition[] = [
  { id: "hex_cat", name: "Hex Cat", icon: "hex_cat", frames: frames("hex_cat"), tint: "#B07CFF", motion: "prowl", flier: false,
    idleBehaviour: "Grooms, then flicks its tail at you.",
    assist: { kind: "ninelives", name: "Nine Lives", cooldown: 30, perStage: 1, summary: "Once per chamber, adds 1.5s of safety after you are hit." },
    unlock: { kind: "stagesCleared", need: 1, hint: "Clear your first chamber." } },
  { id: "blue_snake", name: "Blue $nake", icon: "blue_snake", frames: frames("blue_snake"), tint: "#2FD3E0", motion: "slither", flier: false,
    idleBehaviour: "Coils up and tastes the air.",
    assist: { kind: "coil", name: "Coil", cooldown: 15, perStage: 4, summary: "Wraps a bubble about to burst: +1s to pop it." },
    unlock: { kind: "itemsDiscovered", need: 4, hint: "Discover 4 different items." } },
  { id: "nevermore", name: "Nevermore", icon: "nevermore", frames: frames("nevermore"), tint: "#FF5A7A", motion: "hop", flier: false,
    idleBehaviour: "Pecks at the floor and cocks its head.",
    assist: { kind: "omen", name: "Omen", cooldown: 20, perStage: 1, summary: "Once per chamber, croaks the chamber's secret clue." },
    unlock: { kind: "secrets", need: 1, hint: "Find any chamber secret." } },
  { id: "boo", name: "Boo", icon: "boo", frames: frames("boo"), tint: "#C8C2FF", motion: "drift", flier: true,
    idleBehaviour: "Bobs and blushes.",
    assist: { kind: "spook", name: "Spook", cooldown: 18, perStage: 99, summary: "Spooks an enemy that gets too close: frozen for 1s." },
    unlock: { kind: "bestChain", need: 5, hint: "Pop a chain of 5." } },
  { id: "velvet", name: "Velvet", icon: "velvet", frames: frames("velvet"), tint: "#FF5AB8", motion: "skitter", flier: false,
    idleBehaviour: "Spins a little thread and dangles.",
    assist: { kind: "silk", name: "Silk Line", cooldown: 14, perStage: 99, summary: "Reels in the nearby pickup closest to vanishing." },
    unlock: { kind: "perfectClears", need: 2, hint: "Clear 2 chambers without damage." } },
  { id: "vamp", name: "Vamp", icon: "vamp", frames: frames("vamp"), tint: "#FF3D6E", motion: "flutter", flier: true,
    idleBehaviour: "Hangs upside down, wings folded.",
    assist: { kind: "drain", name: "Drain", cooldown: 20, perStage: 3, summary: "A chain of 3+ drains 3s back onto the clock." },
    unlock: { kind: "stagesCleared", need: 6, hint: "Clear 6 chambers." } },
];

export const FAMILIAR_IDS: readonly FamiliarId[] = FAMILIARS.map(f => f.id);
const BY_ID = new Map(FAMILIARS.map(f => [f.id, f]));
export const familiarById = (id: unknown) => (typeof id === "string" ? BY_ID.get(id as FamiliarId) : undefined);
export const isFamiliarId = (id: unknown): id is FamiliarId => typeof id === "string" && BY_ID.has(id as FamiliarId);

export const FAMILIAR_LIMITS = {
  size: 58,
  sleepAfter: 6,
  celebrateTime: 1.3,
  hurtTime: 1.1,
  deathTime: 1.8,
  startleTime: 0.5,
  followDist: 64,
  maxSpeed: 320,
  frameTime: 0.15,
  sayTime: 1.4,
  omenAfter: 20,
  drainSeconds: 3,
  spookRadius: 80,
  silkRadius: 280,
  silkMaxLife: 3,
  ninelivesSeconds: 1.5,
  coilSeconds: 1,
  bounds: { minX: 40, maxX: 920, minY: 104, maxY: 676 },
  maxTitleWalkers: 3,
} as const;

/* -------------------------------------------------------------- unlocks */

export type UnlockStats = Record<UnlockKind, number>;

/** Deterministic: every familiar whose milestone is met and is not yet unlocked. */
export function evaluateUnlocks(stats: UnlockStats, unlocked: readonly string[]): FamiliarId[] {
  return FAMILIARS.filter(f => !unlocked.includes(f.id) && (stats[f.unlock.kind] ?? 0) >= f.unlock.need).map(f => f.id);
}

export function unlockProgress(def: FamiliarDefinition, stats: UnlockStats) {
  return { have: Math.min(def.unlock.need, Math.floor(stats[def.unlock.kind] ?? 0)), need: def.unlock.need };
}

/* -------------------------------------------------------------- assists */

export type AssistClock = { cooldown: number; usedThisStage: number };
export const newAssistClock = (): AssistClock => ({ cooldown: 0, usedThisStage: 0 });

export function assistReady(clock: AssistClock, def: FamiliarDefinition, ctx: { attract: boolean; enabled: boolean }): boolean {
  return !ctx.attract && ctx.enabled && clock.cooldown <= 0 && clock.usedThisStage < def.assist.perStage;
}
export function spendAssist(clock: AssistClock, def: FamiliarDefinition) { clock.cooldown = def.assist.cooldown; clock.usedThisStage++; }
export function tickAssist(clock: AssistClock, dt: number) { clock.cooldown = Math.max(0, clock.cooldown - dt); }
export function resetAssistStage(clock: AssistClock) { clock.usedThisStage = 0; clock.cooldown = Math.min(clock.cooldown, 3); }

/* -------------------------------------------------------- state machine */

export type FamiliarState = "idle" | "follow" | "sleep" | "celebrate" | "react";
export type Expression = "neutral" | "happy" | "love" | "sleepy" | "sweat" | "sad" | "surprised";
export type FamiliarEvent = "hurt" | "death" | "startle" | "combo" | "bigChain" | "clear" | "unlock" | "assist";

const EVENT_PRIORITY: Record<FamiliarEvent, number> = { death: 6, hurt: 5, bigChain: 4, clear: 3, unlock: 3, combo: 2, assist: 1, startle: 1 };

export type FamiliarBody = {
  id: FamiliarId;
  x: number; y: number; vx: number; vy: number;
  facing: 1 | -1;
  state: FamiliarState;
  stateTime: number;
  expression: Expression;
  event: FamiliarEvent | null;
  eventTime: number;
  playerIdle: number;
  frameClock: number;
  motionClock: number;
  airborne: boolean;
  squash: number;
  tilt: number;
  say: string;
  sayTime: number;
};

export function newBody(id: FamiliarId, x: number, y: number): FamiliarBody {
  return { id, x, y, vx: 0, vy: 0, facing: 1, state: "idle", stateTime: 0, expression: "neutral", event: null, eventTime: 0,
    playerIdle: 0, frameClock: 0, motionClock: 0, airborne: false, squash: 0, tilt: 0, say: "", sayTime: 0 };
}

const EVENT_DURATION: Record<FamiliarEvent, number> = {
  death: FAMILIAR_LIMITS.deathTime, hurt: FAMILIAR_LIMITS.hurtTime, startle: FAMILIAR_LIMITS.startleTime,
  combo: FAMILIAR_LIMITS.celebrateTime * 0.7, bigChain: FAMILIAR_LIMITS.celebrateTime, clear: FAMILIAR_LIMITS.celebrateTime,
  unlock: FAMILIAR_LIMITS.celebrateTime, assist: 0.8,
};
const EVENT_EXPRESSION: Record<FamiliarEvent, Expression> = {
  death: "sad", hurt: "sweat", startle: "surprised", combo: "happy", bigChain: "love", clear: "love", unlock: "love", assist: "happy",
};

/** Feed a gameplay event; higher-priority reactions are never interrupted by lower ones. */
export function notify(f: FamiliarBody, event: FamiliarEvent, say = ""): boolean {
  if (f.event && f.eventTime > 0 && EVENT_PRIORITY[f.event] > EVENT_PRIORITY[event]) return false;
  f.event = event; f.eventTime = EVENT_DURATION[event];
  f.state = event === "hurt" || event === "death" || event === "startle" ? "react" : "celebrate";
  f.stateTime = 0; f.expression = EVENT_EXPRESSION[event];
  if (say) { f.say = say; f.sayTime = FAMILIAR_LIMITS.sayTime; }
  if (event !== "startle") f.playerIdle = 0;
  return true;
}

export type StepInput = {
  dt: number;
  hero: { x: number; y: number; facing: 1 | -1 };
  /** Bottom of the hero's feet (walkers stand here). */
  floorY: number;
  playerActive: boolean;
  reducedMotion: boolean;
  rng?: () => number;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function anchor(def: FamiliarDefinition, f: FamiliarBody, input: StepInput) {
  const side = -input.hero.facing;
  const tx = input.hero.x + side * 50;
  const ty = def.flier ? input.hero.y - 46 : input.floorY;
  if (def.motion === "flutter" && !input.reducedMotion) return { x: tx + Math.cos(f.motionClock * 1.8) * 18, y: ty + Math.sin(f.motionClock * 3.6) * 9 };
  if (def.motion === "drift" && !input.reducedMotion) return { x: tx, y: ty + Math.sin(f.motionClock * 2.2) * 7 };
  return { x: tx, y: ty };
}

/** One fixed step. Positions, speeds and timers are always bounded. */
export function stepFamiliar(f: FamiliarBody, input: StepInput): FamiliarBody {
  const def = familiarById(f.id)!;
  const { dt } = input;
  const L = FAMILIAR_LIMITS;
  f.stateTime += dt; f.motionClock += dt;
  if (!input.reducedMotion) f.frameClock += dt;
  f.sayTime = Math.max(0, f.sayTime - dt);
  f.squash = Math.max(0, f.squash - dt * 4);

  // Sleep cycle: the hero standing still for a while sends the familiar to sleep.
  f.playerIdle = input.playerActive ? 0 : f.playerIdle + dt;
  if (f.eventTime > 0) {
    f.eventTime -= dt;
    if (f.eventTime <= 0) { f.event = null; f.state = "idle"; f.expression = "neutral"; f.stateTime = 0; }
  } else if (f.state === "sleep") {
    if (input.playerActive) notify(f, "startle");
  } else if (f.playerIdle >= L.sleepAfter) {
    f.state = "sleep"; f.stateTime = 0; f.expression = "sleepy";
  }

  const goal = anchor(def, f, input);
  const dx = goal.x - f.x, dy = goal.y - f.y, dist = Math.hypot(dx, dy);
  const lock = f.state === "sleep" || f.event === "death";
  if (!lock && f.state !== "celebrate" && f.state !== "react") f.state = Math.abs(dx) > L.followDist || (def.flier && dist > L.followDist) ? "follow" : "idle";

  if (lock) { f.vx *= Math.pow(0.02, dt); }
  else switch (def.motion) {
    case "prowl": case "slither": {
      const speed = def.motion === "slither" ? 210 : 270;
      const want = Math.abs(dx) > L.followDist * 0.5 ? Math.sign(dx) * Math.min(speed, Math.abs(dx) * 3) : 0;
      f.vx += (want - f.vx) * Math.min(1, dt * (def.motion === "slither" ? 4 : 7));
      break;
    }
    case "hop": {
      if (!f.airborne && Math.abs(dx) > L.followDist * 0.6 && f.stateTime % 0.32 < dt) {
        f.vx = clamp(dx * 2.2, -L.maxSpeed, L.maxSpeed); f.vy = Math.abs(dx) > 220 ? -420 : -230; f.airborne = true;
      }
      if (!f.airborne) f.vx *= Math.pow(0.001, dt);
      break;
    }
    case "skitter": {
      const phase = f.motionClock % 0.6;
      f.vx = Math.abs(dx) > L.followDist * 0.5 && phase < 0.2 ? Math.sign(dx) * 380 : f.vx * Math.pow(0.0005, dt);
      break;
    }
    case "drift": case "flutter": {
      const k = def.motion === "drift" ? 2.2 : 4;
      f.vx = dx * k; f.vy = dy * k;
      break;
    }
  }
  if (f.state === "celebrate" && !def.flier && !f.airborne && !input.reducedMotion && f.stateTime % 0.45 < dt) { f.vy = -200; f.airborne = true; }

  f.vx = clamp(f.vx, -L.maxSpeed, L.maxSpeed); f.vy = clamp(f.vy, -L.maxSpeed * 1.5, L.maxSpeed * 1.5);
  f.x += f.vx * dt;
  if (def.flier) f.y += f.vy * dt;
  else if (f.airborne) {
    f.vy += 1100 * dt; f.y += f.vy * dt;
    if (f.y >= input.floorY) { f.y = input.floorY; f.vy = 0; f.airborne = false; f.squash = input.reducedMotion ? 0 : 0.35; }
  } else {
    // Walkers glide to the hero's floor (handles platforms) at a bounded rate.
    const fy = input.floorY - f.y;
    f.y += Math.abs(fy) > 140 ? fy : clamp(fy, -360 * dt, 360 * dt);
    if (Math.abs(fy) > 140) f.vy = 0;
  }
  f.x = clamp(f.x, L.bounds.minX, L.bounds.maxX); f.y = clamp(f.y, L.bounds.minY, L.bounds.maxY);
  if (Math.abs(f.vx) > 12) f.facing = f.vx > 0 ? 1 : -1;
  f.tilt = f.event === "hurt" ? (input.reducedMotion ? 0.15 : 0.25 * Math.sin(f.stateTime * 18)) : f.event === "death" ? 0.35 : def.motion === "slither" && !input.reducedMotion ? 0.06 * Math.sin(f.motionClock * 9) : 0;
  return f;
}

/** Idle animation frame index (frame 0 when reduced motion freezes decorative loops). */
export const frameIndex = (f: FamiliarBody, reducedMotion: boolean) => (reducedMotion ? 0 : Math.floor(f.frameClock / FAMILIAR_LIMITS.frameTime) % 4);

/* --------------------------------------------------------- title wander */

export type Walker = { id: FamiliarId; x: number; dir: 1 | -1; pause: number; clock: number };

export function stepWalker(w: Walker, dt: number, minX: number, maxX: number, rng: () => number, reducedMotion: boolean) {
  w.clock += dt;
  if (reducedMotion) return w;
  if (w.pause > 0) { w.pause -= dt; return w; }
  w.x += w.dir * 46 * dt;
  if (w.x < minX) { w.x = minX; w.dir = 1; w.pause = 0.8 + rng(); }
  if (w.x > maxX) { w.x = maxX; w.dir = -1; w.pause = 0.8 + rng(); }
  if (rng() < dt * 0.15) w.pause = 0.6 + rng() * 1.2;
  return w;
}
