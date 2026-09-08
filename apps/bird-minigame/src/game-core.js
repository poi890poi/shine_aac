import {beginLanding,advanceLanding} from './landing.js';
export const COLLISION_FEATHER_SECONDS=2.4;

export const DEFAULT_GAME_CONFIG = Object.freeze({
  columns: 4,
  passSeconds: 6, entrySeconds: 0.7, descent: 0.075, startY: 0.14, groundY: 0.9,
  flowerHeights: Object.freeze([0.22, 0.36, 0.27, 0.42]),
  flowerLeft: 0.17, flowerRight: 0.83, hitWidth: 0.068, hitReduction: 0.12,
  dropSpeed: 1.05, birdRadiusX: 0.026, birdRadiusY: 0.018,
  dropMode: 'recharge', ammoCapacity: 3, refillSeconds: 6, ammoSide: 'left',
  rescueSeconds: 1, recoveryPasses: 3, inactivitySeconds: 90, landingSeconds: 4.5, landingSide: 'auto'
});

export function createGameState(overrides = {}) {
  const config = { ...DEFAULT_GAME_CONFIG, ...overrides };
  config.columns=overrides.columns??overrides.flowerHeights?.length??DEFAULT_GAME_CONFIG.columns;
  if(!Number.isInteger(config.columns)||config.columns<3||config.columns>8)throw new RangeError('AAC columns must be an integer from 3 to 8.');
  if(overrides.flowerHeights&&overrides.flowerHeights.length!==config.columns)throw new RangeError('flowerHeights must match AAC columns.');
  config.flowerHeights=overrides.flowerHeights??Array.from({length:config.columns},(_,i)=>DEFAULT_GAME_CONFIG.flowerHeights[i%4]);
  // One fixed center per AAC column. Hit zones remain separate at dense settings.
  config.flowerLeft=0.5/config.columns;config.flowerRight=1-config.flowerLeft;
  config.hitWidth=Math.min(config.hitWidth,0.4/config.columns);
  if (!Array.isArray(config.flowerHeights) || config.flowerHeights.length < 2 ||
      config.flowerHeights.some(h => !(h > 0 && h < config.groundY - config.startY - 0.08))) {
    throw new RangeError("flowerHeights must contain at least two safe positive heights.");
  }
  if(!['auto','left','right'].includes(config.landingSide))throw new RangeError('landingSide must be auto, left or right');
  if(!['flyby','recharge'].includes(config.dropMode))throw new RangeError('dropMode must be flyby or recharge');
  if(!['left','right'].includes(config.ammoSide))throw new RangeError('ammoSide must be left or right');
  if(!Number.isInteger(config.ammoCapacity)||config.ammoCapacity<1||config.ammoCapacity>5)throw new RangeError('ammoCapacity must be 1 to 5');
  if(!Number.isInteger(config.recoveryPasses)||config.recoveryPasses<2||config.recoveryPasses>3)throw new RangeError('recoveryPasses must be 2 or 3');
  for (const key of ["passSeconds", "entrySeconds", "descent", "dropSpeed", "hitReduction", "rescueSeconds", "inactivitySeconds", "landingSeconds", "refillSeconds"]) {
    if (!(Number.isFinite(config[key]) && config[key] > 0)) throw new RangeError(`${key} must be positive.`);
  }
  config.flowerHeights = Object.freeze([...config.flowerHeights]);
  Object.freeze(config);
  return {
    config, phase: "ready", mode: "entry", time: 0, idleSeconds: 0,
    pass: 1, waitSeconds: config.entrySeconds, score: 0,
    bird: { x: -0.1, y: config.startY, rotation: 0 },
    safeY: config.startY, drop: null, dropUsed: false, passHadHit: false, guideId: null, speedScale: 1,
    ammo: config.ammoCapacity, refillElapsed: 0, featherBurst: null,
    flowers: config.flowerHeights.map((height, id, list) => ({
      id, x: config.flowerLeft + (config.flowerRight - config.flowerLeft) * id / (list.length - 1),
      height, displayHeight: height, hits: 0, reaction: 0, collisions: 0, blocked: 0
    }))
  };
}

