import {paintMeadowCloudShadows} from './meadow-cloud-shadows.js';
// Curated broad lobe profiles, sampled on the scene's existing pixel grid.
// Randomness arranges these shapes; it never invents noisy leaf contours per frame.
export const BUSH_PROFILES=Object.freeze([
 [2,3,3,5,6,6,8,8,9,9,8,7,7,6,4,4,3,2],
 [2,4,5,5,7,8,8,7,6,5,5,7,7,6,4,3,3,2],
 [2,3,4,6,6,5,5,7,9,10,10,9,7,6,5,4,2,2],
 [1,2,3,4,5,5,4,4,6,7,7,6,5,4,4,3,2,1],
 [2,4,4,6,8,9,9,8,7,6,6,5,5,6,5,4,3,1],
 [1,3,4,4,5,7,7,6,5,4,6,8,8,7,5,4,3,2]
].map(Object.freeze));
export const CLEARING_PALETTES=Object.freeze([
 {meadow:'#9ab661',bush:['#668f76','#81a267','#a4b969']},
 {meadow:'#98b36d',bush:['#638d7b','#80a276','#a2b879']},
 {meadow:'#a1b96a',bush:['#708f70','#8ba569','#adbd75']}
]);
export const MOUNTAIN_PROFILES=Object.freeze([
 'beidawu','qilai-hualien','yushan-chenyoulan','dulan',
 'guanyin-tamsui','qixing','huoyan-daan','dajian-kenting'
]);
export const MOUNTAIN_MOODS=Object.freeze([
 {id:'beidawu-clear',scale:1,shift:0,colors:['#52777f','#678e9c','#87aaba','#a6c4cc']},
 {id:'beidawu-soft',scale:1.06,shift:-.02,colors:['#668d95','#7d9fa9','#9ab8c3','#b5cfd3']},
 {id:'beidawu-hazy',scale:1.12,shift:.025,colors:['#7b9da3','#90afb8','#acc6cc','#c0d7d9']}
]);
function rng(seed){let value=seed>>>0;return()=>{value+=0x6D2B79F5;let t=Math.imul(value^value>>>15,1|value);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export function createClearing(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Scenery seed must be a uint32');
 const random=rng(seed),count=5+Math.floor(random()*4),palette=Math.floor(random()*3),mountain=Math.floor(random()*3);
 const bushes=Array.from({length:count},(_,i)=>Object.freeze({
  x:(i+.3+random()*.4)/count,depth:random(),shape:Math.floor(random()*BUSH_PROFILES.length),unit:2+Math.floor(random()*2),flip:random()<.5
 })).sort((a,b)=>a.depth-b.depth);
 const mountainProfile=Math.floor(random()*MOUNTAIN_PROFILES.length);
 return Object.freeze({seed,palette,mountain,mountainProfile,bushes:Object.freeze(bushes)});
}
export function paintClearing(ctx,scene,w,ground,time=0,reducedMotion=false){
 const palette=CLEARING_PALETTES[scene.palette],top=ground-108;
 ctx.fillStyle=palette.meadow;ctx.fillRect(0,top,w,126);
 // Uneven meadow horizon joins the foothills without rice rows or field borders.
 for(let x=0;x<w;x++){const rise=3+Math.round(2*Math.sin(x/23));ctx.fillRect(x,top-rise,1,rise);}
 paintMeadowCloudShadows(ctx,scene.seed,palette.meadow,w,ground,time,reducedMotion);
 // Each lobe is rasterized at the final object footprint, one native column
 // at a time. Object size varies; it never changes the drawing pixel unit.
 const crowns=[[[.2,.27,.55],[.48,.33,1],[.78,.27,.66]],[[.18,.24,.65],[.4,.3,.95],[.7,.32,.7],[.88,.15,.42]],[[.18,.23,.47],[.43,.29,.8],[.7,.3,1]],[[.17,.22,.7],[.46,.34,1],[.8,.25,.6]],[[.16,.23,.5],[.36,.25,.9],[.61,.27,.72],[.82,.24,.5]],[[.17,.21,.45],[.43,.3,.68],[.73,.3,1]]];
 for(const b of scene.bushes){
  const profile=BUSH_PROFILES[b.shape],width=profile.length*b.unit,height=Math.max(...profile)*b.unit,x0=Math.round(b.x*w-width/2),base=Math.round(top+10+b.depth*62);
  for(let col=0;col<width;col++){
   const t=(b.flip?width-1-col:col)/Math.max(1,width-1);let rise=0;
   for(const [center,radius,tall] of crowns[b.shape]){const d=(t-center)/radius;if(Math.abs(d)<=1)rise=Math.max(rise,Math.sqrt(1-d*d)*height*tall);}
   const n=Math.round(rise),x=x0+col,y=base-n;if(!n)continue;
   ctx.fillStyle=palette.bush[0];ctx.fillRect(x,y,1,n);
   ctx.fillStyle=palette.bush[1];ctx.fillRect(x,y,1,Math.max(1,n-Math.round(height*.2)));
   if(t>.12&&t<.82&&n>height*.48){ctx.fillStyle=palette.bush[2];ctx.fillRect(x,y,1,Math.max(1,Math.round(height*.14)));}
  }
 }
 // Sparse grass accents, with no rows or dense texture.
 for(let i=0;i<18;i++){const x=(scene.seed%97+i*137)%Math.max(1,w),y=top+25+(i*43+scene.seed%31)%60;
  ctx.fillStyle=palette.bush[1];ctx.fillRect(x,y,2,4);ctx.fillRect(x+3,y+2,2,2);}
}
