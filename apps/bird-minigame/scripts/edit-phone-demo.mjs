import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {demoSegments,verifyDemoCoverage} from './demo-coverage.mjs';
const exec=promisify(execFile),dir=new URL('../tmp/complete-demo-20260906/',import.meta.url);
const source=fileURLToPath(new URL('phone.mp4',dir)),output=fileURLToPath(new URL('demo.mp4',dir));
const report=JSON.parse(await readFile(new URL('recording.json',dir)));
const info=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height','-of','json',source])).stdout);
if(info.streams[0].width!==540||info.streams[0].height!==1200)throw new Error('Review crop for the new capture dimensions');
const segments=demoSegments(report.trace,Number(info.format.duration));verifyDemoCoverage(report.trace,segments);
const split=segments.map((_,i)=>`[s${i}]`).join('');
const filters=[`[0:v]crop=540:1114:0:86,split=${segments.length}${split}`,
  ...segments.map(([a,b],i)=>`[s${i}]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}]`),
  segments.map((_,i)=>`[v${i}]`).join('')+`concat=n=${segments.length}:v=1:a=0[out]`].join(';');
await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',source,'-filter_complex',filters,'-map','[out]','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',output]);
let offset=0;const timeline=[];
for(const [a,b] of segments){for(const e of report.trace.filter(e=>e.elapsed>=a&&e.elapsed<=b))timeline.push({...e,elapsed:offset+e.elapsed-a});offset+=b-a;}
await writeFile(new URL('edit.json',dir),JSON.stringify({segments,timeline,duration:offset,coverage:['miss','hit','collision','landing','won']},null,2));
console.log(JSON.stringify({output,duration:offset,timeline}));
