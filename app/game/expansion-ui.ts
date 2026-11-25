/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BUBBLE HEX — Forbidden Expansion, milestone 2: reusable interface layer.
 *
 * Animated score counter, combo/time/boss meters on the pack's meter frames,
 * pause tabs (settings · collection · jukebox · theme), the throttled memetic
 * announcer, and the Cursed Vinyl jukebox. Installed onto the native engine
 * after forbidden-expansion.ts; every hook calls the original method and the
 * original pause controls are untouched on the SETTINGS tab.
 */
import { Announcer, type AnnouncementEvent } from "./announcer";
import { loreName } from "./cabinet-i18n";
import { isEditionUnlocked } from "./chambers";
import { chamberCopy } from "./chambers-i18n";
import { loreDesc } from "./lore-i18n";
import type { MusicTrackId } from "./audio";
import { EXPANSION_COPY, PAUSE_TABS, type ExpansionCopy, type PauseTab } from "./expansion-i18n";
import { drawItemIcon, expansionRuntime, fitText } from "./forbidden-expansion";
import type { Lang } from "./i18n";
import { ITEM_DEFINITIONS, RARITY_COLOR, discoveredCount } from "./items";
import { JUKEBOX_RECORDS, THEMES, chamberTrack, isRecordUnlocked, themeById, type ThemeDefinition } from "./jukebox";

const INSTALL_KEY = Symbol.for("bubblehex.forbidden-expansion.m2");
const W = 960;
const PLAY_MUSIC_STATES = new Set(["stageIntro", "playing", "hurry", "paused", "stageClear"]);

type EngineConstructor = { prototype: object };
type AnyEngine = Record<PropertyKey, any>;

export type InterfaceRuntime = {
  announcer: Announcer;
  shownScore: number;
  tab: PauseTab;
  pick: Record<Exclude<PauseTab, "settings">, number>;
  lang: Lang;
  lastChain: number;
  keyHandler: ((event: KeyboardEvent) => void) | null;
};

const runtimes = new WeakMap<object, InterfaceRuntime>();

/** Extra pause tabs contributed by later milestones (M4 familiars). */
export type PauseTabHandler = {
  size: (engine: AnyEngine) => number;
  select: (engine: AnyEngine, ui: InterfaceRuntime) => void;
  jump?: (engine: AnyEngine, ui: InterfaceRuntime) => void;
  draw: (engine: AnyEngine, ui: InterfaceRuntime, copy: ExpansionCopy) => void;
};
const EXTRA_TABS = new Map<PauseTab, PauseTabHandler>();
export function registerPauseTab(tab: PauseTab, handler: PauseTabHandler) { EXTRA_TABS.set(tab, handler); }
/** Extra "· X n/m" fragments for the collection header (familiars, etc.). */
const COLLECTION_SUFFIXES: ((engine: AnyEngine, copy: ExpansionCopy) => string)[] = [];
export function registerCollectionSuffix(fn: (engine: AnyEngine, copy: ExpansionCopy) => string) { if (!COLLECTION_SUFFIXES.includes(fn)) COLLECTION_SUFFIXES.push(fn); }
export const copyForEngine = (engine: AnyEngine): ExpansionCopy => copyFor(interfaceRuntime(engine));


export function interfaceRuntime(engine: AnyEngine): InterfaceRuntime {
  let ui = runtimes.get(engine);
  if (!ui) {
    ui = { announcer: new Announcer(), shownScore: engine.score ?? 0, tab: "settings", pick: { collection: 0, familiars: 0, jukebox: 0, theme: 0 }, lang: "en", lastChain: 0, keyHandler: null };
    runtimes.set(engine, ui);
  }
  return ui;
}

const copyFor = (ui: InterfaceRuntime): ExpansionCopy => EXPANSION_COPY[ui.lang] ?? EXPANSION_COPY.en;
const theme = (engine: AnyEngine): ThemeDefinition => themeById(engine.settings?.theme);
const vinyls = (engine: AnyEngine): number => engine.settings?.collection?.items?.cursed_vinyl ?? 0;

