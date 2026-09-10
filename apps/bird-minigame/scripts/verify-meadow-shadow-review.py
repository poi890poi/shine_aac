"""Verify paired review renders; needs Pillow and numpy. Run review-meadow-shadows.mjs first."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
root=Path('apps/bird-minigame/tmp/meadow-shadow-review')
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8-sig'))
results=[]
for item in manifest:
    if item['before']: continue
    meadow=np.array([int(item['meadow'][i:i+2],16) for i in (1,3,5)])
    masks=[]
    for suffix in ['game','t0','t18','t36']:
        name=item['prefix']+'-'+suffix+'.png'
        a=np.array(Image.open(root/name.replace('after-','before-',1)).convert('RGBA')).astype(int)
        b=np.array(Image.open(root/name).convert('RGBA')).astype(int)
        changed=np.any(a!=b,axis=2)
        assert changed.any(), 'Missing shadow: '+name
        ys,xs=np.where(changed)
        assert np.all(a[changed,:3]==meadow), 'Protected artwork changed: '+name
        assert ys.min()>=item['ground']-104 and ys.max()<item['ground']-40, 'Shadow outside middle meadow: '+name
        assert np.max(np.abs(a-b))<=12, 'Excess shadow contrast: '+name
        assert np.array_equal(a[:,:,3],b[:,:,3]), 'Alpha changed: '+name
        results.append({'image':name,'changedMeadowPixels':int(changed.sum()),'maxChannelChange':int(np.max(np.abs(a-b))),'yBounds':[int(ys.min()),int(ys.max())]})
        if suffix!='game': masks.append(changed)
    assert not np.array_equal(masks[0],masks[1]) and not np.array_equal(masks[1],masks[2]), 'Shadow motion missing'
(root/'verification.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('PASS: 24 paired frames; shadows move, stay subtle and touch only middle-meadow base pixels. All other pixels unchanged.')
