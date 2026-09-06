// Adversarial review of what the existing tests actually observe. Mutations are
// isolated under tmp; production sources and baseline tests are never overwritten.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {moduleRoot,loadRules} from './rule-loader.mjs';
const out=join(moduleRoot,'tmp','shape-consistency-audit-20260905');await mkdir(out,{recursive:true});
const rendererPath=join(moduleRoot,'src','pixel-art.js'),testPath=join(moduleRoot,'test','pixel-art.test.mjs');
const renderer=await readFile(rendererPath,'utf8'),testSource=await readFile(testPath,'utf8'),rules=await loadRules();
const hash=text=>createHash('sha256').update(text).digest('hex');
const replaceFunction=(source,name,next,replacement)=>{
  const start=source.indexOf(`export function ${name}(`),end=source.indexOf(`export function ${next}(`,start);
  if(start<0||end<0)throw new Error('Renderer function boundaries changed; inspect the audit harness.');
  return source.slice(0,start)+replacement+'\n\n'+source.slice(end);
};
const noBird=source=>replaceFunction(source,'drawBird','drawFlower','export function drawBird() {}');
const poorFlower=source=>replaceFunction(source,'drawFlower','drawCloud',`export function drawFlower(p,x,top,ground) {
  p.rect(x-1,top,3,ground-top,'green');
  p.ellipse(x,top,3,3,'face');
}`);
const cases=[['baseline',renderer],['bird-completely-removed',noBird(renderer)],
  ['flower-petals-leaves-face-removed',poorFlower(renderer)],['both-shapes-destroyed',poorFlower(noBird(renderer))]];
const results=[];
for(const [name,source] of cases) {
  const moduleFile=join(out,name+'.mjs'),testFile=join(out,name+'.test.mjs');await writeFile(moduleFile,source);
  const rewritten=testSource.replace(/from (['"])([^'"]+)\1/g,(match,quote,spec)=>{
    if(!spec.startsWith('.'))return match;
    const url=spec==='../src/pixel-art.js'?pathToFileURL(moduleFile):new URL(spec,pathToFileURL(testPath));
    return `from ${JSON.stringify(String(url))}`;
  });
  await writeFile(testFile,rewritten);
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap',testFile],{encoding:'utf8',timeout:60000});
  if(result.error)throw result.error;
  await writeFile(join(out,name+'.tap'),result.stdout+result.stderr);
  results.push({case:name,rendererSha256:hash(source),exitCode:result.status,
    passedTests:Number(result.stdout.match(/# pass (\d+)/)?.[1]??0),failedTests:Number(result.stdout.match(/# fail (\d+)/)?.[1]??0),
    existingTestsDetectedVisualDefect:name==='baseline'?null:result.status!==0});
}
const curves=[];
for(const id of ['taiwan_blue_magpie','mikado_pheasant']) {
  const c=rules.feathers.species[id],theta=c.tipTangentDegrees*Math.PI/180;
  const control=[[0,0],[-c.bendStartRatio,0],[-1+0.28*Math.cos(theta),c.tipDropRatio-0.28*Math.sin(theta)],[-1,c.tipDropRatio]];
  const point=t=>[0,1].map(k=>(1-t)**3*control[0][k]+3*(1-t)**2*t*control[1][k]+3*(1-t)*t*t*control[2][k]+t**3*control[3][k]);
  let length=0,last=point(0);for(let i=1;i<=10000;i++){const p=point(i/10000);length+=Math.hypot(p[0]-last[0],p[1]-last[1]);last=p;}
  curves.push({species:id,declaredLength:1,guideBezierArcLength:length,excessPercent:(length-1)*100,
    note:'Reproduces the PowerShell guide control points; length is horizontal span, not normalized arc length.'});
}
const bird=rules.species.species.find(b=>b.id==='taiwan_blue_magpie'),torso=rules.pixelStyle.bird.torsoPixels;
const nominalHead=bird.ratios.headDiameter*rules.style.sharedExaggeration.headDiameter*torso/100;
const report={audit:'shape-consistency',scope:'existing checks; no production art edits',sourceSha256:hash(renderer),testSha256:hash(testSource),results,
  undetectedMutations:results.slice(1).filter(r=>!r.existingTestsDetectedVisualDefect).length,
  guideCurveCheck:curves,pixelQuantization:{nominalHeadDiameter:nominalHead,headPrimitiveDiameter:2*Math.round(nominalHead/2)+1,
    note:'Ellipse primitive extent before overlap/occlusion, not an independent measurement of the final bird silhouette.'},
  conclusion:'Passing current tests does not establish bird or flower shape quality or identity preservation.'};
await writeFile(join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(results[0].exitCode!==0)process.exitCode=1;