/** Animated score counter: eases toward the real score; snaps for reduced motion or a reset. */
export function stepShownScore(shown: number, actual: number, dt: number, reduced: boolean): number {
  if (reduced || actual <= shown) return actual;
  const gap = actual - shown;
  return Math.min(actual, shown + Math.max(1, Math.ceil(gap * Math.min(1, dt * 9))));
}

export function announce(engine: AnyEngine, event: AnnouncementEvent) {
  if (engine.state === "attract") return;
  const accepted = interfaceRuntime(engine).announcer.trigger(event);
  if (!accepted) return;
  engine.scorePulse = Math.max(engine.scorePulse ?? 0, 0.3);
  const audio = engine.audio;
  if (audio?.tone) [784, 1047, 1319].forEach((note, i) => setTimeout(() => audio.tone(note, 0.09, "square", 60, 0.07), i * 55));
}

export function setPauseTab(engine: AnyEngine, tab: PauseTab) {
  if (!PAUSE_TABS.includes(tab)) return;
  const ui = interfaceRuntime(engine);
  ui.tab = tab;
  engine.pauseJumpPending = false;
  engine.pauseSfxDirections?.clear?.();
  engine.syncAuditData?.();
}

function cycleTab(engine: AnyEngine, dir: number) {
  const ui = interfaceRuntime(engine);
  const index = PAUSE_TABS.indexOf(ui.tab);
  setPauseTab(engine, PAUSE_TABS[(index + dir + PAUSE_TABS.length) % PAUSE_TABS.length]);
  engine.audio?.tone?.(660, 0.05, "triangle", 0, 0.06);
}

function chamberDefault(engine: AnyEngine): MusicTrackId {
  const level = engine.level ?? {};
  return level.bonus ? "bonus" : (level.boss || level.approach) ? "boss" : "stage";
}

/* ---------- pause tabs: input ---------- */

function updateTab(engine: AnyEngine, ui: InterfaceRuntime) {
  const just: Set<string> = engine.just;
  const tab = ui.tab as Exclude<PauseTab, "settings">;
  const extra = EXTRA_TABS.get(tab);
  const size = extra ? extra.size(engine) : tab === "collection" ? ITEM_DEFINITIONS.length : tab === "jukebox" ? JUKEBOX_RECORDS.length : THEMES.length;
  if (just.has("left")) { ui.pick[tab] = (ui.pick[tab] - 1 + size) % size; engine.audio?.tone?.(520, 0.04, "triangle", 0, 0.05); }
  if (just.has("right")) { ui.pick[tab] = (ui.pick[tab] + 1) % size; engine.audio?.tone?.(620, 0.04, "triangle", 0, 0.05); }
  if (extra && just.has("jump")) extra.jump?.(engine, ui);
  if (just.has("bubble")) {
    if (extra) extra.select(engine, ui);
    else if (tab === "jukebox") {
      const record = JUKEBOX_RECORDS[ui.pick.jukebox];
      if (isRecordUnlocked(record.id, vinyls(engine))) { engine.settings.jukeboxTrack = record.id; engine.save?.(); engine.syncMusic?.(); engine.audio?.reward?.(); }
      else engine.audio?.tone?.(140, 0.18, "sawtooth", -40, 0.08);
    } else if (tab === "theme") {
      const id = THEMES[ui.pick.theme].id;
      if (isEditionUnlocked(engine.settings ?? {}, id)) { engine.settings.theme = id; engine.save?.(); engine.audio?.reward?.(); }
      else engine.audio?.tone?.(140, 0.18, "sawtooth", -40, 0.08);
    }
  }
  engine.pauseJumpPending = false;
  engine.pauseSfxDirections?.clear?.();
  if (just.has("start")) engine.restartCurrentStage();
}

