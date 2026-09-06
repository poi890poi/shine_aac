// Physical Chrome regression; always sleeps the test device on completion/failure.
// Run with Node 24. BIRD_DEVICE and BIRD_CDP_PORT may select another test phone.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
const exec=promisify(execFile),device=process.env.BIRD_DEVICE??'RFCR91GWXLX';
const adb=(...args)=>exec('E:/Android/Sdk/platform-tools/adb.exe',['-s',device,...args]);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dir=new URL('../tmp/textfree-20260906/',import.meta.url);await mkdir(dir,{recursive:true});
let ws;
try {
 await adb('shell','input','keyevent','KEYCODE_WAKEUP');await adb('shell','wm','dismiss-keyguard');
 const targets=await(await fetch(`http://127.0.0.1:${process.env.BIRD_CDP_PORT??9223}/json`)).json();
 const target=targets.find(t=>t.url.includes('127.0.0.1:4184'))??targets.find(t=>t.id==='9');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let serial=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m);pending.delete(m.id)}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw r.exceptionDetails;return r.result.value;};
 await call('Page.navigate',{url:'http://127.0.0.1:4184/?textfree=1'});await wait(1500);await ev('birdGame.ready');
 const audit=()=>ev(`(()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),text=[];let node;while(node=walker.nextNode()){if(!node.textContent.trim()||node.parentElement.closest('script,style,.sr-only'))continue;const r=document.createRange();r.selectNodeContents(node);const b=r.getBoundingClientRect();if(b.width>1&&b.height>1)text.push(node.textContent.trim());}return {text,dropButton:!!document.querySelector('[data-game-drop]'),buttons:[...document.querySelectorAll('button')].every(b=>!!b.getAttribute('aria-label')),overflow:document.documentElement.scrollWidth>innerWidth};})()`);
 const check=async()=>{const a=await audit();assert.deepEqual(a.text,[]);assert.equal(a.dropButton,false);assert.equal(a.buttons,true);assert.equal(a.overflow,false);return a;};
 const ready=await check();await ev('birdGame.start()');await wait(1500);
 const p=await ev(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await ev('birdGame.getState().dropUsed'),true);
 await wait(950);assert.equal(await ev('birdGame.getState().drop'),null);
 await ev(`document.dispatchEvent(new CustomEvent('shine-aac:activate',{cancelable:true}))`);assert.equal(await ev('birdGame.getState().drop'),null);
 await ev('birdGame.pause()');const before=await ev('birdGame.getState()');await wait(350);const after=await ev('birdGame.getState()');assert.deepEqual(after.bird,before.bird);assert.equal(after.dropUsed,true);
 const paused=await check();await ev(`document.querySelector('[data-game-settings]').click()`);const settings=await check();
 await ev(`document.querySelector('[data-game-settings]').click();document.activeElement.blur()`);
 const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(new URL('textfree-game.png',dir),Buffer.from(shot.data,'base64'));
 await ev('birdGame.resume()');assert.equal(await ev('birdGame.getState().dropUsed'),true);
 await ev('birdGame.exit()');const exited=await check();await ev('birdGame.activate()');assert.equal(await ev('birdGame.getState().phase'),'running');
 const report={device,checks:['no visible text in ready/running/paused/settings/exited','no droplet button','accessible icon labels','touch drops once','host extra activation ignored after resolution','pause retains spent state','switch replays after exit'],ready,paused,settings,exited};
 await writeFile(new URL('phone-check.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
 ws?.close();await adb('shell','input','keyevent','KEYCODE_SLEEP');await wait(800);
 const {stdout}=await adb('shell','dumpsys','display');assert.match(stdout,/mScreenState=OFF/,'test display must be off');console.log('Verified test display OFF');
}
