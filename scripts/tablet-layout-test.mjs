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
        fits: board.bottom <= innerHeight+1 && board.right <= innerWidth+1};
    });
    assert.equal(result.sideBySide, expanded, `${width}x${height} layout`);
    assert.equal(result.fits, true, `${width}x${height} board fits`);
    for (const field of ['message','stage','columns','rows','rowIndex','cellIndex','blockIndex']) {
      assert.deepEqual(result.state[field], initial[field], `resize preserves ${field}`);
    }
  }
  console.log('PASS tablet window matrix: expanded portrait, landscape, short window, split screen and round-trip preserve board/scanner');
} finally { await browser?.close(); server.kill(); }
