import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url),{chromium}=require('playwright');
// Keep the original pre-approval screenshots intact. This compares the shipped
// implementation with the frozen A/B painters rather than recreating the old UI.
const out='apps/bird-minigame/tmp/arcade-hud-implementation';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5199'],{windowsHide:true,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5199/apps/web/garden.html')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const original=readFileSync('apps/bird-minigame/src/bird-renderer.js','utf8');
 const liveHud='paintGameUi(ctx,state,layout,ui,thumbnails);screen.present();';
 assert.ok(original.includes(liveHud),'live framebuffer HUD hook must match');
 const records=[];
 for(const [width,height] of [[1280,800],[360,800]])for(const style of ['current','sprites','tiles']) {
  const page=await browser.newPage({viewport:{width,height}});
  await page.route('**/research/arcade-hud-proposal.mjs',route=>route.fulfill({contentType:'text/javascript',body:readFileSync('apps/bird-minigame/research/arcade-hud-proposal.mjs','utf8')}));
  if(style!=='current')await page.route('**/src/bird-renderer.js',route=>route.fulfill({contentType:'text/javascript',body:
   "import {paintArcadeHud} from '../research/arcade-hud-proposal.mjs';\n"+original.replaceAll(liveHud,`paintArcadeHud(ctx,state,screen.frame.width,{framed:${style==='tiles'}});screen.present();`)}));
  await page.goto('http://127.0.0.1:5199/apps/web/garden.html');
  await page.evaluate(async({style})=>{
   const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
   const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
   document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="scene"></canvas></div>';
   const renderer=createBirdRenderer(document.querySelector('#scene'),{species:'yellow_tit'});await renderer.ready;renderer.setScenerySeed(9);
   const state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.28;state.time=18;
   state.ammo=2;state.refillElapsed=3;state.cameraSignal={visible:true,state:'live',level:.6};
   renderer.render(state);
  },{style});
  const name=`${style}-${width}`;await page.screenshot({path:`${out}/${name}.png`});
  if(width===1280)await page.screenshot({path:`${out}/${style}-strip.png`,clip:{x:0,y:0,width,height:96}});
  records.push({style,width,height,name});await page.close();
 }
 // Compare actual final frame pixels, excluding only the old/new HUD strip.
 const check=await browser.newPage();
 await check.goto('http://127.0.0.1:5199/apps/web/garden.html');
 const comparisons=await check.evaluate(async()=>{
  const load=async file=>{const im=new Image();im.src='/apps/bird-minigame/tmp/arcade-hud-implementation/'+file;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height);};
  const result=[];
  for(const width of [1280,360]) {
   const a=await load(`current-${width}.png`);
   for(const style of ['sprites','tiles']) {
    const b=await load(`${style}-${width}.png`);let changed=0;
    const limit=style==='sprites'?0:width===1280?96:48;
    for(let y=limit;y<a.height;y++)for(let x=0;x<a.width;x++){const p=(y*a.width+x)*4;if(a.data[p]!==b.data[p]||a.data[p+1]!==b.data[p+1]||a.data[p+2]!==b.data[p+2]||a.data[p+3]!==b.data[p+3])changed++;}
    result.push({width,style,region:style==='sprites'?'entire approved A scene':'outside HUD',protectedPixelsChanged:changed});
   }
  }
  return result;
 });
 assert.ok(comparisons.every(r=>r.protectedPixelsChanged===0),'art outside HUD must remain identical');
 writeFileSync(`${out}/review.json`,JSON.stringify({implementationMatchesApprovedA:true,comparisons,records},null,2));
 const html=`<!doctype html><meta charset="utf-8"><title>Arcade HUD implementation</title><style>body{font:18px system-ui;margin:24px;background:#eaf1ef}img{display:block;max-width:100%;image-rendering:pixelated}figure{margin:0 0 24px}</style><h1>Approved A and live implementation</h1><p>The complete live scene matches the frozen A painter pixel for pixel in both orientations. Original pre-approval images remain in arcade-hud-review.</p>${records.map(r=>`<figure><figcaption>${r.style} · ${r.width} × ${r.height}</figcaption><img src="${r.name}.png" width="${r.width===1280?960:360}"></figure>`).join('')}`;
 writeFileSync(`${out}/review.html`,html);
 console.log(JSON.stringify({out,comparisons}));
} finally {await browser?.close();server.kill();}
