import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL(process.env.BIRD_LEAF_REVIEW_DIR||'../tmp/leaf-fix-20260907/',import.meta.url);await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4193'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4193/');await page.evaluate(()=>birdGame.ready);
 const report=await page.evaluate(async()=>{
  const {loadSprites,paintFlower}=await import('/src/sprite-assets.js'),{prepareReviewedFlowers,paintReviewedFlower}=await import('/src/reviewed-scenery.js');
  const {flowerVariant}=await import('/src/flower-variants.js'),sprites=prepareReviewedFlowers(await loadSprites());
  const canvas=()=>{const c=document.createElement('canvas');c.width=120;c.height=640;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return[c,x];};
  let changedStemPixels=0,visibleLeafPixels=0,cases=0;const preview=document.createElement('canvas');preview.width=480;preview.height=640;const px=preview.getContext('2d');px.imageSmoothingEnabled=false;px.fillStyle='#91d5db';px.fillRect(0,0,480,640);
  for(let id=0;id<4;id++)for(const height of [55,99,130,333,450])for(const expression of [0,1,2,3]){
   const f={id,x:.5,displayHeight:height/640,reaction:expression?1:0,hits:expression,blocked:0},[a,ax]=canvas(),[b,bx]=canvas();
   paintFlower(ax,sprites,f,120,640,628);paintReviewedFlower(bx,sprites,f,120,640,628);
   const before=ax.getImageData(0,0,120,640).data,after=bx.getImageData(0,0,120,640).data,variant=flowerVariant(sprites.layout.flower,id);
   for(let p=3;p<after.length;p+=4)if(after[p]>128&&before[p]===0)visibleLeafPixels++;
   const top=Math.round(628-height),headH=Math.round(sprites.layout.flower.headSourceHeight*variant.scale),start=top+Math.round(headH*.43),length=628-start;
   const belowHead=top-Math.round(headH*.55)+headH;
   for(let y=belowHead+1;y<=628;y++){const center=60+Math.round(Math.sin((y-start)/Math.max(1,length)*Math.PI*2)*variant.curvePixels),r=variant.stemHalfWidth;
    for(let x=center-r;x<=center+r;x++){const i=(y*120+x)*4;if(before.subarray(i,i+4).some((v,j)=>v!==after[i+j]))changedStemPixels++;}}
   if(height===333&&expression===0)px.drawImage(b,id*120,0);cases++;
  }
  return {changedStemPixels,visibleLeafPixels,cases,png:preview.toDataURL().split(',')[1]};
 });
 const name=process.argv.includes('--diagnose')?'before':'after';await writeFile(new URL(name+'.png',out),Buffer.from(report.png,'base64'));delete report.png;
 await writeFile(new URL(name+'.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.equal(report.changedStemPixels,0,'Leaf variation must never replace any pixel of the independent curved stem');
 assert.ok(report.visibleLeafPixels>1000,'Continuity must not be achieved by deleting the leaves');
}finally{await browser?.close();server.kill();}
