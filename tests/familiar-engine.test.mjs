import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const directory = mkdtempSync(join(tmpdir(), 'bubblehex-familiar-'));
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
const { installExpansionInterface, interfaceRuntime } = await import(join(directory,'expansion-ui.mjs'));
const { installLivingBubbles, livingRuntime, grantAmmo } = await import(join(directory,'living-expansion.mjs'));
const { installFamiliars, familiarRuntime, activeFamiliar, checkUnlocks } = await import(join(directory,'familiar-expansion.mjs'));
installBubbleHexRuntimeUpgrades(BubbleHexEngine); installForbiddenExpansion(BubbleHexEngine); installExpansionInterface(BubbleHexEngine);
installLivingBubbles(BubbleHexEngine); installFamiliars(BubbleHexEngine); installFamiliars(BubbleHexEngine);
const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):/Gradient|Pattern/.test(String(key))?()=>({addColorStop(){}}):()=>{}});
const make = (unlocked = []) => {
  storage.clear();
  const e = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{});
  e.settings.familiars = {unlocked:[...unlocked],selected:null,assists:true,bestChain:0};
  e.beginRun(); e.state='playing';
  expansionRuntime(e).rng = () => 0.99; livingRuntime(e).rng = () => 0.99;
  return e;
};
const tick = (e, n=1) => { for (let i=0;i<n;i++) e.update(1/60); };
let nextEnemyId = 5000;
function trapped(e, x, y) {
  const enemy = {id:nextEnemyId++,x:x-16,y:y-16,prevX:x-16,prevY:y-16,vx:0,vy:0,w:32,h:32,kind:'love',state:'trapped',timer:0,cooldown:9,homeY:y,weakened:false,rank:1,elite:false};
  e.enemies.push(enemy);
  const b = {id:e.nextId++,x,y,prevX:x,prevY:y,vx:0,vy:0,r:25,age:0,phase:'occupied',enemyId:enemy.id,life:5};
  e.bubbles.push(b); return b;
}
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('no familiar until one is earned; clearing a chamber unlocks and auto-equips Hex Cat', () => {
  const e = make();
  tick(e, 5); e.syncAuditData();
  assert.equal(activeFamiliar(e), undefined); assert.equal(familiarRuntime(e).body, null); assert.equal(e.canvas.dataset.familiar, 'none');
  e.settings.cabinet.chambers = ['blueprint'];
  assert.deepEqual(checkUnlocks(e), ['hex_cat']);
  assert.equal(activeFamiliar(e).id, 'hex_cat'); assert.match(e.message, /HEX CAT/);
  const saved = JSON.parse(storage.get('bubble-hex-settings'));
  assert.equal(saved.version, 9); assert.deepEqual(saved.familiars.unlocked, ['hex_cat']);
  tick(e, 30); assert.ok(familiarRuntime(e).body);
  e.destroy();
});

test('a 5-chain records bestChain, unlocks Boo and triggers a big-chain celebration', () => {
  const e = make(['hex_cat']); tick(e, 2);
  const root = trapped(e, 300, 300); for (let i = 1; i < 5; i++) trapped(e, 300 + i * 60, 300);
  e.popChain(root);
  assert.equal(e.settings.familiars.bestChain, 5);
  assert.ok(e.settings.familiars.unlocked.includes('boo'));
  assert.equal(familiarRuntime(e).body.expression, 'love');
  e.destroy();
});

test('hurt and death reactions; Hex Cat Nine Lives adds post-hit safety once per chamber', () => {
  const e = make(['hex_cat']); tick(e, 2);
  e.player.invuln = 0; e.damagePlayer();
  assert.equal(familiarRuntime(e).body.expression, 'sweat');
  e.afterDeath(); assert.equal(e.state, 'playing');
  assert.ok(e.player.invuln >= 2.2 + 1.5 - 1e-9, `invuln ${e.player.invuln}`);
  e.player.invuln = 0; e.damagePlayer(); e.afterDeath();
  assert.ok(e.player.invuln < 3, 'second hit in the same chamber: no extra safety');
  e.lives = 1; e.player.invuln = 0; e.damagePlayer();
  assert.equal(familiarRuntime(e).body.expression, 'sad');
  e.destroy();
});

test('Velvet reels in an expiring pickup; cooldown and cosmetic mode respected; never in attract', () => {
  const e = make(['velvet']); tick(e, 2);
  const px = e.player.x + e.player.w / 2;
  e.rewards.push({x:px+200,y:e.player.y,vy:0,kind:'HEX_AMMO',value:0,life:2,ammoType:'frost'});
  tick(e, 2);
  assert.equal(livingRuntime(e).inv.charges.frost, 2, 'pulled in and collected');
  assert.ok(familiarRuntime(e).clock.cooldown > 0);
  e.rewards.push({x:px+200,y:e.player.y,vy:0,kind:'HEX_AMMO',value:0,life:2.5,ammoType:'venom'});
  tick(e, 1); assert.equal(livingRuntime(e).inv.charges.venom, undefined, 'on cooldown');
  familiarRuntime(e).clock.cooldown = 0; e.settings.familiars.assists = false; tick(e, 1);
  assert.equal(livingRuntime(e).inv.charges.venom, undefined, 'cosmetic mode: no assist');
  e.settings.familiars.assists = true; e.state = 'attract'; e.rewards = [{x:px+200,y:e.player.y,vy:0,kind:'HEX_AMMO',value:0,life:2.5,ammoType:'venom'}];
  familiarRuntime(e).runPassive = true; e.update(1/60);
  assert.equal(livingRuntime(e).inv.charges.venom, undefined, 'attract: no assist');
  e.destroy();
});

