import assert from 'node:assert/strict';
import test from 'node:test';
import {loadRules} from '../scripts/rule-loader.mjs';
import {PixelSurface,renderPixelScene,drawFlower,drawCloud,drawGrass,birdGeometry,tailCenterline} from '../src/pixel-art.js';
import {validatePixelStyle,sceneSize} from '../src/style-rules.js';
import {createGameState,updateGame} from '../src/game-core.js';
import {gameConfigFromAac} from '../src/aac-config.js';
import {DefaultColumns,MinimumColumns,MaximumColumns} from '../../../packages/aac-core/src/index.js';

const source=await loadRules();
const rules={style:source.pixelStyle,species:source.species.species[0],cartoon:source.style,feathers:source.feathers.species.taiwan_blue_magpie,
  rig:source.rigs.rigs.corvid_transit,poseInvariants:source.rigs.globalPoseInvariants};
const make=style=>new PixelSurface(288,360,style??rules.style);

test('native rendering uses the declared palette directly, without intermediate colors',()=>{
  const p=make();renderPixelScene(p,createGameState({columns:8}),rules);
  const expected=new Set(Object.values(rules.style.palette).map(h=>h.slice(1)));
  const rgba=p.rgba();
  for(let i=0;i<rgba.length;i+=4){
    const hex=[...rgba.slice(i,i+3)].map(v=>v.toString(16).padStart(2,'0')).join('');
    assert.ok(expected.has(hex));assert.equal(rgba[i+3],255);
  }
});

test('shared outline and light controls change cloud and flower rendering',()=>{
  for(const draw of [p=>drawFlower(p,60,40,150,{reaction:0}),p=>drawCloud(p,20,25)]) {
    const render=style=>{const p=make(style);p.clear('sky');draw(p);return p.data;};
    const base=render(rules.style);
    const thick=structuredClone(rules.style);thick.outline.width=2;
    assert.notDeepEqual(render(thick),base);
    const light=structuredClone(rules.style);light.shading.lightDirection=[1,1];
    assert.notDeepEqual(render(light),base);
  }
});

test('bird dimensions use species ratios at every style size and tail arc length is preserved',()=>{
  for(const size of [16,20,28]) {
    const custom={...rules,style:structuredClone(rules.style)};custom.style.bird.torsoPixels=size;
    const g=birdGeometry(custom),ratios=rules.species.ratios;
    assert.ok(Math.abs(g.tail/g.torso-ratios.tailLength/100)<1e-12);
    assert.ok(Math.abs(g.wing/g.torso-ratios.wingLength/100)<1e-12);
    assert.ok(Math.abs(g.head/g.torso-ratios.headDiameter*rules.cartoon.sharedExaggeration.headDiameter/100)<1e-12);
    const path=tailCenterline(g.tail,rules.feathers);
    const arc=path.reduce((sum,p,i)=>i?sum+Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1]):0,0);
    assert.ok(Math.abs(arc-g.tail)<1e-6);assert.ok(path.at(-1)[1]>g.tail*0.19);
    assert.equal(path[0][1],0);assert.equal(path[1][1],0);
  }
});

test('grass stays green through its depth and shortening keeps a continuous native-width stem',()=>{
  const p=make();p.clear('sky');drawGrass(p,280);
  const greens=['greenShadow','green','greenLight'].map(key=>p.indices[key]);
  assert.ok(p.data.slice(280*p.width).every(v=>greens.includes(v)));
  for(const top of [40,80,120]) {
    p.clear('sky');drawFlower(p,60,top,200,{reaction:0});
    for(let y=top+rules.style.flower.headRadius+2;y<200;y++)assert.ok(greens.includes(p.data[y*p.width+60]));
  }
});

test('style validation rejects invalid colors, mixed outline units and unbounded scene sizes',()=>{
  validatePixelStyle(rules.style);
  for(const mutate of [s=>s.outline.width=1.5,s=>s.grid.columnPitch=2,s=>s.palette.sky='blue',s=>s.shading.lightDirection=[0,0]]) {
    const bad=structuredClone(rules.style);mutate(bad);assert.throws(()=>validatePixelStyle(bad),RangeError);
  }
  for(const columns of [3,4,5,6,7,8])for(const aspect of [0.5,0.7,1.5]) {
    const size=sceneSize(rules.style,columns,aspect);
    assert.ok(size.width>=columns*rules.style.grid.columnPitch);assert.ok(Number.isInteger(size.height));
  }
});

test('AAC host count agrees with real AAC defaults/range; malformed values fail explicitly',()=>{
  assert.equal(gameConfigFromAac().columns,DefaultColumns);assert.equal(MinimumColumns,3);assert.equal(MaximumColumns,8);
  for(let columns=MinimumColumns;columns<=MaximumColumns;columns++) {
    const state=createGameState(gameConfigFromAac({columns},{columns:4}));
    assert.equal(state.flowers.length,columns);
    state.flowers.forEach((f,i)=>assert.ok(Math.abs(f.x-(i+0.5)/columns)<1e-12));
    assert.ok(state.config.hitWidth*2<1/columns);
    assert.equal(updateGame(state,{type:'RESET'}).state.flowers.length,columns);
  }
  for(const columns of [2,9,4.5,NaN,'6'])assert.throws(()=>gameConfigFromAac({columns}),RangeError);
});

test('all AAC column counts complete through real drops without moving columns',()=>{
  for(let columns=3;columns<=8;columns++)for(const hz of [30,60,120]) {
    let state=updateGame(createGameState({columns}),{type:'START'}).state;
    const positions=state.flowers.map(f=>f.x);
    for(let i=0;i<hz*360&&state.phase!=='won';i++) {
      if(state.phase==='running'&&!state.drop&&state.flowers.some(f=>f.height>0&&Math.abs(f.x-state.bird.x)<0.012))state=updateGame(state,{type:'DROP'}).state;
      state=updateGame(state,{type:'TICK',seconds:1/hz}).state;
    }
    assert.equal(state.phase,'won',`${columns} columns at ${hz} Hz`);
    assert.ok(state.flowers.every(f=>f.height===0));assert.deepEqual(state.flowers.map(f=>f.x),positions);
  }
});