function step(state, dt) {
  const c = state.config;
  let s = { ...state, time: state.time + dt,
    bird: { ...state.bird }, drop: state.drop ? { ...state.drop } : null,
    flowers: state.flowers.map(f => ({ ...f,
      reaction: Math.max(0, f.reaction - dt), blocked: Math.max(0, f.blocked - dt),
      displayHeight: Math.max(f.height, f.displayHeight - dt * 0.48)
    }))
  };
  const events = [];
  if(s.featherBurst) {
    const age=s.featherBurst.age+dt;
    s.featherBurst=age>=COLLISION_FEATHER_SECONDS?null:{...s.featherBurst,age};
  }
  if (s.phase === "landing") {
    const result=advanceLanding(s,dt);s.bird=result.bird;s.landing=result.landing;
    if (result.done) {
      s.phase = "won";
      events.push({ type: "won", score: s.score });
    }
    return { state: s, events };
  }
  if(c.dropMode==='recharge'&&s.ammo<c.ammoCapacity) {
    s.refillElapsed+=dt;
    while(s.refillElapsed+1e-9>=c.refillSeconds&&s.ammo<c.ammoCapacity) {
      s.ammo++;s.refillElapsed=Math.max(0,s.refillElapsed-c.refillSeconds);
    }
    if(s.ammo===c.ammoCapacity)s.refillElapsed=0;
  }
  if (s.drop) {
    const oldY = s.drop.y;
    s.drop.y += c.dropSpeed * dt;
    const flower = s.flowers.find(f => f.height > 0 && Math.abs(f.x - s.drop.x) <= c.hitWidth &&
      oldY <= c.groundY - f.height + 0.018 && s.drop.y >= c.groundY - f.height - 0.018);
    if (flower) {
      flower.height = Math.max(0, Number((flower.height - c.hitReduction).toFixed(6)));
      flower.hits++;
      flower.reaction = 0.8;
      s.drop = null;
      s.score++;
      s.passHadHit=true;
      events.push({ type: "hit", flowerId: flower.id, height: flower.height, score: s.score });
      if (!flower.height) events.push({ type: "cleared", flowerId: flower.id });
      if (s.guideId === flower.id) s.guideId = null;
    } else if (s.drop.y >= c.groundY) {
      s.drop = null;
      events.push({ type: "miss" });
    }
  }
  if (s.flowers.every(f => f.height === 0)) {
    s.phase = "landing"; s.drop = null; s.bird.rotation = 0;
    s.landing=beginLanding(s);
    events.push({ type: "landing", side:s.landing.side });
    return { state: s, events };
  }
  if(s.mode==='rescue') {
    const r={...s.recovery,elapsed:Math.min(c.rescueSeconds,s.recovery.elapsed+dt)};
    const p=r.elapsed/c.rescueSeconds,t=Math.max(0,(p-.18)/.82),ease=t*t*(3-2*t);
    s.bird.x=r.x-.045*Math.sin(Math.PI*p);s.bird.y=r.y+(r.targetY-r.y)*ease;
    s.recovery=r;
    if(p>=1){s.mode='flying';s.bird.x=r.x;s.bird.y=r.targetY;s.safeY=r.targetY;s.recovery=null;}
    return {state:s,events};
  }
  if (s.mode === "entry") {
    s.waitSeconds -= dt;
    if (s.waitSeconds <= 0) {
      s.mode = "flying";
    }
    return { state: s, events };
  }
  if (s.mode === "waiting") {
    if (!s.drop) {
      s.safeY = s.bird.y;
      s.bird = { x: -0.1, y: Math.min(c.groundY - 0.05, s.bird.y + c.descent), rotation: 0 };
      s.mode = "entry"; s.waitSeconds = c.entrySeconds; s.pass++;
      s.dropUsed=false;s.passHadHit=false;
      events.push({ type: "pass", pass: s.pass });
    }
    return { state: s, events };
  }
  // Repeated collisions provide a stationary opportunity at a safe altitude.
  const guide = s.flowers.find(f => f.id === s.guideId && f.height > 0);
  if (guide && !s.dropUsed && s.bird.x >= guide.x - c.hitWidth * 0.55 && s.bird.x <= guide.x) {
    s.bird.x = guide.x - c.hitWidth * 0.55;
    s.mode = "guided";
    return { state: s, events };
  }
  s.mode = "flying";
  s.bird.x += (1.22 / c.passSeconds) * s.speedScale * dt;
  const blocker = s.flowers.find(f => f.height > 0 &&
    Math.abs(s.bird.x - f.x) < c.birdRadiusX + 0.018 &&
    s.bird.y + c.birdRadiusY >= c.groundY - f.height);
  if (blocker) {
    blocker.collisions++; blocker.blocked = c.rescueSeconds;
    s.mode = "rescue"; s.bird.rotation = 0;
    s.featherBurst={x:s.bird.x,y:s.bird.y,age:0};
    const tallest=Math.max(...s.flowers.map(f=>f.height));
    s.recovery={x:s.bird.x,y:s.bird.y,elapsed:0,
      targetY:Math.max(c.startY,Math.min(s.bird.y-c.descent*c.recoveryPasses,
        c.groundY-tallest-c.birdRadiusY-c.descent*c.recoveryPasses-.025))};
    s.guideId=null;
    events.push({ type: "collision", flowerId: blocker.id });
  } else if (s.bird.x > 1.12) s.mode = "waiting";
  return { state: s, events };
}

