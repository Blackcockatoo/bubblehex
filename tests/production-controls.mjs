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
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('test orientation fallback')); });
  await page.addInitScript(() => {
    const Native=window.AudioContext;
    window.AudioContext=class extends Native {
      createDynamicsCompressor(){
        const compressor=super.createDynamicsCompressor();
        const analyser=this.createAnalyser();analyser.fftSize=2048;
        compressor.connect(analyser);
        window.audioProbe={context:this,analyser};
        return compressor;
      }
    };
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='title');
  for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[412,915],[430,932],[768,1024],[1280,900],[568,320],[667,375],[844,390]]){
    await page.setViewportSize({width,height});
    const boxes=await page.locator('button,canvas').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
    for(const b of boxes)assert.ok(b.x>=0&&b.y>=0&&b.right<=width+.5&&b.bottom<=height,`${width}x${height}: ${JSON.stringify(b)}`);
    const a=boxes.find(b=>b.name==='Blow bubble'),b=boxes.find(b=>b.name==='Jump');
    assert.ok(a.w>=70&&b.w>=70&&(width<height ? b.x<a.x-a.w*.3&&b.y>a.y : b.x>a.x&&b.y>a.y+a.h*.3),'large diagonal action pair');
    const aspect=await page.locator('canvas').evaluate(el=>el.clientWidth/el.clientHeight);
    assert.ok(Math.abs(aspect-4/3)<.02,'world keeps its 4:3 proportions');
    const board=await page.locator('canvas').boundingBox();
    if(width===568)assert.ok(Math.max(board.width,board.height)>285,'larger small-phone landscape board');
    console.log(`PASS production layout ${width}x${height}`);
  }
  await page.setViewportSize({width:844,height:390});
  await page.locator('main').evaluate(el=>{el.style.setProperty('--safe-left','44px');el.style.setProperty('--safe-right','44px');el.style.setProperty('--safe-bottom','21px');});
  const safe=await page.locator('button,canvas').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom};}));
  for(const b of safe)assert.ok(b.x>=44&&b.right<=800&&b.y>=0&&b.bottom<=369,'simulated safe-area bounds');
  await page.locator('main').evaluate(el=>el.removeAttribute('style'));
  console.log('PASS simulated notch/home-indicator spacing');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'START',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='characterSelect');
  await page.getByRole('button',{name:'Jump',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='playing');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.musicTrack==='stage'&&document.querySelector('canvas').dataset.musicState==='playing');
  const audible=()=>{
    const p=window.audioProbe;if(!p||p.context.state!=='running')return false;
    const values=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(values);
    return values.some(v=>Math.abs(v)>.001);
  };
  await page.waitForFunction(audible);
  await page.getByRole('button',{name:'SOUND ON',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.muted==='true');
  await page.getByRole('button',{name:'SOUND OFF',exact:true}).tap();
  await page.waitForFunction(audible);
  console.log('PASS actual decoded music signal, mute and gesture-driven unmute');
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
  await page.waitForTimeout(550); // Outside the touch-generated ghost-click window.
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
  await page.evaluate(()=>localStorage.clear());
  await page.route('**/game/audio/title-jingle.*',route=>route.abort());
  await page.reload();await page.waitForFunction(()=>document.querySelector('main')?.dataset.gameState==='title');
  await page.getByRole('button',{name:'SOUND ON',exact:true}).tap();
  await page.getByRole('button',{name:'SOUND OFF',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.musicState==='failed');
  await page.unroute('**/game/audio/title-jingle.*');
  await page.getByRole('button',{name:'SOUND ON',exact:true}).tap();
  await page.getByRole('button',{name:'SOUND OFF',exact:true}).tap();
  await page.waitForFunction(audible);
  console.log('PASS real failed-track recovery through Sound OFF/ON');
  await page.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.resolve();screen.orientation.lock=async mode=>{window.requestedOrientation=mode;};});
  await page.getByRole('button',{name:'START',exact:true}).tap();
  await page.waitForFunction(()=>window.requestedOrientation==='landscape');
  console.log('PASS landscape lock requested after fullscreen; rejected-lock CSS fallback tested above');
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:'/tmp/bubblehex-landscape.png',animations:'disabled',timeout:5000});
  assert.deepEqual(errors,[]);
  console.log('PASS production touch Start, hero confirmation, multi-touch movement/fire, independent release, click-only activation, pause/resume, keyboard jump, restart and reduced motion; no page errors');
}finally{await browser.close();server.close();}
