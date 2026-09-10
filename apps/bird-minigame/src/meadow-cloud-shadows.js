// Shadows from unseen overhead clouds, independent of the visible sky field.
// Low contrast, flattened footprints and two discrete tones keep the native grid.
export const MEADOW_SHADOW_TUNING=Object.freeze({
  count:3,speed:1.8,widthMin:180,widthVariation:100,heightMin:20,heightVariation:12,
  edgeStrength:.045,coreStrength:.09,tint:Object.freeze([54,83,96])
});
const recipes=new Map();
function footprint(width,height,inset){
  const rows=[],lobes=[[.24,.28,.37],[.51,.35,.5],[.77,.25,.33]];
  for(let y=0;y<height;y++){
    let left=width,right=-1;
    for(const [center,rx,ry] of lobes){
      const dy=(y+.5-height*.5)/(height*ry*inset);
      if(Math.abs(dy)>=1)continue;
      const reach=width*rx*inset*Math.sqrt(1-dy*dy);
      left=Math.min(left,Math.ceil(width*center-reach));right=Math.max(right,Math.floor(width*center+reach));
    }
    if(right>=left)rows.push(Object.freeze([Math.max(0,left),y,Math.min(width-1,right)-Math.max(0,left)+1,1]));
  }
  return Object.freeze(rows);
}
export function meadowShadowRecipe(seed){
  if(recipes.has(seed))return recipes.get(seed);
  let value=(seed^0x53484144)>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const t=MEADOW_SHADOW_TUNING;
  const result=Object.freeze(Array.from({length:t.count},(_,i)=>{
    const width=Math.round(t.widthMin+random()*t.widthVariation),height=Math.round(t.heightMin+random()*t.heightVariation);
    return Object.freeze({width,height,x:(i+.2+random()*.5)/t.count,depth:(i+.4+random()*.2)/t.count,
      edge:footprint(width,height,1),core:footprint(width,height,.72)});
  }));
  recipes.set(seed,result);if(recipes.size>8)recipes.delete(recipes.keys().next().value);
  return result;
}
export function meadowShadowPosition(shadow,width,ground,time,reducedMotion=false){
  const period=width+shadow.width,drift=reducedMotion?0:time*MEADOW_SHADOW_TUNING.speed;
  return {x:Math.round(((shadow.x*width+drift+shadow.width)%period+period)%period-shadow.width),
    y:Math.round(ground-108+16+shadow.depth*38-shadow.height/2)};
}
export function meadowShadowColors(meadow){
  const base=meadow.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)),t=MEADOW_SHADOW_TUNING;
  return [t.edgeStrength,t.coreStrength].map(strength=>'#'+base.map((v,i)=>Math.round(v+(t.tint[i]-v)*strength).toString(16).padStart(2,'0')).join(''));
}
export function paintMeadowCloudShadows(ctx,seed,meadow,width,ground,time,reducedMotion=false){
  const colors=meadowShadowColors(meadow);
  for(const shadow of meadowShadowRecipe(seed)){
    const {x,y}=meadowShadowPosition(shadow,width,ground,time,reducedMotion);
    for(const [i,rows] of [shadow.edge,shadow.core].entries()){
      ctx.fillStyle=colors[i];for(const [left,top,w,h] of rows)ctx.fillRect(x+left,y+top,w,h);
    }
  }
}
