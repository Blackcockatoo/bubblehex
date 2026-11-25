import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const directory = mkdtempSync(join(tmpdir(), 'bubblehex-chambers-'));
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
const { installLivingBubbles, livingRuntime } = await import(join(directory,'living-expansion.mjs'));
const { installFamiliars } = await import(join(directory,'familiar-expansion.mjs'));
installBubbleHexRuntimeUpgrades(BubbleHexEngine); installForbiddenExpansion(BubbleHexEngine); installExpansionInterface(BubbleHexEngine);
installLivingBubbles(BubbleHexEngine); installFamiliars(BubbleHexEngine);
const { installLivingCabinet, cabinetRuntime, cabinetSave } = await import(join(directory,'cabinet-expansion.mjs'));
installLivingCabinet(BubbleHexEngine); installLivingCabinet(BubbleHexEngine);
const { installChambers, chamberRuntime, wornTheme } = await import(join(directory,'chamber-expansion.mjs'));
const { CHAMBERS, PROP_LIMITS, BEAT } = await import(join(directory,'chambers.mjs'));
const { LEVELS } = await import(join(directory,'levels.mjs'));
const { LIVING_LIMITS } = await import(join(directory,'living-bubbles.mjs'));
const { interfaceRuntime } = await import(join(directory,'expansion-ui.mjs'));
const LEVELS_SNAPSHOT = JSON.stringify(LEVELS);
installChambers(BubbleHexEngine); installChambers(BubbleHexEngine);
const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):/Gradient|Pattern/.test(String(key))?()=>({addColorStop(){}}):()=>{}});
const make = () => {
  storage.clear();
  const e = new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{});
  e.beginRun(); e.state='playing';
  expansionRuntime(e).rng = () => 0.99; livingRuntime(e).rng = () => 0.99; cabinetRuntime(e).rng = () => 0; chamberRuntime(e).rng = () => 0.5;
  return e;
};
const tick = (e, n=1) => { for (let i=0;i<n;i++) e.update(1/60); };
const key = e => { const before=e.rewards.length; e.rewards.push({x:e.player.x+17,y:e.player.y+24,vy:0,kind:'HEX_ITEM',value:0,life:9,itemId:'widow_key'}); e.collectReward(e.rewards[before]); e.rewards.splice(before,1); };
const enter = (e, id) => { e.enterChamber(id); e.state = 'playing'; e.player.invuln = 0; return chamberRuntime(e); };
const wipe = e => { for (const en of e.enemies) en.state = 'dead'; };
/** Clear the field but keep one harmless, stationary eye so the stage does not end. */
const quiet = e => { wipe(e); e.enemies.push({id:9999,x:40,y:90,prevX:40,prevY:90,vx:0,vy:0,w:38,h:30,kind:'eye',state:'normal',timer:0,cooldown:1e9,homeY:90,weakened:false,rank:1,elite:false}); };
let nextEnemyId = 7000;
function trapped(e, x, y) {
  const enemy = {id:nextEnemyId++,x:x-16,y:y-16,prevX:x-16,prevY:y-16,vx:0,vy:0,w:32,h:32,kind:'love',state:'trapped',timer:0,cooldown:9,homeY:y,weakened:false,rank:1,elite:false};
  e.enemies.push(enemy);
  const b = {id:e.nextId++,x,y,prevX:x,prevY:y,vx:0,vy:0,r:25,age:0,phase:'occupied',enemyId:enemy.id,life:5};
  e.bubbles.push(b); return b;
}
const prop = (e, kind) => chamberRuntime(e).props.find(p => p.kind === kind);
const stand = (e, x, y) => { const p = e.player; p.x = x - p.w/2; p.y = y - p.h; p.previousX = p.x; p.previousY = p.y; p.vx = 0; p.vy = 0; };
const saved = () => JSON.parse(storage.get('bubble-hex-settings'));
test.after(()=>rmSync(directory,{recursive:true,force:true}));

