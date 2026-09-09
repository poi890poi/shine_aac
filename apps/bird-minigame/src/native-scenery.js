// Prepare at the final virtual size before drawing. Restore binary alpha and
// indexed material colors after smoothing inherited source stair steps.
const prepared=new WeakMap();
const MAX_SIZES_PER_SOURCE=8;
export function prepareNativeScenery(source,width,height,tones,blur){
  let cache=prepared.get(source);if(!cache){cache=new Map();prepared.set(source,cache);}
  const key=[width,height,blur,...tones.flat()].join(',');
  if(cache.has(key)){const image=cache.get(key);cache.delete(key);cache.set(key,image);return image;}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.filter=`blur(${blur}px)`;ctx.drawImage(source,0,0,width,height);ctx.filter='none';
  const frame=ctx.getImageData(0,0,width,height),data=frame.data;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<128){data[i+3]=0;continue;}
    let best=tones[0],distance=Infinity;
    for(const tone of tones){const delta=(data[i]-tone[0])**2+(data[i+1]-tone[1])**2+(data[i+2]-tone[2])**2;
      if(delta<distance){distance=delta;best=tone;}}
    data.set([...best,255],i);
  }
  ctx.putImageData(frame,0,0);cache.set(key,canvas);
  if(cache.size>MAX_SIZES_PER_SOURCE)cache.delete(cache.keys().next().value);
  return canvas;
}
