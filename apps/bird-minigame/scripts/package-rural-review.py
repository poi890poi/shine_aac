"""Package the scenery-only converter and review artifacts for HTTPS delivery."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/candidates/rural-review-20260906'
SHARE = ROOT / 'tmp/textfree-20260906/share'

# A focused 4x view permits cottage/ground review without manipulating plants.
ground = Image.open(OUT / 'rural-ground-native.png')
ground.crop((0, 470, 480, 640)).resize((1920, 680), Image.Resampling.NEAREST).save(OUT / 'rural-ground-review.png')
files = ['scripts/convert-scenery.py', 'scripts/test_pixel_conversion.py',
         'scripts/convert-mountain.py', 'rules/mountain-photo.json',
         'scripts/pixel-conversion-requirements.txt', 'scripts/vendor/k_centroid.py',
         'scripts/vendor/LICENSE.pixeldetector', 'rules/scenery-conversion.json',
         'research/PIXEL_CONVERSION_METHOD.md',
         'assets/candidates/scenery-review-20260906/cottages-taiwan-review.png',
         'assets/candidates/scenery-review-20260906/dongli-source.jpg',
         'assets/candidates/scenery-review-20260906/beidawu-source.jpg']
with zipfile.ZipFile(OUT / 'scenery-converter-kit.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in files:
        bundle.write(ROOT / name, name)
    bundle.writestr('README.md', '''# Scenery converter review kit

Python 3.12; install scripts/pixel-conversion-requirements.txt, then run:

    python scripts/convert-scenery.py --review
    python scripts/convert-mountain.py
    python scripts/test_pixel_conversion.py

Edit rules/scenery-conversion.json for source crop, native size, palette,
daylight colors, cottage spacing and paddy layout. See the research document.
Flowers and clouds are excluded. The browser-based protected-layer comparison
requires the full bird-minigame repository; it is not part of this standalone kit.

Cottage source: generated candidate, not a photographic asset.
Photo fixture: Hannah Kao, CC0, https://wordpress.org/photos/photo/18665d24a3/
The fixture is NOT an accepted game mountain. pixeldetector code is MIT; its
license is included. Research photographs are reference-only and not distributed.
The Beidawu source by Greenigor and its adaptation are CC BY-SA 4.0, with full
source/author/license/change credits in review/mountain-attribution.txt.
''')
    for name in ('rural-garden-review.png', 'rural-ground-review.png', 'cottage-sunny.png', 'protected-verification.json', 'beidawu-native.png', 'mountain-conversion-review.png', 'mountain-source.json', 'mountain-attribution.txt'):
        bundle.write(OUT / name, 'review/'+name)

delivery = {}
for src, name in ((OUT/'rural-garden-review.png','rural-garden-review.png'),
                  (OUT/'rural-garden-review.png','rural-garden-mountains-review.png'),
                  (OUT/'mountain-conversion-review.png','mountain-conversion-review.png'),
                  (OUT/'mountain-attribution.txt','mountain-attribution.txt'),
                  (OUT/'rural-ground-review.png','rural-ground-review.png'),
                  (OUT/'scenery-converter-kit.zip','scenery-converter-kit.zip'),
                  (ROOT/'research/PIXEL_CONVERSION_METHOD.md','scenery-method.md')):
    shutil.copyfile(src, SHARE/name)
    delivery[name] = hashlib.sha256(src.read_bytes()).hexdigest()
(OUT/'delivery-manifest.json').write_text(json.dumps(delivery, indent=2)+'\n')
print(json.dumps(delivery))