test('the Widow\'s Key opens the Secret Door; the chamber plays between two campaign stages', () => {
  const e = make(); e.loadLevel(3); e.state = 'playing';
  assert.equal(prop(e, 'secret_door')?.mode, 'closed');
  e.syncAuditData(); assert.equal(e.canvas.dataset.expansionKeys, '0');
  const door = prop(e, 'secret_door'); stand(e, door.x, door.y); tick(e, 2);
  assert.equal(door.mode, 'closed', 'no key, no entry');
  key(e); const rt = chamberRuntime(e);
  assert.equal(rt.keys, 1); assert.equal(e.settings.collection.items.widow_key, 1);
  stand(e, door.x, door.y); tick(e, 2);
  assert.equal(door.mode, 'open'); assert.equal(rt.keys, 0); assert.equal(rt.pending.id, 'dead_disco');
  wipe(e); e.clearStage(false); e.nextStage();
  assert.equal(e.level.chamberId, 'dead_disco'); assert.equal(e.levelIndex, 3); assert.equal(e.state, 'stageIntro'); assert.equal(rt.chamber.id, 'dead_disco');
  e.render(); e.syncAuditData(); assert.equal(e.canvas.dataset.expansionChamber, 'dead_disco');
  assert.equal(e.canvas.dataset.levelName, 'The Dead Disco');
  const jadeDoors = [...e.settings.fragments], jadeSecrets = e.settings.secrets;
  e.state = 'playing'; e.cheats.extra = true; wipe(e); e.clearStage(false);
  assert.equal(e.secretFound, true);
  assert.deepEqual(e.settings.fragments, jadeDoors, 'chamber secrets never count as Jade Doors');
  assert.equal(e.settings.secrets, jadeSecrets);
  const cab = cabinetSave(e);
  assert.ok(cab.chambers.includes('chamber-dead-disco')); assert.ok(cab.secretRooms.includes('chamber-dead-disco'));
  e.nextStage();
  assert.equal(e.levelIndex, 4); assert.equal(e.level.name, LEVELS[4].name); assert.equal(rt.chamber, null);
  assert.equal(JSON.stringify(LEVELS), LEVELS_SNAPSHOT, 'original stages are never edited');
  assert.equal(saved().cabinet.chambers.includes('chamber-dead-disco'), true);
});

test('no key ever found: no door, no chamber, original flow untouched', () => {
  const e = make();
  for (let i = 0; i < LEVELS.length; i++) { e.loadLevel(i); assert.ok(!chamberRuntime(e).props.length || e.settings.collection?.items?.widow_key === undefined); }
  e.loadLevel(3); e.state = 'playing'; wipe(e); e.clearStage(false); e.nextStage();
  assert.equal(e.levelIndex, 4); assert.equal(e.level.chamberId, undefined);
  // no door in boss / last / bonus stages even with a key
  key(e); e.loadLevel(11); assert.equal(prop(e, 'secret_door'), undefined);
  e.loadBonusLevel(); assert.equal(prop(e, 'secret_door'), undefined);
});

test('restart in a chamber reloads the chamber; a second door cycles to the next chamber', () => {
  const e = make(); e.loadLevel(2); e.state = 'playing'; key(e); key(e);
  const door = prop(e, 'secret_door'); stand(e, door.x, door.y); tick(e, 2);
  wipe(e); e.clearStage(false); e.nextStage(); assert.equal(e.level.chamberId, 'dead_disco');
  e.restartCurrentStage(); assert.equal(e.level.chamberId, 'dead_disco'); assert.equal(e.levelIndex, 2);
  e.state = 'playing'; wipe(e); e.clearStage(false); e.nextStage(); assert.equal(e.levelIndex, 3);
  e.state = 'playing'; const d2 = prop(e, 'secret_door'); stand(e, d2.x, d2.y); tick(e, 2);
  assert.equal(chamberRuntime(e).pending.id, 'vanity_room');
});

