import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {sampleCanvasMotion,analyzeMotion} from './visual-audit.mjs';

const require=createRequire(process.env.SHINE_PLAYWRIGHT_ROOT||import.meta.url);
const {chromium}=require('playwright');
const out=process.argv[2]||'.tmp/visual-motion-20260909';
mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['apps/web/server.mjs','--port','5192'],{windowsHide:true,stdio:'ignore'});
let browser,context;
try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5192/apps/bird-minigame/')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:5192/apps/bird-minigame/?selection=random&columns=4');
  await page.evaluate(()=>birdGame.ready);
  await page.evaluate(()=>{
    window.reviewEvents=[];
    for(const type of ['drop','miss','hit','collision','landing','won'])document.querySelector('.bird-game').addEventListener('birdgame:'+type,e=>reviewEvents.push({type,t:performance.now(),pass:e.detail.state.pass}));
  });
  // Use the existing system encoder, rather than requiring Playwright's own
  // optional ffmpeg download. Preserve screencast timestamps in a sidecar.
  const cdp=await context.newCDPSession(page),frames=[];
  mkdirSync(`${out}/frames`,{recursive:true});
  cdp.on('Page.screencastFrame',event=>{
    const t=event.metadata.timestamp;
    if(!frames.length||t-frames.at(-1).t>=.095){
      const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
      writeFileSync(`${out}/frames/${name}`,Buffer.from(event.data,'base64'));frames.push({name,t});
    }
    cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1280,maxHeight:800,everyNthFrame:2});
  await page.locator('[data-game-primary]').click();
  await page.evaluate(()=>document.activeElement.blur());
  const motionWork=page.evaluate(sampleCanvasMotion,{durationMs:6000});
  const begin=Date.now(),shots=new Set();let missSent=false,collisionSeen=false;
  while(Date.now()-begin<175000){
    // State selects ordinary playfield inputs and labels events. It supplies no
    // visual PASS: screenshots/video and pixel samples are separate evidence.
    const s=await page.evaluate(()=>birdGame.getState());
    if(s.mode==='rescue')collisionSeen=true;
    const label=s.phase==='won'?'landed':s.phase==='landing'?'landing':s.featherBurst?.age>.4?'collision':s.score>0?'hit':null;
    if(label&&!shots.has(label)){await page.screenshot({path:`${out}/${label}.png`});shots.add(label);}
    if(s.phase==='won'){await delay(1200);break;}
    if(s.mode==='flying'&&s.phase==='running'&&!s.drop&&s.ammo>0){
      let tap=false;
      if(!missSent&&s.bird.x>.015&&s.bird.x<.06){tap=true;missSent=true;}
      else if(!collisionSeen&&s.score===0&&s.flowers[1].x-s.bird.x>=.006&&s.flowers[1].x-s.bird.x<.023)tap=true;
      else if(collisionSeen&&s.flowers.some(f=>f.height>0&&f.x-s.bird.x>=.006&&f.x-s.bird.x<.023))tap=true;
      if(tap)await page.locator('.game-canvas').click({position:{x:500,y:400}});
    }
    await delay(35);
  }
  const samples=await motionWork;
  await cdp.send('Page.stopScreencast');
  writeFileSync(`${out}/frames.json`,JSON.stringify(frames));
  writeFileSync(`${out}/frames/concat.txt`,frames.map((f,i)=>`file '${f.name}'\nduration ${i<frames.length-1?Math.max(.001,frames[i+1].t-f.t):.1}`).join('\n'));
  execFileSync(process.env.FFMPEG||'ffmpeg',['-y','-f','concat','-safe','0','-i',`${out}/frames/concat.txt`,'-fps_mode','vfr','-c:v','libx264','-pix_fmt','yuv420p',`${out}/review.mp4`],{windowsHide:true,stdio:'ignore',timeout:120000});
  const evidence=await page.evaluate(()=>({events:reviewEvents,phase:birdGame.getState().phase,species:birdGame.getBirdSpecies(),scenery:birdGame.getScenery()}));
  const missing=['miss','hit','collision','landing','won'].filter(type=>!evidence.events.some(e=>e.type===type));
  const report={kind:'browser POC; normal timing and pointer input; no physics overrides',...evidence,missing,
    motion:analyzeMotion(samples),samples,video:'review.mp4 (silent browser screencast, approximately 10 fps; timestamps preserved)',note:'Timing is diagnostic while other rig work may load the host. Review video for object motion; a changing scene cannot prove every object animates correctly.'};
  writeFileSync(`${out}/motion.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({phase:evidence.phase,missing,motion:report.motion}));
  if(missing.length)process.exitCode=1;
} finally {await context?.close();await browser?.close();server.kill();}
