"""Repeatable photo adaptations, with source hashes and review strips."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
from importlib import util
ROOT=Path(__file__).resolve().parents[1]
spec=util.spec_from_file_location('mountain',Path(__file__).with_name('convert-mountain.py'))
module=util.module_from_spec(spec);spec.loader.exec_module(module)
recipes=json.loads((ROOT/'rules/mountain-variants.json').read_text(encoding='utf-8'))['profiles']
out=ROOT/'tmp/mountain-variants-export';out.mkdir(parents=True,exist_ok=True)
# The legacy base photograph is prepared by convert-mountain.py, but must keep
# its credit when the additional-profile export refreshes the shared manifest.
base=json.loads((ROOT/'rules/mountain-photo.json').read_text(encoding='utf-8'))
base_target=ROOT/'assets/scenery/beidawu-native.png'
records=[{**base,'id':'beidawu','nativeSize':Image.open(base_target).size,
          'nativeSha256':hashlib.sha256(base_target.read_bytes()).hexdigest()}]
for recipe in recipes:
    path=ROOT/recipe['source'];assert hashlib.sha256(path.read_bytes()).hexdigest()==recipe['sha256']
    result,crop,skyline=module.convert(Image.open(path),recipe)
    target=ROOT/'assets/scenery'/f"{recipe['id']}-native.png";result.save(target,transparency=0)
    band=result.height*2+40
    sheet=Image.new('RGB',(1000,band*2),'#91d5db');draw=ImageDraw.Draw(sheet)
    preview=crop.resize((960,round(crop.height*960/crop.width)))
    sheet.paste(preview,(20,20));adapted=result.convert('RGBA').resize((960,result.height*2),Image.Resampling.NEAREST)
    sheet.paste(adapted,(20,band+20),adapted);sheet.save(out/f"{recipe['id']}-review.png")
    records.append({**recipe,'nativeSize':result.size,'nativeSha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(ROOT/'assets/scenery/mountain-variants-attribution.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps([{'id':r['id'],'size':r['nativeSize']} for r in records]))
