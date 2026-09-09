import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT),{chromium}=require('playwright');
const dest='apps/bird-minigame/assets/native';mkdirSync(dest+'/flowers',{recursive:true});mkdirSync(dest+'/leaves',{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5199'],{windowsHide:true,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5199/apps/web/')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:5199/apps/bird-minigame/');
 const result=await page.evaluate(async()=>{
  const {loadSprites}=await import('/apps/bird-minigame/src/sprite-assets.js'),{flowerVariant}=await import('/apps/bird-minigame/src/flower-variants.js');
  const {VISUAL_TUNING}=await import('/apps/bird-minigame/src/visual-tuning.js'),headScale=VISUAL_TUNING.flowerHeadScale;
  const sprites=await loadSprites({nativeBirds:false,nativeFlowers:false}),layout=sprites.layout.flower,files={},heads=[],leaves={};
  const exportImage=(source,sx,sy,sw,sh,w,h,name)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(source,sx,sy,sw,sh,0,0,w,h);files[name]=c.toDataURL().split(',')[1];return {file:name,width:w,height:h};};
  for(let i=0;i<sprites.flowerVariants.length;i++){
   const variant=flowerVariant(layout,i),scale=variant.scale;
   heads.push(sprites.flowerVariants[i].map((source,j)=>exportImage(source,0,0,source.width,layout.headSourceHeight,Math.round(Math.round(source.width*scale)*headScale),Math.round(Math.round(layout.headSourceHeight*scale)*headScale),`flowers/${i}-${j}.png`)));
   const source=sprites.isolatedLeaves[i];
   for(const size of [.75,.8,.85,.9,1,1.1,1.15,1.2,1.25,1.4,1.45,1.55,1.6,1.65]){
    const scale=layout.leafScale*size,key=i+':'+scale.toFixed(6);
    leaves[key]={...exportImage(source,0,0,source.width,source.height,Math.round(source.width*scale),Math.round(source.height*scale),`leaves/${i}-${size}.png`),anchor:layout.isolatedLeaf.anchor.map(v=>Math.round(v*scale))};
   }
  }
  return {files,manifest:{version:1,headDisplayScale:headScale,heads,leaves}};
 });
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const [name,b64] of Object.entries(result.files))writeFileSync(dest+'/'+name,Buffer.from(b64,'base64'));
 for(const entry of [...result.manifest.heads.flat(),...Object.values(result.manifest.leaves)])entry.sha256=hash(readFileSync(dest+'/'+entry.file));
 writeFileSync(dest+'/flowers.json',JSON.stringify(result.manifest,null,2));console.log('Baked native flower heads/leaves:',Object.keys(result.files).length);
}finally{await browser?.close();server.kill();}
