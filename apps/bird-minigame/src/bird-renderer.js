import { loadArtRules, validatePixelStyle } from './style-rules.js';
import {loadSprites,paintBird,paintFlower} from './sprite-assets.js';
import {birdPose} from './bird-animation.js';
import {paintAmmo,paintFeathers} from './game-feedback.js';
import {loadReviewedScenery,paintReviewedScenery,prepareReviewedFlowers,paintReviewedFlower} from './reviewed-scenery.js';
import {birdSpecies} from './bird-species.js';
import {createClearing} from './clearing-scenery.js';
import {gameplayBounds,projectGameplayY} from './viewport.js';
import {createVirtualScreen} from './virtual-screen.js';
import {createCloudPlacements} from './cloud-layout.js';

export function createBirdRenderer(canvas,{pixelStyle,reducedMotion=false,columns=4,featherDynamics,species='taiwan_blue_magpie'}={}) {
  const screen=createVirtualScreen(canvas),ctx=screen.context;
  let selectedSpecies=birdSpecies(species);
  let clearing=createClearing(0);
  let clouds=createCloudPlacements(29);
  let rules=null,sprites=null,scenery=null,surface=null,currentColumns=columns,lastState=null;
  function resize() {
    if(!rules)return;
    const box=canvas.parentElement.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    screen.resize(box.width,box.height,dpr);
    surface=true;
    if(lastState)render(lastState);
  }
  const ready=Promise.all([loadArtRules(pixelStyle),loadSprites(),loadReviewedScenery()]).then(([loaded,assets,background])=>{
    rules=loaded;sprites=prepareReviewedFlowers(assets);scenery=background;if(featherDynamics)rules.feathers={...rules.feathers,...featherDynamics};resize();
  });
  function render(state) {
    lastState=state;if(!surface)return;
    if(currentColumns!==state.flowers.length){currentColumns=state.flowers.length;resize();return;}
    const w=screen.frame.width,bounds=gameplayBounds(w,screen.frame.height),h=bounds.height,ground=Math.round(state.config.groundY*h);
    const project=y=>projectGameplayY(y,w,screen.frame.height,state.config.startY);
    const visibleState={...state,bird:{...state.bird,y:project(state.bird.y)}};
    const t=reducedMotion?0:state.time;
    paintReviewedScenery(ctx,scenery,w,screen.frame.height,ground+bounds.top,t,reducedMotion,clearing,clouds);
    ctx.save();ctx.translate(0,bounds.top);
    for(const flower of state.flowers)if(flower.displayHeight>.001)paintReviewedFlower(ctx,sprites,reducedMotion?{...flower,blocked:0}:flower,w,h,ground);
    if(state.drop){const x=Math.round(state.drop.x*w),y=Math.round(project(state.drop.y)*h);
      ctx.fillStyle='#20243a';ctx.fillRect(x-2,y-4,5,8);ctx.fillStyle='#ffffff';ctx.fillRect(x-1,y-3,3,6);}
    const selected=sprites.birds[selectedSpecies.id],birdSprites={...sprites,bird:selected.frames,layout:{...sprites.layout,bird:selected.layout}};
    const pose=birdPose(state,selected.layout,selectedSpecies.frameRate,reducedMotion);
    paintBird(ctx,birdSprites,visibleState,w,h,pose);
    if(!reducedMotion)paintFeathers(ctx,state.featherBurst?{...state.featherBurst,y:project(state.featherBurst.y)}:null,w,h,selectedSpecies.featherColors);
    if(state.mode==='rescue'&&!reducedMotion) {
      const x=Math.round(state.bird.x*w)+18,y=Math.round(project(state.bird.y)*h)-20;
      for(let i=0;i<3;i++){const a=t*7+i*Math.PI*2/3,px=Math.round(x+Math.cos(a)*13),py=Math.round(y+Math.sin(a)*6);
        ctx.fillStyle='#20243a';ctx.fillRect(px-2,py-1,5,3);ctx.fillRect(px-1,py-2,3,5);
        ctx.fillStyle='#f5df72';ctx.fillRect(px-1,py,3,1);ctx.fillRect(px,py-1,1,3);}
    }
    ctx.restore();paintAmmo(ctx,state,w);screen.present();
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(canvas.parentElement);
  return {ready,render,resize,
    setScenerySeed(seed){clearing=createClearing(seed);clouds=createCloudPlacements((seed+20)>>>0);if(lastState)render(lastState);},
    getScenery:()=>clearing,
    setSpecies(id){selectedSpecies=birdSpecies(id);if(lastState)render(lastState);},
    paintChoice(target,id){
      const selected=sprites.birds[birdSpecies(id).id],sprite=selected.frames[selected.layout.settledPose];
      target.width=96;target.height=48;const cx=target.getContext('2d');cx.imageSmoothingEnabled=false;
      const mask=document.createElement('canvas');mask.width=sprite.image.width;mask.height=sprite.image.height;
      const mx=mask.getContext('2d');mx.drawImage(sprite.image,0,0);
      const data=mx.getImageData(0,0,mask.width,mask.height).data;
      let left=sprite.image.width,top=sprite.image.height,right=0,bottom=0;
      for(let y=0;y<sprite.image.height;y++)for(let x=0;x<sprite.image.width;x++)if(data[(y*sprite.image.width+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      const sw=right-left+1,sh=bottom-top+1,scale=Math.min(88/sw,40/sh);
      cx.clearRect(0,0,96,48);
      cx.drawImage(sprite.image,left,top,sw,sh,Math.round((96-sw*scale)/2),Math.round((48-sh*scale)/2),Math.round(sw*scale),Math.round(sh*scale));
    },
    setStyle(style){if(!rules)throw new Error('Await renderer.ready before setting style');rules={...rules,style:validatePixelStyle(style)};resize();},
    getRules:()=>rules,destroy(){observer?.disconnect();lastState=null;}
  };
}
