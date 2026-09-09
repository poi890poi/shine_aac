import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {CurrentConfigVersion} from '../packages/aac-core/src/index.js';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url);
const {chromium}=require('playwright');
const out=process.argv[2]||'.tmp/replay-composition-review';
mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5193'],{windowsHide:true,stdio:'ignore'});
const origin='http://127.0.0.1:5193';
let browser;
const measurements=[];
// Pin the pre-approval baseline so this historical comparison remains reproducible
// after its proposed status sizing ships in the application.
const baselineFile=path=>execFileSync('git',['show',`57eeaf9:${path}`],{encoding:'utf8',windowsHide:true});
const baselineApp=baselineFile('apps/web/src/app.js'),baselineCss=baselineFile('apps/web/src/styles.css');
try {
  for(let i=0;i<50;i++){try{if((await fetch(origin+'/apps/web/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const proposed of [false,true]){
    const page=await browser.newPage({viewport:{width:393,height:851}});
    await page.route('**/apps/web/src/app.js',route=>route.fulfill({contentType:'text/javascript',body:baselineApp}));
    await page.route('**/apps/web/src/styles.css',route=>route.fulfill({contentType:'text/css',body:baselineCss}));
    await page.addInitScript(({version})=>{
      window.ShineAacAndroid={isE2E:()=>true,onRender:j=>window.renderState=JSON.parse(j)};
      localStorage.setItem('shine-aac-web-config-v1',JSON.stringify({configVersion:version,profileId:'en-US',columns:4,scanIntervalMs:1000,scanPassLimit:0}));
      localStorage.setItem('shine-aac-web-ui-v1',JSON.stringify({uiConfigVersion:1,speechAfterReadMode:'replay',rowScanVoice:false,scanVoice:false,activationVoice:false}));
      localStorage.setItem('shine-aac-session-draft-v1',JSON.stringify({version:1,profileId:'en-US',updatedAt:1,message:'yes ',...(location.search.includes('locked')?{speechLockMessage:'yes '}:{})}));
    },{version:CurrentConfigVersion});
    await page.goto(origin+'/apps/web/');
    await page.waitForFunction(()=>window.renderState);
    // Review-only: reserve two lines of status text at the current font size.
    if(proposed) await page.addStyleTag({content:'.phase { min-height:2lh; display:flex; align-items:center; }'});
    for(const locked of [false,true]){
      if(locked){await page.goto(origin+'/apps/web/?locked');await page.waitForFunction(()=>window.renderState);if(proposed)await page.addStyleTag({content:'.phase { min-height:2lh; display:flex; align-items:center; }'});}
      if(locked){await page.evaluate(()=>window.ShineAacInput.receive({intent:'activate',source:'visual-review'}));await page.waitForFunction(()=>window.renderState.phase==='SpeechLock');}
      await delay(120);
      const name=`replay-${proposed?'proposal':'current'}-${locked?'locked':'ordinary'}`;
      measurements.push({name,...await page.evaluate(()=>{
        const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
        return {board:rect('.board'),panel:rect('.top-panel'),phase:rect('.phase'),text:document.querySelector('.phase').textContent};
      })});
      await page.screenshot({path:`${out}/${name}.png`});
    }
    await page.close();
  }
  // Deterministic, renderer-native composition previews. No app asset edits.
  for(const proposed of [false,true]){
    const page=await browser.newPage({viewport:{width:360,height:800}});
    await page.route('**/src/bird-renderer.js',route=>route.fulfill({contentType:'text/javascript',body:baselineFile('apps/bird-minigame/src/bird-renderer.js')}));
    await page.route('**/src/reviewed-scenery.js',async route=>{
      const response=await route.fetch();let body=baselineFile('apps/bird-minigame/src/reviewed-scenery.js');
      if(proposed)body=body.replace('Math.max(w/480,1)*mood.scale','Math.max(w/480,1)*mood.scale*1.45');
      await route.fulfill({response,body});
    });
    await page.goto(origin+'/apps/bird-minigame/');
    await page.evaluate(async()=>{
      document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="review"></canvas></div>';
      const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
      const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
      const renderer=createBirdRenderer(document.querySelector('#review'),{columns:6,species:'yellow_tit'});
      await renderer.ready;renderer.setScenerySeed(9);
      const state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.5;state.time=1;
      renderer.render(state);window.reviewRenderer=renderer;
    });
    await page.screenshot({path:`${out}/garden-${proposed?'proposal':'current'}.png`});await page.close();
  }
  writeFileSync(`${out}/measurements.json`,JSON.stringify(measurements,null,2));
  const currentJump=measurements[1].board.y-measurements[0].board.y;
  const proposedJump=measurements[3].board.y-measurements[2].board.y;
  if(currentJump<1||Math.abs(proposedJump)>.1)throw new Error(`Review must demonstrate a real jump and stable proposal: ${currentJump}, ${proposedJump}`);
  const img=n=>'data:image/png;base64,'+readFileSync(`${out}/${n}.png`).toString('base64');
  const style='<style>body{margin:0;padding:28px;background:#edf1f5;color:#172331;font:18px/1.45 Arial}h1{margin:0 0 8px;font-size:28px}.grid{display:flex;gap:20px}.card{background:white;padding:16px}img{display:block;width:360px}h2{font-size:19px;margin:0 0 12px}p{max-width:1450px}</style>';
  const reviews=[['replay-layout-review',`${style}<h1>Replay status — review before app changes</h1><p>Phone portrait, synthetic text. Compare ordinary → replay. Proposal reserves two lines for status so the board stays still.</p><div class="grid">${['current','proposal'].flatMap(kind=>['ordinary','locked'].map(state=>`<div class="card"><h2>${kind==='current'?'Current':'Proposal'} · ${state==='locked'?'replay':'ordinary'}</h2><img src="${img(`replay-${kind}-${state}`)}"></div>`)).join('')}</div><p>The proposal uses slightly more space before replay. No status text is hidden. Browser preview only; app styles are unchanged.</p>`],
    ['portrait-composition-review',`${style}<h1>Portrait garden — optional scenery proposal</h1><p>Same seed, bird, flowers and clouds. Existing mountain artwork at 1.45× scale brings the summit higher while keeping its base behind the bushes.</p><div class="grid"><div class="card"><h2>Current composition</h2><img src="${img('garden-current')}"></div><div class="card"><h2>Proposal · higher mountain skyline</h2><img src="${img('garden-proposal')}"></div></div><p>Stems, leaves, flower heads and gameplay positions are identical. This preserves the approved flowers while reducing the empty sky. Static renderer preview; helper controls remain unchanged in the app.</p>`]];
  for(const [name,html] of reviews){writeFileSync(`${out}/${name}.html`,html);const page=await browser.newPage({viewport:{width:name.startsWith('replay')?1650:820,height:1000}});await page.setContent(html);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});await page.close();}
  console.log(JSON.stringify(measurements,null,2));
}finally{await browser?.close();server.kill();}
