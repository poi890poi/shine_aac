import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PixelSurface,drawCloud,drawCloudField,cloudPlacements} from '../src/pixel-art.js';
import {validatePixelStyle} from '../src/style-rules.js';
const style=JSON.parse(await readFile(new URL('../rules/pixel-style.json',import.meta.url)));
const raster=(s,field=false,t=0,reduced=false)=>{const p=new PixelSurface(320,640,s);p.clear('sky');if(field)drawCloudField(p,t,reduced);else drawCloud(p,20,30);return p;};
const area=p=>p.data.filter(v=>v!==p.indices.sky).length;
test('default field contains six clouds and clouds have substantially larger rendered silhouettes',()=>{
  assert.equal(cloudPlacements(style,320,640).length,6);
  const old={...style,cloud:{...style.cloud,width:42,height:18}};
  assert.ok(area(raster(style))>area(raster(old))*3);
  const sparse={...style,cloud:{...style.cloud,count:2}};
  assert.ok(area(raster(style,true))>area(raster(sparse,true))*2);
});
test('lobe shape, puffiness and base position change actual raster output',()=>{
  const base=raster(style).data;
  for(const mutate of [s=>s.cloud.lobeCenters[1][1]=.7,s=>s.cloud.puffiness=1,s=>s.cloud.baseHeight=.7]) {
    const changed=structuredClone(style);mutate(changed);validatePixelStyle(changed);
    assert.notDeepEqual(raster(changed).data,base);
  }
});
test('drift is deterministic, reduced motion freezes it, and layout stays bounded',()=>{
  assert.deepEqual(raster(style,true,12).data,raster(style,true,12).data);
  assert.notDeepEqual(raster(style,true,0).data,raster(style,true,12).data);
  assert.deepEqual(raster(style,true,0,true).data,raster(style,true,12,true).data);
  for(const t of [0,100,10000])for(const [w,h] of [[320,320],[320,640],[480,760]]) {
    for(const c of cloudPlacements(style,w,h,t)) {
      assert.ok(Number.isInteger(c.x)&&Number.isInteger(c.y));
      assert.ok(c.x>=-c.cloudWidth-1&&c.x<=w+1);
      assert.ok(c.y>=Math.round(h*.08)&&c.y<=Math.round(h*.58));
    }
  }
});
test('cloud variants have different silhouettes even when normalized to the same dimensions',()=>{
  const masks=style.cloud.shapes.map((shape,i)=>{
    const normalized=structuredClone(style);normalized.cloud.shapes=normalized.cloud.shapes.map(s=>({...s,widthScale:1,heightScale:1}));
    const p=new PixelSurface(140,80,normalized);p.clear('sky');drawCloud(p,10,10,1,i);
    return p.data.map(v=>v===p.indices.sky?0:1);
  });
  for(let i=0;i<masks.length;i++)for(let j=i+1;j<masks.length;j++)assert.notDeepEqual(masks[i],masks[j]);
  assert.equal(new Set(cloudPlacements(style,320,640).map(c=>c.shapeIndex)).size,4);
  for(const shapes of [[],[{name:'bad',widthScale:0,heightScale:1}],Array(9).fill({name:'bad',widthScale:1,heightScale:1})])assert.throws(()=>validatePixelStyle({...style,cloud:{...style.cloud,shapes}}),RangeError);
});
test('cloud tuning validation rejects invalid or unbounded values; older styles remain usable',()=>{
  for(const cloud of [{count:0},{count:2.5},{count:11},{width:200},{puffiness:0},{sizeVariation:1},{baseHeight:2},{altitudeRange:[.6,.1]},{altitudeRange:[0,1]}]) {
    assert.throws(()=>validatePixelStyle({...style,cloud:{...style.cloud,...cloud}}),RangeError);
  }
  const legacy=structuredClone(style);for(const key of ['count','puffiness','baseHeight','sizeVariation','altitudeRange'])delete legacy.cloud[key];
  validatePixelStyle(legacy);assert.ok(area(raster(legacy,true))>0);
});
test('far clouds draw first and move more slowly than near clouds',()=>{
  const before=cloudPlacements(style,320,640,0),after=cloudPlacements(style,320,640,10);
  assert.deepEqual(before.map(c=>c.layer),['far','far','far','near','near','near']);
  const travel=before.map((c,i)=>{const span=320+c.cloudWidth+2;return (after[i].x-c.x+span)%span;});
  assert.ok(Math.min(...travel.slice(3))>Math.max(...travel.slice(0,3))*2);
  assert.ok(before.slice(3).reduce((s,c)=>s+c.scale,0)>before.slice(0,3).reduce((s,c)=>s+c.scale,0));
  assert.deepEqual(cloudPlacements(style,320,640,0,true),cloudPlacements(style,320,640,100,true));
  const bad=structuredClone(style);bad.cloud.layers[0].speedMultiplier=2;
  assert.throws(()=>validatePixelStyle(bad),/smaller and slower/);
});
test('rounded cloud masks stay connected and parameter edits invalidate cached shading',()=>{
  for(let shape=0;shape<4;shape++) {
    const p=new PixelSurface(180,120,style);p.clear('sky');drawCloud(p,25,20,1,shape);
    const mask=new Set();p.data.forEach((v,i)=>{if(v!==p.indices.sky)mask.add(i);});
    const pending=[mask.values().next().value];mask.delete(pending[0]);
    while(pending.length){const i=pending.pop();for(const j of [i-1,i+1,i-p.width,i+p.width])if(mask.delete(j))pending.push(j);}
    assert.equal(mask.size,0,'all cloud puffs form one connected silhouette');
  }
  const custom=structuredClone(style),p=new PixelSurface(180,120,custom);p.clear('sky');drawCloud(p,25,20);
  const before=p.data.slice();custom.cloud.shadowDepth=.25;p.clear('sky');drawCloud(p,25,20);
  assert.notDeepEqual(before,p.data,'cached tile must reflect new shadow parameters');
  for(const change of [{lobeBlend:0},{bellyRoundness:.8},{shadowDepth:1}])assert.throws(()=>validatePixelStyle({...style,cloud:{...style.cloud,...change}}),RangeError);
});
