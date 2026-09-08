// Standing frames are reserved for touchdown. Approach remains active flight.
export function birdPose(state,layout,frameRate,reducedMotion=false){
  if(state.phase==='won')return layout.settledPose;
  if(['ready','paused'].includes(state.phase)||reducedMotion)return layout.previewPose??layout.cycle[0];
  if(state.mode==='rescue')return [0,1][Math.floor(state.time*16)%2];
  return layout.cycle[Math.floor(state.time*frameRate)%layout.cycle.length];
}
