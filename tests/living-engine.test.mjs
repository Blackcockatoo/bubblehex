import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const directory = mkdtempSync(join(tmpdir(), 'bubblehex-living-'));
for (const file of readdirSync(new URL('../app/game/', import.meta.url)).filter(f => f.endsWith('.ts'))) {
  let code = ts.transpileModule(readFileSync(new URL(`../app/game/${file}`, import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code = code.replace(/from "(\.\/[^".]+)(?:\.ts)?"/g, 'from "$1.mjs"');
  writeFileSync(join(directory,file.replace('.ts','.mjs')),code);
}
const storage = new Map();
const motion = Object.assign(new EventTarget(), {matches:false});
globalThis.window = new EventTarget();
globalThis.document = Object.assign(new EventTarget(),{hidden:false});
globalThis.matchMedia = () => motion;
globalThis.localStorage = {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[]}});
globalThis.Image = class {set src(value){queueMicrotask(()=>this.onerror?.(value));}};
globalThis.cancelAnimationFrame = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.HTMLButtonElement = class {};
const { BubbleHexEngine } = await import(join(directory,'engine.mjs'));
const { installBubbleHexRuntimeUpgrades } = await import(join(directory,'runtime-upgrades.mjs'));
const { installForbiddenExpansion, expansionRuntime } = await import(join(directory,'forbidden-expansion.mjs'));
const { installExpansionInterface } = await import(join(directory,'expansion-ui.mjs'));
const { installLivingBubbles, livingRuntime, grantAmmo, AMMO_REWARD_KIND } = await import(join(directory,'living-expansion.mjs'));
const { LIVING_LIMITS, newMeta, AMMO_ORDER } = await import(join(directory,'living-bubbles.mjs'));
installBubbleHexRuntimeUpgrades(BubbleHexEngine); installForbiddenExpansion(BubbleHexEngine); installExpansionInterface(BubbleHexEngine);
installLivingBubbles(BubbleHexEngine); installLivingBubbles(BubbleHexEngine);
const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):/Gradient|Pattern/.test(String(key))?()=>({addColorStop(){}}):()=>{}});
const make = () => {
  const e = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{}); e.beginRun(); e.state='playing';
  expansionRuntime(e).rng = () => 0.99; // no M1 item drops: keep these tests about M3
  livingRuntime(e).rng = () => 0.99;    // no ammo orb drops unless a test asks
  return e;
};
const key = code => window.dispatchEvent(Object.assign(new Event('keydown'),{code,repeat:false,preventDefault(){}}));
const tick = (e, n=1) => { for (let i=0;i<n;i++) e.update(1/60); };
let nextEnemyId = 9000;
function trapped(e, x, y, meta) {
  const enemy = {id:nextEnemyId++,x:x-16,y:y-16,prevX:x-16,prevY:y-16,vx:0,vy:0,w:32,h:32,kind:'love',state:'trapped',timer:0,cooldown:9,homeY:y,weakened:false,rank:1,elite:false};
  e.enemies.push(enemy);
  const b = {id:e.nextId++,x,y,prevX:x,prevY:y,vx:0,vy:0,r:25,age:0,phase:'occupied',enemyId:enemy.id,life:5};
  e.bubbles.push(b); if (meta) livingRuntime(e).meta.set(b, meta);
  return b;
}
const flush = e => { for (let i=0;i<40&&e.pendingPops.length;i++) e.updatePendingPops(1/30); };
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('no special ammo: the original shot is unchanged and nothing living appears', () => {
  const a = make(), b = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{});
  a.fireBubble();
  const shot = a.bubbles.at(-1);
  assert.equal(a.bubbles.length, 1); assert.equal(shot.r, 18); assert.equal(Math.abs(shot.vx), 390); assert.equal(shot.life, 5.2);
  assert.equal(livingRuntime(a).meta.has(shot), false);
  a.held.bubble = true; a.held.right = true; tick(a, 600);
  assert.equal(a.bubbles.filter(x => livingRuntime(a).meta.has(x)).length, 0);
  assert.equal(livingRuntime(a).fx.length, 0);
  assert.equal(a.canvas.dataset.expansionAmmo, 'normal'); assert.equal(a.canvas.dataset.expansionAmmoOwned, '0');
  a.destroy(); b.destroy();
});

