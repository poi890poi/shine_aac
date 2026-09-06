"""Astropulse k-centroid sampler, MIT; see LICENSE.pixeldetector.

Extracted kCentroid from commit 6e88e18ddbd16529b5dd85b1c615cbb2e5778bf2.
CLI, OpenCV and optional outline-expansion imports omitted. Algorithm unchanged.
"""
from itertools import product
from PIL import Image
import numpy as np


def kCentroid(image, width, height, centroids):
    image = image.convert("RGB")
    downscaled = np.zeros((height, width, 3), dtype=np.uint8)
    wFactor = image.width / width
    hFactor = image.height / height
    for x, y in product(range(width), range(height)):
        tile = image.crop((x*wFactor, y*hFactor,
                           (x*wFactor)+wFactor, (y*hFactor)+hFactor))
        tile = tile.quantize(colors=centroids, method=1, kmeans=centroids).convert("RGB")
        color_counts = tile.getcolors()
        most_common_color = max(color_counts, key=lambda x: x[0])[1]
        downscaled[y, x, :] = most_common_color
    return Image.fromarray(downscaled)
