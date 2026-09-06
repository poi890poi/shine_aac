// Display preparation for the user-approved sheets. Background is an exterior
// matte, not a global white color key: enclosed eyes and feather tips stay white.
import {validateFlowerVariants,flowerVariant,recolorPetals,recolorLeaves} from './flower-variants.js';
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
export async function loadSprites() {
  const response=await fetch(new URL('../rules/sprite-layout.json',import.meta.url));
  if(!response.ok)throw new Error('Cannot load sprite layout');const layout=await response.json();
  validateFlowerVariants(layout.flower);
  const [bird,flower]=await Promise.all([load(layout.bird.file),load(layout.flower.file)]);
  const flowerFrames=layout.flower.expressions.map(rect=>cut(flower,rect));
  const flowerVariants=(layout.flower.variants??[{petalRamp:null}]).map(variant=>flowerFrames.map(source=>{
    if(!variant.petalRamp&&!variant.stemRamp)return source;
    const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
    const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
    recolorPetals(frame.data,canvas.width,layout.flower.headSourceHeight,variant.petalRamp);
    recolorLeaves(frame.data,canvas.width,layout.flower.headSourceHeight,variant.stemRamp);ctx.putImageData(frame,0,0);return canvas;
  }));
  return {layout,bird:layout.bird.poses.map(p=>({image:cut(bird,p.rect),anchor:p.anchor})),
    flower:flowerFrames,flowerVariants};
}

export function paintBird(ctx,sprites,state,w,h,frame) {
  const sprite=sprites.bird[state.phase==='won'?sprites.layout.bird.settledPose:frame],scale=sprites.layout.bird.scale;
  const settle=state.phase==='won'?1:state.landing?.stage==='approach'?Math.min(1,state.landing.elapsed/state.config.landingSeconds)**3:0;
  const x=Math.round((state.phase==='ready'?.34:state.bird.x)*w), y=Math.round(state.bird.y*h-6*settle);
  ctx.save();ctx.translate(x,y);ctx.scale(state.bird.direction??1,1);
  ctx.drawImage(sprite.image,-Math.round(sprite.anchor[0]*scale),-Math.round(sprite.anchor[1]*scale),
    Math.round(sprite.image.width*scale),Math.round(sprite.image.height*scale));ctx.restore();
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
  for(let y=stemStart;y<=ground;y++) {
    const sx=stemX(y),r=variant.stemHalfWidth??layout.stem.halfWidth;ctx.fillStyle=layout.stem.outline;ctx.fillRect(sx-r,y,r*2+1,1);
    ctx.fillStyle=variant.stemRamp?.[0]??layout.stem.base;ctx.fillRect(sx-r+1,y,r*2-1,1);ctx.fillStyle=variant.stemRamp?.[1]??layout.stem.light;ctx.fillRect(sx-r+1,y,Math.min(2,r*2-1),1);
  }
  if(length>26){
    // Source leaves have their own surrounding transparent matte in the sheet.
    const leafScale=(layout.leafScale??.125)*(variant.leafSize??1),leafW=Math.round(layout.leafRect[2]*leafScale),leafH=Math.round(layout.leafRect[3]*leafScale);
    variant.leafLevels.forEach((level,i)=>{
      const leafY=stemStart+Math.round(length*level),direction=(i+variant.index)%2?-1:1;
      ctx.save();ctx.translate(stemX(leafY),leafY);ctx.scale(direction,1);
      ctx.drawImage(image,...layout.leafRect,-Math.round((layout.leafAnchorX??128)*leafScale),0,leafW,leafH);ctx.restore();
    });
  }
  const wobble=flower.blocked>0?Math.round(Math.sin(flower.blocked*26)*3*flower.blocked):0;
  ctx.drawImage(image,0,0,image.width,headHeight,x-Math.round(headW/2)+wobble,top-Math.round(headH*.55),headW,headH);
}
