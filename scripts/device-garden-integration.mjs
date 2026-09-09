import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readGardenInputProfile } from './device-garden-profile.mjs';
const exec=promisify(execFile),device=process.env.ANDROID_SERIAL, pkg=process.env.SHINE_AAC_TEST_PACKAGE||'org.shineaac.app';
assert.ok(device,'Set ANDROID_SERIAL explicitly');
const adb=process.env.ADB||'E:/Android/Sdk/platform-tools/adb.exe',apk=resolve(process.argv[2]);
const out=resolve('.tmp/tablet-adaptation',`garden-${device}-${Date.now()}`);await mkdir(out,{recursive:true});
const run=async(...args)=>(await exec(adb,['-s',device,...args],{encoding:'buffer',maxBuffer:20e6})).stdout;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readInputProfile=()=>readGardenInputProfile(()=>run('shell','run-as',pkg,'cat','shared_prefs/shine_aac_config.xml'));
let ws,ev,keepAwake;let awakeWork=Promise.resolve();
try {
  assert.match((await run('install','-r',apk)).toString(),/Success/);
  const installed=(await run('shell','pm','path',pkg)).toString().trim().split('\n')[0].replace('package:','');
  await run('pull',installed,resolve(out,'installed.apk'));
  const apkSha=sha(await readFile(apk));assert.equal(sha(await readFile(resolve(out,'installed.apk'))),apkSha,'installed APK matches');
  await run('shell','input','keyevent','224');await run('shell','wm','dismiss-keyguard');
  keepAwake=setInterval(()=>{awakeWork=awakeWork.then(()=>run('shell','input','keyevent','224'));},10000);
  await run('shell','am','force-stop',pkg);await run('shell','am','start','-n',pkg+'/org.shineaac.app.MainActivity');await wait(1800);
  const pid=(await run('shell','pidof',pkg)).toString().trim();assert.match(pid,/^\d+$/);
  await run('forward','tcp:9229','localabstract:webview_devtools_remote_'+pid);
  let target;
  for (let attempt=0;attempt<30&&!target;attempt++) {
    try { target=(await(await fetch('http://127.0.0.1:9229/json')).json()).find(t=>t.url.includes('/apps/web/index.html')); }
    catch { /* The process can exist before the WebView debugger accepts connections. */ }
    if (!target) await wait(500);
  }
  assert.ok(target,'AAC WebView debug target');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  const pending=new Map(),contexts=new Map();let id=0;
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}
    if(m.method==='Runtime.executionContextCreated')contexts.set(m.params.context.id,m.params.context);
    if(m.method==='Runtime.executionContextDestroyed')contexts.delete(m.params.executionContextId);
  });
  const call=(method,params={})=>new Promise((res,rej)=>{const n=++id,t=setTimeout(()=>{pending.delete(n);rej(new Error(method+' timed out'));},10000);pending.set(n,m=>{clearTimeout(t);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);});ws.send(JSON.stringify({id:n,method,params}));});
  ev=async(expression,contextId)=>{const r=await call('Runtime.evaluate',{expression,contextId,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  await call('Runtime.enable');
  const until=async(expression,seconds=20)=>{for(let i=0;i<seconds*5;i++){if(await ev(expression))return;await wait(200);}throw new Error('Condition timed out: '+expression);};
  await until('Boolean(document.querySelector(".config-button"))');
  assert.equal(await ev('document.querySelector(".garden-button")===null'),true,'no game entry on main board');
  // Keep the user's input profile. Exercise hardware when enabled, otherwise
  // use the game's physical touch surface and report that narrower coverage.
  const inputProfile=await readInputProfile();
  const hardwareEnabled=['hardware-buttons','volume-buttons','hardware-and-camera'].includes(inputProfile);
  await ev(`window.__gardenEvents=[];window.addEventListener('message',event=>{if(event.data?.channel==='shine-bird-garden')__gardenEvents.push(event.data);});`);
  const before=await ev(`JSON.stringify({message:document.querySelector('.message').dataset.rawMessage,rows:[...document.querySelectorAll('.row')].map(r=>[...r.querySelectorAll('.tile')].map(t=>[t.dataset.label,t.dataset.action]))})`);
  // Tap the actual accessible native/WebView control, not a JavaScript click.
  async function tapLabel(labels,{scroll=false}={}) {
    for(let attempt=0;attempt<5;attempt++) {
      await run('shell','uiautomator','dump','/sdcard/shine-garden-window.xml');
      const xml=(await run('shell','cat','/sdcard/shine-garden-window.xml')).toString();
      await writeFile(resolve(out,`entry-${labels[0].replace(/\W/g,'')}-${attempt}.xml`),xml);
      const node=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(n=>labels.includes(n.match(/\btext="([^"]*)"/)?.[1]));
      const bounds=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if(bounds&&+bounds[3]>+bounds[1]&&+bounds[4]>+bounds[2]) {
        await run('shell','input','tap',String(Math.round((+bounds[1]+ +bounds[3])/2)),String(Math.round((+bounds[2]+ +bounds[4])/2)));return;
      }
      if(scroll){const png=await run('exec-out','screencap','-p');const w=png.readUInt32BE(16),h=png.readUInt32BE(20);await run('shell','input','swipe',String(Math.round(w*.75)),String(Math.round(h*.8)),String(Math.round(w*.75)),String(Math.round(h*.3)),'300');}
      await wait(300);
    }
    throw new Error('Native entry label unavailable: '+labels.join('/'));
  }
  await tapLabel(['⚙ Settings','⚙ 設定']);
  await tapLabel(['Data and support','資料與支援'],{scroll:true});
  await tapLabel(['App information','App info','關於本程式','關於'],{scroll:true});
  for(let i=0;i<6;i++)await tapLabel(['Version','版本']);
  assert.equal(await ev('Boolean(document.querySelector(".garden-frame"))'),false,'six native version taps do not launch');
  await tapLabel(['Version','版本']);
  await until('__gardenEvents.some(m=>m.type==="ready")',30);
  const ready=await ev('__gardenEvents.find(m=>m.type==="ready")');
  const gameContext=[...contexts.values()].find(c=>c.origin==='https://appassets.androidplatform.net'&&c.auxData?.isDefault);assert.ok(gameContext,'Game module document loaded from packaged HTTPS assets');
  const checkPixelGrid=async()=>{
    const grid=await ev(`(()=>{
      const c=document.querySelector('.game-canvas'),u=Number(c.dataset.pixelScale),w=Number(c.dataset.virtualWidth),h=Number(c.dataset.virtualHeight);
      if(!Number.isInteger(u)||u<1)return {valid:false};
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let violations=0;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,b=(Math.floor(y/u)*u*c.width+Math.floor(x/u)*u)*4;
        if(d[i]!==d[b]||d[i+1]!==d[b+1]||d[i+2]!==d[b+2])violations++;}
      const r=c.getBoundingClientRect();return {valid:true,virtual:[w,h],physical:[c.width,c.height],scale:u,origin:[r.x*devicePixelRatio,r.y*devicePixelRatio],violations};
    })()`,gameContext.id);
    assert.ok(grid.valid,'packaged virtual screen metadata');assert.equal(grid.violations,0,'all physical art pixels share one grid');
    assert.deepEqual(grid.origin,[0,0],'single physical grid origin');
    for(let axis=0;axis<2;axis++)assert.ok(grid.virtual[axis]*grid.scale>=grid.physical[axis]&&grid.virtual[axis]*grid.scale-grid.physical[axis]<grid.scale);
    return grid;
  };
  const readyGrid=await checkPixelGrid();
  const activate=async()=>{
    if(hardwareEnabled)await run('shell','input','keyevent','KEYCODE_BUTTON_A');
    else {
      const point=await ev(`(()=>{const r=document.querySelector('.game-canvas').getBoundingClientRect();return {x:Math.round((r.x+r.width/2)*devicePixelRatio),y:Math.round((r.y+r.height/2)*devicePixelRatio)};})()`,gameContext.id);
      await run('shell','input','tap',String(point.x),String(point.y));
    }
  };
  await activate();
  await until('__gardenEvents.some(m=>m.event==="start")');await wait(1300);
  await activate();await until('__gardenEvents.some(m=>m.event==="drop")');
  const dropped=await ev('__gardenEvents.find(m=>m.event==="drop")');assert.equal(dropped.ammo,2);
  const runningGrid=await checkPixelGrid();
  await writeFile(resolve(out,'pixel-grid.json'),JSON.stringify({ready:readyGrid,running:runningGrid},null,2));
  const screen=await run('exec-out','screencap','-p');await writeFile(resolve(out,'game.png'),screen);
  const canvas=await ev(`(()=>{const r=document.querySelector('.game-canvas').getBoundingClientRect();return {w:r.width*devicePixelRatio,h:r.height*devicePixelRatio,x:r.x*devicePixelRatio,y:r.y*devicePixelRatio};})()`,gameContext.id);
  await writeFile(resolve(out,'viewport.json'),JSON.stringify({canvas,screen:[screen.readUInt32BE(16),screen.readUInt32BE(20)]},null,2));
  assert.ok(Math.abs(canvas.w-screen.readUInt32BE(16))<=2&&Math.abs(canvas.h-screen.readUInt32BE(20))<=2,'game fills the physical display: '+JSON.stringify(canvas));
  await run('shell','input','keyevent','4');await until('ShineAacNavigation.currentPage()==="board"');
  const after=await ev(`JSON.stringify({message:document.querySelector('.message').dataset.rawMessage,rows:[...document.querySelectorAll('.row')].map(r=>[...r.querySelectorAll('.tile')].map(t=>[t.dataset.label,t.dataset.action]))})`);
  assert.equal(after,before,'native game exit preserves communication draft and board');
  assert.equal(await readInputProfile(),inputProfile,'input preference preserved');
  await writeFile(resolve(out,'result.json'),JSON.stringify({result:'PASS',device,pkg,apkSha,columns:ready.columns,speciesId:dropped.speciesId,ammoAfterOneDrop:2,canvas,boardAndDraftPreserved:true,inputProfile,physicalHardwareActivation:hardwareEnabled,physicalTouchActivation:!hardwareEnabled},null,2));
  console.log('PASS physical integrated garden:',device,'columns='+ready.columns,hardwareEnabled?'hardware':'touch','start/drop, fullscreen and AAC return verified');
  console.log('Evidence:',out);
} catch(error) {
  await writeFile(resolve(out,'failure.txt'),error.stack||String(error));
  console.error('Garden gate failure:',error.stack||error);
  throw error;
} finally {
  try {if(ev)await ev(`if(ShineAacNavigation.currentPage()==='bird-garden')ShineAacNavigation.back();`);} finally {
    clearInterval(keepAwake);await awakeWork.catch(()=>{});ws?.close();
    await run('forward','--remove','tcp:9229').catch(()=>{});
    await run('shell','input','keyevent','223');
    let displayOff=false;
    for(let attempt=0;attempt<10&&!displayOff;attempt++) {
      await wait(500);
      displayOff=/mScreenState=OFF/.test((await run('shell','dumpsys','display')).toString());
      if(attempt===4&&!displayOff)await run('shell','input','keyevent','223');
    }
    assert.ok(displayOff,'test display must finish OFF');
    console.log('Verified device display OFF');
  }
}
