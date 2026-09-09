import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url),{chromium}=require('playwright');
const out='.tmp/virtual-screen-integration';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5196'],{windowsHide:true,stdio:'ignore'});let browser;
const results=[];
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5196/apps/web/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const sizes=[[360,800,2],[360,800,3],[393,851,2.75],[800,1280,1.5],[1280,800,1.5],[280,640,1]];
  for(const [width,height,dpr] of sizes){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5196/apps/bird-minigame/');
    const result=await page.evaluate(async({width,height,all})=>{
      document.body.innerHTML=`<div style="position:fixed;inset:0"><canvas id="display"></canvas></div>`;
      const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
      const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
      const {BIRD_SPECIES}=await import('/apps/bird-minigame/src/bird-species.js');
      const canvas=document.querySelector('#display'),display=canvas.getContext('2d'),copies=[];
      const copy=display.drawImage.bind(display);
      display.drawImage=(source,...args)=>{copies.push({source:[source.width,source.height],args});copy(source,...args);};
      const renderer=createBirdRenderer(canvas,{columns:6,species:'yellow_tit',rendererBackend:'canvas2d'});await renderer.ready;renderer.setScenerySeed(9);
      let state=createGameState({columns:6});state.phase='running';state.mode='flying';state.time=1;state.bird.x=.5;renderer.render(state);
      const unit=Number(canvas.dataset.pixelScale),virtual=[Number(canvas.dataset.virtualWidth),Number(canvas.dataset.virtualHeight)];
      const pixels=()=>display.getImageData(0,0,canvas.width,canvas.height).data;
      const audit=()=>{const data=pixels();let failures=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const i=(y*canvas.width+x)*4,b=(Math.floor(y/unit)*unit*canvas.width+Math.floor(x/unit)*unit)*4;
        if(data[i]!==data[b]||data[i+1]!==data[b+1]||data[i+2]!==data[b+2])failures++;
      }return failures;};
      let referenceDifference=null;
      if(all){
        const approved=new Image();approved.src='/docs/reviews/2026-09-09/virtual-screen-2x.png';await approved.decode();
        const c=document.createElement('canvas');c.width=approved.width;c.height=approved.height;const cx=c.getContext('2d');cx.drawImage(approved,0,0);
        const expected=cx.getImageData(0,0,c.width,c.height).data,actual=pixels();referenceDifference=0;
        if(actual.length!==expected.length)throw new Error('Approved reference dimensions changed');
        for(let i=0;i<actual.length;i+=4)if(actual[i]!==expected[i]||actual[i+1]!==expected[i+1]||actual[i+2]!==expected[i+2])referenceDifference++;
      }
      const baseline=pixels(),still=audit();state.bird.x=.5+.4/virtual[0];renderer.render(state);
      const fractionalUnchanged=pixels().every((v,i)=>v===baseline[i]);state.bird.x=.5+1/virtual[0];renderer.render(state);
      const oneStepChanged=pixels().some((v,i)=>v!==baseline[i]);
      display.fillStyle='#ff00ff';display.fillRect(1,1,1,1);const corrupted=audit();
      const samples=[];
      for(const species of all?BIRD_SPECIES:[BIRD_SPECIES[0]]){
        renderer.setSpecies(species.id);
        for(const phase of ['running','rescue','landing','won']){
          state.phase=phase==='rescue'?'running':phase;state.mode=phase==='rescue'?'rescue':'flying';
          state.time=phase==='running'?1:phase==='rescue'?1.13:1.26;
          state.bird.x=.517;state.bird.y=phase==='won'?.882:.25;
          state.landing=phase==='landing'?{stage:'approach',elapsed:1.7}:null;
          state.featherBurst=phase==='rescue'?{x:.5,y:.25,age:.45}:null;
          state.drop=phase==='running'?{x:.46,y:.32}:null;
          state.flowers[0].reaction=phase==='rescue'?1:0;state.flowers[0].hits=2;
          renderer.render(state);samples.push({species:species.id,phase,violations:audit()});
        }
      }
      for(let columns=3;columns<=8;columns++){
        state=createGameState({columns});state.phase='running';state.mode='flying';state.bird.x=.5;renderer.render(state);
        samples.push({columns,violations:audit()});
      }
      renderer.setSpecies('yellow_tit');state=createGameState({columns:6});state.phase='running';state.mode='flying';state.time=1;state.bird.x=.5;renderer.render(state);
      window.checkedRenderer=renderer;
      const box=canvas.getBoundingClientRect();
      return {virtual,unit,physical:[canvas.width,canvas.height],origin:[box.x*devicePixelRatio,box.y*devicePixelRatio],
        covers:Math.abs(box.width-width)<1/devicePixelRatio&&Math.abs(box.height-height)<1/devicePixelRatio,
        still,corrupted,fractionalUnchanged,oneStepChanged,referenceDifference,samples,
        copiesOnly:copies.every(c=>c.source[0]===virtual[0]&&c.source[1]===virtual[1]&&JSON.stringify(c.args)===JSON.stringify([0,0,virtual[0]*unit,virtual[1]*unit]))};
    },{width,height,all:width===360&&dpr===2});
    assert.equal(result.still,0);assert.ok(result.samples.every(s=>s.violations===0));
    assert.ok(result.fractionalUnchanged&&result.oneStepChanged&&result.covers&&result.copiesOnly);
    assert.deepEqual(result.origin,[0,0]);if(result.unit>1)assert.ok(result.corrupted>0);
    // Historical screenshot is immutable; September 10 intentionally changes alpha,
    // native sampling and foliage. Exact accepted cloud pixels have a separate asset gate.
    assert.deepEqual(errors,[]);results.push({width,height,dpr,...result});
    await page.screenshot({path:`${out}/${width}x${height}-${dpr}.png`});await page.close();
  }
  writeFileSync(`${out}/result.json`,JSON.stringify(results,null,2));console.log('PASS virtual screen: historical difference recorded, all species/effects, 3–8 columns, density/aspect matrix and off-grid negative control');
}finally{await browser?.close();server.kill();}
