import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

// M7 animation pass: purely visual. These tests prove the animation layer is
// deterministic, bounded, honours reduced motion and cannot change the simulation.
const directory = mkdtempSync(join(tmpdir(), 'bubblehex-anim-'));
for (const file of readdirSync(new URL('../app/game/', import.meta.url)).filter(f => f.endsWith('.ts'))) {
  let code = ts.transpileModule(readFileSync(new URL(`../app/game/${file}`, import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code = code.replace(/from "(\.\/[^".]+)(?:\.ts)?"/g, 'from "$1.mjs"');
  writeFileSync(join(directory,file.replace('.ts','.mjs')),code);
}
const { BubbleHexEngine } = await import(join(directory,'engine.mjs'));
const FX = await import(join(directory,'animation-fx.mjs'));
const { drawEnemyArt, drawWidowArt } = await import(join(directory,'enemy-art.mjs'));
const { drawHeroArt } = await import(join(directory,'hero-art.mjs'));
const { SKINS } = await import(join(directory,'content.mjs'));
const { LEVELS } = await import(join(directory,'levels.mjs'));
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

// A context that records every call so frames can be compared exactly.
const recorder = () => {
  const log = [];
  const target = {globalAlpha:1};
  const ctx = new Proxy(target, {
    get:(t,key)=>key==='log'?log:key in t?t[key]:key==='measureText'?()=>({width:100}):/Gradient|Pattern/.test(String(key))?()=>({addColorStop(){}}):(...args)=>{log.push(`${String(key)}(${args.map(a=>typeof a==='number'?a.toFixed(3):String(a)).join(',')})`);return undefined},
    set:(t,key,value)=>{t[key]=value;log.push(`${String(key)}=${typeof value==='number'?value.toFixed(3):value}`);return true},
  });
  return ctx;
};
const noop = new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:100}):()=>{}});
const make = (ctx=noop) => new BubbleHexEngine({dataset:{},getContext:()=>ctx},()=>{});
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const withSeed = (seed, fn) => { const real = Math.random; Math.random = seeded(seed); try { return fn(); } finally { Math.random = real; } };
const enemy = (over={}) => ({id:7,kind:'love',x:100,y:200,w:34,h:38,vx:40,vy:0,state:'normal',timer:1.3,cooldown:1.5,rank:1,elite:false,...over});
const KINDS = ['love','bat','eye','witch','doll','skull'];
const art = (kind, over={}, fxSet={}, opts={}) => {
  const ctx = recorder(), fx = new FX.AnimationFx().enemy(7);
  Object.assign(fx,{face:1,shotAge:9,landAge:9,freeAge:9,trapAge:0,fury:0},fxSet);
  drawEnemyArt(ctx,enemy({kind,...over}),fx,{scale:1.18,calm:false,animTime:2.2,px:400,py:300,...opts});
  return ctx.log;
};

test('blink, breathing and fidget curves are deterministic and bounded',()=>{
  for(let t=0;t<40;t+=.05){
    const b=FX.blinkAmount(t);assert.ok(b>=0&&b<=1);assert.equal(b,FX.blinkAmount(t));
    const f=FX.fidgetAmount(t);assert.ok(f>=0&&f<=1);assert.ok(Math.abs(FX.breathe(t))<=1);
  }
  assert.ok(FX.blinkAmount(.08)>.9,'a blink happens early in the cycle');
  assert.equal(FX.blinkAmount(1.5),0,'eyes stay open between blinks');
  assert.equal(FX.ring(2),0,'springs are settled after 1.2s');
});

test('hero fx: takeoff, landing, shot and turn events are detected and turn eases without snapping',()=>{
  const fx=new FX.AnimationFx(),base={grounded:true,vy:0,facing:1,invuln:0,throwTimer:0,state:'playing',calm:false,hitStop:false};
  fx.updateHero(1/60,base);
  fx.updateHero(1/60,{...base,grounded:false,vy:-500});assert.ok(fx.hero.takeoffAge<.05);
  fx.updateHero(1/60,{...base,grounded:false,vy:300});fx.updateHero(1/60,{...base,grounded:true,vy:0});assert.ok(fx.hero.landAge<.05);
  fx.updateHero(1/60,{...base,throwTimer:.3});assert.ok(fx.hero.shotAge<.05);
  fx.updateHero(1/60,{...base,facing:-1});assert.ok(fx.hero.turn<1&&fx.hero.turn>-1,'mid-turn');
  for(let i=0;i<30;i++)fx.updateHero(1/60,{...base,facing:-1});assert.equal(fx.hero.turn,-1);
  const calm=new FX.AnimationFx();calm.updateHero(1/60,{...base,facing:-1,calm:true});assert.equal(calm.hero.turn,-1,'reduced motion snaps the turn');
  fx.updateHero(1/60,{...base,state:'stageClear'});assert.ok(fx.hero.celebrate>0);fx.updateHero(1/60,{...base,state:'playing'});assert.equal(fx.hero.celebrate,0);
});

