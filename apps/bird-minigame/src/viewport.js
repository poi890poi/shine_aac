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
