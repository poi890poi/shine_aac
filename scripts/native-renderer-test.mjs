import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {benchmarkGardenRenderers} from './garden-renderer-benchmark.mjs';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT),{chromium}=require('playwright');
const out='.tmp/native-renderer';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5197'],{windowsHide:true,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5197/apps/web/')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 for(const [width,height,dpr] of (process.argv.includes('--quick')?[[1280,800,1.5]]:[[1280,800,1.5],[360,800,3],[393,851,2.75]])){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5197/apps/bird-minigame/');
  const result=await page.evaluate(async quick=>{
   document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="cpu"></canvas><canvas id="gpu" style="position:absolute;left:0;top:0"></canvas></div>';
   const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
   const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
   const {BIRD_SPECIES}=await import('/apps/bird-minigame/src/bird-species.js');
   const cpu=document.querySelector('#cpu'),gpu=document.querySelector('#gpu');
   const a=createBirdRenderer(cpu,{rendererBackend:'canvas2d'}),b=createBirdRenderer(gpu,{rendererBackend:'webgl'});
   await Promise.all([a.ready,b.ready]);a.setScenerySeed(9);b.setScenerySeed(9);
   const samples=[];
   let state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.5;
   for(const species of quick?BIRD_SPECIES.slice(0,1):BIRD_SPECIES){
    a.setSpecies(species.id);b.setSpecies(species.id);
    for(const phase of ['running','rescue','landing','won']){
     state.phase=phase==='rescue'?'running':phase;state.mode=phase==='rescue'?'rescue':'flying';state.time=phase==='running'?1:phase==='rescue'?1.13:1.26;
     state.bird.y=phase==='won'?.882:.14;state.landing=phase==='landing'?{stage:'approach',elapsed:1.7}:null;
     state.featherBurst=phase==='rescue'?{x:.5,y:.25,age:.45}:null;state.drop=phase==='running'?{x:.46,y:.32}:null;
     a.render(state);b.render(state);const x=cpu.readGamePixels(),y=gpu.readGamePixels();let differences=0,max=0,grid=0;const unit=Number(gpu.dataset.pixelScale);
     for(let i=0;i<x.length;i+=4){let different=false;for(let c=0;c<4;c++){max=Math.max(max,Math.abs(x[i+c]-y[i+c]));if(x[i+c]!==y[i+c])different=true;}if(different)differences++;
      const px=i/4%gpu.width,py=Math.floor(i/4/gpu.width),base=(Math.floor(py/unit)*unit*gpu.width+Math.floor(px/unit)*unit)*4;
      if(y[i]!==y[base]||y[i+1]!==y[base+1]||y[i+2]!==y[base+2])grid++;
     }
     samples.push({species:species.id,phase,differences,max,grid});
    }
   }
   a.setSpecies('yellow_tit');b.setSpecies('yellow_tit');state=createGameState({columns:6});state.phase='running';state.mode='flying';state.time=1;state.bird.x=.5;a.render(state);b.render(state);
   const images={cpu:cpu.toDataURL().split(',')[1]};b.render(state);images.gpu=gpu.toDataURL().split(',')[1];
   const oldWidth=innerWidth,oldHeight=innerHeight;
   gpu.parentElement.style.width=Math.floor(oldWidth*.8)+'px';gpu.parentElement.style.height=Math.floor(oldHeight*.8)+'px';a.resize();b.resize();
   a.render(state);b.render(state);const resizedCpu=cpu.readGamePixels(),resizedGpu=gpu.readGamePixels();
   const resizeParity=resizedCpu.length===resizedGpu.length&&resizedCpu.every((v,i)=>v===resizedGpu[i]);
   gpu.parentElement.style.width='';gpu.parentElement.style.height='';a.resize();b.resize();
   const before=gpu.readGamePixels(),extension=gpu.getContext('webgl').getExtension('WEBGL_lose_context');
   const lost=new Promise(resolve=>gpu.addEventListener('webglcontextlost',resolve,{once:true}));extension.loseContext();await lost;
   const restored=new Promise(resolve=>gpu.addEventListener('game-renderer-restored',resolve,{once:true}));await new Promise(resolve=>setTimeout(resolve,100));extension.restoreContext();await Promise.race([restored,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Context restoration timed out')),5000))]);
   const contextRestored=gpu.readGamePixels().every((v,i)=>v===before[i]);
   return {samples,images,resizeParity,contextRestored,info:gpu.gameRendererInfo()};
  },process.argv.includes('--quick'));
  for(const [name,data] of Object.entries(result.images))writeFileSync(`${out}/${width}-${name}.png`,Buffer.from(data,'base64'));delete result.images;
  if(width===1280)result.benchmark=await page.evaluate(benchmarkGardenRenderers);
  results.push({width,height,dpr,errors,...result});console.log(JSON.stringify({width,errors,info:result.info,failures:result.samples.filter(s=>s.differences||s.grid).slice(0,4)}));
  await page.close();
 }
 // Unavailable GPU must retain an operational Canvas2D renderer.
 const fallbackPage=await browser.newPage({viewport:{width:360,height:800}});
 await fallbackPage.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args);};});
 await fallbackPage.goto('http://127.0.0.1:5197/apps/bird-minigame/');await fallbackPage.evaluate(()=>birdGame.ready);
 const fallback=await fallbackPage.evaluate(()=>{const c=document.querySelector('.game-canvas');return {info:c.gameRendererInfo(),nonblank:c.readGamePixels().some((v,i)=>i%4!==3&&v>0)};});
 assert.equal(fallback.info.backend,'canvas2d');assert.ok(fallback.nonblank);await fallbackPage.close();
 writeFileSync(`${out}/fallback.json`,JSON.stringify(fallback,null,2));
 writeFileSync(`${out}/result.json`,JSON.stringify(results,null,2));
 assert.ok(results.every(r=>!r.errors.length&&r.resizeParity&&r.contextRestored&&r.samples.every(s=>!s.differences&&!s.grid)),'GPU must match Canvas pixel for pixel');
}finally{await browser?.close();server.kill();}
