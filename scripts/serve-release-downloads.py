"""Serve an explicit artifact directory on loopback with declared text encoding."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class Downloads(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        mime = super().guess_type(path)
        if mime.startswith('text/') or mime == 'application/json':
            return mime + '; charset=utf-8'
        return mime

    def end_headers(self):
        if urlsplit(self.path).path.endswith(('.apk', '.zip', '.aab')):
            self.send_header('Content-Disposition', 'attachment')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--port-file', type=Path)
    args = parser.parse_args()
    root = args.directory.resolve(strict=True)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Downloads, directory=str(root)))
    if args.port_file:
        args.port_file.write_text(str(server.server_port), encoding='ascii')
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
