"""Build crop/anchor metadata only; source artwork is never rewritten."""
import hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/candidates/all-birds-20260906'

def split_at_blank(counts, center):
    candidates = range(max(1, center-80), min(len(counts)-1, center+81))
    result = min(candidates, key=lambda x: (int(counts[max(0,x-3):x+4].sum()), abs(x-center)))
    if counts[result] != 0:
        raise ValueError('No safe whitespace separator; review source layout')
    return result

species = []
for item in json.loads((SOURCE / 'authoring.json').read_text(encoding='utf8')):
    path = SOURCE / (item['id']+'.png')
    pixels = np.asarray(Image.open(path).convert('RGB')).astype(int)
    height, width = pixels.shape[:2]
    foreground = (pixels.min(axis=2) <= 165) | (pixels.max(axis=2)-pixels.min(axis=2) >= 45)
    split_y = split_at_blank(foreground.sum(axis=1), height//2)
    poses = []
    for index, eye in enumerate(item['eyes']):
        y0,y1 = (0,split_y) if index < 2 else (split_y,height)
        split_x = split_at_blank(foreground[y0:y1].sum(axis=0), width//2)
        x0,x1 = (0,split_x) if index%2 == 0 else (split_x,width)
        yy,xx = np.where(foreground[y0:y1,x0:x1])
        assert len(xx)>1000 and xx.min()>0 and yy.min()>0 and xx.max()<x1-x0-1 and yy.max()<y1-y0-1, (item['id'],index,xx.min(),yy.min(),xx.max(),yy.max())
        offset = item['settledEyeOffset' if index == 3 else 'flightEyeOffset']
        poses.append({'rect':[x0,y0,x1-x0,y1-y0], 'anchor':[eye[0]-x0-offset[0],eye[1]-y0-offset[1]], 'foregroundBounds':[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]})
    species.append({'speciesId':item['id'], 'file':'../assets/candidates/all-birds-20260906/'+path.name, 'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'scale':item['scale'], 'poses':poses, 'cycle':[0,2,1,2], 'settledPose':3, 'previewPose':2, 'groundContactY':item.get('feetSourceY',split_y+poses[3]['foregroundBounds'][3])-split_y, 'reviewStatus':'candidate-for-user-review'})
(ROOT/'rules/all-bird-sprites.json').write_text(json.dumps({'schemaVersion':1,'species':species},indent=2)+'\n',encoding='utf8')
print('Built metadata for',len(species),'species; original PNG files untouched.')
