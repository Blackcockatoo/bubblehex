/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BUBBLE HEX — Forbidden Expansion, milestone 5: the Widow's Collection cabinet,
 * achievements, wardrobe and the living title screen.
 *
 * Installed onto the native engine after familiar-expansion.ts. Every hook calls
 * the original method; the cabinet is an overlay (no new engine state), so the
 * title / pause flow underneath is untouched and resumes exactly where it was.
 */
import {
  ACHIEVEMENTS, CABINET_LIMITS, CABINET_SECTIONS, MEMORABILIA, WARDROBE,
  achievementById, achievementProgress, cabinetTier, emptyStats, equippedWardrobe, evaluateAchievements,
  isWardrobeUnlocked, memorabiliaOwned, newRemarkClock, resetCollection, rollRemark, stepWeb, titleWalkerCap,
  type CabinetSection, type CabinetStats, type RemarkClock, type WardrobeDefinition,
} from "./cabinet";
import { cabinetCopy, loreName, type CabinetCopy } from "./cabinet-i18n";
import { copyForEngine, interfaceRuntime } from "./expansion-ui";
import { drawItemIcon, expansionRuntime, fitText } from "./forbidden-expansion";
import { activeFamiliar, checkUnlocks, familiarRuntime, setFamiliarDecor, unlockStats } from "./familiar-expansion";
import { FAMILIARS, isFamiliarId, unlockProgress } from "./familiars";
import { ITEM_DEFINITIONS, RARITY_BADGE, RARITY_COLOR, discoveredCount } from "./items";
import { JUKEBOX_RECORDS, THEMES, isRecordUnlocked, themeById } from "./jukebox";
import { BONUS_LEVEL, LEVELS } from "./levels";
import { AMMO_DEFINITIONS, PERSONALITIES, isAmmoType, personalityById } from "./living-bubbles";
import { metaFor } from "./living-expansion";
import { emptyCabinet, type PersistedCabinet } from "./persistence";

const INSTALL_KEY = Symbol.for("bubblehex.forbidden-expansion.m5");
const W = 960, H = 720;

type EngineConstructor = { prototype: object };
type AnyEngine = Record<PropertyKey, any>;

type Toast = { id: string; life: number };
export type CabinetRuntime = {
  open: boolean;
  section: number;
  pick: number[];
  armed: boolean;
  resetFlash: number;
  toasts: Toast[];
  remark: { text: string; time: number } | null;
  remarkClock: RemarkClock;
  lastRemark: number;
  clock: number;
  lastSave: number;
  dirty: boolean;
  evalClock: number;
  secretCard: number;
  wasSleeping: boolean;
  prevState: string;
  keyHandler: ((event: KeyboardEvent) => void) | null;
  rng: () => number;
};

const runtimes = new WeakMap<object, CabinetRuntime>();
export function cabinetRuntime(engine: AnyEngine): CabinetRuntime {
  let rt = runtimes.get(engine);
  if (!rt) {
    rt = { open: false, section: 0, pick: CABINET_SECTIONS.map(() => 0), armed: false, resetFlash: 0, toasts: [], remark: null,
      remarkClock: newRemarkClock(), lastRemark: -1, clock: 0, lastSave: 0, dirty: false, evalClock: 0, secretCard: 0,
      wasSleeping: false, prevState: "", keyHandler: null, rng: Math.random };
    runtimes.set(engine, rt);
  }
  return rt;
}

/** The v8 cabinet save, repaired in place if a caller replaced settings by hand. */
export function cabinetSave(engine: AnyEngine): PersistedCabinet {
  const s = engine.settings;
  if (!s.cabinet || typeof s.cabinet !== "object") s.cabinet = emptyCabinet();
  const cab = s.cabinet as PersistedCabinet;
  if (!cab.counters) cab.counters = {};
  for (const key of ["achievements", "ammoSeen", "personalitiesSeen", "chambers", "secretRooms"] as const) if (!Array.isArray(cab[key])) cab[key] = [];
  return cab;
}

const copy = (engine: AnyEngine): CabinetCopy => cabinetCopy(interfaceRuntime(engine).lang);
const lang = (engine: AnyEngine) => interfaceRuntime(engine).lang;
const reduced = (engine: AnyEngine) => !!engine.settings?.reducedMotion;
const accent = (engine: AnyEngine) => themeById(engine.settings?.theme).accent;

function bump(engine: AnyEngine, key: string, amount = 1) {
  if (engine.state === "attract") return;
  const cab = cabinetSave(engine);
  cab.counters[key] = Math.min(9999999, (cab.counters[key] ?? 0) + amount);
  cabinetRuntime(engine).dirty = true;
}

export function cabinetStats(engine: AnyEngine): CabinetStats {
  const s = engine.settings, cab = cabinetSave(engine), c = cab.counters, items = s.collection?.items ?? {};
  const stats = emptyStats();
  Object.assign(stats, {
    pops: c.pops ?? 0, bestChain: s.familiars?.bestChain ?? 0, chambers: cab.chambers.length, perfects: c.perfects ?? 0,
    secrets: cab.secretRooms.length, items: discoveredCount(items), vinyls: items.cursed_vinyl ?? 0, ammoFired: c.ammoFired ?? 0,
    ammoKinds: cab.ammoSeen.filter(isAmmoType).length, personalities: cab.personalitiesSeen.filter(id => !!personalityById(id)).length,
    familiars: (s.familiars?.unlocked ?? []).filter(isFamiliarId).length, assists: c.assists ?? 0, naps: c.naps ?? 0,
    widowRemarks: c.widowRemarks ?? 0, titleSecret: cab.titleSecret ? 1 : 0, dressed: c.dressed ? 1 : 0,
    venomSpelled: c.venomSpelled ?? 0, deaths: c.deaths ?? 0, web: Math.floor(cab.web * 100),
  });
  return stats;
}

export const livingTier = (engine: AnyEngine) => cabinetTier(cabinetSave(engine).achievements.length);
const dancing = (engine: AnyEngine) => engine.state === "title" && !cabinetRuntime(engine).open && (engine.titleIdle ?? 0) > CABINET_LIMITS.danceAfter && !reduced(engine);

/** Award any newly earned achievements (toast + chime + save). Never during attract. */
export function checkAchievements(engine: AnyEngine): string[] {
  if (engine.state === "attract") return [];
  const cab = cabinetSave(engine);
  const fresh = evaluateAchievements(cabinetStats(engine), cab.achievements);
  if (!fresh.length) return fresh;
  cab.achievements.push(...fresh);
  const rt = cabinetRuntime(engine);
  for (const id of fresh) rt.toasts.push({ id, life: CABINET_LIMITS.toastLife });
  if (rt.toasts.length > CABINET_LIMITS.maxToasts) rt.toasts.splice(0, rt.toasts.length - CABINET_LIMITS.maxToasts);
  const audio = engine.audio;
  if (audio?.tone) [659, 880, 1175, 1568].forEach((note, i) => setTimeout(() => audio.tone(note, 0.1, "triangle", 40, 0.06), i * 70));
  engine.save?.(); rt.dirty = false; rt.lastSave = rt.clock;
  return fresh;
}

/* ------------------------------------------------------------ cabinet open/close */

export function openCabinet(engine: AnyEngine, section?: CabinetSection) {
  if (engine.state !== "title" && engine.state !== "paused") return false;
  const rt = cabinetRuntime(engine);
  rt.open = true; rt.armed = false; rt.secretCard = 0;
  if (section) rt.section = Math.max(0, CABINET_SECTIONS.indexOf(section));
  engine.releaseAll?.();
  engine.just?.clear?.();
  engine.audio?.tone?.(392, 0.08, "triangle", 120, 0.06);
  engine.syncAuditData?.();
  return true;
}

export function closeCabinet(engine: AnyEngine) {
  const rt = cabinetRuntime(engine);
  if (!rt.open) return;
  rt.open = false; rt.armed = false;
  engine.titleIdle = 0;
  engine.just?.clear?.();
  engine.audio?.tone?.(523, 0.06, "triangle", -120, 0.05);
  engine.syncAuditData?.();
}

const SECTION_SIZE: Record<CabinetSection, () => number> = {
  items: () => ITEM_DEFINITIONS.length,
  familiars: () => FAMILIARS.length,
  bubbles: () => AMMO_DEFINITIONS.length + PERSONALITIES.length,
  records: () => JUKEBOX_RECORDS.length,
  editions: () => THEMES.length,
  chambers: () => LEVELS.length + 1,
  achievements: () => ACHIEVEMENTS.length,
  memorabilia: () => MEMORABILIA.length,
  wardrobe: () => WARDROBE.length + 1,
  reset: () => 1,
};

