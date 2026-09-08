"""Convert a complete photographic mountain candidate set without publishing it.

Usage (from module): python scripts/review-mountain-batch.py --recipes
 assets/candidates/mountain-batch-20260908/recipes.json --out tmp/mountain-review
"""
import argparse
import hashlib
import json
from importlib import util
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
spec = util.spec_from_file_location('mountain', Path(__file__).with_name('convert-mountain.py'))
mountain = util.module_from_spec(spec)
spec.loader.exec_module(mountain)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--recipes', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    source = (ROOT / args.recipes).resolve()
    out = (ROOT / args.out).resolve()
    if not out.is_relative_to(ROOT) or out.is_relative_to(ROOT / 'assets/scenery'):
        raise ValueError('Review output must stay inside the module and outside live scenery')
    out.mkdir(parents=True, exist_ok=True)
    recipes = json.loads(source.read_text(encoding='utf-8'))['profiles']
    if len(recipes) < 8 or len({r['id'] for r in recipes}) != len(recipes):
        raise ValueError('The requested batch requires at least eight unique identities')
    font = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 19)
    small_font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
    # Two columns; each card compares exactly the same crop before/after.
    card_h = 390
    sheet = Image.new('RGB', (1024, 64 + card_h * ((len(recipes)+1)//2)), '#eef5ef')
    draw = ImageDraw.Draw(sheet)
    draw.text((20,12), '8 mountain profiles | source photograph / pixel conversion', font=font, fill='#284847')
    records = []
    silhouettes = set()
    for index, recipe in enumerate(recipes):
        path = ROOT / recipe['source']
        if digest(path) != recipe['sha256']:
            raise ValueError(f"Source changed: {recipe['id']}")
        result, crop, skyline = mountain.convert(Image.open(path), recipe)
        rgba = result.convert('RGBA')
        data = np.asarray(rgba)
        mask = data[:,:,3]
        if set(np.unique(mask)) != {0,255} or not (mask[-1] == 255).all():
            raise ValueError(f"Invalid sky/land mask: {recipe['id']}")
        colors = {tuple(c) for c in data[mask == 255,:3]}
        palette = {tuple(bytes.fromhex(c[1:])) for c in recipe['palette']}
        if not colors <= palette or len(colors) < 2:
            raise ValueError(f"Invalid color ramp: {recipe['id']}")
        shape = hashlib.sha256(mask.tobytes()).hexdigest()
        if shape in silhouettes:
            raise ValueError('Repeated photographic silhouette in batch')
        silhouettes.add(shape)
        target = out / f"{recipe['id']}-native.png"
        result.save(target, transparency=0)
        crop.save(out / f"{recipe['id']}-source-crop.png")
        x, y = 16 + index%2*512, 64 + index//2*card_h
        draw.text((x,y), f"{index+1:02d}  {recipe['label']}",font=font,fill='#284847')
        draw.text((x,y+28), recipe['author']+' | '+recipe['license'],font=small_font,fill='#4c6964')
        photo = crop.resize(result.size, Image.Resampling.LANCZOS)
        # A fixed card can accommodate crops of up to 158 native pixels high.
        if result.height > 158:
            raise ValueError('Use a taller review card; never crop the comparison')
        sheet.paste(photo, (x,y+50))
        draw.rectangle((x,y+216,x+479,y+373), fill='#91d5db')
        sheet.paste(rgba, (x,y+216), rgba)
        records.append({**recipe, 'nativeSize':list(result.size),
                        'nativeSha256':digest(target), 'alphaSha256':shape,
                        'colorCount':len(colors), 'sourceSkylineRange':[int(skyline.min()),int(skyline.max())]})
        print(recipe['id'], result.size, 'colors', len(colors), flush=True)
    sheet.save(out/'mountains-eight-review.png')
    manifest = {'status':'candidate; user visual decision pending', 'count':len(records),
                'recipeSha256':digest(source), 'converterSha256':digest(Path(mountain.__file__)),
                'reviewSha256':digest(out/'mountains-eight-review.png'), 'profiles':records}
    (out/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    print('Batch review exported:', out/'mountains-eight-review.png')


if __name__ == '__main__':
    main()
