import assert from 'node:assert/strict';
const target=(await(await fetch('http://127.0.0.1:9223/json')).json()).find(t=>t.url.startsWith('http://127.0.0.1:4178/'));
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(m.error):resolve(m.result));ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await call('Page.navigate',{url:'http://127.0.0.1:4192/art-studio.html'});await wait(1800);
 const result=await evaluate(`(()=>{const atlas=document.querySelector('#atlas'),json=JSON.parse(document.querySelector('#json').value);return {atlas:[atlas.width,atlas.height],version:json.ruleVersion,externalScripts:document.querySelectorAll('script[src]').length,externalStyles:document.querySelectorAll('link[rel=stylesheet]').length};})()`);
 assert.deepEqual(result.atlas,[288,160]);assert.equal(result.externalScripts,0);assert.equal(result.externalStyles,0);
 await evaluate(`(()=>{const select=document.querySelector('#controls select');select.value='8';select.dispatchEvent(new Event('change'));})()`);await wait(500);
 assert.ok((await evaluate(`document.querySelector('[data-game-score]').textContent`)).includes('8'));
 await evaluate(`(()=>{const input=document.querySelector('input[type=range]');input.value='2';input.dispatchEvent(new Event('input'));})()`);
 assert.equal(await evaluate(`JSON.parse(document.querySelector('#json').value).outline.width`),2);
 console.log(JSON.stringify({...result,columnPreview:8,liveOutline:2,status:'passed'}));
}finally{await call('Page.navigate',{url:'http://127.0.0.1:4178/?garden=1'});ws.close();}
