import assert from "node:assert/strict";
import test from "node:test";
import { createGameState, updateGame } from "../src/game-core.js";

function advance(state, seconds, hz = 60) {
  const events = [];
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    const result = updateGame(state, { type: "TICK", seconds: 1 / hz });
    state = result.state; events.push(...result.events);
  }
  return { state, events };
}
const start = () => updateGame(createGameState(), { type: "START" }).state;

test("Super Blitz requirements: four fixed equally spaced flowers, automatic flight and descent", () => {
  const initial = start();
  const positions = initial.flowers.map(f => f.x);
  assert.equal(positions.length, 4);
  assert.ok(Math.abs(positions[1] - positions[0] - (positions[3] - positions[2])) < 1e-9);
  const first = advance(initial, 2).state;
  assert.ok(first.bird.x > initial.bird.x);
  assert.equal(first.bird.y, initial.bird.y);
  const later = advance(initial, 7).state;
  assert.equal(later.pass, 2);
  assert.ok(later.bird.y > initial.bird.y);
  assert.deepEqual(later.flowers.map(f => f.x), positions);
});

test("entry is consumed; activation drops once without controlling flight or queuing shots", () => {
  let state = updateGame(createGameState(), { type: "DROP" }).state;
  assert.equal(state.phase, "running");
  assert.equal(state.drop, null);
  state = advance(state, 2).state;
  const first = updateGame(state, { type: "DROP" });
  assert.deepEqual(first.state.bird, state.bird);
  assert.deepEqual(first.events, [{ type: "drop" }]);
  const second = updateGame(first.state, { type: "DROP" });
  assert.deepEqual(second.state.drop, first.state.drop);
  assert.deepEqual(second.events, []);
});

test("hit shortens only the targeted flower, reacts, and preserves its column", () => {
  let state = advance(start(), 2).state;
  state = { ...state, bird: { ...state.bird, x: state.flowers[0].x } };
  const before = state.flowers.map(f => ({ ...f }));
  state = updateGame(state, { type: "DROP" }).state;
  const result = advance(state, 0.6);
  assert.ok(result.events.some(e => e.type === "hit" && e.flowerId === 0));
  assert.equal(result.state.flowers[0].height, 0.1);
  assert.ok(result.state.flowers[0].reaction > 0);
  assert.ok(result.state.flowers[0].displayHeight < before[0].height);
  assert.deepEqual(result.state.flowers.slice(1).map(f => f.height), before.slice(1).map(f => f.height));
  assert.deepEqual(result.state.flowers.map(f => f.x), before.map(f => f.x));
});

test("a miss does not erase progress or cost a life", () => {
  let state = advance(start(), 1).state;
  state = { ...state, bird: { ...state.bird, x: 0.02 } };
  const before = state.flowers.map(f => f.height);
  const result = advance(updateGame(state, { type: "DROP" }).state, 0.85);
  assert.ok(result.events.some(e => e.type === "miss"));
  assert.deepEqual(result.state.flowers.map(f => f.height), before);
  assert.equal(result.state.phase, "running");
  assert.equal(result.state.drop, null);
});

test("body collision bumps upward in place and preserves all flower progress", () => {
  let state = start();
  state = { ...state, mode: "flying", bird: { x: state.flowers[3].x, y: 0.5, rotation: 0 },
    flowers: state.flowers.map((f,i) => i === 0 ? { ...f, height: 0.1, hits: 1 } : f) };
  const result = advance(state, 0.02);
  assert.equal(result.state.mode, "rescue");
  assert.ok(result.events.some(e => e.type === "collision"));
  assert.deepEqual(result.state.flowers.map(f => f.height), state.flowers.map(f => f.height));
  const retry = advance(result.state, 1.2).state;
  assert.equal(retry.phase, "running");
  assert.ok(retry.bird.y<state.bird.y);assert.ok(retry.bird.x>0.8,'no teleport back to entry');
  assert.equal(retry.flowers[0].hits, 1);
});

test("tail overlap does not collide; repeat collisions preserve the same pass and drop budget", () => {
  const base = start();
  const tailOnly = { ...base, mode: "flying", bird: { x: base.flowers[3].x + 0.09, y: 0.5, rotation: 0 } };
  assert.equal(advance(tailOnly, 0.02).events.some(e => e.type === "collision"), false);
  const repeated = { ...base, mode: "flying", dropUsed:true,bird: { x: base.flowers[3].x, y: 0.5, rotation: 0 },
    flowers: base.flowers.map((f,i) => i===3 ? { ...f, collisions: 2 } : f) };
  const rescued = advance(repeated, 0.02).state;
  const recovered = advance(rescued, 1.1).state;
  assert.equal(recovered.mode,'flying');assert.equal(recovered.pass,repeated.pass);
  assert.equal(recovered.dropUsed,true);assert.equal(updateGame(recovered,{type:'DROP'}).state.drop,null);
  assert.equal(recovered.guideId,null);
});

test("real drop path clears garden and lands automatically at 30, 60 and 120 Hz", () => {
  for (const hz of [30, 60, 120]) {
    let state = start();
    const originalPositions = state.flowers.map(f => f.x);
    const events=[];
    for(let i=0;i<hz*240 && state.phase!=="won";i++) {
      if (state.phase === "running" && !state.drop && state.flowers.some(f => f.height>0 && Math.abs(f.x-state.bird.x)<0.015)) {
        state=updateGame(state,{type:"DROP"}).state;
      }
      const result=updateGame(state,{type:"TICK",seconds:1/hz});state=result.state;events.push(...result.events);
    }
    assert.equal(state.phase,"won", "must land at " + hz + " Hz");
    assert.deepEqual(state.flowers.map(f=>f.height), [0,0,0,0]);
    assert.deepEqual(state.flowers.map(f=>f.x),originalPositions);
    assert.equal(events.filter(e=>e.type==='won').length,1);
    assert.equal(state.bird.y,state.config.groundY-0.018);
  }
});

test("pause freezes gameplay; inactive paused game exits; reset and helper exit work", () => {
  let state = advance(start(), 2).state;
  state = updateGame(state,{type:"DROP"}).state;
  const paused=updateGame(state,{type:"PAUSE"}).state;
  const held=advance(paused,2).state;
  assert.deepEqual(held.bird,paused.bird);assert.deepEqual(held.drop,paused.drop);
  assert.equal(held.time,paused.time);
  assert.equal(updateGame(held,{type:"RESUME"}).state.phase,"running");
  const timeout=updateGame(held,{type:"TICK",seconds:91});
  assert.equal(timeout.state.phase,"exited");assert.equal(timeout.events[0].reason,"inactive");
  assert.equal(updateGame(state,{type:"EXIT"}).state.drop,null);
  assert.deepEqual(updateGame(state,{type:"RESET"}).state,createGameState());
});
