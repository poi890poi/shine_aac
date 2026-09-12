import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url),{chromium}=require('playwright');
const out='.tmp/garden-v050';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5198'],{windowsHide:true,stdio:'ignore'});
let browser;
try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5198/apps/web/garden.html')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.goto('http://127.0.0.1:5198/apps/web/garden.html');
  const result=await page.evaluate(async()=>{
    const {mountBirdGame}=await import('/apps/bird-minigame/src/embed.js');
    // Deterministic controller simulation: real START/DROP/TICK/landing events,
    // no rewritten flower state, no physical timing or usability claim.
    let next=0,now=performance.now(),pending=new Map();
    window.requestAnimationFrame=fn=>{pending.set(++next,fn);return next;};
    window.cancelAnimationFrame=id=>pending.delete(id);
    const events=[];
    const game=mountBirdGame(document.querySelector('#game-mount'),{
      aacConfig:{columns:3},physics:{hitReduction:.6},muted:true,
      cameraStatus:{enabled:true,state:'analysis',score:.35,threshold:.5},
      sceneryRandom:()=>9/4294967296,
      onEvent:event=>events.push({type:event.type,speed:event.state.speedLevel})
    });
    await game.ready;
    const step=()=>{now+=1000/30;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};
    const starts=[],landings=[];
    for(let round=0;round<3;round++) {
      document.querySelector('[data-game-primary]').click();starts.push(game.getState().speedLevel);
      for(let i=0;i<30*180&&game.getState().phase!=='won';i++) {
        const s=game.getState();
        if(s.phase==='running'&&!s.drop&&s.flowers.some(f=>f.height>0&&Math.abs(f.x-s.bird.x)<.012))game.activate();
        step();
      }
      landings.push(game.getState().phase);
    }
    document.querySelector('[data-game-primary]').click();const cap=game.getState().speedLevel;
    let collision;
    for(let i=0;i<30*85;i++) {
      const before=game.getState();step();
      if(game.getState().mode==='rescue') {collision={before:before.speedLevel,after:game.getState().speedLevel};break;}
    }
    const paused=game.pause(),before=JSON.stringify(game.getState().bird);
    for(let i=0;i<30;i++)step();
    const pauseStable=JSON.stringify(game.getState().bird)===before;
    game.destroy();
    return {starts,landings,cap,collision,pauseStable,wonEvents:events.filter(e=>e.type==='won').length};
  });
  assert.deepEqual(result.starts,[0,1,2]);assert.deepEqual(result.landings,['won','won','won']);
  assert.equal(result.cap,2);assert.deepEqual(result.collision,{before:2,after:1});
  assert.equal(result.pauseStable,true);assert.equal(result.wonEvents,3);
  writeFileSync(`${out}/controller-results.json`,JSON.stringify(result,null,2));
  await page.close();
  for(const [width,height] of [[1280,800],[360,800]]) {
    const view=await browser.newPage({viewport:{width,height}});
    await view.goto('http://127.0.0.1:5198/apps/web/garden.html');
    await view.evaluate(async()=>{
      const {mountBirdGame}=await import('/apps/bird-minigame/src/embed.js');
      const game=mountBirdGame(document.querySelector('#game-mount'),{
        aacConfig:{columns:6,scanIntervalMs:1800,firstCellPauseMs:2400},speciesSelection:'random',random:()=>.1,
        sceneryRandom:()=>9/4294967296,muted:true,
        cameraStatus:{enabled:true,state:'analysis',score:.35,threshold:.5}
      });
      await game.ready;game.start();
    });
    await delay(3500);
    await view.screenshot({path:`${out}/implemented-${width}.png`});await view.close();
  }
  console.log('PASS controller: three complete rounds advance 0→1→2; cap, collision slowdown and pause verified. Browser previews rendered.');
} finally {await browser?.close();server.kill();}
