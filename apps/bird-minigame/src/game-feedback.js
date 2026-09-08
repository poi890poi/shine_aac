import {dropBudget,COLLISION_FEATHER_SECONDS} from './game-core.js';
import {VISUAL_TUNING} from './visual-tuning.js';

// Cosmetic templates use the scene's native square pixels; never rotate/rescale
// the bird to create particles. D = shared outline, B = blue, W = white tip.
export const FEATHER_EFFECT=Object.freeze({
  duration:COLLISION_FEATHER_SECONDS, count:4, drift:13, flutter:5, lift:16, gravity:38,
  rows:Object.freeze(['....DD.','...DWWD','..DWWWD','..DBBDD','.DBBBD.','.DBDBD.','DBBBD..','DBBD...','.DD....','.D.....','D......'])
});
const colors={D:'#20243a',B:'#477de0',W:'#ffffff'};
export function featherParticles(burst,width,height) {
  if(!burst||burst.age>=FEATHER_EFFECT.duration)return [];
  const t=burst.age;
  return Array.from({length:FEATHER_EFFECT.count},(_,i)=>{
    const direction=i%2?1:-1,phase=i*1.9;
    return {x:Math.round(burst.x*width-18+i*5+direction*FEATHER_EFFECT.drift*t+FEATHER_EFFECT.flutter*(Math.sin(t*5+phase)-Math.sin(phase))),
      y:Math.round(burst.y*height-4+i*3-FEATHER_EFFECT.lift*t+.5*FEATHER_EFFECT.gravity*t*t),
      mirrored:Math.sin(t*5+phase)<0};
  });
}
export function paintFeathers(ctx,burst,width,height,palette=colors) {
  for(const p of featherParticles(burst,width,height)) {
    FEATHER_EFFECT.rows.forEach((row,y)=>[...row].forEach((v,x)=>{
      if(v!=='.'){ctx.fillStyle=palette[v];ctx.fillRect(p.x+(p.mirrored?row.length-1-x:x),p.y+y,1,1);}
    }));
  }
}

// Fixed HUD, deliberately separate from bird position and input hit targets.
export function paintAmmo(ctx,state,width) {
  if(['landing','won','exited'].includes(state.phase))return;
  const {capacity,available,progress}=dropBudget(state),scale=VISUAL_TUNING.ammoScale,hudWidth=(capacity*16+10)*scale;
  const left=state.config.ammoSide==='right'?width-hudWidth-10:10,top=10;
  const rect=(x,y,w,h)=>ctx.fillRect(left+x*scale,top+y*scale,w*scale,h*scale);
  for(let i=0;i<capacity;i++) {
    const x=7+i*16,y=5;
    const rows=['...D...','..DDD..','..DDD..','.DDDDD.','DDDDDDD','DDDDDDD','DDDDDDD','.DDDDD.','..DDD..'];
    const fill=i<available?1:i===available?progress:0;
    rows.forEach((row,ry)=>[...row].forEach((v,rx)=>{
      if(v!=='D')return;
      const interior=ry>=2&&ry<8&&rx>=1&&rx<6&&row[rx-1]==='D'&&row[rx+1]==='D';
      // Leave unfilled pixels untouched so the actual scene shows through.
      if(interior&&ry<8-Math.floor(fill*6))return;
      ctx.fillStyle=interior?(i<available?'#ffffff':'#f5df72'):'#20243a';
      rect(x+rx,y+ry,1,1);
    }));
    if(i===available&&state.config.dropMode==='recharge') {
      ctx.fillStyle='#20243a';
      rect(x,18,7,1);rect(x,21,7,1);
      rect(x,19,1,2);rect(x+6,19,1,2);
      ctx.fillStyle='#f5df72';rect(x+1,19,Math.floor(progress*5),2);
    }
  }
}
