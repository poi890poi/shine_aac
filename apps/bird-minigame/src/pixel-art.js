// Native indexed-pixel drawing. Every object uses this same grid and outline rule.
export class PixelSurface {
  constructor(width,height,style) {
    this.width=width;this.height=height;this.style=style;
    this.roles=Object.keys(style.palette);
    this.indices=Object.fromEntries(this.roles.map((key,index)=>[key,index]));
    this.data=new Uint8Array(width*height);
    this.colors=Object.values(style.palette).map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  }
  pixel(x,y,color) {
    x=Math.round(x);y=Math.round(y);
    if(x>=0&&y>=0&&x<this.width&&y<this.height)this.data[y*this.width+x]=this.indices[color];
  }
  rect(x,y,w,h,color) {
    x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
    const start=Math.max(0,x),end=Math.min(this.width,x+w);
    if(end<=start)return;
    for(let py=Math.max(0,y);py<Math.min(this.height,y+h);py++)
      this.data.fill(this.indices[color],py*this.width+start,py*this.width+end);
  }
  clear(color) {this.data.fill(this.indices[color]);}
  shape(bounds,inside,material,{outline=this.style.outline.foreground,flat=null,normalAt=null}={}) {
    const [left,top,right,bottom]=bounds.map(Math.round),radius=this.style.outline.width;
    const ramp=this.style.ramps[material],light=this.style.shading.lightDirection,norm=Math.hypot(...light);
    for(let y=Math.max(0,top);y<=Math.min(this.height-1,bottom);y++)for(let x=Math.max(0,left);x<=Math.min(this.width-1,right);x++) {
      if(!inside(x,y))continue;
      let edge=false;
      for(let d=1;d<=radius;d++)if(!inside(x-d,y)||!inside(x+d,y)||!inside(x,y-d)||!inside(x,y+d)){edge=true;break;}
      const [nx,ny]=normalAt?normalAt(x,y):[(x-(left+right)/2)/Math.max(1,(right-left)/2),(y-(top+bottom)/2)/Math.max(1,(bottom-top)/2)];
      const away=-(nx*light[0]+ny*light[1])/norm;
      const band=away>this.style.shading.shadowThreshold?0:this.style.shading.bands===3&&away<this.style.shading.highlightThreshold?2:1;
      this.pixel(x,y,edge?outline:flat??ramp[band]);
    }
  }
  ellipse(cx,cy,rx,ry,material,options) {
    cx=Math.round(cx);cy=Math.round(cy);rx=Math.max(1,Math.round(rx));ry=Math.max(1,Math.round(ry));
    this.shape([cx-rx,cy-ry,cx+rx,cy+ry],(x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1.06,material,options);
  }
  polygon(points,material,options) {
    const p=points.map(([x,y])=>[Math.round(x),Math.round(y)]),xs=p.map(v=>v[0]),ys=p.map(v=>v[1]);
    this.shape([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],(x,y)=>{
      let result=false;
      for(let i=0,j=p.length-1;i<p.length;j=i++) {
        const [xi,yi]=p[i],[xj,yj]=p[j];
        if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)result=!result;
      }
      return result;
    },material,options);
  }
  line(points,color,width=1) {
    for(let i=1;i<points.length;i++) {
      let [x0,y0]=points[i-1].map(Math.round);const [x1,y1]=points[i].map(Math.round);
      const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
      let err=dx+dy;
      for(;;) {
        this.rect(x0-Math.floor(width/2),y0-Math.floor(width/2),width,width,color);
        if(x0===x1&&y0===y1)break;
        const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}
      }
    }
  }
  rgba(target=new Uint8ClampedArray(this.data.length*4)) {
    for(let i=0;i<this.data.length;i++) {
      const c=this.colors[this.data[i]],j=i*4;
      target[j]=c[0];target[j+1]=c[1];target[j+2]=c[2];target[j+3]=255;
    }
    return target;
  }
}

