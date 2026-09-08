import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {BIRD_SPECIES} from '../src/bird-species.js';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../tmp/all-birds-20260906/',import.meta.url);await mkdir(out,{recursive:true});
const catalogue=JSON.parse(await readFile(new URL('../rules/all-bird-sprites.json',import.meta.url)));
assert.equal(catalogue.species.length,14);
for(const b of catalogue.species){
 assert.equal(createHash('sha256').update(await readFile(new URL('../src/'+b.file,import.meta.url))).digest('hex'),b.sourceSha256);
 for(const p of b.poses){const [l,t,r,d]=p.foregroundBounds;assert.ok(l>0&&t>0&&r<p.rect[2]&&d<p.rect[3]);}
}
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4195'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:480,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4195/');await page.evaluate(()=>birdGame.ready);
 for(let p=0;p<4;p++){
  const visible=page.locator('[data-game-bird]:visible');assert.equal(await visible.count(),4);
  for(let n=0;n<4;n++){await visible.nth(n).click();assert.equal(await page.evaluate(()=>birdGame.getBirdSpecies()),BIRD_SPECIES[p*4+n].id);}
  await page.screenshot({path:fileURLToPath(new URL('picker-'+p+'.png',out))});
  if(p<3)await page.locator('[data-bird-next]').click();
 }
 const review=await page.evaluate(async()=>{
  const {loadSprites}=await import('/src/sprite-assets.js'),{BIRD_SPECIES}=await import('/src/bird-species.js');
  const sprites=await loadSprites(),c=document.createElement('canvas');c.width=800;c.height=16*164;
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#91d5db';ctx.fillRect(0,0,c.width,c.height);
  const sizes=[];
  BIRD_SPECIES.forEach((b,row)=>{const s=sprites.birds[b.id];ctx.fillStyle='#20243a';ctx.font='14px sans-serif';ctx.fillText(b.name+' · '+b.id,8,row*164+17);
   const widths=[];Array.from({length:4},(_,p)=>s.frames[p===3?s.layout.settledPose:p]).forEach((f,p)=>{const a=f.image.getContext('2d').getImageData(0,0,f.image.width,f.image.height).data;let l=f.image.width,t=f.image.height,r=0,d=0;
    for(let y=0;y<f.image.height;y++)for(let x=0;x<f.image.width;x++)if(a[(y*f.image.width+x)*4+3]>128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);d=Math.max(d,y);}
    const scale=s.layout.scale,w=Math.round((r-l+1)*scale),h=Math.round((d-t+1)*scale);widths.push(w);
    if(w<40||w>185||h>130)throw Error('Unexpected sprite dimensions '+b.id+' '+p+' '+w+'x'+h);
    ctx.drawImage(f.image,l,t,r-l+1,d-t+1,p*200+Math.round((200-w)/2),row*164+28+Math.round((128-h)/2),w,h);
   });sizes.push({id:b.id,widths});
  });return {png:c.toDataURL().split(',')[1],sizes};
 });
 await writeFile(new URL('all-birds-atlas.png',out),Buffer.from(review.png,'base64'));delete review.png;
 for(const viewport of [{width:280,height:640},{width:390,height:844},{width:640,height:360}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>birdGame.reset());await page.waitForTimeout(100);
  const layout=await page.evaluate(()=>{const p=document.querySelector('.bird-picker').getBoundingClientRect(),b=document.querySelector('[data-game-primary]').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,overlap:!(b.bottom<=p.top||p.bottom<=b.top||b.right<=p.left||p.right<=b.left)};});
  assert.equal(layout.overflow,false);assert.equal(layout.overlap,false,JSON.stringify(viewport));
 }
 const random=await page.evaluate(async()=>{
  birdGame.destroy();const {mountBirdGame}=await import('/src/embed.js');let draws=0;
  window.birdGame=mountBirdGame(document.querySelector('main')??document.body,{random:()=>((draws++%16)+.5)/16,muted:true});await birdGame.ready;
  const hidden=document.querySelector('.bird-picker').hidden,ids=[];
  for(let i=0;i<16;i++){birdGame.start();ids.push(birdGame.getBirdSpecies());birdGame.pause();birdGame.resume();birdGame.activate();if(draws!==i+1)throw Error('Rerolled mid-round');birdGame.exit();}
  let locked=false;try{birdGame.setBirdSpecies('yellow_tit')}catch{locked=true;}
  return {hidden,ids,draws,locked,mode:birdGame.getSpeciesSelection()};
 });
 assert.deepEqual(random.ids,BIRD_SPECIES.map(b=>b.id));assert.equal(random.draws,16);assert.ok(random.hidden&&random.locked);assert.equal(random.mode,'random');assert.deepEqual(errors,[]);
 await writeFile(new URL('verification.json',out),JSON.stringify({...review,random,errors},null,2));console.log(JSON.stringify({species:16,poses:64,pickerPages:4,randomDraws:random.draws,errors}));
}finally{await browser?.close();server.kill();}
