import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const directory = mkdtempSync(join(tmpdir(), 'bubblehex-interface-'));
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
const { installForbiddenExpansion } = await import(join(directory,'forbidden-expansion.mjs'));
const { installExpansionInterface, interfaceRuntime, stepShownScore } = await import(join(directory,'expansion-ui.mjs'));
installBubbleHexRuntimeUpgrades(BubbleHexEngine); installForbiddenExpansion(BubbleHexEngine); installExpansionInterface(BubbleHexEngine); installExpansionInterface(BubbleHexEngine);
const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):/Gradient|Pattern/.test(String(key))?()=>({addColorStop(){}}):()=>{}});
const make = () => { const e = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{}); e.beginRun(); e.state='playing'; return e; };
const key = code => window.dispatchEvent(Object.assign(new Event('keydown'),{code,repeat:false,preventDefault(){}}));
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('animated score counter eases, snaps on reduced motion and reset', () => {
  assert.ok(stepShownScore(0,1000,1/60,false) > 0 && stepShownScore(0,1000,1/60,false) < 1000);
  assert.equal(stepShownScore(0,1000,1/60,true), 1000);
  assert.equal(stepShownScore(5000,0,1/60,false), 0);
  let s=0; for(let i=0;i<120;i++) s=stepShownScore(s,12345,1/60,false); assert.equal(s,12345);
});

test('pause opens on SETTINGS; original pause controls still adjust volume there', () => {
  const e = make(); e.press('pause'); e.release('pause'); assert.equal(e.state,'paused');
  assert.equal(interfaceRuntime(e).tab,'settings');
  const before = e.settings.musicVolume; e.press('right'); e.release('right'); e.update(1/60);
  assert.ok(e.settings.musicVolume > before); e.destroy();
});

test('Q/E and setExpansionTab switch tabs; tab input does not change volume', () => {
  const e = make(); e.start(); e.press('pause'); e.release('pause');
  key('KeyE'); assert.equal(interfaceRuntime(e).tab,'collection');
  key('KeyQ'); key('KeyQ'); assert.equal(interfaceRuntime(e).tab,'theme');
  e.setExpansionTab('collection'); const vol = e.settings.musicVolume;
  e.press('right'); e.release('right'); e.update(1/60);
  assert.equal(e.settings.musicVolume, vol); assert.equal(interfaceRuntime(e).pick.collection, 1);
  e.press('pause'); e.release('pause'); e.press('pause'); e.release('pause');
  assert.equal(interfaceRuntime(e).tab,'settings','each pause reopens on SETTINGS');
  e.destroy(); key('KeyE'); // listener removed: no throw
});

test('jukebox: locked records refuse, Cursed Vinyl unlocks and the choice persists', () => {
  const e = make(); e.press('pause'); e.release('pause'); e.setExpansionTab('jukebox');
  interfaceRuntime(e).pick.jukebox = 4; // boss: needs 2 vinyls
  e.press('bubble'); e.release('bubble'); e.update(1/60); assert.equal(e.settings.jukeboxTrack,'auto');
  e.settings.collection.items.cursed_vinyl = 2;
  e.press('bubble'); e.release('bubble'); e.update(1/60); assert.equal(e.settings.jukeboxTrack,'boss');
  assert.equal(JSON.parse(storage.get('bubble-hex-settings')).jukeboxTrack,'boss');
  const played=[]; e.audio.playMusic=id=>played.push(id); e.audioReady=true; e.syncMusic(); assert.deepEqual(played,['boss']);
  e.state='title'; e.syncMusic(); assert.equal(played.at(-1),'title','menus keep their own music');
  e.destroy();
});

test('theme choice applies and persists (special editions unlock through play since M6)', () => {
  const e = make(); e.press('pause'); e.release('pause'); e.setExpansionTab('theme');
  e.press('right'); e.release('right'); e.update(1/60); e.press('bubble'); e.release('bubble'); e.update(1/60);
  assert.equal(e.settings.theme,'default','locked edition is refused');
  e.settings.cabinet.achievements.push('opening_night');
  e.press('bubble'); e.release('bubble'); e.update(1/60);
  assert.equal(e.settings.theme,'old-vic'); assert.equal(JSON.parse(storage.get('bubble-hex-settings')).theme,'old-vic'); e.destroy();
});

