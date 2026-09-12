// Run through device-test.bat --header-layout under Invoke-AndroidDeviceLease.
// The caller retains the lease through restored settings and verified display OFF.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),adb=process.env.ADB,serial=process.env.ANDROID_SERIAL;
const pkg=process.env.SHINE_AAC_TEST_PACKAGE||'org.shineaac.app',apk=resolve(process.argv[2]);
assert.ok(adb&&serial,'Set ADB and ANDROID_SERIAL under the shared device lease');
const out=resolve('.tmp/header-layout',`${serial}-${Date.now()}`);await mkdir(out,{recursive:true});
const run=async(...args)=>(await exec(adb,['-s',serial,...args],{encoding:'buffer',maxBuffer:24e6})).stdout;
const wait=ms=>new Promise(r=>setTimeout(r,ms));const sha=data=>createHash('sha256').update(data).digest('hex');
let ws;const results=[];const priorFont=(await run('shell','settings','get','system','font_scale')).toString().trim();
try {
 assert.match((await run('install','-r',apk)).toString(),/Success/);
 const installed=(await run('shell','pm','path',pkg)).toString().trim().split('\n')[0].replace('package:','');
 await run('pull',installed,resolve(out,'installed.apk'));
 const apkSha=sha(await readFile(apk));assert.equal(sha(await readFile(resolve(out,'installed.apk'))),apkSha);
 for(const scale of [1,2]) {
  await run('shell','settings','put','system','font_scale',String(scale));
  await run('shell','input','keyevent','224');await run('shell','wm','dismiss-keyguard');
  await run('shell','am','force-stop',pkg);await run('shell','am','start','-n',pkg+'/org.shineaac.app.MainActivity');await wait(1600);
  const pid=(await run('shell','pidof',pkg)).toString().trim();assert.match(pid,/^\d+$/);
  await run('forward','tcp:9233','localabstract:webview_devtools_remote_'+pid);
  let target;for(let i=0;i<30&&!target;i++){try{target=(await(await fetch('http://127.0.0.1:9233/json')).json()).find(t=>t.url.includes('/apps/web/index.html'));}catch{}if(!target)await wait(300);}
  assert.ok(target,'AAC WebView available');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id)pending.get(m.id)?.(m);});
  const call=(method,params={})=>new Promise((res,rej)=>{const n=++id,t=setTimeout(()=>{pending.delete(n);rej(new Error(method+' timeout'));},10000);pending.set(n,m=>{clearTimeout(t);pending.delete(n);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);});ws.send(JSON.stringify({id:n,method,params}));});
  const ev=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
  await wait(500);
  const readMetrics=()=>ev(`(()=>{
   const b=document.querySelector('.config-button'),p=document.querySelector('.phase'),v=document.querySelector('.voice');const br=b.getBoundingClientRect();
   const words=[];const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode())for(const m of n.textContent.matchAll(/\\S+/g)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);words.push({word:m[0],lines:new Set([...r.getClientRects()].filter(x=>x.width&&x.height).map(x=>Math.round(x.top))).size});}
   const vr=document.createRange();vr.selectNodeContents(v);
   const target=document.querySelector('.scan-target-highlight:not([hidden])'),row=target?document.querySelectorAll('.row')[Number(target.dataset.rowStart)]:null;
   const tr=target?.getBoundingClientRect(),rr=row?.getBoundingClientRect();
   return {viewport:[innerWidth,innerHeight],compact:document.querySelector('.status-row').classList.contains('compact-settings'),name:b.getAttribute('aria-label'),button:[br.width,br.height],words,
    phaseFits:p.scrollWidth<=p.clientWidth+1,voiceFits:vr.getBoundingClientRect().width<=v.clientWidth+1,
    boardFits:document.querySelector('.board').getBoundingClientRect().bottom<=innerHeight+1,
    highlightDelta:tr&&rr?[Math.abs(tr.top-rr.top),Math.abs(tr.bottom-rr.bottom)]:null};
  })()`);
  // WebView applies Android text zoom asynchronously after Activity launch.
  // Require a quiet layout window, independently of whether assertions pass.
  let metrics,previous='',stableSince=Date.now();const samples=[],settleDeadline=Date.now()+10000;
  while(Date.now()<settleDeadline) {
   metrics=await readMetrics();const signature=JSON.stringify(metrics);samples.push({at:Date.now(),...metrics});
   if(signature!==previous){previous=signature;stableSince=Date.now();}
   if(Date.now()-stableSince>=1200)break;
   await wait(200);
  }
  assert.ok(Date.now()-stableSince>=1200,'header layout settles within ten seconds');
  await writeFile(resolve(out,`font-${scale}.png`),await run('exec-out','screencap','-p'));
  assert.deepEqual(await readMetrics(),metrics,'screenshot and measured layout agree');
  results.push({scale,...metrics,samples});
  await writeFile(resolve(out,'results.json'),JSON.stringify({apkSha,results},null,2));
  assert.ok(metrics.name&&metrics.button[0]>=48&&metrics.button[1]>=48&&metrics.button[1]<=80,'accessible intrinsic-size Settings target');
  assert.ok(metrics.words.length&&metrics.words.every(w=>w.lines===1),'status words do not break');
  assert.ok(metrics.phaseFits&&metrics.voiceFits&&metrics.boardFits,'status and board fit');
  assert.ok(metrics.highlightDelta&&metrics.highlightDelta.every(d=>d<=1),'scan highlight aligned after header fit');
  if(scale===2) {
   // The first Android accessibility request can return an unexpanded WebView.
   // Retry discovery, never fall back to a guessed or DOM-only tap coordinate.
   let node;
   for(let attempt=0;attempt<6&&!node;attempt++) {
    await run('shell','uiautomator','dump','/sdcard/shine-header-layout.xml');
    const xml=(await run('shell','cat','/sdcard/shine-header-layout.xml')).toString();
    await writeFile(resolve(out,'accessibility.xml'),xml);
    node=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(n=>n.includes('clickable="true"')&&[n.match(/\btext="([^"]*)"/)?.[1],n.match(/\bcontent-desc="([^"]*)"/)?.[1]].includes(metrics.name));
    if(!node)await wait(300);
   }
   const bounds=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert.ok(bounds,'Settings exposed by its accessible name');
   await run('shell','input','tap',String(Math.round((+bounds[1]+ +bounds[3])/2)),String(Math.round((+bounds[2]+ +bounds[4])/2)));await wait(700);
   assert.match((await run('shell','dumpsys','activity','activities')).toString(),/(?:topResumedActivity|mResumedActivity)[^\n]*SettingsActivity/,'physical gear tap opens native Settings');
   await run('shell','input','keyevent','4');await wait(400);
  }
  ws.close();ws=null;
 }
 console.log('PASS actual Android 100%/200% header, named Settings touch and highlight alignment');console.log(out);
} finally {
 ws?.close();await run('forward','--remove','tcp:9233').catch(()=>{});
 await run('shell','am','force-stop',pkg).catch(()=>{});
 if(priorFont==='null')await run('shell','settings','delete','system','font_scale');else await run('shell','settings','put','system','font_scale',priorFont);
 await run('shell','input','keyevent','223');
}
