import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../tmp/visual-tuning-20260906/',import.meta.url);await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4198'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:600,height:900}});
  await page.goto('http://127.0.0.1:4198/');await page.evaluate(()=>birdGame.ready);
  const result=await page.evaluate(async()=>{
    const {loadSprites}=await import('/src/sprite-assets.js');
    const {loadReviewedScenery,prepareReviewedFlowers,paintReviewedFlower,paintReviewedScenery,paintLandingGrass}=await import('/src/reviewed-scenery.js');
    const {paintAmmo}=await import('/src/game-feedback.js');
    const {createGameState}=await import('/src/game-core.js');
    const {flowerVariant}=await import('/src/flower-variants.js');
    const source=await loadSprites(),old=prepareReviewedFlowers(source,{headScale:1}),current=prepareReviewedFlowers(source);
    const oldSky=await loadReviewedScenery({flatClouds:false}),sky=await loadReviewedScenery();
    const make=()=>{const c=document.createElement('canvas');c.width=480;c.height=640;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return[c,x];};
    let plantPixelsChanged=0,plantCases=0,headCasesEnlarged=0;
    for(let id=0;id<4;id++)for(const height of [55,130,333])for(let expression=0;expression<4;expression++){
      const flower={id,x:.5,displayHeight:height/640,reaction:expression?1:0,hits:expression,blocked:0};
      const [a,ax]=make(),[b,bx]=make();paintReviewedFlower(ax,old,flower,480,640,628);paintReviewedFlower(bx,current,flower,480,640,628);
      const before=ax.getImageData(0,0,480,640).data,after=bx.getImageData(0,0,480,640).data;
      const headH=Math.round(source.layout.flower.headSourceHeight*flowerVariant(source.layout.flower,id).scale);
      const boundary=628-height-Math.round(headH*.55)+headH;
      for(let i=boundary*480*4;i<before.length;i+=4)if(before.subarray(i,i+4).some((v,j)=>v!==after[i+j]))plantPixelsChanged++;
      const area=data=>{let n=0;for(let i=3;i<boundary*480*4;i+=4)if(data[i])n++;return n;};
      if(area(after)>area(before)*1.2)headCasesEnlarged++;plantCases++;
    }
    let cloudAlphaChanged=0;const colors=new Set();
    for(let n=0;n<sky.clouds.length;n++){
      const a=oldSky.clouds[n],b=sky.clouds[n],before=a.getContext('2d').getImageData(0,0,a.width,a.height).data,after=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
      for(let i=0;i<after.length;i+=4){if(before[i+3]!==after[i+3])cloudAlphaChanged++;if(after[i+3])colors.add([...after.subarray(i,i+3)].join(','));}
    }
    const [grass,gx]=make();paintLandingGrass(gx,480,640,576);
    const g=gx.getImageData(0,0,480,640).data;let grassPixelsAboveBand=0,tuftPixels=0;
    // The user now requests an overlapping meadow fringe within 24px of the old seam.
    for(let y=0;y<640;y++)for(let x=0;x<480;x++){const i=(y*480+x)*4;if(y<534&&g[i+3])grassPixelsAboveBand++;if(y>=558&&g[i+3]&&(g[i]!==105||g[i+1]!==166||g[i+2]!==75))tuftPixels++;}
    const [preview,px]=make();paintReviewedScenery(px,sky,480,640,576,0);
    const state=createGameState({dropMode:'recharge'});
    for(const f of state.flowers)paintReviewedFlower(px,current,f,480,640,576);paintAmmo(px,state,480);
    // Side-by-side actual current/historical component rendering; no source regeneration.
    const comparison=document.createElement('canvas');comparison.width=960;comparison.height=640;
    const cx=comparison.getContext('2d');cx.imageSmoothingEnabled=false;
    const [legacy,lx]=make();paintReviewedScenery(lx,oldSky,480,640,576,0);
    for(const f of state.flowers)paintReviewedFlower(lx,old,f,480,640,576);
    cx.drawImage(legacy,0,0);cx.drawImage(preview,480,0);
    return {plantPixelsChanged,plantCases,headCasesEnlarged,cloudAlphaChanged,cloudColors:[...colors],grassPixelsAboveBand,tuftPixels,preview:preview.toDataURL().split(',')[1],comparison:comparison.toDataURL().split(',')[1]};
  });
  assert.equal(result.plantPixelsChanged,0);assert.equal(result.headCasesEnlarged,result.plantCases);
  assert.equal(result.cloudAlphaChanged,0);assert.equal(result.cloudColors.length,3);
  assert.equal(result.grassPixelsAboveBand,0);assert.ok(result.tuftPixels>300);
  for(const columns of [3,4,8]){
    await page.goto('http://127.0.0.1:4198/?columns='+columns);await page.evaluate(()=>birdGame.ready);
    assert.equal(await page.evaluate(()=>birdGame.getState().flowers.length),columns);
    await page.locator('.game-canvas').screenshot({path:fileURLToPath(new URL('aac-'+columns+'.png',out))});
  }
  const {preview,comparison,...checks}=result;
  await writeFile(new URL('preview.png',out),Buffer.from(preview,'base64'));await writeFile(new URL('comparison.png',out),Buffer.from(comparison,'base64'));
  await writeFile(new URL('verification.json',out),JSON.stringify({...checks,aacColumns:[3,4,8]},null,2));console.log(JSON.stringify(checks));
}finally{await browser?.close();server.kill();}
