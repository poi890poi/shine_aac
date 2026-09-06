// Reviewed September 6 artwork. Keep cloud pixels and complete flower contours.
import {paintFlower} from './sprite-assets.js';
import {flowerVariant} from './flower-variants.js';
export const CLOUD_PLACEMENTS=[[1,20,85,.14,'far'],[3,205,50,.14,'far'],[5,360,130,.14,'far'],[0,40,190,.24,'near'],[2,330,235,.24,'near'],[4,180,300,.22,'near']];
export const LEAF_PRESETS=[
  [[.18,.8],[.39,1.2],[.63,1.6],[.83,1.15]],
  [[.16,.85],[.34,1.1],[.52,1.45],[.7,1.2],[.86,.9]],
  [[.2,.9],[.42,1.4],[.65,1.65],[.84,1.2]],
  [[.16,.75],[.35,1.25],[.55,1.55],[.73,1.1],[.86,.85]]
];
function cut(im,rect){
  const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];const ctx=c.getContext('2d');ctx.drawImage(im,...rect,0,0,c.width,c.height);
  const f=ctx.getImageData(0,0,c.width,c.height),d=f.data,sky=d.slice(0,3),seen=new Uint8Array(c.width*c.height),queue=[];
  if(d[3]===0)return c;
  const add=i=>{if(i<0||i>=seen.length||seen[i])return;seen[i]=1;const j=i*4;if(Math.hypot(d[j]-sky[0],d[j+1]-sky[1],d[j+2]-sky[2])<48){d[j+3]=0;queue.push(i);}};
  for(let x=0;x<c.width;x++){add(x);add((c.height-1)*c.width+x);}for(let y=0;y<c.height;y++){add(y*c.width);add(y*c.width+c.width-1);}
  for(let n=0;n<queue.length;n++){const i=queue[n],x=i%c.width;if(x)add(i-1);if(x<c.width-1)add(i+1);add(i-c.width);add(i+c.width);}ctx.putImageData(f,0,0);return c;
}
export async function loadReviewedScenery(){
  const load=async name=>{const image=new Image();image.src=new URL('../assets/scenery/'+name,import.meta.url);await image.decode();return image;};
  const [sheet,mountain,ground]=await Promise.all(['clouds-review.png','beidawu-native.png','rural-ground-native.png'].map(load));
  const clouds=[[20,160,515,240],[580,110,380,290],[1040,10,450,390],[35,555,485,275],[590,535,475,295],[1130,655,370,180]].map(r=>cut(sheet,r));
  const land=document.createElement('canvas');land.width=480;land.height=164;
  const ctx=land.getContext('2d');ctx.drawImage(ground,0,476,480,164,0,0,480,164);
  const frame=ctx.getImageData(0,0,480,164),d=frame.data;
  for(let i=0;i<d.length;i+=4)if(d[i]===145&&d[i+1]===213&&d[i+2]===219)d[i+3]=0;
  ctx.putImageData(frame,0,0);return {clouds,mountain,land};
}
export function cloudPosition(placement,w,h,time,reducedMotion=false){
  const [,x,y,,layer]=placement,speed=layer==='far'?1.35:4.2;
  return {x:Math.round(x*w/480+(reducedMotion?0:time*speed)),y:Math.round(y*h/640)};
}
export function paintReviewedClouds(ctx,assets,w,h,time,reducedMotion=false){
  for(const p of CLOUD_PLACEMENTS){const [i,,,scale]=p,im=assets.clouds[i],cw=Math.round(im.width*scale),ch=Math.round(im.height*scale);
    const position=cloudPosition(p,w,h,time,reducedMotion),x=((position.x+cw)%(w+cw))-cw;
    ctx.drawImage(im,x,position.y,cw,ch);
  }
}
export function paintReviewedScenery(ctx,assets,w,h,ground,time,reducedMotion=false){
  ctx.fillStyle='#91d5db';ctx.fillRect(0,0,w,h);
  const offset=ground-628,left=Math.round((w-480)/2);
  ctx.drawImage(assets.mountain,left,377+offset);
  ctx.drawImage(assets.land,left,476+offset);
  ctx.fillStyle='#69a64b';ctx.fillRect(0,640+offset,w,Math.max(0,h-640-offset));
  paintReviewedClouds(ctx,assets,w,h,time,reducedMotion);
}
export function prepareReviewedFlowers(sprites){
  return {...sprites,layout:{...sprites.layout,flower:{...sprites.layout.flower,variants:sprites.layout.flower.variants.map(v=>({...v,leafLevels:[]}))}}};
}
export function paintReviewedFlower(ctx,sprites,flower,w,h,ground){
  paintFlower(ctx,sprites,flower,w,h,ground);
  const layout=sprites.layout.flower,variant=flowerVariant(layout,flower.id),i=variant.index;
  const top=Math.round(ground-flower.displayHeight*h),headH=Math.round(layout.headSourceHeight*variant.scale);
  const start=top+Math.round(headH*.43),length=ground-start,image=sprites.flowerVariants[i][0];
  const leaves=length<100?[[.23,.8],[.51,1.25],[.81,1]]:LEAF_PRESETS[i];
  leaves.forEach(([level,size],j)=>{
    const y=start+Math.round(length*level),x=Math.round(flower.x*w)+Math.round(Math.sin((y-start)/length*Math.PI*2)*variant.curvePixels);
    const scale=layout.leafScale*size,lw=Math.round(layout.leafRect[2]*scale),lh=Math.round(layout.leafRect[3]*scale);
    ctx.save();ctx.translate(x,y);ctx.scale((j+i)%2?-1:1,1);
    ctx.drawImage(image,...layout.leafRect,-Math.round(layout.leafAnchorX*scale),0,lw,lh);ctx.restore();
  });
}
