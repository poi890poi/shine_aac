import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudPosition,CLOUD_PLACEMENTS,LEAF_PRESETS} from '../src/reviewed-scenery.js';
import {createCloudPlacements} from '../src/cloud-layout.js';
import {readFileSync} from 'node:fs';
test('reviewed cloud art keeps far/near order, slower distant drift, and frozen reduced motion',()=>{
  assert.deepEqual(CLOUD_PLACEMENTS.map(p=>p[4]),[...Array(6).fill('far'),...Array(5).fill('near')]);
  const delta=p=>cloudPosition(p,480,640,10).x-cloudPosition(p,480,640,0).x;
  assert.ok(delta(CLOUD_PLACEMENTS[0])<delta(CLOUD_PLACEMENTS[6]));
  for(const p of CLOUD_PLACEMENTS)assert.deepEqual(cloudPosition(p,480,640,100,true),cloudPosition(p,480,640,0,true));
  assert.deepEqual(LEAF_PRESETS.map(p=>p.length),[4,5,4,5]);
});
test('cloud recipe retains the approved sizes while seeds vary composition',()=>{
  const approved=JSON.parse(readFileSync(new URL('../research/shared-grid-review.json',import.meta.url),'utf8'));
  assert.deepEqual(createCloudPlacements(29),approved.cloudRecipe.placements);
  assert.deepEqual(createCloudPlacements(71),createCloudPlacements(71));
  assert.notDeepEqual(createCloudPlacements(71),createCloudPlacements(29));
  for(let seed=0;seed<100;seed++)for(const [shape,x,y,scale,layer] of createCloudPlacements(seed)){
    assert.ok(Number.isInteger(shape)&&shape>=0&&shape<6);assert.ok(Number.isInteger(x)&&Number.isInteger(y));
    const nominal=layer==='far'?.30:.56;assert.ok(scale>=nominal*.82-.001&&scale<=nominal*1.18+.001);
  }
});