const CHAMBERS = [
  ...LEVELS.map((l, i) => ({ key: l.loreFragmentId, name: l.name, world: l.world, tint: l.tint, label: String(i + 1) })),
  { key: "bonus", name: BONUS_LEVEL.name, world: BONUS_LEVEL.world, tint: "#FFD36A", label: "B" },
];

function setSection(engine: AnyEngine, dir: number) {
  const rt = cabinetRuntime(engine);
  rt.section = (rt.section + dir + CABINET_SECTIONS.length) % CABINET_SECTIONS.length;
  rt.armed = false;
  engine.audio?.tone?.(660, 0.05, "triangle", 0, 0.06);
}

function cabinetInput(engine: AnyEngine, rt: CabinetRuntime) {
  const just: Set<string> = engine.just;
  const section = CABINET_SECTIONS[rt.section];
  const size = SECTION_SIZE[section]();
  if (just.has("jump")) { if (rt.armed) { rt.armed = false; engine.audio?.tone?.(330, 0.06, "triangle", 0, 0.05); } else setSection(engine, 1); }
  if (just.has("consciousness")) setSection(engine, -1);
  if (just.has("left")) { rt.pick[rt.section] = (rt.pick[rt.section] - 1 + size) % size; engine.audio?.tone?.(520, 0.04, "triangle", 0, 0.05); }
  if (just.has("right")) { rt.pick[rt.section] = (rt.pick[rt.section] + 1) % size; engine.audio?.tone?.(620, 0.04, "triangle", 0, 0.05); }
  if (just.has("bubble")) activateEntry(engine, rt, CABINET_SECTIONS[rt.section], rt.pick[rt.section]);
}

function deny(engine: AnyEngine) { engine.audio?.tone?.(140, 0.18, "sawtooth", -40, 0.08); }

function activateEntry(engine: AnyEngine, rt: CabinetRuntime, section: CabinetSection, pick: number) {
  const s = engine.settings, cab = cabinetSave(engine);
  if (section === "records") {
    const record = JUKEBOX_RECORDS[pick];
    if (!isRecordUnlocked(record.id, s.collection?.items?.cursed_vinyl ?? 0)) return deny(engine);
    s.jukeboxTrack = record.id; engine.save?.(); engine.syncMusic?.(); engine.audio?.reward?.();
  } else if (section === "editions") {
    s.theme = THEMES[pick].id; engine.save?.(); engine.audio?.reward?.();
  } else if (section === "familiars") {
    const def = FAMILIARS[pick];
    if (!s.familiars?.unlocked?.includes(def.id)) return deny(engine);
    s.familiars.selected = activeFamiliar(engine)?.id === def.id ? "none" : def.id;
    engine.save?.(); engine.audio?.reward?.();
  } else if (section === "wardrobe") {
    if (pick === 0) { cab.wardrobeEquipped = null; engine.save?.(); engine.audio?.tone?.(440, 0.06, "triangle", 0, 0.05); return; }
    const def = WARDROBE[pick - 1];
    if (!isWardrobeUnlocked(def.id, cab.achievements)) return deny(engine);
    cab.wardrobeEquipped = cab.wardrobeEquipped === def.id ? null : def.id;
    if (cab.wardrobeEquipped) cab.counters.dressed = 1;
    engine.save?.(); engine.audio?.reward?.();
    checkAchievements(engine);
  } else if (section === "reset") {
    if (!rt.armed) { rt.armed = true; engine.audio?.tone?.(220, 0.14, "square", -30, 0.07); return; }
    resetCollection(s);
    const frt = familiarRuntime(engine); frt.body = null; frt.walkers = [];
    rt.armed = false; rt.resetFlash = 2.5; rt.toasts = [];
    engine.save?.(); engine.syncMusic?.();
    engine.audio?.tone?.(110, 0.5, "sawtooth", -60, 0.09);
  } else deny(engine);
  engine.syncAuditData?.();
}

/* ------------------------------------------------------------ wardrobe drawing */

function heroPoseTransform(engine: AnyEngine, c: CanvasRenderingContext2D, x: number, y: number, scale: number, motion: AnyEngine) {
  const time = engine.animTime ?? 0, pose = motion.pose ?? "idle", run = motion.runPhase ?? 0;
  const speed = Math.max(0, Math.min(1, motion.speed ?? 0)), throwT = Math.max(0, Math.min(1, motion.throwT ?? 0));
  const squash = Math.max(-0.4, Math.min(0.6, motion.squash ?? 0));
  const bob = pose === "run" ? -Math.abs(Math.sin(run)) * 2.6 : pose === "idle" ? Math.sin(time * 2.6) * 1.3 : 0;
  const lean = pose === "hurt" ? Math.sin(time * 22) * 0.06 : pose === "run" ? 0.1 + speed * 0.1 : pose === "jump" ? -0.09 : pose === "fall" ? 0.07 : 0;
  c.translate(x, y + bob); c.scale(scale, scale); c.scale(motion.facing ?? 1, 1);
  c.translate(0, 24); c.scale(1 + squash * 0.22, 1 - squash * 0.2); c.translate(0, -24);
  c.rotate(lean + throwT * 0.09);
}

/** Accessory in hero-local space (head centre at (2,-21), radius 15). */
export function drawAccessoryLocal(c: CanvasRenderingContext2D, def: WardrobeDefinition, time: number, rm: boolean) {
  c.lineJoin = "round"; c.lineCap = "round";
  switch (def.id) {
    case "crown":
      c.fillStyle = def.color; c.strokeStyle = "#3a2400"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-10, -34); c.lineTo(-12, -48); c.lineTo(-5, -41); c.lineTo(2, -52); c.lineTo(9, -41); c.lineTo(16, -48); c.lineTo(14, -34); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#FF2A9D"; c.beginPath(); c.arc(2, -39, 2.6, 0, Math.PI * 2); c.fill();
      break;
    case "cat_ears":
      for (const sx of [-1, 1]) {
        const bx = 2 + sx * 9;
        c.fillStyle = def.color; c.strokeStyle = "#03040A"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(bx - 6 * sx, -31); c.lineTo(bx + 4 * sx, -50); c.lineTo(bx + 8 * sx, -28); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#FF8AD0"; c.beginPath(); c.moveTo(bx - 2 * sx, -32); c.lineTo(bx + 4 * sx, -44); c.lineTo(bx + 6 * sx, -31); c.closePath(); c.fill();
      }
      break;
    case "halo": {
      const glow = rm ? 0.8 : 0.65 + Math.sin(time * 4) * 0.2;
      c.save(); c.globalAlpha *= glow; c.strokeStyle = def.color; c.lineWidth = 3.5; c.shadowBlur = rm ? 0 : 10; c.shadowColor = def.color;
      c.beginPath(); c.ellipse(2, -47, 13, 4, 0, 0, Math.PI * 2); c.stroke(); c.restore();
      break;
    }
    case "veil":
      c.save(); c.globalAlpha *= 0.62; c.fillStyle = def.color; c.strokeStyle = "#B07CFF"; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-15, -26); c.quadraticCurveTo(2, -50, 19, -26); c.lineTo(22, 4);
      for (let i = 0; i < 6; i++) c.quadraticCurveTo(19 - i * 6.5, 9, 16 - i * 6.5 - 3, 4);
      c.closePath(); c.fill(); c.globalAlpha /= 0.62; c.globalAlpha *= 0.9; c.stroke(); c.restore();
      c.fillStyle = "#FF2A4F"; c.beginPath(); c.arc(16, -30, 3.2, 0, Math.PI * 2); c.fill();
      break;
    case "aura_venom": case "aura_crimson": {
      const pulse = rm ? 1 : 1 + Math.sin(time * 3) * 0.08;
      const g = c.createRadialGradient(0, -6, 6, 0, -6, 44 * pulse);
      g.addColorStop(0, def.color + "66"); g.addColorStop(1, def.color + "00");
      c.fillStyle = g; c.beginPath(); c.arc(0, -6, 44 * pulse, 0, Math.PI * 2); c.fill();
      break;
    }
    case "wings": {
      const flap = rm ? 0 : Math.sin(time * 5) * 0.12;
      for (const sx of [-1, 1]) {
        c.save(); c.translate(sx * 3, -2); c.rotate(sx * flap); c.scale(sx, 1);
        c.fillStyle = def.color; c.strokeStyle = "#FF5AB8"; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(28, -20); c.lineTo(34, -8);
        c.quadraticCurveTo(28, -6, 26, 2); c.quadraticCurveTo(20, -2, 16, 6); c.quadraticCurveTo(10, 0, 4, 8); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
      break;
    }
  }
}

