/**
 * Enemy and boss drawing with the M7 animation pass. Sprites, silhouettes and
 * hitboxes are the originals; this layer adds anticipation, follow-through,
 * enraged tells, struggle, defeat and phase-change motion on top of them.
 * Everything is a pure function of its inputs (no randomness, no allocation
 * beyond the caller's own spreads), so frames are deterministic.
 */
import { AnimationFx, GHOST_LIFE, blinkAmount, clamp, easeOutBack, ring, type EnemyFx } from "./animation-fx";

const COLORS = { void: "#050509", blue: "#087CFF", pink: "#FF2A9D", crimson: "#C4133D", jade: "#20C98B", shine: "#FFD6F1" };

export type EnemyArtInput = {
  id: number; kind: string; x: number; y: number; w: number; h: number; vx: number; vy: number;
  state: string; timer: number; cooldown: number; rank: number; elite: boolean;
};
export type EnemyArtOptions = {
  scale: number; calm: boolean; animTime: number; px: number; py: number;
  trapped?: boolean; panic?: number; defeat?: number; spin?: number;
};

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.moveTo(x, y + s * .8);
  c.bezierCurveTo(x - s * 1.2, y, x - s * .7, y - s * .8, x, y - s * .25);
  c.bezierCurveTo(x + s * .7, y - s * .8, x + s * 1.2, y, x, y + s * .8); c.fill();
}

const GROUND = { love: 1, doll: 1, skull: 1 } as Record<string, number>;

