import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameState,updateGame,TRAINING_SPEEDS,nextTrainingLevel} from '../src/game-core.js';
import {gameConfigFromAac} from '../src/aac-config.js';
import {cameraSignal} from '../src/camera-signal.js';
import {gameUiLayout,paintGameUi} from '../src/game-ui.js';

test('left-only approach inset preserves equal cell spacing and ordinary right half-cell margin',()=>{
  for(let columns=3;columns<=8;columns++) {
    const s=createGameState({columns}),xs=s.flowers.map(f=>f.x),pitch=xs[1]-xs[0];
    assert.ok(xs[0]>.5/columns);
    assert.ok(Math.abs(1-xs.at(-1)-pitch/2)<1e-12);
    for(let i=1;i<columns;i++)assert.ok(Math.abs(xs[i]-xs[i-1]-pitch)<1e-12);
    assert.ok(s.config.hitWidth*2<pitch);
  }
});

test('fastest flight respects scan interval and visible first-cell approach; slower levels give more time',()=>{
  for(const columns of [3,6,8])for(const interval of [500,1800,4000])for(const first of [interval,interval*2]) {
    const s=createGameState(gameConfigFromAac({columns,scanIntervalMs:interval,firstCellPauseMs:first}));
    const pitch=s.flowers[1].x-s.flowers[0].x;
    for(const scale of TRAINING_SPEEDS) {
      const velocity=1.22/s.config.passSeconds*scale;
      assert.ok(pitch/velocity>=interval/1000-1e-10);
      assert.ok(s.flowers[0].x/velocity>=first/1000-1e-10);
    }
  }
});

test('three levels start slow; passes and hits never speed up within a round',()=>{
  assert.equal(createGameState().speedLevel,0);
  assert.deepEqual([0,1,2].map(nextTrainingLevel),[1,2,2]);
  let s=updateGame(createGameState({speedLevel:1}),{type:'START'}).state;
  s={...s,mode:'waiting',passHadHit:true,bird:{...s.bird,x:1.13}};
  s=updateGame(s,{type:'TICK',seconds:1/60}).state;
  assert.equal(s.pass,2);assert.equal(s.speedLevel,1);
  assert.equal(s.speedScale,TRAINING_SPEEDS[1]);
});

test('collision slows one step, at most once per flyby, preserving progress; pause freezes recovery',()=>{
  let s=updateGame(createGameState({speedLevel:2}),{type:'START'}).state;
  const collide=state=>updateGame({...state,mode:'flying',bird:{x:state.flowers[3].x,y:.5,rotation:0}},{type:'TICK',seconds:1/120}).state;
  s=collide(s);assert.equal(s.mode,'rescue');assert.equal(s.speedLevel,1);
  const heights=s.flowers.map(f=>f.height);s=collide(s);assert.equal(s.speedLevel,1);
  assert.deepEqual(s.flowers.map(f=>f.height),heights);
  const paused=updateGame(s,{type:'PAUSE'}).state;
  const held=updateGame(paused,{type:'TICK',seconds:2}).state;
  assert.deepEqual(held.bird,paused.bird);assert.equal(held.speedLevel,1);
  s=collide({...s,pass:s.pass+1});assert.equal(s.speedLevel,0);
  s=collide({...s,pass:s.pass+1});assert.equal(s.speedLevel,0);
});

test('camera feedback distinguishes fresh detection, waiting, loss and hardware-only input',()=>{
  assert.equal(cameraSignal({enabled:false,state:'live'}).visible,false);
  assert.deepEqual(cameraSignal({enabled:true,state:'analysis',score:.25,threshold:.5}),{visible:true,state:'live',level:.5});
  assert.equal(cameraSignal({enabled:true,state:'starting'}).state,'waiting');
  assert.equal(cameraSignal({enabled:true,state:'active'}).state,'waiting','camera opened does not prove an analyzed frame');
  for(const state of ['detectorStale','cameraStale','permissionDenied','off','unknown']) {
    const result=cameraSignal({enabled:true,state,score:1,threshold:.5});
    assert.equal(result.state,'unavailable');assert.equal(result.level,0);
  }
  assert.equal(cameraSignal({enabled:true,state:'live',score:NaN,threshold:.5}).level,0);
  const rects=[],ctx={fillRect:(...r)=>rects.push(r)};
  const s=createGameState({speedLevel:2});s.phase='running';
  s.cameraSignal=cameraSignal({enabled:true,state:'live',score:.3,threshold:.5});
  paintGameUi(ctx,s,gameUiLayout(640,400,{cameraVisible:true}));
  assert.ok(rects.length>0);assert.ok(rects.flat().every(Number.isInteger),'native grid rectangles only');
});
