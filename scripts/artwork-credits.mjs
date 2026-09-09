import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=process.argv[2]||'.tmp/artwork-credits';mkdirSync(out,{recursive:true});
const sources=JSON.parse(readFileSync(new URL('../apps/bird-minigame/assets/scenery/mountain-variants-attribution.json',import.meta.url),'utf8'));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intro='山景圖片來源 / Mountain artwork credits';
const note='Adapted mountain images retain their source licenses. Adaptations include cropping, sky removal, pixel sampling, indexed blue-green colors, and native-grid edge preparation.';
const text=[intro,note,...sources.map(s=>[s.title||s.label,s.author,s.sourcePage,s.license,s.licenseUrl,s.adaptation].filter(Boolean).join('\n'))].join('\n\n')+'\n';
const html=`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(intro)}</title><style>body{font:18px/1.6 system-ui,sans-serif;max-width:850px;margin:32px auto;padding:0 20px;color:#172331;background:#fff}h1{font-size:26px}h2{font-size:21px}article{padding:16px 0;border-bottom:1px solid #ccd4dc}a{color:#125996;overflow-wrap:anywhere}</style><h1>${escape(intro)}</h1><p>${escape(note)}</p>${sources.map(s=>`<article><h2>${escape(s.title||s.label)}</h2><p>${escape(s.author)}</p><p><a href="${escape(encodeURI(s.sourcePage))}">來源 / Source photograph</a> · <a href="${escape(s.licenseUrl)}">${escape(s.license)}</a></p><p>${escape(s.adaptation)}</p></article>`).join('')}</html>`;
// BOM makes the downloaded text self-identifying in older Windows viewers too.
writeFileSync(`${out}/artwork-credits.txt`,'\ufeff'+text,'utf8');writeFileSync(`${out}/artwork-credits.html`,html,'utf8');
const bytes=readFileSync(`${out}/artwork-credits.txt`);
assert.deepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf]);
const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
assert.ok(decoded.includes('日出前的北大武山')&&decoded.includes('花蓮車站遠眺'));
assert.ok(html.includes('<meta charset="utf-8">')&&!html.includes('\ufffd'));
console.log(`UTF-8 credits generated and checked (${sources.length} sources).`);
