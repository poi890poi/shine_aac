import test from 'node:test';
import assert from 'node:assert/strict';
import {birdSpecies,BIRD_SPECIES,createSpeciesSelection} from '../src/bird-species.js';
import {paintFeathers} from '../src/game-feedback.js';
test('species IDs are explicit, default stays magpie and unknown IDs fail',()=>{
  assert.equal(birdSpecies().id,'taiwan_blue_magpie');
  assert.equal(birdSpecies('yellow_tit').name,'黃山雀');
  assert.equal(new Set(BIRD_SPECIES.map(b=>b.id)).size,16);
  assert.throws(()=>birdSpecies('unknown'),RangeError);
});
test('host defaults to one uniform random draw per round, with no draw on inspection',()=>{
  let calls=0,value=0;const policy=createSpeciesSelection({random:()=>{calls++;return value;}});
  assert.equal(policy.mode,'random');assert.equal(calls,0);
  for(let i=0;i<16;i++){
    value=(i+.5)/16;assert.equal(policy.beginRound().id,BIRD_SPECIES[i].id);
    for(let n=0;n<100;n++)assert.equal(policy.get().id,BIRD_SPECIES[i].id);
    assert.equal(calls,i+1);
  }
  value=0;assert.equal(policy.beginRound().id,BIRD_SPECIES[0].id);
  value=1-Number.EPSILON;assert.equal(policy.beginRound().id,BIRD_SPECIES[15].id);
  assert.throws(()=>policy.choose('yellow_tit'),/disabled/);
});
test('manual POC selection survives new rounds and never uses randomness',()=>{
  const policy=createSpeciesSelection({speciesSelection:'manual',random:()=>{throw new Error('must not draw');}});
  policy.choose('yellow_tit');for(let i=0;i<10;i++)assert.equal(policy.beginRound().id,'yellow_tit');
  policy.choose('mikado_pheasant');assert.equal(policy.beginRound().id,'mikado_pheasant');
  assert.throws(()=>policy.choose('unknown'),RangeError);
});
test('invalid selection policies and random values fail explicitly',()=>{
  assert.throws(()=>createSpeciesSelection({speciesSelection:'sometimes'}),RangeError);
  for(const value of [-.01,1,NaN,Infinity])assert.throws(()=>createSpeciesSelection({random:()=>value}).beginRound(),RangeError);
});
test('species feathers change plumage colors while retaining burst geometry',()=>{
  const render=id=>{const result=[];const ctx={fillRect(...r){result.push({r,color:this.fillStyle});}};
    paintFeathers(ctx,{x:.4,y:.3,age:.7},480,640,birdSpecies(id).featherColors);return result;};
  const a=render('taiwan_blue_magpie'),b=render('yellow_tit');
  assert.deepEqual(a.map(p=>p.r),b.map(p=>p.r));assert.notDeepEqual(a,b);
  assert.ok(b.some(p=>p.color==='#8a942b'));assert.ok(b.every(p=>p.color!=='#477de0'));
});
