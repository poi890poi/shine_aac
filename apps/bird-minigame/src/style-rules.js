export function validatePixelStyle(style) {
  const errors=[];
  const range=(path,min,max,integer=false)=>{
    const value=path.split('.').reduce((o,k)=>o?.[k],style);
    if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))) errors.push(`${path} must be ${integer?'an integer ':''}in ${min}..${max}`);
  };
  range('grid.minimumWidth',160,480,true); range('grid.columnPitch',30,64,true);
  range('grid.minimumHeight',200,500,true); range('grid.maximumHeight',240,1200,true);
  if(style.grid?.minimumHeight>style.grid?.maximumHeight) errors.push('grid height bounds are reversed');
  range('outline.width',1,2,true); range('shading.bands',2,3,true);
  range('shading.highlightThreshold',-0.8,0); range('shading.shadowThreshold',0.1,0.8);
  range('clusters.minimumArea',2,6,true); range('clusters.textureDensity',0,0.3);
  range('animation.framesPerSecond',4,12,true); range('animation.cloudPixelsPerSecond',0,8);
  range('bird.torsoPixels',16,28,true); range('bird.tailFeathers',2,3,true); range('bird.eyePixels',1,2,true); range('bird.tailTipFraction',0.1,0.25);
  range('flower.headRadius',11,17,true); range('flower.faceRadius',5,8,true);
  range('flower.petalCount',6,10,true); range('flower.petalRadius',3,6,true); range('flower.petalRingRadius',7,11,true);
  range('flower.stemWidth',2,4,true); range('flower.leafLength',6,11,true); range('flower.leafWidth',3,6,true);
  range('cloud.width',32,128,true); range('cloud.height',14,64,true);
  for(const [key,min,max,integer] of [['count',1,10,true],['sizeVariation',0,0.35,false],['puffiness',0.8,2.2,false],['baseHeight',0.65,1,false],['lobeBlend',.05,.3,false],['bellyRoundness',.15,.35,false],['shadowDepth',.08,.25,false]]) {
    if(style.cloud?.[key]!==undefined)range(`cloud.${key}`,min,max,integer);
  }
  const altitude=style.cloud?.altitudeRange;
  if(altitude!==undefined&&(!Array.isArray(altitude)||altitude.length!==2||!altitude.every(v=>Number.isFinite(v)&&v>=0.04&&v<=0.7)||altitude[0]>=altitude[1]))errors.push('cloud.altitudeRange must be increasing fractions in 0.04..0.7');
  const validLobes=lobes=>Array.isArray(lobes)&&lobes.length>=3&&lobes.length<=8&&lobes.every(p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&v>0&&v<=1));
  const shapes=style.cloud?.shapes;
  if(shapes!==undefined&&(!Array.isArray(shapes)||shapes.length<1||shapes.length>8||shapes.some(s=>!s||typeof s.name!=='string'||!s.name||![s.widthScale,s.heightScale].every(v=>Number.isFinite(v)&&v>=0.5&&v<=1.6)||(s.lobeCenters!==undefined&&!validLobes(s.lobeCenters)))))errors.push('cloud.shapes requires 1–8 named shapes with 0.5..1.6 width/height scales and optional lobe triples');
  const layers=style.cloud?.layers;
  if(layers!==undefined) {
    if(!Array.isArray(layers)||layers.length!==2||layers.some((l,i)=>!l||l.name!==['far','near'][i]||!Number.isFinite(l.scale)||l.scale<.4||l.scale>1.5||!Number.isFinite(l.speedMultiplier)||l.speedMultiplier<.1||l.speedMultiplier>2.5||!Array.isArray(l.altitudeRange)||l.altitudeRange.length!==2||!l.altitudeRange.every(v=>Number.isFinite(v)&&v>=.04&&v<=.7)||l.altitudeRange[0]>=l.altitudeRange[1]))errors.push('cloud.layers requires far/near layers with bounded scale, speedMultiplier and altitudeRange');
    else if(layers[0].speedMultiplier>=layers[1].speedMultiplier||layers[0].scale>=layers[1].scale)errors.push('far clouds must be smaller and slower than near clouds');
  }
  range('grass.tileSize',12,24,true); range('grass.bladeHeight',2,6,true); range('grass.tuftWidth',3,7,true);
  if(!Array.isArray(style.shading?.lightDirection)||style.shading.lightDirection.length!==2||
    !style.shading.lightDirection.every(Number.isFinite)||Math.hypot(...style.shading.lightDirection)<0.1) errors.push('lightDirection must be a nonzero 2D vector');
  if(!Array.isArray(style.flower?.leafLevels)||style.flower.leafLevels.length!==2||!style.flower.leafLevels.every(v=>Number.isFinite(v)&&v>0.1&&v<0.9)) errors.push('two leafLevels in 0.1..0.9 are required');
  if(!Array.isArray(style.cloud?.lobeCenters)||style.cloud.lobeCenters.length<3||style.cloud.lobeCenters.length>8||style.cloud.lobeCenters.some(p=>!Array.isArray(p)||p.length!==3||!p.every(v=>Number.isFinite(v)&&v>0&&v<=1))) errors.push('cloud lobeCenters must contain 3–8 normalized x, y, radius triples');
  const palette=style.palette??{};
  if(palette.white?.toLowerCase()!=='#ffffff')errors.push('white liquid droppings require palette.white #ffffff');
  for(const key of ['ink','white','sky','cloudShadow','blueShadow','blue','blueLight','greenShadow','green','greenLight','petalShadow','petal','petalLight','goldShadow','gold','cloudLight'])if(!palette[key])errors.push(`palette.${key} is required`);
  if(Object.keys(palette).length!==16||Object.values(palette).some(v=>!/^#[0-9a-f]{6}$/i.test(v))) errors.push('palette needs 16 valid hex color roles');
  for(const material of ['bird','plant','petal','face','cloud']) {
    const ramp=style.ramps?.[material];
    if(!Array.isArray(ramp)||ramp.length!==3||ramp.some(key=>!palette[key])) errors.push(`${material} needs shadow/base/light palette roles`);
  }
  for(const key of ['foreground','background']) if(!palette[style.outline?.[key]]) errors.push(`outline.${key} must name a palette role`);
  if(style.bird?.speciesId!=='taiwan_blue_magpie') errors.push('this MVP supports the Taiwan Blue Magpie only');
  if(style.flower?.petalRingRadius+style.flower?.petalRadius>style.flower?.headRadius+1) errors.push('petals must fit the head radius');
  if(errors.length) throw new RangeError(errors.join('; '));
  return style;
}

export function sceneSize(style, columns, aspect=240/340) {
  const width=Math.max(style.grid.minimumWidth,columns*style.grid.columnPitch);
  return {width,height:Math.max(style.grid.minimumHeight,Math.min(style.grid.maximumHeight,Math.round(width/aspect)))};
}

export async function loadArtRules(styleOverride) {
  const names=['pixel-style','species-proportions','cartoon-style','feather-dynamics','flight-rigs'];
  const [style,species,cartoon,feathers,rigs]=await Promise.all(names.map(async name=>{
    const response=await fetch(new URL(`../rules/${name}.json`,import.meta.url));
    if(!response.ok)throw new Error(`Cannot load ${name}`);
    return response.json();
  }));
  return {style:validatePixelStyle(styleOverride??style),species:species.species.find(b=>b.id===style.bird.speciesId),cartoon,
    feathers:feathers.species[style.bird.speciesId],rig:rigs.rigs.corvid_transit,poseInvariants:rigs.globalPoseInvariants};
}