test('enemy fx: detects firing, landing and breaking free; slots are recycled and bounded',()=>{
  const fx=new FX.AnimationFx();let e=enemy({cooldown:.1});
  fx.updateEnemy(1/60,e,400,false);fx.endEnemyPass();
  e={...e,cooldown:2.4};fx.updateEnemy(1/60,e,400,false);fx.endEnemyPass();assert.ok(fx.enemy(7).shotAge<.05,'cooldown jump = fired');
  e={...e,vy:400};fx.updateEnemy(1/60,e,400,false);fx.endEnemyPass();e={...e,vy:0};fx.updateEnemy(1/60,e,400,false);fx.endEnemyPass();assert.ok(fx.enemy(7).landAge<.05);
  e={...e,state:'trapped'};for(let i=0;i<60;i++){fx.updateEnemy(1/60,e,400,false);fx.endEnemyPass()}assert.ok(fx.enemy(7).trapAge>.9);
  e={...e,state:'furious'};fx.updateEnemy(1/60,e,400,false);fx.endEnemyPass();assert.ok(fx.enemy(7).freeAge<.05,'trapped -> free');assert.equal(fx.enemy(7).trapAge,0);
  for(let id=100;id<140;id++)fx.updateEnemy(1/60,enemy({id}),400,false);fx.endEnemyPass();
  const slots=fx.enemySlots;fx.endEnemyPass();fx.endEnemyPass();assert.ok(fx.enemySlots<slots,'enemies that vanish release their slot');
  // malformed/partial enemies (as some engine tests create) never throw or produce NaN
  fx.updateEnemy(1/60,{id:3,state:'trapped',kind:'love'},0,false);assert.ok(Number.isFinite(fx.enemy(3).face));
});

test('defeat ghosts are capped, expire, and carry the facing they had',()=>{
  const fx=new FX.AnimationFx();for(let i=0;i<100;i++)fx.enemyDefeated(i,10,10);
  assert.equal(fx.ghosts.length,FX.MAX_GHOSTS);
  for(let i=0;i<200;i++)fx.updateGhosts(1/60);assert.equal(fx.ghosts.length,0);
});

test('widow fx: a hp drop starts the hit tell; rage turns on at half health and eases in',()=>{
  const fx=new FX.AnimationFx(),w={hp:3,maxHp:3,phase:'chase',phaseTimer:0,x:0,y:0};
  fx.updateWidow(1/60,w);assert.ok(fx.widowHitAge>1);assert.equal(fx.widowRage,0);
  fx.updateWidow(1/60,{...w,hp:2});assert.ok(fx.widowHitAge<.05);
  for(let i=0;i<300;i++)fx.updateWidow(1/60,{...w,hp:1});assert.ok(fx.widowRage>.95);
  fx.updateWidow(1/60,null);assert.equal(fx.widowRage,0);
});

test('every enemy kind draws every state with balanced save/restore and finite numbers',()=>{
  for(const kind of KINDS)for(const calm of [false,true])for(const [over,fxs,opts] of [
    [{},{},{}],[{state:'furious'},{fury:1},{}],[{timer:.1},{},{}],[{state:'trapped'},{trapAge:6},{trapped:true,panic:1}],
    [{state:'dead'},{},{defeat:.5,spin:4}],[{timer:2.4,cooldown:.1},{shotAge:.05,landAge:.05,freeAge:.05},{}],[{vy:-300,vx:-80,elite:true,rank:4},{},{}],
  ]){
    const log=art(kind,over,fxs,{...opts,calm});
    const saves=log.filter(l=>l.startsWith('save(')).length,restores=log.filter(l=>l.startsWith('restore(')).length;
    assert.equal(saves,restores,`${kind} ${JSON.stringify(over)} unbalanced`);
    assert.ok(!log.some(l=>/NaN|Infinity/.test(l)),`${kind} ${JSON.stringify(over)} non-finite: ${log.find(l=>/NaN|Infinity/.test(l))}`);
  }
});

test('enemy frames are deterministic: the same inputs always produce identical draw calls',()=>{
  for(const kind of KINDS)assert.deepEqual(art(kind,{state:'furious'},{fury:1}),art(kind,{state:'furious'},{fury:1}));
});

