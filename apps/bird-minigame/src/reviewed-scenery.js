// Reviewed September 6 artwork; later cosmetic revisions preserve source contours.
import {paintFlower,paintLeafPair} from './sprite-assets.js';
import {flowerVariant} from './flower-variants.js';
import {VISUAL_TUNING} from './visual-tuning.js';
import {MOUNTAIN_MOODS,MOUNTAIN_PROFILES,paintClearing} from './clearing-scenery.js';
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
export function flattenCloudPixels(data){
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const light=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    const tone=VISUAL_TUNING.cloudTones[light<VISUAL_TUNING.cloudThresholds[0]?0:light<VISUAL_TUNING.cloudThresholds[1]?1:2];
    data.set(tone,i);
  }
  return data;
}
export async function loadReviewedScenery({flatClouds=true}={}){
  const load=async name=>{const image=new Image();image.src=new URL('../assets/scenery/'+name,import.meta.url);await image.decode();return image;};
  const [sheet,mountain,ground]=await Promise.all(['clouds-review.png','beidawu-native.png','rural-ground-native.png'].map(load));
  const clouds=[[20,160,515,240],[580,110,380,290],[1040,10,450,390],[35,555,485,275],[590,535,475,295],[1130,655,370,180]].map(r=>cut(sheet,r));
  if(flatClouds)for(const cloud of clouds){const ctx=cloud.getContext('2d'),frame=ctx.getImageData(0,0,cloud.width,cloud.height);flattenCloudPixels(frame.data);ctx.putImageData(frame,0,0);}
  const land=document.createElement('canvas');land.width=480;land.height=164;
  const ctx=land.getContext('2d');ctx.drawImage(ground,0,476,480,164,0,0,480,164);
  const frame=ctx.getImageData(0,0,480,164),d=frame.data;
  for(let i=0;i<d.length;i+=4)if(d[i]===145&&d[i+1]===213&&d[i+2]===219)d[i+3]=0;
  ctx.putImageData(frame,0,0);
  const photos=await Promise.all(MOUNTAIN_PROFILES.map(id=>id==='beidawu'?mountain:load(id+'-native.png')));
  const profileMountains=photos.map(mountain=>MOUNTAIN_MOODS.map(mood=>{
    const c=document.createElement('canvas');c.width=mountain.width;c.height=mountain.height;
    const cx=c.getContext('2d');cx.drawImage(mountain,0,0);const f=cx.getImageData(0,0,c.width,c.height);
    const from=MOUNTAIN_MOODS[0].colors.map(hex=>hex.match(/[0-9a-f]{2}/g).map(n=>parseInt(n,16)));
    const to=mood.colors.map(hex=>hex.match(/[0-9a-f]{2}/g).map(n=>parseInt(n,16)));
    for(let i=0;i<f.data.length;i+=4){const index=from.findIndex(rgb=>rgb.every((v,j)=>v===f.data[i+j]));if(index>=0)f.data.set(to[index],i);}
    cx.putImageData(f,0,0);return c;
  }));
  return {clouds,mountain,mountains:profileMountains[0],profileMountains,land};
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
export function paintReviewedScenery(ctx,assets,w,h,ground,time,reducedMotion=false,clearing=null){
  ctx.fillStyle='#91d5db';ctx.fillRect(0,0,w,h);
  const offset=ground-628,left=Math.round((w-480)/2);
  if(clearing){
    const mood=MOUNTAIN_MOODS[clearing.mountain],im=(assets.profileMountains?.[clearing.mountainProfile??0]??assets.mountains)[clearing.mountain];
    const scale=Math.max(w/480,1)*mood.scale,mw=Math.round(im.width*scale),mh=Math.round(im.height*scale);
    const mx=Math.max(w-mw,Math.min(0,Math.round((w-mw)/2+mood.shift*w)));
    ctx.drawImage(im,mx,ground-108-mh,mw,mh);
    paintClearing(ctx,clearing,w,ground);
  }else{
    ctx.drawImage(assets.mountain,left,377+offset);
    ctx.drawImage(assets.land,left,476+offset);
  }
  ctx.fillStyle='#69a64b';ctx.fillRect(0,640+offset,w,Math.max(0,h-640-offset));
  paintLandingGrass(ctx,w,h,ground);
  paintReviewedClouds(ctx,assets,w,h,time,reducedMotion);
}
export function paintLandingGrass(ctx,w,h,ground){
  const g=VISUAL_TUNING.grass,top=ground-18;
  ctx.fillStyle=g.base;ctx.fillRect(0,top,w,h-top);
  // The meadow grows across the old straight field seam. Keep the rice visible
  // between connected clumps; broad uneven patches and narrow blades share a ramp.
  const edge=x=>top-g.edgeRise-Math.round(g.edgeWave*(.65*Math.sin(x/29)+.35*Math.sin(x/11+1)));
  for(let x=0;x<w;x+=2){
    const y=edge(x);ctx.fillStyle=g.base;ctx.fillRect(x,y,Math.min(2,w-x),top-y);
    if(Math.sin(x/19)+Math.sin(x/7)>.15){ctx.fillStyle=g.fieldBlend;ctx.fillRect(x,y,Math.min(2,w-x),2+(Math.floor(x/9)%3));}
  }
  for(let i=0,x=3;x<w;i++,x+=g.fringeSpacing){
    const seed=(i*37)%23,cx=x+seed%5-2,base=edge(cx)+4,height=g.fringeHeight-2+seed%5;
    ctx.fillStyle=g.base;ctx.fillRect(cx-3,base-3,7,4);
    ctx.fillRect(cx-2,base-height,2,height);ctx.fillRect(cx+2,base-height+3,2,height-2);
    ctx.fillStyle=seed%3?g.light:g.fieldBlend;
    ctx.fillRect(cx-2,base-height,1,height-1);ctx.fillRect(cx-3,base-height+2,1,3);
    ctx.fillRect(cx+2,base-height+3,1,height-3);
  }
  // Stable, staggered three-blade clusters, with denser/larger tufts near the viewer.
  // No lane, center stripe or changes to the bird's existing landing surface.
  for(let row=0,y=top+5;y<h+5;row++,y+=g.rowHeight){
    for(let col=0;col<Math.ceil(w/g.spacing)+1;col++){
      const seed=(col*73+row*151+col*row*19)%101;
      const x=col*g.spacing+(row%2?13:0)+(seed%13)-6,base=y+(seed%7),size=base>ground+30?2:1;
      ctx.fillStyle=g.shadow;ctx.fillRect(x-3*size,base,6*size,size);
      ctx.fillRect(x-3*size,base-2*size,size,2*size);ctx.fillRect(x+2*size,base-3*size,size,3*size);
      ctx.fillStyle=g.light;ctx.fillRect(x,base-4*size,size,4*size);ctx.fillRect(x-size,base-5*size,size,2*size);
    }
  }
}
export function prepareReviewedFlowers(sprites,{headScale=VISUAL_TUNING.flowerHeadScale,legacyLeafComposite=false}={}){
  return {...sprites,legacyLeafComposite,layout:{...sprites.layout,flower:{...sprites.layout.flower,headDisplayScale:headScale,variants:sprites.layout.flower.variants.map(v=>({...v,leafLevels:[]}))}}};
}
export function paintReviewedFlower(ctx,sprites,flower,w,h,ground){
  if(sprites.legacyLeafComposite)paintFlower(ctx,sprites,flower,w,h,ground);
  const layout=sprites.layout.flower,variant=flowerVariant(layout,flower.id),i=variant.index;
  const top=Math.round(ground-flower.displayHeight*h),headH=Math.round(layout.headSourceHeight*variant.scale);
  const start=top+Math.round(headH*.43),length=ground-start,image=sprites.flowerVariants[i][0];
  const leaves=length<100?[[.23,.8],[.51,1.25],[.81,1]]:LEAF_PRESETS[i];
  leaves.forEach(([level,size],j)=>{
    const y=start+Math.round(length*level),x=Math.round(flower.x*w)+Math.round(Math.sin((y-start)/length*Math.PI*2)*variant.curvePixels);
    const scale=layout.leafScale*size,lw=Math.round(layout.leafRect[2]*scale),lh=Math.round(layout.leafRect[3]*scale);
    if(sprites.legacyLeafComposite){
      ctx.save();ctx.translate(x,y);ctx.scale((j+i)%2?-1:1,1);
      ctx.drawImage(image,...layout.leafRect,-Math.round(layout.leafAnchorX*scale),0,lw,lh);ctx.restore();
    }else{
      paintLeafPair(ctx,sprites,i,x,y,scale);
    }
  });
  // The original continuous stem owns its pixels; leaves cannot resize or repaint it.
  if(!sprites.legacyLeafComposite)paintFlower(ctx,sprites,flower,w,h,ground);
}
