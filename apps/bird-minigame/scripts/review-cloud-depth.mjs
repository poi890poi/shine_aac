import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT),{chromium}=require('playwright');
const out='apps/bird-minigame/tmp/cloud-depth-review';mkdirSync(out,{recursive:true});
const baseline=execFileSync('git',['show','74eb4b5:apps/bird-minigame/src/reviewed-scenery.js'],{encoding:'utf8',windowsHide:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5196'],{windowsHide:true,stdio:'ignore'});let browser;
const cards=[],results=[];
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5196/apps/web/')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const old of [true,false]){
  const page=await browser.newPage({viewport:{width:640,height:800}});
  if(old)await page.route('**/src/reviewed-scenery.js',route=>route.fulfill({contentType:'text/javascript',body:baseline}));
  await page.goto('http://127.0.0.1:5196/apps/bird-minigame/');
  const result=await page.evaluate(async old=>{
   const {loadReviewedScenery,paintReviewedScenery}=await import('/apps/bird-minigame/src/reviewed-scenery.js');
   const {createClearing,MOUNTAIN_PROFILES}=await import('/apps/bird-minigame/src/clearing-scenery.js');
   const {createCloudPlacements}=await import('/apps/bird-minigame/src/cloud-layout.js');
   const assets=await loadReviewedScenery(),images=[];
   for(const [w,h,ground] of [[640,400,375],[360,800,720]])for(const seed of old?[9]:[9,51]){
    for(let profile=0;profile<8;profile++){
     const c=document.createElement('canvas');c.width=w;c.height=h;
     const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
     paintReviewedScenery(ctx,assets,w,h,ground,18,false,{...createClearing(seed),mountainProfile:profile},createCloudPlacements(seed+20));
     images.push({label:`${old?'Before':'After'} - ${MOUNTAIN_PROFILES[profile]} - ${w}x${h} - seed ${seed}`,name:`${old?'before':'after'}-${w}-${profile}-${seed}`,image:c.toDataURL()});
    }
   }
   // Distinct, fully opaque synthetic art makes occlusion independently observable.
   const solid=(w,h,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,w,h);return c;};
   const mountain=solid(480,143,'#52777f'),far=solid(80,80,'#a6c4cc'),near=solid(80,80,'#ffffff');
   const c=solid(480,640,'#000000'),ctx=c.getContext('2d');
   paintReviewedScenery(ctx,{clouds:[far,near],cloudSourceSizes:[[80,80],[80,80]],mountain,mountains:[mountain],land:solid(480,164,'#008000')},480,640,628,0,true,{...createClearing(9),mountain:0},[[0,0,380,1,'far'],[1,20,380,1,'near']]);
   const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
   const raster={farBehind:pixel(10,390),nearInFront:pixel(30,380),lowerSlope:pixel(30,450)};
   return {images,raster};
  },old);
  for(const item of result.images){writeFileSync(`${out}/${item.name}.png`,Buffer.from(item.image.split(',')[1],'base64'));cards.push(item);}
  results.push({baseline:old,...result.raster});await page.close();
 }
 assert.deepEqual(results[1].farBehind,[82,119,127,255]);
 assert.deepEqual(results[1].nearInFront,[255,255,255,255]);
 assert.deepEqual(results[1].lowerSlope,[82,119,127,255]);
 assert.notDeepEqual(results[0].nearInFront,results[1].nearInFront,'old all-clouds-behind composition must fail front occlusion');
 // Full game uses the production GPU renderer, with fixed state for paired images.
 for(const [width,height] of [[640,400],[360,800]])for(const old of [true,false]){
  const page=await browser.newPage({viewport:{width,height}});
  if(old)await page.route('**/src/reviewed-scenery.js',route=>route.fulfill({contentType:'text/javascript',body:baseline}));
  await page.goto('http://127.0.0.1:5196/apps/bird-minigame/');
  const data=await page.evaluate(async()=>{
   document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="review"></canvas></div>';
   const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
   const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
   const canvas=document.querySelector('#review'),renderer=createBirdRenderer(canvas,{species:'yellow_tit'});await renderer.ready;renderer.setScenerySeed(9);
   const state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.5;state.time=18;renderer.render(state);return canvas.toDataURL();
  });
  const name=`game-${old?'before':'after'}-${width}`;
  writeFileSync(`${out}/${name}.png`,Buffer.from(data.split(',')[1],'base64'));cards.unshift({label:`Full game ${old?'before':'after'} - ${width}x${height}`,name,image:data});await page.close();
 }
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloud and mountain depth review</title><style>body{font:17px/1.5 system-ui;background:#eaf1ef;color:#213c3d;margin:24px}section{display:flex;flex-wrap:wrap;align-items:flex-start;gap:20px}figure{margin:0 0 24px}img{display:block;max-width:100%;height:auto;image-rendering:pixelated}figcaption{margin:8px 0}h1{font-size:26px}</style><h1>Mountains between the two cloud layers</h1><p>Far clouds → mountains → near clouds → meadow. Near clouds overlap only the upper mountain band; lower slopes stay clear. Existing cloud art, sizes and shading are unchanged.</p><p>Full game comparisons, then all eight mountain profiles in portrait and landscape. Seed 51 adds a second arrangement. <a href="artwork-credits-20260909.html">Artwork credits</a></p><section>${cards.map(c=>`<figure><figcaption>${c.label}</figcaption><img src="${c.image}" alt="${c.label}"></figure>`).join('')}</section></html>`;
 writeFileSync(`${out}/cloud-depth-review-20260910.html`,html);writeFileSync(`${out}/result.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({images:cards.length,raster:results,out}));
}finally{await browser?.close();server.kill();}
