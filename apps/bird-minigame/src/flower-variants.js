export function validateFlowerVariants(layout) {
  if(layout.variants===undefined)return layout;
  if(!Array.isArray(layout.variants)||layout.variants.length<1||layout.variants.length>8)throw new RangeError('flower.variants requires 1–8 presets');
  for(const v of layout.variants) {
    if(!v||typeof v.name!=='string'||!v.name||!Number.isFinite(v.headScale)||v.headScale<.85||v.headScale>1.15)throw new RangeError('flower variant needs a name and headScale in .85..1.15');
    if(!Number.isFinite(v.curvePixels)||Math.abs(v.curvePixels)>6)throw new RangeError('flower curvePixels must be -6..6');
    if(v.stemHalfWidth!==undefined&&(!Number.isInteger(v.stemHalfWidth)||v.stemHalfWidth<2||v.stemHalfWidth>4))throw new RangeError('stemHalfWidth must be 2–4');
    if(v.leafSize!==undefined&&(!Number.isFinite(v.leafSize)||v.leafSize<.8||v.leafSize>1.2))throw new RangeError('leafSize must be .8..1.2');
    if(v.stemRamp!==undefined&&(!Array.isArray(v.stemRamp)||v.stemRamp.length!==2||!v.stemRamp.every(c=>/^#[0-9a-f]{6}$/i.test(c))))throw new RangeError('stemRamp requires two hex colors');
    if(!Array.isArray(v.leafLevels)||v.leafLevels.length<1||v.leafLevels.length>3||!v.leafLevels.every(n=>Number.isFinite(n)&&n>=.2&&n<=.8))throw new RangeError('flower leafLevels requires 1–3 levels in .2.. .8');
    if(v.petalRamp!==null&&(!Array.isArray(v.petalRamp)||v.petalRamp.length!==3||!v.petalRamp.every(c=>/^#[0-9a-f]{6}$/i.test(c))))throw new RangeError('flower petalRamp requires null or three hex colors');
  }
  return layout;
}

export function flowerVariant(layout,id) {
  const index=id%(layout.variants?.length??1);
  const v=layout.variants?.[index]??{name:'coral',headScale:1,curvePixels:layout.stem.curvePixels,leafLevels:[.48],petalRamp:null};
  return {...v,index,scale:layout.scale*v.headScale};
}

// Prepare only the approved source's red/pink petal material. This never changes
// alpha or touches dark contours, yellow faces, white splashes or green leaves.
export function recolorPetals(data,width,headHeight,ramp) {
  if(!ramp)return data;
  const colors=ramp.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
  for(let i=0;i<Math.min(data.length,width*headHeight*4);i+=4) {
    const [r,g,b,a]=data.subarray(i,i+4);
    if(!a||r<100||r<g*1.12||r<b*.95||b<g*.6)continue;
    const light=Math.max(0,Math.min(1,(.3*r+.59*g+.11*b-70)/175));
    const band=light<.5?0:1,t=light<.5?light*2:(light-.5)*2;
    for(let c=0;c<3;c++)data[i+c]=Math.round(colors[band][c]*(1-t)+colors[band+1][c]*t);
  }
  return data;
}

export function recolorLeaves(data,width,headHeight,ramp) {
  if(!ramp)return data;
  const colors=ramp.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
  for(let i=width*headHeight*4;i<data.length;i+=4) {
    const [r,g,b,a]=data.subarray(i,i+4);
    if(!a||g<60||g<r*1.1||g<b*1.15)continue;
    const t=Math.max(0,Math.min(1,(.3*r+.59*g+.11*b-80)/130));
    for(let c=0;c<3;c++)data[i+c]=Math.round(colors[0][c]*(1-t)+colors[1][c]*t);
  }
  return data;
}
