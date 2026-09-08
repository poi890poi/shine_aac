// screenrecord is silent. Reconstruct the game's own effects from measured events.
import {createRequire} from 'node:module';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const exec=promisify(execFile),require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),dir=new URL(process.env.BIRD_DEMO_DIR,import.meta.url),file=name=>fileURLToPath(new URL(name,dir));
const recording=JSON.parse(await readFile(file('recording.json'))),verification=JSON.parse(await readFile(file('full-length-verification.json')));
const duration=verification.outputDuration,offset=recording.duration-duration;assert.ok(Math.abs(offset)<1,'Recording/event clocks must closely agree');
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4197'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4197/');
 const result=await page.evaluate(async({duration,offset,trace})=>{
  const {scheduleEffect,SOUND_EFFECTS}=await import('/src/game-audio.js'),rate=48000;
  const context=new OfflineAudioContext(1,Math.ceil(duration*rate),rate);
  for(const event of trace)if(SOUND_EFFECTS[event.type])scheduleEffect(context,event.type,Math.max(0,event.elapsed-offset));
  const rendered=await context.startRendering(),samples=rendered.getChannelData(0),bytes=new Uint8Array(44+samples.length*2),view=new DataView(bytes.buffer);
  const text=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes.length-44,true);
  let peak=0;for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);}
  const chunks=[];for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
  return {base64:btoa(chunks.join('')),peak};
 },{duration,offset,trace:recording.trace});
 assert.ok(result.peak>.02&&result.peak<.3);await writeFile(file('event-soundtrack.wav'),Buffer.from(result.base64,'base64'));
 await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',file('bird-garden-full-poc.mp4'),'-i',file('event-soundtrack.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','96k','-t',String(duration),'-movflags','+faststart','-metadata','description=Physical tablet video with event-synced synthesized game sound; soundtrack reconstructed from actual game events, not device audio capture.',file('bird-garden-full-poc-sound.mp4')]);
 const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json',file('bird-garden-full-poc-sound.mp4')])).stdout);
 assert.ok(probe.streams.some(s=>s.codec_type==='audio'));assert.ok(Math.abs(Number(probe.format.duration)-duration)<.1);
 await writeFile(file('soundtrack-verification.json'),JSON.stringify({duration,offset,peak:result.peak,events:recording.trace.length,method:'Original game synthesis scheduled from actual recorded events; not captured device audio',streams:probe.streams},null,2));
 console.log(JSON.stringify({duration,audio:'event-synced game synthesis',peak:result.peak}));
}finally{await browser?.close();server.kill();}