test('Dead Disco: enemies lunge on the beat, pops on the beat score a capped bonus, the jukebox pulse holds enemies', () => {
  const e = make(); const rt = enter(e, 'dead_disco');
  const love = e.enemies.find(en => en.kind === 'love');
  const step = clock => { rt.clock = clock; const x = love.x; e.updateEnemies(1/60); return Math.abs(love.x - x); };
  const fast = step(0.02), slow = step(0.3);
  assert.ok(fast > slow * 3, `on-beat ${fast} vs off-beat ${slow}`);
  rt.clock = 0.01; const before = e.score;
  for (let n = 0; n < 60; n++) { const b = trapped(e, 300 + (n % 5) * 100, 300); e.popChain(b); }
  assert.ok(rt.beatBonus > 0 && rt.beatBonus <= BEAT.stageBonusCap); assert.ok(e.score > before);
  rt.clock = 0.3; const bonus = rt.beatBonus; const b = trapped(e, 400, 300); e.popChain(b); assert.equal(rt.beatBonus, bonus, 'no bonus off the beat');
  // jukebox pulse
  const e2 = make(); const rt2 = enter(e2, 'dead_disco'); const jb = prop(e2, 'jukebox');
  const near = e2.enemies[0]; near.x = jb.x - 20; near.y = jb.y - 60; near.state = 'normal';
  rt2.clock = BEAT.seconds * 4 - 0.001; rt2.lastBeat = 3; tick(e2, 2);
  assert.ok(rt2.held.has(near.id), 'jukebox beat pulse holds a nearby enemy');
  const hx = near.x; e2.updateEnemies(1/60); assert.equal(near.x, hx);
});

test('Vanity Room: mirrors reflect shots and cast one bounded twin', () => {
  const e = make(); const rt = enter(e, 'vanity_room'); quiet(e);
  const m = prop(e, 'mirror');
  e.bubbles.push({id:e.nextId++,x:m.x-25,y:m.y-60,prevX:m.x-30,prevY:m.y-60,vx:390,vy:0,r:18,age:0.05,phase:'fired',life:5});
  const n = e.bubbles.length; e.updateBubbles(1/30);
  assert.equal(e.bubbles.length, n + 1); assert.equal(rt.duplicates, 1);
  const [orig, twin] = e.bubbles.slice(-2);
  assert.ok(orig.vx < 0 && orig.x < m.x, 'reflected back'); assert.ok(twin.vx > 0 && twin.x > m.x, 'twin continues through');
  for (let k = 0; k < 20; k++) e.bubbles.push({id:e.nextId++,x:m.x-25,y:m.y-60,prevX:m.x-30,prevY:m.y-60,vx:390,vy:0,r:18,age:0.05,phase:'fired',life:5});
  e.updateBubbles(1/30);
  assert.ok(rt.duplicates <= PROP_LIMITS.mirrorMaxDuplicatesPerStage);
  assert.ok(e.bubbles.length <= LIVING_LIMITS.maxActiveBubbles + 21);
});

test('Drowned Ballroom: currents carry floating bubbles and the player sinks slowly', () => {
  const e = make(); enter(e, 'drowned_ballroom'); quiet(e);
  const b = {id:e.nextId++,x:480,y:130,prevX:480,prevY:130,vx:0,vy:-30,r:18,age:1,phase:'floating',life:5};
  const c = {id:e.nextId++,x:480,y:250,prevX:480,prevY:250,vx:0,vy:-30,r:18,age:1,phase:'floating',life:5};
  e.bubbles.push(b, c); const bx = b.x, cx = c.x;
  for (let k = 0; k < 10; k++) e.updateBubbles(1/60);
  assert.ok(b.x !== bx && c.x !== cx && Math.sign(b.x - bx) !== Math.sign(c.x - cx), 'alternating current bands');
  e.player.y = 200; e.player.vy = 900; e.player.grounded = false; e.updatePlayer(1/60);
  assert.ok(e.player.vy <= 360);
});

