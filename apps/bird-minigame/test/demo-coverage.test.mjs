import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSegments,verifyDemoCoverage,DEMO_OUTCOMES} from '../scripts/demo-coverage.mjs';
const trace=[{type:'drop',elapsed:1},{type:'miss',elapsed:2},{type:'drop',elapsed:3},{type:'hit',elapsed:4},{type:'collision',elapsed:30},{type:'landing',elapsed:60},{type:'won',elapsed:72}];
test('demo edits retain miss, hit, collision and the complete landing',()=>{
  const segments=demoSegments(trace,75);assert.equal(verifyDemoCoverage(trace,segments),true);
  assert.ok(segments.some(([a,b])=>a<=60&&b>=73));
  for(const type of DEMO_OUTCOMES)assert.throws(()=>demoSegments(trace.filter(e=>e.type!==type),75),new RegExp(type));
  assert.throws(()=>verifyDemoCoverage(trace,[[0,5],[29,34],[59,61],[71,74]]),/cuts the landing/);
  assert.throws(()=>verifyDemoCoverage(trace,[[3,5],[29,34],[59,74]]),/miss/);
});
