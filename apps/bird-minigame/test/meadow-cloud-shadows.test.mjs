import test from 'node:test';
import assert from 'node:assert/strict';
import {MEADOW_SHADOW_TUNING as tuning,meadowShadowRecipe,meadowShadowPosition,meadowShadowColors,paintMeadowCloudShadows} from '../src/meadow-cloud-shadows.js';

test('overhead shadow field is reproducible, varied and independent of visible clouds',()=>{
 const first=meadowShadowRecipe(9);assert.deepEqual(first,meadowShadowRecipe(9));
 assert.notDeepEqual(first,meadowShadowRecipe(51));
 for(let seed=0;seed<100;seed++){
  const recipe=meadowShadowRecipe(seed);assert.equal(recipe.length,3);
  for(const s of recipe){assert.ok(Object.isFrozen(s));assert.ok(s.width/s.height>5);}
 }
 assert.deepEqual(first,meadowShadowRecipe(9),'cache eviction must not change a round');
});

test('shadow motion is slow, integer aligned and frozen for paused time or reduced motion',()=>{
 const s=meadowShadowRecipe(9)[0],a=meadowShadowPosition(s,640,375,0),b=meadowShadowPosition(s,640,375,10);
 assert.equal(b.x-a.x,18);assert.equal(b.y,a.y);
 assert.deepEqual(meadowShadowPosition(s,640,375,10),b,'same game time is a paused frame');
 assert.deepEqual(meadowShadowPosition(s,640,375,100,true),meadowShadowPosition(s,640,375,0,true));
 for(let i=0;i<1000;i++){
  const p=meadowShadowPosition(s,360,720,i/3);assert.ok(Number.isInteger(p.x)&&Number.isInteger(p.y));
  assert.ok(p.x>=-s.width&&p.x<=360);
 }
});

test('all painted shadow pixels stay inside the middle meadow',()=>{
 for(const [w,ground] of [[360,720],[640,375],[480,576]])for(let seed=0;seed<100;seed++){
  const rectangles=[],ctx={fillRect(...r){rectangles.push(r);}};
  paintMeadowCloudShadows(ctx,seed,'#9ab661',w,ground,3.7);
  assert.ok(rectangles.length>0);
  for(const [x,y,width,height] of rectangles){
   assert.ok([x,y,width,height].every(Number.isInteger));assert.ok(width>0&&height===1);
   assert.ok(y>=ground-108+4&&y+height<=ground-40);
  }
 }
});

test('shadow tones stay subtle across all meadow palettes, with no black outline',()=>{
 for(const meadow of ['#9ab661','#98b36d','#a1b96a']){
  const rgb=meadow.slice(1).match(/../g).map(v=>parseInt(v,16));
  const colors=meadowShadowColors(meadow);assert.equal(new Set(colors).size,2);
  for(const color of colors){
   const tone=color.slice(1).match(/../g).map(v=>parseInt(v,16));
   assert.ok(tone.every((v,i)=>Math.abs(v-rgb[i])<=12));
   assert.ok(tone[0]<rgb[0]&&tone[1]<rgb[1]);
  }
 }
 assert.ok(tuning.coreStrength<=.1);
});