test('special ammo fires as a variant, consumes charges and never touches VENOM letters/upgrade', () => {
  const e = make();
  grantAmmo(e, 'venom', 2);
  const letters = [...e.venom], up = e.upgrades.venom;
  e.fireBubble();
  const shot = e.bubbles.at(-1), meta = livingRuntime(e).meta.get(shot);
  assert.equal(meta.type, 'venom'); assert.ok(meta.personality);
  assert.equal(livingRuntime(e).inv.charges.venom, 1);
  e.fireCooldown = 0; e.fireBubble(); assert.equal(livingRuntime(e).inv.selected, null, 'falls back to normal');
  e.fireCooldown = 0; e.fireBubble(); assert.equal(livingRuntime(e).meta.has(e.bubbles.at(-1)), false);
  assert.deepEqual([...e.venom], letters); assert.equal(e.upgrades.venom, up);
  e.destroy();
});

test('V cycles ammo through NORMAL; dataset reflects the selection', () => {
  const e = make(); e.start();
  grantAmmo(e, 'frost', 1); grantAmmo(e, 'thunder', 1);
  assert.equal(livingRuntime(e).inv.selected, 'frost');
  key('KeyV'); assert.equal(livingRuntime(e).inv.selected, null, 'registry order: thunder, frost, then NORMAL');
  key('KeyV'); assert.equal(livingRuntime(e).inv.selected, 'thunder');
  key('KeyV'); key('KeyV'); assert.equal(livingRuntime(e).inv.selected, null);
  e.syncAuditData(); assert.equal(e.canvas.dataset.expansionAmmoOwned, '1'); assert.equal(e.canvas.dataset.expansionAmmo, 'normal');
  e.destroy(); key('KeyV');
});

test('mirror fires a reflected twin; ammo orbs drop and are collected', () => {
  const e = make(); grantAmmo(e, 'mirror', 1); e.fireBubble();
  assert.equal(e.bubbles.length, 2); assert.equal(Math.sign(e.bubbles[0].vx), -Math.sign(e.bubbles[1].vx));
  const rt = livingRuntime(e); rt.rng = () => 0;
  e.spawnReward(400, 300, 1);
  const orb = e.rewards.find(r => r.kind === AMMO_REWARD_KIND); assert.ok(orb && orb.ammoType);
  e.collectReward(orb); assert.equal(rt.inv.charges[orb.ammoType], 2);
  e.destroy();
});

test('recursive pops stay within children-per-parent and recursion depth', () => {
  const e = make(), rt = livingRuntime(e);
  const root = trapped(e, 300, 300, newMeta('recursive', null, 0, 300, 300));
  e.popChain(root); flush(e);
  let gen = e.bubbles.filter(b => rt.meta.get(b)?.depth === 1);
  assert.equal(gen.length, 2);
  for (const child of gen) assert.equal(rt.meta.get(child).type, 'recursive');
  // Pop every child (as if each trapped prey) and then every grandchild.
  for (let depth = 1; depth <= 3; depth++) {
    for (const child of e.bubbles.filter(b => rt.meta.get(b)?.depth === depth)) {
      const t = trapped(e, child.x, child.y, rt.meta.get(child)); child.phase = 'burst'; e.popChain(t); flush(e);
    }
  }
  const depths = e.bubbles.map(b => rt.meta.get(b)?.depth ?? 0);
  assert.ok(Math.max(...depths) <= LIVING_LIMITS.maxRecursionDepth);
  assert.ok(rt.stats.childrenSpawned <= 2 + 4, `spawned ${rt.stats.childrenSpawned}`);
  e.destroy();
});

test('global bubble cap refuses expansion spawns', () => {
  const e = make(), rt = livingRuntime(e);
  const root = trapped(e, 300, 300, newMeta('recursive', null, 0, 300, 300));
  while (e.bubbles.length < LIVING_LIMITS.maxActiveBubbles) e.bubbles.push({id:e.nextId++,x:500,y:200,prevX:500,prevY:200,vx:0,vy:-20,r:18,age:0,phase:'floating',life:9});
  e.popChain(root); e.bubbles.push({id:e.nextId++,x:500,y:200,prevX:500,prevY:200,vx:0,vy:-20,r:18,age:0,phase:'floating',life:9});
  flush(e);
  assert.equal(rt.stats.childrenSpawned, 0);
  grantAmmo(e, 'mirror', 1); const n = e.bubbles.length; e.fireBubble();
  assert.equal(e.bubbles.length, n + 1, 'over the cap a special shot falls back to one normal bubble');
  assert.equal(rt.inv.charges.mirror, 1, 'and keeps its charge');
  e.destroy();
});

