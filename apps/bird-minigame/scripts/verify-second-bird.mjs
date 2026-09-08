import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../tmp/second-bird-20260906/',import.meta.url);await mkdir(out,{recursive:true});
const historical=execFileSync('git',['show','b5b2de7:apps/bird-minigame/src/sprite-assets.js'],{encoding:'utf8'});
const oldPainter=historical.slice(historical.indexOf('export function paintBird'),historical.indexOf('export function paintFlower')).replace('export ','');
const file=await readFile(new URL('../assets/candidates/second-bird-20260906/yellow-tit-v1.png',import.meta.url));
assert.equal(createHash('sha256').update(file).digest('hex'),'91eaa7660aeba53880dacdfbf8f00cdc4653e5b8081f335f88f6f9921a3fbab4');
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4196'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:480,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4196/');await page.evaluate(()=>birdGame.ready);
  assert.equal(await page.evaluate(()=>birdGame.getBirdSpecies()),'taiwan_blue_magpie');
  await page.locator('[data-game-bird="yellow_tit"]').click();assert.equal(await page.evaluate(()=>birdGame.getBirdSpecies()),'yellow_tit');
  await page.screenshot({path:fileURLToPath(new URL('selector.png',out))});
  const report=await page.evaluate(async oldPainter=>{
    const {loadSprites,paintBird}=await import('/src/sprite-assets.js');const {createGameState}=await import('/src/game-core.js');
    const sprites=await loadSprites(),previous=Function('return ('+oldPainter+')')();
    const canvas=()=>{const c=document.createElement('canvas');c.width=480;c.height=640;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return [c,x];};
    let magpieChangedPixels=0;
    for(const phase of ['ready','running','won'])for(let pose=0;pose<3;pose++){
      const state={...createGameState(),phase,bird:{x:.5,y:.5,direction:1}},[a,ax]=canvas(),[b,bx]=canvas();
      paintBird(ax,sprites,state,480,640,pose);previous(bx,sprites,state,480,640,pose);
      const ad=ax.getImageData(0,0,480,640).data,bd=bx.getImageData(0,0,480,640).data;
      for(let i=0;i<ad.length;i+=4)if(ad.subarray(i,i+4).some((v,j)=>v!==bd[i+j]))magpieChangedPixels++;
    }
    const strip=document.createElement('canvas');strip.width=512;strip.height=128;const sx=strip.getContext('2d');sx.imageSmoothingEnabled=false;
    const selected=sprites.birds.yellow_tit,flame={...sprites,bird:selected.frames,layout:{...sprites.layout,bird:selected.layout}};
    sx.fillStyle='#91d5db';sx.fillRect(0,0,512,128);
    for(let pose=0;pose<4;pose++){const state={...createGameState(),phase:'running',bird:{x:(80+128*pose)/512,y:.5,direction:1}};paintBird(sx,flame,state,512,128,pose);}
    const flightWidths=[];
    for(let pose=0;pose<3;pose++){
      const [c,cx]=canvas(),state={...createGameState(),phase:'running',bird:{x:.5,y:.5,direction:1}};
      paintBird(cx,flame,state,480,640,pose);const data=cx.getImageData(0,0,480,640).data;
      let left=480,right=0;for(let y=0;y<640;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
      flightWidths.push(right-left+1);
    }
    return {magpieChangedPixels,poses:selected.frames.length,flightWidths,strip:strip.toDataURL().split(',')[1]};
  },oldPainter);
  assert.equal(report.magpieChangedPixels,0);assert.equal(report.poses,4);
  assert.ok(report.flightWidths.every(w=>w>=85&&w<=100),'yellow tit stays readable without per-pose resizing');
  await writeFile(new URL('yellow_tit-poses.png',out),Buffer.from(report.strip,'base64'));delete report.strip;
  await page.evaluate(()=>birdGame.start());await page.waitForTimeout(1900);
  await page.locator('.game-canvas').screenshot({path:fileURLToPath(new URL('yellow_tit-game.png',out))});
  assert.equal(await page.locator('[data-game-bird="yellow_tit"]').isVisible(),false);
  assert.equal(await page.evaluate(()=>{try{birdGame.setBirdSpecies('taiwan_blue_magpie');return false;}catch{return true;}}),true);
  await page.evaluate(()=>birdGame.pause());
  assert.equal(await page.evaluate(()=>{try{birdGame.setBirdSpecies('taiwan_blue_magpie');return false;}catch{return true;}}),true);
  await page.evaluate(()=>{birdGame.exit();birdGame.start();});assert.equal(await page.evaluate(()=>birdGame.getBirdSpecies()),'yellow_tit');
  await page.evaluate(()=>{birdGame.exit();birdGame.setBirdSpecies('taiwan_blue_magpie');});assert.equal(await page.evaluate(()=>birdGame.getBirdSpecies()),'taiwan_blue_magpie');
  assert.equal(await page.evaluate(()=>{try{birdGame.setBirdSpecies('unknown');return false;}catch{return true;}}),true);
  // Layout-only completion fixture; physical event coverage comes from the separate recording.
  await page.evaluate(()=>{const s=birdGame.getState();s.phase='won';s.bird={x:.52,y:s.config.groundY-.018,direction:-1};});
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>{const c=document.querySelector('.game-canvas').getBoundingClientRect(),choices=document.querySelector('.bird-choices').getBoundingClientRect();return choices.bottom<c.top+c.height*.65;}),true,'completion choices leave the landed bird unobstructed');
  for(const columns of [3,8]){
    await page.goto('http://127.0.0.1:4196/?species=yellow_tit&columns='+columns);await page.evaluate(()=>birdGame.ready);
    assert.equal(await page.evaluate(()=>birdGame.getState().flowers.length),columns);assert.equal(await page.evaluate(()=>birdGame.getBirdSpecies()),'yellow_tit');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('verification.json',out),JSON.stringify({...report,selection:'default, click, lock during running/paused, replay, change after exit, invalid ID',aacColumns:[3,4,8],sourceUnmodified:true,pageErrors:errors},null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();server.kill();}
