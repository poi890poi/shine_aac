import test from 'node:test';
import assert from 'node:assert/strict';
import {gameplayBounds,projectGameplayY} from '../src/viewport.js';
import {AMMO_OUTLINE_ROWS} from '../src/game-feedback.js';
test('landscape flight starts at 144 with clearance for the tallest wing; portrait and flower region stay fixed',()=>{
 for(const [w,h] of [[640,400],[720,450],[800,500],[569,320]]){
  const b=gameplayBounds(w,h),anchor=b.top+projectGameplayY(.14,w,h)*b.height;
  assert.equal(anchor,144);assert.ok(anchor-88>=48+8,'tallest flight pose clears the charge/refill row');
  let previous=-Infinity;
  for(let i=0;i<=1000;i++){const y=i/1000,projected=projectGameplayY(y,w,h);assert.ok(projected>previous);previous=projected;if(y>=.46)assert.equal(projected,y);}
 }
 for(const [w,h] of [[360,800],[640,1024]])for(const y of [0,.14,.25,.46,.5,.9,1])assert.equal(projectGameplayY(y,w,h),y);
});
test('charge contour has single-pixel steps at its native readable size',()=>{
 assert.equal(AMMO_OUTLINE_ROWS.length,26);assert.equal(Math.max(...AMMO_OUTLINE_ROWS.map(r=>r[1])),20);
 assert.ok(AMMO_OUTLINE_ROWS.some(([lo],y)=>y>0&&Math.abs(lo-AMMO_OUTLINE_ROWS[y-1][0])===1));
});

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('accepted cloud masters remain byte-identical to the reviewed PNGs',()=>{
 const root=new URL('../',import.meta.url),decision=JSON.parse(readFileSync(new URL('test/fixtures/approved-clouds/decision.json',root)));
 for(const [name,expected] of Object.entries(decision.acceptedNativeExports)){
  for(const folder of ['test/fixtures/approved-clouds/','assets/native/approved-clouds/']){
   const bytes=readFileSync(new URL(folder+name,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
  }
 }
});

import {VISUAL_TUNING} from '../src/visual-tuning.js';
test('native exports match the shared readability tuning',()=>{
 const root=new URL('../assets/native/',import.meta.url);
 assert.equal(JSON.parse(readFileSync(new URL('manifest.json',root))).birdDisplayMultiplier,VISUAL_TUNING.birdScale);
 assert.equal(JSON.parse(readFileSync(new URL('flowers.json',root))).headDisplayScale,VISUAL_TUNING.flowerHeadScale);
});
