import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudPosition,CLOUD_PLACEMENTS,LEAF_PRESETS} from '../src/reviewed-scenery.js';
test('reviewed cloud art keeps far/near order, slower distant drift, and frozen reduced motion',()=>{
  assert.deepEqual(CLOUD_PLACEMENTS.map(p=>p[4]),['far','far','far','near','near','near']);
  const delta=p=>cloudPosition(p,480,640,10).x-cloudPosition(p,480,640,0).x;
  assert.ok(delta(CLOUD_PLACEMENTS[0])<delta(CLOUD_PLACEMENTS[3]));
  for(const p of CLOUD_PLACEMENTS)assert.deepEqual(cloudPosition(p,480,640,100,true),cloudPosition(p,480,640,0,true));
  assert.deepEqual(LEAF_PRESETS.map(p=>p.length),[4,5,4,5]);
});
