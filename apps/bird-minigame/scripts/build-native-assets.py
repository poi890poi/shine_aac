"""Build real RGBA source masks and final-size native bird assets offline.

OpenCV is used for PNG I/O and connected components only; no neural generation,
outline expansion, automatic hole filling, or changes to source artwork.
"""
import cv2, numpy as np, json, hashlib, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/native';DEST.mkdir(parents=True,exist_ok=True)
RULE=json.loads((ROOT/'rules/native-alpha.json').read_text(encoding='utf-8-sig'))
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def export(path,rgba):
 path.parent.mkdir(parents=True,exist_ok=True)
 assert cv2.imwrite(str(path),cv2.cvtColor(rgba,cv2.COLOR_RGBA2BGRA))
 return digest(path)
def extract(rgb,seeds=(),cloud=False):
 v=rgb.astype(np.int16)
 allowed=((v[:,:,2]-v[:,:,1]<=RULE['clouds']['skyMaxBlueMinusGreen'])&(v[:,:,1]-v[:,:,0]>=RULE['clouds']['skyMinGreenMinusRed'])) if cloud else ((v.min(2)>165)&(v.max(2)-v.min(2)<45))
 _,labels,stats,_=cv2.connectedComponentsWithStats(allowed.astype('uint8'),connectivity=4)
 exterior=set(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])).tolist());exterior.discard(0)
 background=np.isin(labels,list(exterior))
 for seed in seeds:
  x,y=seed['point'];label=labels[y,x]
  assert label and int(stats[label,4])==seed['expectedArea'],('Mask source/component changed',seed)
  assert stats[label,:4].tolist()==seed['bounds'],('Mask bounds changed',seed)
  background|=labels==label
 alpha=np.where(background,0,255).astype('uint8')
 return np.dstack((rgb,alpha))
def native_resize(rgba,width,height):
 # Canvas/nearest centre sampling. Exactly one sampling from original crop.
 xx=np.minimum(rgba.shape[1]-1,np.floor((np.arange(width)+.5)*rgba.shape[1]/width).astype(int))
 yy=np.minimum(rgba.shape[0]-1,np.floor((np.arange(height)+.5)*rgba.shape[0]/height).astype(int))
 return rgba[yy[:,None],xx[None,:]].copy()
def jsround(value):return int(np.floor(value+.5))
base=json.loads((ROOT/'rules/sprite-layout.json').read_text(encoding='utf-8-sig'))
magpie=dict(base['bird'],speciesId='taiwan_blue_magpie',file='../assets/candidates/shape-preserving-20260905/'+base['bird']['file'])
entries=[magpie,json.loads((ROOT/'rules/yellow-tit-sprite.json').read_text(encoding='utf-8-sig'))]+json.loads((ROOT/'rules/all-bird-sprites.json').read_text(encoding='utf-8-sig'))['species']
manifest={'version':1,'birdDisplayMultiplier':RULE['birdDisplayMultiplier'],'birds':{},'clouds':[]}
for entry in entries:
 species=entry['speciesId'];path=(ROOT/'rules'/entry['file']).resolve();source=cv2.cvtColor(cv2.imread(str(path)),cv2.COLOR_BGR2RGB)
 source_hash=digest(path);record=RULE['birds'].get(species,{})
 if record:assert source_hash==record['sourceSha256']
 frames=[];scale=entry['scale']*RULE['birdDisplayMultiplier']
 for i,pose in enumerate(entry['poses']):
  x,y,w,h=pose['rect'];raw=source[y:y+h,x:x+w];seeds=record.get('backgroundSeeds',{}).get(str(i),[])
  rgba=extract(raw,seeds);maskpath=DEST/'masks'/('{}-{}.png'.format(species,i));maskpath.parent.mkdir(parents=True,exist_ok=True);cv2.imwrite(str(maskpath),rgba[:,:,3])
  width,height=jsround(w*scale),jsround(h*scale);native=native_resize(rgba,width,height)
  filename='birds/{}-{}.png'.format(species,i);sha=export(DEST/filename,native)
  frames.append({'file':filename,'width':width,'height':height,'anchor':[jsround(a*scale) for a in pose['anchor']],'sha256':sha,'sourceRect':pose['rect'],'maskSha256':digest(maskpath)})
 manifest['birds'][species]={'sourceSha256':source_hash,'sourceFile':str(path.relative_to(ROOT)).replace('\\','/'),'scale':1,'poses':frames,'cycle':entry['cycle'],'settledPose':entry['settledPose'],'previewPose':entry.get('previewPose',entry['cycle'][0])}
 if 'groundContactY' in entry:manifest['birds'][species]['groundContactY']=jsround(entry['groundContactY']*scale)
sourcepath=ROOT/'assets/scenery/clouds-review.png';assert digest(sourcepath)==RULE['clouds']['sourceSha256']
source=cv2.cvtColor(cv2.imread(str(sourcepath)),cv2.COLOR_BGR2RGB)
for i,(x,y,w,h) in enumerate(RULE['clouds']['rects']):
 rgba=extract(source[y:y+h,x:x+w],cloud=True);name='clouds/cloud-{}.png'.format(i);sha=export(DEST/name,rgba)
 manifest['clouds'].append({'file':name,'sha256':sha,'width':w,'height':h})
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Native RGBA assets:',sum(len(b['poses']) for b in manifest['birds'].values()),'bird poses and',len(manifest['clouds']),'cloud sources')

# Approved masters are immutable review artifacts, not regenerated blur results.
approved=ROOT/'test/fixtures/approved-clouds'
decision=json.loads((approved/'decision.json').read_text(encoding='utf8'))
for name,expected in decision['acceptedNativeExports'].items():
 assert digest(approved/name)==expected
 (DEST/'approved-clouds').mkdir(exist_ok=True)
 shutil.copyfile(str(approved/name),str(DEST/'approved-clouds'/name))
