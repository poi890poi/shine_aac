"""Technical contract regressions; these do not grant visual art acceptance."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

SPEC = importlib.util.spec_from_file_location("conversion", Path(__file__).with_name("convert-scenery.py"))
conversion = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(conversion)
MOUNTAIN_SPEC = importlib.util.spec_from_file_location('mountain', Path(__file__).with_name('convert-mountain.py'))
mountain = importlib.util.module_from_spec(MOUNTAIN_SPEC)
MOUNTAIN_SPEC.loader.exec_module(mountain)


class ConversionContract(unittest.TestCase):
    def setUp(self):
        self.profile = json.loads((conversion.ROOT / "rules/scenery-conversion.json").read_text())

    def fixture(self):
        data = np.zeros((12, 20, 4), np.uint8)
        data[2:10, 2:18] = [200, 70, 80, 255]
        data[4:8, 6:14] = [255, 240, 160, 255]
        data[6, 9:11] = [25, 25, 35, 255]
        return Image.fromarray(data)

    def test_palette_changes_and_sampling_do_not_change_mask(self):
        masks = []
        for method in conversion.METHODS:
            for subset in ("mountain", "cottage"):
                output, _ = conversion.convert(self.fixture(), (10, 6), method, self.profile, subset)
                masks.append(output.convert("RGBA").getchannel("A").tobytes())
        self.assertTrue(all(mask == masks[0] for mask in masks))
        # Independent hand-authored expected 2x coverage geometry.
        expected = np.zeros((6, 10), np.uint8)
        expected[1:5, 1:9] = 255
        self.assertEqual(masks[0], expected.tobytes())

    def test_deterministic_and_integer_preview(self):
        for method in conversion.METHODS:
            first, _ = conversion.convert(self.fixture(), (10, 6), method, self.profile, "cottage")
            second, _ = conversion.convert(self.fixture(), (10, 6), method, self.profile, "cottage")
            self.assertEqual(first.tobytes(), second.tobytes())
            enlarged = np.array(first.convert("RGBA").resize((40, 24), Image.Resampling.NEAREST))
            expected = np.repeat(np.repeat(np.array(first.convert("RGBA")), 4, axis=0), 4, axis=1)
            np.testing.assert_array_equal(enlarged, expected)

    def test_validator_rejects_known_bad_outputs(self):
        good, _ = conversion.convert(self.fixture(), (10, 6), "box", self.profile, "cottage")
        for bad in (Image.new("RGBA", (10, 6), (1, 2, 3, 255)),
                    Image.new("RGBA", (10, 6), (255, 255, 255, 127)),
                    good.resize((11, 6))):
            with self.assertRaises(ValueError):
                conversion.validate_image(bad, (10, 6), self.profile, "cottage")

    def test_recipe_rejects_stale_hash_and_axis_stretch_is_not_an_option(self):
        recipe = copy.deepcopy(self.profile["recipes"][0])
        recipe["sha256"] = "0"*64
        with self.assertRaises(ValueError):
            conversion.prepare(recipe)
        _, size = conversion.prepare(self.profile["recipes"][0])
        self.assertEqual(size, (84, 44))

    def test_equal_cottages_and_no_sky_gap_in_rice_band(self):
        image, size = conversion.prepare(self.profile["recipes"][0])
        cottage, _ = conversion.convert(image, size, "box", self.profile, "cottage")
        scene = conversion.ground_scene(cottage, self.profile)
        spec = self.profile["scene"]
        crops = [scene.crop((x, spec["cottageBaseY"]-44, x+84, spec["cottageBaseY"])).tobytes() for x in spec["cottageX"]]
        self.assertTrue(all(c == crops[0] for c in crops))
        rice = np.array(scene)[spec["riceTop"]:spec["riceBottom"]]
        sky = conversion.rgb(self.profile["palette"]["sky"])
        self.assertFalse((rice == sky).all(2).any())
        self.assertGreater(len(np.unique(rice.reshape(-1, 3), axis=0)), 3)

    def test_gap_in_configuration_is_rejected(self):
        self.profile["scene"]["riceTop"] += 2
        with self.assertRaises(ValueError):
            conversion.validate_profile(self.profile)

    def test_converter_refuses_protected_art_even_under_renamed_recipe(self):
        for source_hash in conversion.PROTECTED_HASHES:
            recipe = dict(self.profile["recipes"][0], sha256=source_hash, id="renamed")
            with self.assertRaisesRegex(ValueError, "protected"):
                conversion.prepare(recipe)
        for subset in ("cloud", "flower"):
            with self.assertRaisesRegex(ValueError, "protected"):
                conversion.prepare(dict(self.profile["recipes"][0], subset=subset))

    def test_daylight_preserves_every_index_and_alpha_while_brightening(self):
        image, size = conversion.prepare(self.profile["recipes"][0])
        original, _ = conversion.convert(image, size, "box", self.profile, "cottage")
        sunny = conversion.daylight_cottage(original, self.profile)
        self.assertEqual(original.tobytes(), sunny.tobytes())
        self.assertEqual(original.convert("RGBA").getchannel("A").tobytes(), sunny.convert("RGBA").getchannel("A").tobytes())
        a, b = np.array(original.convert("RGBA")), np.array(sunny.convert("RGBA"))
        self.assertGreater(b[a[:,:,3]>0,:3].mean(), a[a[:,:,3]>0,:3].mean())

    def test_dense_cottage_placements_rejected(self):
        self.profile["scene"]["cottageX"]=[55,155]
        with self.assertRaisesRegex(ValueError, "sparse"):
            conversion.validate_profile(self.profile)

    def test_mountain_source_skyline_and_four_tone_contract(self):
        recipe=json.loads((conversion.ROOT/'rules/mountain-photo.json').read_text(encoding='utf-8'))
        path=conversion.ROOT/recipe['source']
        self.assertEqual(conversion.digest(path),recipe['sha256'])
        output,_,skyline=mountain.convert(Image.open(path),recipe)
        self.assertEqual(output.size,(480,143))
        # Land/sky brackets read from the source photograph, not from output masks.
        for x,lo,hi in ((0,1610,1670),(1000,1190,1240),(2304,1020,1080),(3300,1010,1060),(4607,1410,1460)):
            self.assertTrue(lo <= skyline[x]+950 <= hi)
        data=np.array(output.convert('RGBA'))
        self.assertEqual(set(np.unique(data[:,:,3])),{0,255})
        colors={tuple(c) for c in data[data[:,:,3]==255,:3]}
        self.assertEqual(colors,{conversion.rgb(c) for c in recipe['palette']})
        self.assertTrue((data[-1,:,3]==255).all())

    def test_mountain_color_cleanup_cannot_change_skyline(self):
        recipe=json.loads((conversion.ROOT/'rules/mountain-photo.json').read_text(encoding='utf-8'))
        photo=Image.open(conversion.ROOT/recipe['source'])
        first,_,_=mountain.convert(photo,recipe)
        recipe['toneMedianSize']=3;recipe['toneStops']=[40,55,80]
        second,_,_=mountain.convert(photo,recipe)
        self.assertEqual(first.convert('RGBA').getchannel('A').tobytes(),second.convert('RGBA').getchannel('A').tobytes())


if __name__ == "__main__":
    unittest.main()
