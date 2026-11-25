import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const directory = mkdtempSync(join(tmpdir(), 'bubblehex-cabinet-'));
for (const file of readdirSync(new URL('../app/game/', import.meta.url)).filter(f => f.endsWith('.ts'))) {
  let code = ts.transpileModule(readFileSync(new URL(`../app/game/${file}`, import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code = code.replace(/from "(\.\/[^".]+)(?:\.ts)?"/g, 'from "$1.mjs"');
  writeFileSync(join(directory,file.replace('.ts','.mjs')),code);
}
const storage = new Map();
const motion = Object.assign(new EventTarget(), {matches:false});
let pad = null;
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(),{hidden:false});
globalThis.matchMedia = () => motion;
globalThis.localStorage = {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[pad]}});
globalThis.Image = class {set src(value){queueMicrotask(()=>this.onerror?.(value));}};
globalThis.cancelAnimationFrame = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.HTMLButtonElement = class {};
const { BubbleHexEngine } = await import(join(directory,'engine.mjs'));
const { installBubbleHexRuntimeUpgrades } = await import(join(directory,'runtime-upgrades.mjs'));
const { installForbiddenExpansion, expansionRuntime } = await import(join(directory,'forbidden-expansion.mjs'));
const { installExpansionInterface } = await import(join(directory,'expansion-ui.mjs'));
const { installLivingBubbles, livingRuntime, grantAmmo } = await import(join(directory,'living-expansion.mjs'));
const { installFamiliars, familiarRuntime, checkUnlocks } = await import(join(directory,'familiar-expansion.mjs'));
installBubbleHexRuntimeUpgrades(BubbleHexEngine); installForbiddenExpansion(BubbleHexEngine); installExpansionInterface(BubbleHexEngine);
installLivingBubbles(BubbleHexEngine); installFamiliars(BubbleHexEngine);
const { installLivingCabinet, cabinetRuntime, cabinetSave, cabinetStats, livingTier, checkAchievements } = await import(join(directory,'cabinet-expansion.mjs'));
const { CABINET_LIMITS } = await import(join(directory,'cabinet.mjs'));
installLivingCabinet(BubbleHexEngine); installLivingCabinet(BubbleHexEngine);
const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):/Gradient|Pattern/.test(String(key))?()=>({addColorStop(){}}):()=>{}});
const make = (unlocked = []) => {
  storage.clear();
  const e = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{});
  e.settings.familiars = {unlocked:[...unlocked],selected:null,assists:true,bestChain:0};
  e.beginRun(); e.state='playing';
  expansionRuntime(e).rng = () => 0.99; livingRuntime(e).rng = () => 0.99; cabinetRuntime(e).rng = () => 0;
  return e;
};
const tick = (e, n=1) => { for (let i=0;i<n;i++) e.update(1/60); };
const tap = (e, action) => { e.press(action, 'test'); e.release(action, 'test'); };
let nextEnemyId = 7000;
function trapped(e, x, y) {
  const enemy = {id:nextEnemyId++,x:x-16,y:y-16,prevX:x-16,prevY:y-16,vx:0,vy:0,w:32,h:32,kind:'love',state:'trapped',timer:0,cooldown:9,homeY:y,weakened:false,rank:1,elite:false};
  e.enemies.push(enemy);
  const b = {id:e.nextId++,x,y,prevX:x,prevY:y,vx:0,vy:0,r:25,age:0,phase:'occupied',enemyId:enemy.id,life:5};
  e.bubbles.push(b); return b;
}
const saved = () => JSON.parse(storage.get('bubble-hex-settings'));
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('cabinet opens from the title, owns input, blocks attract and closes on pause/start', () => {
  const e = make(); e.toTitle(); tick(e, 2);
  assert.equal(e.openCabinet(), true); e.syncAuditData();
  assert.equal(e.canvas.dataset.expansionCabinet, '1');
  tap(e, 'jump'); tick(e); assert.equal(cabinetRuntime(e).section, 1, 'jump = next section');
  tap(e, 'consciousness'); tick(e); assert.equal(cabinetRuntime(e).section, 0, 'up = previous section');
  tap(e, 'right'); tick(e); assert.equal(cabinetRuntime(e).pick[0], 1);
  const consciousness = e.settings.enemyConsciousness;
  tick(e, 60 * 20);
  assert.equal(e.state, 'title', 'no attract mode while the cabinet is open');
  assert.equal(e.settings.enemyConsciousness, consciousness, 'title controls are not triggered underneath');
  tap(e, 'pause'); tick(e);
  assert.equal(cabinetRuntime(e).open, false); assert.equal(e.state, 'title', 'pause closes the cabinet, not the title');
  e.destroy();
});

