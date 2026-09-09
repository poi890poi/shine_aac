// Display preparation for the user-approved sheets. Background is an exterior
// matte, not a global white color key: enclosed eyes and feather tips stay white.
import {validateFlowerVariants,flowerVariant,recolorPetals,recolorLeaves} from './flower-variants.js';
import {BIRD_SPECIES} from './bird-species.js';
import {VISUAL_TUNING} from './visual-tuning.js';
export function exteriorMatte(data,width,height) {
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
  const add=i=>{if(i<0||i>=seen.length||seen[i])return;seen[i]=1;
    const j=i*4,r=data[j],g=data[j+1],b=data[j+2];
    if(Math.min(r,g,b)>165&&Math.max(r,g,b)-Math.min(r,g,b)<45){queue[tail++]=i;data[j+3]=0;}};
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
  while(head<tail){const i=queue[head++],x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);add(i-width);add(i+width);}
  return data;
}

async function load(name) {
  const img=new Image();img.src=new URL(`../assets/candidates/shape-preserving-20260905/${name}`,import.meta.url).href;
  await img.decode();return img;
}
function cut(image,rect) {
  const canvas=document.createElement('canvas');canvas.width=rect[2];canvas.height=rect[3];
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,...rect,0,0,canvas.width,canvas.height);
  const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
  exteriorMatte(frame.data,canvas.width,canvas.height);ctx.putImageData(frame,0,0);return canvas;
}
export async function loadSprites({nativeBirds=true,nativeFlowers=true}={}) {
  const response=await fetch(new URL('../rules/sprite-layout.json',import.meta.url));
  if(!response.ok)throw new Error('Cannot load sprite layout');const layout=await response.json();
  validateFlowerVariants(layout.flower);
  const [bird,flower]=await Promise.all([nativeBirds?null:load(layout.bird.file),load(layout.flower.file)]);
  const flowerFrames=layout.flower.expressions.map(rect=>cut(flower,rect));
  const flowerVariants=(layout.flower.variants??[{petalRamp:null}]).map(variant=>flowerFrames.map(source=>{
    if(!variant.petalRamp&&!variant.stemRamp)return source;
    const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
    const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
    recolorPetals(frame.data,canvas.width,layout.flower.headSourceHeight,variant.petalRamp);
    recolorLeaves(frame.data,canvas.width,layout.flower.headSourceHeight,variant.stemRamp);ctx.putImageData(frame,0,0);return canvas;
  }));
  const secondResponse=await fetch(new URL('../rules/yellow-tit-sprite.json',import.meta.url));
  if(!secondResponse.ok)throw new Error('Cannot load yellow-tit layout');const secondLayout=await secondResponse.json();
  let secondBird=[],magpie=[];
  if(!nativeBirds){
    const secondImage=new Image();secondImage.src=new URL(secondLayout.file,import.meta.url).href;await secondImage.decode();
    secondBird=secondLayout.poses.map(p=>({image:cut(secondImage,p.rect),anchor:p.anchor}));
    magpie=layout.bird.poses.map(p=>({image:cut(bird,p.rect),anchor:p.anchor}));
  }
  const catalogueResponse=await fetch(new URL('../rules/all-bird-sprites.json',import.meta.url));
  if(!catalogueResponse.ok)throw new Error('Cannot load complete bird catalogue');
  const catalogue=await catalogueResponse.json(),birds={taiwan_blue_magpie:{layout:layout.bird,frames:magpie},yellow_tit:{layout:secondLayout,frames:secondBird}};
  // Prepare the new species once at native size; do not retain 56 large source cells.
  // Existing magpie/yellow-tit sampling remains unchanged for exact comparisons.
  for(const sourceLayout of nativeBirds?[]:catalogue.species){
    if(birds[sourceLayout.speciesId]||!BIRD_SPECIES.some(b=>b.id===sourceLayout.speciesId)||sourceLayout.poses.length!==4)throw new Error('Invalid bird catalogue entry');
    const sheet=new Image();sheet.src=new URL(sourceLayout.file,import.meta.url).href;await sheet.decode();
    const frames=sourceLayout.poses.map(p=>{
      const source=cut(sheet,p.rect),image=document.createElement('canvas');
      image.width=Math.round(source.width*sourceLayout.scale);image.height=Math.round(source.height*sourceLayout.scale);
      const ctx=image.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,image.width,image.height);
      return {image,anchor:p.anchor.map(v=>Math.round(v*sourceLayout.scale))};
    });
    birds[sourceLayout.speciesId]={frames,layout:{...sourceLayout,sourceScale:sourceLayout.scale,scale:1,groundContactY:Math.round(sourceLayout.groundContactY*sourceLayout.scale)}};
  }
  if(nativeBirds){
    const response=await fetch(new URL('../assets/native/manifest.json',import.meta.url));
    if(!response.ok)throw new Error('Missing native artwork manifest');
    const manifest=await response.json();
    await Promise.all(Object.entries(manifest.birds).map(async([id,record])=>{
      const frames=await Promise.all(record.poses.map(async pose=>{
        const image=new Image();image.src=new URL('../assets/native/'+pose.file,import.meta.url);await image.decode();
        if(image.width!==pose.width||image.height!==pose.height)throw new Error('Native bird dimensions changed');
        return {image,anchor:pose.anchor};
      }));
      birds[id]={frames,layout:{...record,native:true}};
    }));
  }
  if(BIRD_SPECIES.some(b=>!birds[b.id]))throw new Error('Incomplete bird catalogue');
  const leaf=layout.flower.isolatedLeaf;
  const isolatedLeaves=leaf?flowerVariants.map(frames=>{
    const c=document.createElement('canvas');c.width=leaf.rect[2];c.height=leaf.rect[3];const cx=c.getContext('2d');
    cx.beginPath();leaf.mask.forEach(([x,y],i)=>i?cx.lineTo(x,y):cx.moveTo(x,y));cx.closePath();cx.clip();
    cx.drawImage(frames[0],...leaf.rect,0,0,c.width,c.height);return c;
  }):null;
  let nativeFlowerArt=null;
  if(nativeFlowers){
    const response=await fetch(new URL('../assets/native/flowers.json',import.meta.url));
    if(!response.ok)throw new Error('Missing native flower manifest');
    const manifest=await response.json();
    const loadNative=async record=>{const image=new Image();image.src=new URL('../assets/native/'+record.file,import.meta.url);await image.decode();return {...record,image};};
    nativeFlowerArt={headDisplayScale:manifest.headDisplayScale,
      heads:await Promise.all(manifest.heads.map(row=>Promise.all(row.map(loadNative)))),
      leaves:Object.fromEntries(await Promise.all(Object.entries(manifest.leaves).map(async([key,record])=>[key,await loadNative(record)])))};
  }
  return {layout:nativeBirds?{...layout,bird:birds.taiwan_blue_magpie.layout}:layout,bird:nativeBirds?birds.taiwan_blue_magpie.frames:magpie,birds,nativeFlowerArt,
    flower:flowerFrames,flowerVariants,isolatedLeaves};
}