export function drawEnemyArt(c: CanvasRenderingContext2D, e: EnemyArtInput, fx: EnemyFx, o: EnemyArtOptions) {
  const rm = o.calm, trapped = !!o.trapped, panic = o.panic ?? 0, defeat = o.defeat ?? -1;
  const x = e.x + e.w / 2, y = e.y + e.h / 2, fur = e.state === "furious";
  const t = rm ? 0 : trapped ? o.animTime : e.timer;
  const face = fx.face, fury = rm ? (fur ? 1 : 0) : fx.fury;
  const col = fur ? COLORS.crimson : COLORS.pink;
  const blink = blinkAmount(t + e.id * 1.37);
  const ground = !!GROUND[e.kind];

  // ---- shared envelope: spawn pop, landing squash, firing recoil, break-free burst ----
  const spawn = !rm && !trapped && defeat < 0 && e.timer < .45 ? .3 + .7 * easeOutBack(e.timer / .45) : 1;
  const land = rm || trapped ? 0 : ring(fx.landAge, 9, 22);
  const shot = rm || trapped ? 0 : ring(fx.shotAge, 6, 20);
  const free = rm || trapped ? 0 : ring(fx.freeAge, 5, 16);
  let sx = spawn * (1 + land * .18 + shot * .12 + free * .2), sy = spawn * (1 - land * .22 - shot * .16 + free * .2);
  const kick = -face * shot * 3;

  c.save(); c.translate(x, y); c.scale(o.scale, o.scale);
  if (defeat >= 0) {
    // pop: a quick swell, then spin away shrinking and fading
    const d = clamp(defeat, 0, 1), swell = d < .15 ? 1 + d * 2.4 : 1.36 - (d - .15) * 1.1;
    c.globalAlpha = Math.max(0, 1 - d * d);
    c.translate(0, rm ? 0 : -d * 34);
    if (!rm) c.rotate((o.spin ?? 4) * d * d);
    sx *= swell; sy *= swell * (1 - d * .3);
  }
  c.translate(kick, 0);
  const anchor = ground ? 22 : 0;
  c.translate(0, anchor); c.scale(sx, sy); c.translate(0, -anchor);

  if (trapped) {
    // Struggling inside the bubble: thumps against the walls, harder the longer it has been held
    // and frantic once the bubble starts to warn.
    const amp = rm ? 0 : Math.min(1, .35 + fx.trapAge / 4) + panic * .8, T = o.animTime;
    c.globalAlpha = .85;
    c.rotate((rm ? 0 : Math.sin(T * 2.2) * .16) + Math.sin(T * (9 + panic * 9)) * .1 * amp);
    c.translate(Math.sin(T * 13) * 2.4 * amp, -Math.abs(Math.sin(T * 7.5)) * 2.6 * amp);
    c.scale(1 + Math.max(0, Math.sin(T * 7.5 + 1.5)) * .06 * amp, 1 - Math.max(0, Math.sin(T * 7.5 + 1.5)) * .06 * amp);
  }
  if (fur) c.rotate(Math.sin(t * 18) * (rm ? .06 : .12));

  if (fur && !trapped) {
    c.save(); c.strokeStyle = COLORS.crimson; c.globalAlpha = .25 + Math.sin(t * 12) * .12; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 25 + Math.sin(t * 9) * 2, 0, Math.PI * 2); c.stroke(); c.restore();
    if (!rm) { // rage flames lick up from the head
      c.save(); c.fillStyle = COLORS.crimson; c.globalAlpha = .5 * fury;
      for (let i = 0; i < 3; i++) {
        const fx0 = -10 + i * 10, h = 7 + Math.abs(Math.sin(t * 14 + i * 2)) * 8;
        c.beginPath(); c.moveTo(fx0 - 3.5, -20); c.lineTo(fx0 + Math.sin(t * 11 + i) * 2.5, -20 - h); c.lineTo(fx0 + 3.5, -20); c.closePath(); c.fill();
      }
      c.restore();
    }
  }
  if (e.elite) { c.strokeStyle = "#FFD36A"; c.lineWidth = 2; c.shadowBlur = 12; c.shadowColor = "#FFD36A"; c.beginPath(); c.arc(0, 0, 27 + Math.sin(t * 5) * 2, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0 }
  c.fillStyle = e.elite ? "#FFD36A" : COLORS.blue; for (let i = 0; i < e.rank; i++) c.fillRect(-e.rank * 3 + i * 7, -32, 5, 3);

  const walk = Math.min(1, Math.abs(e.vx) / 70);

  if (e.kind === "love") {
    const beat = 1 + Math.pow(Math.max(0, Math.sin(t * (6 + fury * 4))), 3) * (.12 + fury * .05), chomp = (Math.sin(t * (7 + fury * 5)) + 1) * 1.6;
    const step = rm ? 0 : (1 - Math.abs(Math.sin(t * 5.5))) * walk;
    c.save(); c.translate(0, ground && !rm ? -Math.abs(Math.sin(t * 5.5)) * 2.2 * walk : 0);
    c.rotate(Math.sin(t * 11) * .07 * walk); c.scale(beat * (1 + step * .05), beat * (1 - step * .07));
    heart(c, 0, 0, 18, col);
    c.fillStyle = COLORS.shine; for (let i = -9; i <= 9; i += 6) { c.beginPath(); c.moveTo(i, 3); c.lineTo(i + 3, 9 + chomp); c.lineTo(i + 6, 3); c.fill() }
    const eh = 4 * (1 - blink * .9);
    c.fillStyle = COLORS.void; c.fillRect(-9 + face * 2, -6 + (4 - eh) / 2, 4, eh); c.fillRect(5 + face * 2, -6 + (4 - eh) / 2, 4, eh);
    if (blink < .5) { c.fillStyle = COLORS.shine; c.fillRect(-8 + face * 2, -5, 1.5, 1.5); c.fillRect(6 + face * 2, -5, 1.5, 1.5) }
    if (fur || fury > .3) { c.strokeStyle = COLORS.void; c.lineWidth = 2; c.beginPath(); c.moveTo(-11, -11); c.lineTo(-3, -7); c.moveTo(11, -11); c.lineTo(3, -7); c.stroke() }
    c.restore();
  } else if (e.kind === "bat") {
    const flap = Math.sin(t * (15 + fury * 5)), dive = clamp(e.vy / 145, -1, 1);
    c.rotate(clamp(e.vx / 420, -.3, .3) + (rm ? 0 : clamp(e.vy / 500, -.2, .25) * face));
    c.fillStyle = "#171028";
    // wings tuck in on a dive and spread wide on a climb
    for (const s of [-1, 1] as const) { c.save(); c.scale(s, 1); c.translate(4, 0); c.rotate(-flap * .55 * (1 + fury * .3) + (rm ? 0 : dive * .45)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(12, -14, 24, -9); c.quadraticCurveTo(17, -1, 21, 7); c.quadraticCurveTo(10, 3, 0, 9); c.closePath(); c.fill(); c.restore() }
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 2 + flap * 1.5, 7, 10, 0, 0, Math.PI * 2); c.fill();
    const twitch = rm ? 0 : Math.max(0, Math.sin(t * 2.3)) > .97 ? 3 : 0; // ear flick
    c.beginPath(); c.moveTo(-6, -5 + flap); c.lineTo(-9 - twitch * .3, -14 + flap + twitch); c.lineTo(-1, -8 + flap); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(6, -5 + flap); c.lineTo(9, -14 + flap); c.lineTo(1, -8 + flap); c.closePath(); c.fill();
    if (fury > .3) { c.save(); c.fillStyle = COLORS.crimson; c.shadowBlur = 8; c.shadowColor = COLORS.crimson; c.fillRect(-4.5 + face, -2.5 + flap * 1.5, 4, 3.5); c.fillRect(1.5 + face, -2.5 + flap * 1.5, 4, 3.5); c.restore() }
    c.fillStyle = COLORS.shine; if (blink < .5 || fury > .3) { c.fillRect(-4 + face, -2 + flap * 1.5, 2.5, 2.5); c.fillRect(2 + face, -2 + flap * 1.5, 2.5, 2.5) }
    c.beginPath(); c.moveTo(-2, 6 + flap * 1.5); c.lineTo(-1, 9 + flap * 1.5 + dive * 1.5); c.lineTo(0, 6 + flap * 1.5); c.closePath(); c.fill();
  } else if (e.kind === "eye") {
    const aim = Math.atan2(o.py + 24 - y, o.px + 17 - x);
    const charge = !trapped && e.state !== "trapped" && e.cooldown < .5 ? 1 - Math.max(0, e.cooldown) / .5 : 0;
    const cycle = t % 4.2, lid = cycle < .22 ? Math.sin(cycle / .22 * Math.PI) : charge * .3 + fury * .12;
    // darting saccades: the pupil jumps to a new offset a few times a second
    const sac = Math.floor(t * 2.3), jx = rm ? 0 : Math.sin(sac * 12.9) * 2.2 * (1 - charge), jy = rm ? 0 : Math.cos(sac * 7.7) * 1.2 * (1 - charge);
    c.rotate(Math.sin(t * 2) * .06); c.scale(1, 1 - lid * .8);
    if (charge) { c.strokeStyle = COLORS.crimson; c.globalAlpha *= .6; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 22 + charge * 4, 15 + charge * 3, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = trapped ? .85 : 1 }
    c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 19, 12, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "#0d0716"; c.beginPath(); c.ellipse(0, 0, 16, 9.5, 0, 0, Math.PI * 2); c.fill();
    if (fury > .3) { c.strokeStyle = COLORS.crimson; c.lineWidth = 1.2; c.globalAlpha *= .7; for (let i = 0; i < 4; i++) { const a = i * 1.57 + .8; c.beginPath(); c.moveTo(Math.cos(a) * 15, Math.sin(a) * 8.5); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 5); c.stroke() } c.globalAlpha = trapped ? .85 : 1 }
    // pupil breathes, then contracts hard while charging a shot and flares after firing
    const pr = 7 + Math.sin(t * 1.6) * .6 - charge * 2 + shot * 1.4;
    const ix = Math.cos(aim) * 5 + jx, iy = Math.sin(aim) * 3 + jy + (charge ? Math.sin(t * 60) * .5 : 0);
    c.fillStyle = charge > .4 || fur ? COLORS.crimson : COLORS.blue; c.beginPath(); c.arc(ix, iy, Math.max(4, pr), 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.shine; c.fillRect(ix - 2, iy - 3, 3, 4);
    c.strokeStyle = col; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 8, -12); c.lineTo(i * 10, -17 - (rm ? 0 : Math.sin(t * 3 + i) * 1)); c.stroke() }
    if (fur) { c.strokeStyle = COLORS.crimson; c.lineWidth = 3; c.beginPath(); c.moveTo(-17, -12); c.lineTo(0, -7); c.lineTo(17, -12); c.stroke() }
  } else if (e.kind === "witch") {
    const bobW = Math.sin(t * 3) * 3, charge = !trapped && e.state !== "trapped" && e.cooldown < .65 ? 1 - Math.max(0, e.cooldown) / .65 : 0;
    c.translate(0, bobW); c.rotate(rm ? 0 : clamp(e.vx / 600, -.12, .12) + Math.sin(t * 2) * .03 - face * shot * .16);
    // sleeves: relaxed at her sides, then flung up to channel a star
    const aL = Math.sin(t * 2.2) * 1.5, rise = charge * 18 + shot * 4;
    c.strokeStyle = col; c.lineWidth = 3.5; c.lineCap = "round";
    c.beginPath(); c.moveTo(-11, 4); c.lineTo(-17 - charge * 2, 12 + aL - rise); c.moveTo(11, 4); c.lineTo(17 + charge * 2, 12 - aL - rise); c.stroke();
    c.fillStyle = COLORS.shine; c.fillRect(-19 - charge * 2, 11 + aL - rise, 3, 3); c.fillRect(16 + charge * 2, 11 - aL - rise, 3, 3);
    c.fillStyle = "#26102f"; c.beginPath(); c.moveTo(-20, 2); c.lineTo(0, -22); c.lineTo(20, 2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-2, -19); c.quadraticCurveTo(4 + Math.sin(t * 2.6) * 4 - shot * 6, -34 + shot * 4, 12 - shot * 5, -30 + shot * 6); c.quadraticCurveTo(6, -25, 4, -20); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(-13, 0); c.lineTo(13, 0); c.lineTo(15, 22);
    for (let hx = 13; hx >= -15; hx -= 5) c.lineTo(hx, 22 + Math.sin(t * 6 + hx) * (2 + walk * 1.8));
    c.closePath(); c.fill();
    const eh = 6 * (1 - blink * .9);
    c.fillStyle = COLORS.shine; c.fillRect(-7, -9 + (6 - eh) / 2, 5, eh); c.fillRect(2, -9 + (6 - eh) / 2, 5, eh);
    c.fillStyle = fur ? COLORS.crimson : "#26102f"; if (blink < .6) { c.fillRect(-6 + face, -8, 2, 3); c.fillRect(3 + face, -8, 2, 3) }
    if (fur) { c.strokeStyle = "#26102f"; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, -11); c.lineTo(-2, -9); c.moveTo(8, -11); c.lineTo(2, -9); c.stroke() }
    if (charge) { c.save(); c.translate(face * 17, -2 - rise * .6); c.rotate(t * 9); c.fillStyle = COLORS.pink; c.globalAlpha *= .4 + charge * .6; for (let i = 0; i < 4; i++) { c.fillRect(-1.5, -(2 + 5 * charge), 3, 4 + 10 * charge); c.rotate(Math.PI / 4) } c.restore() }
  } else if (e.kind === "doll") {
    const cyc = t % 3.4, charging = cyc > 2.55, windup = cyc > 2.2 && !charging;
    const crouch = windup ? clamp((cyc - 2.2) / .35, 0, 1) : 0;
    const shiver = windup ? Math.sin(t * 46) * 2 : charging ? Math.sin(t * 28) : Math.sin(t * 5) * .5;
    // anticipation: sink low and coil before the charge, stretch long during it
    if (!rm) { c.translate(0, 22); c.scale(1 + crouch * .1 - (charging ? .08 : 0), 1 - crouch * .15 + (charging ? .05 : 0)); c.translate(0, -22) }
    c.translate(shiver, 0); if (charging) c.rotate(face * .16);
    // marionette jerks while it ambles: quantised little head-and-body tilts
    if (!rm && !charging && !windup) c.rotate(((Math.floor(t * 7) * 37) % 5 - 2) * .016);
    if (charging && !trapped) { c.strokeStyle = "rgba(255,214,241,.4)"; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const ly = -8 + i * 8; c.beginPath(); c.moveTo(-face * 14, ly); c.lineTo(-face * (24 + i * 4), ly); c.stroke() } }
    c.save(); c.translate(-face * 13, 4); c.rotate(charging ? t * 12 : t * (2 + fury * 3)); c.strokeStyle = "#8f8f9f"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 6); c.moveTo(-4, -6); c.lineTo(4, -6); c.stroke(); c.restore();
    // stubby arms: swing as it walks, reach forward to charge, pull in tight to wind up
    const sw = charging ? 0 : Math.sin(t * 5.5) * .5 * walk, reach = charging ? .9 : windup ? -.5 : 0;
    c.strokeStyle = "#2a1629"; c.lineWidth = 4; c.lineCap = "round";
    for (const s of [-1, 1] as const) { const a = (s * sw + reach * face) * 1; c.beginPath(); c.moveTo(s * 11, 4); c.lineTo(s * 14 + Math.sin(a) * 6 * (s === face ? 1 : .5) + (charging && s === face ? face * 5 : 0), 13 - Math.cos(a) * 2 - (charging ? 5 : 0)); c.stroke() }
    c.fillStyle = "#2a1629"; c.beginPath(); c.arc(0, -8, 12, 0, Math.PI * 2); c.fill(); c.fillRect(-12, 2, 24, 21);
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(-7, -12); c.lineTo(-3, -7); c.moveTo(-3, -12); c.lineTo(-7, -7); c.moveTo(3, -12); c.lineTo(7, -7); c.moveTo(7, -12); c.lineTo(3, -7); c.stroke();
    c.beginPath(); c.moveTo(-5, -2); c.lineTo(5, -2); for (let mx = -4; mx <= 4; mx += 3) { c.moveTo(mx, -3.5); c.lineTo(mx, -.5) } c.stroke();
    c.strokeStyle = "rgba(255,214,241,.35)"; c.beginPath(); c.moveTo(-12, 9); c.lineTo(12, 13); c.stroke();
  } else {
    const hopT = t % 2.2, antic = !rm && !trapped && hopT > 1.9 ? clamp((hopT - 1.9) / .3, 0, 1) : 0;
    const jaw = e.vy < -40 ? 6 : antic ? 1 : 2 + Math.max(0, Math.sin(t * (4 + fury * 8))) * 2;
    const springy = clamp(-e.vy / 1400, -.15, .22);
    // anticipation: crouch and clench before the hop, stretch tall on takeoff
    if (antic) { c.translate(0, 22); c.scale(1 + antic * .14, 1 - antic * .2); c.translate(0, -22) }
    c.rotate(clamp(e.vx / 900, -.15, .15) + (rm ? 0 : Math.sin(t * 3) * .03));
    c.scale(1 - springy * .4, 1 + springy * .6);
    c.fillStyle = "#0a0510"; c.fillRect(-8, 3, 16, 4 + jaw);
    c.fillStyle = "#ded8dc"; c.beginPath(); c.arc(0, -5, 16, 0, Math.PI * 2); c.fill(); c.fillRect(-9, 5 + jaw, 18, 6);
    c.fillStyle = COLORS.void; c.fillRect(-10, -10, 6, 7); c.fillRect(4, -10, 6, 7); c.fillRect(-3, -1, 6, 4);
    if (!fur) { c.fillStyle = col; c.globalAlpha *= rm ? .5 : .35 + .35 * Math.abs(Math.sin(t * 4 + e.id)); c.fillRect(-8 + face, -8, 2, 2); c.fillRect(6 + face, -8, 2, 2); c.globalAlpha = trapped ? .85 : 1 }
    if (fur) { c.fillStyle = COLORS.crimson; c.fillRect(-9, -9, 4, 5); c.fillRect(5, -9, 4, 5) }
    c.fillStyle = "#ded8dc"; for (let tx = -8; tx <= 5; tx += 4) c.fillRect(tx, 3, 2.5, 3);
    c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-13, -14); c.lineTo(-19, -26 + Math.sin(t * 8) * 1.5); c.moveTo(-16, -21); c.lineTo(-20, -19); c.moveTo(13, -14); c.lineTo(19, -26 + Math.sin(t * 8 + 1) * 1.5); c.moveTo(16, -21); c.lineTo(20, -19); c.stroke();
  }
  // a pale pulse the moment an enemy bursts free of its bubble
  if (free > 0.05 && !trapped) { c.globalAlpha = Math.min(.5, free * .6); c.fillStyle = COLORS.shine; c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.fill() }
  c.restore();
}

