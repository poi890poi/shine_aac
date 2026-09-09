// Native-size GPU drawing and a single NEAREST integer framebuffer enlargement.
// This small adapter implements only the rectangle/image/translation operations
// used by the game renderer. Asset masks and sampling are owned by preparation.
export function createGpuSurface(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
 if(!gl)return null;
 let program,buffer,white,target,fbo,locations,textures=new Map(),pending=new Float32Array(65568),pendingLength=0,currentTexture=null,lost=false;
 let width=1,height=1,physicalWidth=1,physicalHeight=1,scale=1,transform=[1,1,0,0],stack=[],color=[0,0,0,1];
 const MAX_TEXTURES=192,colorCache=new Map();
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
 const texture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
 function initialize(){
  textures=new Map();pendingLength=0;currentTexture=null;
  const vs=shader(gl.VERTEX_SHADER,'attribute vec2 position;attribute vec2 uv;attribute vec4 tint;uniform vec2 extent;varying vec2 texcoord;varying vec4 color;void main(){gl_Position=vec4(position.x/extent.x*2.0-1.0,1.0-position.y/extent.y*2.0,0.,1.);texcoord=uv;color=tint;}');
  const fs=shader(gl.FRAGMENT_SHADER,'precision highp float;uniform sampler2D image;varying vec2 texcoord;varying vec4 color;void main(){gl_FragColor=texture2D(image,texcoord)*color;}');
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  locations={position:gl.getAttribLocation(program,'position'),uv:gl.getAttribLocation(program,'uv'),tint:gl.getAttribLocation(program,'tint'),extent:gl.getUniformLocation(program,'extent')};
  buffer=gl.createBuffer();white=texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  target=texture();fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
  gl.disable(gl.DITHER);gl.disable(gl.DEPTH_TEST);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  allocate();
 }
 function allocate(){gl.bindTexture(gl.TEXTURE_2D,target);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete game framebuffer');}
 function draw(vertices,tex,w,h,destination){
  if(lost||!vertices.length)return;
  gl.bindFramebuffer(gl.FRAMEBUFFER,destination);gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform2f(locations.extent,w,h);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STREAM_DRAW);
  for(const [name,size,offset] of [['position',2,0],['uv',2,8],['tint',4,16]]){gl.enableVertexAttribArray(locations[name]);gl.vertexAttribPointer(locations[name],size,gl.FLOAT,false,32,offset);}
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.drawArrays(gl.TRIANGLES,0,vertices.length/8);
 }
 function flush(){if(!pendingLength)return;gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);draw(pending.subarray(0,pendingLength),currentTexture,width,height,fbo);pendingLength=0;}
 function quad(tex,x,y,w,h,u0=0,v0=0,u1=1,v1=1,tint=color){
  if(lost)return;if(currentTexture!==tex||pendingLength+48>pending.length){flush();currentTexture=tex;}
  const [sx,sy,tx,ty]=transform,x0=x*sx+tx,y0=y*sy+ty,x1=(x+w)*sx+tx,y1=(y+h)*sy+ty;
  vertex(x0,y0,u0,v0,tint);vertex(x1,y0,u1,v0,tint);vertex(x0,y1,u0,v1,tint);
  vertex(x0,y1,u0,v1,tint);vertex(x1,y0,u1,v0,tint);vertex(x1,y1,u1,v1,tint);
 }
 function vertex(x,y,u,v,tint){
  pending[pendingLength++]=x;pending[pendingLength++]=y;pending[pendingLength++]=u;pending[pendingLength++]=v;
  pending[pendingLength++]=tint[0];pending[pendingLength++]=tint[1];pending[pendingLength++]=tint[2];pending[pendingLength++]=tint[3];
 }
 function sourceTexture(source){
  if(textures.has(source)){const t=textures.get(source);textures.delete(source);textures.set(source,t);return t;}
  flush();const t=texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);textures.set(source,t);
  if(textures.size>MAX_TEXTURES){const [key,old]=textures.entries().next().value;textures.delete(key);gl.deleteTexture(old);}
  return t;
 }
 const context={
  set fillStyle(value){if(!colorCache.has(value)){if(!/^#[\da-f]{6}$/i.test(value))throw new Error('GPU game colors must be opaque #RRGGBB');colorCache.set(value,[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255).concat(1));}color=colorCache.get(value);},
  get fillStyle(){return '#'+color.slice(0,3).map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');},
  imageSmoothingEnabled:false,
  fillRect(x,y,w,h){quad(white,x,y,w,h);},
  drawImage(source,...args){let sx=0,sy=0,sw=source.width,sh=source.height,x,y,w,h;
   if(args.length===2){[x,y]=args;w=sw;h=sh;}else if(args.length===4)[x,y,w,h]=args;else if(args.length===8)[sx,sy,sw,sh,x,y,w,h]=args;else throw new Error('Unsupported GPU image arguments');
   quad(sourceTexture(source),x,y,w,h,sx/source.width,sy/source.height,(sx+sw)/source.width,(sy+sh)/source.height,[1,1,1,1]);
  },
  save(){stack.push({transform:[...transform],color:[...color]});},restore(){const s=stack.pop();if(s){transform=s.transform;color=s.color;}},
  translate(x,y){transform[2]+=x*transform[0];transform[3]+=y*transform[1];},scale(x,y){transform[0]*=x;transform[1]*=y;}
 };
 function present(){if(lost)return;flush();gl.disable(gl.BLEND);
  const w=width*scale,h=height*scale,vertices=[];
  for(const [x,y,u,v] of [[0,0,0,1],[w,0,1,1],[0,h,0,0],[0,h,0,0],[w,0,1,1],[w,h,1,0]])vertices.push(x,y,u,v,1,1,1,1);
  draw(new Float32Array(vertices),target,physicalWidth,physicalHeight,null);
 }
 initialize();
 const onLost=e=>{e.preventDefault();lost=true;pendingLength=0;};
 const onRestored=()=>{lost=false;initialize();canvas.dispatchEvent(new Event('game-renderer-restored'));};
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
 return {context,present,
  resize(viewport){flush();({width,height,physicalWidth,physicalHeight,scale}=viewport);transform=[1,1,0,0];stack=[];if(!lost)allocate();},
  readPixels(){present();const raw=new Uint8Array(physicalWidth*physicalHeight*4),out=new Uint8ClampedArray(raw.length);gl.readPixels(0,0,physicalWidth,physicalHeight,gl.RGBA,gl.UNSIGNED_BYTE,raw);for(let y=0;y<physicalHeight;y++)out.set(raw.subarray((physicalHeight-1-y)*physicalWidth*4,(physicalHeight-y)*physicalWidth*4),y*physicalWidth*4);return out;},
  info(){const ext=gl.getExtension('WEBGL_debug_renderer_info');return {backend:'webgl',renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),textureCount:textures.size};},
  destroy(){canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);for(const t of textures.values())gl.deleteTexture(t);gl.deleteTexture(white);gl.deleteTexture(target);gl.deleteFramebuffer(fbo);gl.deleteBuffer(buffer);gl.deleteProgram(program);}
 };
}
