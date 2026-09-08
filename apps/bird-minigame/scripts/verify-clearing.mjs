import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL('../tmp/clearing-review-20260907/',import.meta.url);await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4194'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:480,height:900}});await page.goto('http://127.0.0.1:4194/');await page.evaluate(()=>birdGame.ready);
 const result=await page.evaluate(async()=>{
  const {createClearing,MOUNTAIN_MOODS,MOUNTAIN_PROFILES}=await import('/src/clearing-scenery.js'),{loadReviewedScenery,paintReviewedScenery}=await import('/src/reviewed-scenery.js');
  const assets=await loadReviewedScenery(),c=document.createElement('canvas');c.width=1440;c.height=640*MOUNTAIN_PROFILES.length;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  const profiles=[];
  for(let row=0;row<MOUNTAIN_PROFILES.length;row++){
    for(let i=0;i<3;i++){let seed=0;while(createClearing(seed).mountain!==i||createClearing(seed).mountainProfile!==row)seed++;x.save();x.translate(i*480,row*640);paintReviewedScenery(x,assets,480,640,628,0,true,createClearing(seed));x.restore();}
    const snapshots=assets.profileMountains[row].map(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
    for(let i=1;i<3;i++)for(let p=3;p<snapshots[0].length;p+=4)if(snapshots[0][p]!==snapshots[i][p])throw Error('Mountain alpha changed within one photo');
    profiles.push(snapshots[0].filter((v,i)=>i%4===3).join(','));
  }
  if(new Set(profiles).size!==MOUNTAIN_PROFILES.length)throw Error('Mountain profiles repeat the same silhouette');
  return {png:c.toDataURL().split(',')[1],mountains:MOUNTAIN_PROFILES,moods:MOUNTAIN_MOODS.map(m=>m.id)};
 });
 await writeFile(new URL('clearing-variants.png',out),Buffer.from(result.png,'base64'));
 const lifecycle=await page.evaluate(async()=>{
  birdGame.destroy();const {mountBirdGame}=await import('/src/embed.js');let calls=0,birdCalls=0;
  window.birdGame=mountBirdGame(document.querySelector('#game-mount'),{sceneryRandom:()=>++calls/100,random:()=>{birdCalls++;return .2;},muted:true});await birdGame.ready;
  birdGame.start();const first=JSON.stringify(birdGame.getScenery());birdGame.pause();birdGame.resume();birdGame.activate();
  return {first,calls,birdCalls};
 });
 await page.setViewportSize({width:640,height:360});await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>JSON.stringify(birdGame.getScenery())),lifecycle.first);
 const next=await page.evaluate(()=>{birdGame.exit();birdGame.start();return JSON.stringify(birdGame.getScenery());});assert.notEqual(next,lifecycle.first);
 assert.equal(lifecycle.calls,1);assert.equal(lifecycle.birdCalls,1);
 await writeFile(new URL('verification.json',out),JSON.stringify({mountains:result.mountains,alphaPreserved:true,lifecycle,resizeStable:true,replayVaries:true},null,2));console.log('Clearing variants, mountain alpha and round/resize stability PASS');
}finally{await browser?.close();server.kill();}
