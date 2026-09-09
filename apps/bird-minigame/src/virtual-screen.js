import {fitGameViewport} from './viewport.js';

// This is the only game-art path to the physical display. Subjects/effects draw
// into frame at integer virtual coordinates; present copies the completed frame.
export function createVirtualScreen(canvas){
  const frame=document.createElement('canvas');
  const context=frame.getContext('2d',{alpha:false});
  const display=canvas.getContext('2d',{alpha:false});
  let viewport;
  return {frame,context,
    resize(width,height,dpr=1){
      viewport=fitGameViewport(width,height,dpr);
      frame.width=viewport.width;frame.height=viewport.height;
      canvas.width=viewport.physicalWidth;canvas.height=viewport.physicalHeight;
      canvas.style.width=`${viewport.physicalWidth/dpr}px`;
      canvas.style.height=`${viewport.physicalHeight/dpr}px`;
      canvas.dataset.virtualWidth=String(frame.width);canvas.dataset.virtualHeight=String(frame.height);
      canvas.dataset.pixelScale=String(viewport.scale);
      context.imageSmoothingEnabled=false;display.imageSmoothingEnabled=false;
      return viewport;
    },
    present(){
      if(!viewport)return;
      // Right/bottom may clip a partial edge pixel to fill an odd-size display.
      // Origin stays (0,0); no fractional centering, stretching or sprite overlays.
      display.drawImage(frame,0,0,frame.width*viewport.scale,frame.height*viewport.scale);
    },
    get viewport(){return viewport;}
  };
}
