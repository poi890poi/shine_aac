import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PixelSurface,drawCloudField,drawGrass} from '../src/pixel-art.js';
const style=JSON.parse(await readFile(new URL('../rules/pixel-style.json',import.meta.url)));
const p=new PixelSurface(320,640,style);p.clear('sky');drawCloudField(p);drawGrass(p,576);
const rgba=p.rgba(),rgb=Buffer.alloc(p.width*p.height*3);
for(let i=0;i<p.width*p.height;i++)for(let c=0;c<3;c++)rgb[i*3+c]=rgba[i*4+c];
const dir=new URL('../tmp/clouds-20260906/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('field.ppm',dir),Buffer.concat([Buffer.from(`P6\n${p.width} ${p.height}\n255\n`),rgb]));
