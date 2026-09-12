import hashlib
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('play_downloads', Path(__file__).with_name('prepare-play-downloads.py'))
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)


class PlayHandoffTest(unittest.TestCase):
    def test_bundle_handoff_and_reject_wrong_binary_stale_notes_or_hash(self):
        metadata = {'versionName': '0.5.0', 'versionCode': 63}
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'source'
            source.mkdir()
            target = root / 'delivery'
            name = 'shine-aac-v0.5.0-code63-release.aab'
            def artifact(entries):
                with zipfile.ZipFile(source / name, 'w') as z:
                    for entry in entries:
                        z.writestr(entry, b'test')
                digest = hashlib.sha256((source / name).read_bytes()).hexdigest()
                (source / 'PLAY_AAB_SHA256SUMS.txt').write_text(digest + '  ' + name, encoding='ascii')
            expected = '<zh-TW>\n改善設定\n</zh-TW>\n'
            (source / 'PLAY_RELEASE_NOTES.txt').write_text(expected, encoding='utf-8')
            # A renamed APK must not pass as a release bundle, even with a valid hash.
            artifact(['AndroidManifest.xml', 'classes.dex'])
            with self.assertRaisesRegex(ValueError, 'not an APK'):
                delivery.prepare(source, target, metadata, expected)
            artifact(['BundleConfig.pb', 'base/manifest/AndroidManifest.xml'])
            _, archive = delivery.prepare(source, target, metadata, expected)
            with zipfile.ZipFile(target / archive) as z:
                self.assertEqual(set(z.namelist()), {name, 'PLAY_RELEASE_NOTES.txt', 'PLAY_AAB_SHA256SUMS.txt'})
                self.assertEqual(z.read(name), (source / name).read_bytes())
            (source / 'PLAY_RELEASE_NOTES.txt').write_text('Old changelog', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'notes differ'):
                delivery.prepare(source, target, metadata, expected)
            (source / name).write_bytes(b'changed artifact')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                delivery.prepare(source, target, metadata, expected)


if __name__ == '__main__':
    unittest.main()
