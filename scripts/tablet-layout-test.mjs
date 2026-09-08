import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
// Use the installed browser automation runtime; no dependency is downloaded.
const require = createRequire(process.env.SHINE_PLAYWRIGHT_ROOT || import.meta.url);
const { chromium } = require('playwright');
const server = spawn(process.execPath, ['apps/web/server.mjs', '--port', '5187'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch('http://127.0.0.1:5187/apps/web/')).ok) break; } catch {}
    await delay(100);
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.ShineAacAndroid = { isE2E: () => true, onRender: json => { window.renderState = JSON.parse(json); } };
    localStorage.setItem('shine-aac-session-draft-v1', JSON.stringify({version:1,profileId:'zh-TW',updatedAt:1,
      message:'這是一段需要換行的訊息。'.repeat(8),messageHistory:['前一段草稿']}));
    localStorage.setItem('shine-aac-text-history-v1', JSON.stringify({version:3,entries:[
      {id:'spoken1',at:'2026-09-08T00:00:00Z',profileId:'zh-TW',text:'我想喝水',spoken:true,closed:true},
      {id:'private',at:'2026-09-08T00:00:01Z',profileId:'zh-TW',text:'未朗讀草稿',spoken:false,closed:true},
      {id:'spoken2',at:'2026-09-08T00:00:02Z',profileId:'zh-TW',text:'謝謝',spoken:true,closed:true}
    ]}));
  });
  await page.goto('http://127.0.0.1:5187/apps/web/');
  await page.waitForFunction(() => window.renderState);
  await page.evaluate(() => window.ShineAacInput.receive({ intent: 'pause', source: 'tablet-test' }));
  const initial = await page.evaluate(() => window.renderState);
  for (const [width, height, expanded] of [[1200,800,true],[850,1000,true],[839,1000,false],[1000,599,false],[600,900,false],[1200,800,true]]) {
    await page.setViewportSize({width,height});
    await delay(120);
    const result = await page.evaluate(() => {
      const board = document.querySelector('.board').getBoundingClientRect();
      const pane = document.querySelector('.top-panel').getBoundingClientRect();
      return {state: window.renderState, sideBySide: Math.abs(board.top-pane.top)<2,
        boardShare: board.width/(board.width+pane.width),
        messageWhiteSpace: getComputedStyle(document.querySelector('.message')).whiteSpace,
        history: [...document.querySelectorAll('.conversation-context-message')].map(el=>el.textContent),
        fits: board.bottom <= innerHeight+1 && board.right <= innerWidth+1};
    });
    assert.equal(result.sideBySide, expanded, `${width}x${height} layout`);
    assert.equal(result.fits, true, `${width}x${height} board fits`);
    if (expanded) {
      assert.ok(result.boardShare>=.65 && result.boardShare<=.70, '65–70% board width');
      assert.equal(result.messageWhiteSpace,'pre-wrap','multiline draft');
      assert.deepEqual(result.history,['我想喝水','謝謝'],'only spoken history in supporting pane');
    }
    for (const field of ['message','stage','columns','rows','rowIndex','cellIndex','blockIndex']) {
      assert.deepEqual(result.state[field], initial[field], `resize preserves ${field}`);
    }
  }
  const lockedPage = await browser.newPage();
  await lockedPage.addInitScript(() => {
    localStorage.setItem('shine-aac-web-ui-v1', JSON.stringify({uiConfigVersion:1,speechAfterReadMode:'conversation'}));
    localStorage.setItem('shine-aac-session-draft-v1', JSON.stringify({version:1,profileId:'zh-TW',updatedAt:1,
      message:'我想喝水',speechLockMessage:'我想喝水'}));
  });
  await lockedPage.goto('http://127.0.0.1:5187/apps/web/');
  await lockedPage.waitForSelector('.speech-lock-enhanced');
  for (const [width,height] of [[1200,800],[850,1000],[600,900],[1000,500]]) {
    await lockedPage.setViewportSize({width,height});
    await delay(120);
    const lock = await lockedPage.evaluate(() => {
      const board=document.querySelector('.board').getBoundingClientRect();
      const pane=document.querySelector('.top-panel').getBoundingClientRect();
      return {rows:document.querySelectorAll('.row').length, actions:[...document.querySelectorAll('.tile')].map(el=>el.dataset.action),
        below:board.top>=pane.bottom, fits:board.bottom<=innerHeight+1, full:Math.abs(board.width-pane.width)<2};
    });
    assert.equal(lock.rows,1); assert.equal(lock.actions.length,3);
    assert.equal(new Set(lock.actions).size,3);
    assert.ok(lock.below&&lock.fits&&lock.full, 'locked message above three full-width controls');
  }
  console.log('PASS tablet window matrix and locked conversation: stable board/scanner and one row of three actions');
} finally { await browser?.close(); server.kill(); }
