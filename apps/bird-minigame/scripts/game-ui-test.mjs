import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url),{chromium}=require('playwright');
const out='apps/bird-minigame/tmp/game-ui';mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5197'],{windowsHide:true,stdio:'ignore'});
let browser;const records=[];
try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5197/apps/web/garden.html')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [width,height,dpr] of [[1280,800,1],[360,800,1],[320,720,1],[800,1280,1.5],[1280,800,1.5],[360,800,3]]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5197/apps/web/garden.html');
    await page.evaluate(async()=>{
      const {mountBirdGame}=await import('/apps/bird-minigame/src/embed.js');
      window.events=[];
      window.game=mountBirdGame(document.querySelector('#game-mount'),{speciesSelection:'manual',muted:true,
        cameraStatus:{enabled:true,state:'analysis',score:.35,threshold:.5},sceneryRandom:()=>9/4294967296,
        onEvent:e=>events.push(e.type)});await game.ready;
    });
    const check=async(label)=>{
      await page.waitForFunction(()=>document.querySelector('[data-game-settings]').style.width);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const result=await page.evaluate(()=>{
        const visible=[...document.querySelectorAll('.bird-game button')].filter(b=>b.getClientRects().length);
        const rects=visible.map(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return {id:b.dataset.uiControl,x:r.x,y:r.y,w:r.width,h:r.height,background:s.backgroundColor,border:s.borderWidth,disabled:b.disabled};});
        const c=document.querySelector('.game-canvas'),p=c.readGamePixels(),scale=+c.dataset.pixelScale;let offGrid=0;
        for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
          const a=(y*c.width+x)*4,b=(Math.floor(y/scale)*scale*c.width+Math.floor(x/scale)*scale)*4;
          if(p[a]!==p[b]||p[a+1]!==p[b+1]||p[a+2]!==p[b+2])offGrid++;
        }
        return {rects,offGrid,renderer:c.dataset.renderer,visibleSvg:!!document.querySelector('.bird-game svg'),width:innerWidth,height:innerHeight};
      });
      assert.equal(result.offGrid,0,`${label}: uniform physical pixels, including UI`);
      assert.equal(result.visibleSvg,false);
      for(const r of result.rects){
        assert.ok(r.w>=47.99&&r.h>=47.99,`${label}: ${r.id} at least 48 CSS pixels`);
        assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+.1&&r.y+r.h<=height+.1,`${label}: ${r.id} inside window`);
        assert.equal(r.background,'rgba(0, 0, 0, 0)');assert.equal(r.border,'0px');
      }
      for(let i=0;i<result.rects.length;i++)for(let j=i+1;j<result.rects.length;j++){
        const a=result.rects[i],b=result.rects[j];
        assert.ok(a.x+a.w<=b.x+.1||b.x+b.w<=a.x+.1||a.y+a.h<=b.y+.1||b.y+b.h<=a.y+.1,`${label}: ${a.id}/${b.id} targets overlap`);
      }
      return result;
    };
    const id=`${width}-${height}-${dpr}`;
    const ready=await check('ready');
    if(dpr===1&&width!==320)await page.screenshot({path:`${out}/ready-${width}.png`});
    for(let p=1;p<=3;p++) {
      await page.locator('[data-bird-next]').click();
      const choices=page.locator('[data-game-bird]:visible');assert.equal(await choices.count(),4);
      await choices.last().click();
      assert.equal(await choices.last().getAttribute('aria-pressed'),'true');
    }
    assert.equal(await page.locator('[data-bird-next]').isDisabled(),true);
    await page.locator('[data-bird-previous]').click();
    await page.locator('[data-game-settings]').click();await check('helper');
    assert.equal(await page.locator('[data-game-primary]').isVisible(),false);
    assert.equal(await page.locator('[data-game-bird]:visible').count(),0,'no invisible picker hit targets over helper');
    await page.locator('[data-game-sound]').click();assert.equal(await page.locator('[data-game-sound]').getAttribute('aria-pressed'),'false');
    await page.locator('[data-game-sound]').click();
    await page.locator('[data-game-mode]').click();assert.equal(await page.evaluate(()=>game.getState().config.dropMode),'flyby');
    await page.locator('[data-game-mode]').click();
    await page.locator('[data-game-speed]').click();assert.equal(await page.locator('[data-game-speed]').getAttribute('aria-label'),'下一回合速度：中速');
    if(dpr===1&&width!==320)await page.screenshot({path:`${out}/helper-${width}.png`});
    assert.deepEqual(await page.evaluate(()=>events.filter(x=>x==='drop'||x==='start')),[],'helper controls never activate play');
    await page.locator('[data-game-settings]').click();
    await page.locator('[data-game-primary]').click();assert.equal(await page.evaluate(()=>game.getState().speedLevel),1);
    await page.waitForFunction(()=>document.querySelector('.game-canvas').dataset.dropReady==='true');
    await page.locator('.game-canvas').click({position:{x:width/2,y:height*.3}});
    assert.equal(await page.evaluate(()=>events.filter(x=>x==='drop').length),1);
    await page.locator('[data-game-pause]').click();
    assert.equal(await page.evaluate(()=>game.getState().phase),'paused');
    const running=await check('paused');
    await page.evaluate(()=>document.querySelector('#game-mount').style.display='none');
    await delay(100);
    await page.evaluate(()=>document.querySelector('#game-mount').style.display='');
    await check('restored from hidden container');
    const tops=running.rects.filter(r=>['settings','pause','exit'].includes(r.id));
    assert.ok(tops.every(r=>Math.abs(r.y-tops[0].y)<.1),'one top control row');
    if(dpr===1&&width!==320)await page.screenshot({path:`${out}/running-${width}.png`});
    await page.locator('[data-game-settings]').click();
    assert.equal(await page.locator('[data-game-speed]').isDisabled(),true);
    assert.equal(await page.locator('[data-game-mode]').isDisabled(),true);
    await page.locator('[data-game-settings]').click();
    // Keyboard focus and activation stay on the semantic control, without a drop.
    await page.locator('[data-game-pause]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>game.getState().phase),'running');
    assert.equal(await page.evaluate(()=>events.filter(x=>x==='drop').length),1);
    if(!await page.locator('[data-game-exit]').isVisible())await page.locator('[data-game-settings]').click();
    await page.locator('[data-game-exit]').click();assert.equal(await page.evaluate(()=>game.getState().phase),'exited');
    await page.evaluate(()=>game.destroy());assert.deepEqual(errors,[]);
    records.push({width,height,dpr,ready:ready.rects,physicalPixelViolations:running.offGrid,result:'PASS'});await page.close();
  }
  writeFileSync(`${out}/results.json`,JSON.stringify(records,null,2));
  console.log('PASS: six viewport/density combinations; single row, native pixels, 48px targets, all POC pages, helper/start/drop/pause/keyboard/exit.');
} finally {await browser?.close();server.kill();}
