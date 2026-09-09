// Runs unchanged inside desktop Chromium or a physical Android WebView.
// No framebuffer readback or screenshot is allowed inside timed frames.
export async function benchmarkGardenRenderers(base='/apps/bird-minigame/src/',frames=120){
 const {createBirdRenderer}=await import(base+'bird-renderer.js');
 const {createGameState}=await import(base+'game-core.js');
 const results=[];
 for(const backend of ['canvas2d','webgl','webgl','canvas2d']){
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#91d5db';
  const canvas=document.createElement('canvas');host.append(canvas);document.body.append(host);
  const renderer=createBirdRenderer(canvas,{rendererBackend:backend});await renderer.ready;renderer.setScenerySeed(9);
  let state=createGameState({columns:8});state.phase='running';state.mode='flying';state.bird.x=.5;
  const timings=[],intervals=[];let last=0;
  for(let i=0;i<frames+30;i++){
   const timestamp=await new Promise(requestAnimationFrame);state.time=i/60;state.bird.x=.1+(i%120)/150;
   const start=performance.now();renderer.render(state);const elapsed=performance.now()-start;
   if(i>=30){timings.push(elapsed);intervals.push(timestamp-last);}last=timestamp;
  }
  const stats=values=>{const s=[...values].sort((a,b)=>a-b);return {median:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
  results.push({backend,info:canvas.gameRendererInfo(),native:[+canvas.dataset.virtualWidth,+canvas.dataset.virtualHeight],drawMs:stats(timings),frameMs:stats(intervals),frames});
  renderer.destroy();host.remove();
 }
 return results;
}