test('announcements fire on real events and are throttled', () => {
  const e = make(); const ui = interfaceRuntime(e);
  e.enemies = Array.from({length:6},(_,i)=>({id:i+1,state:'trapped',rank:1,elite:false,kind:'love'}));
  e.bubbles = e.enemies.map((en,i)=>({id:i+1,x:200+i*35,y:300,r:25,age:1,life:5,phase:'occupied',enemyId:en.id}));
  e.popChain(e.bubbles[0]);
  assert.equal(ui.announcer.current?.text,'ABSOLUTELY HEXED.'); assert.equal(ui.lastChain,6);
  e.enemies=[{id:50,state:'trapped',rank:1,elite:false,kind:'love'}]; e.bubbles=[{id:50,x:100,y:300,r:25,age:1,life:1,phase:'warning',enemyId:50}];
  e.popChain(e.bubbles[0]); assert.equal(ui.announcer.current?.text,'ABSOLUTELY HEXED.','lower priority throttled');
  ui.announcer.tick(5); e.bubbles[0].phase='warning'; e.popChain(e.bubbles[0]); assert.equal(ui.announcer.current?.text,'POP RESPONSIBLY.');
  e.destroy();
});

test('recapturing a furious enemy and hoarding traps announce', () => {
  const e = make(); const ui = interfaceRuntime(e);
  e.enemies=[{id:7,x:300,y:300,w:34,h:38,state:'furious',rank:1,elite:false,kind:'love'}];
  const b={id:70,x:317,y:319,r:18,age:.1,life:5,phase:'fired',vx:0,vy:0}; e.bubbles=[b];
  e.tryTrap(b); assert.equal(b.enemyId,7); assert.equal(ui.announcer.current?.text,'YOU LITTLE MENACE.');
  const f = make(); const fu = interfaceRuntime(f); f.firstPop=false; f.trappedBeforeFirstPop=2;
  f.enemies=[{id:8,x:300,y:300,w:34,h:38,state:'normal',rank:1,elite:false,kind:'love'}];
  const c={id:80,x:317,y:319,r:18,age:.1,life:5,phase:'fired',vx:0,vy:0}; f.bubbles=[c];
  f.tryTrap(c); assert.equal(fu.announcer.current?.text,'BUBBLE BAD BEHAVIOUR.'); e.destroy(); f.destroy();
});

test('surviving a hit, flawless clear and VENOM ascension announce', () => {
  const e = make(); const ui = interfaceRuntime(e);
  e.lives=2; e.state='dying'; e.afterDeath(); assert.equal(ui.announcer.current?.text,'THAT WAS PERSONAL.');
  const g = make(); const gu = interfaceRuntime(g); g.state='playing'; g.stageDamaged=false; g.clearStage(false);
  assert.equal(gu.announcer.current?.text,'THE WIDOW APPROVES.');
  const h = make(); const hu = interfaceRuntime(h); ['V','E','N','O'].forEach(l=>h.venom.add(l));
  h.collectReward({x:1,y:1,vy:0,kind:'LETTER',value:1080,life:9,letter:'M'}); assert.equal(hu.announcer.current?.text,'SIN. WIN. REPEAT.');
  e.destroy(); g.destroy(); h.destroy();
});

test('attract mode never announces; HUD draws the eased score but keeps the real one', () => {
  const e = make(); e.state='attract'; e.lives=2; e.enemies=Array.from({length:6},(_,i)=>({id:i+1,state:'trapped',rank:1,elite:false,kind:'love'}));
  e.bubbles=e.enemies.map((en,i)=>({id:i+1,x:200+i*35,y:300,r:25,age:1,life:5,phase:'occupied',enemyId:en.id})); e.popChain(e.bubbles[0]);
  assert.equal(interfaceRuntime(e).announcer.current,null);
  const f = make(); f.score=5000; interfaceRuntime(f).shownScore=100; let seen; const orig=Object.getPrototypeOf(Object.getPrototypeOf(f)); void orig;
  f.label=(text)=>{if(String(text).startsWith('SCORE'))seen=text}; f.drawHud(); assert.equal(seen,'SCORE 0000100'); assert.equal(f.score,5000);
  e.destroy(); f.destroy();
});

test('pause tab panels and meters render without throwing in every tab and theme', () => {
  const e = make(); e.press('pause'); e.release('pause');
  for (const theme of ['default','old-vic','civilian-signal','klein','widow-after-dark']) { e.settings.theme=theme;
    for (const tab of ['settings','collection','jukebox','theme']) { e.setExpansionTab(tab); e.render(); } }
  e.syncAuditData(); assert.equal(e.canvas.dataset.expansionPauseTab,'theme'); e.destroy();
});
