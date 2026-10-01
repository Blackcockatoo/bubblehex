// Verify the built Vercel artifact, not just Vite development output.
// Run after VERCEL=1 npm run build. Browser paths use the same environment
// variables as browser-polish.mjs; BUBBLEHEX_URL can verify a deployed release.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.BUBBLEHEX_PLAYWRIGHT_MODULE || 'playwright');
const root=resolve('dist/client');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!path.startsWith(root+'/'))throw new Error('invalid path');res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));}
  catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.BUBBLEHEX_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.BUBBLEHEX_CHROMIUM||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='title');
  for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[412,915],[430,932],[768,1024],[1280,900],[568,320],[667,375],[844,390]]){
    await page.setViewportSize({width,height});
    const boxes=await page.locator('button,canvas').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
    for(const b of boxes)assert.ok(b.x>=0&&b.y>=0&&b.right<=width+.5&&b.bottom<=height,`${width}x${height}: ${JSON.stringify(b)}`);
    const a=boxes.find(b=>b.name==='Blow bubble'),b=boxes.find(b=>b.name==='Jump');
    assert.ok(a.w>=70&&b.w>=70&&b.x>a.x&&b.y>a.y+a.h*.3,'large diagonal action pair');
    console.log(`PASS production layout ${width}x${height}`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'START',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='characterSelect');
  await page.getByRole('button',{name:'Jump',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='playing');
  const cdp=await page.context().newCDPSession(page);
  const right=await page.getByRole('button',{name:'Move right'}).boundingBox();
  const bubble=await page.getByRole('button',{name:'Blow bubble'}).boundingBox();
  const touch=(id,b)=>({id,x:b.x+b.width/2,y:b.y+b.height/2});
  const before=Number(await page.locator('canvas').getAttribute('data-player-x'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,right),touch(2,bubble)]});
  await page.waitForFunction(x=>Number(document.querySelector('canvas').dataset.playerX)>x+10,before);
  assert.equal(await page.locator('[data-held="true"]').count(),2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[touch(1,right)]});
  assert.equal(await page.locator('[data-held="true"]').count(),1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('[data-held="true"]').count(),0);
  await page.getByRole('button',{name:'PAUSE',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='paused');
  // A click without pointer events must still work (assistive/legacy activation).
  const muted=await page.locator('canvas').getAttribute('data-muted');
  await page.getByRole('button',{name:'Blow bubble'}).evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));
  await page.waitForFunction(previous=>document.querySelector('canvas').dataset.muted!==previous,muted);
  await page.getByRole('button',{name:'RESUME',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='playing');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.playerVy)<-100);
  await page.getByRole('button',{name:'PAUSE',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='paused');
  await page.getByRole('button',{name:'RESTART',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.gameState==='stageIntro');
  assert.equal(Number(await page.locator('canvas').getAttribute('data-score')),0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.reducedMotion==='true');
  assert.deepEqual(errors,[]);
  console.log('PASS production touch Start, hero confirmation, multi-touch movement/fire, independent release, click-only activation, pause/resume, keyboard jump, restart and reduced motion; no page errors');
}finally{await browser.close();server.close();}