test('cabinet opens from the pause collection tab and Escape returns to the paused game', () => {
  const e = make(); tick(e, 2);
  tap(e, 'pause'); tick(e); assert.equal(e.state, 'paused');
  e.setExpansionTab('collection'); tap(e, 'jump'); tick(e);
  assert.equal(cabinetRuntime(e).open, true);
  tap(e, 'pause'); tick(e);
  assert.equal(cabinetRuntime(e).open, false); assert.equal(e.state, 'paused', 'still paused underneath');
  assert.equal(e.openCabinet(), true);
  e.closeCabinet(); assert.equal(e.openCabinet.call(Object.assign(Object.create(e), {state:'playing'})), false, 'never opens mid-play');
  e.destroy();
});

test('real play earns achievements: pops, chains, clears, perfect clears, familiar unlocks', () => {
  const e = make(); tick(e, 2);
  const root = trapped(e, 300, 300); trapped(e, 360, 300); trapped(e, 420, 300);
  e.popChain(root); tick(e, 40);
  const cab = cabinetSave(e);
  assert.ok(cab.counters.pops >= 3);
  assert.ok(cab.achievements.includes('first_pop') && cab.achievements.includes('chain_reaction'));
  assert.ok(cabinetRuntime(e).toasts.length > 0, 'achievement toast queued');
  e.stageDamaged = false; e.clearStage(false);
  assert.equal(e.state, 'stageClear');
  assert.deepEqual(cab.chambers, [e.level.loreFragmentId]);
  assert.equal(cab.counters.perfects, 1);
  assert.ok(e.settings.familiars.unlocked.includes('hex_cat'), 'familiar unlock reads the cabinet counters');
  for (const id of ['opening_night', 'untouchable', 'familiar_face']) assert.ok(cab.achievements.includes(id), id);
  assert.deepEqual(saved().cabinet.achievements, cab.achievements, 'persisted');
  e.destroy();
});

test('attract mode never earns anything', () => {
  const e = make(); e.toTitle(); e.beginAttract(); assert.equal(e.state, 'attract');
  const root = trapped(e, 300, 300); trapped(e, 360, 300); trapped(e, 420, 300);
  e.popChain(root); tick(e, 60);
  assert.equal(cabinetSave(e).counters.pops ?? 0, 0); assert.deepEqual(cabinetSave(e).achievements, []);
  e.destroy();
});

test('wardrobe: equip earned accessory from the cabinet; never changes the hitbox; locked items refuse', () => {
  const e = make(); e.toTitle(); tick(e, 2);
  cabinetSave(e).achievements.push('untouchable');
  e.openCabinet('wardrobe');
  const rt = cabinetRuntime(e);
  rt.pick[rt.section] = 4; tap(e, 'bubble'); tick(e); // crown: locked
  assert.equal(cabinetSave(e).wardrobeEquipped, null);
  rt.pick[rt.section] = 2; tap(e, 'bubble'); tick(e); // veil
  assert.equal(cabinetSave(e).wardrobeEquipped, 'veil');
  assert.ok(cabinetSave(e).achievements.includes('dressed_to_hex'));
  e.closeCabinet(); e.beginRun(); e.state = 'playing';
  const box = [e.player.w, e.player.h];
  e.render(); e.syncAuditData();
  assert.deepEqual([e.player.w, e.player.h], box);
  assert.equal(e.canvas.dataset.expansionWardrobe, 'veil');
  e.destroy();
});

