import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT),{chromium}=require('playwright');
const out='apps/bird-minigame/tmp/pixel-audit-20260910';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5198'],{windowsHide:true,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5198/apps/web/')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.5});
 await page.goto('http://127.0.0.1:5198/apps/bird-minigame/');
 const result=await page.evaluate(async()=>{
  const root='/apps/bird-minigame/';
  const [{loadReviewedScenery,paintReviewedScenery,prepareReviewedFlowers,paintReviewedFlower,flattenCloudPixels},{loadSprites,paintBird},{createClearing,paintClearing},{prepareNativeScenery},{VISUAL_TUNING},{createGameState}]=await Promise.all(['reviewed-scenery','sprite-assets','clearing-scenery','native-scenery','visual-tuning','game-core'].map(n=>import(root+'src/'+n+'.js')));
  const assets=await loadReviewedScenery(),sprites=prepareReviewedFlowers(await loadSprites()),scene=createClearing(9),state=createGameState({columns:6});
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').imageSmoothingEnabled=false;return c;};
  const data=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  const load=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
  const sheet=await load(root+'assets/scenery/clouds-review.png');
  const rects=[[20,160,515,240],[580,110,380,290],[1040,10,450,390],[35,555,485,275],[590,535,475,295],[1130,655,370,180]];
  const files={},metrics={clouds:[],birds:[]};
  function exportImage(name,c){files[name]=c.toDataURL().split(',')[1];}
  function panel(w,h,title,subtitle){const c=canvas(w,h),cx=c.getContext('2d');cx.fillStyle='#172234';cx.fillRect(0,0,w,h);cx.fillStyle='#ffffff';cx.font='bold 24px sans-serif';cx.fillText(title,24,34);cx.font='16px sans-serif';cx.fillStyle='#cad5de';cx.fillText(subtitle,24,61);return c;}
  function label(cx,text,x,y){cx.fillStyle='#ffffff';cx.font='16px sans-serif';cx.fillText(text,x,y);}
  function imageBox(cx,im,x,y,z=2){cx.fillStyle='#334656';cx.fillRect(x,y,im.width*z,im.height*z);cx.drawImage(im,x,y,im.width*z,im.height*z);}
  function matte(im){
   const c=canvas(im.width,im.height),cx=c.getContext('2d');cx.drawImage(im,0,0);const f=cx.getImageData(0,0,c.width,c.height),d=f.data,seen=new Uint8Array(c.width*c.height),q=[];
   const add=i=>{if(i<0||i>=seen.length||seen[i])return;seen[i]=1;const j=i*4;
    if(d[j+2]-d[j+1]<=20&&d[j+1]-d[j]>=24){d[j+3]=0;q.push(i);}};
   for(let x=0;x<c.width;x++){add(x);add((c.height-1)*c.width+x);}for(let y=0;y<c.height;y++){add(y*c.width);add(y*c.width+c.width-1);}
   for(let n=0;n<q.length;n++){const i=q[n],x=i%c.width;if(x)add(i-1);if(x<c.width-1)add(i+1);add(i-c.width);add(i+c.width);}
   cx.putImageData(f,0,0);return c;
  }
  const cloudReview=panel(1300,1200,'Cloud diagnosis | same source, dimensions, palette and preparation','Left: installed matte. Right: source-specific sky matte trial. Only transparency extraction differs.');
  const cc=cloudReview.getContext('2d');
  for(let i=0;i<6;i++){
   const r=rects[i],raw=canvas(r[2],r[3]);raw.getContext('2d').drawImage(sheet,...r,0,0,r[2],r[3]);
   const revised=matte(raw),rf=revised.getContext('2d').getImageData(0,0,r[2],r[3]);flattenCloudPixels(rf.data);revised.getContext('2d').putImageData(rf,0,0);
   const targetW=250,targetH=Math.round(r[3]*250/r[2]);
   const old=prepareNativeScenery(assets.clouds[i],targetW,targetH,VISUAL_TUNING.cloudTones,1.25),next=prepareNativeScenery(revised,targetW,targetH,VISUAL_TUNING.cloudTones,1.25);
   const a=data(old),b=data(next);let restored=0,removed=0;for(let j=0;j<a.length;j+=4){if(a[j+3]===0&&b[j+3]===255)restored++;if(a[j+3]===255&&b[j+3]===0)removed++;}
   metrics.clouds.push({shape:i,restoredNativePixels:restored,removedNativePixels:removed});
   const row=Math.floor(i/2),col=i%2,x=24+col*644,y=110+row*350;
   label(cc,'Cloud '+String.fromCharCode(65+i)+' — installed',x,y-10);label(cc,'Matte trial',x+308,y-10);
   imageBox(cc,old,x,y,1);imageBox(cc,next,x+308,y,1);
   exportImage('cloud-'+i+'-installed.png',old);exportImage('cloud-'+i+'-matte.png',next);
   if(i===0){const proof=canvas(250, targetH);const pd=proof.getContext('2d').createImageData(250,targetH);for(let j=0;j<a.length;j+=4){if(b[j+3])pd.data.set(a[j+3]?[218,233,235,255]:[255,78,142,255],j);}proof.getContext('2d').putImageData(pd,0,0);exportImage('cloud-mask-difference.png',proof);}
  }
  exportImage('cloud-matte-review.png',cloudReview);
  // Compare unchanged production sprites against one-pass source sampling. This
  // is an experiment, not a claim that nearest-neighbour alone finishes artwork.
  const catalogue=await(await fetch(root+'rules/all-bird-sprites.json')).json();
  const birdReview=panel(1120,790,'Bird sampling | same pose and final size','Left: installed two-stage resize. Right: one direct source resize. No palette or contour cleanup.');
  const bc=birdReview.getContext('2d');
  for(const [index,id] of ['taiwan_barwing','mikado_pheasant','taiwan_barbet'].entries()){
   const entry=catalogue.species.find(b=>b.speciesId===id),orig=await load(new URL(entry.file,location.origin+root+'rules/all-bird-sprites.json').href),p=entry.poses[0];
   const old=canvas(210,185),next=canvas(210,185),selected=sprites.birds[id],s={...state,phase:'running',bird:{...state.bird,x:.6,y:.55}};
   paintBird(old.getContext('2d'),{...sprites,bird:selected.frames,layout:{...sprites.layout,bird:selected.layout}},s,210,185,0);
   const {exteriorMatte}=await import(root+'src/sprite-assets.js');
   const raw=canvas(p.rect[2],p.rect[3]),rc=raw.getContext('2d');rc.drawImage(orig,...p.rect,0,0,raw.width,raw.height);const rd=rc.getImageData(0,0,raw.width,raw.height);exteriorMatte(rd.data,raw.width,raw.height);rc.putImageData(rd,0,0);
   const sc=entry.scale*VISUAL_TUNING.birdScale,nc=next.getContext('2d');nc.drawImage(raw,126-Math.round(p.anchor[0]*sc),102-Math.round(p.anchor[1]*sc),Math.round(raw.width*sc),Math.round(raw.height*sc));
   const y=105+index*220;label(bc,id,24,y-12);imageBox(bc,old,24,y,1);imageBox(bc,next,300,y,1);
   // Zoom the same head region, retaining exactly square 3x review pixels.
   bc.drawImage(old,108,78,68,50,600,y+20,204,150);bc.drawImage(next,108,78,68,50,870,y+20,204,150);
  }
  exportImage('bird-sampling-review.png',birdReview);
  const alphaReview=panel(1380,1880,'Bird transparency audit | installed extraction','Left: source reference. Middle: extracted bird on dark. Right: same bird on pink. All previews use integer zoom.');
  const ac=alphaReview.getContext('2d'),layouts={taiwan_blue_magpie:sprites.layout.bird,yellow_tit:(await(await fetch(root+'rules/yellow-tit-sprite.json')).json())};
  const {exteriorMatte}=await import(root+'src/sprite-assets.js');
  for(const [index,id] of ['taiwan_blue_magpie','yellow_tit','white_eared_sibia','taiwan_barwing','mikado_pheasant'].entries()){
   const entry=layouts[id]??catalogue.species.find(b=>b.speciesId===id),url=id==='taiwan_blue_magpie'?root+'assets/candidates/shape-preserving-20260905/'+entry.file:new URL(entry.file,location.origin+root+'rules/all-bird-sprites.json').href;
   const source=await load(url),p=entry.poses[0],raw=canvas(p.rect[2],p.rect[3]);raw.getContext('2d').drawImage(source,...p.rect,0,0,raw.width,raw.height);
   const extracted=canvas(raw.width,raw.height),ec=extracted.getContext('2d');ec.drawImage(raw,0,0);const ef=ec.getImageData(0,0,raw.width,raw.height);exteriorMatte(ef.data,raw.width,raw.height);ec.putImageData(ef,0,0);
   const scale=entry.scale*1.3,w=Math.round(raw.width*scale),h=Math.round(raw.height*scale),y=110+index*350;
   const smallRaw=canvas(w,h),smallExtracted=canvas(w,h);smallRaw.getContext('2d').drawImage(raw,0,0,w,h);smallExtracted.getContext('2d').drawImage(extracted,0,0,w,h);
   // Show one source sampling for both so the comparison isolates alpha only.
   label(ac,id,24,y-13);
   for(const [x,background,image] of [[24,'#ffffff',smallRaw],[474,'#243141',smallExtracted],[924,'#ba4569',smallExtracted]]){
    ac.fillStyle=background;ac.fillRect(x,y,420,320);ac.drawImage(image,x,y,w*2,h*2);
   }
  }
  exportImage('bird-transparency-review.png',alphaReview);
  // Scan every shipped pose on three contrasting backgrounds. This is diagnostic
  // evidence, not automatic approval of every retained or removed white pixel.
  let atlasIndex=0;const entries=Object.entries(sprites.birds);
  for(let batch=0;batch<4;batch++){
   const atlas=panel(1360,1020,'All bird alpha inspection — batch '+(batch+1),'Four poses per species. Alternating dark/pink backgrounds expose lost whites, halos and trapped backdrop.');
   const ax=atlas.getContext('2d');
   for(let row=0;row<4;row++){
    const [id,entry]=entries[atlasIndex++];label(ax,id,24,105+row*225);
    for(let pose=0;pose<entry.frames.length;pose++){
     const c=canvas(210,190),cx=c.getContext('2d');cx.fillStyle=pose%2?'#ba4569':'#243141';cx.fillRect(0,0,210,190);
     paintBird(cx,{...sprites,bird:entry.frames,layout:{...sprites.layout,bird:entry.layout}},{...state,phase:'running',bird:{...state.bird,x:.6,y:.5}},210,190,pose);
     ax.drawImage(c,24+pose*330,120+row*225);
    }
   }
   exportImage('bird-alpha-atlas-'+batch+'.png',atlas);
  }
  // Code-native foliage study. Keep footprint and palette; sample the contour
  // at each native x instead of magnifying a coarse profile's square cells.
  const {BUSH_PROFILES,CLEARING_PALETTES}=await import(root+'src/clearing-scenery.js');
  const {paintLandingGrass}=await import(root+'src/reviewed-scenery.js');
  const foliage=panel(1260,940,'Foliage | same footprint, one native drawing unit','Left: installed. Right: review trial. Large plants keep their size; contour steps and blade strokes use one pixel.');
  const fc=foliage.getContext('2d'),sampleScene={...scene,palette:1,bushes:[0,1,2,3,4].map((shape,i)=>({shape,x:(i+.5)/5,depth:0,unit:i%2?3:2,flip:false}))};
  const oldBush=canvas(300,90),newBush=canvas(300,90);paintClearing(oldBush.getContext('2d'),sampleScene,300,160);
  const nb=newBush.getContext('2d'),pal=CLEARING_PALETTES[1];nb.fillStyle=pal.meadow;nb.fillRect(0,0,300,90);
  // Give both strips the same field fill, excluding the unrelated meadow skyline.
  const ob=oldBush.getContext('2d');ob.globalCompositeOperation='destination-over';ob.fillStyle=pal.meadow;ob.fillRect(0,0,300,90);ob.globalCompositeOperation='source-over';
  for(const b of sampleScene.bushes){const p=BUSH_PROFILES[b.shape],w=p.length*b.unit,x0=Math.round(b.x*300-w/2),base=62;
   for(let x=0;x<w;x++){const t=x/b.unit,k=Math.floor(t),f=t-k,s=f*f*(3-2*f),height=Math.round((p[k]+((p[Math.min(p.length-1,k+1)]??p[k])-p[k])*s)*b.unit),y=base-height;
    nb.fillStyle=pal.bush[0];nb.fillRect(x0+x,y,1,height);
    nb.fillStyle=pal.bush[1];nb.fillRect(x0+x,y,1,Math.max(1,height-2*b.unit));
    if(k>1&&k<p.length-3&&height>=5*b.unit){nb.fillStyle=pal.bush[2];nb.fillRect(x0+x,y,1,2*b.unit);}
   }
  }
  label(fc,'Bushes — installed coarse cells',24,100);label(fc,'Bushes — contour sampled at 1x',654,100);
  imageBox(fc,oldBush,24,115,2);imageBox(fc,newBush,654,115,2);
  const oldGrass=canvas(300,155),newGrass=canvas(300,155);paintLandingGrass(oldGrass.getContext('2d'),300,155,60);
  // Retain the exact connected fringe. Only the repeated lower tufts differ.
  const ng=newGrass.getContext('2d');ng.drawImage(oldGrass,0,0);const g=VISUAL_TUNING.grass;ng.fillStyle=g.base;ng.fillRect(0,45,300,110);
  for(let row=0,y=47;y<160;row++,y+=g.rowHeight)for(let col=0;col<Math.ceil(300/g.spacing)+1;col++){
   const seed=(col*73+row*151+col*row*19)%101,x=col*g.spacing+(row%2?13:0)+(seed%13)-6,base=y+(seed%7),length=base>90?9:5,spread=base>90?5:3;
   ng.fillStyle=g.shadow;ng.fillRect(x-spread,base,spread*2,1);
   for(const direction of [-1,0,1]){ng.fillStyle=direction?g.shadow:g.light;const h=length-(direction?2:0);
    for(let py=0;py<h;py++){const bend=Math.round(direction*spread*py/h);ng.fillRect(x+bend,base-py,1,1);}
   }
  }
  label(fc,'Grass — blade units double near the viewer',24,360);label(fc,'Grass — longer blades, same stroke unit',654,360);
  imageBox(fc,oldGrass,24,375,2);imageBox(fc,newGrass,654,375,2);
  label(fc,'Native crops at 4x: the shared framebuffer alone cannot repair enlarged source blocks.',24,740);
  fc.drawImage(oldBush,130,30,50,40,24,765,200,160);fc.drawImage(newBush,130,30,50,40,270,765,200,160);
  fc.drawImage(oldGrass,110,100,50,40,654,765,200,160);fc.drawImage(newGrass,110,100,50,40,900,765,200,160);
  exportImage('foliage-grid-review.png',foliage);
  for(const [id,entry] of Object.entries(sprites.birds)){
   let highest=0,lowest=0;
   for(const frame of new Set(entry.layout.cycle)){
    const im=entry.frames[frame].image,d=data(im),scale=entry.layout.scale*VISUAL_TUNING.birdScale;
    let top=im.height,bottom=0;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(d[(y*im.width+x)*4+3]>127){top=Math.min(top,y);bottom=Math.max(bottom,y);}
    highest=Math.max(highest,Math.round((entry.frames[frame].anchor[1]-top)*scale));lowest=Math.max(lowest,Math.round((bottom-entry.frames[frame].anchor[1])*scale));
   }
   metrics.birds.push({id,aboveAnchor:highest,belowAnchor:lowest});
  }
  function landscape(anchorY){const c=canvas(640,400),cx=c.getContext('2d'),top=148,h=252,ground=top+Math.round(.9*h);
   paintReviewedScenery(cx,assets,640,400,ground,0,true,scene);
   cx.save();cx.translate(0,top);for(const flower of state.flowers)paintReviewedFlower(cx,sprites,flower,640,h,ground-top);cx.restore();
   const selected=sprites.birds.yellow_tit;paintBird(cx,{...sprites,bird:selected.frames,layout:{...sprites.layout,bird:selected.layout}},{...state,bird:{...state.bird,y:anchorY/400}},640,400,2);
   return c;}
  const installedY=148+.14*(400-148),proposedY=132;
  const landscapeReview=panel(1312,960,'Landscape starting height | isolated composition study','Installed anchor: 183 / 400. Trial anchor: 132 / 400. All flowers, ground and scenery stay fixed.');
  const lc=landscapeReview.getContext('2d');label(lc,'Installed',16,90);label(lc,'Higher start — review only',672,90);lc.drawImage(landscape(installedY),16,110);lc.drawImage(landscape(proposedY),672,110);
  for(const [x,y,labelText] of [[16,installedY,'46% of screen'],[672,proposedY,'33% of screen']]){lc.strokeStyle='#ff7897';lc.beginPath();lc.moveTo(x,110+y);lc.lineTo(x+640,110+y);lc.stroke();label(lc,labelText,x+420,100+y);}
  label(lc,'Important: this isolates height; it is not a proposed final HUD layout.',24,550);
  label(lc,'Large wing poses need a separate clearance check before the higher start can ship.',24,580);
  // Include native closeups to expose the two procedural grid sizes and sprite detail.
  const native=landscape(installedY);
  const crops=[[0,252,100,72,'Bush contour: 2/3-pixel blocks'],[5,335,100,60,'Grass: 1/2-pixel blade units'],[122,236,100,90,'Flower: fine outline + sampled head']];
  for(const [i,[x,y,w,h,title]] of crops.entries()){label(lc,title,24+i*430,640);lc.drawImage(native,x,y,w,h,24+i*430,660,w*3,h*3);}
  exportImage('landscape-and-pixel-review.png',landscapeReview);
  metrics.landscape={virtualHeight:400,topOffset:148,gameplayHeight:252,currentAnchor:installedY,trialAnchor:proposedY,portraitUnchanged:true};
  return {files,metrics};
 });
 for(const [name,b64] of Object.entries(result.files))writeFileSync(out+'/'+name,Buffer.from(b64,'base64'));
 const hashes={};for(const name of Object.keys(result.files))hashes[name]=createHash('sha256').update(readFileSync(out+'/'+name)).digest('hex');
 writeFileSync(out+'/audit.json',JSON.stringify({...result.metrics,hashes},null,2));console.log(JSON.stringify(result.metrics,null,2));
}finally{await browser?.close();server.kill();}
