// A self-contained review artifact: the same studio/renderer, embedded rules and
// CSS, and no runtime network or external images. Can be opened after download.
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {moduleRoot} from './rule-loader.mjs';
const names=['pixel-style','species-proportions','cartoon-style','feather-dynamics','flight-rigs'];
const entries=await Promise.all(names.map(async name=>[name+'.json',JSON.parse(await readFile(join(moduleRoot,'rules',name+'.json'),'utf8'))]));
const embedded=JSON.stringify(Object.fromEntries(entries));
const result=await build({entryPoints:[join(moduleRoot,'src','art-lab.js')],bundle:true,format:'esm',write:false,
  banner:{js:`const embeddedArtRules=${embedded};const fetch=async url=>{const name=new URL(url).pathname.split('/').pop();if(!embeddedArtRules[name])return {ok:false};return {ok:true,json:async()=>structuredClone(embeddedArtRules[name])};};`}});
const css=await readFile(join(moduleRoot,'src','styles.css'),'utf8');
let html=await readFile(join(moduleRoot,'art-lab.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="src/styles.css">',`<style>${css}</style>`)
  .replace('<a href="index.html">回到遊戲</a>','')
  .replace('<script type="module" src="src/art-lab.js"></script>',`<script type="module">${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
const out=join(moduleRoot,'tmp','phone-pixel-standard-20260905','share');await mkdir(out,{recursive:true});
await writeFile(join(out,'art-studio.html'),html);
console.log('Packaged self-contained art-studio.html');