/* ---------- drawing helpers ---------- */

function drawMeter(engine: AnyEngine, frame: string, x: number, y: number, w: number, h: number, frac: number, color: string) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const assets = expansionRuntime(engine).assets;
  const ix = x + w * 0.055, iw = w * 0.89, iy = y + h * 0.33, ih = h * 0.34;
  if (!assets.draw(c, frame, x + w / 2, y + h / 2, w, h)) {
    c.fillStyle = "#07040f"; c.fillRect(x, y + h * 0.2, w, h * 0.6);
    c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(x + 1, y + h * 0.2, w - 2, h * 0.6);
  }
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  c.save();
  c.fillStyle = color; c.globalAlpha = 0.92; c.fillRect(ix, iy, iw * f, ih);
  // Tick marks every 10% so the value reads without relying on colour.
  c.globalAlpha = 0.55; c.fillStyle = "#050509";
  for (let i = 1; i < 10; i++) c.fillRect(ix + iw * i / 10 - 1, iy, 2, ih);
  c.restore();
}

function drawThemedPanel(engine: AnyEngine, x: number, y: number, w: number, h: number) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const t = theme(engine);
  c.fillStyle = "rgba(5,5,9,.93)"; c.fillRect(x, y, w, h);
  if (t.panel && expansionRuntime(engine).assets.draw(c, t.panel, x + w / 2, y + h / 2, w, h)) { c.fillStyle = "rgba(5,5,9,.55)"; c.fillRect(x + 24, y + 24, w - 48, h - 48); return; }
  if (t.id === "klein") {
    c.save(); c.strokeStyle = t.accent;
    for (let i = 0; i < 4; i++) { c.globalAlpha = 0.9 - i * 0.2; c.lineWidth = 2; const inset = 6 + i * 9; c.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2); }
    c.restore(); return;
  }
  if (typeof engine.drawGothicBox === "function") engine.drawGothicBox(x, y, w, h, t.accent);
  else { c.strokeStyle = t.accent; c.lineWidth = 3; c.strokeRect(x + 4, y + 4, w - 8, h - 8); }
}

const PANEL = { x: 130, y: 135, w: 700, h: 490 };

function drawCollection(engine: AnyEngine, ui: InterfaceRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const copy = copyFor(ui), t = theme(engine), items = engine.settings?.collection?.items ?? {};
  const reduced = !!engine.settings?.reducedMotion;
  const suffix = COLLECTION_SUFFIXES.map(fn => fn(engine, copy)).filter(Boolean).map(text => ` · ${text}`).join("");
  engine.label(fitText(engine, `${copy.collectionTitle} · ${discoveredCount(items)}/${ITEM_DEFINITIONS.length}${suffix}`, 13, 640, "Georgia"), W / 2, 188, 13, t.accent, "center", "Georgia");
  const size = 64, gap = 14, startX = (W - (8 * size + 7 * gap)) / 2;
  ITEM_DEFINITIONS.forEach((item, i) => {
    const x = startX + (i % 8) * (size + gap), y = 212 + Math.floor(i / 8) * (size + gap);
    const count = items[item.id] ?? 0, selected = i === ui.pick.collection;
    c.save();
    c.fillStyle = count ? "rgba(32,10,40,.9)" : "rgba(12,10,20,.9)"; c.fillRect(x, y, size, size);
    c.strokeStyle = count ? RARITY_COLOR[item.rarity] : "#3a3348"; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, size - 2, size - 2);
    c.globalAlpha = count ? 1 : 0.14;
    drawItemIcon(engine, expansionRuntime(engine), item, x + size / 2, y + size / 2 - 2, 46);
    c.globalAlpha = 1;
    if (!count) engine.label("?", x + size / 2, y + size / 2 + 8, 14, "#8d7fa8", "center");
    else if (count > 1) engine.label(`${Math.min(99, count)}`, x + size - 4, y + size - 4, 8, "#FFD6F1", "right");
    if (selected) {
      c.strokeStyle = t.accent; c.lineWidth = 4;
      const pad = reduced ? 3 : 3 + Math.sin((engine.animTime ?? 0) * 6) * 1.5;
      c.strokeRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
    }
    c.restore();
  });
  const item = ITEM_DEFINITIONS[ui.pick.collection], count = items[item.id] ?? 0;
  const left = 175, maxW = 610;
  engine.label(count ? loreName(ui.lang, item.id, item.name).toUpperCase() : copy.undiscovered, left, 402, 14, count ? "#FFD6F1" : "#8d7fa8", "left", "Georgia");
  engine.label(`${item.rarity.toUpperCase()}${count ? ` · ${copy.owned(count)}` : ""}`, left + maxW, 402, 9, RARITY_COLOR[item.rarity], "right");
  if (count) engine.label(fitText(engine, loreDesc(ui.lang, item.id, item.description), 9, maxW), left, 436, 9, "#c9d6ec");
  engine.label(fitText(engine, `${copy.howToFind}: ${item.discovery}`, 9, maxW), left, 466, 9, "#9fb3d1");
  if (count && item.announce) engine.label(item.announce, left, 498, 10, "#FF2A9D");
}

