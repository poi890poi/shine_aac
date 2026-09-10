import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "device_acceptance_orientation", Path(__file__).with_name("device-acceptance-test.py"))
device = importlib.util.module_from_spec(spec)
spec.loader.exec_module(device)


class DeviceOrientationTest(unittest.TestCase):
    def test_landscape_control_is_found_and_portrait_is_restored(self):
        harness = object.__new__(device.DeepTest)
        harness.screen_w, harness.screen_h = 1200, 1920
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "screen.xml"
            path.write_text('<hierarchy><node bounds="[0,0][1920,1200]">'
                            '<node text="Start setup" clickable="true" enabled="true" '
                            'bounds="[1172,192][1646,264]"/></node></hierarchy>')
            self.assertIsNone(harness.find_node(path, ["Start setup"], visible_only=True))
            harness.sync_screen_orientation(path)
            self.assertIsNotNone(harness.find_node(path, ["Start setup"], visible_only=True))
            path.write_text('<hierarchy><node bounds="[0,0][1200,1920]"/></hierarchy>')
            harness.sync_screen_orientation(path)
            self.assertEqual((harness.screen_w, harness.screen_h), (1200, 1920))

    def test_exact_camera_control_does_not_tap_larger_sidebar_summary(self):
        harness = object.__new__(device.DeepTest)
        harness.screen_w, harness.screen_h = 1920, 1200
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "screen.xml"
            path.write_text('<hierarchy><node bounds="[0,0][1920,1200]">'
                            '<node text="Input source, Camera setup and input test" enabled="true" '
                            'bounds="[120,500][610,560]"/>'
                            '<node text="Camera setup" enabled="true" bounds="[760,398][920,437]"/>'
                            '</node></hierarchy>')
            wrong = harness.find_node(path, ["camera setup"], visible_only=True)
            self.assertTrue(wrong["text"].startswith("Input source"))
            right = harness.find_node(path, ["camera setup"], visible_only=True, exact=True)
            self.assertEqual("Camera setup", right["text"])

    def test_partial_dialog_and_malformed_dump_do_not_change_viewport(self):
        harness = object.__new__(device.DeepTest)
        harness.screen_w, harness.screen_h = 1920, 1200
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "screen.xml"
            for content in ['<hierarchy><node bounds="[0,0][900,600]"/></hierarchy>',
                            '<hierarchy><node bounds="[100,100][1200,1920]"/></hierarchy>',
                            '<hierarchy/>', 'incomplete']:
                path.write_text(content)
                harness.sync_screen_orientation(path)
                self.assertEqual((harness.screen_w, harness.screen_h), (1920, 1200))


if __name__ == "__main__":
    unittest.main()
