import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {demoSegments} from './demo-coverage.mjs';
const exec=promisify(execFile),device=process.env.BIRD_DEVICE??'RFCR91GWXLX',adb=process.env.ADB??'E:/Android/Sdk/platform-tools/adb.exe';
const run=async(...args)=>(await exec(adb,['-s',device,...args],{encoding:'buffer',maxBuffer:12e6})).stdout;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dir=new URL(process.env.BIRD_DEMO_DIR??'../tmp/complete-demo-20260906/',import.meta.url);await mkdir(dir,{recursive:true});
let ws,pid,finished,keepAwake;
let keepAwakeWork=Promise.resolve(),keepAwakeError=null;
const nativePackage=process.env.BIRD_NATIVE_PACKAGE;
const stop=async()=>{if(pid){await run('shell','kill','-2',pid);pid=null;await finished;}};
try {
 if(!nativePackage){const preflight=await fetch('http://127.0.0.1:4184/');assert.ok(preflight.ok,'Start the packaged POC server on port 4184 before waking the phone');await run('reverse','tcp:4184','tcp:4184');await run('forward','tcp:9223','localabstract:chrome_devtools_remote');}
 await run('shell','input','keyevent','KEYCODE_WAKEUP');await run('shell','wm','dismiss-keyguard');
 // CDP playfield touches do not reset Android's physical user-activity timer.
 // Keep this physical test awake without changing any persistent timeout setting.
 keepAwake=setInterval(()=>{
   keepAwakeWork=keepAwakeWork.then(()=>run('shell','input','keyevent','KEYCODE_WAKEUP')).catch(error=>{keepAwakeError=error;});
 },10000);
 const url=(nativePackage?'https://bird-garden.local/':'http://127.0.0.1:4184/')+'?species='+encodeURIComponent(process.env.BIRD_SPECIES??'taiwan_blue_magpie');
 // adb shell joins arguments into remote shell text: quote the URL's query separator.
 if(nativePackage){
   await run('shell','am','force-stop',nativePackage);
   await run('shell','am','start','-n',nativePackage+'/.MainActivity');await wait(1800);
   const appPid=(await run('shell','pidof',nativePackage)).toString().trim();assert.match(appPid,/^\d+$/);
   await run('forward','tcp:9223','localabstract:webview_devtools_remote_'+appPid);
 }else{await run('shell','am','start','-a','android.intent.action.VIEW','-d',"'"+url+"'",'com.android.chrome');await wait(1800);}
 // Some test devices show Android's legacy-app notice on each Chrome launch.
 // Dismiss only that observed system notice, never an arbitrary screen coordinate.
 if(process.env.BIRD_DISMISS_COMPAT_NOTICE==='1'){
   await run('shell','uiautomator','dump','/sdcard/Download/poc-ui.xml');
   const xml=(await run('shell','cat','/sdcard/Download/poc-ui.xml')).toString();
   if(xml.includes('這個應用程式與最新版的 Android 不相容')){
     const button=xml.match(/<node\b[^>]*resource-id="android:id\/button1"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
     assert.ok(button,'Known compatibility notice must have its system OK button');
     await run('shell','input','tap',String(Math.round((+button[1]+ +button[3])/2)),String(Math.round((+button[2]+ +button[4])/2)));await wait(1000);
   }
 }
 const target=(await(await fetch('http://127.0.0.1:9223/json')).json()).find(t=>t.url.includes(nativePackage?'bird-garden.local':':4184/'));assert.ok(target,'Packaged game WebView is available');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
 ws.addEventListener('close',()=>{for(const respond of pending.values())respond({error:new Error('Phone debugging connection closed')});pending.clear();});
 const call=(method,params={})=>new Promise((res,rej)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);rej(new Error('Phone debugging request timed out: '+method));},10000);pending.set(n,m=>{clearTimeout(timer);m.error?rej(m.error):res(m.result)});ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw r.exceptionDetails;return r.result.value;};
 await call('Page.navigate',{url});await wait(1600);await ev('birdGame.ready');
 assert.equal(await ev('birdGame.getState().config.dropMode'),'recharge','Actual default mode');
 assert.equal(await ev('birdGame.getState().ammo'),3,'Actual default charges');
 const orientationChecks=[];
 if(nativePackage&&process.env.BIRD_REVIEW_ROTATION==='1'){
   const previousAuto=(await run('shell','settings','get','system','accelerometer_rotation')).toString().trim();
   const previousRotation=(await run('shell','settings','get','system','user_rotation')).toString().trim();
   try{
     await run('shell','settings','put','system','accelerometer_rotation','0');
     for(const rotation of ['1','0']){
       await run('shell','settings','put','system','user_rotation',rotation);await wait(1200);
       const shot=await run('exec-out','screencap','-p'),screen=[shot.readUInt32BE(16),shot.readUInt32BE(20)];
       const info=await ev(`(()=>{const r=document.querySelector('.game-canvas').getBoundingClientRect();return {width:r.width*devicePixelRatio,height:r.height*devicePixelRatio,x:r.x*devicePixelRatio,y:r.y*devicePixelRatio}})()`);
       assert.ok(Math.abs(info.width-screen[0])<=2&&Math.abs(info.height-screen[1])<=2,'Native canvas fills physical display after rotation');
       assert.ok(Math.abs(info.x)<=1&&Math.abs(info.y)<=1);orientationChecks.push({rotation,screen,canvas:info});
       await writeFile(new URL('orientation-'+rotation+'.png',dir),shot);
     }
   }finally{
     for(const [name,value] of [['user_rotation',previousRotation],['accelerometer_rotation',previousAuto]]){
       if(value==='null')await run('shell','settings','delete','system',name);else await run('shell','settings','put','system',name,value);
     }
     await wait(1000);
   }
 }
 const requestedSpecies=process.env.BIRD_SPECIES??'taiwan_blue_magpie';
 assert.equal(await ev('birdGame.getBirdSpecies()'),requestedSpecies);
 await ev(`window.demoTrace=[];for(const type of ['drop','miss','hit','cleared','collision','landing','won'])document.querySelector('.bird-game').addEventListener('birdgame:'+type,e=>demoTrace.push({type,elapsed:(performance.now()-window.demoStart)/1000,pass:e.detail.state.pass,score:e.detail.state.score,flowerId:e.detail.flowerId}));document.activeElement.blur()`);
 await writeFile(new URL('garden.png',dir),await run('exec-out','screencap','-p'));
 const canvasInfo=await ev(`(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {width:c.width,height:c.height,cssWidth:r.width,cssHeight:r.height,x:r.x,y:r.y,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio}})()`);
 if(nativePackage){assert.ok(canvasInfo.x<=.5&&canvasInfo.y<=.5);assert.ok(canvasInfo.cssWidth>=canvasInfo.viewport[0]&&canvasInfo.cssHeight>=canvasInfo.viewport[1]);}
 const remote='/sdcard/Download/'+(process.env.BIRD_DEMO_NAME??'complete-garden-demo-20260906')+'.mp4';
 assert.equal((await run('shell','sh','-c',"'pidof screenrecord || true'")).toString().trim(),'');
 await ev('window.demoStart=performance.now()');
 const recorder=spawn(adb,['-s',device,'shell','screenrecord','--size',process.env.BIRD_VIDEO_SIZE??'540x1200','--bit-rate','4000000','--time-limit','180',remote],{stdio:'pipe'});
 finished=new Promise(r=>recorder.on('exit',r));await wait(800);
 pid=(await run('shell','pidof','screenrecord')).toString().trim();assert.match(pid,/^\d+$/);
 assert.ok((await run('shell','cat',`/proc/${pid}/cmdline`)).toString().includes(remote));
 const pickerReviewed=[];
 if(process.env.BIRD_REVIEW_PICKER==='1'){
   const clickSelector=async selector=>{
     const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
     if(nativePackage){const dpr=await ev('devicePixelRatio');await run('shell','input','tap',String(Math.round(p.x*dpr)),String(Math.round(p.y*dpr)));}
     else{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   };
   await ev("birdGame.setBirdSpecies('taiwan_blue_magpie')");
   for(let page=0;page<4;page++){
     const ids=await ev("[...document.querySelectorAll('[data-game-bird]')].filter(b=>!b.hidden).map(b=>b.dataset.gameBird)");
     assert.equal(ids.length,4);
     for(const species of ids){await clickSelector('[data-game-bird="'+species+'"]');await wait(650);assert.equal(await ev('birdGame.getBirdSpecies()'),species);pickerReviewed.push(species);}
     await writeFile(new URL('picker-'+page+'.png',dir),await run('exec-out','screencap','-p'));
     if(page<3){await clickSelector('[data-bird-next]');await wait(200);}
   }
   assert.equal(new Set(pickerReviewed).size,16);await ev('birdGame.setBirdSpecies('+JSON.stringify(requestedSpecies)+')');
 }
 await ev(`window.testAudioContexts=[];{const NativeAudio=window.AudioContext;window.AudioContext=class extends NativeAudio{constructor(...args){super(...args);window.testAudioContexts.push(this);}};}`);
 const startPoint=await ev(`(()=>{const r=document.querySelector('[data-game-primary]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 if(nativePackage){const dpr=await ev('devicePixelRatio');await run('shell','input','tap',String(Math.round(startPoint.x*dpr)),String(Math.round(startPoint.y*dpr)));}
 else{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[startPoint]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await wait(100);assert.equal(await ev('testAudioContexts[0]?.state'),'running','Audio unlocked by actual touch');
 await ev('document.activeElement.blur()');
 const roundScenery=await ev('JSON.stringify(birdGame.getScenery())');
 await ev('birdGame.pause();birdGame.resume()');assert.equal(await ev('JSON.stringify(birdGame.getScenery())'),roundScenery);
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
 assert.equal(await ev('JSON.stringify(birdGame.getScenery())'),roundScenery,'Scenery fixed through every flyby, collision and landing');
 const trace=await ev('window.demoTrace'),duration=await ev('(performance.now()-window.demoStart)/1000');
 const segments=demoSegments(trace,duration);assert.ok(collisionShot);
 await stop();await run('pull',remote,fileURLToPath(new URL('phone.mp4',dir)));
 const report={device,canvasInfo,input:'Physical test-device Chrome; normal game timing and browser playfield touches; no physics/state overrides',trace,segments,fullLengthSegments:[[0,duration]],duration,final:{phase:state.phase,score:state.score,heights:state.flowers.map(f=>f.height)}};
 report.species=await ev('birdGame.getBirdSpecies()');report.pickerReviewed=pickerReviewed;assert.equal(report.species,requestedSpecies);
 report.nativePackage=nativePackage??null;report.scenery=JSON.parse(roundScenery);report.orientationChecks=orientationChecks;report.audioContextRunning=true;
 assert.equal(keepAwakeError,null,'Physical test keep-awake input');
 report.displayKeepAwake='Temporary KEYCODE_WAKEUP every 10 seconds; no persistent settings changed';
 if(nativePackage)report.input='Installed offline Bird Garden APK; physical phone WebView; normal game timing and playfield touches; no physics/state overrides';
 await writeFile(new URL('recording.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {
 clearInterval(keepAwake);await keepAwakeWork;
 try{await stop();}finally{ws?.close();await run('shell','input','keyevent','KEYCODE_SLEEP');await wait(900);assert.match((await run('shell','dumpsys','display')).toString(),/mScreenState=OFF/);console.log('Verified test display OFF');}
}