export function tailCenterline(length,dynamics,samples=64) {
  const {bendStartRatio:b,tipDropRatio:drop,tipTangentDegrees:angle}=dynamics;
  const slope=(1-b)*Math.tan(angle*Math.PI/180);
  const ys=Array.from({length:samples+1},(_,i)=>{
    const t=i/samples;if(t<=b)return 0;
    const v=(t-b)/(1-b);return ((slope-2*drop)*v**3+(3*drop-slope)*v**2)*length;
  });
  const arc=span=>ys.reduce((sum,y,i)=>i?sum+Math.hypot(span/samples,y-ys[i-1]):0,0);
  let low=0,high=length;
  for(let i=0;i<36;i++){const mid=(low+high)/2;if(arc(mid)>length)high=mid;else low=mid;}
  return ys.map((y,i)=>[-(low+high)/2*i/samples,y]);
}

export function birdGeometry(rules) {
  const r=rules.species.ratios,e=rules.cartoon.sharedExaggeration,unit=rules.style.bird.torsoPixels/100;
  return {unit,torso:100*unit,depth:r.torsoDepth*e.torsoDepth*unit,
    head:r.headDiameter*e.headDiameter*unit,bill:r.billLength*e.billLength*unit,
    wing:r.wingLength*e.wingLength*unit,tail:r.tailLength*e.tailLength*unit,tailWidth:r.tailWidth*unit};
}

export function drawBird(p,x,y,rules,frame=0,landed=false,recoil=false) {
  const g=birdGeometry(rules),style=p.style,shoulder=x+g.torso*0.25,root=shoulder-g.torso;
  const headX=shoulder+g.head*0.3,headY=y-g.depth*0.32;
  const poses=[rules.rig.phases.recovery_upstroke,null,rules.rig.phases.power_downstroke,null];
  const pose=poses[frame%4]??{nearWingAngle:8,farWingAngle:4,nearWingSpread:0.85};
  const tail=tailCenterline(g.tail,rules.feathers);
  const tailPaths=[];
  for(let f=0;f<style.bird.tailFeathers;f++) {
    const separation=(f-(style.bird.tailFeathers-1)/2)*g.tailWidth*(0.5+1-rules.feathers.bundleCoherence);
    const points=tail.map(([dx,dy],i)=>[root+dx,y+dy+separation*(0.25+0.75*i/(tail.length-1))]);
    tailPaths.push(points);
    p.line(points,style.outline.foreground,1+2*style.outline.width);
  }
  for(const points of tailPaths) {
    p.line(points,'blue',1);
    p.line(points.slice(Math.floor((1-style.bird.tailTipFraction)*points.length)),'white',1);
  }
  const wing=(angle,scale,far=false)=>{
    const radians=angle*Math.PI/180,L=g.wing*scale,tx=shoulder-Math.cos(radians)*L,ty=y-Math.sin(radians)*L;
    const normal=[Math.sin(radians),-Math.cos(radians)],spread=L*0.25*(pose.nearWingSpread??0.85);
    p.polygon([[shoulder,y],[shoulder-L*0.2+normal[0]*spread,y+normal[1]*spread],
      [tx+normal[0]*spread*0.6,ty+normal[1]*spread*0.6],[tx,ty],
      [shoulder-L*0.42-normal[0]*spread,y-normal[1]*spread]],'bird',far?{flat:'blueShadow'}:undefined);
    if(!far)p.line([[shoulder-3,y-1],[shoulder+(tx-shoulder)*0.68,y+(ty-y)*0.68]],'blueShadow',1);
  };
  if(!landed)wing(pose.farWingAngle,rules.poseInvariants.farWingScale,true);
  p.ellipse(shoulder-g.torso/2,y,g.torso/2,g.depth/2,'bird');
  if(landed)p.ellipse(shoulder-g.torso*0.53,y-1,g.torso*0.32,g.depth*0.32,'bird');else wing(pose.nearWingAngle,1);
  p.ellipse(headX,headY,g.head/2,g.head/2,'bird',{flat:'ink'});
  p.polygon([[headX+g.head/2-1,headY-1],[headX+g.head/2+g.bill,headY+1],[headX+g.head/2-1,headY+2]],'petal',{flat:'petalShadow'});
  p.line([[headX+g.head/2,headY],[headX+g.head/2+g.bill-2,headY+1]],'petalShadow',1);
  p.rect(Math.round(headX)+1,Math.round(headY)-1,style.bird.eyePixels+1,style.bird.eyePixels+1,'gold');p.pixel(headX+2,headY,'ink');
  if(landed){p.line([[x-2,y+g.depth/2],[x-2,y+g.depth/2+3],[x+1,y+g.depth/2+3]],'petalShadow');
    p.line([[x+3,y+g.depth/2],[x+3,y+g.depth/2+3],[x+6,y+g.depth/2+3]],'petalShadow');}
  if(recoil)p.line([[headX+7,headY-9],[headX+8,headY-12]],'gold',2);
}