function drawJukebox(engine: AnyEngine, ui: InterfaceRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const copy = copyFor(ui), t = theme(engine), owned = vinyls(engine);
  const vinylItem = ITEM_DEFINITIONS.find(item => item.id === "cursed_vinyl")!;
  const playing = engine.audio?.playingTrack;
  engine.label(copy.jukeboxTitle, W / 2, 188, 13, t.accent, "center", "Georgia");
  engine.label(copy.vinylsOwned(owned), W / 2, 222, 9, "#FF2A9D", "center");
  JUKEBOX_RECORDS.forEach((record, i) => {
    const y = 246 + i * 54, unlocked = isRecordUnlocked(record.id, owned), selected = i === ui.pick.jukebox;
    const chosen = engine.settings?.jukeboxTrack === record.id;
    c.save();
    c.fillStyle = selected ? "rgba(60,14,60,.9)" : "rgba(14,8,22,.85)"; c.fillRect(170, y, 620, 46);
    c.strokeStyle = selected ? t.accent : "#3a3348"; c.lineWidth = selected ? 3 : 1.5; c.strokeRect(170, y, 620, 46);
    c.globalAlpha = unlocked ? 1 : 0.3;
    drawItemIcon(engine, expansionRuntime(engine), vinylItem, 196, y + 23, 38);
    c.globalAlpha = 1;
    engine.label(fitText(engine, copy.tracks[record.id], 10, 330), 226, y + 30, 10, unlocked ? "#FFD6F1" : "#6d6280");
    const status = !unlocked ? copy.locked(record.vinylsNeeded) : chosen ? (record.id === "auto" || playing === record.id ? `${copy.selected} ✓` : copy.selected) : record.id !== "auto" && playing === record.id ? copy.nowPlaying : "";
    if (status) engine.label(fitText(engine, status, 8, 230), 778, y + 30, 8, unlocked ? t.secondary : "#8d7fa8", "right");
    c.restore();
  });
}