function drawAccessory(engine: AnyEngine, def: WardrobeDefinition, x: number, y: number, scale: number, motion: AnyEngine) {
  const c = engine.ctx as CanvasRenderingContext2D;
  c.save(); heroPoseTransform(engine, c, x, y, scale, motion);
  if (motion.ghost) c.globalAlpha *= 0.35;
  drawAccessoryLocal(c, def, engine.animTime ?? 0, reduced(engine));
  c.restore();
}

/* ------------------------------------------------------------ cabinet drawing */

const GRID = { top: 150, bottom: 450 };

function gridLayout(count: number, section: CabinetSection) {
  const cols = section === "bubbles" ? 11 : section === "chambers" ? 13 : section === "reset" ? 1 : Math.min(8, count);
  const rows = Math.ceil(count / cols);
  const gap = cols > 8 ? 8 : 14;
  const maxW = 840, maxH = GRID.bottom - GRID.top;
  const size = Math.min(section === "reset" ? 0 : 104, Math.floor((maxW - gap * (cols - 1)) / cols), Math.floor((maxH - gap * (rows - 1)) / rows));
  const startX = (W - (cols * size + (cols - 1) * gap)) / 2;
  const startY = GRID.top + Math.max(0, (maxH - (rows * size + (rows - 1) * gap)) / 2);
  return (i: number) => ({ x: startX + (i % cols) * (size + gap), y: startY + Math.floor(i / cols) * (size + gap), size });
}

function card(engine: AnyEngine, x: number, y: number, size: number, owned: boolean, border: string, selected: boolean) {
  const c = engine.ctx as CanvasRenderingContext2D;
  c.fillStyle = owned ? "rgba(32,10,40,.92)" : "rgba(12,10,20,.92)"; c.fillRect(x, y, size, size);
  c.strokeStyle = owned ? border : "#3a3348"; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, size - 2, size - 2);
  if (selected) {
    const pad = reduced(engine) ? 3 : 3 + Math.sin((engine.animTime ?? 0) * 6) * 1.5;
    c.strokeStyle = accent(engine); c.lineWidth = 4; c.strokeRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
  }
}

function questionMark(engine: AnyEngine, x: number, y: number, size: number) {
  engine.label("?", x + size / 2, y + size / 2 + 7, 13, "#8d7fa8", "center");
}

