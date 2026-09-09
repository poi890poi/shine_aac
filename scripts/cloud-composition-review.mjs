// Renderer-native design experiment. These parameters never enter app assets.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url);
const {chromium}=require('playwright');
const out=process.argv[2]||'.tmp/cloud-composition-review';
mkdirSync(out,{recursive:true});
const tuning={farCount:6,nearCount:5,farScale:.30,nearScale:.56,scaleVariation:.18,xJitter:65,yJitter:22};
function placements(seed){
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296};
  const result=[];
  for(const layer of ['far','near']){
    const far=layer==='far',count=far?tuning.farCount:tuning.nearCount;
    for(let i=0;i<count;i++){
      const x=(i%2?270:0)+(random()-.5)*tuning.xJitter;
      const y=(far?20:85)+i*(far?42:34)+(random()-.5)*tuning.yJitter;
      const scale=(far?tuning.farScale:tuning.nearScale)*(1+(random()-.5)*2*tuning.scaleVariation);
      result.push([Math.floor(random()*6),Math.round(x),Math.round(y),Number(scale.toFixed(3)),layer]);
    }
  }
  return result;
}
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5194'],{windowsHide:true,stdio:'ignore'});
let browser;
const variants=[{name:'current',label:'Current · 6 clouds'},... [4,29].map(seed=>({name:`clouds-${seed}`,label:`Proposal · arrangement ${seed===4?'A':'B'}`,placements:placements(seed)}))];
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5194/apps/web/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const variant of variants){
    const page=await browser.newPage({viewport:{width:360,height:800}});
    if(variant.placements)await page.route('**/src/reviewed-scenery.js',async route=>{
      const response=await route.fetch(),body=await response.text();
      const modified=body.replace(/export const CLOUD_PLACEMENTS=.*?;/,`export const CLOUD_PLACEMENTS=${JSON.stringify(variant.placements)};`);
      if(modified===body)throw new Error('Cloud review override did not match');
      await route.fulfill({response,body:modified});
    });
    await page.goto('http://127.0.0.1:5194/apps/bird-minigame/');
    await page.evaluate(async()=>{
      document.body.innerHTML='<div style="position:fixed;inset:0"><canvas id="review"></canvas></div>';
      const {createBirdRenderer}=await import('/apps/bird-minigame/src/bird-renderer.js');
      const {createGameState}=await import('/apps/bird-minigame/src/game-core.js');
      const renderer=createBirdRenderer(document.querySelector('#review'),{columns:6,species:'yellow_tit'});
      await renderer.ready;renderer.setScenerySeed(9);
      const state=createGameState({columns:6});state.phase='running';state.mode='flying';state.bird.x=.5;state.time=1;renderer.render(state);
      window.reviewRenderer=renderer;
    });
    await page.screenshot({path:`${out}/${variant.name}.png`});await page.close();
  }
  const image=name=>'data:image/png;base64,'+readFileSync(`${out}/${name}.png`).toString('base64');
  const html=`<style>body{margin:0;padding:28px;background:#edf1f5;color:#172331;font:18px/1.45 Arial}h1{margin:0;font-size:28px}.grid{display:flex;gap:20px}.card{background:white;padding:16px}h2{font-size:20px;margin:0 0 12px}img{display:block;width:360px}p{max-width:1150px}</style><h1>Larger, fuller clouds — review before changes</h1><p>11 clouds instead of 6. Far clouds roughly 2× larger; near clouds roughly 2.5× larger. A and B use the same rules with different seeds.</p><div class="grid">${variants.map(v=>`<div class="card"><h2>${v.label}</h2><img src="${image(v.name)}"></div>`).join('')}</div><p>Existing flat three-tone clouds, six source shapes and two depth layers. Mountains, flowers, stems, leaves and bird are identical. This static preview preserves the far/slow and near/fast movement rules; motion still needs review after approval.</p>`;
  writeFileSync(`${out}/cloud-composition-review.html`,html);
  writeFileSync(`${out}/parameters.json`,JSON.stringify({tuning,variants},null,2));
  const page=await browser.newPage({viewport:{width:1252,height:1100}});await page.setContent(html);await page.screenshot({path:`${out}/cloud-composition-review.png`,fullPage:true});await page.close();
  console.log(`Cloud comparison saved in ${out}`);
}finally{await browser?.close();server.kill();}
