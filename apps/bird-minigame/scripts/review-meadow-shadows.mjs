import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT),{chromium}=require('playwright');
const out='apps/bird-minigame/tmp/meadow-shadow-review';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5196'],{windowsHide:true,stdio:'ignore'});let browser;
const cards=[];
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5196/apps/web/')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const [width,height] of [[640,400],[360,800]])for(const seed of [9,51,71])for(const before of [true,false]){
  const page=await browser.newPage({viewport:{width,height}});
  if(before)await page.route('**/src/meadow-cloud-shadows.js',route=>route.fulfill({contentType:'text/javascript',body:'export function paintMeadowCloudShadows(){}'}));
  await page.goto('http://127.0.0.1:5196/apps/bird-minigame/');
  const captures=await page.evaluate(async({seed,before})=>{
   document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="review"></canvas></div>';
   const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
   const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
   const canvas=document.querySelector('#review'),renderer=createBirdRenderer(canvas,{species:'yellow_tit'});await renderer.ready;renderer.setScenerySeed(seed);
   const state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.5;state.time=18;renderer.render(state);
   const game=canvas.toDataURL();renderer.destroy();
   const {loadReviewedScenery,paintReviewedScenery}=await import('/apps/bird-minigame/src/reviewed-scenery.js');
   const {createClearing,CLEARING_PALETTES}=await import('/apps/bird-minigame/src/clearing-scenery.js');
   const {createCloudPlacements}=await import('/apps/bird-minigame/src/cloud-layout.js');
   const assets=await loadReviewedScenery(),scene=createClearing(seed),ground=innerWidth>innerHeight?375:720;
   const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;const ctx=c.getContext('2d');
   const terrain=[];
   for(const time of [0,18,36]){paintReviewedScenery(ctx,assets,c.width,c.height,ground,time,false,scene,createCloudPlacements(seed+20));terrain.push({time,image:c.toDataURL()});}
   return {game,terrain,meadow:CLEARING_PALETTES[scene.palette].meadow,ground};
  },{seed,before});
  const prefix=`${before?'before':'after'}-${width}-${seed}`;
  writeFileSync(`${out}/${prefix}-game.png`,Buffer.from(captures.game.split(',')[1],'base64'));
  const frames=captures.terrain.map(c=>{const name=`${prefix}-t${c.time}.png`;writeFileSync(`${out}/${name}`,Buffer.from(c.image.split(',')[1],'base64'));return {...c,name};});
  cards.push({prefix,width,height,seed,before,...captures,terrain:frames});await page.close();
 }
 const image=(data,alt)=>`<img src="${data}" alt="${alt}">`;
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subtle meadow cloud shadows</title><style>body{font:17px/1.5 system-ui;background:#edf2ee;color:#233c36;margin:24px}h1{font-size:26px}section{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}figure{margin:0 0 22px}img{max-width:100%;height:auto;image-rendering:pixelated;display:block}figcaption{margin:6px 0}button{font:inherit;padding:8px 14px;margin:6px}</style><h1>Subtle shadows from clouds overhead</h1><p>Faint broad patches drift across the middle meadow at 1.8 native pixels per second. Their clouds are outside the view. Existing sky clouds, mountains, bushes, flowers and foreground grass remain unchanged. <a href="artwork-credits-20260909.html">Artwork credits</a></p><p>Two nearby green tones give a soft edge without blur or outlines. Compare the middle meadow just below the mountains.</p><section>${cards.map(c=>`<figure><figcaption>${c.before?'Before':'With shadows'} - ${c.width}x${c.height} - seed ${c.seed}</figcaption>${image(c.game,c.prefix)}</figure>`).join('')}</section><h2>Slow drift: 0 / 18 / 36 seconds</h2><p>Use the buttons to compare the same scene over time. This is a scenery study, not a gameplay demo.</p>${cards.filter(c=>!c.before).map((c,i)=>`<figure><figcaption>${c.width}x${c.height} - seed ${c.seed}</figcaption>${c.terrain.map((f,j)=>`<button onclick="document.getElementById('time-${i}').src=this.dataset.image" data-image="${f.image}">${f.time}s</button>`).join('')}<img id="time-${i}" src="${c.terrain[0].image}" alt="Shadow drift comparison"></figure>`).join('')}</html>`;
 writeFileSync(`${out}/meadow-shadow-review-20260910.html`,html);
 writeFileSync(`${out}/manifest.json`,JSON.stringify(cards.map(({prefix,width,height,seed,before,meadow,ground})=>({prefix,width,height,seed,before,meadow,ground})),null,2));console.log(JSON.stringify({out,gameImages:cards.length,terrainImages:cards.length*3}));
}finally{await browser?.close();server.kill();}
