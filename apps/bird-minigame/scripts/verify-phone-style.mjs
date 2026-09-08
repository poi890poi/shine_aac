import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {moduleRoot} from './rule-loader.mjs';
const exec=promisify(execFile),out=join(moduleRoot,'tmp','phone-pixel-standard-20260905');
await mkdir(out,{recursive:true});
const base='http://127.0.0.1:4178/';
const target=(await(await fetch('http://127.0.0.1:9223/json')).json()).find(t=>t.url.startsWith(base));
if(!target)throw new Error('Open the local garden in the phone Chrome tab first.');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let serial=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,m=>m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const navigate=async path=>{await call('Page.navigate',{url:base+path});await wait(1200);};
const screenshot=async name=>{const r=await exec('E:/Android/Sdk/platform-tools/adb.exe',['-s','RFCR91GWXLX','exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:8e6});await writeFile(join(out,name),r.stdout);};
const report={device:'Samsung SM-G781B / RFCR91GWXLX',surface:'phone Chrome, production package over USB',layouts:[]};
try {
  await call('Runtime.enable');
  for(let columns=3;columns<=8;columns++) {
    await navigate(`?garden=1&columns=${columns}`);await evaluate('birdGame.ready');
    const layout=await evaluate(`(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),b=document.querySelector('[data-game-drop]').getBoundingClientRect();return {columns:birdGame.getState().flowers.length,width:c.width,height:c.height,scaleX:r.width*devicePixelRatio/c.width,scaleY:r.height*devicePixelRatio/c.height,buttonBottom:b.bottom,viewport:innerHeight,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth}})()`);
    assert.equal(layout.columns,columns);assert.ok(Math.abs(layout.scaleX-layout.scaleY)<0.002);
    assert.ok(Math.abs(layout.scaleX-Math.round(layout.scaleX))<0.002);
    assert.ok(layout.buttonBottom<=layout.viewport);assert.equal(layout.scrollWidth,layout.viewportWidth);
    report.layouts.push(layout);
    if([4,8].includes(columns)){await evaluate('birdGame.start()');await wait(1600);await screenshot(`columns-${columns}.png`);}
  }
  report.frames=await evaluate(`new Promise(resolve=>{let last=performance.now(),start=last,intervals=[];function tick(now){intervals.push(now-last);last=now;if(now-start<1500)requestAnimationFrame(tick);else resolve({count:intervals.length,elapsed:now-start,median:intervals.sort((a,b)=>a-b)[Math.floor(intervals.length/2)]});}requestAnimationFrame(tick);})`);
  // Exercise the real mount/start/reset boundary with a changing AAC host config.
  const host=await evaluate(`(async()=>{birdGame.destroy();const {mountBirdGame}=await import('./src/embed.js');let config={columns:6};window.birdGame=mountBirdGame(document.querySelector('#game-mount'),{getAacConfig:()=>config,muted:true});await birdGame.ready;const a=birdGame.getState().flowers.length;config={columns:8};birdGame.start();const b=birdGame.getState().flowers.length;config={columns:3};birdGame.reset();return [a,b,birdGame.getState().flowers.length];})()`);
  assert.deepEqual(host,[6,8,3]);report.hostCounts=host;
  await navigate('art-lab.html');await wait(800);
  const atlas=await evaluate(`(()=>{const c=document.querySelector('#atlas');const out=document.createElement('canvas');out.width=c.width*4;out.height=c.height*4;const ctx=out.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(c,0,0,out.width,out.height);return out.toDataURL('image/png').split(',')[1];})()`);
  await writeFile(join(out,'style-atlas.png'),Buffer.from(atlas,'base64'));
  const lab=await evaluate(`(()=>{const input=document.querySelector('input[type=range]');input.value='2';input.dispatchEvent(new Event('input'));const style=JSON.parse(document.querySelector('#json').value);return {outline:style.outline.width,notice:document.querySelector('#notice').textContent};})()`);
  assert.equal(lab.outline,2);assert.ok(lab.notice.includes('已套用'));report.lab=lab;
  await navigate('?garden=1');await evaluate('birdGame.ready');
  assert.deepEqual(errors,[]);report.errors=errors;
  await writeFile(join(out,'style-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {ws.close();}
