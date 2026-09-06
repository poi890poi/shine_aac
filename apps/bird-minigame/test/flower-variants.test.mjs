import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {flowerVariant,recolorPetals,recolorLeaves,validateFlowerVariants} from '../src/flower-variants.js';
import {paintFlower} from '../src/sprite-assets.js';
const layout=JSON.parse(await readFile(new URL('../rules/sprite-layout.json',import.meta.url))).flower;
test('four stable flower presets repeat across AAC columns and have distinct parameters',()=>{
  validateFlowerVariants(layout);
  for(let id=0;id<8;id++)assert.deepEqual(flowerVariant(layout,id),flowerVariant(layout,id+4));
  assert.equal(new Set(layout.variants.map(v=>v.name)).size,4);
  assert.equal(new Set(layout.variants.map(v=>v.headScale)).size,4);
});
test('petal tint preserves alpha, eyes, outline, yellow face, white splash and leaves',()=>{
  const source=new Uint8ClampedArray([240,120,125,255, 20,22,40,255, 255,225,20,255, 255,255,255,255, 70,170,30,255, 240,120,125,0]);
  const result=recolorPetals(source.slice(),6,1,layout.variants[1].petalRamp);
  assert.notDeepEqual(result.slice(0,3),source.slice(0,3));assert.equal(result[3],255);
  assert.deepEqual(result.slice(4),source.slice(4));
  assert.deepEqual(recolorPetals(source.slice(),6,0,layout.variants[1].petalRamp),source,'no tint below head crop');
});
test('shortening keeps variant head size fixed and leaf count follows its parameters',()=>{
  for(let id=0;id<4;id++) {
    const image={width:355},sprites={layout:{flower:layout},flower:[image,image,image,image]};
    const paint=height=>{const draws=[];const ctx={save(){},restore(){},translate(){},scale(){},fillRect(){},drawImage(...args){draws.push(args)}};
      paintFlower(ctx,sprites,{id,x:.5,displayHeight:height,reaction:0,hits:0,blocked:0},320,640,576);return draws;};
    const tall=paint(.4),short=paint(.2);
    assert.equal(tall.length,layout.variants[id].leafLevels.length+1);
    assert.deepEqual(tall.at(-1).slice(-2),short.at(-1).slice(-2));
    assert.equal(tall.at(-1).at(-1),Math.round(layout.headSourceHeight*layout.scale*layout.variants[id].headScale));
  }
});
test('leaf tint matches the stem palette without changing head pixels or alpha',()=>{
  const source=new Uint8ClampedArray([70,170,30,255, 70,170,30,255, 20,22,40,255, 70,170,30,0]);
  const result=recolorLeaves(source.slice(),1,1,layout.variants[1].stemRamp);
  assert.deepEqual(result.slice(0,4),source.slice(0,4));
  assert.notDeepEqual(result.slice(4,7),source.slice(4,7));assert.equal(result[7],255);
  assert.deepEqual(result.slice(8),source.slice(8));
});
test('unsafe flower preset values are rejected',()=>{
  for(const override of [{headScale:2},{curvePixels:20},{stemHalfWidth:0},{stemRamp:['red']},{leafSize:3},{leafLevels:[1]},{petalRamp:['red']},{name:''}])assert.throws(()=>validateFlowerVariants({...layout,variants:[{...layout.variants[0],...override}]}),RangeError);
});
test('whole-plant presets draw continuous curved stems at configured widths and colors after shortening',()=>{
  const profiles=[];
  for(let id=0;id<4;id++)for(const height of [.4,.2]) {
    const rows=new Map(),image={width:355};
    const ctx={fillStyle:'',save(){},restore(){},translate(){},scale(){},drawImage(){},fillRect(x,y,w,h){if(!rows.has(y))rows.set(y,[]);rows.get(y).push({x,w,color:this.fillStyle});}};
    paintFlower(ctx,{layout:{flower:layout},flower:[image]}, {id,x:.5,displayHeight:height,reaction:0,hits:0,blocked:0},320,640,576);
    const ys=[...rows.keys()];assert.equal(ys.at(-1),576);assert.equal(ys.length,576-ys[0]+1,'no gaps along the stalk');
    for(const paints of rows.values()){assert.equal(paints[0].w,layout.variants[id].stemHalfWidth*2+1);assert.equal(paints[1].color,layout.variants[id].stemRamp[0]);}
    assert.ok(new Set([...rows.values()].map(p=>p[0].x)).size>1,'curved stem silhouette');
    if(height===.4)profiles.push([...rows.values()]);
  }
  for(let i=1;i<profiles.length;i++)assert.notDeepEqual(profiles[0],profiles[i]);
});
