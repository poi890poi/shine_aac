// Approved portrait reference is 360×800 virtual pixels. Adapt the virtual
// extent for tablet aspect ratios; never change pixel aspect or upscale subjects.
export function fitGameViewport(width,height,dpr=1){
 if(![width,height,dpr].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Positive viewport dimensions required');
 const physicalWidth=Math.round(width*dpr),physicalHeight=Math.round(height*dpr);
 const scale=Math.max(1,Math.floor(Math.min(physicalWidth/360,physicalHeight/320)));
 return {width:Math.ceil(physicalWidth/scale),height:Math.ceil(physicalHeight/scale),scale,physicalWidth,physicalHeight};
}
// Landscape needs clear sky between enlarged wing tips and the fixed ammo row.
// Every gameplay object uses this same projection; collision/drop alignment stays intact.
export function gameplayBounds(width,height){const top=width>height?148:0;return {top,height:height-top};}

// Reclaim empty landscape sky without moving flowers, stems or the ground.
// Only the clear-sky part of the shared bird/drop/particle projection changes.
export function projectGameplayY(y,width,height,startY=.14){
 if(width<=height||y>=.46)return y;
 const bounds=gameplayBounds(width,height),lift=Math.max(0,bounds.top+startY*bounds.height-144);
 const t=Math.max(0,Math.min(1,(.46-y)/(.46-startY)));
 return y-lift/bounds.height*t*t*(3-2*t);
}
