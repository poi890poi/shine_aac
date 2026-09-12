import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,updateGame,dropBudget} from '../src/game-core.js';
import {featherParticles,paintAmmo,paintFeathers} from '../src/game-feedback.js';
import {beginLanding} from '../src/landing.js';
const act=(s,type)=>updateGame(s,{type}).state;
const tick=(s,seconds,hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)s=updateGame(s,{type:'TICK',seconds:1/hz}).state;return s;};
// Keep these ammo-boundary fixtures at the original, fastest supported cadence.
const flying=(config={})=>tick(act(createGameState({dropMode:'recharge',speedLevel:2,...config}),'START'),1.3);

test('recharge spends only accepted drops, permits a retry on the same flyby, never queues',()=>{
  let s=flying();s=act(s,'DROP');assert.equal(s.ammo,2);
  for(let i=0;i<20;i++)s=act(s,'DROP');assert.equal(s.ammo,2);
  s=tick(s,1);assert.equal(s.drop,null);assert.equal(s.pass,1);
  s=act(s,'DROP');assert.equal(s.ammo,1);s=tick(s,1);
  s=act(s,'DROP');assert.equal(s.ammo,0);s=tick(s,1);
  for(let i=0;i<20;i++)s=act(s,'DROP');assert.equal(s.ammo,0);assert.equal(s.drop,null);
  s=tick(s,3);assert.equal(s.ammo,1);assert.equal(s.drop,null,'no queued drop on refill');
});
for(const hz of [30,60,120])test(`serial refill boundary, capacity and no banked time at ${hz} Hz`,()=>{
  let s=flying();s=act(s,'DROP');s=tick(s,6-1/hz,hz);assert.equal(s.ammo,2);
  s=tick(s,1/hz,hz);assert.equal(s.ammo,3);assert.equal(s.refillElapsed,0);
  s=tick(s,15,hz);assert.equal(s.ammo,3);assert.equal(s.refillElapsed,0);
  while(s.mode!=='flying'||s.bird.x<0||s.bird.x>1)s=tick(s,1/hz,hz);
  s=act(s,'DROP');assert.equal(s.ammo,2);s=tick(s,5,hz);assert.equal(s.ammo,2);
});
test('spending preserves partial recharge; pause/landing/exit stop timer; reset restores full budget',()=>{
  let s=act(flying(),'DROP');s=tick(s,2);s=act(s,'DROP');assert.equal(s.ammo,1);
  const progress=s.refillElapsed;s=act(s,'PAUSE');s=tick(s,10);assert.equal(s.refillElapsed,progress);
  s=act(s,'RESUME');s=tick(s,4);assert.equal(s.ammo,2);
  const landing=tick({...s,phase:'landing',landing:beginLanding(s)},1);
  assert.equal(landing.ammo,s.ammo);assert.equal(landing.refillElapsed,s.refillElapsed);
  // Exit ticks cannot earn charges and replay explicitly recreates the budget.
  s=act(s,'EXIT');const exited=s.refillElapsed;s=tick(s,5);assert.equal(s.refillElapsed,exited);
  s=act(s,'RESET');assert.equal(s.ammo,3);assert.equal(s.refillElapsed,0);assert.equal(s.config.dropMode,'recharge');
});
test('collision and flyby grant no recharge bonus; feather burst emits once and preserves flowers',()=>{
  let s=flying({refillSeconds:60});s={...s,bird:{x:.875,y:.49,rotation:0},ammo:1,refillElapsed:2};
  const heights=s.flowers.map(f=>f.height),r=updateGame(s,{type:'TICK',seconds:1/120});s=r.state;
  assert.equal(r.events.filter(e=>e.type==='collision').length,1);assert.equal(s.featherBurst.age,0);
  const first=featherParticles(s.featherBurst,320,640);assert.equal(first.length,4);
  s=tick(s,.5);const age=s.featherBurst.age;s=act(s,'PAUSE');s=tick(s,.5);
  assert.equal(s.featherBurst.age,age);s=act(s,'RESUME');s=tick(s,1.5);
  const fallen=featherParticles(s.featherBurst,320,640);
  assert.ok(fallen.every((p,i)=>p.y>first[i].y+30));assert.equal(s.ammo,1);
  assert.deepEqual(s.flowers.map(f=>f.height),heights);assert.ok(s.refillElapsed<5);
  s=tick(s,1);assert.equal(s.featherBurst,null);
  const pass=s.pass;while(s.pass===pass)s=tick(s,.1);assert.equal(s.ammo,1);
  assert.equal(act(s,'RESET').featherBurst,null);
});
test('HUD raster is fixed to the selected corner and visibly distinguishes stored/empty/refilling',()=>{
  const raster=s=>{const pixels=new Map();const ctx={fillStyle:'',fillRect(x,y,w,h){for(let a=x;a<x+w;a++)for(let b=y;b<y+h;b++)pixels.set(`${a},${b}`,this.fillStyle);}};paintAmmo(ctx,s,320);return pixels;};
  const full=flying();const a=raster(full),b=raster({...full,bird:{x:.9,y:.8}});assert.deepEqual(a,b);
  const empty=raster({...full,ammo:0}),partial=raster({...full,ammo:0,refillElapsed:3});
  assert.notDeepEqual(a,empty);assert.notDeepEqual(empty,partial);
  for(const pixels of [a,empty,partial]) {
    assert.equal(pixels.has('10,10'),false,'HUD background stays transparent');
    assert.equal(pixels.has('61,40'),false,'scene remains visible between icons');
    assert.equal(pixels.get('31,27'),'#20243a','dark charge outline remains visible');
  }
  assert.equal(empty.has('40,27'),false,'empty charge interior is transparent');
  assert.equal(a.get('40,27'),'#ffffff','stored charge has a white fill');
  assert.equal(partial.get('40,27'),'#f5df72','partial charge fills upwards');
  assert.equal(empty.has('34,44'),false,'empty refill bar interior is transparent');
  assert.equal(empty.get('31,44'),'#20243a','refill bar retains its dark outline');
  assert.equal(partial.get('34,44'),'#f5df72','refill bar shows progress');
  assert.ok([...a.keys()].every(k=>{const[x,y]=k.split(',').map(Number);return x>=10&&x<184&&y>=10&&y<48;}));
  const right=raster({...full,config:{...full.config,ammoSide:'right'}});
  assert.ok([...right.keys()].every(k=>Number(k.split(',')[0])>=136));
  assert.equal(dropBudget(createGameState()).capacity,3);
  const rects=[];paintFeathers({fillRect(...r){rects.push(r)}},{x:.5,y:.5,age:1},320,640);
  assert.ok(rects.length>0);assert.ok(rects.every(r=>r.every(Number.isInteger)&&r[2]===1&&r[3]===1));
});
for(const mode of ['flyby','recharge'])for(const hz of [30,60,120])test(`${mode} can clear and land at ${hz} Hz`,()=>{
  let s=act(createGameState({dropMode:mode}),'START');
  for(let i=0;i<hz*240&&s.phase!=='won';i++){
    if(s.flowers.some(f=>f.height>0&&Math.abs(f.x-s.bird.x)<.01))s=act(s,'DROP');
    s=tick(s,1/hz,hz);
  }
  assert.equal(s.phase,'won');assert.ok(s.flowers.every(f=>f.height===0));assert.equal(s.score,12);
});
test('invalid mode, corner and charge tuning are rejected',()=>{
  for(const config of [{dropMode:'unknown'},{ammoSide:'bottom'},{ammoCapacity:0},{ammoCapacity:6},{ammoCapacity:2.5},{refillSeconds:0},{refillSeconds:Infinity}])assert.throws(()=>createGameState(config),RangeError);
});
