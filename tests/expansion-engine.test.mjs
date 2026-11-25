import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

// Same harness as engine-polish: transpile the real engine + expansion, no GPU/audio.
const directory = mkdtempSync(join(tmpdir(), 'bubblehex-expansion-'));
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
globalThis.HTMLButtonElement = class {};
const { BubbleHexEngine } = await import(join(directory,'engine.mjs'));
const { installBubbleHexRuntimeUpgrades } = await import(join(directory,'runtime-upgrades.mjs'));
const { installForbiddenExpansion, expansionRuntime } = await import(join(directory,'forbidden-expansion.mjs'));
const { ITEM_LIMITS } = await import(join(directory,'items.mjs'));
installBubbleHexRuntimeUpgrades(BubbleHexEngine);
installForbiddenExpansion(BubbleHexEngine);
installForbiddenExpansion(BubbleHexEngine); // idempotent

const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):()=>{}});
const make = () => { const e = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{}); e.beginRun(); e.state='playing'; return e; };
const item = (e,id) => { const rt=expansionRuntime(e); rt.killsSinceDrop=99; const before=e.rewards.length; e.rewards.push({x:e.player.x+17,y:e.player.y+24,vy:0,kind:'HEX_ITEM',value:0,life:9,itemId:id}); e.collectReward(e.rewards[before]); e.rewards.splice(before,1); return rt; };
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('original rewards and VENOM letters still go through the native path', () => {
  const e = make();
  e.collectReward({x:100,y:100,vy:0,kind:'CHERRY',value:100,life:10});
  assert.equal(e.score, 100);
  e.collectReward({x:100,y:100,vy:0,kind:'LETTER',value:1080,life:12,letter:'V'});
  assert.ok(e.venom.has('V'));
  assert.equal(Object.keys(e.settings.collection.items).length, 0);
  e.destroy();
});

test('kills can drop expansion items alongside native rewards, bounded per stage and on field', () => {
  const e = make(); const rt = expansionRuntime(e); rt.rng = () => 0;
  for (let i=1;i<=40;i++){ e.stageKills=i; e.spawnReward(300,300,3); }
  const items = e.rewards.filter(r=>r.itemId);
  assert.ok(items.length >= 1);
  assert.ok(items.length <= ITEM_LIMITS.maxOnField);
  assert.ok(rt.stageDrops <= ITEM_LIMITS.maxPerStage);
  assert.ok(e.rewards.some(r=>!r.itemId), 'native drops still spawn');
  e.rewards = e.rewards.filter(r=>!r.itemId);
  for (let i=41;i<=80;i++){ e.stageKills=i; e.spawnReward(300,300,3); }
  assert.ok(rt.stageDrops <= ITEM_LIMITS.maxPerStage);
  e.destroy();
});

test('attract mode never drops expansion items', () => {
  const e = make(); e.state='attract'; expansionRuntime(e).rng = () => 0;
  for (let i=1;i<=20;i++){ e.stageKills=i; e.spawnReward(300,300,3); }
  assert.equal(e.rewards.filter(r=>r.itemId).length, 0); e.destroy();
});

test('pickups record the collection and persist in save v7 (collection unchanged since v6)', () => {
  const e = make(); item(e,'poison_apple'); item(e,'poison_apple'); item(e,'black_pearl');
  assert.equal(e.score, 500+500+5000);
  assert.deepEqual(e.settings.collection.items, {poison_apple:2,black_pearl:1});
  const saved = JSON.parse(storage.get('bubble-hex-settings'));
  assert.equal(saved.version, 8); assert.deepEqual(saved.collection.items, {poison_apple:2,black_pearl:1});
  assert.equal(e.canvas.dataset.expansionToast ?? '', ''); e.syncAuditData(); assert.equal(e.canvas.dataset.expansionToast, 'black_pearl');
  e.destroy();
});

test('Broken Heart heals up to the cap, then scores', () => {
  const e = make(); e.lives = 2; item(e,'broken_heart'); assert.equal(e.lives, 3);
  e.lives = ITEM_LIMITS.maxLives; const s = e.score; item(e,'broken_heart'); assert.equal(e.lives, ITEM_LIMITS.maxLives); assert.equal(e.score, s+1000);
  e.destroy();
});