function drawBadge(engine: AnyEngine, rarity: keyof typeof RARITY_BADGE, glyph: string, cx: number, cy: number, size: number, owned: boolean) {
  const c = engine.ctx as CanvasRenderingContext2D;
  c.save();
  c.globalAlpha = owned ? 1 : 0.22;
  if (!expansionRuntime(engine).assets.draw(c, RARITY_BADGE[rarity], cx, cy, size, size)) {
    c.fillStyle = "#1a0f24"; c.strokeStyle = RARITY_COLOR[rarity]; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, size * 0.42, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // Code-drawn ribbon + glyph over the pack badge.
  c.fillStyle = "rgba(5,5,9,.78)"; c.beginPath(); c.arc(cx, cy, size * 0.24, 0, Math.PI * 2); c.fill();
  c.strokeStyle = RARITY_COLOR[rarity]; c.lineWidth = 2; c.stroke();
  c.fillStyle = RARITY_COLOR[rarity];
  c.beginPath(); c.moveTo(cx - size * 0.2, cy + size * 0.3); c.lineTo(cx - size * 0.28, cy + size * 0.5); c.lineTo(cx - size * 0.12, cy + size * 0.42); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(cx + size * 0.2, cy + size * 0.3); c.lineTo(cx + size * 0.28, cy + size * 0.5); c.lineTo(cx + size * 0.12, cy + size * 0.42); c.closePath(); c.fill();
  c.font = `900 ${Math.round(size * (glyph.length > 2 ? 0.2 : 0.28))}px Georgia, serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(glyph, cx, cy + 1);
  c.restore();
  if (!owned) drawLock(engine, cx + size * 0.3, cy + size * 0.3);
}

function drawLock(engine: AnyEngine, x: number, y: number) {
  const c = engine.ctx as CanvasRenderingContext2D;
  c.save(); c.fillStyle = "#8d7fa8"; c.strokeStyle = "#8d7fa8"; c.lineWidth = 2;
  c.beginPath(); c.arc(x, y - 4, 4, Math.PI, 0); c.stroke(); c.fillRect(x - 6, y - 4, 12, 9); c.restore();
}

function drawVinyl(engine: AnyEngine, cx: number, cy: number, r: number, label: string, owned: boolean, spin: boolean) {
  const c = engine.ctx as CanvasRenderingContext2D;
  c.save(); c.globalAlpha = owned ? 1 : 0.3; c.translate(cx, cy);
  if (spin && !reduced(engine)) c.rotate((engine.animTime ?? 0) * 2);
  c.fillStyle = "#08060c"; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 1;
  for (let k = 0.45; k < 0.95; k += 0.12) { c.beginPath(); c.arc(0, 0, r * k, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = label; c.beginPath(); c.arc(0, 0, r * 0.32, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#08060c"; c.beginPath(); c.arc(0, 0, r * 0.06, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(r * 0.1, -r * 0.2, r * 0.12, r * 0.05);
  c.restore();
}

const RECORD_TINT: Record<string, string> = { auto: "#9fb3d1", stage: "#087CFF", title: "#20C98B", bonus: "#FFD36A", boss: "#FF2A9D" };

type Detail = { name: string; status?: string; statusColor?: string; lines: string[]; action?: string; preview?: WardrobeDefinition | null };

function drawEntries(engine: AnyEngine, rt: CabinetRuntime, section: CabinetSection, stats: CabinetStats): Detail {
  const c = engine.ctx as CanvasRenderingContext2D;
  const cc = copy(engine), xt = copyForEngine(engine), L = lang(engine), assets = expansionRuntime(engine).assets;
  const s = engine.settings, cab = cabinetSave(engine), items = s.collection?.items ?? {};
  const pick = rt.pick[rt.section];
  const count = SECTION_SIZE[section]();
  const at = gridLayout(count, section);
  const sel = (i: number) => i === pick;
  switch (section) {
    case "items": {
      ITEM_DEFINITIONS.forEach((item, i) => {
        const { x, y, size } = at(i), n = items[item.id] ?? 0;
        card(engine, x, y, size, n > 0, RARITY_COLOR[item.rarity], sel(i));
        c.save(); c.globalAlpha = n ? 1 : 0.14; drawItemIcon(engine, expansionRuntime(engine), item, x + size / 2, y + size / 2, size * 0.72); c.restore();
        if (!n) questionMark(engine, x, y, size);
      });
      const item = ITEM_DEFINITIONS[pick], n = items[item.id] ?? 0;
      return { name: n ? loreName(L, item.id, item.name).toUpperCase() : xt.undiscovered, status: `${item.rarity.toUpperCase()}${n ? ` · ${xt.owned(n)}` : ""}`, statusColor: RARITY_COLOR[item.rarity],
        lines: [n ? item.description : "", `${xt.howToFind}: ${item.discovery}`].filter(Boolean) };
    }
    case "familiars": {
      const unlocked: string[] = s.familiars?.unlocked ?? [];
      const active = activeFamiliar(engine)?.id;
      FAMILIARS.forEach((def, i) => {
        const { x, y, size } = at(i), owned = unlocked.includes(def.id);
        card(engine, x, y, size, owned, def.tint, sel(i));
        c.save(); c.globalAlpha = owned ? 1 : 0.16;
        if (!assets.draw(c, def.icon, x + size / 2, y + size / 2, size * 0.8)) { c.fillStyle = def.tint; c.beginPath(); c.arc(x + size / 2, y + size / 2, size * 0.3, 0, Math.PI * 2); c.fill(); }
        c.restore();
        if (!owned) questionMark(engine, x, y, size);
        if (active === def.id) engine.label("★", x + size - 14, y + 22, 12, "#FFD36A", "center");
      });
      const def = FAMILIARS[pick], owned = unlocked.includes(def.id), prog = unlockProgress(def, unlockStats(engine));
      return { name: loreName(L, def.id, def.name).toUpperCase(), status: owned ? (active === def.id ? cc.equipped : cc.unlocked) : `${cc.locked} · ${cc.progress(prog.have, prog.need)}`,
        statusColor: owned ? "#20C98B" : "#8d7fa8",
        lines: owned ? [def.idleBehaviour, `${def.assist.name}: ${def.assist.summary}`] : [def.unlock.hint],
        action: owned ? (active === def.id ? cc.unequip : cc.equip) : undefined };
    }
    case "bubbles": {
      const seenAmmo = new Set(cab.ammoSeen), seenP = new Set(cab.personalitiesSeen);
      AMMO_DEFINITIONS.forEach((def, i) => {
        const { x, y, size } = at(i), owned = seenAmmo.has(def.id);
        card(engine, x, y, size, owned, def.tint, sel(i));
        c.save(); c.globalAlpha = owned ? 1 : 0.15;
        if (!assets.draw(c, def.sprite, x + size / 2, y + size / 2, size * 0.8)) { c.strokeStyle = def.tint; c.lineWidth = 3; c.beginPath(); c.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2); c.stroke(); }
        c.restore();
        if (!owned) questionMark(engine, x, y, size);
      });
      PERSONALITIES.forEach((def, j) => {
        const i = AMMO_DEFINITIONS.length + j, { x, y, size } = at(i), owned = seenP.has(def.id);
        card(engine, x, y, size, owned, "#FFD6F1", sel(i));
        c.save(); c.globalAlpha = owned ? 1 : 0.2;
        c.strokeStyle = "#FFD6F1"; c.lineWidth = 2; c.beginPath(); c.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2); c.stroke();
        c.restore();
        engine.label(owned ? def.glyph : "?", x + size / 2, y + size / 2 + 7, 13, owned ? "#FFD6F1" : "#8d7fa8", "center");
      });
      if (pick < AMMO_DEFINITIONS.length) {
        const def = AMMO_DEFINITIONS[pick], owned = seenAmmo.has(def.id);
        return { name: owned ? loreName(L, `ammo:${def.id}`, def.name).toUpperCase() : cc.notMet, status: `${cc.ammoTitle} ${pick + 1}/${AMMO_DEFINITIONS.length}`, statusColor: def.tint, lines: owned ? [def.summary] : [cc.stat.ammoFired(1)] };
      }
      const def = PERSONALITIES[pick - AMMO_DEFINITIONS.length], owned = seenP.has(def.id);
      return { name: owned ? loreName(L, `p:${def.id}`, def.name).toUpperCase() : cc.notMet, status: `${cc.personalityTitle} ${pick - AMMO_DEFINITIONS.length + 1}/${PERSONALITIES.length}`, statusColor: "#FFD6F1", lines: owned ? [def.summary] : [] };
    }
    case "records": {
      const vinyls = items.cursed_vinyl ?? 0, playing = engine.audio?.playingTrack;
      JUKEBOX_RECORDS.forEach((record, i) => {
        const { x, y, size } = at(i), owned = isRecordUnlocked(record.id, vinyls);
        card(engine, x, y, size, owned, RECORD_TINT[record.id] ?? "#FF2A9D", sel(i));
        drawVinyl(engine, x + size / 2, y + size / 2, size * 0.38, RECORD_TINT[record.id] ?? "#FF2A9D", owned, s.jukeboxTrack === record.id);
        if (!owned) drawLock(engine, x + size - 16, y + size - 14);
      });
      const record = JUKEBOX_RECORDS[pick], owned = isRecordUnlocked(record.id, vinyls), chosen = s.jukeboxTrack === record.id;
      return { name: xt.tracks[record.id], status: owned ? (chosen ? cc.playing : cc.unlocked) : cc.locked, statusColor: owned ? "#20C98B" : "#8d7fa8",
        lines: [owned ? (playing && record.id !== "auto" && playing === record.id ? xt.nowPlaying : "") : cc.needVinyls(record.vinylsNeeded)].filter(Boolean), action: owned && !chosen ? cc.play : undefined };
    }
    case "editions": {
      THEMES.forEach((t, i) => {
        const { x, y, size } = at(i);
        card(engine, x, y, size, true, t.accent, sel(i));
        if (!(t.panel && assets.draw(c, t.panel, x + size / 2, y + size / 2, size * 0.8, size * 0.6))) {
          c.fillStyle = t.secondary; c.fillRect(x + size * 0.15, y + size * 0.25, size * 0.7, size * 0.5);
        }
        c.strokeStyle = t.accent; c.lineWidth = 3; c.strokeRect(x + size * 0.15, y + size * 0.25, size * 0.7, size * 0.5);
        if (s.theme === t.id) engine.label("★", x + size - 14, y + 22, 12, "#FFD36A", "center");
      });
      const t = THEMES[pick], chosen = s.theme === t.id;
      return { name: xt.themes[t.id], status: chosen ? cc.applied : cc.unlocked, statusColor: chosen ? "#20C98B" : "#9fb3d1", lines: [xt.themeNote], action: chosen ? undefined : cc.apply };
    }
    case "chambers": {
      const cleared = new Set(cab.chambers), secrets = new Set(cab.secretRooms);
      CHAMBERS.forEach((ch, i) => {
        const { x, y, size } = at(i), owned = cleared.has(ch.key);
        card(engine, x, y, size, owned, ch.tint, sel(i));
        engine.label(ch.label, x + size / 2, y + size / 2 + 4, 14, owned ? ch.tint : "#4a4360", "center", "Georgia");
        if (owned) engine.label("✓", x + 12, y + size - 8, 10, "#20C98B", "center");
        if (secrets.has(ch.key)) engine.label("✶", x + size - 12, y + size - 8, 10, "#FFD36A", "center");
      });
      const ch = CHAMBERS[pick], owned = cleared.has(ch.key), best = s.bestStageTimes?.[ch.key];
      return { name: owned ? ch.name.toUpperCase() : `${ch.label} · ${cc.unexplored}`, status: owned ? cc.cleared : cc.unexplored, statusColor: owned ? "#20C98B" : "#8d7fa8",
        lines: owned ? [ch.world, [typeof best === "number" ? cc.bestTime(best.toFixed(1)) : "", ch.key === "bonus" ? "" : secrets.has(ch.key) ? cc.secretFound : cc.secretHidden].filter(Boolean).join(" · ")] : [ch.world] };
    }
    case "achievements": {
      const have = new Set(cab.achievements);
      ACHIEVEMENTS.forEach((a, i) => {
        const { x, y, size } = at(i), owned = have.has(a.id);
        card(engine, x, y, size, owned, RARITY_COLOR[a.rarity], sel(i));
        drawBadge(engine, a.rarity, a.glyph, x + size / 2, y + size / 2 - 2, size * 0.82, owned);
      });
      const a = ACHIEVEMENTS[pick], owned = have.has(a.id), prog = achievementProgress(a, stats);
      const reward = a.reward ? cc.reward(cc.wardrobe[a.reward] ?? a.reward) : "";
      return { name: (cc.achievements[a.id] ?? a.id).toUpperCase(), status: `${a.rarity.toUpperCase()} · ${owned ? cc.unlocked : cc.progress(prog.have, prog.need)}`, statusColor: RARITY_COLOR[a.rarity],
        lines: [cc.stat[a.stat](a.need), reward].filter(Boolean) };
    }
    case "memorabilia": {
      MEMORABILIA.forEach((m, i) => {
        const { x, y, size } = at(i), owned = memorabiliaOwned(m, stats);
        card(engine, x, y, size, owned, "#FFD36A", sel(i));
        c.save(); c.globalAlpha = owned ? 1 : 0.12; assets.draw(c, m.prop, x + size / 2, y + size / 2, size * 0.8); c.restore();
        if (!owned) questionMark(engine, x, y, size);
      });
      const m = MEMORABILIA[pick], owned = memorabiliaOwned(m, stats), [name, lore] = cc.memorabilia[m.id] ?? [m.id, ""];
      return { name: owned ? name.toUpperCase() : xt.undiscovered, status: owned ? cc.unlocked : cc.locked, statusColor: owned ? "#FFD36A" : "#8d7fa8", lines: owned ? [lore] : [cc.stat[m.stat](m.need)] };
    }
    case "wardrobe": {
      const equipped = equippedWardrobe(cab);
      for (let i = 0; i < count; i++) {
        const def = i === 0 ? null : WARDROBE[i - 1], owned = !def || isWardrobeUnlocked(def.id, cab.achievements);
        const { x, y, size } = at(i);
        card(engine, x, y, size, owned, def?.color === "#1A0F24" || def?.color === "#2A1036" ? "#B07CFF" : def?.color ?? "#9fb3d1", sel(i));
        c.save(); c.globalAlpha = owned ? 1 : 0.18;
        c.translate(x + size / 2, y + size * 0.78); c.scale(size / 72, size / 72);
        if (def?.layer === "back") drawAccessoryLocal(c, def, engine.animTime ?? 0, reduced(engine));
        c.fillStyle = "#03040A"; c.beginPath(); c.arc(2, -21, 15, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#130B18"; c.strokeStyle = "#FF2A9D"; c.lineWidth = 2.5; c.beginPath(); c.arc(2, -21, 12.5, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = "#FFD6F1"; c.fillRect(-5, -26, 5, 6); c.fillRect(5, -26, 5, 6);
        if (def?.layer === "front") drawAccessoryLocal(c, def, engine.animTime ?? 0, reduced(engine));
        c.restore();
        if (!owned) drawLock(engine, x + size - 16, y + size - 14);
        if ((def ? equipped?.id === def.id : !equipped)) engine.label("★", x + size - 14, y + 22, 12, "#FFD36A", "center");
      }
      if (pick === 0) return { name: cc.wardrobe.none.toUpperCase(), status: !equipped ? cc.equipped : "", statusColor: "#20C98B", lines: [], action: equipped ? cc.equip : undefined, preview: null };
      const def = WARDROBE[pick - 1], owned = isWardrobeUnlocked(def.id, cab.achievements), on = equipped?.id === def.id;
      const by = cc.achievements[def.unlockedBy] ?? def.unlockedBy, ach = achievementById(def.unlockedBy)!;
      return { name: (cc.wardrobe[def.id] ?? def.id).toUpperCase(), status: owned ? (on ? cc.equipped : cc.unlocked) : cc.locked, statusColor: owned ? "#20C98B" : "#8d7fa8",
        lines: [`${cc.sections.achievements}: ${by}`, owned ? "" : cc.stat[ach.stat](ach.need)].filter(Boolean), action: owned ? (on ? cc.unequip : cc.equip) : undefined, preview: owned ? def : null };
    }
    case "reset": {
      const left = 160;
      c.save(); c.fillStyle = "rgba(40,4,12,.9)"; c.fillRect(left - 30, GRID.top, W - 2 * (left - 30), GRID.bottom - GRID.top);
      c.strokeStyle = rt.armed ? "#FF2A4F" : "#7a2a3a"; c.lineWidth = rt.armed ? 4 : 2; c.strokeRect(left - 30, GRID.top, W - 2 * (left - 30), GRID.bottom - GRID.top); c.restore();
      engine.label(cc.resetTitle, W / 2, GRID.top + 50, 20, "#FF5A7A", "center", "Georgia");
      cc.resetBody.forEach((line, i) => engine.label(fitText(engine, line, 12, 620), W / 2, GRID.top + 100 + i * 32, 12, "#FFD6F1", "center"));
      return { name: rt.resetFlash > 0 ? cc.resetDone : cc.resetTitle, status: "", lines: [], action: rt.armed ? cc.resetConfirm : cc.resetPress };
    }
  }
}

function collectedPercent(engine: AnyEngine, stats: CabinetStats) {
  const s = engine.settings, cab = cabinetSave(engine), vinyls = s.collection?.items?.cursed_vinyl ?? 0;
  const parts: [number, number][] = [
    [stats.items, ITEM_DEFINITIONS.length], [stats.familiars, FAMILIARS.length], [stats.ammoKinds, AMMO_DEFINITIONS.length],
    [stats.personalities, PERSONALITIES.length], [JUKEBOX_RECORDS.filter(r => isRecordUnlocked(r.id, vinyls)).length, JUKEBOX_RECORDS.length],
    [Math.min(CHAMBERS.length, cab.chambers.filter(k => CHAMBERS.some(ch => ch.key === k)).length), CHAMBERS.length],
    [cab.achievements.filter(id => !!achievementById(id)).length, ACHIEVEMENTS.length], [MEMORABILIA.filter(m => memorabiliaOwned(m, stats)).length, MEMORABILIA.length],
    [WARDROBE.filter(w => isWardrobeUnlocked(w.id, cab.achievements)).length, WARDROBE.length],
  ];
  const have = parts.reduce((n, [h]) => n + h, 0), total = parts.reduce((n, [, t]) => n + t, 0);
  return Math.floor((have / total) * 100);
}

function drawCabinet(engine: AnyEngine, rt: CabinetRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const cc = copy(engine), acc = accent(engine), stats = cabinetStats(engine), section = CABINET_SECTIONS[rt.section];
  c.save();
  c.fillStyle = "rgba(4,3,9,.97)"; c.fillRect(0, 0, W, H);
  const t = themeById(engine.settings?.theme);
  if (!(t.panel && expansionRuntime(engine).assets.draw(c, t.panel, W / 2, H / 2, W - 20, H - 20))) {
    if (typeof engine.drawGothicBox === "function") engine.drawGothicBox(14, 14, W - 28, H - 28, acc);
    else { c.strokeStyle = acc; c.lineWidth = 3; c.strokeRect(18, 18, W - 36, H - 36); }
  } else { c.fillStyle = "rgba(4,3,9,.72)"; c.fillRect(40, 40, W - 80, H - 80); }
  c.restore();
  engine.label(fitText(engine, cc.title, 26, 640, "Georgia"), W / 2, 72, 26, acc, "center", "Georgia");
  engine.label(cc.collected(collectedPercent(engine, stats)), W / 2, 100, 12, "#FFD36A", "center");
  // Section bar.
  const tabW = 86, startX = (W - CABINET_SECTIONS.length * tabW) / 2;
  CABINET_SECTIONS.forEach((sec, i) => {
    const x = startX + i * tabW, on = i === rt.section;
    c.fillStyle = on ? "rgba(255,42,157,.22)" : "rgba(12,10,20,.85)"; c.fillRect(x + 2, 110, tabW - 4, 28);
    c.strokeStyle = on ? acc : "#3a3348"; c.lineWidth = on ? 2.5 : 1; c.strokeRect(x + 2, 110, tabW - 4, 28);
    engine.label(fitText(engine, cc.sectionsShort[sec], 12, tabW - 8), x + tabW / 2, 131, 12, on ? "#FFD6F1" : "#8d7fa8", "center");
  });
  const detail = drawEntries(engine, rt, section, stats);
  // Detail panel.
  const left = 70, right = W - 70, top = 466;
  c.save(); c.fillStyle = "rgba(12,6,20,.9)"; c.fillRect(left - 14, top, right - left + 28, 182); c.strokeStyle = "#3a3348"; c.lineWidth = 1; c.strokeRect(left - 14, top, right - left + 28, 182); c.restore();
  const textRight = detail.preview !== undefined ? right - 130 : right;
  engine.label(fitText(engine, detail.name, 18, section === "reset" ? textRight - left : textRight - left - 220, "Georgia"), left, top + 34, 18, section === "reset" ? "#FF5A7A" : "#FFD6F1", "left", "Georgia");
  if (detail.status) engine.label(fitText(engine, detail.status, 12, 300), textRight, top + 34, 12, detail.statusColor ?? "#9fb3d1", "right");
  detail.lines.slice(0, 3).forEach((line, i) => engine.label(fitText(engine, line, 12, textRight - left), left, top + 70 + i * 28, 12, i === 0 ? "#c9d6ec" : "#9fb3d1"));
  if (detail.action) engine.label(fitText(engine, detail.action, 12, textRight - left), left, top + 164, 12, section === "reset" && rt.armed ? "#FF2A4F" : acc);
  if (detail.preview !== undefined) {
    const hero = engine.selected ?? engine.hero ?? "vesper";
    c.save(); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(right - 110, top + 14, 124, 154); c.restore();
    const def = detail.preview;
    if (def?.layer === "back") drawAccessory(engine, def, right - 48, top + 100, 1.7, {});
    if (typeof engine.drawHeroBase === "function") engine.drawHeroBase(right - 48, top + 100, hero, 1.7);
    if (def?.layer === "front") drawAccessory(engine, def, right - 48, top + 100, 1.7, {});
  }
  engine.label(fitText(engine, cc.hint, 11, W - 100), W / 2, 682, 11, "#9fb3d1", "center");
}

/* ------------------------------------------------------------ title: living cabinet */

function drawWeb(engine: AnyEngine, web: number) {
  if (web <= 0) return;
  const c = engine.ctx as CanvasRenderingContext2D, rm = reduced(engine);
  const ox = 30, oy = 30, R = 170, spokes = 7, rings = 9;
  const shownSpokes = Math.ceil(Math.min(1, web / 0.25) * spokes);
  const shownRings = Math.floor(Math.max(0, (web - 0.25) / 0.75) * rings);
  const angle = (k: number) => (k / (spokes - 1)) * (Math.PI / 2);
  c.save(); c.strokeStyle = "rgba(220,230,255,.42)"; c.lineWidth = 1.2;
  for (let k = 0; k < shownSpokes; k++) { c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(angle(k)) * R, oy + Math.sin(angle(k)) * R); c.stroke(); }
  for (let r = 1; r <= shownRings; r++) {
    const rr = (r / (rings + 1)) * R;
    c.beginPath();
    for (let k = 0; k < shownSpokes; k++) {
      const sag = k > 0 ? 0.92 : 1;
      const px = ox + Math.cos(angle(k)) * rr, py = oy + Math.sin(angle(k)) * rr;
      if (k === 0) c.moveTo(px, py);
      else { const mid = (angle(k) + angle(k - 1)) / 2; c.quadraticCurveTo(ox + Math.cos(mid) * rr * sag, oy + Math.sin(mid) * rr * sag, px, py); }
    }
    c.stroke();
  }
  if (web >= 1) { // Dew on the finished web.
    c.fillStyle = "rgba(180,240,255,.7)";
    for (let i = 0; i < 9; i++) { const a = angle(i % spokes), rr = ((i % rings) + 1) / (rings + 1) * R; c.beginPath(); c.arc(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr, 1.8, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
  // The spider(s): dangle from the newest strand while building.
  const spiders = livingTier(engine) >= 4 ? 2 : 1;
  for (let i = 0; i < spiders; i++) {
    const k = Math.max(0, Math.min(spokes - 1, shownSpokes - 1 - i * 3));
    const reach = (shownRings + 1) / (rings + 1) * R;
    const sx = ox + Math.cos(angle(k)) * reach, baseY = oy + Math.sin(angle(k)) * reach;
    const drop = rm ? 18 : 18 + Math.sin((engine.animTime ?? 0) * 1.3 + i * 2) * 14;
    c.save(); c.strokeStyle = "rgba(220,230,255,.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, baseY); c.lineTo(sx, baseY + drop); c.stroke();
    drawSpider(c, sx, baseY + drop + 5, rm ? 0 : (engine.animTime ?? 0));
    c.restore();
  }
}

function drawSpider(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  c.save(); c.translate(x, y);
  c.strokeStyle = "#1a0f24"; c.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    const wig = Math.sin(t * 8 + i) * 1.5;
    c.beginPath(); c.moveTo(0, -1 + i * 1.5); c.lineTo(sx * (7 + i), -4 + i * 3 + wig); c.lineTo(sx * (10 + i), 2 + i * 3); c.stroke();
  }
  c.fillStyle = "#120818"; c.beginPath(); c.ellipse(0, 2, 5, 6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#FF2A4F"; c.beginPath(); c.moveTo(0, 0); c.lineTo(2, 3); c.lineTo(0, 6); c.lineTo(-2, 3); c.closePath(); c.fill();
  c.restore();
}

function drawWidowEyes(c: CanvasRenderingContext2D, cx: number, cy: number, scale: number, open: number, glow: boolean) {
  c.save(); c.fillStyle = "#FF2A4F"; c.shadowColor = "#FF2A4F"; c.shadowBlur = glow ? 16 : 0;
  for (const sx of [-1, 1]) {
    c.beginPath(); const ex = cx + sx * 34 * scale;
    c.moveTo(ex - 16 * scale, cy); c.quadraticCurveTo(ex, cy - 9 * scale * open, ex + 16 * scale, cy); c.quadraticCurveTo(ex, cy + 6 * scale * open, ex - 16 * scale, cy); c.fill();
  }
  c.restore();
}

function drawTitleBackdrop(engine: AnyEngine) {
  const c = engine.ctx as CanvasRenderingContext2D, tier = livingTier(engine);
  if (tier >= 4) { // Widow silhouette: veil and crown behind the logo.
    c.save(); c.globalAlpha = 0.5; c.fillStyle = "#3a0820"; c.strokeStyle = "rgba(255,42,79,.45)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2 - 230, 420); c.quadraticCurveTo(W / 2 - 150, 120, W / 2, 96); c.quadraticCurveTo(W / 2 + 150, 120, W / 2 + 230, 420); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#3a0a1e"; c.beginPath(); c.moveTo(W / 2 - 50, 104); c.lineTo(W / 2 - 40, 70); c.lineTo(W / 2 - 18, 92); c.lineTo(W / 2, 60); c.lineTo(W / 2 + 18, 92); c.lineTo(W / 2 + 40, 70); c.lineTo(W / 2 + 50, 104); c.closePath(); c.fill();
    c.restore();
  }
  drawWeb(engine, cabinetSave(engine).web);
}

function drawCandle(c: CanvasRenderingContext2D, x: number, y: number, t: number, gold: boolean) {
  c.save(); c.fillStyle = gold ? "#FFD36A" : "#E8DCC8"; c.fillRect(x - 6, y - 34, 12, 34);
  c.fillStyle = "#2a1a10"; c.fillRect(x - 10, y, 20, 5);
  const flick = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
  c.fillStyle = "rgba(255,170,60,.25)"; c.beginPath(); c.arc(x, y - 44, 16 * flick, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#FFB347"; c.beginPath(); c.ellipse(x, y - 42, 4, 8 * flick, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#FFF3C4"; c.beginPath(); c.ellipse(x, y - 40, 2, 4, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

export const TITLE_SECRET = { x: 54, y: 470, r: 22 };

function drawTitleOrnaments(engine: AnyEngine, rt: CabinetRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D, tier = livingTier(engine), rm = reduced(engine), t = rm ? 0 : engine.animTime ?? 0;
  const assets = expansionRuntime(engine).assets, cab = cabinetSave(engine);
  if (tier >= 1) { drawCandle(c, 120, 668, t, tier >= 5); drawCandle(c, 840, 668, t + 1.7, tier >= 5); }
  if (tier >= 2) { c.save(); c.globalAlpha = 0.9; assets.draw(c, "chandelier", 320, 54, 84, 84); assets.draw(c, "chandelier", 640, 54, 84, 84); c.restore(); }
  if (tier >= 3) { // The Widow watches from above the logo.
    const blink = rm ? 1 : Math.abs(Math.sin((engine.animTime ?? 0) * 0.7)) > 0.97 ? 0.15 : 1;
    c.save(); c.globalAlpha = 0.85; drawWidowEyes(c, W / 2, 100, 0.75, blink, !rm); c.restore();
  }
  if (tier >= 5 && !(engine.cheats?.power || engine.cheats?.super || engine.cheats?.extra)) engine.label(copy(engine).approves, W / 2, 676, 12, "#FFD36A", "center", "Georgia");
  // The hidden object: a blinking eye in the frame that becomes a secret door once found.
  const { x, y } = TITLE_SECRET;
  if (cab.titleSecret) { c.save(); c.globalAlpha = 0.85; if (!assets.draw(c, "secret_door", x, y, 40, 40)) { c.fillStyle = "#2a1036"; c.fillRect(x - 12, y - 18, 24, 36); } c.restore(); }
  else {
    const open = rm ? 0.5 : Math.max(0, Math.sin((engine.animTime ?? 0) * 0.9) - 0.75) * 4;
    c.save(); c.globalAlpha = 0.35 + Math.min(1, open) * 0.5; c.fillStyle = "#FFD36A";
    c.beginPath(); c.moveTo(x - 9, y); c.quadraticCurveTo(x, y - 7 * Math.max(0.15, Math.min(1, open)), x + 9, y); c.quadraticCurveTo(x, y + 5 * Math.max(0.15, Math.min(1, open)), x - 9, y); c.fill();
    c.fillStyle = "#05030a"; c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); c.restore();
  }
  void rt;
}

function drawSecretCard(engine: AnyEngine, rt: CabinetRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D, cc = copy(engine);
  const alpha = reduced(engine) ? 1 : Math.min(1, rt.secretCard / 0.3, (6 - rt.secretCard) / 0.3 + 0.01);
  c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha));
  c.fillStyle = "rgba(6,3,12,.95)"; c.fillRect(170, 220, 620, 250); c.strokeStyle = "#FFD36A"; c.lineWidth = 3; c.strokeRect(170, 220, 620, 250);
  expansionRuntime(engine).assets.draw(c, "secret_door", 250, 330, 110, 110);
  c.restore();
  engine.label(cc.secretTitle, 330, 280, 20, "#FFD36A", "left", "Georgia");
  const words = cc.secretBody.split(/(?<=[\s。、।])/); let line = "", y = 322;
  for (const w of words) { if ((line + w).length > 30 && line) { engine.label(line.trim(), 330, y, 12, "#FFD6F1"); y += 26; line = ""; } line += w; }
  if (line) engine.label(line.trim(), 330, y, 12, "#FFD6F1");
  engine.label(`+ ${cc.memorabilia.secret_door[0]}`, 330, 448, 12, "#20C98B");
}

export function revealTitleSecret(engine: AnyEngine) {
  if (engine.state !== "title" || cabinetRuntime(engine).open) return false;
  const cab = cabinetSave(engine), rt = cabinetRuntime(engine);
  const first = !cab.titleSecret;
  cab.titleSecret = true;
  rt.secretCard = 6;
  engine.titleIdle = 0;
  engine.audio?.secret?.();
  if (first) { engine.save?.(); checkAchievements(engine); }
  engine.syncAuditData?.();
  return first;
}

/* ------------------------------------------------------------ remarks + toasts */

function drawRemark(engine: AnyEngine, rt: CabinetRuntime) {
  const remark = rt.remark!;
  const c = engine.ctx as CanvasRenderingContext2D, cc = copy(engine), rm = reduced(engine);
  const a = rm ? 1 : Math.min(1, remark.time / 0.25);
  c.save(); c.globalAlpha = a;
  c.fillStyle = "rgba(8,2,12,.92)"; c.fillRect(50, 500, W - 100, 140); c.strokeStyle = "#FF2A4F"; c.lineWidth = 2; c.strokeRect(50, 500, W - 100, 140);
  drawWidowEyes(c, 140, 566, 0.9, 1, !rm);
  c.restore();
  if (a < 0.4) return;
  engine.label(fitText(engine, `“${remark.text}”`, 15, 640, "Georgia"), 230, 560, 15, "#FFD6F1", "left", "Georgia");
  engine.label(cc.remarkBy, 230, 596, 12, "#FF5A7A");
  engine.label(cc.skip, W - 70, 626, 10, "#9fb3d1", "right");
}

function drawToast(engine: AnyEngine, rt: CabinetRuntime) {
  const toast = rt.toasts[0];
  if (!toast) return;
  const def = achievementById(toast.id);
  if (!def) return;
  const c = engine.ctx as CanvasRenderingContext2D, cc = copy(engine), rm = reduced(engine);
  const age = CABINET_LIMITS.toastLife - toast.life;
  const slide = rm ? 0 : Math.max(0, 1 - age / 0.25) * 360;
  const x = 560 + slide, y = engine.state === "title" ? 86 : 80, w = 380, h = 54;
  c.save(); c.globalAlpha = rm ? 1 : Math.min(1, toast.life / 0.3);
  c.fillStyle = "rgba(10,4,18,.9)"; c.fillRect(x, y, w, h); c.strokeStyle = RARITY_COLOR[def.rarity]; c.lineWidth = 2; c.strokeRect(x, y, w, h);
  c.restore();
  drawBadge(engine, def.rarity, def.glyph, x + 28, y + h / 2, 44, true);
  engine.label(cc.achievementToast, x + 58, y + 22, 10, "#FFD36A");
  engine.label(fitText(engine, (cc.achievements[def.id] ?? def.id).toUpperCase(), 14, w - 70, "Georgia"), x + 58, y + 46, 14, "#FFD6F1", "left", "Georgia");
}

/* ------------------------------------------------------------ install */

const SKIP_TOAST_STATES = new Set(["attract", "boot"]);

export function installLivingCabinet(EngineClass: EngineConstructor) {
  const proto = EngineClass.prototype as AnyEngine;
  if (proto[INSTALL_KEY]) return;
  proto[INSTALL_KEY] = true;
  const o = {
    start: proto.start, destroy: proto.destroy, press: proto.press, update: proto.update, render: proto.render,
    setState: proto.setState, drawStars: proto.drawStars, drawTitle: proto.drawTitle, drawHero: proto.drawHero,
    fireBubble: proto.fireBubble, popChain: proto.popChain, clearStage: proto.clearStage, collectReward: proto.collectReward,
    updatePause: proto.updatePause, syncAuditData: proto.syncAuditData, toTitle: proto.toTitle,
  };

  setFamiliarDecor({
    walkerCap: engine => titleWalkerCap(livingTier(engine)),
    dancing: engine => dancing(engine),
    onAssist: engine => { bump(engine, "assists"); },
  });

  proto.openCabinet = function (this: AnyEngine, section?: CabinetSection) { return openCabinet(this, section); };
  proto.closeCabinet = function (this: AnyEngine) { closeCabinet(this); };
  proto.revealTitleSecret = function (this: AnyEngine) { return revealTitleSecret(this); };

  proto.start = function (this: AnyEngine) {
    const rt = cabinetRuntime(this);
    cabinetSave(this);
    if (typeof window !== "undefined" && !rt.keyHandler) {
      rt.keyHandler = (event: KeyboardEvent) => {
        if (event.repeat || (event.target as HTMLElement | null)?.closest?.(".lang-menu")) return;
        if (event.code === "KeyV") {
          if (rt.open) closeCabinet(this); else if (!openCabinet(this)) return;
          event.preventDefault(); event.stopImmediatePropagation();
        } else if (rt.open && (event.code === "KeyQ" || event.code === "KeyE")) {
          setSection(this, event.code === "KeyQ" ? -1 : 1);
          event.preventDefault(); event.stopImmediatePropagation();
        }
      };
      // Capture phase so the M2 pause-tab Q/E handler never sees keys meant for the cabinet.
      window.addEventListener("keydown", rt.keyHandler, true);
    }
    if (this.devTools && typeof window !== "undefined") {
      // Development-only QA hook (screenshots, manual testing). Not shipped behaviour.
      (window as any).__bubbleHexCabinet = {
        open: (section?: CabinetSection) => openCabinet(this, section),
        close: () => closeCabinet(this),
        pick: (n: number) => { rt.pick[rt.section] = n; },
        grant: (ids: string[] | "all") => { const cab = cabinetSave(this); for (const a of ACHIEVEMENTS) if (ids === "all" || ids.includes(a.id)) if (!cab.achievements.includes(a.id)) cab.achievements.push(a.id); this.save?.(); },
        counter: (key: string, n: number) => { cabinetSave(this).counters[key] = n; },
        seen: (ammo: string[], personalities: string[]) => { const cab = cabinetSave(this); cab.ammoSeen = [...new Set([...cab.ammoSeen, ...ammo])]; cab.personalitiesSeen = [...new Set([...cab.personalitiesSeen, ...personalities])]; },
        chambers: (keys: string[], secrets: string[] = []) => { const cab = cabinetSave(this); cab.chambers = [...new Set([...cab.chambers, ...keys])]; cab.secretRooms = [...new Set([...cab.secretRooms, ...secrets])]; },
        web: (n: number) => { cabinetSave(this).web = n; },
        wear: (id: string | null) => { cabinetSave(this).wardrobeEquipped = id; },
        remark: (text?: string) => { rt.remark = { text: text ?? copy(this).remarks[0], time: 1 }; },
        secret: () => revealTitleSecret(this),
        toast: (id: string) => rt.toasts.push({ id, life: CABINET_LIMITS.toastLife }),
        idle: (n: number) => { this.titleIdle = n; },
        check: () => checkAchievements(this),
        state: () => ({ open: rt.open, section: CABINET_SECTIONS[rt.section], tier: livingTier(this), stats: cabinetStats(this), cabinet: cabinetSave(this) }),
      };
    }
    return o.start.call(this);
  };

  proto.destroy = function (this: AnyEngine) {
    const rt = runtimes.get(this);
    if (rt?.keyHandler && typeof window !== "undefined") { window.removeEventListener("keydown", rt.keyHandler, true); rt.keyHandler = null; }
    return o.destroy.call(this);
  };

  proto.press = function (this: AnyEngine, action: string, source = "touch") {
    const rt = cabinetRuntime(this);
    if (rt.open) {
      // Cabinet owns input: no title tokens/cheats, no pause toggling underneath.
      if (!this.input?.press?.(action, source)) return;
      this.held[action] = true;
      if (action === "pause" || action === "start") { closeCabinet(this); return; }
      this.just.add(action);
      return;
    }
    if (rt.secretCard > 0 && this.state === "title") {
      if (!this.input?.press?.(action, source)) return;
      this.held[action] = true; rt.secretCard = 0; this.titleIdle = 0;
      return;
    }
    if (rt.remark && this.state === "stageIntro" && (action === "jump" || action === "start" || action === "bubble")) rt.remark = null;
    return o.press.call(this, action, source);
  };

  proto.update = function (this: AnyEngine, dt: number) {
    const rt = cabinetRuntime(this);
    rt.clock += dt;
    if (rt.toasts.length && !rt.open) { rt.toasts[0].life -= dt; if (rt.toasts[0].life <= 0) rt.toasts.shift(); }
    if (rt.resetFlash > 0) rt.resetFlash -= dt;
    if (rt.open) {
      if (this.state !== "title" && this.state !== "paused") { rt.open = false; return o.update.call(this, dt); }
      this.pollGamepad?.();
      if (rt.open) cabinetInput(this, rt);
      this.animTime = (this.animTime ?? 0) + dt;
      this.syncAuditData?.();
      this.just.clear();
      return;
    }
    if (rt.remark) {
      if (this.state === "stageIntro") {
        rt.remark.time += dt;
        if (rt.remark.time < CABINET_LIMITS.remarkHold && this.stateTime > 1.4) this.stateTime = 1.4;
      } else rt.remark = null;
    }
    if (rt.secretCard > 0) rt.secretCard = Math.max(0, rt.secretCard - dt);
    const before = this.state;
    const result = o.update.call(this, dt);
    const cab = cabinetSave(this);
    if (this.state === "title") {
      const next = stepWeb(cab.web, dt);
      if (next !== cab.web) { cab.web = next; rt.dirty = true; }
    }
    if (before !== "dying" && this.state === "dying") bump(this, "deaths");
    const body = familiarRuntime(this).body;
    const sleeping = body?.state === "sleep" && (this.state === "playing" || this.state === "hurry");
    if (sleeping && !rt.wasSleeping) bump(this, "naps");
    rt.wasSleeping = !!sleeping;
    rt.evalClock += dt;
    if (rt.evalClock >= 0.5) { rt.evalClock = 0; checkAchievements(this); }
    if (rt.dirty && rt.clock - rt.lastSave > 8 && this.state !== "attract") { rt.dirty = false; rt.lastSave = rt.clock; this.save?.(); }
    return result;
  };

  proto.render = function (this: AnyEngine) {
    o.render.call(this);
    const rt = cabinetRuntime(this);
    const c = this.ctx as CanvasRenderingContext2D;
    c.save();
    if (rt.open) drawCabinet(this, rt);
    else {
      if (rt.remark && this.state === "stageIntro") drawRemark(this, rt);
      if (rt.secretCard > 0 && this.state === "title") drawSecretCard(this, rt);
      if (!SKIP_TOAST_STATES.has(this.state)) drawToast(this, rt);
    }
    c.restore();
  };

  proto.setState = function (this: AnyEngine, next: string) {
    const rt = cabinetRuntime(this);
    if (this.state === "stageClear" && next === "stageIntro" && rollRemark(rt.remarkClock, rt.clock, rt.rng)) {
      const lines = copy(this).remarks;
      let index = Math.floor(rt.rng() * lines.length) % lines.length;
      if (index === rt.lastRemark) index = (index + 1) % lines.length;
      rt.lastRemark = index;
      rt.remark = { text: lines[index], time: 0 };
      bump(this, "widowRemarks");
    }
    return o.setState.call(this, next);
  };

  proto.drawStars = function (this: AnyEngine, ...args: unknown[]) {
    const result = o.drawStars.apply(this, args);
    if (this.state === "title") drawTitleBackdrop(this);
    return result;
  };

  proto.drawTitle = function (this: AnyEngine) {
    o.drawTitle.call(this);
    drawTitleOrnaments(this, cabinetRuntime(this));
  };

  proto.drawHeroBase = function (this: AnyEngine, x: number, y: number, hero: string, scale = 1) {
    return o.drawHero.call(this, x, y, hero, scale, false, {});
  };

  proto.drawHero = function (this: AnyEngine, x: number, y: number, hero: string, scale = 1, ghost = false, motion: AnyEngine = {}) {
    const def = !ghost && scale >= 0.9 ? equippedWardrobe(cabinetSave(this)) : undefined;
    const dance = this.state === "title" && scale > 1.2 && dancing(this);
    if (!def && !dance) return o.drawHero.call(this, x, y, hero, scale, ghost, motion);
    const c = this.ctx as CanvasRenderingContext2D;
    c.save();
    if (dance) {
      const t = (this.animTime ?? 0) * 5 + (hero === "jade" ? 1.4 : 0), feet = y + 24 * scale;
      c.translate(x, feet); c.rotate(Math.sin(t * 0.5) * 0.12); c.translate(-x, -feet - Math.abs(Math.sin(t)) * 14);
    }
    if (def?.layer === "back") drawAccessory(this, def, x, y, scale, motion);
    const result = o.drawHero.call(this, x, y, hero, scale, ghost, motion);
    if (def?.layer === "front") drawAccessory(this, def, x, y, scale, motion);
    c.restore();
    return result;
  };

  proto.fireBubble = function (this: AnyEngine, ...args: unknown[]) {
    const known = new Set<object>(this.bubbles ?? []);
    const result = o.fireBubble.apply(this, args);
    if (this.state !== "attract") {
      const cab = cabinetSave(this);
      for (const b of (this.bubbles ?? []) as object[]) {
        if (known.has(b)) continue;
        const meta = metaFor(this, b);
        if (!meta) continue;
        if (meta.type) { bump(this, "ammoFired"); if (!cab.ammoSeen.includes(meta.type)) cab.ammoSeen.push(meta.type); }
        if (meta.personality && !cab.personalitiesSeen.includes(meta.personality)) cab.personalitiesSeen.push(meta.personality);
      }
    }
    return result;
  };

  proto.popChain = function (this: AnyEngine, root: AnyEngine) {
    const before = (this.pendingPops as unknown[] | undefined)?.length ?? 0;
    const result = o.popChain.call(this, root);
    const added = ((this.pendingPops as unknown[] | undefined)?.length ?? 0) - before;
    if (added > 0) bump(this, "pops", added);
    return result;
  };

  proto.clearStage = function (this: AnyEngine, demo: boolean) {
    o.clearStage.call(this, demo);
    if (demo || this.state !== "stageClear") return;
    const cab = cabinetSave(this), key = this.level?.bonus ? "bonus" : this.level?.loreFragmentId;
    if (key && !cab.chambers.includes(key)) cab.chambers.push(key);
    if (!this.stageDamaged) bump(this, "perfects");
    if (this.secretFound && key && key !== "bonus" && !cab.secretRooms.includes(key)) cab.secretRooms.push(key);
    checkUnlocks(this);
    checkAchievements(this);
    this.save?.();
  };

  proto.collectReward = function (this: AnyEngine, r: AnyEngine) {
    const before = this.venom?.size ?? 0;
    o.collectReward.call(this, r);
    if (r?.letter && before === 4 && (this.venom?.size ?? 0) === 0) bump(this, "venomSpelled");
  };

  proto.updatePause = function (this: AnyEngine) {
    if (interfaceRuntime(this).tab === "collection" && this.just?.has("jump")) { openCabinet(this); this.pauseJumpPending = false; return; }
    return o.updatePause.call(this);
  };

  proto.toTitle = function (this: AnyEngine, ...args: unknown[]) {
    const rt = cabinetRuntime(this);
    rt.remark = null; rt.open = false;
    if (rt.dirty) { rt.dirty = false; rt.lastSave = rt.clock; }
    const result = o.toTitle.apply(this, args);
    this.save?.();
    return result;
  };

  proto.syncAuditData = function (this: AnyEngine) {
    o.syncAuditData.call(this);
    if (!this.canvas?.dataset) return;
    const rt = cabinetRuntime(this), cab = cabinetSave(this);
    Object.assign(this.canvas.dataset, {
      expansionCabinet: rt.open ? "1" : "",
      expansionCabinetSection: CABINET_SECTIONS[rt.section],
      expansionAchievements: String(cab.achievements.length),
      expansionTier: String(livingTier(this)),
      expansionWardrobe: equippedWardrobe(cab)?.id ?? "",
      expansionWeb: String(Math.floor(cab.web * 100)),
      expansionTitleSecret: cab.titleSecret ? "1" : "",
      expansionRemark: rt.remark?.text ?? "",
      expansionResetArmed: rt.armed ? "1" : "",
    });
  };
}