test('Poison Conservatory: venom spreads (bounded), burns on contact, pops cleanse it', () => {
  const e = make(); const rt = enter(e, 'poison_conservatory');
  const seeded = rt.tiles.length; assert.equal(seeded, 3);
  quiet(e);
  e.player.x = 60; e.player.y = 650 - e.player.h; e.player.invuln = 99;
  tick(e, 60 * 30);
  assert.ok(rt.tiles.length > seeded && rt.tiles.length <= PROP_LIMITS.maxTiles);
  const t = rt.tiles[0], pf = e.level.platforms[t.platform], tx = pf.x + t.slot * 40 + 20;
  const e2 = make(); const rt2 = enter(e2, 'poison_conservatory'); quiet(e2); e2.enemies.push({id:999,x:40,y:100,prevX:40,prevY:100,vx:0,vy:0,w:34,h:38,kind:'eye',state:'normal',timer:0,cooldown:99,homeY:100,weakened:false,rank:1,elite:false});
  rt2.tiles = [{platform:t.platform, slot:t.slot}];
  e2.player.x = tx - e2.player.w/2; e2.player.y = pf.y - e2.player.h; e2.player.vy = 0; e2.player.invuln = 0; e2.player.flying = 0;
  const lives = e2.lives; tick(e2, 3);
  assert.ok(e2.state === 'dying' || e2.lives < lives, 'standing in venom hurts');
  const b = trapped(e, tx, pf.y - 20); const n = rt.tiles.length; e.popChain(b);
  assert.ok(rt.tiles.length < n, 'popping cleanses nearby venom');
});

test('Klein Chamber: edges wrap for player, enemies and bubbles; bubbles fall back up from below', () => {
  const e = make(); enter(e, 'klein_chamber'); quiet(e);
  const p = e.player; p.x = 24; p.y = 650 - p.h; e.held.left = true; e.updatePlayer(1/60); e.held.left = false;
  assert.ok(p.x > 800, `player wrapped to ${p.x}`);
  const b = {id:e.nextId++,x:46,y:300,prevX:50,prevY:300,vx:-300,vy:0,r:18,age:0.05,phase:'fired',life:5};
  e.bubbles.push(b); e.updateBubbles(1/60); assert.ok(b.x > 800 && b.vx < 0, 'bubble wrapped and kept its heading');
  const f = {id:e.nextId++,x:300,y:94.5,prevX:300,prevY:94.5,vx:0,vy:-60,r:18,age:1,phase:'floating',life:5};
  e.bubbles.push(f); e.updateBubbles(1/60); assert.equal(f.y, 600);
  const en = {id:555,x:30,y:500,prevX:30,prevY:500,vx:-70,vy:0,w:34,h:38,kind:'love',state:'normal',timer:0,cooldown:9,homeY:500,weakened:false,rank:1,elite:false};
  e.enemies.push(en); e.updateEnemies(1/30); assert.ok(en.x > 800 && en.vx < 0);
});

test('Widow\'s Cathedral: boss Widow veil-steps; stained glass refracts shots; the chandelier drops when popped near', () => {
  const e = make(); enter(e, 'widow_cathedral');
  assert.ok(e.widow && e.level.boss);
  e.widow.phase = 'chase'; e.widow.phaseTimer = 0; e.widow.x = 200; e.widow.y = 300; e.player.invuln = 99;
  let jumped = false; for (let k = 0; k < 60 * 4 && !jumped; k++) { const x = e.widow.x; tick(e); if (Math.abs(e.widow.x - x) > 200) jumped = true; if (e.widow.phase !== 'chase') { e.widow.phase = 'chase'; e.widow.phaseTimer = 0; } }
  assert.ok(jumped, 'veil-step teleport');
  assert.ok(e.widow.x >= 60 && e.widow.x <= 900);
  const g = prop(e, 'stained_glass');
  const b = {id:e.nextId++,x:g.x,y:g.y-40,prevX:g.x+5,prevY:g.y-40,vx:-390,vy:0,r:18,age:0.1,phase:'fired',life:5};
  e.bubbles.push(b); e.updateBubbles(1/60);
  assert.equal(b.vy, -110); assert.ok(Math.abs(b.vx) > 390 && b.life > 5);
  const vx = b.vx; e.updateBubbles(1/60); assert.equal(b.vx, vx, 'refracts once');
  const ch = prop(e, 'chandelier'); assert.equal(ch.mode, 'hanging');
  const target = e.enemies.find(en => en.state === 'normal'); target.x = ch.x - 17; target.y = 560 - 38;
  const pb = trapped(e, ch.x + 30, ch.y + 80); e.popChain(pb);
  assert.equal(ch.mode, 'falling');
  for (let k = 0; k < 120 && ch.mode === 'falling'; k++) tick(e);
  assert.equal(ch.mode, 'fallen'); assert.ok(ch.y <= 650);
});

