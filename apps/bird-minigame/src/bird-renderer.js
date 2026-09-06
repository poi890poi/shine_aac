import { PixelSurface, drawCloudField, drawGrass } from './pixel-art.js';
import { loadArtRules, sceneSize, validatePixelStyle } from './style-rules.js';
import {loadSprites,paintBird,paintFlower} from './sprite-assets.js';
import {paintAmmo,paintFeathers} from './game-feedback.js';
import {loadReviewedScenery,paintReviewedScenery,prepareReviewedFlowers,paintReviewedFlower} from './reviewed-scenery.js';

export function createBirdRenderer(canvas,{pixelStyle,reducedMotion=false,columns=4,featherDynamics}={}) {
  const ctx=canvas.getContext('2d',{alpha:false});
  let rules=null,sprites=null,scenery=null,surface=null,frame=null,currentColumns=columns,lastState=null;
  function resize() {
    if(!rules)return;
    const box=canvas.parentElement.getBoundingClientRect();
    const dimensions=sceneSize(rules.style,currentColumns,box.width/Math.max(1,box.height));
    const dpr=window.devicePixelRatio||1;
    const scale=Math.max(1,Math.floor(Math.min(box.width*dpr/dimensions.width,box.height*dpr/dimensions.height)));
    canvas.style.width=`${dimensions.width*scale/dpr}px`;canvas.style.height=`${dimensions.height*scale/dpr}px`;
    canvas.width=dimensions.width;canvas.height=dimensions.height;ctx.imageSmoothingEnabled=false;
    surface=new PixelSurface(canvas.width,canvas.height,rules.style);frame=ctx.createImageData(canvas.width,canvas.height);
    if(lastState)render(lastState);
  }
  const ready=Promise.all([loadArtRules(pixelStyle),loadSprites(),loadReviewedScenery()]).then(([loaded,assets,background])=>{
    rules=loaded;sprites=prepareReviewedFlowers(assets);scenery=background;if(featherDynamics)rules.feathers={...rules.feathers,...featherDynamics};resize();
  });
  function render(state) {
    lastState=state;if(!surface)return;
    if(currentColumns!==state.flowers.length){currentColumns=state.flowers.length;resize();return;}
    const w=canvas.width,h=canvas.height,ground=Math.round(state.config.groundY*h);
    const t=reducedMotion?0:state.time;
    paintReviewedScenery(ctx,scenery,w,h,ground,t,reducedMotion);
    for(const flower of state.flowers)if(flower.displayHeight>.001)paintReviewedFlower(ctx,sprites,reducedMotion?{...flower,blocked:0}:flower,w,h,ground);
    if(state.drop){const x=Math.round(state.drop.x*w),y=Math.round(state.drop.y*h);
      ctx.fillStyle='#20243a';ctx.fillRect(x-2,y-4,5,8);ctx.fillStyle='#ffffff';ctx.fillRect(x-1,y-3,3,6);}
    const pose=['ready','won','paused'].includes(state.phase)?sprites.layout.bird.settledPose:
      state.mode==='rescue'&&!reducedMotion?[0,1][Math.floor(t*16)%2]:sprites.layout.bird.cycle[Math.floor(t*8)%4];
    paintBird(ctx,sprites,state,w,h,pose);
    if(!reducedMotion)paintFeathers(ctx,state.featherBurst,w,h);
    if(state.mode==='rescue'&&!reducedMotion) {
      const x=Math.round(state.bird.x*w)+18,y=Math.round(state.bird.y*h)-20;
      for(let i=0;i<3;i++){const a=t*7+i*Math.PI*2/3,px=Math.round(x+Math.cos(a)*13),py=Math.round(y+Math.sin(a)*6);
        ctx.fillStyle='#20243a';ctx.fillRect(px-2,py-1,5,3);ctx.fillRect(px-1,py-2,3,5);
        ctx.fillStyle='#f5df72';ctx.fillRect(px-1,py,3,1);ctx.fillRect(px,py-1,1,3);}
    }
    paintAmmo(ctx,state,w);
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(canvas.parentElement);
  return {ready,render,resize,
    setStyle(style){if(!rules)throw new Error('Await renderer.ready before setting style');rules={...rules,style:validatePixelStyle(style)};resize();},
    getRules:()=>rules,destroy(){observer?.disconnect();lastState=null;}
  };
}
