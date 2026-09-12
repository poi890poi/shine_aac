import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,updateGame} from '../src/game-core.js';
const tick=(s,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)s=updateGame(s,{type:'TICK',seconds:1/120}).state;return s;};
const flying=()=>tick(updateGame(createGameState({dropMode:'flyby',speedLevel:2}),{type:'START'}).state,1.3);

test('a miss consumes this flyby; repeated taps never queue the next drop',()=>{
  let s=flying();s=updateGame(s,{type:'DROP'}).state;
  assert.equal(s.dropUsed,true);s=tick(s,1);assert.equal(s.drop,null);
  for(let i=0;i<10;i++){const r=updateGame(s,{type:'DROP'});assert.equal(r.state.drop,null);assert.deepEqual(r.events,[]);s=r.state;}
  const pass=s.pass;while(s.pass===pass)s=tick(s,.1);
  assert.equal(s.dropUsed,false);s=tick(s,1.3);assert.equal(s.drop,null,'no queued activation');
  assert.ok(updateGame(s,{type:'DROP'}).state.drop);
});
test('a hit also consumes the flyby, and pause/resume does not refill it',()=>{
  let s=flying();s={...s,bird:{...s.bird,x:s.flowers[0].x}};
  s=tick(updateGame(s,{type:'DROP'}).state,.7);assert.equal(s.score,1);assert.equal(s.drop,null);
  s=updateGame(s,{type:'PAUSE'}).state;s=tick(s,.3);s=updateGame(s,{type:'RESUME'}).state;
  assert.equal(s.dropUsed,true);assert.equal(updateGame(s,{type:'DROP'}).state.drop,null);
});
for(const hz of [30,60,120])test(`collision grants three clear subsequent flybys at ${hz} Hz`,()=>{
  let s=flying();s={...s,bird:{x:.875,y:.49,rotation:0},dropUsed:true};
  let r=updateGame(s,{type:'TICK',seconds:1/hz});s=r.state;
  assert.ok(r.events.some(e=>e.type==='collision'));assert.equal(s.mode,'rescue');
  const heights=s.flowers.map(f=>f.height),pass=s.pass;
  s=tick(s,1.2);assert.equal(s.mode,'flying');assert.equal(s.pass,pass);assert.equal(s.dropUsed,true);
  const top=s.config.groundY-Math.max(...heights);
  assert.ok(s.bird.y+3*s.config.descent+s.config.birdRadiusY<top);
  let collisions=0;
  for(let i=0;i<hz*26&&s.pass<=pass+3;i++){
    r=updateGame(s,{type:'TICK',seconds:1/hz});s=r.state;
    collisions+=r.events.filter(e=>e.type==='collision').length;
  }
  assert.equal(collisions,0);assert.ok(s.pass>=pass+3);
  assert.deepEqual(s.flowers.map(f=>f.height),heights);
});