test("the Widow's remark interrupts a stage transition, holds it briefly and is skippable", () => {
  const e = make(); tick(e, 2);
  for (let n = 0; n < 2; n++) { e.clearStage(false); e.nextStage(); if (n === 0) { assert.equal(cabinetRuntime(e).remark, null); tick(e, 120); e.state = 'playing'; } }
  assert.equal(e.state, 'stageIntro');
  assert.ok(cabinetRuntime(e).remark, 'second transition: the Widow speaks');
  assert.equal(cabinetSave(e).counters.widowRemarks, 1);
  tick(e, 120); assert.equal(e.state, 'stageIntro', 'held past the normal 1.65s intro');
  tick(e, 120); assert.equal(e.state, 'playing', 'never held longer than the cap');
  // Skippable: next remark dismissed by a press.
  cabinetRuntime(e).remarkClock.lastAt = -1e9; cabinetRuntime(e).remarkClock.stagesSince = 5;
  e.clearStage(false); e.nextStage(); assert.ok(cabinetRuntime(e).remark);
  tick(e, 30); tap(e, 'jump'); assert.equal(cabinetRuntime(e).remark, null);
  e.destroy();
});

test('living title: web grows, characters dance when idle, more walkers at tier 2, secret reveals once', () => {
  const e = make(['hex_cat','boo','vamp','velvet','nevermore','blue_snake']); e.toTitle();
  tick(e, 60 * 4);
  assert.ok(cabinetSave(e).web > 0.02);
  assert.equal(familiarRuntime(e).walkers.length, 3);
  cabinetSave(e).achievements.push('first_pop','chain_reaction','opening_night','untouchable','familiar_face','night_owl');
  assert.equal(livingTier(e), 2); tick(e, 2);
  assert.equal(familiarRuntime(e).walkers.length, 6);
  e.titleIdle = 6; e.render();
  assert.equal(e.revealTitleSecret(), true);
  assert.ok(cabinetSave(e).achievements.includes('curiosity'));
  assert.equal(cabinetStats(e).titleSecret, 1);
  tap(e, 'start'); assert.equal(e.state, 'title', 'first press only dismisses the secret card');
  assert.equal(e.revealTitleSecret(), false, 'only rewards once');
  e.destroy();
});

test('special ammo and personalities are recorded as discoveries', () => {
  const e = make(); tick(e, 2);
  grantAmmo(e, 'venom', 1); e.fireBubble();
  const cab = cabinetSave(e);
  assert.deepEqual(cab.ammoSeen, ['venom']); assert.equal(cab.counters.ammoFired, 1);
  assert.equal(cab.personalitiesSeen.length, 1);
  checkAchievements(e); assert.ok(cab.achievements.includes('living_ammo'));
  e.destroy();
});

test('collection reset needs two confirmations and does not instantly re-unlock from campaign records', () => {
  const e = make(['hex_cat']); tick(e, 2);
  e.stageDamaged = false; e.clearStage(false); e.toTitle(); tick(e, 2);
  assert.ok(cabinetSave(e).achievements.length > 0);
  const best = {...e.settings.bestStageTimes};
  e.openCabinet('reset');
  tap(e, 'bubble'); tick(e); assert.equal(cabinetRuntime(e).armed, true);
  tap(e, 'jump'); tick(e); assert.equal(cabinetRuntime(e).armed, false, 'jump cancels');
  tap(e, 'bubble'); tick(e); tap(e, 'bubble'); tick(e);
  assert.deepEqual(cabinetSave(e).achievements, []); assert.deepEqual(e.settings.familiars.unlocked, []);
  assert.deepEqual(e.settings.bestStageTimes, best, 'campaign records kept');
  e.closeCabinet(); tick(e, 60); checkUnlocks(e);
  assert.deepEqual(cabinetSave(e).achievements, []); assert.deepEqual(e.settings.familiars.unlocked, []);
  assert.deepEqual(saved().cabinet.achievements, []);
  e.destroy();
});

test('reduced motion: no dance, cabinet and overlays still render', () => {
  const e = make(['hex_cat']); e.settings.reducedMotion = true; e.toTitle();
  e.titleIdle = 9; e.render();
  assert.equal(CABINET_LIMITS.danceAfter < 9, true);
  e.openCabinet('achievements'); e.render(); e.openCabinet('wardrobe'); e.render(); e.closeCabinet();
  cabinetRuntime(e).remark = {text:'x', time:0}; e.state = 'stageIntro'; e.render();
  e.destroy();
});
