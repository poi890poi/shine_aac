import importlib.util
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.request import urlopen
import unittest

spec = importlib.util.spec_from_file_location('downloads', Path(__file__).with_name('serve-release-downloads.py'))
downloads = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downloads)


class DownloadEncodingTest(unittest.TestCase):
    def test_http_text_decodes_without_guessing_and_binary_is_unchanged(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            text = '<zh-TW>\n改善平板與花園。\n</zh-TW>\n'
            (root / 'PLAY_RELEASE_NOTES.txt').write_bytes(text.encode('utf-8'))
            binary = bytes(range(256))
            (root / 'app.apk').write_bytes(binary)
            server = ThreadingHTTPServer(('127.0.0.1', 0), partial(downloads.Downloads, directory=directory))
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                base = 'http://127.0.0.1:' + str(server.server_port)
                with urlopen(base + '/PLAY_RELEASE_NOTES.txt?v=2') as response:
                    self.assertEqual(response.headers.get_content_charset(), 'utf-8')
                    self.assertEqual(response.read().decode(response.headers.get_content_charset()), text)
                    self.assertEqual(response.headers['Cache-Control'], 'no-store')
                with urlopen(base + '/app.apk?v=2') as response:
                    self.assertIsNone(response.headers.get_content_charset())
                    self.assertEqual(response.headers['Content-Disposition'], 'attachment')
                    self.assertEqual(response.read(), binary)
            finally:
                server.shutdown()
                server.server_close()
                worker.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