export function drawFlower(p,x,top,ground,flower) {
  const s=p.style.flower,r=s.headRadius,stemTop=top+s.faceRadius,length=Math.max(0,ground-stemTop),half=Math.floor(s.stemWidth/2);
  const outline=p.style.outline.width;
  if(length>s.leafLength*2)s.leafLevels.forEach((level,index)=>{
    const y=Math.round(stemTop+length*level),side=index%2?-1:1;
    p.polygon([[x,y+2],[x+side*s.leafLength,y-s.leafWidth],[x+side*(s.leafLength-1),y+1],[x,y+4]],'plant');
  });
  p.rect(x-half-outline,stemTop,s.stemWidth+2*outline,length+1,p.style.outline.foreground);p.rect(x-half,stemTop,s.stemWidth,length,'green');p.rect(x-half,stemTop,1,length,'greenLight');
  const hit=flower.reaction>0;
  for(let i=0;i<s.petalCount;i++) {
    const a=-Math.PI/2+i*Math.PI*2/s.petalCount,droop=hit&&i>s.petalCount/2?2:0;
    p.ellipse(x+Math.cos(a)*s.petalRingRadius,top+Math.sin(a)*s.petalRingRadius+droop,s.petalRadius,s.petalRadius,'petal');
  }
  p.ellipse(x,top,s.faceRadius,s.faceRadius,'face');
  if(hit) {
    p.line([[x-4,top-2],[x-2,top-1]],'ink');p.rect(x+2,top-3,2,3,'white');p.pixel(x+2,top-1,'ink');
    p.line([[x-3,top+3],[x,top+2],[x+3,top+3]],'ink');
    p.line([[x-3,top-r+2],[x-1,top-r+2],[x,top-r+6],[x+2,top-r+7]],'cloudShadow',4);
    p.line([[x-3,top-r+1],[x-1,top-r+1],[x,top-r+5],[x+2,top-r+6]],'white',2);
    p.line([[x-r-2,top-6],[x-r-4,top-8]],'white',2);p.line([[x+r+1,top-8],[x+r+3,top-10]],'white',2);
  } else {
    p.rect(x-3,top-2,2,3,'ink');p.rect(x+2,top-2,2,3,'ink');
    p.line([[x-2,top+3],[x-1,top+4],[x+1,top+4],[x+2,top+3]],'ink');
  }
  if(flower.blocked>0){p.rect(x-1,top-r-7,2,4,'ink');p.rect(x-1,top-r-2,2,1,'ink');}
}

export function drawCloud(p,x,y,scale=1,shapeIndex=0) {
  const s=p.style.cloud,shape=s.shapes?.[shapeIndex%s.shapes.length]??{};
  const w=Math.round(s.width*scale*(shape.widthScale??1)),h=Math.round(s.height*scale*(shape.heightScale??1));
  x=Math.round(x);y=Math.round(y);
  const lobes=(shape.lobeCenters??s.lobeCenters).map(([cx,cy,r])=>[Math.round(x+cx*w),Math.round(y+cy*h),Math.max(1,Math.round(r*w)),Math.max(1,Math.round(r*h*(s.puffiness??1.6)))]);
  const bottom=y+Math.round(h*(s.baseHeight??0.9));
  p.shape([x,y,x+w,bottom],(px,py)=>px>=x&&px<=x+w&&py>=y&&py<=bottom&&lobes.some(([cx,cy,rx,ry])=>
    ((px-cx)/rx)**2+((py-cy)/ry)**2<=1),'cloud',{outline:p.style.outline.background,
      normalAt:(px,py)=>{
        let best=Infinity,normal=[0,0];
        for(const [cx,cy,rx,ry] of lobes){const nx=(px-cx)/rx,ny=(py-cy)/ry,d=nx*nx+ny*ny;if(d<best){best=d;normal=[nx,ny];}}
        return normal;
      }});
}

