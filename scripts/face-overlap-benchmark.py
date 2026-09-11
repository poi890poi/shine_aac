"""Run bounded overlap experiments inside the acknowledged shared Android lease.

Only the preview test APK is installed. The application APK and all user preferences
remain unchanged. Public fixture identities and installed artifact hashes are checked.
"""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACKAGE = 'org.shineaac.app.preview'


def normalized(text):
    return None if text is None else {e.attrib['name']: (e.tag, e.attrib.get('value'), e.text) for e in ET.fromstring(text)}


def run(args):
    args.output.mkdir(parents=True, exist_ok=False)
    def adb(*commands):
        r = subprocess.run([args.adb, '-s', args.serial] + list(commands), stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, timeout=180)
        if r.returncode: raise RuntimeError(r.stdout.decode('utf-8', errors='replace'))
        return r.stdout
    def prefs():
        values = {}
        for name in ('shine_aac_config', 'shine_aac_camera_switch'):
            r = subprocess.run([args.adb, '-s', args.serial, 'shell', 'run-as', PACKAGE, 'cat',
                                'shared_prefs/' + name + '.xml'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
            if r.returncode and b'No such file' not in r.stderr:
                raise RuntimeError('Cannot verify app preference state')
            values[name] = r.stdout.decode('utf-8') if r.returncode == 0 else None
        return values
    def permission():
        text = adb('shell', 'dumpsys', 'package', PACKAGE).decode('utf-8')
        rows = re.findall(r'android.permission.CAMERA: granted=[^\r\n]+', text)
        if len(rows) != 1: raise RuntimeError('Camera permission identity unavailable')
        return rows[0].strip()
    def sleep_device():
        try: adb('shell', 'am', 'force-stop', PACKAGE)
        finally:
            try: adb('shell', 'input', 'keyevent', '223')
            finally:
                time.sleep(2)
                display = adb('shell', 'dumpsys', 'display').decode('utf-8')
                power = adb('shell', 'dumpsys', 'power').decode('utf-8')
                states = re.findall(r'mScreenState=(\w+)', display)
                wake = re.findall(r'mWakefulness=(\w+)', power)
                state = {'display': states, 'wakefulness': wake}
                (args.output / 'cleanup.json').write_text(json.dumps(state, indent=2), encoding='utf-8')
                if not states or not all(x in ('OFF', 'DOZE_SUSPEND') for x in states) or not wake or wake[0] not in ('Asleep', 'Dozing'):
                    raise RuntimeError('Device sleep not verified: ' + str(state))
        return state
    def thermal(run_id, suffix):
        data = adb('shell', 'dumpsys', 'thermalservice')
        (args.output / (run_id + '-thermal-' + suffix + '.txt')).write_bytes(data)
        status = re.search(rb'Thermal Status:\s*(\d+)', data)
        if status is None or int(status.group(1)) >= 2:
            raise RuntimeError('Thermal status missing or elevated; comparison stopped')
    def installed_hash(package):
        path = adb('shell', 'pm', 'path', package).decode('utf-8').strip().splitlines()[0]
        if not path.startswith('package:/data/app/'): raise RuntimeError('Unexpected installed package path')
        return adb('shell', 'sha256sum', path[len('package:'):]).decode('utf-8').split()[0]
    manifest = json.loads((args.frames / 'manifest.json').read_text(encoding='utf-8'))
    declared = json.loads((ROOT / 'testdata/optical-rig/sources.json').read_text(encoding='utf-8'))
    if manifest['sources'] != declared['sources']: raise ValueError('Public provenance differs')
    for frame in manifest['frames']:
        if not re.fullmatch(r'frame-\d+\.png', frame['file']): raise ValueError('Invalid fixture filename')
        if hashlib.sha256((args.frames / frame['file']).read_bytes()).hexdigest() != frame['sha256']:
            raise ValueError('Public frame checksum mismatch')
    if 'periodMs' in manifest and manifest['periodMs'] != args.period_ms:
        raise ValueError('Timed stimulus cadence differs from benchmark cadence')
    original = prefs()
    original_permission = permission()
    (args.output / 'private-preferences-before.json').write_text(json.dumps(original), encoding='utf-8')
    app_hash = installed_hash(PACKAGE)
    if app_hash != hashlib.sha256(args.app_apk.read_bytes()).hexdigest(): raise RuntimeError('Installed app differs from the declared baseline')
    records = []
    try:
        adb('install', '-r', str(args.test_apk.resolve()))
        test_hash = installed_hash(PACKAGE + '.test')
        if test_hash != hashlib.sha256(args.test_apk.read_bytes()).hexdigest(): raise RuntimeError('Installed test APK differs')
        adb('push', str(args.frames.resolve()), '/data/local/tmp/')
        adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', 'cache/public-face-benchmark')
        adb('shell', 'run-as', PACKAGE, 'cp', '-R', '/data/local/tmp/' + args.frames.name + '/.', 'cache/public-face-benchmark/')
        candidate = args.candidate
        modes = ('serial', candidate, candidate, 'serial')
        for index, mode in enumerate(modes):
            run_id = '%s-%d-%s-%d' % (candidate, args.period_ms, mode, index + 1)
            # Failure evidence must belong to this attempt, never a previous fixture pack.
            adb('shell', 'run-as', PACKAGE, 'rm', '-f', 'cache/public-face-benchmark/' + run_id + '.json',
                'cache/public-face-benchmark/pixel-verification.json')
            thermal(run_id, 'before')
            adb('logcat', '-c')
            adb('shell', 'input', 'keyevent', '224')
            result = adb('shell', 'am', 'instrument', '-w', '-r', '-e', 'class',
                         'org.shineaac.app.FaceOverlapBenchmarkTest', '-e', 'overlapMode', mode,
                         '-e', 'periodMs', str(args.period_ms), '-e', 'frameWidth', str(args.frame_width), '-e', 'pairedModels', str(candidate == 'dual').lower(),
                         '-e', 'benchmarkRun', run_id, PACKAGE + '.test/androidx.test.runner.AndroidJUnitRunner')
            (args.output / (run_id + '-instrumentation.txt')).write_bytes(result)
            (args.output / (run_id + '-native.log')).write_bytes(adb('logcat', '-d', '-v', 'epoch', 'native:I', 'tflite:I', 'libEGL:I', '*:S'))
            pixel_check = adb('exec-out', 'run-as', PACKAGE, 'cat', 'cache/public-face-benchmark/pixel-verification.json')
            (args.output / (run_id + '-pixels.json')).write_bytes(pixel_check)
            saved = subprocess.run([args.adb, '-s', args.serial, 'exec-out', 'run-as', PACKAGE, 'cat', 'cache/public-face-benchmark/' + run_id + '.json'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
            if saved.returncode == 0: (args.output / (run_id + '.json')).write_bytes(saved.stdout)
            if b'OK (1 test)' not in result or b'INSTRUMENTATION_STATUS_CODE: -4' in result:
                raise RuntimeError('Overlap instrumentation failed: ' + run_id)
            data = adb('exec-out', 'run-as', PACKAGE, 'cat', 'cache/public-face-benchmark/' + run_id + '.json')
            (args.output / (run_id + '.json')).write_bytes(data)
            thermal(run_id, 'after')
            state = sleep_device()
            raw = json.loads(data)
            records.append({'run': run_id, 'mode': mode, 'testApkSha256': test_hash, 'sleepState': state})
            print('%s %s: processed=%d accepted=%d elapsed=%.1fms CPU=%dms peakImages=%d' %
                  (args.serial, run_id, len(raw['samples']), sum(x['accepted'] for x in raw['samples']),
                   raw['elapsedMs'], raw['processCpuMs'], raw['peakOwnedImages']), flush=True)
    finally:
        try:
            final = prefs()
            restored = {name: normalized(final[name]) == normalized(original[name]) for name in original}
            permission_same = permission() == original_permission
            (args.output / 'preference-verification.json').write_text(json.dumps({'preferences': restored, 'cameraPermissionUnchanged': permission_same}, indent=2), encoding='utf-8')
            if not all(restored.values()) or not permission_same: raise RuntimeError('Test changed device preferences/permission')
        finally:
            state = sleep_device()
            (args.output / 'run-manifest.json').write_text(json.dumps({'serial': args.serial,
                'appApkSha256': app_hash, 'frameManifestSha256': hashlib.sha256((args.frames / 'manifest.json').read_bytes()).hexdigest(),
                'runs': records, 'finalSleepState': state}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--candidate', choices=('prepared', 'dual'), required=True)
    parser.add_argument('--frame-width', type=int, choices=(320, 480), default=320)
    parser.add_argument('--period-ms', type=int, choices=(0, 33, 66, 100), required=True)
    for name in ('frames', 'app-apk', 'test-apk', 'output'): parser.add_argument('--' + name, type=pathlib.Path, required=True)
    parser.add_argument('--adb', default='E:/Android/Sdk/platform-tools/adb.exe')
    run(parser.parse_args())