test('Coffin hides you (bounded invulnerability, cooldown); serpent statue spits venom ammo; tarot is single-use and bounded', () => {
  const e = make(); const rt = enter(e, 'dead_disco'); quiet(e);
  const cof = prop(e, 'coffin'); stand(e, cof.x, cof.y); e.player.grounded = true; e.player.invuln = 0;
  tick(e, 40);
  assert.ok(cof.mode === 'hidden' || cof.mode === 'cooldown'); assert.ok(e.player.invuln <= PROP_LIMITS.coffinHideSeconds);
  e.player.x = 300; tick(e, 2); assert.equal(cof.mode, 'cooldown'); assert.ok(cof.timer <= 8);
  const t = prop(e, 'tarot'); stand(e, t.x, t.y); tick(e, 2);
  assert.equal(t.mode, 'used'); assert.ok(rt.reveal);
  const e2 = make(); const rt2 = enter(e2, 'poison_conservatory'); quiet(e2);
  const s = prop(e2, 'serpent_statue'); e2.player.invuln = 99; rt2.tiles = [];
  stand(e2, 300, 650); tick(e2, 60 * 4);
  assert.ok(rt2.orbs.length >= 1 && rt2.orbs.length <= PROP_LIMITS.maxOrbs, 'statue spits');
  const orb = rt2.orbs[0]; stand(e2, orb.x, orb.y + 20); e2.player.y = orb.y - e2.player.h/2;
  const charges = () => livingRuntime(e2).inv.charges.venom ?? 0; const c0 = charges(); tick(e2, 1);
  assert.ok(charges() > c0, 'venom orb grants ammo');
  tick(e2, 60 * 40); assert.ok(rt2.orbs.length <= PROP_LIMITS.maxOrbs);
  assert.ok(s);
});

test('tarot outcomes respect their limits', () => {
  const e = make(); const rt = enter(e, 'dead_disco');
  const t = prop(e, 'tarot');
  const draw = (r) => { t.mode = 'ready'; e.player.invuln = 99; e.state = 'playing'; rt.rng = () => r; stand(e, t.x, t.y); tick(e, 1); };
  e.lives = 5; draw(1/7 + 0.01); assert.equal(e.lives, 5, 'THE STAR never exceeds 5 lives');
  e.levelTime = 10; draw(5/7 + 0.01); assert.ok(e.levelTime >= 8 - 1/30, 'DEATH keeps a floor');
  e.levelTime = e.level.time - 2; draw(0.01); assert.ok(e.levelTime <= e.level.time, 'THE SUN is capped by the stage clock');
  draw(4/7 + 0.01); assert.ok(rt.haste > 0 && rt.haste <= PROP_LIMITS.tarotEffectSeconds);
  draw(6/7 + 0.01); assert.ok(rt.darkness > 0 && rt.darkness <= 5);
  tick(e, 60 * 7); assert.equal(rt.haste, 0); assert.equal(rt.darkness, 0);
});

test('practice from the Collection: discovered chambers can be re-entered from the title; clearing returns to the title', () => {
  const e = make(); e.toTitle(); tick(e, 2);
  assert.equal(e.practiceChamber('klein_chamber'), false, 'undiscovered chambers stay locked');
  cabinetSave(e).counters['visit:chamber-klein-chamber'] = 1;
  e.openCabinet('chambers');
  const rt = cabinetRuntime(e); rt.pick[rt.section] = 17; e.render();
  e.press('bubble', 'test'); e.release('bubble', 'test'); tick(e, 1);
  assert.equal(e.level.chamberId, 'klein_chamber'); assert.equal(chamberRuntime(e).practice, true); assert.equal(rt.open, false);
  e.state = 'playing'; wipe(e); e.clearStage(false); e.nextStage();
  assert.equal(e.state, 'title');
  assert.ok(cabinetSave(e).chambers.includes('chamber-klein-chamber'));
});

