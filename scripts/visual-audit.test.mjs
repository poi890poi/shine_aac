import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {inspectVisualLayout,sampleCanvasMotion,analyzeMotion} from './visual-audit.mjs';

test('rendered geometry detects injected defects and a clean control',async()=>{
  const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url);
  const {chromium}=require('playwright');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:640,height:480}});
    const base='<style>body{margin:20px;background:white}button{width:140px;height:56px;background:white;color:black;font:20px Arial;border:2px solid black}</style>';
    for(const [name,html,expected] of [
      ['clean','<button>Continue</button>',null],
      ['clipped','<button style="position:absolute;left:600px">Continue</button>','clipped'],
      ['overlap','<button>A</button><button style="position:absolute;left:80px">B</button>','overlap'],
      ['contrast','<button style="color:#ddd">Continue</button>','low-contrast'],
      ['label cut','<div class="conversation-context-message" style="height:8px;overflow:hidden">Previous sentence</div>','text-clipped'],
      ['target','<button style="width:30px;height:30px">X</button>','small-target'],
    ]) {
      await page.setContent(base+html);
      const result=await page.evaluate(inspectVisualLayout);
      if(expected)assert.ok(result.findings.some(f=>f.code===expected),name+JSON.stringify(result));
      else assert.deepEqual(result.findings,[],name);
    }
    for(const color of ['black','#8fd2d7']) {
      await page.setContent('<canvas class="game-canvas" width="128" height="72"></canvas>');
      await page.evaluate(color=>{const c=document.querySelector('canvas').getContext('2d');c.fillStyle=color;c.fillRect(0,0,128,72);},color);
      const samples=await page.evaluate(sampleCanvasMotion,{durationMs:650});
      const result=analyzeMotion(samples);
      assert.ok(result.findings.some(f=>f.code==='blank-canvas'),'uniform '+color);
      assert.ok(result.findings.some(f=>f.code==='frozen-pixels'));
    }
    await page.setContent('<canvas class="game-canvas" width="128" height="72"></canvas>');
    await page.evaluate(()=>{
      const c=document.querySelector('canvas').getContext('2d');
      function draw(t){c.fillStyle='white';c.fillRect(0,0,128,72);c.fillStyle='black';c.fillRect(Math.floor(t/20)%100,10,20,50);requestAnimationFrame(draw);}
      requestAnimationFrame(draw);
      setTimeout(()=>{const until=performance.now()+600;while(performance.now()<until){}},200);
    });
    const stalled=analyzeMotion(await page.evaluate(sampleCanvasMotion,{durationMs:1100}));
    assert.ok(stalled.findings.some(f=>f.code==='long-frame-gap'),'actual injected main-thread stall');
  } finally {await browser.close();}
});

test('motion analysis distinguishes movement, pause, freeze and frame stalls',()=>{
  const samples=Array.from({length:61},(_,i)=>({t:i*16.67,hash:i,range:200}));
  assert.deepEqual(analyzeMotion(samples).findings,[]);
  const frozen=samples.map(s=>({...s,hash:0}));
  assert.ok(analyzeMotion(frozen).findings.some(f=>f.code==='frozen-pixels'));
  assert.deepEqual(analyzeMotion(frozen,{expectedMoving:false}).findings,[]);
  const stalled=samples.map((s,i)=>({...s,t:s.t+(i>=30?600:0)}));
  assert.ok(analyzeMotion(stalled).findings.some(f=>f.code==='long-frame-gap'));
});
