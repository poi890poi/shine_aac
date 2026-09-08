// Full candidate contact sheet; reuse the live renderer without changing its catalog.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const folder='assets/candidates/mountain-batch-20260908/review';
const manifest=JSON.parse(await readFile(folder+'/manifest.json','utf8'));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,BIRD_GAME_PORT:'4198'},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4198/');
 const output=await page.evaluate(async({profiles,folder})=>{
  const {loadSprites,paintBird}=await import('/src/sprite-assets.js');
  const {createGameState}=await import('/src/game-core.js');
  const {loadReviewedScenery,paintReviewedScenery,prepareReviewedFlowers,paintReviewedFlower}=await import('/src/reviewed-scenery.js');
  const {createClearing}=await import('/src/clearing-scenery.js');
  const sprites=await loadSprites(),assets=await loadReviewedScenery(),flowers=prepareReviewedFlowers(sprites);
  const images=await Promise.all(profiles.map(async p=>{const im=new Image();im.src='/'+folder+'/'+p.id+'-native.png';await im.decode();return im;}));
  assets.profileMountains=images.map(im=>[im,im,im]);
  const atlas=document.createElement('canvas');atlas.width=1920;atlas.height=1360;
  const ax=atlas.getContext('2d');ax.imageSmoothingEnabled=false;
  // Exactly one protected foreground bitmap, reused unchanged for all profiles.
  const front=document.createElement('canvas');front.width=480;front.height=640;
  const fx=front.getContext('2d');fx.imageSmoothingEnabled=false;
  const state=createGameState({columns:4});state.bird={x:.5,y:.30,direction:1};state.phase='running';
  for(const f of state.flowers)paintReviewedFlower(fx,flowers,f,480,640,628);
  paintBird(fx,sprites,state,480,640,sprites.layout.bird.cycle[0]);
  const scenes=[];
  for(let i=0;i<profiles.length;i++){
   const c=document.createElement('canvas');c.width=480;c.height=640;
   const x=c.getContext('2d');x.imageSmoothingEnabled=false;
   paintReviewedScenery(x,assets,480,640,628,0,true,{...createClearing(7),mountain:0,mountainProfile:i});
   x.drawImage(front,0,0);scenes.push({id:profiles[i].id,png:c.toDataURL().split(',')[1]});
   const left=i%4*480,top=Math.floor(i/4)*680;
   ax.fillStyle='#eef5ef';ax.fillRect(left,top,480,40);ax.fillStyle='#284847';ax.font='19px "Microsoft JhengHei", sans-serif';
   ax.fillText(`${i+1}. ${profiles[i].label}`,left+12,top+27);ax.drawImage(c,left,top+40);
  }
  return {png:atlas.toDataURL().split(',')[1],scenes,protectedLayer:front.toDataURL().split(',')[1]};
 },{profiles:manifest.profiles,folder});
 assert.equal(output.scenes.length,8);
 for(const scene of output.scenes)await writeFile(`${folder}/${scene.id}-scene.png`,Buffer.from(scene.png,'base64'));
 await writeFile(`${folder}/mountains-eight-scenes.png`,Buffer.from(output.png,'base64'));
 await writeFile(`${folder}/protected-foreground.png`,Buffer.from(output.protectedLayer,'base64'));
 console.log('Eight candidate scenes rendered with one unchanged bird/flower foreground. Live catalog unchanged.');
}finally{await browser?.close();server.kill();}
