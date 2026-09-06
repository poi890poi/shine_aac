import {mountBirdGame} from './embed.js';
import {loadArtRules,validatePixelStyle} from './style-rules.js';
import {PixelSurface,drawCloud,drawGrass} from './pixel-art.js';
import {loadSprites,paintBird,paintFlower} from './sprite-assets.js';
const rules=await loadArtRules(),sprites=await loadSprites(),baseline=structuredClone(rules.style);
let style=structuredClone(baseline),columns=4,game;
const $=selector=>document.querySelector(selector);
const controls=[
  ['外框寬度','outline.width',1,2,1],['明暗層次','shading.bands',2,3,1],
  ['草地紋理密度','clusters.textureDensity',0,0.3,0.02],['動畫幀率','animation.framesPerSecond',4,12,1],
  ['雲移動速度','animation.cloudPixelsPerSecond',0,8,1],
  ['雲朵數量','cloud.count',1,10,1],['雲朵寬度','cloud.width',32,128,1],
  ['雲朵高度','cloud.height',14,64,1],['雲朵蓬鬆度','cloud.puffiness',0.8,2.2,0.1],
  ['雲底高度','cloud.baseHeight',0.65,1,0.05],['雲朵大小差異','cloud.sizeVariation',0,0.35,0.05],
  ['雲瓣融合','cloud.lobeBlend',0.05,0.3,0.01],['雲底圓潤度','cloud.bellyRoundness',0.15,0.35,0.01],['雲底陰影厚度','cloud.shadowDepth',0.08,0.25,0.01],
  ['草葉高度','grass.bladeHeight',2,6,1]
];
const get=path=>path.split('.').reduce((o,k)=>o[k],style);
function set(path,value){const parts=path.split('.');style[parts[0]][parts[1]]=value;}
const refs=[];
for(const [label,path,min,max,step] of controls) {
  const row=document.createElement('label');row.textContent=label;
  const input=document.createElement('input');input.type='range';Object.assign(input,{min,max,step,value:get(path)});
  const output=document.createElement('output');output.value=get(path);row.append(input,output);$('#controls').append(row);
  refs.push({path,input,output});input.addEventListener('input',()=>{set(path,Number(input.value));apply();});
}
const countLabel=document.createElement('label');countLabel.textContent='AAC 欄數預覽';
const count=document.createElement('select');for(let n=3;n<=8;n++)count.add(new Option(String(n),String(n)));count.value='4';countLabel.append(count);$('#controls').prepend(countLabel);
count.addEventListener('change',()=>{columns=Number(count.value);mount();});
const lightLabel=document.createElement('label');lightLabel.textContent='光線方向';const light=document.createElement('select');
for(const [name,value] of [['左上','-1,-1'],['右上','1,-1'],['左下','-1,1'],['右下','1,1']])light.add(new Option(name,value));
lightLabel.append(light);$('#controls').append(lightLabel);light.addEventListener('change',()=>{style.shading.lightDirection=light.value.split(',').map(Number);apply();});
function atlas() {
  const canvas=$('#atlas'),p=new PixelSurface(480,430,style);p.clear('sky');
  for(let i=0;i<4;i++)drawCloud(p,i*120,130,1,i);drawGrass(p,410);
  canvas.width=p.width;canvas.height=p.height;
  const context=canvas.getContext('2d'),pixels=context.createImageData(p.width,p.height);p.rgba(pixels.data);context.putImageData(pixels,0,0);context.imageSmoothingEnabled=false;
  for(let i=0;i<4;i++) {
    paintBird(context,sprites,{phase:'running',bird:{x:(95+i*120)/p.width,y:75/p.height}},p.width,p.height,i%3);
    paintFlower(context,sprites,{id:i,x:(60+i*120)/p.width,displayHeight:160/p.height,reaction:0,hits:0,blocked:0},p.width,p.height,410);
  }
  canvas.style.width=`${p.width*Number($('#zoom').value)}px`;canvas.style.height=`${p.height*Number($('#zoom').value)}px`;
}
function sync(){for(const r of refs){r.input.value=get(r.path);r.output.value=get(r.path);}light.value=style.shading.lightDirection.join(',');
  $('#json').value=JSON.stringify(style,null,2);$('#swatches').replaceChildren(...Object.entries(style.palette).map(([name,color])=>{const swatch=document.createElement('span');swatch.style.background=color;swatch.title=name+' '+color;return swatch;}));atlas();}
async function mount(){game?.destroy();game=mountBirdGame($('#game'),{aacConfig:{columns},pixelStyle:style,muted:true});await game.ready;}
function apply(){try{validatePixelStyle(style);game.setPixelStyle(structuredClone(style));sync();$('#notice').textContent='已套用到整個花園。';}catch(error){$('#notice').textContent=error.message;}}
$('#zoom').addEventListener('change',atlas);
$('#reset').addEventListener('click',()=>{style=structuredClone(baseline);apply();});
$('#apply').addEventListener('click',()=>{try{const parsed=JSON.parse($('#json').value);validatePixelStyle(parsed);style=parsed;apply();}catch(error){$('#notice').textContent=error.message;}});
$('#export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(style,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='pixel-style.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
await mount();sync();
