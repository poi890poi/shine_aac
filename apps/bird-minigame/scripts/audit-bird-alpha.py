"""Flag possible pale-plumage losses for visual review; never modifies assets.

A stricter exterior key is a diagnostic perturbation, not a replacement matte.
It also flags genuine gaps enclosed by pale outlines. Review source and alpha
before adding any foreground stencil. Small defects can evade the area ranking.
"""
import cv2,numpy as np,json,argparse
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--threshold',type=int,default=230);parser.add_argument('--out',type=Path,default=root/'tmp/bird-alpha-audit');args=parser.parse_args();assert 165<args.threshold<255
out=args.out;out.mkdir(parents=True,exist_ok=True)
m=json.loads((root/'assets/native/manifest.json').read_text());results=[]
for id,b in m['birds'].items():
 source=cv2.imread(str(root/b['sourceFile']))
 for pose,p in enumerate(b['poses']):
  x,y,w,h=p['sourceRect'];rgb=source[y:y+h,x:x+w];v=rgb.astype(np.int16);old=cv2.imread(str(root/'assets/native/masks'/('{}-{}.png'.format(id,pose))),0)
  allowed=((v.min(2)>args.threshold)&(v.max(2)-v.min(2)<45)).astype('uint8');_,labels,stats,_=cv2.connectedComponentsWithStats(allowed,connectivity=4)
  ext=set(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]).tolist());ext.discard(0);strong=~np.isin(labels,list(ext));delta=(old==0)&strong
  n,regions,areas,_=cv2.connectedComponentsWithStats(delta.astype('uint8'),connectivity=8)
  large=sorted([{'area':int(s[4]),'bounds':s[:4].tolist(),'label':i} for i,s in enumerate(areas) if i and s[4]>=80],key=lambda a:-a['area'])
  # Diagnostic only: alternative key highlights candidates, never changes artwork.
  overlay=np.dstack((rgb,old));overlay[delta]=[60,200,255,255]
  cv2.imwrite(str(out/('{}-{}-suspects.png'.format(id,pose))),overlay)
  results.append({'id':id,'pose':pose,'opaque':int((old>0).sum()),'candidatePixels':int(delta.sum()),'largest':large[:8],'sourceRect':p['sourceRect'],'nativeSize':[p['width'],p['height']]})
(out/'suspects.json').write_text(json.dumps(sorted(results,key=lambda a:-(a['largest'][0]['area'] if a['largest'] else 0)),indent=2))
for r in sorted(results,key=lambda a:-(a['largest'][0]['area'] if a['largest'] else 0))[:20]:print(r['id'],r['pose'],r['candidatePixels'],r['largest'][:2])
