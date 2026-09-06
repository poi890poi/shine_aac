"""Static photographic mountain conversion; source-specific matte, no shape synthesis."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/candidates/rural-review-20260906'

def convert(photo, recipe):
    x,y,w,h=recipe['crop']
    if x<0 or y<0 or x+w>photo.width or y+h>photo.height:
        raise ValueError('Mountain crop outside source')
    crop=photo.convert('RGB').crop((x,y,x+w,y+h))
    data=np.asarray(crop).astype(float)
    luma=data @ np.array([.299,.587,.114])
    m=recipe['matte']
    eligible=(luma<m['maximumLuminance']) & ((data[:,:,2]-data[:,:,0])>=m['minimumBlueMinusRed'])
    run=m['verticalRun']
    # Require a continuous source-column transition, then retain the entire land
    # below it. This is an explicit matte for this backlit photo, not a generic AI mask.
    stable=np.logical_and.reduce([eligible[i:h-run+i+1] for i in range(run)])
    if not stable.any(0).all(): raise ValueError('Skyline not found in every source column')
    skyline=stable.argmax(0)
    alpha=(np.arange(h)[:,None]>=skyline[None,:]).astype(np.uint8)*255
    width=recipe['nativeWidth']; size=(width,round(h*width/w))
    mask=np.asarray(Image.fromarray(alpha).resize(size,Image.Resampling.BOX))>=128
    # Pillow's median filter removes photographic sensor speckles before tone
    # reduction. It only changes interior color clusters, never the separate mask.
    small=crop.resize(size,Image.Resampling.BOX).convert('L').filter(ImageFilter.MedianFilter(recipe['toneMedianSize']))
    tones=np.digitize(np.asarray(small),recipe['toneStops'])+1
    indices=np.where(mask,tones,0).astype(np.uint8)
    result=Image.fromarray(indices).convert('P')
    palette=[(0,0,0)]+[tuple(bytes.fromhex(c[1:])) for c in recipe['palette']]
    result.putpalette([v for color in palette+[(0,0,0)]*(256-len(palette)) for v in color])
    result.info['transparency']=0
    return result,crop,skyline

def main():
    recipe_path=ROOT/'rules/mountain-photo.json'
    recipe=json.loads(recipe_path.read_text(encoding='utf-8'))
    path=ROOT/recipe['source']
    if hashlib.sha256(path.read_bytes()).hexdigest()!=recipe['sha256']: raise ValueError('Mountain source changed')
    result,crop,skyline=convert(Image.open(path),recipe)
    OUT.mkdir(parents=True,exist_ok=True)
    result.save(OUT/'beidawu-native.png',transparency=0)
    crop.save(OUT/'beidawu-source-crop.png')
    # Exact source crop beside the native conversion, both at the same aspect ratio.
    sheet=Image.new('RGB',(1008,750),'#eff6ed'); draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',23)
    draw.text((24,15),'Beidawu from Neipu, Pingtung | static photograph conversion',font=font,fill='#284847')
    sheet.paste(crop.resize((960,286),Image.Resampling.LANCZOS),(24,54))
    draw.rectangle((24,364,983,649),fill='#91d5db')
    preview=result.convert('RGBA').resize((960,286),Image.Resampling.NEAREST)
    sheet.paste(preview,(24,364),preview)
    draw.text((24,668),'Greenigor, 2016 | CC BY-SA 4.0 | crop, sky removal, 4-tone mapping',font=font,fill='#284847')
    sheet.save(OUT/'mountain-conversion-review.png')
    record={**recipe,'nativeSize':result.size,'nativeSha256':hashlib.sha256((OUT/'beidawu-native.png').read_bytes()).hexdigest(),
            'sourceSkylineY':{str(x):int(skyline[x])+recipe['crop'][1] for x in [0,1000,2304,3300,4607]}}
    (OUT/'mountain-source.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/'mountain-attribution.txt').write_text('Mountain photograph: '+recipe['title']+' by Greenigor (2016-02-10).\n'+recipe['sourcePage']+'\nCC BY-SA 4.0: '+recipe['licenseUrl']+'\nChanges: '+recipe['adaptation']+'\nThe adapted mountain image and composed review image are distributed under CC BY-SA 4.0. No endorsement implied.\n',encoding='utf-8')
    print(json.dumps({'nativeSize':result.size,'sourceSkylineY':record['sourceSkylineY']}))

if __name__=='__main__': main()
