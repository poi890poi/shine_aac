import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {CurrentConfigVersion} from '../packages/aac-core/src/index.js';
import {inspectVisualLayout} from './visual-audit.mjs';
import {openGardenEasterEgg} from './garden-test-entry.mjs';

// Synthetic messages only: these images may be shared for design review.
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url);
const {chromium}=require('playwright');
const out=process.argv[2]||'.tmp/visual-review-20260909';
mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5191'],{windowsHide:true,stdio:'ignore'});
let browser;
const results=[];
try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5191/apps/web/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const scenario of [
    {name:'tablet-landscape',width:1280,height:800},
    {name:'tablet-portrait',width:800,height:1280},
    {name:'phone-portrait',width:360,height:800},
    {name:'phone-landscape',width:800,height:360,support:'unsupported compact-landscape diagnostic'},
    {name:'tablet-conversation',width:1280,height:800,locked:true},
    {name:'tablet-garden',width:1280,height:800,garden:true},
    {name:'phone-garden',width:360,height:800,garden:true},
  ]) {
    const page=await browser.newPage({viewport:{width:scenario.width,height:scenario.height},deviceScaleFactor:1});
    await page.addInitScript(({version,locked})=>{
      window.ShineAacAndroid={isE2E:()=>true,onRender:json=>window.renderState=JSON.parse(json)};
      localStorage.setItem('shine-aac-web-config-v1',JSON.stringify({configVersion:version,profileId:'zh-TW',columns:6,scanIntervalMs:1000}));
      localStorage.setItem('shine-aac-web-ui-v1',JSON.stringify({uiConfigVersion:1,speechAfterReadMode:'conversation',scanVoice:false,activationVoice:false}));
      localStorage.setItem('shine-aac-session-draft-v1',JSON.stringify({version:1,profileId:'zh-TW',updatedAt:1,message:'我想喝水，請幫我拿杯子。',...(locked?{speechLockMessage:'我想喝水，請幫我拿杯子。'}:{})}));
      localStorage.setItem('shine-aac-text-history-v1',JSON.stringify({version:3,entries:[
        {id:'demo1',at:'2026-09-08T00:00:00Z',profileId:'zh-TW',text:'早安，我今天感覺很好。',spoken:true,closed:true},
        {id:'demo2',at:'2026-09-08T00:00:01Z',profileId:'zh-TW',text:'謝謝你的幫忙。',spoken:true,closed:true}
      ]}));
    },{version:CurrentConfigVersion,locked:scenario.locked});
    await page.goto('http://127.0.0.1:5191/apps/web/');
    await page.waitForFunction(()=>window.renderState);
    await page.evaluate(()=>window.ShineAacInput.receive({intent:'pause',source:'visual-review'}));
    await delay(250);
    results.push({scenario,...await page.evaluate(inspectVisualLayout,{minimumTarget:48})});
    if(scenario.garden) {
      await openGardenEasterEgg(page);
      const frame=await (await page.waitForSelector('.garden-frame')).contentFrame();
      await frame.waitForSelector('.game-canvas');
      await delay(2000);
      await page.screenshot({path:`${out}/${scenario.name}-ready.png`});
      await page.evaluate(()=>window.ShineAacInput.receive({intent:'activate',source:'visual-review'}));
      await frame.waitForSelector('.bird-game[data-phase="running"]');
      await delay(1300);
    }
    await page.screenshot({path:`${out}/${scenario.name}.png`});
    if(scenario.name==='tablet-landscape') {
      // Review-only browser overrides; never copied into application assets.
      await page.addStyleTag({content:`
        .shell:not(.speech-lock-enhanced) .top-panel { grid-template-rows:minmax(180px,auto) auto 1fr; }
        .shell:not(.speech-lock-enhanced) .conversation-context-list { gap:10px; }
        .shell:not(.speech-lock-enhanced) .conversation-context-message { flex:0 0 auto; min-height:48px; }
        .shell:not(.speech-lock-enhanced) .status-row { align-self:end; }
      `});
      await page.screenshot({path:`${out}/tablet-panel-proposal.png`});
    }
    await page.close();
  }
  writeFileSync(`${out}/layout.json`,JSON.stringify({kind:'browser screenshots; synthetic content; no product edits',results},null,2));
  console.log(`Captured ${results.length} scenarios in ${out}`);
} finally {await browser?.close();server.kill();}