test('Widow Cherries boosts pop score with a per-stage cap', () => {
  const e = make(); item(e,'widow_cherries'); const base=e.score;
  e.enemies=[{id:1,state:'trapped',rank:1,elite:false,kind:'love'}];
  e.bubbles=[{id:1,x:200,y:300,r:25,age:1,life:5,phase:'popping',enemyId:1}];
  e.resolveBubble(e.bubbles[0],1,1);
  assert.equal(e.score-base, 150);
  e.destroy();
});

test('Serpent Ring and Vanity Mirror modify native bubbles within limits', () => {
  const e = make(); e.player.facing = 1;
  e.fireBubble(); const plain = e.bubbles.at(-1); e.bubbles=[];
  item(e,'serpent_ring'); e.fireBubble(); const ringed = e.bubbles.at(-1);
  assert.ok(ringed.life > plain.life && Math.abs(ringed.vx) > Math.abs(plain.vx));
  e.bubbles=[]; item(e,'vanity_mirror'); e.fireBubble();
  assert.equal(e.bubbles.length, 2); assert.ok(Math.sign(e.bubbles[0].vx) === -Math.sign(e.bubbles[1].vx));
  e.bubbles = Array.from({length:ITEM_LIMITS.maxBubblesForEcho},(_,i)=>({...e.bubbles[0],id:1000+i}));
  e.fireBubble(); assert.equal(e.bubbles.length, ITEM_LIMITS.maxBubblesForEcho+1, 'no echo when the field is crowded');
  e.destroy();
});

test('Dead Rose halves enemy simulation speed; Stolen Minute caps at stage time', () => {
  const e = make();
  const walker = () => [{id:9,x:400,y:100,prevX:400,prevY:100,vx:0,vy:0,w:34,h:38,kind:'bat',state:'normal',timer:0,cooldown:9,homeY:100,weakened:false,rank:1,elite:false}];
  e.player.x = 900; e.player.y = 600;
  e.enemies = walker(); e.updateEnemies(.1); const normal = e.enemies[0].timer;
  item(e,'dead_rose'); e.enemies = walker(); e.updateEnemies(.1);
  assert.ok(Math.abs(e.enemies[0].timer - normal/2) < 1e-9);
  e.levelTime = 5; item(e,'stolen_minute'); assert.equal(e.levelTime, 5+ITEM_LIMITS.timeBonusSeconds);
  e.levelTime = e.level.time - 1; item(e,'stolen_minute'); assert.equal(e.levelTime, e.level.time);
  e.destroy();
});

test('timed effects expire with simulation time, on death and on stage restart', () => {
  const e = make(); const rt = item(e,'forbidden_perfume');
  assert.ok(rt.effects.has('magnet'));
  for (let i=0;i<11*60;i++) e.updateWorld(1/60,false,false);
  assert.equal(rt.effects.has('magnet'), false, 'expired after duration');
  item(e,'wicked_clover'); e.player.invuln=0; e.player.flying=0; e.upgrades.shield=false; e.damagePlayer();
  assert.equal(rt.effects.size, 0, 'cleared on death');
  item(e,'serpent_ring'); e.restartCurrentStage();
  assert.equal(rt.effects.size, 0, 'cleared on restart'); assert.equal(rt.ledger.itemScore, 0);
  item(e,'dead_rose'); e.state='gameOver'; e.toTitle(); assert.equal(rt.effects.size, 0, 'cleared on title');
  e.destroy();
});

test('item score cannot be farmed past the stage cap', () => {
  const e = make(); const start = e.score;
  for (let i=0;i<20;i++) item(e,'black_pearl');
  assert.equal(e.score - start, ITEM_LIMITS.stageScoreCap);
  e.destroy();
});

test('Midnight Moth reveals the chamber secret clue', () => {
  const e = make(); item(e,'midnight_moth');
  assert.match(e.message, /MOTH WHISPERS/); e.destroy();
});
