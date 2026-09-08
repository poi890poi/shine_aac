import test from 'node:test';
import assert from 'node:assert/strict';
import {paintLandingGrass} from '../src/reviewed-scenery.js';

for(const [width,height,ground] of [[480,640,576],[480,922,830],[640,720,648]]){
  test(`meadow overlaps rice with a bounded uneven connected fringe at ${width}x${height}`,()=>{
    const raster=()=>{const data=new Uint8Array(width*height);const ctx={fillRect(x,y,w,h){
      for(let cy=Math.max(0,y);cy<Math.min(height,y+h);cy++)for(let cx=Math.max(0,x);cx<Math.min(width,x+w);cx++)data[cy*width+cx]=1;
    }};paintLandingGrass(ctx,width,height,ground);return data;};
    const data=raster(),seam=ground-18,edge=[];
    assert.deepEqual(data,raster(),'fringe must not shimmer between frames');
    for(let x=0;x<width;x++){
      let y=0;while(y<height&&!data[y*width+x])y++;edge.push(y);
      assert.ok(y>=seam-24&&y<seam,'grass overlaps only the immediate rice margin');
      for(let cy=seam;cy<height;cy++)assert.equal(data[cy*width+x],1,'meadow has no gaps');
    }
    assert.ok(new Set(edge).size>=8,'silhouette must have varied blade and clump heights');
    assert.ok(Math.max(...edge)-Math.min(...edge)>=8,'reject a flat field cutoff');
  });
}
