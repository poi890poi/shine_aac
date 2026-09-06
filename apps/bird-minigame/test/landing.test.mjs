import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,updateGame} from '../src/game-core.js';

for(const side of ['left','right'])for(const hz of [30,60,120])test(`smooth ${side} landing at ${hz} Hz`,()=>{
  let s=createGameState({landingSide:side});
  s={...s,phase:'running',mode:'flying',bird:{x:.63,y:.29,rotation:0},flowers:s.flowers.map(f=>({...f,height:0,displayHeight:0}))};
  const original={...s.bird};s=updateGame(s,{type:'TICK',seconds:1/hz}).state;
  assert.equal(s.phase,'landing');assert.equal(s.bird.y,original.y);
  assert.ok(s.bird.x>=original.x&&s.bird.x-original.x<.01,'clearing continues existing horizontal flight');
  let previous=s.bird,previousStage=s.landing.stage, samples=[],won=0;
  for(let i=0;i<20*hz&&s.phase!=='won';i++) {
    const r=updateGame(s,{type:'TICK',seconds:1/hz});s=r.state;won+=r.events.filter(e=>e.type==='won').length;
    if(previousStage===s.landing.stage)assert.ok(Math.hypot(s.bird.x-previous.x,s.bird.y-previous.y)<.03,'no visible discontinuity');
    else {assert.ok(previous.x>1.3);assert.ok(s.bird.x<-.25||s.bird.x>1.25,'turn stays off-screen');}
    if(s.landing.stage==='exit')assert.equal(s.bird.y,original.y,'no vertical fall while exiting');
    else samples.push({...s.bird});
    previous=s.bird;previousStage=s.landing.stage;
  }
  assert.equal(s.phase,'won');assert.equal(won,1);assert.equal(s.bird.y,s.config.groundY-.018);assert.equal(s.bird.x,.52);
  const visible=samples.filter(p=>p.x>0&&p.x<1);
  assert.ok(Math.abs(visible[0].x-visible.at(-1).x)>.4,'substantial horizontal approach');
  assert.equal(s.bird.direction,side==='left'?1:-1);
  assert.ok(Math.abs(samples.at(-1).y-samples.at(-hz/2).y)<.005,'levels out before touching grass');
});

test('landing pause preserves path state; resume completes without another activation',()=>{
  let s=createGameState();s={...s,phase:'running',flowers:s.flowers.map(f=>({...f,height:0}))};
  s=updateGame(s,{type:'TICK',seconds:.1}).state;
  s=updateGame(s,{type:'PAUSE'}).state;const held=updateGame(s,{type:'TICK',seconds:.2}).state;
  assert.deepEqual(held.bird,s.bird);assert.deepEqual(held.landing,s.landing);
  assert.equal(updateGame(held,{type:'RESUME'}).state.phase,'landing');
});
