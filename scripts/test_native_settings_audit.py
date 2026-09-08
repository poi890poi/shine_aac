import importlib.util
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path


SCRIPT = Path(__file__).with_name("device-native-settings-audit.py")
SPEC = importlib.util.spec_from_file_location("device_native_settings_audit", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReleaseVersionTest(unittest.TestCase):
    def test_failed_audit_still_sleeps_and_verifies_the_device(self):
        class FakeAudit:
            findings = []
            commands = []
            def run(self): raise RuntimeError("test interruption")
            def add(self, priority, title, detail): self.findings.append({"priority":priority})
            def passed(self, *args): pass
            def write_report(self): pass
            def shell(self, *args, **kwargs):
                self.commands.append(args)
                return "mScreenState=OFF" if args == ("dumpsys", "display") else ""
        fake = FakeAudit()
        with patch.object(MODULE, "NativeSettingsAudit", return_value=fake), patch.object(MODULE.time,"sleep"):
            self.assertEqual(1, MODULE.main())
        self.assertEqual([("input","keyevent","223"),("dumpsys","display")],fake.commands)
    def test_duplicate_category_title_does_not_hide_detail_action(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "two-panes.xml"
            path.write_text('<hierarchy><node resource-id="org.shineaac.app.preview:id/settings_categories">'
                '<node text="語音" bounds="[0,0][400,100]"/></node>'
                '<node resource-id="org.shineaac.app.preview:id/settings_container">'
                '<node text="語音" bounds="[400,0][1200,100]"/></node></hierarchy>', encoding="utf-8")
            audit = MODULE.NativeSettingsAudit.__new__(MODULE.NativeSettingsAudit)
            nodes = [node for node in audit.nodes(path, "container") if node.get("text") == "語音"]
            self.assertEqual(1, len(nodes))
            self.assertEqual((400, 0, 1200, 100), nodes[0]["bounds_value"])
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
