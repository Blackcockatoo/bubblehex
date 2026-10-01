// Run with BUBBLEHEX_PLAYWRIGHT_MODULE pointing to an installed Playwright module,
// and optionally BUBBLEHEX_CHROMIUM pointing to a system Chromium executable.
// Vite and the browser share this process's network namespace in managed runners.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const {chromium}=await import(process.env.BUBBLEHEX_PLAYWRIGHT_MODULE || 'playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5178'],{env:{...process.env,VERCEL:'1'},stdio:'pipe'});
let serverLog='';server.stdout.on('data',x=>serverLog+=x);server.stderr.on('data',x=>serverLog+=x);
const output=join(tmpdir(),'bubblehex-verification');mkdirSync(output,{recursive:true});
let browser;
const results=[],errors=[];
try {
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5178')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  assert.ok(ready,serverLog);
  browser=await chromium.launch({headless:true,executablePath:process.env.BUBBLEHEX_CHROMIUM||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178');
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='title');
  assert.equal(await page.locator('vite-error-overlay').count(),0);
  const sizes=[[320,568],[360,640],[375,667],[390,844],[412,915],[430,932],[768,1024],[1280,900],[568,320],[667,375],[844,390]];
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    const layout=await page.evaluate(()=>{
      const boxes=[...document.querySelectorAll('button,canvas,.play-readout,.hex-data-rail')].map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,button:el.tagName==='BUTTON'};});
      return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,boxes};
    });
    assert.ok(layout.scrollWidth<=width,`${width}: horizontal overflow`);
    for(const b of layout.boxes){assert.ok(b.x>=0&&b.right<=width+.5&&b.bottom<=height,`${width}x${height}: ${JSON.stringify(b)}`);if(b.button)assert.ok(b.w>=44&&b.h>=44,`${width}: small touch target ${JSON.stringify(b)}`);}
    const bubbleBox=layout.boxes.find(b=>b.name==='Blow bubble'),jumpBox=layout.boxes.find(b=>b.name==='Jump');
    assert.ok(jumpBox.x>bubbleBox.x&&jumpBox.y>=bubbleBox.y+bubbleBox.h*.3,`${width}: diagonal action layout`);
    assert.ok(bubbleBox.w>=70&&jumpBox.w>=70,`${width}: action size regressed`);
    const buttons=layout.boxes.filter(b=>b.button);
    for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];assert.ok(!(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y),`${width}: overlapping controls`);}
    console.log(`PASS layout ${width}x${height}`);
    if (width===320 || width===568) {try{await page.screenshot({path:join(output,`layout-${width}x${height}.png`),animations:"disabled",timeout:5000});}catch{console.log("Screenshot timed out; layout assertions passed");}}
    results.push({check:'layout',width,height,pass:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{
    const {BubbleHexEngine}=await import('/app/game/engine.ts');const original=BubbleHexEngine.prototype.press;
    BubbleHexEngine.prototype.press=function(...args){window.testEngine=this;return original.apply(this,args)};
  });
  await page.getByRole('button',{name:'START',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='characterSelect');
  await page.getByRole('button',{name:'Jump',exact:true}).focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.gameState==='stageIntro');
  assert.ok(await page.evaluate(()=>!!window.testEngine),'captured actual engine');
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='playing');
  // Actual touch dispatch via CDP, including two held primary actions.
  const cdp=await page.context().newCDPSession(page);
  const left=await page.getByRole('button',{name:'Move right',exact:true}).boundingBox();
  const bubble=await page.getByRole('button',{name:'Blow bubble',exact:true}).boundingBox();
  const touch=(id,b)=>({id,x:b.x+b.width/2,y:b.y+b.height/2});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,left),touch(2,bubble)]});
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(()=>window.testEngine.held.right&&window.testEngine.held.bubble));
  assert.equal(await page.locator('[data-held="true"]').count(),2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await page.evaluate(()=>!window.testEngine.held.right&&!window.testEngine.held.bubble));
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>window.testEngine.held.right));await page.keyboard.up('ArrowRight');
  await page.getByRole('button',{name:'PAUSE',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='paused');
  const x=await page.evaluate(()=>window.testEngine.player.x);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.testEngine.player.x),x);
  // Pause hold-Jump + direction still works beyond a HUD polling interval.
  await page.locator('canvas').focus();await page.keyboard.down('Space');await page.waitForTimeout(300);await page.keyboard.press('ArrowRight',{delay:50});await page.waitForTimeout(50);await page.keyboard.up('Space');await page.waitForFunction(()=>window.testEngine.settings.sfxVolume>.6);
  const sound=await page.evaluate(()=>({sfx:window.testEngine.settings.sfxVolume,motion:window.testEngine.settings.reducedMotion}));assert.ok(sound.sfx>.6);
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    const pause=await page.locator('.pause-summary').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,scroll:el.scrollHeight,client:el.clientHeight,last:el.lastElementChild.getBoundingClientRect().bottom};});
    assert.ok(pause.scroll<=pause.client+1&&pause.last<=pause.bottom,`pause text overflow at ${width}x${height}`);
  }
  await page.setViewportSize({width:390,height:844});
  results.push({check:'readable pause summary across all eleven viewports',pass:true});
  await page.getByRole('button',{name:'RESTART',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='stageIntro');
  results.push({check:'touch, keyboard, pause, held pause modifier and restart',pass:true});
  // Deterministic integration through every authored chamber. Uses actual trapping,
  // popping, scoring and progression; fixtures place bubbles at enemy positions.
  // This validates state flow, not the difficulty of an unassisted playthrough.
  const campaign=await page.evaluate(()=>{
    const e=window.testEngine,out=[];e.settings.reducedMotion=false;e.beginRun();
    for(let level=0;level<12;level++){
      e.setState('playing');
      for(const enemy of e.enemies){const b={id:e.nextId++,x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,prevX:enemy.x,prevY:enemy.y,vx:0,vy:0,r:18,age:0,phase:'fired',life:5};e.bubbles.push(b);e.tryTrap(b);if(b.enemyId){e.popChain(b);e.updatePendingPops(1)}}
      if(e.level.boss){e.widow.phase='staggered';while(e.widow.hp>0){e.widow.phase='staggered';const b={id:e.nextId++,x:e.widow.x,y:e.widow.y,prevX:e.widow.x,prevY:e.widow.y,vx:0,vy:0,r:18,age:0,phase:'fired',life:5};e.bubbles.push(b);e.tryTrap(b);e.popChain(b);e.updatePendingPops(1)}}
      if(!e.enemies.every(enemy=>enemy.state==='dead'))throw new Error('enemies remain');
      e.clearStage(false);e.stateTime=.8;e.syncAuditData();e.render();out.push({level:e.level.name,state:e.state,score:e.score,checkpoint:e.canvas.dataset.checkpointStage});e.nextStage();
    }
    return {out,state:e.state,score:e.score};
  });
  assert.equal(campaign.state,'victory');assert.equal(campaign.out.length,12);results.push({check:'scripted full campaign state flow',pass:true,...campaign});
  const resetFlow=await page.evaluate(()=>{
    const e=window.testEngine;e.beginRun();e.lives=1;e.player.invuln=0;e.damagePlayer();const dying=e.state;e.afterDeath();const failed=e.state;e.press('start');e.update(1/60);e.release('start');const replay=e.state;
    e.beginRun();e.cheats.extra=true;e.levelIndex=2;e.loadLevel(2);e.clearStage(false);e.nextStage();const bonus=e.level.bonus&&e.inBonus&&e.level.name==='The Dirty Gold Vault';e.clearStage(false);e.nextStage();const returns=e.levelIndex===3&&!e.inBonus;
    return {dying,failed,replay,bonus,returns};
  });
  assert.deepEqual(resetFlow,{dying:'dying',failed:'gameOver',replay:'title',bonus:true,returns:true});
  results.push({check:'failure, replay, bonus-room entry and campaign return',pass:true});
  // Reload validates saved progression and sound, rather than a test-only copy.
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-hex-settings')));
  await page.reload();await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='title');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-hex-settings')).highScore),saved.highScore);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.reducedMotion==='true');
  assert.equal(await page.locator('.game-background-motion').evaluate(el=>getComputedStyle(el).display),'none');
  results.push({check:'saved progress and live system reduced motion',pass:true});
  assert.deepEqual(errors,[]);
  writeFileSync(join(output,'results.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors,output},null,2));
} catch(error) {console.error(error);console.error(serverLog);process.exitCode=1;}
finally {await browser?.close();server.kill();}
