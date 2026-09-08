import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright'),out=new URL('../tmp/readability-20260907/',import.meta.url);
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs','--dist'],{env:{...process.env,BIRD_GAME_PORT:'4196'},windowsHide:true,stdio:['ignore','pipe','pipe']});let browser;
try{
  await new Promise((res,rej)=>{server.stdout.once('data',res);server.once('error',rej);});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:600,height:960},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4196/');await page.evaluate(()=>birdGame.ready);
  const sizes=[];
  for(const [width,height] of [[600,960],[960,600],[390,844],[280,640],[640,360]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    const info=await page.evaluate(()=>{const c=document.querySelector('.game-canvas'),r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,nativeWidth:c.width,nativeHeight:c.height,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth};});
    assert.ok(info.x<=.5&&info.y<=.5);assert.ok(info.width>=width&&info.height>=height);
    assert.ok(Math.abs(info.width/info.nativeWidth-info.height/info.nativeHeight)<.00001);
    assert.equal(info.scrollWidth,width);sizes.push(info);
  }
  await page.setViewportSize({width:600,height:960});await page.waitForTimeout(100);
  await page.screenshot({path:new URL('tablet-ready.png',out).pathname.replace(/^\//,'')});
  const rendered=await page.evaluate(async()=>{
    const {loadSprites,paintBird}=await import('/src/sprite-assets.js');
    const {birdPose}=await import('/src/bird-animation.js');
    const {BIRD_SPECIES}=await import('/src/bird-species.js');
    const {createGameState}=await import('/src/game-core.js');
    const {prepareReviewedFlowers,paintReviewedFlower,loadReviewedScenery,paintReviewedScenery}=await import('/src/reviewed-scenery.js');
    const {createClearing}=await import('/src/clearing-scenery.js');
    const {gameplayBounds}=await import('/src/viewport.js');
    const sprites=await loadSprites(),atlas=document.createElement('canvas');atlas.width=800;atlas.height=16*130;const ax=atlas.getContext('2d');ax.imageSmoothingEnabled=false;
    ax.fillStyle='#91d5db';ax.fillRect(0,0,atlas.width,atlas.height);const poses=[];
    for(let i=0;i<BIRD_SPECIES.length;i++){
      const species=BIRD_SPECIES[i],selected=sprites.birds[species.id],bundle={...sprites,bird:selected.frames,layout:{...sprites.layout,bird:selected.layout}},images=[];
      for(let j=0;j<4;j++){
        const c=document.createElement('canvas');c.width=200;c.height=130;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
        const s={...createGameState(),phase:j===3?'won':'landing',time:j/species.frameRate,bird:{x:.6,y:.55,direction:1},landing:{stage:'approach',elapsed:1}};
        const pose=birdPose(s,selected.layout,species.frameRate);paintBird(x,bundle,s,200,130,pose);images.push(c.toDataURL());ax.drawImage(c,j*200,i*130);
      }
      poses.push({id:species.id,distinctAirborne:new Set(images.slice(0,3)).size});
    }
    const landscapeClearance=[];
    for(const species of BIRD_SPECIES){
      const selected=sprites.birds[species.id],bundle={...sprites,bird:selected.frames,layout:{...sprites.layout,bird:selected.layout}};
      let top=320;
      for(const pose of new Set(selected.layout.cycle)){
        const c=document.createElement('canvas');c.width=640;c.height=320;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
        const bounds=gameplayBounds(640,320);x.translate(0,bounds.top);
        paintBird(x,bundle,{...createGameState(),phase:'running',bird:{x:.4,y:.14,direction:1}},640,bounds.height,pose);
        const pixels=x.getImageData(0,0,640,320).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){top=Math.min(top,Math.floor(i/4/640));break;}
      }
      landscapeClearance.push({id:species.id,top});
    }
    const columns=[];
    for(const count of [4,8]){
      const c=document.createElement('canvas');c.width=600;c.height=960;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
      const s=createGameState({columns:count});paintReviewedScenery(x,await loadReviewedScenery(),600,960,864,0,false,createClearing(0));
      for(const flower of s.flowers)paintReviewedFlower(x,prepareReviewedFlowers(sprites),flower,600,960,864);
      columns.push({count,png:c.toDataURL()});
    }
    return {poses,atlas:atlas.toDataURL(),columns,landscapeClearance};
  });
  assert.ok(rendered.poses.every(p=>p.distinctAirborne>=2));
  assert.ok(rendered.landscapeClearance.every(p=>p.top>76),JSON.stringify(rendered.landscapeClearance));
  const png=async(name,data)=>writeFile(new URL(name,out),Buffer.from(data.split(',')[1],'base64'));
  await png('landing-all-species.png',rendered.atlas);
  for(const item of rendered.columns)await png('flowers-'+item.count+'-columns.png',item.png);
  const audio=await page.evaluate(async()=>{
    const {SOUND_EFFECTS,scheduleEffect}=await import('/src/game-audio.js');
    const types=Object.keys(SOUND_EFFECTS),context=new OfflineAudioContext(1,48000*types.length,48000);
    types.forEach((type,i)=>scheduleEffect(context,type,i+.1));
    const buffer=await context.startRendering(),data=buffer.getChannelData(0),measurements=types.map((type,i)=>{const samples=data.slice(i*48000,(i+1)*48000);return {type,peak:Math.max(...samples.map(Math.abs)),energy:samples.reduce((a,b)=>a+b*b,0)};});
    return {samples:Array.from(data),measurements};
  });
  for(const sound of audio.measurements){assert.ok(sound.peak>.02&&sound.peak<.25,sound.type);assert.ok(sound.energy>.1,sound.type);}
  const lifecycle=await page.evaluate(async()=>{
    const {createGameAudio}=await import('/src/game-audio.js'),Native=window.AudioContext,results={};
    try{for(const action of ['mute','stop','unmute']){
      let offline;window.AudioContext=function(){offline=new OfflineAudioContext(1,48000,48000);return offline;};
      const player=createGameAudio();player.unlock();player.play('collision');
      if(action==='stop')player.stop();else{player.setMuted(true);player.play('won');if(action==='unmute'){player.setMuted(false);player.play('hit');}}
      const buffer=await offline.startRendering();results[action]=buffer.getChannelData(0).some(v=>v!==0);
    }}finally{window.AudioContext=Native;}return results;
  });
  assert.deepEqual(lifecycle,{mute:false,stop:false,unmute:true});
  const data=Buffer.alloc(44+audio.samples.length*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);audio.samples.forEach((v,i)=>data.writeInt16LE(Math.round(v*32767),44+i*2));
  await writeFile(new URL('comic-sounds.wav',out),data);
  assert.deepEqual(errors,[]);
  await writeFile(new URL('verification.json',out),JSON.stringify({sizes,poses:rendered.poses,landscapeClearance:rendered.landscapeClearance,sounds:audio.measurements,lifecycle,errors},null,2));
  console.log(JSON.stringify({viewports:sizes.length,animatedSpecies:rendered.poses.length,sounds:audio.measurements}));
}finally{await browser?.close();server.kill();}