function drawThemes(engine: AnyEngine, ui: InterfaceRuntime) {
  const c = engine.ctx as CanvasRenderingContext2D;
  const copy = copyFor(ui), active = theme(engine);
  const assets = expansionRuntime(engine).assets;
  engine.label(copy.themeTitle, W / 2, 188, 13, active.accent, "center", "Georgia");
  const mc = chamberCopy(ui.lang);
  engine.label(fitText(engine, mc.themeNote, 8, 620), W / 2, 222, 8, "#9fb3d1", "center");
  THEMES.forEach((t, i) => {
    const y = 244 + i * 56, selected = i === ui.pick.theme, open = isEditionUnlocked(engine.settings ?? {}, t.id);
    c.save();
    c.fillStyle = selected ? "rgba(40,12,48,.92)" : "rgba(14,8,22,.85)"; c.fillRect(170, y, 620, 48);
    c.strokeStyle = selected ? t.accent : "#3a3348"; c.lineWidth = selected ? 3 : 1.5; c.strokeRect(170, y, 620, 48);
    if (!(t.panel && assets.draw(c, t.panel, 218, y + 24, 72, 40))) { c.strokeStyle = t.accent; c.lineWidth = 2; c.strokeRect(184, y + 6, 68, 36); c.strokeStyle = t.secondary; c.strokeRect(192, y + 13, 52, 22); }
    if (open) engine.label(copy.themes[t.id], 270, y + 32, 10, t.accent);
    else {
      c.fillStyle = "rgba(4,3,9,.55)"; c.fillRect(176, y + 4, 90, 40);
      engine.label(fitText(engine, `${mc.editionLocked} · ${copy.themes[t.id]}`, 9, 330), 270, y + 24, 9, "#8d7fa8");
      engine.label(fitText(engine, mc.editionHint[t.id] ?? mc.editionLocked, 7, 500), 270, y + 42, 7, "#9fb3d1");
    }
    if (active.id === t.id) engine.label(`${copy.applied} ✓`, 778, y + 32, 8, t.secondary, "right");
    c.restore();
  });
}

function drawTabPanel(engine: AnyEngine, ui: InterfaceRuntime) {
  drawThemedPanel(engine, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  const extra = EXTRA_TABS.get(ui.tab);
  if (extra) extra.draw(engine, ui, copyFor(ui));
  else if (ui.tab === "collection") drawCollection(engine, ui);
  else if (ui.tab === "jukebox") drawJukebox(engine, ui);
  else drawThemes(engine, ui);
  const copy = copyFor(ui);
  engine.label(fitText(engine, `${ui.tab === "familiars" ? copy.familiarNav : copy.navHint} · ${copy.tabHint}`, 9, 640), W / 2, 598, 9, "#9fb3d1", "center");
}

function drawMeters(engine: AnyEngine, ui: InterfaceRuntime) {
  const copy = copyFor(ui), t = theme(engine);
  const comboActive = (engine.comboLife ?? 0) > 0 && ui.lastChain > 0;
  engine.label(comboActive ? `${copy.combo} ×${ui.lastChain}` : `${copy.best} ${engine.bestChain ?? 0}`, 30, 712, 9, comboActive ? t.accent : "#7f8fb0");
  drawMeter(engine, "meter_combo", 168, 684, 220, 33, engine.boardEnergy ?? 0, "#20C98B");
  const widow = engine.widow;
  if (engine.level?.boss && widow && widow.phase !== "entrance") {
    engine.label(copy.boss, 592, 712, 9, "#FF2A9D", "right");
    drawMeter(engine, "meter_boss", 600, 684, 210, 33, widow.maxHp ? widow.hp / widow.maxHp : 0, "#FF2A9D");
  } else {
    const frac = engine.level?.time ? Math.max(0, engine.levelTime) / engine.level.time : 0;
    engine.label(copy.time, 592, 712, 9, frac < 0.2 ? "#FF2A9D" : "#FFD36A", "right");
    drawMeter(engine, "meter_time", 600, 684, 210, 33, frac, frac < 0.2 ? "#FF2A9D" : "#FFD36A");
  }
}

function drawAnnouncement(engine: AnyEngine, ui: InterfaceRuntime) {
  const current = ui.announcer.current;
  if (!current) return;
  const c = engine.ctx as CanvasRenderingContext2D;
  const reduced = !!engine.settings?.reducedMotion, t = theme(engine);
  const fadeIn = Math.min(1, current.age / 0.12), fadeOut = Math.min(1, (1.6 - current.age) / 0.3);
  const scale = reduced ? 1 : current.age < 0.18 ? 1.35 - (current.age / 0.18) * 0.35 : 1;
  c.save();
  c.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
  c.fillStyle = "rgba(5,3,10,.72)"; c.fillRect(W / 2 - 330, 176, 660, 58);
  c.strokeStyle = t.secondary; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 320, 230); c.lineTo(W / 2 + 320, 230); c.stroke();
  c.translate(W / 2, 214); c.scale(scale, scale); if (!reduced) c.rotate(-0.025);
  engine.label(current.text, 0, 0, 24, t.accent, "center", "Georgia");
  c.restore();
}

