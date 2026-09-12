"""Prepare a Google Play handoff from the already verified signed release bundle."""
import argparse
import hashlib
import importlib.util
from pathlib import Path
import shutil
import zipfile

spec = importlib.util.spec_from_file_location('play_notes', Path(__file__).with_name('play-release-notes.py'))
notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notes)


def prepare(release, delivery, metadata, expected_notes):
    name = 'shine-aac-v{}-code{}-release.aab'.format(metadata['versionName'], metadata['versionCode'])
    bundle = release / name
    checksum = (release / 'PLAY_AAB_SHA256SUMS.txt').read_text(encoding='ascii').split()
    if len(checksum) != 2 or checksum[1] != name:
        raise ValueError('Play checksum must identify the current versioned AAB')
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != checksum[0]:
        raise ValueError('Play AAB checksum mismatch')
    with zipfile.ZipFile(bundle) as z:
        if not {'BundleConfig.pb', 'base/manifest/AndroidManifest.xml'} <= set(z.namelist()):
            raise ValueError('Play delivery requires an Android App Bundle, not an APK')
    if (release / 'PLAY_RELEASE_NOTES.txt').read_text(encoding='utf-8') != expected_notes:
        raise ValueError('Packaged Play notes differ from the validated current notes')
    delivery.mkdir(parents=True, exist_ok=True)
    for file in [name, 'PLAY_RELEASE_NOTES.txt', 'PLAY_AAB_SHA256SUMS.txt']:
        shutil.copyfile(release / file, delivery / file)
    archive_name = name.replace('-release.aab', '-play.zip')
    with zipfile.ZipFile(delivery / archive_name, 'w', zipfile.ZIP_DEFLATED) as z:
        for file in [name, 'PLAY_RELEASE_NOTES.txt', 'PLAY_AAB_SHA256SUMS.txt']:
            z.write(delivery / file, file)
    (delivery / 'index.html').write_text('''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SHINE AAC Google Play handoff</title>
<style>body{{font:20px system-ui;max-width:700px;margin:40px auto;padding:24px;line-height:1.6}}a{{display:block;padding:16px;margin:18px 0;border:2px solid #3464ad;border-radius:10px}}</style>
<h1>SHINE AAC {version} — Google Play</h1><p>Version code {code}. Upload the signed AAB to Play Console Internal testing. Paste the separate bilingual notes into the release notes field.</p>
<a href="{bundle}" download>Signed AAB — Google Play upload</a>
<a href="{archive}" download>Play ZIP — AAB, release notes and checksum</a>
<a href="PLAY_RELEASE_NOTES.txt?encoding=utf8">Release notes — ready to paste</a>
<a href="PLAY_AAB_SHA256SUMS.txt">AAB SHA-256 checksum</a>
<p>Prepared for upload. Play Console acceptance and rollout have not been verified.</p></html>
'''.format(version=metadata['versionName'], code=metadata['versionCode'], bundle=name, archive=archive_name), encoding='utf-8')
    return name, archive_name


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--release-dir', type=Path, required=True)
    parser.add_argument('--delivery-dir', type=Path, required=True)
    args = parser.parse_args()
    metadata, expected = notes.checked_notes()
    print('PLAY HANDOFF PASS: ' + ', '.join(prepare(args.release_dir, args.delivery_dir, metadata, expected)))
