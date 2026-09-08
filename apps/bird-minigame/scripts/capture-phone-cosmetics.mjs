// Physical Chrome screenshots of packaged cosmetic changes; display cleanup is mandatory.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const exec=promisify(execFile),device=process.env.BIRD_DEVICE??'RFCR91GWXLX';
const adb=async(...args)=>(await exec('E:/Android/Sdk/platform-tools/adb.exe',['-s',device,...args],{encoding:'buffer',maxBuffer:12e6})).stdout;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=new URL('../tmp/visual-tuning-20260906/',import.meta.url);await mkdir(out,{recursive:true});let ws;
try{
  await adb('reverse','tcp:4184','tcp:4184');await adb('forward','tcp:9223','localabstract:chrome_devtools_remote');
  await adb('shell','input','keyevent','KEYCODE_WAKEUP');await adb('shell','wm','dismiss-keyguard');
  const base='http://127.0.0.1:4184/';await adb('shell','am','start','-a','android.intent.action.VIEW','-d',base+'?dropMode=recharge','com.android.chrome');await wait(1800);
  const targets=await(await fetch('http://127.0.0.1:9223/json')).json();const target=targets.find(t=>t.url.startsWith(base));assert.ok(target);
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let serial=0;const pending=new Map();
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}});
  ws.addEventListener('close',()=>{for(const callback of pending.values())callback({error:'CDP closed'});pending.clear();});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout'));},10000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);});ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  for(const columns of [8,4]){
    await call('Page.navigate',{url:base+'?dropMode=recharge&columns='+columns});await wait(1400);await ev('birdGame.ready');
    const tuning=await ev(`import('/src/visual-tuning.js').then(m=>m.VISUAL_TUNING)`);assert.equal(tuning.ammoScale,2);assert.equal(tuning.flowerHeadScale,1.15);
    assert.equal(await ev('birdGame.getState().flowers.length'),columns);
    await ev('birdGame.start();document.activeElement.blur()');await wait(1900);
    await writeFile(new URL('phone-'+columns+'.png',out),await adb('exec-out','screencap','-p'));
    const data=await ev(`document.querySelector('canvas').toDataURL().split(',')[1]`);
    await writeFile(new URL('phone-canvas-'+columns+'.png',out),Buffer.from(data,'base64'));
    await ev('birdGame.pause()');
  }
  console.log('Captured current phone Chrome artwork at 4 and 8 AAC columns.');
}finally{
  ws?.close();await adb('shell','input','keyevent','KEYCODE_SLEEP');await wait(900);
  assert.match((await adb('shell','dumpsys','display')).toString(),/mScreenState=OFF/);console.log('Verified phone display OFF');
}
