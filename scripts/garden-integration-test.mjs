import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { CurrentConfigVersion } from '../packages/aac-core/src/index.js';
const require = createRequire(process.env.SHINE_PLAYWRIGHT_ROOT || import.meta.url);
const { chromium } = require('playwright');
const server = spawn(process.execPath,['apps/web/server.mjs','--port','5189'],{windowsHide:true,stdio:'ignore'});
let browser;
try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5189/apps/web/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const packaged of [false,true]) {
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(version=>{
      window.boardStates=[];window.gardenMessages=[];
      window.ShineAacAndroid={isE2E:()=>true,onRender:json=>window.boardStates.push(JSON.parse(json))};
      window.addEventListener('message',event=>{if(event.data?.channel==='shine-bird-garden')window.gardenMessages.push(event.data);});
      localStorage.setItem('shine-aac-web-config-v1',JSON.stringify({configVersion:version,profileId:'en-US',columns:6,scanIntervalMs:1000}));
      localStorage.setItem('shine-aac-web-ui-v1',JSON.stringify({uiConfigVersion:1,switchInputProfile:'hardware-and-camera',scanVoice:false,activationVoice:false}));
      localStorage.setItem('shine-aac-session-draft-v1',JSON.stringify({version:1,profileId:'en-US',updatedAt:1,message:'Please wait',messageHistory:['Please'],activeCategory:null}));
    },CurrentConfigVersion);
    const path=packaged?'/app/build/generated/assets/shineWeb/www/apps/web/':'/apps/web/';
    await page.goto('http://127.0.0.1:5189'+path);
    await page.waitForFunction(()=>window.boardStates.length>0);
    const before=await page.evaluate(()=>window.boardStates.at(-1));
    await page.locator('.garden-button').click();
    await page.waitForFunction(()=>window.gardenMessages.some(m=>m.type==='ready'),null,{timeout:30000});
    const frame=page.frames().find(f=>f.url().includes('garden.html'));
    assert.ok(frame,'embedded game document');
    assert.equal(await frame.locator('.bird-picker').isVisible(),false,'hosted species are random');
    assert.equal(await page.evaluate(()=>window.gardenMessages.find(m=>m.type==='ready').columns),6,'one flower per AAC column');
    const aacRenderCount=await page.evaluate(()=>window.boardStates.length);
    await page.evaluate(()=>window.ShineAacInput.receive({intent:'activate',source:'android-hardware-key'}));
    await frame.waitForSelector('.bird-game[data-phase="running"]');
    await delay(1200);
    await page.evaluate(()=>{for(let i=0;i<8;i++)window.ShineAacInput.receive({intent:'activate',source:'android-camera-blink'});});
    await page.waitForFunction(()=>window.gardenMessages.some(m=>m.event==='drop'));
    const drops=await page.evaluate(()=>window.gardenMessages.filter(m=>m.event==='drop'));
    assert.equal(drops.length,1,'one activation path, no queued/double projectile');
    assert.equal(drops[0].ammo,2,'three charges by default');
    assert.equal(await page.evaluate(()=>window.boardStates.length),aacRenderCount,'game inputs never advance AAC');
    await frame.locator('[data-game-pause]').click();
    await frame.waitForSelector('.bird-game[data-phase="paused"]');
    await page.evaluate(()=>window.ShineAacInput.receive({intent:'activate',source:'android-camera-blink'}));
    await frame.waitForSelector('.bird-game[data-phase="running"]');
    await page.evaluate(()=>window.postMessage({channel:'shine-bird-garden',type:'exit',token:'wrong'},'*'));
    assert.equal(await page.locator('.garden-frame').count(),1,'untrusted window message ignored');
    mkdirSync('.tmp/tablet-adaptation',{recursive:true});
    await page.screenshot({path:`.tmp/tablet-adaptation/garden-${packaged?'packaged':'source'}.png`});
    await page.evaluate(()=>window.ShineAacNavigation.back());
    await page.waitForSelector('.board');
    assert.equal(await page.locator('.garden-frame').count(),0,'exit destroys game document');
    await delay(1300);
    const after=await page.evaluate(()=>window.boardStates.at(-1));
    for(const key of ['message','rows','columns','stage','blockIndex','rowIndex','cellIndex'])assert.deepEqual(after[key],before[key],`return preserves ${key}`);
    const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('shine-aac-session-draft-v1')));
    assert.deepEqual(draft.messageHistory,['Please'],'undo history preserved');
    await page.locator('.garden-button').click();
    await page.waitForSelector('.garden-frame');
    await page.evaluate(()=>window.ShineAacInput.receive({intent:'pause',source:'android-lifecycle'}));
    assert.equal(await page.locator('.garden-frame').count(),0,'background pause exits and frees game');
    assert.deepEqual(errors,[], 'no browser errors');
    console.log(`PASS ${packaged?'packaged':'source'} garden integration: columns, random mode, hardware/camera routing, ammo, pause, exit and session preservation`);
    await page.close();
  }
} finally {await browser?.close();server.kill();}