export function cloudPlacements(style,width,height,time=0,reducedMotion=false) {
  const s=style.cloud,count=s.count??6,variation=s.sizeVariation??0.2;
  const [low,high]=s.altitudeRange??[0.08,0.58],t=reducedMotion?0:time;
  return Array.from({length:count},(_,i)=>{
    const shapeIndex=i%(s.shapes?.length??1),shape=s.shapes?.[shapeIndex]??{};
    const scale=1+variation*Math.sin(i*2.4+1),cloudWidth=Math.round(s.width*scale*(shape.widthScale??1));
    const span=width+cloudWidth+2,phase=(.24+i*.61803398875)%1;
    const drift=t*style.animation.cloudPixelsPerSecond*(.8+(i%3)*.15);
    return {x:Math.floor(((phase*span+drift)%span+span)%span)-cloudWidth-1,
      y:Math.round(height*(low+(high-low)*(count===1?.5:i/(count-1)))),scale,shapeIndex,cloudWidth};
  });
}

export function drawCloudField(p,time=0,reducedMotion=false) {
  for(const cloud of cloudPlacements(p.style,p.width,p.height,time,reducedMotion))drawCloud(p,cloud.x,cloud.y,cloud.scale,cloud.shapeIndex);
}

export function drawGrass(p,ground) {
  const {tileSize,bladeHeight,tuftWidth}=p.style.grass;
  p.rect(0,ground,p.width,p.height-ground,'green');
  for(let x=0;x<p.width;x+=tileSize) {
    const rise=bladeHeight+(x/tileSize%3)-1;
    p.polygon([[x,ground+2],[x+2,ground-rise],[x+3,ground-1],[x+5,ground-rise-1],
      [x+6,ground],[x+9,ground-2],[x+11,ground+3]],'plant',{outline:'greenShadow'});
  }
  const density=p.style.clusters.textureDensity;if(density<=0)return;
  const stride=Math.max(tileSize,Math.round(tileSize*0.16/density));
  for(let y=ground+8;y<p.height;y+=tileSize)for(let x=0;x<p.width;x+=stride) {
    const tx=x+(Math.floor(y/tileSize)%2)*Math.floor(tileSize/2),ty=y+(x/stride%3)*2;
    p.line([[tx,ty-2],[tx+1,ty+1],[tx+tuftWidth,ty-1]],'greenShadow',1);
    if(p.style.clusters.minimumArea<=tuftWidth)p.line([[tx-1,ty-2],[tx,ty]],'greenLight',1);
  }
}

export function renderPixelScene(p,state,rules,reducedMotion=false) {
  p.clear('sky');
  const {width:w,height:h}=p,ground=Math.round(state.config.groundY*h);
  const t=reducedMotion?0:Math.floor(state.time*rules.style.animation.framesPerSecond)/rules.style.animation.framesPerSecond;
  drawCloudField(p,t,reducedMotion);
  drawGrass(p,ground);
  for(const f of state.flowers)if(f.displayHeight>0.001)drawFlower(p,Math.round(f.x*w),Math.round((state.config.groundY-f.displayHeight)*h),ground,f);
  if(state.drop) {
    const x=Math.round(state.drop.x*w),y=Math.round(state.drop.y*h);
    p.line([[x,y-5],[x-1,y],[x+1,y+2]],'ink',3);p.line([[x,y-4],[x-1,y],[x+1,y+1]],'white',1);
  }
  const frame=['paused','won','ready','exited'].includes(state.phase)?1:Math.floor(t*rules.style.animation.framesPerSecond)%4;
  const bx=state.phase==='ready'?w*0.3:Math.round(state.bird.x*w),by=Math.round(state.bird.y*h);
  drawBird(p,bx,by,rules,frame,state.phase==='won',!reducedMotion&&state.mode==='rescue');
  if(state.mode==='entry'&&state.phase==='running')for(let i=0;i<3;i++)p.line([[3+i*5,by-2],[5+i*5,by],[3+i*5,by+2]],'ink');
}
