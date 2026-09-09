import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url);
const {chromium}=require('playwright');
const out=process.argv[2]||'.tmp/shared-pixel-grid-review';mkdirSync(out,{recursive:true});
// Freeze the size-approved arrangement B, rather than rerolling composition.
const cloudRecipe=JSON.parse(readFileSync(new URL('../apps/bird-minigame/research/shared-grid-review.json',import.meta.url),'utf8')).cloudRecipe;
assert.ok(cloudRecipe?.placements);
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5195'],{windowsHide:true,stdio:'ignore'});
const variants=[{unit:1,label:'Approved sizes · mixed detail'},{unit:1,fine:true,label:'Fine grid · rebuilt scenery'},{unit:2,label:'2 px grid · rejected detail loss'}];
const variantId=v=>v.fine?'fine':String(v.unit);
const sceneryPreparation=`
const nativeGridCache=new WeakMap();
function nativeScenery(source,w,h,tones,blur){
  let cache=nativeGridCache.get(source);if(!cache){cache=new Map();nativeGridCache.set(source,cache);}
  const key=w+','+h;if(cache.has(key))return cache.get(key);
  const c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d');
  cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.filter='blur('+blur+'px)';cx.drawImage(source,0,0,w,h);cx.filter='none';
  const f=cx.getImageData(0,0,w,h),d=f.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<128){d[i+3]=0;continue;}
    let best=tones[0],distance=Infinity;
    for(const tone of tones){const delta=(d[i]-tone[0])**2+(d[i+1]-tone[1])**2+(d[i+2]-tone[2])**2;if(delta<distance){distance=delta;best=tone;}}
    d.set([...best,255],i);
  }
  cx.putImageData(f,0,0);cache.set(key,c);return c;
}
`;
const metrics=[];let browser;
const historicalSource=path=>execFileSync('git',['show',`2d6b8d6:${path}`],{encoding:'utf8',windowsHide:true});
const originalScenery=historicalSource('apps/bird-minigame/src/reviewed-scenery.js');
const originalRenderer=historicalSource('apps/bird-minigame/src/bird-renderer.js');
function nativeGridRenderer(source,unit){
  const replace=(from,to)=>{assert.ok(source.includes(from),`Missing renderer seam: ${from}`);source=source.replace(from,to);};
  replace("const ctx=canvas.getContext('2d',{alpha:false});",`
    const display=canvas.getContext('2d',{alpha:false});
    const native=document.createElement('canvas'),ctx=native.getContext('2d',{alpha:false});
    const unit=${unit},snap=n=>Math.round(n/unit)*unit,size=n=>n===0?0:Math.max(unit,Math.round(n/unit)*unit);
    const fill=ctx.fillRect.bind(ctx),translate=ctx.translate.bind(ctx),draw=ctx.drawImage.bind(ctx);
    ctx.fillRect=(x,y,w,h)=>fill(snap(x),snap(y),size(w),size(h));
    ctx.translate=(x,y)=>translate(snap(x),snap(y));
    ctx.drawImage=(image,...args)=>{
      if(args.length===4)args=[snap(args[0]),snap(args[1]),size(args[2]),size(args[3])];
      else if(args.length===8)args=[...args.slice(0,4),snap(args[4]),snap(args[5]),size(args[6]),size(args[7])];
      else if(args.length===2)args=[snap(args[0]),snap(args[1]),size(image.width),size(image.height)];
      else throw new Error('Unsupported image sampling call');
      draw(image,...args);
    };
  `);
  replace('ctx.imageSmoothingEnabled=false;',`native.width=Math.ceil(canvas.width/unit);native.height=Math.ceil(canvas.height/unit);
    ctx.setTransform(1/unit,0,0,1/unit,0,0);ctx.imageSmoothingEnabled=false;display.imageSmoothingEnabled=false;`);
  replace('ctx.restore();paintAmmo(ctx,state,w);',`ctx.restore();paintAmmo(ctx,state,w);
    display.drawImage(native,0,0,native.width*unit,native.height*unit);`);
  return source;
}
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5195/apps/web/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const variant of variants){
    const page=await browser.newPage({viewport:{width:360,height:800},deviceScaleFactor:1});
    await page.route('**/src/reviewed-scenery.js',async route=>{
      const response=await route.fetch();let body=originalScenery.replace(/export const CLOUD_PLACEMENTS=.*?;/,`export const CLOUD_PLACEMENTS=${JSON.stringify(cloudRecipe.placements)};`);
      if(variant.fine){
        body+=sceneryPreparation;
        body=body.replace('ctx.drawImage(im,x,position.y,cw,ch);','ctx.drawImage(nativeScenery(im,cw,ch,VISUAL_TUNING.cloudTones,1.25),x,position.y);');
        body=body.replace('ctx.drawImage(im,mx,ground-108-mh,mw,mh);',"ctx.drawImage(nativeScenery(im,mw,mh,mood.colors.map(hex=>hex.match(/[0-9a-f]{2}/g).map(n=>parseInt(n,16))),.6),mx,ground-108-mh);");
      }
      await route.fulfill({response,body});
    });
    await page.route('**/src/bird-renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:variant.unit>1?nativeGridRenderer(originalRenderer,variant.unit):originalRenderer});});
    await page.goto('http://127.0.0.1:5195/apps/bird-minigame/');
    await page.evaluate(async()=>{
      document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="review"></canvas></div>';
      const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
      const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
      const renderer=createBirdRenderer(document.querySelector('#review'),{columns:6,species:'yellow_tit'});
      await renderer.ready;renderer.setScenerySeed(9);
      const state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.5;state.time=1;
      renderer.render(state);window.reviewRenderer=renderer;window.reviewState=state;
    });
    await page.screenshot({path:`${out}/grid-${variantId(variant)}.png`});
    const checks=await page.evaluate(unit=>{
      const canvas=document.querySelector('#review'),ctx=canvas.getContext('2d'),frame=ctx.getImageData(0,0,canvas.width,canvas.height);
      const audit=data=>{let violations=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const at=(y*canvas.width+x)*4,base=(Math.floor(y/unit)*unit*canvas.width+Math.floor(x/unit)*unit)*4;
        if(data[at]!==data[base]||data[at+1]!==data[base+1]||data[at+2]!==data[base+2])violations++;
      }return violations;};
      const violations=audit(frame.data);frame.data[4]^=127;
      const corruptedViolations=audit(frame.data);
      const crops=[['bird',85,58,145,125],['cloud',2,155,155,160],['flower-stem',170,347,66,185]];
      const urls=crops.map(([name,x,y,w,h])=>{const c=document.createElement('canvas');c.width=w*3;c.height=h*3;const cx=c.getContext('2d');cx.imageSmoothingEnabled=false;cx.drawImage(canvas,x,y,w,h,0,0,c.width,c.height);return {name,url:c.toDataURL()};});
      return {violations,corruptedViolations,crops:urls};
    },variant.unit);
    if(variant.unit>1){assert.equal(checks.violations,0);assert.ok(checks.corruptedViolations>0,'single off-grid pixel must fail');}
    for(const crop of checks.crops)writeFileSync(`${out}/${crop.name}-${variantId(variant)}.png`,Buffer.from(crop.url.split(',')[1],'base64'));
    metrics.push({variant:variantId(variant),unit:variant.unit,violations:checks.violations,corruptedViolations:checks.corruptedViolations});
    if(variant.fine){
      // Actual low-resolution framebuffer: every game layer has already rendered
      // into #review. The display context receives only this completed frame.
      await page.evaluate(()=>{
        const frame=document.querySelector('#review'),holder=frame.parentElement;
        holder.style.cssText='position:fixed;left:-10000px;top:0;width:360px;height:800px';
        const output=document.createElement('canvas');output.id='display';output.width=720;output.height=1600;
        output.style.cssText='display:block;width:720px;height:1600px';document.body.style.cssText='margin:0;padding:0';document.body.append(output);
        const display=output.getContext('2d',{alpha:false});display.imageSmoothingEnabled=false;
        window.presentReviewFrame=()=>{
          if(frame.width!==360||frame.height!==800)throw new Error('Virtual resolution changed with display size');
          display.drawImage(frame,0,0,720,1600);
        };
        presentReviewFrame();
      });
      await page.setViewportSize({width:720,height:1600});
      await page.evaluate(()=>presentReviewFrame());
      const evidence=await page.evaluate(()=>{
        const output=document.querySelector('#display'),display=output.getContext('2d');
        const check=()=>{const data=display.getImageData(0,0,720,1600).data;let violations=0;
          for(let y=0;y<1600;y++)for(let x=0;x<720;x++){const i=(y*720+x)*4,b=((y-y%2)*720+x-x%2)*4;
            if(data[i]!==data[b]||data[i+1]!==data[b+1]||data[i+2]!==data[b+2])violations++;}return violations;};
        const still=check();
        // A deliberate half-virtual-pixel overlay must fail shared-origin checks.
        display.fillStyle='#ff00ff';display.fillRect(101,301,2,2);const shiftedOverlay=check();
        const positions=[.5,.5+.4/360,.5+1/360,.517],motion=[];let initialPixels;
        for(const x of positions){
          reviewState.bird.x=x;reviewRenderer.render(reviewState);presentReviewFrame();
          const pixels=display.getImageData(0,0,720,1600).data;
          if(!initialPixels)initialPixels=pixels;
          motion.push({x,violations:check(),sameAsInitial:pixels.every((value,index)=>value===initialPixels[index])});
        }
        reviewState.bird.x=.5;reviewRenderer.render(reviewState);presentReviewFrame();
        return {virtual:[360,800],display:[720,1600],origin:[0,0],scale:2,still,shiftedOverlay,motion};
      });
      assert.equal(evidence.still,0);assert.ok(evidence.shiftedOverlay>0);
      assert.ok(evidence.motion.every(frame=>frame.violations===0));
      assert.ok(evidence.motion[1].sameAsInitial,'subpixel physics motion must not move a displayed pixel');
      assert.equal(evidence.motion[2].sameAsInitial,false,'one virtual pixel must visibly move the bird');
      metrics.push({virtualScreen:evidence});
      await page.locator('#display').screenshot({path:`${out}/virtual-screen-2x.png`});
    }
    // Independent motion sample: the common grid must survive fractional positions.
    if(variant.unit>1){await page.evaluate(()=>{reviewState.bird.x=.517;reviewState.time=3.37;reviewRenderer.render(reviewState)});await page.screenshot({path:`${out}/motion-${variant.unit}.png`});}
    await page.close();
  }
  const img=n=>'data:image/png;base64,'+readFileSync(`${out}/${n}.png`).toString('base64');
  const style='<style>body{margin:0;padding:28px;background:#edf1f5;color:#172331;font:18px/1.45 Arial}h1{margin:0;font-size:28px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{background:white;padding:16px}h2{font-size:19px;margin:0 0 12px}.scene{display:block;width:360px}.detail{display:block;image-rendering:pixelated}p{max-width:1400px}</style>';
  for(const [name,content] of [
    ['shared-grid-scene',`<h1>Keep fine character detail; rebuild scenery on its grid</h1><p>Same approved large cloud sizes and arrangement. The middle candidate prepares clouds and mountains at their final native size, with binary edges and their existing flat palettes. Birds, flowers, stems and grass retain their rendering.</p><div class="grid">${variants.map(v=>`<div class="card"><h2>${v.label}</h2><img class="scene" src="${img(`grid-${variantId(v)}`)}"></div>`).join('')}</div><p>Review only. The coarse option passes pixel-alignment checks but damages expressions and stems: it is rejected. The fine candidate still requires visual acceptance; a grid check alone is insufficient.</p>`],
    ['shared-grid-details',`<h1>Shape review at exact 3× magnification</h1><p>Inspect the eye, bill, wing feathers, cloud edges, flower expression and stem attachments. Images use integer enlargement without CSS reduction.</p>${['bird','cloud','flower-stem'].map(part=>`<h2>${part}</h2><div class="grid">${variants.map(v=>`<div class="card"><h2>${v.label}</h2><img class="detail" src="${img(`${part}-${variantId(v)}`)}"></div>`).join('')}</div>`).join('')}<p>The fine candidate resamples scenery masks and palette bands before native rendering. The coarser candidate demonstrates why uniform pixel blocks cannot substitute for shape review. No app assets changed.</p>`]
  ]){const html=style+content;writeFileSync(`${out}/${name}.html`,html);const page=await browser.newPage({viewport:{width:name.endsWith('details')?1588:1252,height:1100}});await page.setContent(html);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});await page.close();}
  writeFileSync(`${out}/metrics.json`,JSON.stringify({metrics,cloudRecipe,method:'review-only shared native rendering grid; no final-frame color filter'},null,2));
  console.log(JSON.stringify(metrics));
}finally{await browser?.close();server.kill();}
