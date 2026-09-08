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
export function paintClearing(ctx,scene,w,ground){
 const palette=CLEARING_PALETTES[scene.palette],top=ground-108;
 ctx.fillStyle=palette.meadow;ctx.fillRect(0,top,w,126);
 // Uneven meadow horizon joins the foothills without rice rows or field borders.
 for(let x=0;x<w;x+=3){const rise=3+Math.round(2*Math.sin(x/23));ctx.fillRect(x,top-rise,3,rise);}
 for(const b of scene.bushes){
  const profile=BUSH_PROFILES[b.shape],u=b.unit,x0=Math.round(b.x*w-profile.length*u/2),base=Math.round(top+10+b.depth*62);
  for(let col=0;col<profile.length;col++){
   const n=profile[b.flip?profile.length-1-col:col],x=x0+col*u,y=base-n*u;
   ctx.fillStyle=palette.bush[0];ctx.fillRect(x,y,u,n*u);
   ctx.fillStyle=palette.bush[1];ctx.fillRect(x,y,u,Math.max(u,(n-2)*u));
   // Few broad connected crown highlights, never stochastic speckle.
   if(col>1&&col<profile.length-3&&n>=5){ctx.fillStyle=palette.bush[2];ctx.fillRect(x,y,u,2*u);}
  }
 }
 // Sparse grass accents, with no rows or dense texture.
 for(let i=0;i<18;i++){const x=(scene.seed%97+i*137)%Math.max(1,w),y=top+25+(i*43+scene.seed%31)%60;
  ctx.fillStyle=palette.bush[1];ctx.fillRect(x,y,2,4);ctx.fillRect(x+3,y+2,2,2);}
}