test('enemies have anticipation tells before attacks (doll crouch, skull crouch, eye/witch charge)',()=>{
  assert.notDeepEqual(art('doll',{timer:1.0}),art('doll',{timer:2.4}),'doll winds up');
  assert.notDeepEqual(art('skull',{timer:1.0}),art('skull',{timer:2.1}),'skull crouches before its hop');
  assert.notDeepEqual(art('eye',{cooldown:2}),art('eye',{cooldown:.1}),'eye charges');
  assert.notDeepEqual(art('witch',{cooldown:2}),art('witch',{cooldown:.1}),'witch channels');
});

test('furious, struggling and recoiling enemies look different from calm ones',()=>{
  for(const kind of KINDS){
    assert.notDeepEqual(art(kind,{state:'furious'},{fury:1}),art(kind));
    assert.notDeepEqual(art(kind,{state:'trapped'},{trapAge:6},{trapped:true,panic:1}),art(kind,{state:'trapped'},{trapAge:0},{trapped:true,panic:0}));
    assert.notDeepEqual(art(kind,{},{shotAge:.05}),art(kind));
  }
});

test('reduced motion removes spawn pop, struggle ramp, recoil and defeat spin',()=>{
  for(const kind of KINDS){
    assert.deepEqual(art(kind,{timer:.05},{},{calm:true}),art(kind,{timer:.05},{},{calm:true,animTime:2.2}));
    assert.deepEqual(art(kind,{},{shotAge:.05,landAge:.05,freeAge:.05},{calm:true}),art(kind,{},{},{calm:true}),'no recoil/land/burst');
    assert.deepEqual(art(kind,{state:'trapped'},{trapAge:6},{calm:true,trapped:true,panic:1}),art(kind,{state:'trapped'},{trapAge:0},{calm:true,trapped:true,panic:1}));
    assert.ok(!art(kind,{state:'dead'},{},{calm:true,defeat:.5,spin:6}).some(l=>l.startsWith('rotate(')&&Math.abs(parseFloat(l.slice(7)))>2));
  }
});

test('hero art: all poses draw balanced for both heroes, calm and not; blink/hit/cheer change the frame',()=>{
  const skin=SKINS[0];
  const draw=(hero,m)=>{const ctx=recorder();drawHeroArt(ctx,{hero,skin,x:50,y:50,scale:1,time:2,...m});return ctx.log};
  for(const hero of ['vesper','jade'])for(const calm of [false,true])for(const pose of ['idle','run','jump','fall','throw','hurt','cheer']){
    const log=draw(hero,{pose,calm,runPhase:1,throwT:.5,facing:-.4,hit:.05,celebrate:.4,lift:-20,rot:.6,takeoff:.03});
    assert.equal(log.filter(l=>l.startsWith('save(')).length,log.filter(l=>l.startsWith('restore(')).length);
    assert.ok(!log.some(l=>/NaN|Infinity/.test(l)),`${hero} ${pose}`);
  }
  assert.notDeepEqual(draw('vesper',{pose:'idle',time:.08}),draw('vesper',{pose:'idle',time:1.5}));
  assert.notDeepEqual(draw('jade',{pose:'idle',hit:.05}),draw('jade',{pose:'idle'}));
  assert.notDeepEqual(draw('jade',{pose:'cheer',celebrate:.1}),draw('jade',{pose:'cheer',celebrate:.5}));
  assert.deepEqual(draw('jade',{pose:'idle',calm:true,time:6}),draw('jade',{pose:'idle',calm:true,time:6}));
  assert.notDeepEqual(draw('vesper',{pose:'idle',time:6}),draw('vesper',{pose:'idle',time:6,calm:true}),'calm drops the fidget');
});

test('widow draws every phase, shows hit/rage/telegraph tells, and is calm-safe',()=>{
  const w=(o={})=>({x:480,y:300,vx:0,vy:0,age:1.4,phase:'chase',phaseTimer:.3,lungeAngle:.5,hp:3,maxHp:3,...o});
  const draw=(o,calm=false,setup=()=>{})=>{const ctx=recorder(),fx=new FX.AnimationFx();setup(fx);drawWidowArt(ctx,w(o),fx,calm,()=>{});return ctx.log};
  for(const phase of ['entrance','chase','telegraph','lunge','staggered','trapped','defeated'])for(const calm of [false,true]){
    const log=draw({phase,vx:300},calm);
    assert.equal(log.filter(l=>l.startsWith('save(')).length,log.filter(l=>l.startsWith('restore(')).length,phase);
    assert.ok(!log.some(l=>/NaN|Infinity/.test(l)),phase);
  }
  assert.notDeepEqual(draw({}),draw({},false,fx=>{fx.widowHitAge=.05}),'hit tell');
  assert.notDeepEqual(draw({}),draw({},false,fx=>{fx.widowRage=1}),'enraged');
  assert.notDeepEqual(draw({phase:'telegraph',phaseTimer:.1}),draw({phase:'telegraph',phaseTimer:.5}),'coils before lunging');
  assert.notDeepEqual(draw({phase:'defeated',phaseTimer:.2}),draw({phase:'defeated',phaseTimer:1}),'unravels');
  assert.deepEqual(draw({},true,fx=>{fx.widowHitAge=.05;fx.widowRage=1}),draw({},true),'reduced motion hides hit and rage motion');
});

