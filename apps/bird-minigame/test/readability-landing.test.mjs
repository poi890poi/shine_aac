import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {birdPose} from '../src/bird-animation.js';
import {fitGameViewport} from '../src/viewport.js';
import {createGameState,updateGame,dropBudget} from '../src/game-core.js';
import {VISUAL_TUNING} from '../src/visual-tuning.js';
import {paintBird} from '../src/sprite-assets.js';
test('default starts with three replenishing charges; explicit flyby remains available',()=>{
  const state=createGameState();assert.equal(state.config.dropMode,'recharge');
  assert.equal(dropBudget(state).capacity,3);assert.equal(dropBudget(state).available,3);
  let s=updateGame(state,{type:'START'}).state;
  for(let i=0;i<120;i++)s=updateGame(s,{type:'TICK',seconds:1/60}).state;
  s=updateGame(s,{type:'DROP'}).state;assert.equal(dropBudget(s).available,2);
  for(let i=0;i<360;i++)s=updateGame(s,{type:'TICK',seconds:1/60}).state;
  assert.equal(dropBudget(s).available,3);
  assert.equal(createGameState({dropMode:'flyby'}).config.dropMode,'flyby');
});
test('whole-pixel canvas covers both tablet orientations without stretching',()=>{
  for(const [w,h,dpr] of [[600,960,2],[960,600,2],[390,844,3],[280,640,1],[640,360,1]]){
    const v=fitGameViewport(w,h,dpr);assert.equal(v.scale%1,0);
    for(const [native,screen] of [[v.width,w],[v.height,h]]){
      assert.ok(native*v.scale>=Math.round(screen*dpr));
      assert.ok(native*v.scale-Math.round(screen*dpr)<v.scale);
    }
  }
});
test('every species flaps throughout airborne approach and stands only after touchdown',async()=>{
  const read=async name=>JSON.parse(await readFile(new URL('../rules/'+name,import.meta.url)));
  const layouts=[(await read('sprite-layout.json')).bird,await read('yellow-tit-sprite.json'),...(await read('all-bird-sprites.json')).species];
  for(const layout of layouts){
    const poses=new Set();for(let i=0;i<120;i++)poses.add(birdPose({phase:'landing',mode:'flying',time:i/60,landing:{stage:'approach',elapsed:i/60}},layout,8));
    assert.ok(poses.size>=2,layout.speciesId);
    if(!layout.cycle.includes(layout.settledPose))assert.ok(!poses.has(layout.settledPose));
    assert.equal(birdPose({phase:'won'},layout,8),layout.settledPose);
  }
});
test('shared readability sizes retain a substantial enlargement',()=>{
  assert.ok(VISUAL_TUNING.ammoScale>=3);assert.ok(VISUAL_TUNING.birdScale>=1.3);assert.ok(VISUAL_TUNING.flowerHeadScale>=1.4);
});
test('landing body landmark does not jump vertically when the flap frame changes',()=>{
  const positions=[],ctx={save(){},restore(){},scale(){},drawImage(){},translate(x,y){positions.push([x,y]);}};
  const sprites={bird:[{image:{width:100,height:100},anchor:[30,60]},{image:{width:100,height:100},anchor:[30,20]},{image:{width:100,height:100},anchor:[30,40]}],layout:{bird:{scale:1,settledPose:2,groundContactY:70}}};
  const state={...createGameState(),phase:'landing',bird:{x:.5,y:.8,direction:1},landing:{stage:'approach',elapsed:4}};
  paintBird(ctx,sprites,state,600,960,0);paintBird(ctx,sprites,state,600,960,1);assert.deepEqual(positions[0],positions[1]);
});