test('Blue $nake coils a bursting bubble; Vamp drains time on a 3-chain (capped by the chamber clock)', () => {
  const s = make(['blue_snake']); tick(s, 2);
  const b = trapped(s, 600, 300); b.life = 1; b.phase = 'warning'; s.player.x = 100;
  tick(s, 1); assert.equal(b.phase, 'occupied'); assert.ok(b.life > 1.5);
  s.destroy();
  const v = make(['vamp']); tick(v, 2);
  v.levelTime = 10; const root = trapped(v, 300, 300); trapped(v, 360, 300); trapped(v, 420, 300);
  v.popChain(root); assert.equal(v.levelTime, 13);
  v.levelTime = v.level.time; familiarRuntime(v).clock.cooldown = 0;
  const r2 = trapped(v, 300, 400); trapped(v, 360, 400); trapped(v, 420, 400); v.popChain(r2);
  assert.equal(v.levelTime, v.level.time, 'never above the chamber time');
  v.destroy();
});

test('Boo spooks a close enemy (freeze via the M3 status system); Nevermore croaks the secret clue after 20s', () => {
  const e = make(['boo']); tick(e, 2);
  const enemy = e.enemies.find(x => x.state === 'normal'); enemy.x = e.player.x + 10; enemy.y = e.player.y; e.player.invuln = 99;
  tick(e, 1); assert.ok(livingRuntime(e).status.get(enemy.id)?.freeze > 0);
  e.destroy();
  const n = make(['nevermore']); tick(n, 2); n.message = '';
  n.levelTime = n.level.time - 21; tick(n, 1);
  assert.ok(n.message.length > 0, 'clue shown'); const used = familiarRuntime(n).clock.usedThisStage;
  n.message = ''; familiarRuntime(n).clock.cooldown = 0; tick(n, 1); assert.equal(n.message, '', 'once per chamber');
  assert.equal(used, 1);
  n.destroy();
});

test('sleep cycle in engine when the hero stands still', () => {
  const e = make(['hex_cat']); e.player.invuln = 999; for (const en of e.enemies) en.state = 'trapped'; e.projectiles = []; // parked: no stage clear
  tick(e, 60 * 7); const fb = familiarRuntime(e).body; assert.equal(fb.state, 'sleep', JSON.stringify({st:e.state,vx:e.player.vx,g:e.player.grounded,idle:fb.playerIdle,ev:fb.event}));
  e.press('right'); tick(e, 10); assert.notEqual(familiarRuntime(e).body.state, 'sleep');
  e.destroy();
});

test('FAMILIARS pause tab: choose / remove familiar, toggle cosmetic mode; persisted', () => {
  const e = make(['hex_cat', 'boo']); e.start();
  e.press('pause'); e.release('pause'); e.setExpansionTab('familiars');
  assert.equal(interfaceRuntime(e).tab, 'familiars');
  for (let i = 0; i < 3; i++) { e.press('right'); e.release('right'); e.update(1/60); }
  e.press('bubble'); e.release('bubble'); e.update(1/60);
  assert.equal(e.settings.familiars.selected, 'boo');
  e.press('bubble'); e.release('bubble'); e.update(1/60);
  assert.equal(e.settings.familiars.selected, 'none'); assert.equal(activeFamiliar(e), undefined);
  e.press('jump'); e.release('jump'); e.update(1/60);
  assert.equal(e.settings.familiars.assists, false);
  assert.equal(e.settings.reducedMotion, false, 'jump on this tab does not toggle reduced motion');
  const saved = JSON.parse(storage.get('bubble-hex-settings')); assert.equal(saved.familiars.selected, 'none'); assert.equal(saved.familiars.assists, false);
  e.render?.(0);
  e.destroy();
});

test('title: unlocked familiars wander (max 3); rendering with familiars does not throw', () => {
  const e = make(['hex_cat','boo','vamp','velvet']); e.toTitle(); tick(e, 30);
  assert.equal(familiarRuntime(e).walkers.length, 3);
  e.render?.(0); e.destroy();
  const f = make(['vamp']); tick(f, 30); f.render?.(0); f.destroy();
});

test('gamepad Y cycles ammo on the press edge', () => {
  const e = make(); grantAmmo(e, 'frost', 1); grantAmmo(e, 'thunder', 1);
  pad = {axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
  pad.buttons[3].pressed = true; e.pollGamepad(); e.pollGamepad();
  assert.equal(livingRuntime(e).inv.selected, null, 'one cycle per press (frost → NORMAL)');
  pad.buttons[3].pressed = false; e.pollGamepad(); pad.buttons[3].pressed = true; e.pollGamepad();
  assert.equal(livingRuntime(e).inv.selected, 'thunder');
  pad = null; e.destroy();
});