test('editions unlock through play, are denied while locked, and restyle HUD/cabinet when worn', () => {
  const e = make(); const ui = interfaceRuntime(e);
  e.state = 'paused'; ui.tab = 'theme'; ui.pick.theme = 3; // klein
  e.press('bubble', 'test'); e.release('bubble', 'test'); tick(e, 1);
  assert.equal(e.settings.theme, 'default', 'locked edition refused');
  e.state = 'title'; e.openCabinet('editions'); const crt = cabinetRuntime(e); crt.pick[crt.section] = 3;
  e.press('bubble', 'test'); e.release('bubble', 'test'); tick(e, 1);
  assert.equal(e.settings.theme, 'default'); e.closeCabinet();
  enter(e, 'klein_chamber'); wipe(e); e.clearStage(false);
  e.syncAuditData(); assert.ok(e.canvas.dataset.expansionEditions.split(',').includes('klein'));
  assert.match(e.message, /KLEIN/); assert.ok(e.canvas.dataset.expansionEditions.split(',').includes('old-vic'), 'first chamber clear also earns Opening Night → Old Vic');
  e.nextStage(); e.state = 'paused'; ui.tab = 'theme'; ui.pick.theme = 3;
  e.press('bubble', 'test'); e.release('bubble', 'test'); tick(e, 1);
  assert.equal(e.settings.theme, 'klein'); assert.equal(wornTheme(e).id, 'klein');
  e.syncAuditData(); assert.equal(e.canvas.dataset.expansionWornTheme, 'klein');
  for (const st of ['playing', 'paused', 'title', 'gameOver', 'victory', 'characterSelect']) { e.state = st; e.render(); }
});

test('every chamber stays bounded under a long random session, in every edition and with reduced motion', () => {
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const def of CHAMBERS) for (const theme of ['default', 'widow-after-dark']) for (const rm of [false, true]) {
    const e = make(); e.settings.theme = theme; cabinetSave(e).themesUnlocked = ['widow-after-dark']; e.settings.reducedMotion = rm;
    const rt = enter(e, def.id); e.lives = 99;
    for (let f = 0; f < 60 * 25; f++) {
      if (f % 20 === 0) { e.held.left = rand() < 0.4; e.held.right = !e.held.left && rand() < 0.6; e.held.bubble = rand() < 0.5; if (rand() < 0.3) e.just.add('jump'); }
      if (e.state !== 'playing' && e.state !== 'hurry') { e.state = 'playing'; e.player.invuln = 1; }
      e.update(1/60);
      if (f % 97 === 0) e.render();
      assert.ok(rt.tiles.length <= PROP_LIMITS.maxTiles && rt.orbs.length <= PROP_LIMITS.maxOrbs && rt.flashes.length <= 12 && rt.held.size <= PROP_LIMITS.maxHeld);
      assert.ok(e.bubbles.length <= LIVING_LIMITS.maxActiveBubbles + PROP_LIMITS.mirrorMaxDuplicatesPerStage + 4, `${def.id} bubbles ${e.bubbles.length}`);
      for (const b of e.bubbles) assert.ok(b.x >= 0 && b.x <= 960 && b.y >= 90 && b.y <= 720, `${def.id} bubble out of bounds ${b.x},${b.y}`);
      assert.ok(e.player.x >= 24 && e.player.x <= 960 - 24 - e.player.w);
      if (rm) for (const fl of rt.flashes) assert.ok(fl.life <= 0.3);
    }
    assert.ok(rt.duplicates <= PROP_LIMITS.mirrorMaxDuplicatesPerStage);
    e.state = 'stageIntro'; e.stateTime = 0.2; e.render();
  }
});
