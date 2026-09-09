import {fitGameViewport} from './viewport.js';
import {createGpuSurface} from './gpu-surface.js';

// This is the only game-art path to the physical display. Subjects/effects draw
// into frame at integer virtual coordinates; present copies the completed frame.
export function createVirtualScreen(canvas,{backend='canvas2d'}={}){
  const frame=document.createElement('canvas');
  const gpu=backend==='webgl'?createGpuSurface(canvas):null;
  const context=gpu?.context??frame.getContext('2d',{alpha:false});
  const display=gpu?null:canvas.getContext('2d',{alpha:false});
  canvas.dataset.renderer=gpu?'webgl':'canvas2d';
  canvas.readGamePixels=()=>gpu?gpu.readPixels():display.getImageData(0,0,canvas.width,canvas.height).data;
  canvas.gameRendererInfo=()=>gpu?.info()??{backend:'canvas2d'};
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
      context.imageSmoothingEnabled=false;if(display)display.imageSmoothingEnabled=false;
      gpu?.resize(viewport);
      return viewport;
    },
    present(){
      if(!viewport)return;
      // Right/bottom may clip a partial edge pixel to fill an odd-size display.
      // Origin stays (0,0); no fractional centering, stretching or sprite overlays.
      if(gpu)gpu.present();else display.drawImage(frame,0,0,frame.width*viewport.scale,frame.height*viewport.scale);
    },
    destroy(){gpu?.destroy();delete canvas.readGamePixels;delete canvas.gameRendererInfo;},
    get viewport(){return viewport;}
  };
}
