import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

// Exercise the actual engine without a GPU or audio device. Transpile its local
// modules into a temporary directory; no test-only access hooks ship to players.
const directory = mkdtempSync(join(tmpdir(), 'bubblehex-engine-'));
for (const file of readdirSync(new URL('../app/game/', import.meta.url)).filter(f => f.endsWith('.ts'))) {
  let code = ts.transpileModule(readFileSync(new URL(`../app/game/${file}`, import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code = code.replace(/from "(\.\/[^".]+)(?:\.ts)?"/g, 'from "$1.mjs"');
  writeFileSync(join(directory,file.replace('.ts','.mjs')),code);
}
const { BubbleHexEngine } = await import(join(directory,'engine.mjs'));
const { InputSources } = await import(join(directory,'input.mjs'));
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
const ctx = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):()=>{}});
const make = () => new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{});
const trapped = (engine,count=3) => {
  engine.state='playing';engine.enemies=Array.from({length:count},(_,i)=>({id:i+1,state:'trapped',rank:1,elite:false,kind:'love'}));
  engine.bubbles=engine.enemies.map((e,i)=>({id:i+1,x:200+i*35,y:300,r:25,age:1,life:5,phase:'occupied',enemyId:e.id}));
  return engine.bubbles[0];
};

test('input sources preserve other fingers, keyboard aliases and gamepads',()=>{
  const input=new InputSources();assert.equal(input.press('left','touch:1'),true);assert.equal(input.press('left','keyboard:A'),false);
  assert.equal(input.release('left','gamepad'),true);assert.equal(input.release('left','touch:1'),true);assert.equal(input.release('left','keyboard:A'),false);
  input.press('jump','touch:2');input.clear();assert.equal(input.release('jump','touch:2'),false);
});
test('stalled optional artwork cannot keep the game locked at boot',()=>{
  const e=make();e.art.state='loading';
  for(let i=0;i<190;i++)e.update(1/60);
  assert.equal(e.state,'title');e.press('start');e.release('start');
  for(let i=0;i<20;i++)e.update(1/60);
  assert.equal(e.state,'characterSelect');e.press('jump');e.release('jump');e.update(1/60);
  assert.equal(e.state,'stageIntro');e.destroy();
});
test('audio device failure does not swallow Start, jump or held movement',()=>{
  const e=make();e.audio.unlock=()=>{throw new Error('audio device unavailable')};
  e.state='title';e.press('start');e.release('start');
  for(let i=0;i<20;i++)e.update(1/60);
  assert.equal(e.state,'characterSelect');e.press('jump');e.release('jump');e.update(1/60);
  assert.equal(e.state,'stageIntro');e.state='playing';e.press('right');e.press('jump');
  e.update(1/60);assert.ok(e.player.vx>0);assert.ok(e.player.vy<0);e.destroy();
});
test('connected neutral gamepad preserves held touch movement; disconnect releases only gamepad',()=>{
  const e=make();e.press('left','pointer:1');navigator.getGamepads=()=>[{axes:[0],buttons:[]}];e.pollGamepad();assert.equal(e.held.left,true);
  navigator.getGamepads=()=>[{axes:[.8],buttons:[]}];e.pollGamepad();assert.equal(e.held.right,true);
  navigator.getGamepads=()=>[];e.pollGamepad();assert.equal(e.held.right,false);assert.equal(e.held.left,true);e.destroy();
});
test('chain reserves all bubbles immediately and scores each enemy exactly once',()=>{
  const e=make(),root=trapped(e);e.popChain(root);assert.ok(e.bubbles.every(b=>b.phase==='popping'));assert.equal(e.pendingPops.length,3);
  e.updatePendingPops(.2);assert.equal(e.score,900);assert.equal(e.stageKills,3);assert.equal(e.pendingPops.length,0);
  e.resolveBubble(root,3,1);assert.equal(e.score,900);e.destroy();
});
test('paused chain cannot accrue score and resumes on simulation time',()=>{
  const e=make();e.popChain(trapped(e));e.state='paused';e.update(.5);assert.equal(e.score,0);assert.equal(e.pendingPops.length,3);
  e.state='playing';e.updatePendingPops(.2);assert.equal(e.score,900);e.destroy();
});
test('restart clears old chain, hit stop, held input, combo and feedback',()=>{
  const e=make();e.popChain(trapped(e));e.hitStop=.2;e.shake=10;e.press('bubble');e.restartCurrentStage();
  assert.equal(e.pendingPops.length,0);assert.equal(e.hitStop,0);assert.equal(e.shake,0);assert.equal(e.held.bubble,false);assert.equal(e.comboLife,0);
  e.updatePendingPops(2);assert.equal(e.score,0);assert.equal(e.stageKills,0);e.destroy();
});
test('blur releases input and resumes hurry rather than skipping its state',()=>{
  const e=make();e.state='hurry';e.press('left');e.suspend();assert.equal(e.state,'paused');assert.equal(e.held.left,false);
  e.press('pause');assert.equal(e.state,'hurry');e.destroy();
});
test('effects are capped; reduced motion suppresses decorative effects but retains score information',()=>{
  const e=make();e.settings.reducedMotion=false;for(let i=0;i<50;i++){e.burstParticles(100,100,'pink',50);e.addRing(100,100,'pink',3);e.addScoreBurst(100,100,100);}
  assert.equal(e.particles.length,160);assert.equal(e.rings.length,20);assert.equal(e.scoreBursts.length,8);
  e.particles=[];e.rings=[];e.settings.reducedMotion=true;e.burstParticles(100,100,'pink',50);e.addRing(100,100,'pink',3);e.addScoreBurst(100,100,500);
  assert.equal(e.particles.length,0);assert.equal(e.rings.length,0);assert.equal(e.scoreBursts.at(-1).value,500);e.destroy();
});
test('system reduced motion cannot be disabled from pause',()=>{
  const e=make();motion.matches=true;e.state='paused';e.just.add('jump');e.updatePause();assert.equal(e.settings.reducedMotion,true);motion.matches=false;e.destroy();
});
test('wall impact clamps a bubble inside the field before reversing its velocity',()=>{
  const e=make();e.bubbles=[{id:1,x:20,y:300,prevX:20,prevY:300,vx:-100,vy:0,r:18,age:0,life:5,phase:'fired'}];e.updateBubbles(1/60);
  assert.equal(e.bubbles[0].x,43);assert.ok(e.bubbles[0].vx>0);assert.ok(e.bubbles[0].impact>0);e.destroy();
});
test('hit stop retains a quick jump edge until simulation resumes',()=>{
  const e=make();e.state='playing';e.hitStop=.1;e.just.add('jump');e.update(1/60);assert.ok(e.just.has('jump'));e.destroy();
});
test('focused buttons retain native Space and Enter activation on keyup',()=>{
  const e=make();for(const code of ['Space','Enter']){let prevented=false;const event={target:new HTMLButtonElement(),code,preventDefault:()=>{prevented=true}};e.onKeyDown(event);e.onKeyUp(event);assert.equal(prevented,false);}e.destroy();
});
test('pause hold-Jump volume adjustment does not toggle reduced motion',()=>{
  const e=make();e.state='paused';e.settings.reducedMotion=false;e.press('jump');e.updatePause();assert.equal(e.settings.reducedMotion,false);
  e.press('right');e.updatePause();e.just.clear();e.release('jump');e.updatePause();assert.ok(e.settings.sfxVolume>.6);assert.equal(e.settings.reducedMotion,false);
  e.press('jump');e.updatePause();e.just.clear();e.release('jump');e.updatePause();assert.equal(e.settings.reducedMotion,true);e.destroy();
});
test('a quick paused volume chord retains its modifier across a slow frame',()=>{
  const e=make();e.state='paused';e.settings.reducedMotion=false;e.press('jump');e.press('right');e.release('right');e.release('jump');e.updatePause();assert.ok(e.settings.sfxVolume>.6);assert.equal(e.settings.musicVolume,.5);assert.equal(e.settings.reducedMotion,false);e.destroy();
});
test('Sound ON restores silent music volume and unlocks/retries the selected track',()=>{
  const e=make();let unlock=0,retry=0;
  e.audio.unlock=()=>unlock++;e.audio.retryMusic=()=>retry++;
  e.settings.musicVolume=0;e.settings.muted=true;e.setMuted(false);
  assert.equal(e.settings.musicVolume,.5);assert.equal(e.settings.muted,false);
  assert.equal(unlock,1);assert.equal(retry,1);e.destroy();
});
const {AudioManager}=await import(join(directory,'audio.mjs'));
test('music falls back codecs, retries failed loads, deduplicates starts and cancels pending playback',async()=>{
  const originalFetch=globalThis.fetch;const originalCreate=document.createElement;
  let requests=[],fail=false,starts=0,closed=0,release;
  const param=()=>({value:0,cancelScheduledValues(){},linearRampToValueAtTime(){},setValueAtTime(){}});
  const node=()=>({gain:param(),connect(){return this;}});
  window.AudioContext=class {
    state='running';currentTime=0;destination={};
    createGain(){return node();}
    createDynamicsCompressor(){return Object.assign(node(),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,param()])));}
    createBufferSource(){return {connect(){},start(){starts++;},stop(){}};}
    async decodeAudioData(){return {duration:60};}
    async resume(){} async close(){closed++;}
  };
  document.createElement=()=>({canPlayType:()=> 'probably'});
  globalThis.fetch=async url=>{requests.push(url);return {ok:!fail&&!url.endsWith('.ogg'),status:503,arrayBuffer:async()=>new ArrayBuffer(1)};};
  const audio=new AudioManager();
  try {
    audio.unlock();await Promise.all([audio.playMusic('title'),audio.playMusic('title')]);
    assert.equal(starts,1);assert.equal(requests.length,2);assert.ok(requests[1].endsWith('.mp3'));
    fail=true;await audio.playMusic('stage');assert.equal(audio.playingTrack,'title','failed replacement preserves existing music');
    fail=false;audio.retryMusic();await audio.playMusic('stage');assert.equal(audio.playingTrack,'stage');assert.equal(starts,2);
    globalThis.fetch=async()=>{await new Promise(r=>{release=r;});return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};};
    const pending=audio.playMusic('boss');audio.stopMusic();release();await pending;
    assert.equal(starts,2,'stopped pending track cannot start later');
  } finally {audio.destroy();globalThis.fetch=originalFetch;document.createElement=originalCreate;delete window.AudioContext;}
  assert.equal(closed,1);
});
test('native music plays without Web Audio, preserves volume, loops and releases on teardown',async()=>{
  const tracks=[];
  window.Audio=class {
    paused=true;ended=false;volume=1;muted=false;
    constructor(){tracks.push(this);}
    setAttribute(){} removeAttribute(){} load(){}
    async play(){this.paused=false;this.onplaying?.();}
    pause(){this.paused=true;}
  };
  const audio=new AudioManager();
  try {
    audio.unlock();await audio.playMusic('stage');
    assert.equal(audio.musicTransport,'native');assert.equal(audio.musicStatus,'playing');assert.equal(tracks[0].loop,true);
    audio.setMusicVolume(.7);assert.equal(tracks[0].volume,.7);audio.setMuted(true);assert.equal(tracks[0].muted,true);
    audio.setMuted(false);await audio.playMusic('stage');assert.equal(tracks.length,1,'same track retains playback position');
    await audio.playMusic('victory');assert.equal(tracks[1].loop,false);
    audio.stopMusic(.01);await new Promise(r=>setTimeout(r,80));assert.ok(tracks.every(t=>t.paused));
  } finally {audio.destroy();delete window.Audio;}
});
test('native autoplay rejection is visible and retries inside the next gesture',async()=>{
  let denied=true;const tracks=[];
  window.Audio=class {
    paused=true;ended=false;
    constructor(){tracks.push(this);}
    setAttribute(){} removeAttribute(){} load(){} pause(){this.paused=true;}
    async play(){if(denied){const e=new Error('gesture required');e.name='NotAllowedError';throw e;}this.paused=false;this.onplaying?.();}
  };
  const audio=new AudioManager();
  try {
    await audio.playMusic('title');await Promise.resolve();assert.equal(audio.musicStatus,'blocked');
    denied=false;await audio.playMusic('title');assert.equal(audio.musicStatus,'playing');
    tracks[0].onerror();assert.equal(tracks[0].src,'/game/audio/title-jingle.ogg');
    tracks[0].onerror();assert.equal(audio.musicStatus,'failed');audio.retryMusic();await audio.playMusic('title');assert.equal(audio.musicStatus,'playing');
  } finally {audio.destroy();delete window.Audio;}
});
test.after(()=>rmSync(directory,{recursive:true,force:true}));
