import test from 'node:test';
import assert from 'node:assert/strict';
import {nearCloudY,createCloudPlacements} from '../src/cloud-layout.js';

test('front cloud bounds stay above lower slopes for every mountain, mood and aspect',()=>{
  const sourceHeights=[143,102,144,132,143,135,78,108];
  const cloudHeights=[240,290,390,275,295,180];
  for(const [w,h,ground] of [[360,800,720],[640,400,375],[480,640,576],[800,360,339]]){
    for(const sourceHeight of sourceHeights)for(const scale of [1,1.06,1.12]){
      const height=Math.round(sourceHeight*Math.max(w/480,1)*scale),top=ground-108-height;
      for(let seed=0;seed<100;seed++)for(const [shape,,y,size,layer] of createCloudPlacements(seed)){
        if(layer!=='near')continue;
        const ch=Math.round(cloudHeights[shape]*size),actual=nearCloudY(y,h,ch,{top,height});
        assert.ok(Number.isInteger(actual));
        assert.ok(actual+ch<=Math.floor(top+height*.35));
        assert.ok(actual<=Math.round(y*h/640),'never lower an already high cloud');
      }
    }
  }
});

test('high portrait clouds retain their altitude and capped clouds retain a stagger',()=>{
  assert.equal(nearCloudY(85,800,150,{top:469,height:143}),106);
  assert.notEqual(nearCloudY(85,400,200,{top:76,height:191}),nearCloudY(220,400,200,{top:76,height:191}));
  assert.equal(nearCloudY(85,640,200,null),85);
});
