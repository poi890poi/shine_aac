import test from 'node:test';
import assert from 'node:assert/strict';
import {exteriorMatte} from '../src/sprite-assets.js';
test('exterior matte removes checkerboard but preserves enclosed white eyes and feather tips',()=>{
  const w=9,h=9,data=new Uint8ClampedArray(w*h*4).fill(255);
  for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)if(x===2||x===6||y===2||y===6){const i=(y*w+x)*4;data.set([20,22,40,255],i);}
  data.set([225,225,225,255],4);
  exteriorMatte(data,w,h);
  assert.equal(data[3],0);assert.equal(data[7],0);
  assert.equal(data[(4*w+4)*4+3],255);assert.deepEqual([...data.slice((4*w+4)*4,(4*w+4)*4+4)],[255,255,255,255]);
  assert.equal(data[(2*w+2)*4+3],255);
});