export function paintBird(ctx,sprites,state,w,h,frame) {
  const sprite=sprites.bird[state.phase==='won'?sprites.layout.bird.settledPose:frame],scale=sprites.layout.bird.scale*(sprites.layout.bird.native?1:VISUAL_TUNING.birdScale);
  const settle=state.phase==='won'?1:state.landing?.stage==='approach'?Math.min(1,state.landing.elapsed/state.config.landingSeconds)**3:0;
  const resting=sprites.bird[sprites.layout.bird.settledPose];
  const groundOffset=sprites.layout.bird.groundContactY===undefined?-6:
    .018*h-(sprites.layout.bird.groundContactY-resting.anchor[1])*scale;
  const x=Math.round((state.phase==='ready'?.34:state.bird.x)*w), y=Math.round(state.bird.y*h+groundOffset*settle);
  ctx.save();ctx.translate(x,y);ctx.scale(state.bird.direction??1,1);
  ctx.drawImage(sprite.image,-Math.round(sprite.anchor[0]*scale),-Math.round(sprite.anchor[1]*scale),
    Math.round(sprite.image.width*scale),Math.round(sprite.image.height*scale));ctx.restore();
}

export function paintLeafPair(ctx,sprites,index,x,y,scale){
  if(sprites.nativeFlowerArt){
    const leaf=sprites.nativeFlowerArt.leaves[index+':'+scale.toFixed(6)];
    if(!leaf)throw new Error('Rebuild native leaf size '+scale);
    for(const direction of [-1,1]){ctx.save();ctx.translate(x,y);ctx.scale(direction,1);ctx.drawImage(leaf.image,-leaf.anchor[0],-leaf.anchor[1]);ctx.restore();}
    return;
  }
  const leaf=sprites.isolatedLeaves[index],anchor=sprites.layout.flower.isolatedLeaf.anchor;
  for(const direction of [-1,1]){
    ctx.save();ctx.translate(x,y);ctx.scale(direction,1);
    ctx.drawImage(leaf,-Math.round(anchor[0]*scale),-Math.round(anchor[1]*scale),Math.round(leaf.width*scale),Math.round(leaf.height*scale));ctx.restore();
  }
}
export function paintFlower(ctx,sprites,flower,w,h,ground) {
  const layout=sprites.layout.flower,variant=flowerVariant(layout,flower.id);
  const index=flower.reaction>0?1+(flower.hits-1)%3:0,image=(sprites.flowerVariants?.[variant.index]??sprites.flower)[index];
  const x=Math.round(flower.x*w),top=Math.round((ground/h-flower.displayHeight)*h);
  // The head keeps a fixed shape and pixel scale; only the continuous stalk's
  // length follows game height. Leaves retain the approved image's contours.
  const scale=variant.scale,headHeight=layout.headSourceHeight,headW=Math.round(image.width*scale),headH=Math.round(headHeight*scale);
  const stemStart=top+Math.round(headH*.43),length=ground-stemStart;
  const stemX=y=>x+Math.round(Math.sin((y-stemStart)/Math.max(1,length)*Math.PI*2)*variant.curvePixels);
  if(length>26){
    const leafScale=(layout.leafScale??.125)*(variant.leafSize??1);
    variant.leafLevels.forEach(level=>{const y=stemStart+Math.round(length*level);paintLeafPair(ctx,sprites,variant.index,stemX(y),y,leafScale);});
  }
  for(let y=stemStart;y<=ground;y++) {
    const sx=stemX(y),r=variant.stemHalfWidth??layout.stem.halfWidth;ctx.fillStyle=layout.stem.outline;ctx.fillRect(sx-r,y,r*2+1,1);
    ctx.fillStyle=variant.stemRamp?.[0]??layout.stem.base;ctx.fillRect(sx-r+1,y,r*2-1,1);ctx.fillStyle=variant.stemRamp?.[1]??layout.stem.light;ctx.fillRect(sx-r+1,y,Math.min(2,r*2-1),1);
  }
  const wobble=flower.blocked>0?Math.round(Math.sin(flower.blocked*26)*3*flower.blocked):0;
  // Enlarge the crown about its lower attachment; stem/leaf geometry above stays exact.
  const displayScale=layout.headDisplayScale??1,displayW=Math.round(headW*displayScale),displayH=Math.round(headH*displayScale);
  const bottom=top-Math.round(headH*.55)+headH;
  if(sprites.nativeFlowerArt&&displayScale===sprites.nativeFlowerArt.headDisplayScale){
    const head=sprites.nativeFlowerArt.heads[variant.index][index];
    ctx.drawImage(head.image,x-Math.round(displayW/2)+wobble,bottom-displayH);
  }else ctx.drawImage(image,0,0,image.width,headHeight,x-Math.round(displayW/2)+wobble,bottom-displayH,displayW,displayH);
}
