import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("device-native-settings-audit.py")
SPEC = importlib.util.spec_from_file_location("device_native_settings_audit", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReleaseVersionTest(unittest.TestCase):
    def test_reads_current_version_without_hard_coding_a_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            properties = Path(directory) / "version.properties"
            properties.write_text(
                "versionName=1.2.3\nversionCode=456\n",
                encoding="utf-8",
            )
            self.assertEqual(("1.2.3", "456"), MODULE.release_version(properties))

    def test_rejects_incomplete_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            properties = Path(directory) / "version.properties"
            properties.write_text("versionName=1.2.3\n", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                MODULE.release_version(properties)


if __name__ == "__main__":
    unittest.main()
