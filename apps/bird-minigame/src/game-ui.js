// Visible UI belongs to the same native framebuffer as the scenery and sprites.
import {AMMO_OUTLINE_ROWS} from './game-feedback.js';
import {dropBudget} from './game-core.js';
const INK='#20243a',CREAM='#fff5ce',GOLD='#e8c768',SHADE='#b39555',GREEN='#82bc75',MUTED='#a8c5ca';

// Final-size native masks: one-pixel silhouette border and deliberate flat ramps.
const glyphCache=new WeakMap();
function glyph(ctx,x,y,rects,color=CREAM) {
  let variants=glyphCache.get(rects);if(!variants){variants=new Map();glyphCache.set(rects,variants);}
  if(variants.has(color)){const art=variants.get(color);ctx.drawImage(art,x-1,y-1);return;}
  if(typeof document!=='undefined') {
    const art=document.createElement('canvas');
    art.width=Math.max(...rects.map(([a,,w])=>a+w))+2;art.height=Math.max(...rects.map(([,b,,h])=>b+h))+2;
    const painter=art.getContext('2d');painter.translate(1,1);
    paintGlyph(painter,0,0,rects,color);variants.set(color,art);ctx.drawImage(art,x-1,y-1);return;
  }
  paintGlyph(ctx,x,y,rects,color);
}
function paintGlyph(ctx,x,y,rects,color) {
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

const shapes={
    settings:[[8,5,4,7],[20,5,4,7],[10,11,12,5],[13,15,6,4],[11,19,6,4],[8,23,7,4]],
    pause:[[10,7,5,21],[21,7,5,21]],
    exit:[[7,5,3,24],[7,5,13,3],[7,26,13,3],[14,15,15,3],[22,10,3,3],[25,12,3,3],[25,18,3,3],[22,21,3,3]],
  play:Array.from({length:25},(_,y)=>[9,y+5,Math.max(1,Math.round(21*(1-Math.abs(y-12)/13))),1]),
  replay:[[7,8,3,15],[10,5,16,3],[26,8,3,16],[10,24,16,3],[4,14,3,3],[1,11,3,3],[10,14,3,3],[13,11,3,3]],
  sound:[[4,13,7,10],[11,10,4,16],[15,7,4,22],[23,12,2,12],[28,8,2,20]],
  muted:[[4,13,7,10],[11,10,4,16],[15,7,4,22],[23,11,3,3],[26,14,3,4],[23,18,3,3],[29,11,3,3],[29,18,3,3]],
  flyby:[[4,9,25,3],[23,5,3,3],[26,7,3,3],[26,12,3,3],[23,15,3,3],[15,20,3,9],[11,24,3,3],[19,24,3,3]],
  recharge:[[6,9,3,14],[9,6,15,3],[24,9,3,14],[9,23,15,3],[3,15,3,3],[9,15,3,3],[14,12,3,8],[18,16,3,4]],
  previous:Array.from({length:19},(_,y)=>[15-Math.min(y,18-y),y+7,4,1]),
  next:Array.from({length:19},(_,y)=>[9+Math.min(y,18-y),y+7,4,1]),
  error:[[15,6,4,16],[15,26,4,4]]
};
const cameraShape=[[3,9,22,14],[7,6,8,3]];
const arrowShape=Array.from({length:13},(_,row)=>[6-Math.abs(row-6),row,3,1]);
const primaryShapes={
  play:Array.from({length:45},(_,y)=>[8,y+4,Math.max(1,Math.round(35*(1-Math.abs(y-22)/23))),1]),
  replay:[[9,10,4,25],[13,6,26,4],[39,10,4,29],[13,39,26,4],[5,23,4,4],[1,19,4,4],[13,23,4,4],[17,19,4,4]],
  error:[[23,5,6,29],[23,42,6,6]]
};

function corners(ctx,r,color=GOLD) {
  ctx.fillStyle=INK;
  for(const [x,y,dx,dy] of [[r.x,r.y,1,1],[r.x+r.w-1,r.y,-1,1],[r.x,r.y+r.h-1,1,-1],[r.x+r.w-1,r.y+r.h-1,-1,-1]]){
    ctx.fillRect(x+(dx<0?-7:0),y,8,2);ctx.fillRect(x,y+(dy<0?-7:0),2,8);
    ctx.fillStyle=color;ctx.fillRect(x+dx,y+dy,4,1);ctx.fillStyle=INK;
  }
}

export function gameUiLayout(width,height,{capacity=3,cameraVisible=false,helper=false,phase='running',manual=false,page=0,cssUnit=1}={}) {
  const size=Math.max(48,Math.ceil(48/cssUnit)),controls={};
  const cameraWidth=cameraVisible?44:0;
  const minimumStatus=10+(capacity-1)*22+21+6+cameraWidth+34+6;
  const compact=width-4-size*3<minimumStatus;
  const keys=compact?['settings','pause']:['settings','pause','exit'],right=width-4-size*keys.length;
  for(const [i,key] of keys.entries())controls[key]={x:right+i*size,y:1,w:size,h:size};
  const gap=Math.min(23,Math.max(6,right-6-10-(capacity-1)*22-21-cameraWidth-34));
  const pitch=Math.min(27,Math.floor((right-10-gap-cameraWidth-34-6-21)/Math.max(1,capacity-1)));
  const ammoPitch=Math.max(22,pitch),cameraX=10+(capacity-1)*ammoPitch+21+gap;
  const speedX=cameraX+cameraWidth;
  const between=['ready','won','exited'].includes(phase),wide=width>=500&&width>height;
  if(between&&!helper) {
    const primarySize=wide?72:96;
    controls.primary={x:Math.floor((width-primarySize)/2),y:Math.max(size+10,Math.floor(height*(phase==='won'?.2:.42)-primarySize/2)),w:primarySize,h:primarySize};
    if(manual) {
      const cols=wide?4:2,cardW=104,cardH=64,gap=8,rows=4/cols,groupW=cols*cardW+(cols-1)*gap;
      const left=Math.floor((width-groupW)/2);
      const y=phase==='won'?Math.max(controls.primary.y+primarySize+12,Math.floor(height*.35)):height-12-size-8-rows*cardH-(rows-1)*gap;
      for(let i=0;i<4;i++)controls[`bird-${page*4+i}`]={x:left+(i%cols)*(cardW+gap),y:y+Math.floor(i/cols)*(cardH+gap),w:cardW,h:cardH};
      const pagerY=y+rows*cardH+(rows-1)*gap+8;
      controls.previous={x:left,y:pagerY,w:size,h:size};controls.next={x:left+groupW-size,y:pagerY,w:size,h:size};
    }
  }
  if(helper) {
    const menuKeys=compact?['mode','speed','sound','exit']:['mode','speed','sound'];
    for(const [i,key] of menuKeys.entries())controls[key]={x:Math.floor((width-menuKeys.length*size-(menuKeys.length-1)*8)/2)+i*(size+8),y:Math.floor(height/2-size/2),w:size,h:size};
  }
  return {width,height,controls,ammoPitch,cameraX,speedX,row:{top:7,bottom:43},controlsLeft:right,statusRight:speedX+34,cssUnit};
}

export function paintGameUi(ctx,state,layout,ui={},thumbnails=new Map()) {
  const {capacity,available,progress}=dropBudget(state);
  const left=10,top=11,pitch=layout.ammoPitch;
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
  const cameraX=layout.cameraX,cy=8,signal=state.cameraSignal;
  if(signal?.visible) {
    glyph(ctx,cameraX,cy,cameraShape,CREAM);
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
  const speedX=layout.speedX;
  for(let arrow=0;arrow<3;arrow++) {
    glyph(ctx,speedX+arrow*12,18,arrowShape,arrow<=(state.speedLevel??0)?CREAM:MUTED);
  }
  for(const [key,r] of Object.entries(layout.controls)) {
    const item=ui.controls?.[key]??{icon:key==='primary'?(state.phase==='ready'?'play':'replay'):key};
    if(key.startsWith('bird-')) {
      // POC choices need separation from the plants; their flat stepped cards
      // are drawn here too, never as independently scaled DOM artwork.
      ctx.fillStyle=INK;ctx.fillRect(r.x+2,r.y,r.w-4,r.h);ctx.fillRect(r.x,r.y+2,r.w,r.h-4);
      ctx.fillStyle='#d3e6df';ctx.fillRect(r.x+2,r.y+1,r.w-4,r.h-2);ctx.fillRect(r.x+1,r.y+2,r.w-2,r.h-4);
      const thumbnail=thumbnails.get(item.species);
      if(thumbnail)ctx.drawImage(thumbnail,r.x+4,r.y+8);
      if(item.selected)corners(ctx,r);
    } else if(key==='primary'&&primaryShapes[item.icon]) {
      glyph(ctx,r.x+Math.floor((r.w-52)/2),r.y+Math.floor((r.h-52)/2),primaryShapes[item.icon],item.disabled?MUTED:CREAM);
    } else {
      const x=r.x+Math.floor((r.w-36)/2),y=r.y+Math.floor((r.h-36)/2);
      if(['slow','normal','fast'].includes(item.icon)) {
        const level=['slow','normal','fast'].indexOf(item.icon);
        for(let i=0;i<3;i++)glyph(ctx,x+i*12,y+10,arrowShape,item.disabled?MUTED:i<=level?CREAM:MUTED);
      } else if(shapes[item.icon])glyph(ctx,x,y,shapes[item.icon],item.disabled?MUTED:CREAM);
    }
    if(ui.focus===key||ui.pressed===key)corners(ctx,r,ui.pressed===key?CREAM:GOLD);
  }
  if(layout.controls.previous) {
    const a=layout.controls.previous,b=layout.controls.next,y=a.y+Math.floor(a.h/2),x=Math.floor((a.x+a.w+b.x)/2)-18;
    for(let i=0;i<4;i++){ctx.fillStyle=INK;ctx.fillRect(x+i*10,y-3,6,6);ctx.fillStyle=i===ui.page?GOLD:MUTED;ctx.fillRect(x+i*10+1,y-2,4,4);}
  }
  if(ui.focus==='playfield')corners(ctx,{x:2,y:2,w:layout.width-4,h:layout.height-4});
}
