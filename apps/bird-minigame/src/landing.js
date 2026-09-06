// Clear the screen in the current flight direction, then glide in from a side.
// The off-screen turn keeps the visible path continuous without pivoting in place.
export function beginLanding(state) {
  const direction=state.bird.direction??1;
  return { stage:'exit', side:state.config.landingSide==='auto'
    ? (state.bird.x<0.52?'left':'right') : state.config.landingSide,
    direction, elapsed:0, entryY:Math.max(state.config.startY,Math.min(0.64,state.bird.y)),
    exitX:direction>0?1.45:-0.45 };
}

export function approachPoint(landing, config, elapsed) {
  const direction=landing.side==='left'?1:-1;
  const t=Math.min(1,Math.max(0,elapsed/config.landingSeconds));
  const u=1-(1-t)**2, v=1-u;
  const startX=direction>0?-0.35:1.35, endX=0.52, endY=config.groundY-0.018;
  const p1x=startX+direction*0.32,p2x=endX-direction*0.24;
  return {x:v**3*startX+3*v*v*u*p1x+3*v*u*u*p2x+u**3*endX,
    y:v**3*landing.entryY+3*v*v*u*(landing.entryY+0.045)+3*v*u*u*endY+u**3*endY,
    rotation:0,direction};
}

export function advanceLanding(state,dt) {
  const landing={...state.landing};
  let bird={...state.bird};
  if(landing.stage==='exit') {
    bird.x+=landing.direction*(1.22/state.config.passSeconds)*state.speedScale*dt;
    if(landing.direction*(bird.x-landing.exitX)>=0) {
      landing.stage='approach';landing.elapsed=0;
      bird=approachPoint(landing,state.config,0);
    }
  } else {
    landing.elapsed=Math.min(state.config.landingSeconds,landing.elapsed+dt);
    bird=approachPoint(landing,state.config,landing.elapsed);
  }
  return {landing,bird,done:landing.stage==='approach'&&landing.elapsed>=state.config.landingSeconds};
}
