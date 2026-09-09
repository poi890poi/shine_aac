import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT),{chromium}=require('playwright');
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5198'],{windowsHide:true,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5198/apps/web/')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true,args:process.argv.includes('--software')?['--disable-accelerated-2d-canvas']:[]});const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.5});page.on('console',m=>console.log(m.text()));await page.goto('http://127.0.0.1:5198/apps/bird-minigame/');
 const result=await page.evaluate(async()=>{
  const root='/apps/bird-minigame/',{exteriorMatte,loadSprites,paintBird,paintFlower}=await import(root+'src/sprite-assets.js');
  const {loadReviewedScenery,prepareReviewedCloud}=await import(root+'src/reviewed-scenery.js'),{prepareNativeScenery}=await import(root+'src/native-scenery.js'),{VISUAL_TUNING}=await import(root+'src/visual-tuning.js');
  const json=async path=>(await fetch(root+path)).json(),manifest=await json('assets/native/manifest.json'),rule=await json('rules/native-alpha.json');
  const image=async path=>{const im=new Image();im.src=root+path;await im.decode();return im;};
  const raster=(im,rect=[0,0,im.width,im.height])=>{const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];const x=c.getContext('2d');x.drawImage(im,...rect,0,0,c.width,c.height);return x.getImageData(0,0,c.width,c.height).data;};
  let changedAlpha=0,preservedWhite=0,poses=0,nativeErrors=0,maskErrors=0;const birds=[];
  for(const [id,bird] of Object.entries(manifest.birds)){
   const source=await image(bird.sourceFile);let changes=0,white=0;
   for(let p=0;p<bird.poses.length;p++){
    const pose=bird.poses[p],[,,w,h]=pose.sourceRect,raw=raster(source,pose.sourceRect),old=exteriorMatte(raw.slice(),w,h);
    const mask=raster(await image(`assets/native/masks/${id}-${p}.png`));const seeds=rule.birds[id]?.backgroundSeeds?.[p]??[];
    const expected=seeds.reduce((sum,s)=>sum+s.expectedArea,0);let actual=0;
    for(let i=0;i<w*h;i++){
     const alpha=mask[i*4];if(alpha!==old[i*4+3]){actual++;if(alpha!==0||!seeds.some(s=>{const [x,y,bw,bh]=s.bounds;return i%w>=x&&i%w<x+bw&&Math.floor(i/w)>=y&&Math.floor(i/w)<y+bh;}))maskErrors++;}
     if(alpha===255&&raw[i*4]>220&&raw[i*4+1]>220&&raw[i*4+2]>220)white++;
    }
    if(actual!==expected)maskErrors++;for(const s of seeds)if(mask[(s.point[1]*w+s.point[0])*4]!==0)maskErrors++;
    const native=raster(await image('assets/native/'+pose.file));
    for(let y=0;y<pose.height;y++)for(let x=0;x<pose.width;x++){
     const sx=Math.min(w-1,Math.floor((x+.5)*w/pose.width)),sy=Math.min(h-1,Math.floor((y+.5)*h/pose.height)),si=(sy*w+sx)*4,ni=(y*pose.width+x)*4;
     if(native[ni+3]!==mask[si])nativeErrors++;
     if(native[ni+3]&&[0,1,2].some(c=>native[ni+c]!==raw[si+c]))nativeErrors++;
    }
    poses++;changes+=actual;
   }
   changedAlpha+=changes;preservedWhite+=white;birds.push({id,changes,preservedWhite:white});
  }
  const scenery=await loadReviewedScenery(),cloudSheet=await image('assets/scenery/clouds-review.png');const cloudDifferences=[];
  for(let i=0;i<6;i++){
   const im=scenery.clouds[i],candidate=prepareReviewedCloud(im,250,Math.round(im.height*250/im.width)),approved=await image(`test/fixtures/approved-clouds/cloud-${i}-matte.png`);
   const a=raster(candidate),b=raster(approved);let changes=0;if(a.length!==b.length)changes=-1;else for(let p=0;p<a.length;p++)if(a[p]!==b[p])changes++;
   cloudDifferences.push(changes);if(changes){const points=[];for(let j=0;j<a.length;j+=4)if(a.subarray(j,j+4).some((v,k)=>v!==b[j+k])&&points.length<5)points.push({xy:[j/4%250,Math.floor(j/4/250)],a:[...a.subarray(j,j+4)],b:[...b.subarray(j,j+4)]});console.log(JSON.stringify({cloud:i,points}));}
  }
  const sprites=await loadSprites();let rescaled=0,draws=0;
  const ctx={fillStyle:'',fillRect(){},save(){},restore(){},translate(){},scale(){},drawImage(im,...args){draws++;if(args.length===4&&(args[2]!==im.width||args[3]!==im.height))rescaled++;if(args.length===8&&(args[6]!==args[2]||args[7]!==args[3]))rescaled++;}};
  for(const [id,bird] of Object.entries(sprites.birds))for(let p=0;p<bird.frames.length;p++)paintBird(ctx,{...sprites,bird:bird.frames,layout:{...sprites.layout,bird:bird.layout}},{phase:'running',bird:{x:.5,y:.14},direction:1},640,252,p);
  return {poses,changedAlpha,preservedWhite,maskErrors,nativeErrors,birds,cloudDifferences,birdNativeDraws:draws,rescaled};
 });
 mkdirSync('.tmp/native-art-assets',{recursive:true});writeFileSync('.tmp/native-art-assets/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 assert.equal(result.poses,63);assert.equal(result.maskErrors,0);assert.equal(result.nativeErrors,0);assert.ok(result.changedAlpha>0&&result.preservedWhite>10000);assert.ok(result.cloudDifferences.every(n=>n===0));assert.equal(result.rescaled,0);
}finally{await browser?.close();server.kill();}
