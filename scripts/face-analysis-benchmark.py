"""Public-frame CPU/GPU ABBA benchmark. Run device commands inside the shared lease.

This measures bitmap-to-observation latency, not physical camera activation.
The independent optical-rig-test gate remains required for detector quality.
"""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACKAGE = 'org.shineaac.app.preview'


def prepare(output):
    import cv2
    import numpy as np
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'testdata/optical-rig/sources.json').read_text(encoding='utf-8'))
    frames = []
    for source in manifest['sources']:
        path = ROOT / 'testdata/optical-rig/downloaded' / source['filename']
        if hashlib.sha1(path.read_bytes()).hexdigest() != source['sha1']:
            raise ValueError('Public source checksum mismatch: ' + source['id'])
        if not all(source.get(key) for key in ('page', 'author', 'license')):
            raise ValueError('Public source provenance missing')
        capture = cv2.VideoCapture(str(path))
        try:
            for step in range(int(source['duration_s'] * 10)):
                capture.set(cv2.CAP_PROP_POS_MSEC, step * 100)
                ok, frame = capture.read()
                if not ok:
                    raise ValueError('Public source frame could not be decoded')
                h, w = frame.shape[:2]
                scale = min(408 / w, 306 / h)
                scaled = cv2.resize(frame, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
                canvas = np.full((360, 480, 3), 128, dtype=np.uint8)
                sh, sw = scaled.shape[:2]
                canvas[(360-sh)//2:(360-sh)//2+sh, (480-sw)//2:(480-sw)//2+sw] = scaled
                name = 'frame-%03d.png' % len(frames)
                if not cv2.imwrite(str(output / name), canvas):
                    raise RuntimeError('Could not write public frame')
                frames.append({'file': name, 'sourceId': source['id'], 'sourceMs': step * 100,
                               'sha256': hashlib.sha256((output / name).read_bytes()).hexdigest()})
        finally:
            capture.release()
    (output / 'manifest.json').write_text(json.dumps({
        'sourceManifest': 'testdata/optical-rig/sources.json',
        'sources': manifest['sources'], 'frames': frames
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Prepared %d checksum-verified public frames' % len(frames))


def cleanup_device(adb, record):
    # A failed force-stop must not bypass the display-off attempt/readback.
    try:
        adb('shell', 'am', 'force-stop', PACKAGE)
    finally:
        try:
            adb('shell', 'input', 'keyevent', '223')
        finally:
            time.sleep(1)
            off = b'mScreenState=OFF' in adb('shell', 'dumpsys', 'display')
            record(off)
            if not off:
                raise RuntimeError('Final display OFF not verified')


def run(args):
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    def adb(*commands):
        result = subprocess.run([args.adb, '-s', args.serial] + list(commands),
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=240)
        if result.returncode:
            raise RuntimeError(result.stdout.decode('utf-8', errors='replace'))
        return result.stdout
    manifest = json.loads((args.frames / 'manifest.json').read_text(encoding='utf-8'))
    declared = json.loads((ROOT / 'testdata/optical-rig/sources.json').read_text(encoding='utf-8'))
    if manifest['sources'] != declared['sources']:
        raise ValueError('Benchmark provenance differs from public source manifest')
    for frame in manifest['frames']:
        if hashlib.sha256((args.frames / frame['file']).read_bytes()).hexdigest() != frame['sha256']:
            raise ValueError('Benchmark frame checksum mismatch')
    records = []
    try:
        adb('install', '-r', str(args.test_apk.resolve()))
        adb('push', str(args.frames.resolve()), '/data/local/tmp/')
        for index, backend in enumerate(('cpu', 'gpu', 'gpu', 'cpu')):
            apk = args.cpu_apk if backend == 'cpu' else args.gpu_apk
            run_id = '%s-%d' % (backend, index + 1)
            adb('install', '-r', str(apk.resolve()))
            installed = adb('shell', 'pm', 'path', PACKAGE).decode('utf-8').strip().splitlines()[0]
            if not installed.startswith('package:/data/app/'):
                raise RuntimeError('Unexpected installed package path')
            actual_hash = adb('shell', 'sha256sum', installed[len('package:'):]).decode('utf-8').split()[0]
            expected_hash = hashlib.sha256(apk.read_bytes()).hexdigest()
            if actual_hash != expected_hash:
                raise RuntimeError('Installed artifact checksum differs')
            adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', 'cache/public-face-benchmark')
            adb('shell', 'run-as', PACKAGE, 'cp', '-R',
                '/data/local/tmp/' + args.frames.name + '/.', 'cache/public-face-benchmark/')
            adb('logcat', '-c')
            thermal = adb('shell', 'dumpsys', 'thermalservice')
            (output / (run_id + '-thermal-before.txt')).write_bytes(thermal)
            status = re.search(rb'Thermal Status:\s*(\d+)', thermal)
            if status and int(status.group(1)) >= 2:
                raise RuntimeError('Device is thermally throttled; stop comparison')
            adb('shell', 'input', 'keyevent', '224')
            result = adb('shell', 'am', 'instrument', '-w', '-r', '-e', 'class',
                         'org.shineaac.app.FaceBackendBenchmarkTest', '-e', 'benchmarkRun', run_id,
                         '-e', 'requestedBackend', backend,
                         PACKAGE + '.test/androidx.test.runner.AndroidJUnitRunner')
            (output / (run_id + '-instrumentation.txt')).write_bytes(result)
            logs = adb('logcat', '-d', '-v', 'epoch', 'ShineFaceAnalysis:I',
                       'tflite:I', 'libEGL:I', 'native:I', '*:S')
            (output / (run_id + '-backend.log')).write_bytes(logs)
            (output / (run_id + '-thermal-after.txt')).write_bytes(adb('shell', 'dumpsys', 'thermalservice'))
            if b'OK (1 test)' not in result:
                raise RuntimeError('Instrumentation failed: ' + run_id)
            data = adb('exec-out', 'run-as', PACKAGE, 'cat', 'cache/public-face-benchmark/' + run_id + '.json')
            (output / (run_id + '.json')).write_bytes(data)
            actual = ('actual=' + backend.upper()).encode('ascii')
            if actual not in logs or b'fallback=' in logs:
                raise RuntimeError('Requested backend not independently verified: ' + run_id)
            records.append({'run': run_id, 'backend': backend, 'apkSha256': expected_hash, 'installedHashVerified': True})
            adb('shell', 'input', 'keyevent', '223')
            time.sleep(1)
            if b'mScreenState=OFF' not in adb('shell', 'dumpsys', 'display'):
                raise RuntimeError('Display OFF not verified')
            print('PASS %s %s backend verified; display OFF' % (args.serial, run_id), flush=True)
    finally:
        def record_cleanup(off):
            (output / 'run-manifest.json').write_text(json.dumps({
                'serial': args.serial, 'runs': records, 'displayOff': off,
                'frameManifestSha256': hashlib.sha256((args.frames / 'manifest.json').read_bytes()).hexdigest()
            }, indent=2), encoding='utf-8')
        cleanup_device(adb, record_cleanup)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    prep = sub.add_parser('prepare')
    prep.add_argument('--output', type=pathlib.Path, required=True)
    bench = sub.add_parser('run')
    for option in ('frames', 'output', 'cpu-apk', 'gpu-apk', 'test-apk'):
        bench.add_argument('--' + option, type=pathlib.Path, required=True)
    bench.add_argument('--serial', required=True)
    bench.add_argument('--adb', default='E:/Android/Sdk/platform-tools/adb.exe')
    args = parser.parse_args()
    if args.command == 'prepare': prepare(args.output)
    else: run(args)