export function updateGame(state, action) {
  if (action.type === "RESET") return { state: createGameState(state.config), events: [{ type: "reset" }] };
  if (action.type === "EXIT") return { state: { ...state, phase: "exited", drop: null }, events: [{ type: "exit", reason: action.reason ?? "helper" }] };
  if ((action.type === "START" || action.type === "DROP") && state.phase === "ready") {
    return { state: { ...state, phase: "running", idleSeconds: 0 }, events: [{ type: "start" }] };
  }
  if (action.type === "DROP") {
    const s = { ...state, idleSeconds: 0 };
    if (s.phase !== "running" || !["flying", "guided"].includes(s.mode) || !dropBudget(s).available || s.drop || s.bird.x < 0 || s.bird.x > 1) return { state: s, events: [] };
    return { state: { ...s, dropUsed:true, ammo:s.config.dropMode==='recharge'?s.ammo-1:s.ammo, mode:'flying', drop: { x: s.bird.x - 0.006, y: s.bird.y + 0.015 } }, events: [{ type: "drop" }] };
  }
  if (action.type === "PAUSE" && ["running", "landing"].includes(state.phase)) {
    return { state: { ...state, resumePhase: state.phase, phase: "paused", idleSeconds: 0 }, events: [{ type: "pause" }] };
  }
  if (action.type === "RESUME" && state.phase === "paused") {
    return { state: { ...state, phase: state.resumePhase ?? "running", idleSeconds: 0 }, events: [{ type: "resume" }] };
  }
  if (action.type !== "TICK" || ["ready", "exited"].includes(state.phase)) return { state, events: [] };
  const elapsed = Math.max(0, Number.isFinite(action.seconds) ? action.seconds : 0);
  const idleSeconds = state.idleSeconds + elapsed;
  if (idleSeconds >= state.config.inactivitySeconds) return updateGame(state, { type: "EXIT", reason: "inactive" });
  let s = { ...state, idleSeconds };
  if (["paused", "won"].includes(s.phase)) return { state: s, events: [] };
  const events = [];
  let remaining = Math.min(elapsed, 0.25);
  while (remaining > 1e-8 && ["running", "landing"].includes(s.phase)) {
    const dt = Math.min(remaining, 1 / 120);
    const result = step(s, dt); s = result.state; events.push(...result.events); remaining -= dt;
  }
  return { state: s, events };
}

export function dropBudget(state) {
  return state.config.dropMode==='recharge'
    ? {capacity:state.config.ammoCapacity,available:state.ammo,progress:state.refillElapsed/state.config.refillSeconds}
    : {capacity:1,available:state.dropUsed?0:1,progress:0};
}
