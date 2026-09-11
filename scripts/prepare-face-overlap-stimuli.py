"""Create a public, timed blink holdout for the test-only overlap benchmark."""
import argparse
import hashlib
import json
import math
import pathlib

import cv2
import numpy as np


def main(args):
    root = pathlib.Path(__file__).resolve().parents[1]
    sources = json.loads((root / 'testdata/optical-rig/sources.json').read_text(encoding='utf-8'))['sources']
    captures = {}
    for source in sources:
        path = root / 'testdata/optical-rig/downloaded' / source['filename']
        if hashlib.sha1(path.read_bytes()).hexdigest() != source['sha1']:
            raise ValueError('Public source checksum mismatch')
        captures[source['id']] = cv2.VideoCapture(str(path))
    args.output.mkdir(parents=True, exist_ok=False)
    frames, cases = [], []
    # Fixed before running candidates; no thresholds or poses selected from their outputs.
    segments = [('rest-1', 1000, 'commons_blinking', 750, 0),
                ('short-blink', 300, 'commons_blinking', 250, 0),
                ('rest-2', 1000, 'commons_blinking', 750, 0),
                ('long-blink-1', 1600, 'commons_blinking', 2000, 1),
                ('rest-3', 1000, 'commons_blinking', 750, 0),
                ('long-blink-2', 1600, 'commons_blinking', 3000, 1),
                ('rest-4', 1000, 'commons_blinking', 750, 0),
                ('smiling', 2000, 'commons_smiling', None, 0),
                ('surprised', 3000, 'commons_surprised', None, 0),
                ('frowning', 2400, 'commons_frowning', None, 0)]
    try:
        for name, duration, source_id, fixed_ms, expected in segments:
            start = len(frames) * args.period_ms
            for step in range(math.ceil(duration / args.period_ms)):
                source_ms = fixed_ms if fixed_ms is not None else step * args.period_ms
                capture = captures[source_id]
                capture.set(cv2.CAP_PROP_POS_MSEC, source_ms)
                ok, frame = capture.read()
                if not ok: raise ValueError('Public source decode failed')
                h, w = frame.shape[:2]
                scale = min(408 / w, 306 / h)
                scaled = cv2.resize(frame, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
                canvas = np.full((360, 480, 3), 128, dtype=np.uint8)
                sh, sw = scaled.shape[:2]
                canvas[(360-sh)//2:(360-sh)//2+sh, (480-sw)//2:(480-sw)//2+sw] = scaled
                filename = 'frame-%03d.png' % len(frames)
                if not cv2.imwrite(str(args.output / filename), canvas): raise IOError('PNG write failed')
                frames.append({'file': filename, 'sourceId': source_id, 'sourceMs': source_ms,
                               'sha256': hashlib.sha256((args.output / filename).read_bytes()).hexdigest()})
            cases.append({'id': name, 'startMs': start, 'endMs': len(frames)*args.period_ms,
                          'expectedActivations': expected})
    finally:
        for capture in captures.values(): capture.release()
    (args.output / 'manifest.json').write_text(json.dumps({
        'sourceManifest': 'testdata/optical-rig/sources.json', 'sources': sources,
        'periodMs': args.period_ms, 'expectedActivations': 2, 'cases': cases, 'frames': frames,
        'limitation': 'Timed public still/video sequence, not an independent person or optical activation test.'
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Generated %d public timed frames.' % len(frames))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--period-ms', type=int, choices=(66, 100), required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    main(parser.parse_args())
