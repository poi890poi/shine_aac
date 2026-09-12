import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('play_notes', Path(__file__).with_name('play-release-notes.py'))
notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notes)


class PlayNotesTest(unittest.TestCase):
    def setUp(self):
        self.metadata = {'versionName': '0.5.0', 'versionCode': 63,
                         'notes': {'zh-TW': '改善設定。', 'en-IN': 'Improved Settings.'}}

    def render(self):
        return notes.render_notes(self.metadata, ('0.5.0', 63))

    def test_exact_console_payload(self):
        self.assertEqual(self.render(), '<zh-TW>\n改善設定。\n</zh-TW>\n<en-IN>\nImproved Settings.\n</en-IN>\n')

    def test_stale_version_name_and_code(self):
        for key, value in [('versionName', '0.4.1'), ('versionCode', 61)]:
            metadata = copy.deepcopy(self.metadata)
            metadata[key] = value
            with self.assertRaises(ValueError):
                notes.render_notes(metadata, ('0.5.0', 63))

    def test_unicode_boundary_and_overflow(self):
        self.metadata['notes']['zh-TW'] = '鳥' * 499 + '🐦'
        self.render()
        self.metadata['notes']['zh-TW'] += '。'
        with self.assertRaises(ValueError):
            self.render()

    def test_missing_extra_or_wrong_locale(self):
        for locales in [{'zh-TW': '內容'}, {'zh-TW': '內容', 'en-US': 'Text'},
                        {'zh-TW': '內容', 'en-IN': 'Text', 'ja-JP': 'Text'}]:
            self.metadata['notes'] = locales
            with self.assertRaises(ValueError):
                self.render()

    def test_empty_markdown_or_nested_tag(self):
        for body in ['', ' ', '# Changelog', 'Text\n```', '<en-US>Text</en-US>']:
            self.metadata['notes']['en-IN'] = body
            with self.assertRaises(ValueError):
                self.render()

    def test_repository_payload_matches_current_version(self):
        _, expected = notes.checked_notes()
        self.assertEqual((notes.ROOT / 'docs/PLAY_RELEASE_NOTES.md').read_text(encoding='utf-8'), expected)


if __name__ == '__main__':
    unittest.main()
