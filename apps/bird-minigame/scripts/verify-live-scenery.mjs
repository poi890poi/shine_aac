import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../tmp/poc-full-20260906/',import.meta.url);await mkdir(out,{recursive:true});
const baseline='data:image/png;base64,'+(await readFile(new URL('../assets/candidates/scenery-review-20260906/protected-baseline.png',import.meta.url))).toString('base64');
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4199'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
  await new Promise((res,rej)=>{server.stdout.once('data',res);server.once('error',rej);});
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:600,height:900},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:4199/');await page.evaluate(()=>birdGame.ready);
  const report=await page.evaluate(async baseline=>{
    const {loadSprites}=await import('/src/sprite-assets.js');
    const {loadReviewedScenery,prepareReviewedFlowers,paintReviewedClouds,paintReviewedFlower}=await import('/src/reviewed-scenery.js');
    // Historical baseline remains frozen; explicitly request its original cosmetic settings.
    // Current cosmetics are checked independently by verify-visual-tuning.mjs.
    const assets=await loadReviewedScenery({flatClouds:false}),sprites=prepareReviewedFlowers(await loadSprites(),{headScale:1,legacyLeafComposite:true});
    const c=document.createElement('canvas');c.width=480;c.height=640;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
    paintReviewedClouds(ctx,assets,480,640,0);
    for(let i=0;i<4;i++)paintReviewedFlower(ctx,sprites,{id:i,x:(60+i*120)/480,displayHeight:333/640,reaction:0,hits:0,blocked:0},480,640,628);
    const im=new Image();im.src=baseline;await im.decode();const b=document.createElement('canvas');b.width=480;b.height=640;const bx=b.getContext('2d');bx.drawImage(im,0,0);
    const expected=bx.getImageData(0,0,480,640).data,actual=ctx.getImageData(0,0,480,640).data;
    let changedPixels=0;for(let i=0;i<actual.length;i+=4)if(actual.subarray(i,i+4).some((v,j)=>v!==expected[i+j]))changedPixels++;
    const canvas=document.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const mountainColors=[[82,119,127],[103,142,156],[135,170,186],[166,196,204]];
    let mountainPixels=0;for(let i=0;i<data.length;i+=4)if(mountainColors.some(c=>c.every((v,j)=>v===data[i+j])))mountainPixels++;
    return {changedPixels,mountainPixels,canvas:[canvas.width,canvas.height],protectedPng:c.toDataURL().split(',')[1]};
  },baseline);
  assert.equal(report.changedPixels,0);assert.ok(report.mountainPixels>10000);
  const {protectedPng,...checks}=report;await writeFile(new URL('live-protected.png',out),Buffer.from(protectedPng,'base64'));
  await page.screenshot({path:new URL('packaged-ready.png',out).pathname.slice(1)});
  for(const columns of [3,8]){await page.goto('http://127.0.0.1:4199/?columns='+columns);await page.evaluate(()=>birdGame.ready);assert.equal(await page.evaluate(()=>birdGame.getState().flowers.length),columns);}
  await writeFile(new URL('live-scenery-verification.json',out),JSON.stringify({...checks,aacColumns:[3,4,8]},null,2));console.log(JSON.stringify(checks));
}finally{await browser?.close();server.kill();}