test('thunder arcs to at most maxThunderJumps extra trapped bubbles', () => {
  const e = make(), rt = livingRuntime(e);
  const root = trapped(e, 120, 300, newMeta('thunder', null, 0, 120, 300));
  for (const [x, y] of [[220,300],[120,400],[220,400],[320,300],[700,300],[800,500]]) trapped(e, x, y);
  e.popChain(root);
  assert.equal(e.bubbles.filter(b => b.phase === 'popping').length, 1 + LIVING_LIMITS.maxThunderJumps);
  flush(e);
  assert.equal(rt.stats.thunderJumps, LIVING_LIMITS.maxThunderJumps);
  e.destroy();
});

test('frost pop freezes nearby free enemies; time pop is capped per stage', () => {
  const e = make(), rt = livingRuntime(e);
  e.enemies = []; e.bubbles = [];
  const free = {id:777,x:340,y:290,prevX:340,prevY:290,vx:0,vy:0,w:32,h:32,kind:'bat',state:'normal',timer:0,cooldown:9,homeY:290,weakened:false,rank:1,elite:false};
  e.enemies.push(free);
  const b = trapped(e, 300, 300, newMeta('frost', null, 0, 300, 300));
  e.popChain(b); flush(e);
  assert.ok(rt.status.get(777)?.freeze > 0);
  const x = free.x; e.updateEnemies(1/60); e.updateEnemies(1/60); assert.equal(free.x, x);
  e.levelTime = 10;
  for (let i = 0; i < 20; i++) { const t = trapped(e, 500, 300, newMeta('time', null, 0, 500, 300)); e.popChain(t); flush(e); }
  assert.ok(rt.ledger.timeAdded <= LIVING_LIMITS.timeBonusStageCap);
  e.destroy();
});

test('klein/inferno bonus score obeys the per-stage cap', () => {
  const e = make(), rt = livingRuntime(e);
  for (let i = 0; i < 200; i++) { const t = trapped(e, 200 + (i % 5) * 120, 300, newMeta('klein', null, 2, 0, 0)); e.popChain(t); flush(e); }
  assert.ok(rt.ledger.stage <= LIVING_LIMITS.perStageBonusCap);
  e.destroy();
});

test('stress: every ammo type and personality for 4000 ticks stays bounded and terminates', () => {
  const e = make(), rt = livingRuntime(e);
  let r = 7; rt.rng = () => (r = (r * 16807) % 2147483647) / 2147483647;
  e.lives = 99; e.held.bubble = true;
  for (let i = 0; i < 4000; i++) {
    if (i % 30 === 0) grantAmmo(e, AMMO_ORDER[(i / 30) % AMMO_ORDER.length], 3);
    if (i % 90 === 0) { e.held.right = !e.held.right; e.held.left = !e.held.right; }
    if (i % 200 === 0) for (let k = 0; k < 4; k++) trapped(e, 150 + k * 170, 250 + (k % 2) * 120, newMeta(AMMO_ORDER[(i + k) % 11], null, 0, 0, 0));
    if (i % 50 === 0) { const occ = e.bubbles.find(b => b.phase === 'occupied'); if (occ) e.popChain(occ); }
    if (e.state !== 'playing') e.state = 'playing';
    e.levelTime = 99; e.update(1/60);
    assert.ok(rt.fx.length <= LIVING_LIMITS.maxFx);
    for (const b of e.bubbles) { const m = rt.meta.get(b); if (m) { assert.ok(m.depth <= LIVING_LIMITS.maxRecursionDepth); assert.ok(m.children <= LIVING_LIMITS.maxChildrenPerParent); } }
    assert.ok(e.bubbles.length < 80, `bubbles ${e.bubbles.length}`);
  }
  assert.ok(rt.ledger.stage <= LIVING_LIMITS.perStageBonusCap);
  e.render?.(0);
  e.destroy();
});
