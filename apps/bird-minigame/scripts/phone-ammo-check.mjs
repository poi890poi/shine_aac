import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const exec=promisify(execFile),device='RFCR91GWXLX',adb='E:/Android/Sdk/platform-tools/adb.exe';
const run=async(...args)=>(await exec(adb,['-s',device,...args],{encoding:'buffer',maxBuffer:12e6})).stdout;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dir=new URL('../tmp/ammo-feathers-20260906/',import.meta.url);await mkdir(dir,{recursive:true});
let ws,pid,finished;
const stop=async()=>{if(pid){await run('shell','kill','-2',pid);pid=null;await finished;}};
try {
 await run('reverse','tcp:4184','tcp:4184');await run('forward','tcp:9223','localabstract:chrome_devtools_remote');
 await run('shell','input','keyevent','KEYCODE_WAKEUP');await run('shell','wm','dismiss-keyguard');
 await run('shell','am','start','-a','android.intent.action.VIEW','-d','http://127.0.0.1:4184/?dropMode=flyby','com.android.chrome');await wait(1800);
 const target=(await(await fetch('http://127.0.0.1:9223/json')).json()).find(t=>t.url.includes(':4184/'));
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
 const call=(method,params={})=>new Promise((res,rej)=>{const n=++id;pending.set(n,m=>m.error?rej(m.error):res(m.result));ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw r.exceptionDetails;return r.result.value;};
 await call('Page.navigate',{url:'http://127.0.0.1:4184/?dropMode=flyby'});await wait(1600);await ev('birdGame.ready');
 const audit=async()=>{const r=await ev(`(()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),text=[];let n;while(n=walker.nextNode()){if(!n.textContent.trim()||n.parentElement.closest('script,style,.sr-only'))continue;const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();if(b.width>1&&b.height>1)text.push(n.textContent.trim());}return {text,actionButton:!!document.querySelector('[data-game-drop]'),labels:[...document.querySelectorAll('button')].every(b=>b.getAttribute('aria-label')),overflow:document.documentElement.scrollWidth>innerWidth};})()`);assert.deepEqual(r,{text:[],actionButton:false,labels:true,overflow:false});return r;};
 const checks=[];checks.push(await audit());
 await ev('birdGame.start()');await wait(1400);
 const point=await ev(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.65}})()`);
 const tap=async()=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 await tap();assert.equal(await ev('birdGame.getState().dropUsed'),true);await wait(1000);await tap();assert.equal(await ev('birdGame.getState().drop'),null);
 assert.equal(await ev(`document.querySelector('[data-game-mode]').disabled`),true);
 await ev(`birdGame.exit();document.querySelector('[data-game-settings]').click();document.querySelector('[data-game-mode]').click()`);
 assert.equal(await ev('birdGame.getState().config.dropMode'),'recharge');checks.push(await audit());
 await ev(`document.querySelector('[data-game-settings]').click();document.activeElement.blur()`);
 const remote='/sdcard/Download/ammo-feathers-20260906.mp4';
 assert.equal((await run('shell','sh','-c',"'pidof screenrecord || true'")).toString().trim(),'');
 const recorder=spawn(adb,['-s',device,'shell','screenrecord','--size','540x1200','--bit-rate','2000000','--time-limit','75',remote],{stdio:'pipe'});
 finished=new Promise(r=>recorder.on('exit',r));await wait(800);
 pid=(await run('shell','pidof','screenrecord')).toString().trim();assert.match(pid,/^\d+$/);
 assert.ok((await run('shell','cat',`/proc/${pid}/cmdline`)).toString().includes(remote));
 const begin=Date.now(),trace=[];await ev(`document.dispatchEvent(new CustomEvent('shine-aac:activate',{cancelable:true}))`);
 assert.equal(await ev('birdGame.getState().config.dropMode'),'recharge');assert.equal(await ev('birdGame.getState().ammo'),3);
 await wait(1400);
 for(let i=0;i<3;i++){await tap();assert.equal(await ev('birdGame.getState().ammo'),2-i);await wait(1000);}
 assert.equal(await ev('birdGame.getState().ammo'),0);await tap();assert.equal(await ev('birdGame.getState().drop'),null);
 await writeFile(new URL('empty.png',dir),await run('exec-out','screencap','-p'));
 await ev('birdGame.pause()');const frozen=await ev('birdGame.getState()');await wait(500);
 assert.equal(await ev('birdGame.getState().refillElapsed'),frozen.refillElapsed);checks.push(await audit());await ev('birdGame.resume()');
 let collisionTime=null,shot=false,lastAmmo=0;
 while(Date.now()-begin<65000){
   const s=await ev('birdGame.getState()'),elapsed=(Date.now()-begin)/1000;
   if(s.ammo!==lastAmmo){trace.push({type:'refill',elapsed,ammo:s.ammo});lastAmmo=s.ammo;}
   if(s.featherBurst&&!collisionTime){collisionTime=elapsed;trace.push({type:'collision',elapsed,pass:s.pass,burst:s.featherBurst});}
   if(s.featherBurst?.age>.65&&!shot){await writeFile(new URL('feathers.png',dir),await run('exec-out','screencap','-p'));shot=true;}
   if(collisionTime&&elapsed>collisionTime+3.2)break;
   await wait(40);
 }
 assert.ok(collisionTime,'ordinary no-input descent must collide');assert.ok(shot);assert.equal(await ev('birdGame.getState().ammo'),3);
 checks.push(await audit());await stop();await run('pull',remote,fileURLToPath(new URL('phone.mp4',dir)));
 await ev('birdGame.exit();birdGame.activate()');assert.equal(await ev('birdGame.getState().config.dropMode'),'recharge');assert.equal(await ev('birdGame.getState().ammo'),3);
 const report={device,checks,trace,recording:'Physical phone Chrome, packaged app, browser touch and host switch inputs; normal game timing, no state overrides.',duration:(Date.now()-begin)/1000};
 await writeFile(new URL('phone-check.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
 try{await stop();}finally{ws?.close();await run('shell','input','keyevent','KEYCODE_SLEEP');await wait(900);assert.match((await run('shell','dumpsys','display')).toString(),/mScreenState=OFF/);console.log('Verified test display OFF');}
}
