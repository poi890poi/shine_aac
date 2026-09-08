// Standalone POC physical gate, dispatched by device-test.bat --bird-poc APK.
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
const device=process.env.ANDROID_SERIAL??'RFCR91GWXLX',adb=process.env.ADB??'E:/Android/Sdk/platform-tools/adb.exe';
const apk=resolve(process.argv[2]||'apps/bird-minigame/android/build/outputs/apk/debug/bird-poc-debug.apk');
const evidenceName=process.env.BIRD_EVIDENCE_NAME??'clearing-apk-20260907';
assert.match(evidenceName,/^[a-z0-9-]+$/);
const out=resolve(root,'apps/bird-minigame/tmp',evidenceName);await mkdir(out,{recursive:true});
const run=(...args)=>exec(adb,['-s',device,...args],{maxBuffer:12e6});
try{
 const sha256=createHash('sha256').update(await readFile(apk)).digest('hex');
 const install=await run('install','-r',apk);assert.match(install.stdout,/Success/);
 const installed=await run('shell','pm','path','org.shineaac.birdgarden');assert.match(installed.stdout,/base.apk/);
 await run('pull',installed.stdout.trim().replace('package:',''),resolve(out,'installed.apk'));
 assert.equal(createHash('sha256').update(await readFile(resolve(out,'installed.apk'))).digest('hex'),sha256);
 const child=spawn(process.execPath,['scripts/record-phone-demo.mjs'],{
  cwd:resolve(root,'apps/bird-minigame'),windowsHide:true,stdio:'inherit',
  env:{...process.env,BIRD_DEVICE:device,BIRD_NATIVE_PACKAGE:'org.shineaac.birdgarden',BIRD_SPECIES:'yellow_tit',BIRD_REVIEW_PICKER:'1',BIRD_DEMO_DIR:'../tmp/'+evidenceName+'/',BIRD_DEMO_NAME:evidenceName}
 });
 const code=await new Promise((r,j)=>{child.once('exit',r);child.once('error',j);});assert.equal(code,0,'Physical selector and full-round gate');
 await writeFile(resolve(out,'apk-verification.json'),JSON.stringify({apk,sha256,device,package:'org.shineaac.birdgarden',installedBytesVerified:true,result:'PASS',gate:'device-test.bat --bird-poc'},null,2));
 console.log('Bird Garden APK physical gate PASS');
}finally{
 await run('shell','input','keyevent','KEYCODE_SLEEP');
 await new Promise(r=>setTimeout(r,900));assert.match((await run('shell','dumpsys','display')).stdout,/mScreenState=OFF/);
 console.log('Verified physical display OFF');
}
