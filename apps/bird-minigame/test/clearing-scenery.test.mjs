import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClearing,paintClearing,MOUNTAIN_MOODS,MOUNTAIN_PROFILES} from '../src/clearing-scenery.js';

test('all live mountain identities load the exact reviewed image with attribution',async()=>{
 const review=JSON.parse(await readFile(new URL('../assets/candidates/mountain-batch-20260908/review/manifest.json',import.meta.url),'utf8'));
 const credits=JSON.parse(await readFile(new URL('../assets/scenery/mountain-variants-attribution.json',import.meta.url),'utf8'));
 assert.ok(MOUNTAIN_PROFILES.length>=8);
 for(const id of MOUNTAIN_PROFILES){
  const expected=review.profiles.find(p=>p.id===id),credit=credits.find(p=>p.id===id);
  assert.ok(expected&&credit,`Missing review or attribution: ${id}`);
  const bytes=await readFile(new URL(`../assets/scenery/${id}-native.png`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.nativeSha256,id);
  for(const field of ['author','sourcePage','license','licenseUrl'])assert.equal(credit[field],expected[field]);
 }
});
test('scenery seeds replay exactly and cover bounded bush counts and mountain moods',()=>{
 const moods=new Set(),profiles=new Set(),palettes=new Set(),counts=new Set();
 for(let seed=0;seed<200;seed++){
  const scene=createClearing(seed);assert.deepEqual(scene,createClearing(seed));
  assert.ok(Object.isFrozen(scene)&&Object.isFrozen(scene.bushes));
  assert.ok(scene.bushes.length>=5&&scene.bushes.length<=8);
  for(const b of scene.bushes){assert.ok(b.x>0&&b.x<1&&b.depth>=0&&b.depth<1);}
  moods.add(scene.mountain);profiles.add(scene.mountainProfile);palettes.add(scene.palette);counts.add(scene.bushes.length);
 }
 assert.equal(moods.size,3);assert.equal(palettes.size,3);assert.equal(counts.size,4);
 assert.equal(profiles.size,MOUNTAIN_PROFILES.length);assert.ok(profiles.size>=8);
 assert.throws(()=>createClearing(NaN));assert.throws(()=>createClearing(-1));
});
test('clearing stays below mountain band and outside foreground landing surface',()=>{
 for(let seed=0;seed<60;seed++){
  const rectangles=[],ctx={fillRect(...r){rectangles.push(r);}};paintClearing(ctx,createClearing(seed),480,628);
  assert.ok(rectangles.every(([x,y,w,h])=>y>=480&&y+h<=646));
 }
 assert.ok(MOUNTAIN_MOODS.every(m=>m.scale>=1&&m.scale<=1.12&&m.id.startsWith('beidawu-')));
});
