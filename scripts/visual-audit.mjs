/** Runs inside the page; consumes rendered geometry, not AAC/game state. */
export function inspectVisualLayout(options = {}) {
  const findings = [], observations = [];
  const selector = options.selector || 'button, input, select, .tile, .tile-label, .message, .phase, .conversation-context-message';
  const minimumTarget = options.minimumTarget ?? 44;
  const rect = r => ({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom});
  const label = el => el.getAttribute('aria-label') || el.dataset.label || el.textContent.trim().slice(0,70) || el.className;
  const visible = el => {
    for (let p=el;p;p=p.parentElement) {
      const s=getComputedStyle(p);
      if (p.hidden || s.display==='none' || s.visibility==='hidden' || Number(s.opacity)===0) return false;
    }
    const r=el.getBoundingClientRect(); return r.width>0 && r.height>0;
  };
  const elements = [...document.querySelectorAll(selector)].filter(visible);
  const controls = elements.filter(el => el.matches('button,input,select,.tile') && !el.disabled);
  const add = (code, el, detail) => findings.push({code,label:label(el),rect:rect(el.getBoundingClientRect()),detail});
  const rgb = value => {
    const v=value.match(/[\d.]+/g)?.map(Number);
    return v && v.length>=3 ? [v[0],v[1],v[2],v[3]??1] : null;
  };
  const over = (a,b) => a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
  const luminance = c => c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
    .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const background = el => {
    const layers=[];
    for(let p=el;p;p=p.parentElement) {
      const s=getComputedStyle(p);
      if(s.backgroundImage!=='none') return null;
      const c=rgb(s.backgroundColor); if(c) layers.push(c);
      if(c?.[3]===1) break;
    }
    return layers.reverse().reduce((b,a)=>over(a,b),[255,255,255]);
  };
  for(const el of elements) {
    const r=el.getBoundingClientRect(), s=getComputedStyle(el);
    let clip={x:0,y:0,right:innerWidth,bottom:innerHeight}, scrollable=false;
    for(let p=el.parentElement;p;p=p.parentElement) {
      const ps=getComputedStyle(p), pr=p.getBoundingClientRect();
      if(/auto|scroll/.test(ps.overflow+ps.overflowY+ps.overflowX)) scrollable=true;
      if(/hidden|clip|auto|scroll/.test(ps.overflow+ps.overflowY+ps.overflowX)) {
        clip={x:Math.max(clip.x,pr.x),y:Math.max(clip.y,pr.y),right:Math.min(clip.right,pr.right),bottom:Math.min(clip.bottom,pr.bottom)};
      }
    }
    const outside = r.x<clip.x-2 || r.y<clip.y-2 || r.right>clip.right+2 || r.bottom>clip.bottom+2;
    if(outside) {
      if(scrollable) observations.push({code:'scroll-required',label:label(el)});
      else add('clipped',el,{clip});
    }
    if(controls.includes(el)) {
      if(r.width<minimumTarget-1 || r.height<minimumTarget-1) add('small-target',el,{minimumTarget});
      const x=r.x+r.width/2,y=r.y+r.height/2;
      if(x>=0&&y>=0&&x<innerWidth&&y<innerHeight) {
        const top=document.elementFromPoint(x,y);
        if(top && top!==el && !el.contains(top) && !top.contains(el)) add('occluded',el,{by:label(top)});
      }
    }
    const text=el.textContent.trim();
    if(text && !el.matches('input,select')) {
      const range=document.createRange(); range.selectNodeContents(el);
      const tr=range.getBoundingClientRect();
      const overflow=tr.width>r.width+2 || tr.height>r.height+2 || el.scrollWidth>el.clientWidth+2 || el.scrollHeight>el.clientHeight+2;
      if(overflow) {
        if(s.textOverflow==='ellipsis' || /auto|scroll/.test(s.overflow+s.overflowY) || options.allowTextOverflow?.some(q=>el.matches(q)))
          observations.push({code:'intentional-text-overflow',label:label(el)});
        else add('text-clipped',el,{textRect:rect(tr)});
      }
      const fg=rgb(s.color), bg=background(el);
      if(fg && bg) {
        const a=luminance(over(fg,bg)), b=luminance(bg), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        const large=parseFloat(s.fontSize)>=24 || (parseFloat(s.fontSize)>=18.66 && Number(s.fontWeight)>=700);
        if(ratio<(large?3:4.5)-.05) add('low-contrast',el,{ratio,minimum:large?3:4.5});
      } else observations.push({code:'contrast-needs-pixel-review',label:label(el)});
    }
  }
  for(let i=0;i<controls.length;i++) for(let j=i+1;j<controls.length;j++) {
    const a=controls[i],b=controls[j]; if(a.contains(b)||b.contains(a)) continue;
    const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
    const overlap=Math.max(0,Math.min(ra.right,rb.right)-Math.max(ra.x,rb.x))*Math.max(0,Math.min(ra.bottom,rb.bottom)-Math.max(ra.y,rb.y));
    if(overlap>Math.min(ra.width*ra.height,rb.width*rb.height)*.05) add('overlap',a,{other:label(b),area:overlap});
  }
  const focused=document.activeElement;
  if(options.requireFocus && focused?.matches(selector)) {
    const s=getComputedStyle(focused);
    if(s.outlineStyle==='none' || parseFloat(s.outlineWidth)<2) add('focus-not-visible',focused,{});
  }
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},checked:elements.length,findings,observations};
}

