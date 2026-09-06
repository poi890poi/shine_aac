// Keep the complete recorded round. Crop browser/device chrome only; no time edits.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifyDemoCoverage} from './demo-coverage.mjs';
const exec=promisify(execFile),dir=new URL(process.env.BIRD_DEMO_DIR??'../tmp/poc-phone-final-20260906/',import.meta.url);
const file=name=>fileURLToPath(new URL(name,dir));
const report=JSON.parse(await readFile(file('recording.json')));
const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height,codec_name','-of','json',file('phone.mp4')])).stdout);
const duration=Number(probe.format.duration),video=probe.streams[0];
verifyDemoCoverage(report.trace,[[0,duration]]);
const python='C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const code=`import sys,json,numpy as np
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB'); data=np.array(im)
cw,ch,dpr,vw,vh=map(float,sys.argv[2:]); physical_width=round(cw*dpr); physical_height=round(ch*dpr)
sky=(data==[145,213,219]).all(2); rows=np.where(sky.sum(1)>=physical_width*.9)[0]
assert len(rows),'Cannot identify the unoccluded game canvas in preflight screenshot'
y=int(rows[0]); xs=np.where(sky[y])[0]; x=int(xs[0]); assert abs(int(xs[-1])-x+1-physical_width)<=2
sx=vw/im.width; sy=vh/im.height; assert abs(sx-sy)<.001,'Recording stretched the device aspect ratio'
crop=[round(x*sx)//2*2,round(y*sy)//2*2,round(physical_width*sx)//2*2,round(physical_height*sy)//2*2]
assert crop[0]+crop[2]<=vw and crop[1]+crop[3]<=vh
print(json.dumps(crop))`;
const c=report.canvasInfo;
const crop=JSON.parse((await exec(python,['-c',code,file('garden.png'),String(c.cssWidth),String(c.cssHeight),String(c.dpr),String(video.width),String(video.height)])).stdout);
const [x,y,w,h]=crop;
const attribution='Mountain photograph: Greenigor, 日出前的北大武山 (2016), Wikimedia Commons, CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ . Cropped, sky removed, pixelated and recolored. Adapted mountain and POC video: CC BY-SA 4.0. Source: https://commons.wikimedia.org/wiki/File:日出前的北大武山.jpg';
await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',file('phone.mp4'),'-vf',`crop=${w}:${h}:${x}:${y},fps=30`,'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','comment='+attribution,file('bird-garden-full-poc.mp4')],{maxBuffer:4e6});
const out=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height,codec_name','-of','json',file('bird-garden-full-poc.mp4')])).stdout);
const outputDuration=Number(out.format.duration);if(Math.abs(outputDuration-duration)>.1)throw Error('Full-length export changed duration');
verifyDemoCoverage(report.trace,[[0,outputDuration]]);
await writeFile(file('video-attribution.txt'),attribution+'\n');
await writeFile(file('full-length-verification.json'),JSON.stringify({crop,sourceDuration:duration,outputDuration,segments:[[0,outputDuration]],trace:report.trace,streams:out.streams,physicalDevice:report.device,timeCuts:false,speed:1,audio:'silent screen recording'},null,2));
for(const type of ['miss','hit','collision','landing','won']){
  const event=report.trace.find(e=>e.type===type),offset=type==='collision'?.7:type==='landing'?3:.25;
  await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(Math.min(outputDuration-.1,event.elapsed+offset)),'-i',file('bird-garden-full-poc.mp4'),'-frames:v','1',file('video-'+type+'.png')]);
}
console.log(JSON.stringify({output:file('bird-garden-full-poc.mp4'),duration:outputDuration,crop,coverage:['miss','hit','collision','landing','won']}));
