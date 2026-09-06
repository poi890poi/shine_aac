// Review-only: render the actual approved flower pipeline without mounting a game.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire('C:/Users/Lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const out=new URL('../assets/candidates/scenery-review-20260906/',import.meta.url);
const leafRevision=process.argv.includes('--leaf-revision');
const protectedOnly=process.argv.includes('--protected-only');
const taiwanScene=process.argv.includes('--taiwan-scene');
const sceneReview=process.argv.includes('--scene')||taiwanScene;
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,BIRD_GAME_PORT:'4198'},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`preview server exited ${code}`)));});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1040,height:850},deviceScaleFactor:1});
  await page.route('http://127.0.0.1:4198/review-only',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eff6ed;font:18px Arial,sans-serif;color:#284847;padding:32px}h1{font-size:30px;margin:0 0 8px}p{margin:0 0 20px}canvas{display:block;width:960px;height:440px;image-rendering:pixelated;background:#91d5db}.labels{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;gap:10px;margin:14px 0 24px}.labels b{display:block;margin-bottom:6px}.labels span{font-size:16px}small{font-size:15px}#native{width:480px;height:140px}</style><h1>Flower review · whole plants</h1><p>Existing approved head and leaf artwork · current stem variations · 2× view</p><canvas id="flowers" width="480" height="220"></canvas><div class="labels"><div><b>A · Coral</b><span>Gentle curve · one leaf level</span></div><div><b>B · Lavender</b><span>Thin curved stem · two levels</span></div><div><b>C · Buttercup</b><span>Opposite curve · broad leaf</span></div><div><b>D · Sky</b><span>Thin stem · two leaf levels</span></div></div><small>Native pixel view · same rendering, shorter stems</small><canvas id="native" width="480" height="140"></canvas>`}));
  await page.goto('http://127.0.0.1:4198/review-only');
  await page.evaluate(async({leafRevision,sceneReview,taiwanScene,protectedOnly})=>{
    const {loadSprites,paintFlower}=await import('/src/sprite-assets.js');
    const sprites=await loadSprites();
    if(sceneReview) {
      document.getElementById('flowers').height=640;
      document.getElementById('flowers').style.height='1280px';
      document.querySelector('h1').textContent='Garden layers · artwork review';
      document.querySelector('p').textContent=taiwanScene?'Field-level mountain view · old Taiwanese homes · shaded clouds · fuller plants':'Static mountain photograph · flat cottages · shaded clouds · fuller plants';
      document.querySelector('.labels').remove();document.querySelector('small').remove();document.getElementById('native').remove();
    }
    const loadImage=async name=>{const im=new Image();im.src='/assets/candidates/scenery-review-20260906/'+name;await im.decode();return im;};
    // Review compositing only: exterior sky matte; enclosed sprite colors retained.
    const cut=(im,rect)=>{
      const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];const cx=c.getContext('2d');cx.drawImage(im,...rect,0,0,c.width,c.height);
      const f=cx.getImageData(0,0,c.width,c.height),d=f.data,sky=d.slice(0,3),seen=new Uint8Array(c.width*c.height),queue=[];
      // Preserve native transparency from generated assets, without color keying.
      if(d[3]===0)return c;
      const add=i=>{if(i<0||i>=seen.length||seen[i])return;seen[i]=1;const j=i*4;if(Math.hypot(d[j]-sky[0],d[j+1]-sky[1],d[j+2]-sky[2])<48){d[j+3]=0;queue.push(i);}};
      for(let x=0;x<c.width;x++){add(x);add((c.height-1)*c.width+x);}for(let y=0;y<c.height;y++){add(y*c.width);add(y*c.width+c.width-1);}
      for(let n=0;n<queue.length;n++){const i=queue[n],x=i%c.width;if(x)add(i-1);if(x<c.width-1)add(i+1);add(i-c.width);add(i+c.width);}cx.putImageData(f,0,0);return c;
    };
    let mountains,cottages,clouds;
    if(sceneReview) {
      const m=await loadImage(taiwanScene?'mountains-dongli-review.png':'mountains-photo-review.png');mountains=cut(m,[0,0,m.width,m.height]);
      const h=await loadImage(taiwanScene?'cottages-taiwan-review.png':'cottages-front-review.png');cottages=cut(h,taiwanScene?[0,280,h.width,325]:[25,350,1720,335]);
      const c=await loadImage('clouds-review.png');clouds=[[20,160,515,240],[580,110,380,290],[1040,10,450,390],[35,555,485,275],[590,535,475,295],[1130,655,370,180]].map(r=>cut(c,r));
    }
    const {flowerVariant}=await import('/src/flower-variants.js');
    const leafPresets=[
      [[.18,.8],[.39,1.2],[.63,1.6],[.83,1.15]],
      [[.16,.85],[.34,1.1],[.52,1.45],[.7,1.2],[.86,.9]],
      [[.2,.9],[.42,1.4],[.65,1.65],[.84,1.2]],
      [[.16,.75],[.35,1.25],[.55,1.55],[.73,1.1],[.86,.85]]
    ];
    if(leafRevision&&!sceneReview) {
      document.querySelector('h1').textContent='Flower review · fuller leaves';
      document.querySelector('p').textContent='Existing head and stem designs · varied leaf sizes and spacing · 2× view';
      document.querySelectorAll('.labels span').forEach((label,i)=>label.textContent=`${leafPresets[i].length} leaf clusters · mixed sizes`);
    }
    if(leafRevision)sprites.layout.flower.variants.forEach(v=>v.leafLevels=[]);
    for(const id of sceneReview?['flowers']:['flowers','native']) {
      const canvas=document.getElementById(id),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      if(!protectedOnly){ctx.fillStyle='#91d5db';ctx.fillRect(0,0,canvas.width,canvas.height);}
      if(sceneReview) {
        if(!protectedOnly){if(taiwanScene)ctx.drawImage(mountains,0,365,480,240);
        else ctx.drawImage(mountains,0,265,480,320);}
        for(const [i,x,y,s] of [[1,20,85,.14],[3,205,50,.14],[5,360,130,.14],[0,40,190,.24],[2,330,235,.24],[4,180,300,.22]])ctx.drawImage(clouds[i],x,y,Math.round(clouds[i].width*s),Math.round(clouds[i].height*s));
        if(!protectedOnly){if(taiwanScene) {
          ctx.fillStyle='#84b564';ctx.fillRect(0,590,480,50);
          ctx.drawImage(cottages,12,517,456,84);
        } else {
          ctx.drawImage(cottages,0,514,480,94);
          ctx.fillStyle='#84b564';ctx.fillRect(0,603,480,37);
        }
        ctx.fillStyle='#68994f';ctx.fillRect(0,628,480,12);}
      }
      const ground=canvas.height-12;
      const flowerTop=sceneReview?295:42;
      for(let i=0;i<4;i++) {
        paintFlower(ctx,sprites,{id:i,x:(60+i*120)/480,displayHeight:(ground-flowerTop)/canvas.height,reaction:0,hits:0,blocked:0},480,canvas.height,ground);
        if(!leafRevision)continue;
        const layout=sprites.layout.flower,variant=flowerVariant(layout,i),headH=Math.round(layout.headSourceHeight*variant.scale);
        const start=flowerTop+Math.round(headH*.43),length=ground-start,image=sprites.flowerVariants[i][0];
        // Review-only composition: approved leaf crop, fixed attachment, uniform scale.
        // Short stems retain three separated clusters rather than overlapping foliage.
        const leaves=length<100?[[.23,.8],[.51,1.25],[.81,1]]:leafPresets[i];
        leaves.forEach(([level,size],j)=>{
          const y=start+Math.round(length*level),x=60+i*120+Math.round(Math.sin((y-start)/length*Math.PI*2)*variant.curvePixels);
          const scale=layout.leafScale*size,w=Math.round(layout.leafRect[2]*scale),h=Math.round(layout.leafRect[3]*scale);
          ctx.save();ctx.translate(x,y);ctx.scale((j+i)%2?-1:1,1);
          ctx.drawImage(image,...layout.leafRect,-Math.round(layout.leafAnchorX*scale),0,w,h);ctx.restore();
        });
      }
    }
  },{leafRevision,sceneReview,taiwanScene,protectedOnly});
  if(protectedOnly){
    const data=await page.locator('#flowers').evaluate(c=>c.toDataURL('image/png').split(',')[1]);
    await writeFile(new URL('protected-baseline.png',out),Buffer.from(data,'base64'));
    console.log('Protected flower/cloud snapshot saved from previous rendering.');
  }else{
  await page.screenshot({path:new URL(taiwanScene?'garden-taiwan-review.png':sceneReview?'garden-layers-review.png':leafRevision?'flowers-leaves-review.png':'flowers-review.png',out).pathname.slice(1),fullPage:sceneReview});
  const native=await page.locator('#flowers').evaluate(c=>c.toDataURL('image/png').split(',')[1]);
  await writeFile(new URL(taiwanScene?'garden-taiwan-native.png':sceneReview?'garden-layers-native.png':leafRevision?'flowers-leaves-native.png':'flowers-native.png',out),Buffer.from(native,'base64'));
  console.log('Flower review saved; no game mounted and no physical display used.');
  }
} finally {await browser?.close();server.kill();}