/** Probe actual canvas pixels plus callback timing; not a presented-frame oracle. */
export function sampleCanvasMotion({selector='.game-canvas',durationMs=6000}={}) {
  const source=document.querySelector(selector);
  if(!source) throw new Error('Motion canvas unavailable: '+selector);
  const probe=document.createElement('canvas');probe.width=128;probe.height=72;
  const ctx=probe.getContext('2d',{willReadFrequently:true}), samples=[];
  return new Promise(resolve=>{
    let start;
    function tick(now) {
      start??=now;
      ctx.drawImage(source,0,0,128,72);
      const data=ctx.getImageData(0,0,128,72).data;
      let hash=2166136261,min=[255,255,255],max=[0,0,0];
      for(let i=0;i<data.length;i+=4) {
        for(let c=0;c<3;c++){const v=data[i+c];hash=Math.imul(hash^(v>>3),16777619);min[c]=Math.min(min[c],v);max[c]=Math.max(max[c],v);}
      }
      samples.push({t:now-start,hash:hash>>>0,range:Math.max(...max.map((v,c)=>v-min[c]))});
      if(now-start>=durationMs) resolve(samples);else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export function analyzeMotion(samples,{expectedMoving=true,maxGapMs=250,freezeMs=500,p95BudgetMs=50}={}) {
  if(samples.length<3) return {findings:[{code:'insufficient-frames'}],samples:samples.length};
  const gaps=samples.slice(1).map((s,i)=>s.t-samples[i].t), sorted=[...gaps].sort((a,b)=>a-b);
  let heldSince=samples[0].t,longestHeldMs=0;
  for(let i=1;i<samples.length;i++) {
    if(samples[i].hash!==samples[i-1].hash) heldSince=samples[i].t;
    else longestHeldMs=Math.max(longestHeldMs,samples[i].t-heldSince);
  }
  const stats={samples:samples.length,durationMs:samples.at(-1).t,medianMs:sorted[Math.floor(sorted.length*.5)],
    p95Ms:sorted[Math.floor(sorted.length*.95)],maxGapMs:Math.max(...gaps),over50ms:gaps.filter(n=>n>50).length,longestHeldMs,
    blankSamples:samples.filter(s=>s.range<3).length};
  const findings=[];
  if(stats.maxGapMs>maxGapMs) findings.push({code:'long-frame-gap',value:stats.maxGapMs});
  if(stats.p95Ms>p95BudgetMs) findings.push({code:'frame-pacing',value:stats.p95Ms});
  if(expectedMoving&&longestHeldMs>freezeMs) findings.push({code:'frozen-pixels',value:longestHeldMs});
  if(stats.blankSamples) findings.push({code:'blank-canvas',value:stats.blankSamples});
  return {...stats,findings};
}
