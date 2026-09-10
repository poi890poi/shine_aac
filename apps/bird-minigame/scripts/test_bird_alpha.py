"""Source-reviewed feather landmarks plus broken-mask negative controls."""
from pathlib import Path
import json,cv2
ROOT=Path(__file__).resolve().parents[1]
FIXTURE=ROOT/'test/fixtures/bird-alpha'
def violations(image,case):
 return sum(image[y,x,3]!=255 for x,y in case['foreground'])+sum(image[y,x,3]!=0 for x,y in case['background'])
manifest=json.loads((ROOT/'assets/native/manifest.json').read_text())
baseline=json.loads((FIXTURE/'baseline-manifest.json').read_text())
cases=json.loads((FIXTURE/'landmarks.json').read_text());changed={(c['id'],c['pose']) for c in cases}
for case in cases:
 name='{}-{}'.format(case['id'],case['pose'])
 broken=cv2.imread(str(FIXTURE/(name+'-broken.png')),-1)
 assert violations(broken,case)>0,'Negative control must expose the lost feather'
 image=cv2.imread(str(ROOT/'assets/native/birds'/(name+'.png')),-1)
 assert violations(image,case)==0,'Feather/background landmark regression: '+name
for id,bird in manifest['birds'].items():
 for pose,record in enumerate(bird['poses']):
  old=baseline['birds'][id]['poses'][pose]
  if (id,pose) not in changed:assert record==old,'Unrelated pose changed: '+id+str(pose)
  else:
   for key in ['width','height','anchor','sourceRect']:assert record[key]==old[key]
print('PASS feather landmarks, genuine background gaps, broken-mask negative controls and 61 unchanged poses')
