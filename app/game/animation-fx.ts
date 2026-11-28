/**
 * Visual-only animation state for heroes, enemies and the Widow (Expansion M7).
 *
 * Nothing in here is read by the simulation: the engine feeds this module
 * read-only snapshots once per fixed tick and reads smoothed values back while
 * drawing. Removing the module would change how the game looks, never how it
 * plays. All storage is bounded (one slot per live enemy, <= MAX_GHOSTS defeat
 * ghosts) and slots are recycled, so a long session allocates nothing per frame.
 */
export const MAX_GHOSTS = 16;
export const GHOST_LIFE = 0.8;

export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const num = (n: unknown, fallback = 0) => (typeof n === "number" && Number.isFinite(n) ? n : fallback);

/** Damped spring that starts at 1 and rings out. `age` in seconds since the event. */
export function ring(age: number, decay = 7, freq = 18): number {
  return age < 0 || age > 1.2 ? 0 : Math.exp(-decay * age) * Math.cos(freq * age);
}
/** Overshooting ease-out used for pop-ins. */
export function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
}

/** 0 eyes open, 1 fully closed. Blinks every ~3.3s, with an occasional double blink. */
export function blinkAmount(time: number): number {
  const cycle = time % 3.3;
  const double = Math.floor(time / 3.3) % 3 === 2;
  const one = cycle < 0.16 ? Math.sin((cycle / 0.16) * Math.PI) : 0;
  const two = double && cycle > 0.3 && cycle < 0.46 ? Math.sin(((cycle - 0.3) / 0.16) * Math.PI) : 0;
  return Math.max(one, two);
}
/** Slow chest rise and fall, -1..1. */
export const breathe = (time: number) => Math.sin(time * 2.1);
/** 0..1 envelope for an idle fidget (look around, tail flick). Happens for ~1.6s every 8s. */
export function fidgetAmount(time: number): number {
  const c = time % 8;
  return c > 5.2 && c < 6.8 ? Math.sin(((c - 5.2) / 1.6) * Math.PI) : 0;
}
/** Which way the eyes drift during a fidget: -1 back, +1 forward. */
export const fidgetLook = (time: number) => Math.sin(time * 3.4);

export type HeroFxInput = {
  grounded: boolean; vy: number; facing: 1 | -1; invuln: number; throwTimer: number;
  state: string; calm: boolean; hitStop: boolean;
};
export type HeroFx = {
  turn: number; takeoffAge: number; hitAge: number; shotAge: number; landAge: number;
  prevGrounded: boolean; prevInvuln: number; prevThrow: number; prevVy: number; celebrate: number; lastFacing: 1 | -1;
};

export type EnemyFxInput = {
  id: number; state: string; vx: number; vy: number; cooldown: number; timer: number; x: number; w: number;
};
export type EnemyFx = {
  id: number; seen: number; face: number; shotAge: number; landAge: number; freeAge: number; trapAge: number; hitAge: number;
  prevState: string; prevCooldown: number; prevVy: number; fury: number;
};
export type Ghost = { id: number; x: number; y: number; age: number; face: number; spin: number };
export type WidowFxInput = { hp: number; maxHp: number; phase: string; phaseTimer: number; x: number; y: number };

export class AnimationFx {
  readonly hero: HeroFx = {
    turn: 1, takeoffAge: 9, hitAge: 9, shotAge: 9, landAge: 9, prevGrounded: true, prevInvuln: 0, prevThrow: 0, prevVy: 0, celebrate: 0, lastFacing: 1,
  };
  private readonly enemies = new Map<number, EnemyFx>();
  private readonly pool: EnemyFx[] = [];
  readonly ghosts: Ghost[] = [];
  widowHitAge = 9; widowRage = 0; private widowPrevHp = -1; widowDeathAge = 0;
  private tick = 0;

  reset() {
    for (const fx of this.enemies.values()) this.pool.push(fx);
    this.enemies.clear();
    this.ghosts.length = 0;
    this.widowHitAge = 9; this.widowRage = 0; this.widowPrevHp = -1; this.widowDeathAge = 0;
    this.hero.hitAge = 9; this.hero.celebrate = 0;
  }

