"""Photographic batch contracts; these are not aesthetic approval tests."""
import copy
import hashlib
import json
import unittest
from importlib import util
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = util.spec_from_file_location('mountain', Path(__file__).with_name('convert-mountain.py'))
mountain = util.module_from_spec(spec)
spec.loader.exec_module(mountain)
BATCH = ROOT/'assets/candidates/mountain-batch-20260908'


class MountainBatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.recipes = json.loads((BATCH/'recipes.json').read_text('utf-8'))['profiles']
        cls.outputs = {}
        for r in cls.recipes:
            cls.outputs[r['id']] = mountain.convert(Image.open(ROOT/r['source']), r)

    def test_substantial_batch_has_eight_distinct_sources_and_silhouettes(self):
        self.assertGreaterEqual(len(self.recipes),8)
        for key in ['id','sourcePage','sha256']:
            self.assertEqual(len({r[key] for r in self.recipes}),len(self.recipes))
        self.assertEqual(len({o[0].convert('RGBA').getchannel('A').tobytes()
                              for o in self.outputs.values()}),len(self.recipes))

    def test_frozen_sources_and_exports_reproduce_exactly(self):
        for r in self.recipes:
            with self.subTest(profile=r['id']):
                self.assertEqual(hashlib.sha256((ROOT/r['source']).read_bytes()).hexdigest(),r['sha256'])
                expected=Image.open(BATCH/'review'/f"{r['id']}-native.png").convert('RGBA')
                self.assertEqual(expected.tobytes(),self.outputs[r['id']][0].convert('RGBA').tobytes())

    def test_one_shared_palette_binary_alpha_and_connected_ground(self):
        palette=self.recipes[0]['palette']
        allowed={tuple(bytes.fromhex(c[1:])) for c in palette}
        for r in self.recipes:
            self.assertEqual(r['palette'],palette)
            image=np.asarray(self.outputs[r['id']][0].convert('RGBA'))
            self.assertEqual(set(np.unique(image[:,:,3])),{0,255})
            self.assertTrue((image[-1,:,3]==255).all())
            self.assertTrue({tuple(c) for c in image[image[:,:,3]>0,:3]}<=allowed)
            # Each column changes from sky to land once; no internal alpha holes.
            self.assertTrue((np.diff(image[:,:,3].astype(int),axis=0)>=0).all())

    def test_haze_or_interior_cleanup_never_changes_the_source_contour(self):
        for recipe in self.recipes:
            r=copy.deepcopy(recipe);r['toneMedianSize']=3;r['toneStops']=[40,85,130]
            changed,_,_=mountain.convert(Image.open(ROOT/r['source']),r)
            self.assertEqual(changed.convert('RGBA').getchannel('A').tobytes(),
                             self.outputs[r['id']][0].convert('RGBA').getchannel('A').tobytes())

    def test_dajian_source_landmarks_reject_the_over_narrow_blue_mask(self):
        # Hand-selected sky/land brackets from the photograph, in source pixels.
        # The first chroma cap incorrectly removed the blue-lit left slope and
        # cut vertical slots through the rocky peak. These brackets catch it.
        skyline=self.outputs['dajian-kenting'][2]
        for x,sky,land in [(0,105,125),(60,120,140),(342,22,38),(400,70,92),(959,112,135)]:
            self.assertGreater(skyline[x],sky)
            self.assertLessEqual(skyline[x],land)
        rejected=copy.deepcopy(next(r for r in self.recipes if r['id']=='dajian-kenting'))
        rejected['matte'].update(maximumLuminance=115,maximumBlueMinusRed=45)
        _,_,bad=mountain.convert(Image.open(ROOT/rejected['source']),rejected)
        self.assertGreater(bad[0],125, 'The source bracket must detect the rejected mask')

    def test_blue_sky_rule_does_not_mistake_dark_blue_sky_for_land(self):
        # Independent simple fixture: sky is darker than some land, so luma
        # alone cannot matte it; the optional chroma ceiling is necessary.
        data=np.full((16,20,3),[70,110,190],dtype=np.uint8)
        data[8:]=[95,130,100]
        r=dict(crop=[0,0,20,16],nativeWidth=20,toneMedianSize=3,
               toneStops=[80,115,145],palette=self.recipes[0]['palette'],
               matte=dict(maximumLuminance=170,minimumBlueMinusRed=-255,
                          maximumBlueMinusRed=30,verticalRun=2))
        result,_,line=mountain.convert(Image.fromarray(data),r)
        np.testing.assert_array_equal(line,np.full(20,8))
        self.assertEqual(result.convert('RGBA').getpixel((10,2))[3],0)
        self.assertEqual(result.convert('RGBA').getpixel((10,10))[3],255)


if __name__=='__main__':
    unittest.main()