// ---------- simulation independence ----------
const snapshot = e => JSON.stringify({
  state:e.state,score:e.score,lives:e.lives,levelIndex:e.levelIndex,kills:e.stageKills,
  p:[e.player.x,e.player.y,e.player.vx,e.player.vy,e.player.facing,e.player.grounded,e.player.invuln],
  enemies:e.enemies.map(x=>[x.id,x.x,x.y,x.vx,x.vy,x.state,x.timer,+x.cooldown.toFixed(6)]),
  bubbles:e.bubbles.map(b=>[b.id,b.x,b.y,b.phase,b.enemyId]),
  widow:e.widow&&[e.widow.x,e.widow.y,e.widow.hp,e.widow.phase],
});
function run({animate,render,calm=false,stage=0}){
  return withSeed(1234,()=>{
    storage.clear();const ctx=render?recorder():noop;const e=make(ctx);
    e.settings.reducedMotion=calm;
    if(!animate){e.stepFx=()=>{};e.fx={reset(){},enemyDefeated(){},heroHurt(){}};}
    e.state='playing';e.loadLevel(stage);
    e.state='playing';
    const snaps=[];
    for(let i=0;i<1500;i++){
      const right=Math.floor(i/90)%2===0,fire=i%25<3;
      e[right?'press':'release']('right','t');e[right?'release':'press']('left','t');e[fire?'press':'release']('bubble','t');
      if(i%70===0){e.press('jump','t');}else if(i%70===3)e.release('jump','t');
      e.player.invuln=Math.max(e.player.invuln,1);
      e.update(1/60);
      if(render&&i%5===0&&e.state==='playing'){ctx.log.length=0;e.drawWorld();}
      if(i%100===0)snaps.push(snapshot(e));
    }
    snaps.push(snapshot(e));if(process.env.PEEK)console.log(snaps.at(-1).slice(0,500));e.destroy();return snaps;
  });
}
test('the animation layer cannot change the simulation: identical state with fx disabled, enabled, rendered and reduced-motion',()=>{
  const bare=run({animate:false,render:false});
  assert.deepEqual(run({animate:true,render:false}),bare);
  assert.deepEqual(run({animate:true,render:true}),bare);
  assert.deepEqual(run({animate:true,render:true,calm:true}),run({animate:false,render:false,calm:true}));
});

test('the Widow boss stage simulates identically with animation on and off',()=>{
  const bossIndex=LEVELS.findIndex(l=>l.boss);assert.ok(bossIndex>=0);
  const on=run({animate:true,render:true,stage:bossIndex});
  assert.deepEqual(on,run({animate:false,render:false,stage:bossIndex}));
  assert.ok(on.some(s=>JSON.parse(s).widow),'the boss actually ran');
});

test('popping a trapped enemy spawns exactly one defeat ghost, which expires; a reload clears them',()=>{
  const e=make();e.state='playing';
  e.enemies=[{id:1,state:'trapped',rank:1,elite:false,kind:'love',x:0,y:0,w:34,h:38,vx:0,vy:0,timer:0,cooldown:1}];
  e.bubbles=[{id:1,x:200,y:300,r:25,age:1,life:5,phase:'occupied',enemyId:1}];
  e.popChain(e.bubbles[0]);e.updatePendingPops(.2);
  assert.equal(e.fx.ghosts.length,1);assert.equal(e.enemies[0].state,'dead');
  e.resolveBubble(e.bubbles[0],3,1);assert.equal(e.fx.ghosts.length,1,'no double ghost');
  for(let i=0;i<80;i++)e.fx.updateGhosts(1/60);assert.equal(e.fx.ghosts.length,0);
  e.fx.enemyDefeated(1,0,0);e.loadLevelData(e.level);assert.equal(e.fx.ghosts.length,0);e.destroy();
});

test('long runs keep animation state bounded (no growth across 3000 ticks with constant churn)',()=>{
  const e=make();withSeed(5,()=>{
    e.state='playing';
    for(let i=0;i<3000;i++){
      if(i%200===0)e.loadLevelData(e.level);
      if(i%7===0)e.fx.enemyDefeated(i,10,10);
      e.update(1/60);
      assert.ok(e.fx.ghosts.length<=FX.MAX_GHOSTS);assert.ok(e.fx.enemySlots<=e.enemies.length+1);
    }
  });e.destroy();
});
