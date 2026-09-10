export const CLOUD_TUNING=Object.freeze({farCount:6,nearCount:5,farScale:.30,nearScale:.56,scaleVariation:.18,xJitter:65,yJitter:22});
// Front clouds may overlap the upper third of a mountain, never its lower slopes.
// Keep their seeded altitude stagger when tall clouds need lifting on short screens.
export const CLOUD_ALTITUDE=Object.freeze({mountainOverlap:.35,bottomStagger:32,nominalBandEnd:256});
export function nearCloudY(nominalY,screenHeight,cloudHeight,mountain){
  const desired=Math.round(nominalY*screenHeight/640);
  if(!mountain)return desired;
  const stagger=Math.round(Math.max(0,1-nominalY/CLOUD_ALTITUDE.nominalBandEnd)*CLOUD_ALTITUDE.bottomStagger);
  const bottom=Math.floor(mountain.top+mountain.height*CLOUD_ALTITUDE.mountainOverlap)-stagger;
  return Math.min(desired,bottom-cloudHeight);
}
export function createCloudPlacements(seed){
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const result=[];
  for(const layer of ['far','near']){
    const far=layer==='far',count=far?CLOUD_TUNING.farCount:CLOUD_TUNING.nearCount;
    for(let i=0;i<count;i++){
      const x=(i%2?270:0)+(random()-.5)*CLOUD_TUNING.xJitter;
      const y=(far?20:85)+i*(far?42:34)+(random()-.5)*CLOUD_TUNING.yJitter;
      const scale=(far?CLOUD_TUNING.farScale:CLOUD_TUNING.nearScale)*(1+(random()-.5)*2*CLOUD_TUNING.scaleVariation);
      result.push(Object.freeze([Math.floor(random()*6),Math.round(x),Math.round(y),Number(scale.toFixed(3)),layer]));
    }
  }
  return Object.freeze(result);
}
