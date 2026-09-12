"""Validate and export the current Play Console notes, independently of changelogs."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ('zh-TW', 'en-IN')


def render_notes(metadata, version):
    if (metadata.get('versionName'), metadata.get('versionCode')) != version:
        raise ValueError('Play notes version must match version.properties')
    previous = metadata.get('previousRelease', '')
    if not isinstance(previous, str) or not re.fullmatch(r'\d+\.\d+\.\d+', previous) or tuple(map(int, previous.split('.'))) >= tuple(map(int, version[0].split('.'))):
        raise ValueError('Play notes must record an earlier release baseline')
    notes = metadata.get('notes', {})
    if set(notes) != set(LOCALES):
        raise ValueError('Play notes require the configured zh-TW and en-IN locales')
    blocks = []
    for locale in LOCALES:
        body = notes[locale]
        if not isinstance(body, str) or not body.strip() or body != body.strip():
            raise ValueError('Empty or padded notes for ' + locale)
        if len(body) > 500:
            raise ValueError('More than 500 Unicode characters for ' + locale)
        if any(c in body for c in '<>\r') or re.search(r'^\s*(?:#|```)', body, re.M):
            raise ValueError('Notes must be plain text without tags or Markdown headings')
        blocks.append('<{0}>\n{1}\n</{0}>'.format(locale, body))
    return '\n'.join(blocks) + '\n'


def checked_notes(root=ROOT):
    properties = dict(line.split('=', 1) for line in
                      (root / 'version.properties').read_text(encoding='utf-8').splitlines()
                      if '=' in line and not line.startswith('#'))
    metadata = json.loads((root / 'config/play-release-notes.json').read_text(encoding='utf-8'))
    expected = render_notes(metadata, (properties['versionName'], int(properties['versionCode'])))
    return metadata, expected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--output-dir', type=Path)
    args = parser.parse_args()
    metadata, expected = checked_notes()
    document = ROOT / 'docs/PLAY_RELEASE_NOTES.md'
    if args.write:
        document.write_text(expected, encoding='utf-8')
    if document.read_text(encoding='utf-8') != expected:
        raise ValueError('Play copy/paste notes are stale or contain extra text; run --write')
    if args.output_dir:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        (args.output_dir / 'PLAY_RELEASE_NOTES.txt').write_text(expected, encoding='utf-8')
    print('PLAY NOTES PASS v{} code{} since {}: {}'.format(metadata['versionName'], metadata['versionCode'], metadata['previousRelease'],
          ', '.join('{} {}/500'.format(locale, len(metadata['notes'][locale])) for locale in LOCALES)))


if __name__ == '__main__':
    main()
