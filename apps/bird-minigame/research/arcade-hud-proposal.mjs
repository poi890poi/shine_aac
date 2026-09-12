// Review candidate only. The live renderer does not import this module.
import {AMMO_OUTLINE_ROWS} from '../src/game-feedback.js';
import {dropBudget} from '../src/game-core.js';
const INK='#20243a',CREAM='#fff5ce',GOLD='#e8c768',SHADE='#b39555',GREEN='#82bc75',MUTED='#a8c5ca';

// Final-size native masks: one-pixel silhouette border and deliberate flat ramps.
function glyph(ctx,x,y,rects,color=CREAM) {
  const points=new Set();
  for(const [left,top,w,h] of rects)for(let py=top;py<top+h;py++)for(let px=left;px<left+w;px++)points.add(`${px},${py}`);
  const has=(a,b)=>points.has(`${a},${b}`);
  const border=new Set();
  for(const key of points) {
    const [a,b]=key.split(',').map(Number);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])if(!has(a+dx,b+dy))border.add(`${a+dx},${b+dy}`);
  }
  ctx.fillStyle=INK;
  for(const key of border){const [a,b]=key.split(',').map(Number);ctx.fillRect(x+a,y+b,1,1);}
  for(const key of points){const [a,b]=key.split(',').map(Number);ctx.fillStyle=color===CREAM?(!has(a,b-1)?CREAM:!has(a,b+1)?SHADE:GOLD):color;ctx.fillRect(x+a,y+b,1,1);}
}

function button(ctx,x,y,name,framed) {
  if(framed) {
    ctx.fillStyle=INK;ctx.fillRect(x+2,y,32,36);ctx.fillRect(x,y+2,36,32);
    ctx.fillStyle=SHADE;ctx.fillRect(x+2,y+2,32,32);
    ctx.fillStyle=CREAM;ctx.fillRect(x+2,y+2,32,29);
  }
  const shapes={
    settings:[[8,5,4,7],[20,5,4,7],[10,11,12,5],[13,15,6,4],[11,19,6,4],[8,23,7,4]],
    pause:[[10,7,5,21],[21,7,5,21]],
    exit:[[7,5,3,24],[7,5,13,3],[7,26,13,3],[14,15,15,3],[22,10,3,3],[25,12,3,3],[25,18,3,3],[22,21,3,3]]
  };
  glyph(ctx,x,y,shapes[name],framed?INK:CREAM);
}

export function paintArcadeHud(ctx,state,width,{framed=false}={}) {
  const {capacity,available,progress}=dropBudget(state);
  const left=10,top=11,pitch=27;
  for(let i=0;i<capacity;i++) {
    const fill=i<available?1:i===available?progress:0;
    AMMO_OUTLINE_ROWS.forEach(([lo,hi],row)=>{
      const above=AMMO_OUTLINE_ROWS[row-1],below=AMMO_OUTLINE_ROWS[row+1];
      for(let px=lo;px<=hi;px++) {
        const inside=px>lo&&px<hi&&above&&below&&px>=above[0]&&px<=above[1]&&px>=below[0]&&px<=below[1];
        if(inside&&row<26-Math.floor(fill*26))continue;
        ctx.fillStyle=inside?(i<available?'#ffffff':GOLD):INK;ctx.fillRect(left+i*pitch+px,top+row,1,1);
      }
    });
  }
  const cameraX=left+capacity*pitch+17,cy=8,signal=state.cameraSignal;
  if(signal?.visible) {
    glyph(ctx,cameraX,cy,[[3,9,22,14],[7,6,8,3]],CREAM);
    const cx=cameraX+14,y=cy+16;
    for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++) {
      const d=dx*dx+dy*dy;if(d>36)continue;
      ctx.fillStyle=d>22?INK:signal.state==='live'?GREEN:signal.state==='waiting'?GOLD:MUTED;
      ctx.fillRect(cx+dx,y+dy,1,1);
    }
    if(signal.state==='live'){ctx.fillStyle=CREAM;ctx.fillRect(cx-2,y-3,3,2);}
    if(signal.state==='unavailable'){ctx.fillStyle=INK;for(let i=-4;i<=4;i++)ctx.fillRect(cx+i,y-i,2,2);}
    if(signal.state==='waiting'){ctx.fillStyle=INK;ctx.fillRect(cx,y-3,1,4);ctx.fillRect(cx,y,4,1);}
    ctx.fillStyle=INK;ctx.fillRect(cameraX+29,cy+8,5,16);
    ctx.fillStyle=signal.state==='live'?GREEN:MUTED;
    const h=Math.round((signal.state==='live'?signal.level:0)*14);
    if(h)ctx.fillRect(cameraX+30,cy+23-h,3,h);
  }
  const speedX=cameraX+(signal?.visible?44:0);
  for(let arrow=0;arrow<3;arrow++) {
    const rects=[];
    for(let row=0;row<13;row++)rects.push([6-Math.abs(row-6),row,3,1]);
    glyph(ctx,speedX+arrow*12,18,rects,arrow<=(state.speedLevel??0)?CREAM:MUTED);
  }
  // Each icon occupies a 48-native-pixel control cell. These are review-only
  // visuals; eventual semantic DOM targets would be invisible and at least 48 CSS px.
  ['settings','pause','exit'].forEach((name,i)=>button(ctx,width-148+i*48+6,7,name,framed));
  return {row:{top:7,bottom:43},controlsLeft:width-148,statusRight:speedX+34};
}
