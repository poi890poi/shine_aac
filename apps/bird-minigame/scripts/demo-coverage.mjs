export const DEMO_OUTCOMES=Object.freeze(['miss','hit','collision','landing']);
export function demoSegments(trace,duration) {
  const first=type=>trace.find(e=>e.type===type);
  for(const type of [...DEMO_OUTCOMES,'won'])if(!first(type))throw new Error(`Demo missing ${type}`);
  const spans=['miss','hit'].map(type=>{
    const e=first(type),drop=trace.filter(d=>d.type==='drop'&&d.elapsed<=e.elapsed).at(-1);
    if(!drop)throw new Error(`Demo ${type} has no recorded drop`);
    return [Math.max(0,drop.elapsed-.8),Math.min(duration,e.elapsed+1.3)];
  });
  spans.push([Math.max(0,first('collision').elapsed-.8),Math.min(duration,first('collision').elapsed+3.5)]);
  spans.push([Math.max(0,first('landing').elapsed-.8),Math.min(duration,first('won').elapsed+1.5)]);
  const merged=[];
  for(const span of spans.sort((a,b)=>a[0]-b[0])) {
    const last=merged.at(-1);if(last&&span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else merged.push(span);
  }
  verifyDemoCoverage(trace,merged);return merged;
}
export function verifyDemoCoverage(trace,segments) {
  const inside=time=>segments.some(([a,b])=>time>=a&&time<=b);
  for(const type of [...DEMO_OUTCOMES,'won'])if(!trace.some(e=>e.type===type&&inside(e.elapsed)))throw new Error(`Edited demo omits ${type}`);
  const landing=trace.find(e=>e.type==='landing'),won=trace.find(e=>e.type==='won');
  if(!segments.some(([a,b])=>a<=landing.elapsed&&b>=won.elapsed))throw new Error('Edited demo cuts the landing approach');
  return true;
}