/** Burst ring and spokes drawn where a trapped enemy popped. */
export function drawDefeatBurst(c: CanvasRenderingContext2D, x: number, y: number, age: number, calm: boolean) {
  const d = clamp(age / GHOST_LIFE, 0, 1);
  c.save(); c.translate(x, y); c.globalAlpha = (1 - d) * .8; c.strokeStyle = COLORS.shine; c.lineWidth = 3 - d * 2;
  c.beginPath(); c.arc(0, 0, 14 + d * 46, 0, Math.PI * 2); c.stroke();
  if (!calm) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + d * .6, r0 = 18 + d * 34, r1 = r0 + 10 * (1 - d); c.strokeStyle = i % 2 ? COLORS.pink : COLORS.jade; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke() }
  c.restore();
}

export type WidowArtInput = { x: number; y: number; vx: number; vy: number; age: number; phase: string; phaseTimer: number; lungeAngle: number; hp: number; maxHp: number };

export function drawWidowArt(c: CanvasRenderingContext2D, w: WidowArtInput, fx: AnimationFx, calm: boolean, label: (text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign) => void) {
  const rm = calm, T = w.age;
  const rage = rm ? 0 : fx.widowRage, hitAge = rm ? 9 : fx.widowHitAge;
  const phase = w.phase, pt = w.phaseTimer;
  if (phase === "telegraph") {
    c.save(); c.strokeStyle = COLORS.crimson; c.lineWidth = 3; c.setLineDash([10, 10]); c.globalAlpha = .5 + Math.sin(pt * 30) * .3;
    c.beginPath(); c.moveTo(w.x, w.y); c.lineTo(w.x + Math.cos(w.lungeAngle) * 900, w.y + Math.sin(w.lungeAngle) * 900); c.stroke(); c.setLineDash([]); c.restore();
  }
  // phase-change tell: shockwave ring each time she is hit
  if (hitAge < .6) {
    c.save(); c.strokeStyle = COLORS.pink; c.lineWidth = 4 * (1 - hitAge / .6); c.globalAlpha = (1 - hitAge / .6) * .8;
    c.beginPath(); c.arc(w.x, w.y, 40 + hitAge * 330, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  const scale = phase === "entrance" ? clamp(pt / 1.2, .2, 1) : 1;
  const tele = phase === "telegraph" ? clamp(pt / .55, 0, 1) : 0;
  const staggered = phase === "staggered", defeated = phase === "defeated", dead = defeated ? clamp(pt / 1.4, 0, 1) : 0;
  const glow = phase === "telegraph" ? (.6 + Math.sin(pt * 40) * .4) : staggered ? (.5 + Math.sin(pt * 14) * .5) : 1;
  const bodyColor = staggered ? COLORS.jade : defeated ? "#3a2230" : COLORS.crimson;
  const flash = hitAge < .1;
  const hover = rm || phase === "entrance" || defeated ? 0 : Math.sin(T * 2.2) * 3;
  c.save(); c.translate(w.x, w.y + hover);
  // she drops in on a silk thread
  if (phase === "entrance") { c.strokeStyle = "rgba(184,167,168,.55)"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -w.y - 40); c.lineTo(0, -34); c.stroke() }
  if (phase === "telegraph") c.translate(Math.sin(pt * 60) * 2.5, 0);
  if (defeated && !rm) c.translate(Math.sin(pt * 55) * (1 - dead) * 4, 0);
  c.scale(scale, scale); c.globalAlpha = defeated ? clamp(1 - pt / 1.4, 0, 1) : 1;
  if (phase === "entrance" && !rm) c.rotate(Math.sin(pt * 6) * .12 * (1 - clamp(pt / 1.2, 0, 1)));
  if (staggered && !rm) c.rotate(Math.sin(pt * 10) * .07);
  if (phase === "trapped" && !rm) { c.rotate(Math.sin(T * 14) * .12); c.translate(Math.sin(T * 19) * 2, 0) }
  if (phase === "lunge") { c.rotate(clamp(Math.atan2(w.vy, w.vx) * .12, -.3, .3)); c.scale(1.14, .9) }
  else if (tele && !rm) c.scale(1 + tele * .08, 1 - tele * .12);          // coil down before the lunge
  else if (defeated && !rm) c.scale(1 + dead * .12, 1 - dead * .45);       // slumps as she unravels
  const pop = rm ? 0 : ring(hitAge, 6, 20);
  if (pop) c.scale(1 + pop * .16, 1 + pop * .16);
  if (phase === "lunge") { c.save(); c.globalAlpha *= .35; c.translate(-w.vx * .03, -w.vy * .03); heart(c, 0, 0, 34, "#09080d"); c.restore() }
  // rage aura: crimson flames lick around her once she is down to her last lives
  if (rage > .05 && !defeated) {
    c.save(); c.fillStyle = COLORS.crimson; c.globalAlpha = .38 * rage;
    for (let i = 0; i < 7; i++) { const a = -Math.PI * .5 + (i - 3) * .42, r = 40, hh = 12 + Math.abs(Math.sin(T * 9 + i * 1.7)) * 14, bx = Math.cos(a) * r, by = Math.sin(a) * r * 1.05; c.beginPath(); c.moveTo(bx - 5, by + 4); c.lineTo(bx + Math.cos(a) * hh + Math.sin(T * 7 + i) * 3, by + Math.sin(a) * hh); c.lineTo(bx + 5, by + 4); c.closePath(); c.fill() }
    c.restore();
  }
  // skittering spider legs: faster when raging, raised to spread before a lunge, sagging when dazed, curling in on defeat
  const skit = (phase === "chase" || phase === "lunge" ? 11 : phase === "trapped" ? 24 : tele ? 2 : 4) * (1 + rage * .5);
  const curl = defeated ? dead : 0;
  c.strokeStyle = "#b8a7a8"; c.lineWidth = 3;
  for (const s of [-1, 1] as const) for (let i = 0; i < 3; i++) {
    const step = Math.sin(T * skit + i * 2.1 + (s > 0 ? 0 : 1.2)) * (tele ? .08 : .3);
    const by = -6 + i * 11, lift = tele * 10 * (rm ? 0 : 1), sag = staggered ? 8 : 0, reach = 1 - curl * .65;
    c.beginPath(); c.moveTo(s * 26, by);
    c.lineTo(s * (44 + Math.cos(step) * 6) * reach, by + 10 + Math.sin(step) * 7 - lift * .5 + sag * .5 + curl * 6);
    c.lineTo(s * (60 + Math.cos(step) * 9) * reach, by + 2 + Math.sin(step) * 12 - lift + sag + curl * 14); c.stroke();
  }
  c.shadowBlur = 20 * glow + rage * 10; c.shadowColor = staggered ? COLORS.jade : rage > .3 ? COLORS.crimson : COLORS.pink;
  heart(c, 0, 0, 38, flash ? COLORS.shine : "#09080d"); c.shadowBlur = 0;
  c.strokeStyle = bodyColor; c.lineWidth = 4; c.beginPath(); c.moveTo(-10, -18); c.lineTo(2, -4); c.lineTo(-6, 8); c.lineTo(10, 23); c.stroke();
  if (defeated && !rm) { // the cracks widen as she comes apart
    c.strokeStyle = COLORS.shine; c.lineWidth = 2; c.globalAlpha *= .8 * dead;
    c.beginPath(); c.moveTo(-10, -18); c.lineTo(-22 * dead - 6, -4); c.moveTo(2, -4); c.lineTo(20 * dead + 4, 8); c.moveTo(-6, 8); c.lineTo(-18 * dead, 22); c.stroke(); c.globalAlpha = clamp(1 - pt / 1.4, 0, 1);
  }
  const blinkW = T % 3.7 < .14;
  c.fillStyle = COLORS.shine;
  if (blinkW) { c.fillRect(-18, -6, 10, 2); c.fillRect(8, -6, 10, 2) }
  else {
    const squint = rage * 3 + tele * 2;            // eyes narrow as she gets angrier
    c.fillRect(-18, -8 + squint * .5, 10, 6 - squint); c.fillRect(8, -8 + squint * .5, 10, 6 - squint);
    c.fillStyle = bodyColor; c.fillRect(-15, -7 + squint * .3, 4, Math.max(2, 4 - squint * .5)); c.fillRect(11, -7 + squint * .3, 4, Math.max(2, 4 - squint * .5));
    if (rage > .3 || tele > .3) { c.strokeStyle = "#09080d"; c.lineWidth = 3; c.beginPath(); c.moveTo(-20, -12); c.lineTo(-7, -7); c.moveTo(20, -12); c.lineTo(7, -7); c.stroke() }
  }
  // tarnished crown (drops away when she falls) and rippling veil
  const crownDrop = defeated && !rm ? dead * dead * 70 : 0, crownShake = !rm && (rage > .3 || tele > 0) ? Math.sin(T * 40) * (rage * 1.2 + tele * 1.5) : 0;
  c.save(); c.translate(crownShake, crownDrop); if (defeated && !rm) c.rotate(dead * .6);
  c.strokeStyle = "#7f6d70"; c.lineWidth = 4; c.beginPath(); c.moveTo(-25, -30); c.lineTo(-14, -52 + Math.sin(T * 3) * 1.5); c.lineTo(0, -37); c.lineTo(15, -55 + Math.sin(T * 3 + 1) * 1.5); c.lineTo(27, -28); c.stroke();
  c.restore();
  c.strokeStyle = "rgba(184,167,168,.4)"; c.lineWidth = 2;
  const flare = 1 + tele * .5 + rage * .25;
  for (const s of [-1, 1] as const) { c.beginPath(); c.moveTo(s * 20, -24); c.quadraticCurveTo(s * (34 + Math.sin(T * 2.2 + s) * 4) * flare, 0, s * (28 + Math.sin(T * 1.8) * 5) * flare, 28); c.stroke() }
  if (staggered) for (let i = 0; i < 3; i++) { const a = pt * 4 + i * 2.09; label("★", Math.cos(a) * 26, -44 + Math.sin(a) * 7, 12, COLORS.jade, "center") }
  if (defeated) { c.strokeStyle = COLORS.pink; c.lineWidth = 2; c.globalAlpha = clamp(1 - pt / 1.4, 0, 1) * .7; for (let i = 0; i < 5; i++) { const tx = -30 + i * 15, rise = pt * (40 + i * 14); c.beginPath(); c.moveTo(tx, 10 - rise); c.quadraticCurveTo(tx + 6, -6 - rise, tx, -22 - rise); c.stroke() } }
  c.restore();
}
