"""Inspect PNG outputs; these mechanical checks do not judge drawing quality.

Run with a Python environment containing Pillow. No image pixels are modified.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/candidates/shape-preserving-20260905'
expected = {'magpie-v1.png': (1536, 512), 'magpie-alpha-v2.png': (1536, 1024),
            'flower-v1.png': (1024, 1024)}
results = []
for name, size in expected.items():
    path = folder / name
    with Image.open(path) as im:
        alpha_range = im.convert('RGBA').getchannel('A').getextrema()
        results.append({
            'file': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'size': list(im.size), 'expectedSize': list(size),
            'mode': im.mode, 'alphaExtrema': list(alpha_range),
            'hasTransparentPixels': alpha_range[0] < 255,
            'requestedDimensionsMatch': im.size == size,
            'colorCountIncludingBackground': len(im.getcolors(im.width * im.height)),
            'visualAcceptance': 'not assessed by this script',
        })
print(json.dumps(results, indent=2))
(folder / 'mechanical-inspection.json').write_text(json.dumps(results, indent=2) + '\n')