/* ---------- install ---------- */

export function installExpansionInterface(EngineClass: EngineConstructor) {
  const proto = EngineClass.prototype as AnyEngine;
  if (proto[INSTALL_KEY]) return;
  Object.defineProperty(proto, INSTALL_KEY, { value: true, configurable: false });
  const o = {
    setLang: proto.setLang, update: proto.update, setState: proto.setState, updatePause: proto.updatePause, drawPause: proto.drawPause,
    drawHud: proto.drawHud, drawProgressionHud: proto.drawProgressionHud, popChain: proto.popChain, tryTrap: proto.tryTrap,
    afterDeath: proto.afterDeath, clearStage: proto.clearStage, collectReward: proto.collectReward, syncMusic: proto.syncMusic,
    syncAuditData: proto.syncAuditData, start: proto.start, destroy: proto.destroy,
  };

  proto.setExpansionTab = function (this: AnyEngine, tab: PauseTab) { setPauseTab(this, tab); };

  proto.setLang = function (this: AnyEngine, lang: Lang) { o.setLang.call(this, lang); interfaceRuntime(this).lang = lang; };

  proto.start = function (this: AnyEngine) {
    const ui = interfaceRuntime(this);
    if (typeof window !== "undefined" && !ui.keyHandler) {
      ui.keyHandler = (event: KeyboardEvent) => {
        if (this.state !== "paused" || event.repeat) return;
        if ((event.target as HTMLElement | null)?.closest?.(".lang-menu")) return;
        if (event.code === "KeyQ") { cycleTab(this, -1); event.preventDefault(); }
        else if (event.code === "KeyE") { cycleTab(this, 1); event.preventDefault(); }
      };
      window.addEventListener("keydown", ui.keyHandler);
    }
    if (this.devTools && typeof window !== "undefined") {
      // Development-only QA hook (screenshots, manual testing). Not shipped behaviour.
      (window as any).__bubbleHexInterface = {
        announce: (event: AnnouncementEvent) => announce(this, event),
        grant: (id: string, count = 1) => { this.settings.collection.items[id] = count; this.save?.(); },
      };
    }
    return o.start.call(this);
  };

  proto.destroy = function (this: AnyEngine) {
    const ui = runtimes.get(this);
    if (ui?.keyHandler && typeof window !== "undefined") { window.removeEventListener("keydown", ui.keyHandler); ui.keyHandler = null; }
    return o.destroy.call(this);
  };

  proto.update = function (this: AnyEngine, dt: number) {
    const ui = interfaceRuntime(this);
    if (this.state !== "paused") { ui.announcer.tick(dt); ui.shownScore = stepShownScore(ui.shownScore, this.score ?? 0, dt, !!this.settings?.reducedMotion); }
    return o.update.call(this, dt);
  };

  proto.setState = function (this: AnyEngine, s: string) {
    const previous = this.state;
    const ui = interfaceRuntime(this);
    if (s === "paused" && previous !== "paused") ui.tab = "settings";
    if (s === "title" || s === "gameOver" || s === "victory" || s === "attract") ui.announcer.hide();
    return o.setState.call(this, s);
  };

  proto.updatePause = function (this: AnyEngine) {
    const ui = interfaceRuntime(this);
    if (ui.tab === "settings") return o.updatePause.call(this);
    updateTab(this, ui);
  };

  proto.drawPause = function (this: AnyEngine) {
    const ui = interfaceRuntime(this);
    if (ui.tab === "settings") {
      o.drawPause.call(this);
      this.label(copyFor(ui).tabHint, W / 2, 604, 9, "#9fb3d1", "center");
      return;
    }
    drawTabPanel(this, ui);
  };

  proto.drawHud = function (this: AnyEngine) {
    const ui = interfaceRuntime(this);
    const actual = this.score;
    this.score = Math.min(actual, ui.shownScore);
    try { o.drawHud.call(this); } finally { this.score = actual; }
  };

  proto.drawProgressionHud = function (this: AnyEngine) {
    o.drawProgressionHud.call(this);
    const ui = interfaceRuntime(this);
    drawMeters(this, ui);
    drawAnnouncement(this, ui);
  };

  proto.popChain = function (this: AnyEngine, root: AnyEngine) {
    const warning = new Set((this.bubbles as any[]).filter(b => b.phase === "warning" && b.enemyId !== -1).map(b => b.id));
    const pendingBefore = (this.pendingPops as any[]).length;
    o.popChain.call(this, root);
    const popped = (this.pendingPops as any[]).slice(pendingBefore).map(p => p.bubble);
    const ui = interfaceRuntime(this);
    ui.lastChain = popped.length;
    if (popped.length >= 5) announce(this, "megaChain");
    else if (popped.some(b => warning.has(b.id))) announce(this, "lastSecondPop");
  };

  proto.tryTrap = function (this: AnyEngine, b: AnyEngine) {
    const furious = new Set((this.enemies as any[]).filter(e => e.state === "furious").map(e => e.id));
    const before = b.enemyId;
    o.tryTrap.call(this, b);
    if (b.enemyId === undefined || b.enemyId === before) return;
    if (furious.has(b.enemyId)) announce(this, "recaptureFurious");
    else if (!this.firstPop && (this.trappedBeforeFirstPop ?? 0) >= 3) announce(this, "hoarder");
  };

  proto.afterDeath = function (this: AnyEngine) {
    const continuing = (this.lives ?? 0) > 0;
    o.afterDeath.call(this);
    if (continuing && this.state === "playing") announce(this, "survivedHit");
  };

  proto.clearStage = function (this: AnyEngine, demo: boolean) {
    o.clearStage.call(this, demo);
    if (demo || this.state !== "stageClear") return;
    if (this.secretFound) announce(this, "venomAscension");
    else if (!this.stageDamaged) announce(this, "flawlessClear");
  };

  proto.collectReward = function (this: AnyEngine, r: AnyEngine) {
    const before = this.venom?.size ?? 0;
    o.collectReward.call(this, r);
    if (r.letter && before === 4 && (this.venom?.size ?? 0) === 0) announce(this, "venomAscension");
  };

  proto.syncMusic = function (this: AnyEngine) {
    if (!this.audioReady || this.state === "boot" || !PLAY_MUSIC_STATES.has(this.state)) return o.syncMusic.call(this);
    const fallback = chamberDefault(this);
    const track = chamberTrack(this.settings?.jukeboxTrack ?? "auto", vinyls(this), fallback);
    if (track === fallback) return o.syncMusic.call(this);
    this.audio.playMusic(track);
  };

  proto.syncAuditData = function (this: AnyEngine) {
    o.syncAuditData.call(this);
    if (!this.canvas?.dataset) return;
    const ui = interfaceRuntime(this);
    Object.assign(this.canvas.dataset, {
      expansionPauseTab: ui.tab,
      expansionAnnouncement: ui.announcer.current?.text ?? "",
      expansionShownScore: String(Math.floor(ui.shownScore)),
      expansionTheme: this.settings?.theme ?? "default",
      expansionJukebox: this.settings?.jukeboxTrack ?? "auto",
    });
  };
}
