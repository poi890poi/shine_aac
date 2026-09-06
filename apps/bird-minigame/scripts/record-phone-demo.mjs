import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {demoSegments} from './demo-coverage.mjs';
const exec=promisify(execFile),device=process.env.BIRD_DEVICE??'RFCR91GWXLX',adb=process.env.ADB??'E:/Android/Sdk/platform-tools/adb.exe';
const run=async(...args)=>(await exec(adb,['-s',device,...args],{encoding:'buffer',maxBuffer:12e6})).stdout;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dir=new URL('../tmp/complete-demo-20260906/',import.meta.url);await mkdir(dir,{recursive:true});
let ws,pid,finished;
const stop=async()=>{if(pid){await run('shell','kill','-2',pid);pid=null;await finished;}};
try {
 await run('reverse','tcp:4184','tcp:4184');await run('forward','tcp:9223','localabstract:chrome_devtools_remote');
 await run('shell','input','keyevent','KEYCODE_WAKEUP');await run('shell','wm','dismiss-keyguard');
 const url='http://127.0.0.1:4184/?dropMode=recharge';
 await run('shell','am','start','-a','android.intent.action.VIEW','-d',url,'com.android.chrome');await wait(1800);
 const target=(await(await fetch('http://127.0.0.1:9223/json')).json()).find(t=>t.url.includes(':4184/'));
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
 const call=(method,params={})=>new Promise((res,rej)=>{const n=++id;pending.set(n,m=>m.error?rej(m.error):res(m.result));ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw r.exceptionDetails;return r.result.value;};
 await call('Page.navigate',{url});await wait(1600);await ev('birdGame.ready');
 await ev(`window.demoTrace=[];for(const type of ['drop','miss','hit','collision','landing','won'])document.querySelector('.bird-game').addEventListener('birdgame:'+type,e=>demoTrace.push({type,elapsed:(performance.now()-window.demoStart)/1000,pass:e.detail.state.pass,score:e.detail.state.score,flowerId:e.detail.flowerId}));document.activeElement.blur()`);
 await writeFile(new URL('garden.png',dir),await run('exec-out','screencap','-p'));
 const remote='/sdcard/Download/complete-garden-demo-20260906.mp4';
 assert.equal((await run('shell','sh','-c',"'pidof screenrecord || true'")).toString().trim(),'');
 await ev('window.demoStart=performance.now()');
 const recorder=spawn(adb,['-s',device,'shell','screenrecord','--size','540x1200','--bit-rate','2000000','--time-limit','180',remote],{stdio:'pipe'});
 finished=new Promise(r=>recorder.on('exit',r));await wait(800);
 pid=(await run('shell','pidof','screenrecord')).toString().trim();assert.match(pid,/^\d+$/);
 assert.ok((await run('shell','cat',`/proc/${pid}/cmdline`)).toString().includes(remote));
 await ev(`birdGame.start();document.activeElement.blur()`);
 const point=await ev(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.65}})()`);
 const tap=async()=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const begin=Date.now();let missSent=false,collisionSeen=false,collisionShot=false,hitShot=false,lastPass=0;
 while(Date.now()-begin<155000) {
   const s=await ev('birdGame.getState()');
   if(s.pass!==lastPass){lastPass=s.pass;console.log(JSON.stringify({pass:s.pass,score:s.score,mode:s.mode}));}
   if(s.mode==='rescue')collisionSeen=true;
   if(s.featherBurst?.age>.65&&!collisionShot){await writeFile(new URL('collision.png',dir),await run('exec-out','screencap','-p'));collisionShot=true;}
   if(s.score>0&&!hitShot){await wait(80);await writeFile(new URL('hit.png',dir),await run('exec-out','screencap','-p'));hitShot=true;}
   if(s.phase==='won'){await wait(1600);await writeFile(new URL('landed.png',dir),await run('exec-out','screencap','-p'));break;}
   if(s.mode==='flying'&&s.phase==='running'&&!s.drop&&s.ammo>0) {
     if(!missSent&&s.bird.x>.015&&s.bird.x<.06){await tap();missSent=true;}
     else if(!collisionSeen&&s.score===0&&s.flowers[1].x-s.bird.x>=.006&&s.flowers[1].x-s.bird.x<.023)await tap();
     else if(collisionSeen&&s.flowers.some(f=>f.height>0&&f.x-s.bird.x>=.006&&f.x-s.bird.x<.023))await tap();
   }
   await wait(35);
 }
 const state=await ev('birdGame.getState()');assert.equal(state.phase,'won');
 const trace=await ev('window.demoTrace'),duration=await ev('(performance.now()-window.demoStart)/1000');
 const segments=demoSegments(trace,duration);assert.ok(collisionShot);
 await stop();await run('pull',remote,fileURLToPath(new URL('phone.mp4',dir)));
 const report={device,input:'Physical phone Chrome; normal game timing and browser playfield touches; no physics/state overrides',trace,segments,duration,final:{phase:state.phase,score:state.score,heights:state.flowers.map(f=>f.height)}};
 await writeFile(new URL('recording.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
 try{await stop();}finally{ws?.close();await run('shell','input','keyevent','KEYCODE_SLEEP');await wait(900);assert.match((await run('shell','dumpsys','display')).toString(),/mScreenState=OFF/);console.log('Verified test display OFF');}
}