  // ---- hero ----
  updateHero(dt: number, p: HeroFxInput) {
    const h = this.hero;
    h.takeoffAge += dt; h.hitAge += dt; h.shotAge += dt; h.landAge += dt;
    if (p.calm) h.turn = p.facing;
    else {
      // Turn around over ~90ms instead of snapping; the art squishes through the flip.
      const k = 1 - Math.exp(-dt * 24);
      h.turn += (p.facing - h.turn) * k;
      if (Math.abs(h.turn - p.facing) < 0.02) h.turn = p.facing;
    }
    if (h.prevGrounded && !p.grounded && p.vy < 0) h.takeoffAge = 0;
    if (!h.prevGrounded && p.grounded && h.prevVy > 140) h.landAge = 0;
    if (p.throwTimer > h.prevThrow + 0.05) h.shotAge = 0;
    h.celebrate = p.state === "stageClear" || p.state === "victory" ? h.celebrate + dt : 0;
    h.prevGrounded = p.grounded; h.prevInvuln = p.invuln; h.prevThrow = p.throwTimer; h.prevVy = p.vy; h.lastFacing = p.facing;
  }
  heroHurt() { this.hero.hitAge = 0; }

  // ---- enemies ----
  private slot(id: number): EnemyFx {
    let fx = this.enemies.get(id);
    if (!fx) {
      fx = this.pool.pop() ?? ({} as EnemyFx);
      fx.id = id; fx.seen = this.tick; fx.face = 1; fx.shotAge = 9; fx.landAge = 9; fx.freeAge = 9; fx.trapAge = 0; fx.hitAge = 9;
      fx.prevState = "normal"; fx.prevCooldown = 0; fx.prevVy = 0; fx.fury = 0;
      this.enemies.set(id, fx);
    }
    return fx;
  }
  /** Returns the slot for drawing; creates one lazily so late-spawned enemies are safe. */
  enemy(id: number): EnemyFx { return this.slot(id); }

  updateEnemy(dt: number, e: EnemyFxInput, playerX: number, calm: boolean) {
    const id = num(e.id, -999);
    const fx = this.slot(id);
    fx.seen = this.tick;
    fx.shotAge += dt; fx.landAge += dt; fx.freeAge += dt; fx.hitAge += dt;
    const state = String(e.state);
    const vx = num(e.vx), vy = num(e.vy), cooldown = num(e.cooldown);
    const want = Math.abs(vx) > 6 ? (vx > 0 ? 1 : -1) : (playerX > num(e.x) + num(e.w) / 2 ? 1 : -1);
    fx.face = calm ? want : fx.face + (want - fx.face) * (1 - Math.exp(-dt * 12));
    if (state === "trapped") fx.trapAge += dt; else if (fx.prevState === "trapped") { fx.freeAge = 0; fx.trapAge = 0; }
    if (cooldown > fx.prevCooldown + 0.3 && state !== "trapped") fx.shotAge = 0; // fired: cooldown reset upward
    if (state !== "trapped" && fx.prevVy > 180 && vy === 0) fx.landAge = 0;
    fx.fury += ((state === "furious" ? 1 : 0) - fx.fury) * (1 - Math.exp(-dt * 6));
    fx.prevState = state; fx.prevCooldown = cooldown; fx.prevVy = vy;
  }
  /** Call once per tick after updateEnemy for every enemy, to recycle slots of enemies that no longer exist. */
  endEnemyPass() {
    for (const [id, fx] of this.enemies) if (fx.seen !== this.tick) { this.enemies.delete(id); this.pool.push(fx); }
    this.tick++;
  }
  /** A trapped enemy popped. Position is the bubble centre. */
  enemyDefeated(id: number, x: number, y: number) {
    if (this.ghosts.length >= MAX_GHOSTS) this.ghosts.shift();
    this.ghosts.push({ id, x, y, age: 0, face: this.enemies.get(id)?.face ?? 1, spin: (id % 2 ? 1 : -1) * (4 + Math.abs(id % 3)) });
  }
  updateGhosts(dt: number) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].age += dt;
      if (this.ghosts[i].age > GHOST_LIFE) this.ghosts.splice(i, 1);
    }
  }

  // ---- widow ----
  updateWidow(dt: number, w: WidowFxInput | null) {
    this.widowHitAge += dt;
    if (!w) { this.widowPrevHp = -1; this.widowRage = 0; return; }
    if (this.widowPrevHp >= 0 && w.hp < this.widowPrevHp) this.widowHitAge = 0;
    this.widowPrevHp = w.hp;
    const target = w.maxHp > 1 && w.hp > 0 && w.hp <= Math.ceil(w.maxHp / 2) ? 1 : 0;
    this.widowRage += (target - this.widowRage) * (1 - Math.exp(-dt * 3));
    this.widowDeathAge = w.phase === "defeated" ? w.phaseTimer : 0;
  }

  /** Test hook: number of live enemy slots. */
  get enemySlots() { return this.enemies.size; }
}
