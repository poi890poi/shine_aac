import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from android_apk import parse_device_abis, resolve_debug_apk


class AndroidApkResolutionTest(unittest.TestCase):
    def test_prefers_existing_universal_apk(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            universal = output / "app-debug.apk"
            universal.write_bytes(b"apk")
            self.assertEqual(universal, resolve_debug_apk(output, ["arm64-v8a"]))

    def test_selects_first_matching_device_abi_from_gradle_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            arm64 = output / "app-arm64-v8a-debug.apk"
            arm64.write_bytes(b"arm64")
            (output / "app-x86-debug.apk").write_bytes(b"x86")
            (output / "output-metadata.json").write_text(json.dumps({
                "elements": [
                    {
                        "filters": [{"filterType": "ABI", "value": "x86"}],
                        "outputFile": "app-x86-debug.apk",
                    },
                    {
                        "filters": [{"filterType": "ABI", "value": "arm64-v8a"}],
                        "outputFile": arm64.name,
                    },
                ],
            }), encoding="utf-8")

            resolved = resolve_debug_apk(output, ["arm64-v8a", "armeabi-v7a"])

            self.assertEqual(arm64, resolved)

    def test_parses_android_abi_list(self):
        self.assertEqual(
            ["arm64-v8a", "armeabi-v7a"],
            parse_device_abis("arm64-v8a,armeabi-v7a\n"),
        )


if __name__ == "__main__":
    unittest.main()
