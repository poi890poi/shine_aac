"""Run under the shared PowerShell device leases. Private snapshots stay ignored."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import time

from face_device_paths import private_output_path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = 'org.shineaac.app.preview'
SETTINGS = [('system', x) for x in ('screen_off_timeout', 'font_scale', 'accelerometer_rotation', 'user_rotation')] + [('global', 'stay_on_while_plugged_in')]

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--serial', action='append', required=True)
    p.add_argument('--dut', required=True)
    p.add_argument('--baseline-apk', type=Path, required=True)
    p.add_argument('--candidate', type=Path)
    p.add_argument('--grant-camera', action='store_true')
    p.add_argument('--telemetry', action='store_true')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('command', nargs=argparse.REMAINDER)
    a = p.parse_args()
    a.output = private_output_path(a.output)
    a.output.mkdir(parents=True, exist_ok=False)
    if a.dut not in a.serial: raise ValueError('DUT must be leased')
    adb = str(Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk/platform-tools/adb.exe')
    def call(serial, *args, **kwargs):
        result = subprocess.run([adb, '-s', serial] + list(args), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=kwargs.pop('timeout', 120), **kwargs)
        if result.returncode:
            raise RuntimeError('ADB operation failed: ' + result.stderr.decode('utf-8', errors='replace'))
        return result.stdout
    def shell(serial, *args): return call(serial, 'shell', *args).decode('utf-8', errors='strict').strip()
    def installed_hash():
        paths = shell(a.dut, 'pm', 'path', PACKAGE).splitlines()
        if len(paths) != 1 or not paths[0].startswith('package:/data/app/'): raise RuntimeError('Unexpected package path')
        path = paths[0][8:]
        return shell(a.dut, 'sha256sum', path).split()[0]
    def permission():
        dump = shell(a.dut, 'dumpsys', 'package', PACKAGE)
        hit = re.search(r'android.permission.CAMERA: granted=(true|false)', dump)
        if not hit: raise RuntimeError('Camera permission not observable')
        return hit.group(1) == 'true'
    def preferences():
        data = call(a.dut, 'exec-out', 'run-as', PACKAGE, 'tar', '-cf', '-', 'shared_prefs')
        values = {}
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            for item in archive.getmembers():
                if item.isfile():
                    if not re.fullmatch(r'shared_prefs/[A-Za-z0-9_.-]+', item.name): raise ValueError('Unexpected preference filename')
                    values[item.name] = archive.extractfile(item).read()
        return values
    baseline = a.baseline_apk.resolve()
    original_hash = installed_hash()
    if hashlib.sha256(baseline.read_bytes()).hexdigest() != original_hash: raise RuntimeError('Baseline APK mismatch')
    shell(a.dut, 'am', 'force-stop', PACKAGE)
    original_prefs = preferences()
    original_permission = permission()
    original_settings = {s: {(ns, key): shell(s, 'settings', 'get', ns, key) for ns, key in SETTINGS} for s in a.serial}
    for i, (name, data) in enumerate(original_prefs.items()):
        (a.output / ('private-pref-%d.xml' % i)).write_bytes(data)
    (a.output / 'private-snapshot.json').write_text(json.dumps({'preferences': list(original_prefs), 'settings': {s: {'/'.join(k): v for k,v in d.items()} for s,d in original_settings.items()}, 'cameraPermission': original_permission}), encoding='utf-8')
    result_code = 2
    stream = None
    stream_log = None
    stream_error = None
    cleanup = {'devices': {}, 'errors': []}
    try:
        if a.grant_camera and not original_permission:
            shell(a.dut, 'pm', 'grant', PACKAGE, 'android.permission.CAMERA')
        if a.candidate:
            call(a.dut, 'install', '-r', str(a.candidate.resolve()), timeout=240)
            if installed_hash() != hashlib.sha256(a.candidate.read_bytes()).hexdigest(): raise RuntimeError('Candidate APK verification failed')
        command = a.command[1:] if a.command and a.command[0] == '--' else a.command
        env = dict(os.environ, ANDROID_SERIAL=a.dut, SHINE_AAC_TEST_PACKAGE=PACKAGE, PYTHONUTF8='1', PYTHONUNBUFFERED='1')
        if a.telemetry:
            stream_log = (a.output / 'continuous-telemetry.log').open('wb')
            stream_error = (a.output / 'continuous-telemetry-stderr.log').open('wb')
            stream = subprocess.Popen([adb, '-s', a.dut, 'logcat', '-v', 'epoch', '-T', '1', 'ShineFaceAnalysis:I', 'ShineCameraSwitch:I', 'ShineAacE2E:I', '*:S'], stdout=stream_log, stderr=stream_error)
        with (a.output / 'command.log').open('wb') as log:
            result_code = subprocess.call(command, cwd=str(ROOT), env=env, stdout=log, stderr=subprocess.STDOUT)
    finally:
        def attempt(label, fn):
            try: return fn()
            except Exception as error:
                cleanup['errors'].append(label + ': ' + str(error))
        if stream:
            cleanup['telemetryStreamStayedAlive'] = stream.poll() is None
            if not cleanup['telemetryStreamStayedAlive']:
                cleanup['errors'].append('Continuous telemetry stream ended before the command completed')
            attempt('stop telemetry', stream.terminate)
            attempt('join telemetry', lambda: stream.wait(timeout=15))
        if stream_log: attempt('close telemetry file', stream_log.close)
        if stream_error: attempt('close telemetry error file', stream_error.close)
        attempt('stop DUT', lambda: shell(a.dut, 'am', 'force-stop', PACKAGE))
        if a.candidate:
            attempt('restore APK', lambda: call(a.dut, 'install', '-r', str(baseline), timeout=240))
            attempt('stop restored APK', lambda: shell(a.dut, 'am', 'force-stop', PACKAGE))
        def restore_prefs():
            current = preferences()
            for name in current:
                if name not in original_prefs: shell(a.dut, 'run-as', PACKAGE, 'rm', '-f', name)
            for i, name in enumerate(original_prefs):
                remote = '/data/local/tmp/shine-face-app-restore-%d.xml' % i
                call(a.dut, 'push', str(a.output / ('private-pref-%d.xml' % i)), remote)
                try: shell(a.dut, 'run-as', PACKAGE, 'cp', remote, name)
                finally: shell(a.dut, 'rm', '-f', remote)
            cleanup['preferencesExact'] = preferences() == original_prefs
            if not cleanup['preferencesExact']: raise RuntimeError('Preference mismatch')
        attempt('restore preferences', restore_prefs)
        def restore_permission():
            if permission() != original_permission:
                shell(a.dut, 'pm', 'grant' if original_permission else 'revoke', PACKAGE, 'android.permission.CAMERA')
            cleanup['cameraPermissionUnchanged'] = permission() == original_permission
        attempt('restore permission', restore_permission)
        cleanup['originalApkRestored'] = attempt('verify APK', installed_hash) == original_hash
        for serial in a.serial:
            def restore_settings(serial=serial):
                for (ns, key), value in original_settings[serial].items():
                    if value == 'null': shell(serial, 'settings', 'delete', ns, key)
                    else: shell(serial, 'settings', 'put', ns, key, value)
                return all(shell(serial, 'settings', 'get', ns, key) == value for (ns,key),value in original_settings[serial].items())
            exact = attempt('restore settings ' + serial, restore_settings)
            attempt('sleep ' + serial, lambda s=serial: shell(s, 'input', 'keyevent', '223'))
            time.sleep(1)
            def verify_off(serial=serial):
                power = shell(serial, 'dumpsys', 'power')
                display = shell(serial, 'dumpsys', 'display')
                wake = re.findall(r'mWakefulness=(\w+)', power)
                states = re.findall(r'mScreenState=(\w+)', display)
                off = bool(states) and all(x == 'OFF' for x in states) and 'Awake' not in wake
                return {'settingsExact': exact, 'wakefulness': wake, 'display': states, 'displayOff': off}
            cleanup['devices'][serial] = attempt('verify display ' + serial, verify_off)
        cleanup['commandExitCode'] = result_code
        cleanup['passed'] = not cleanup['errors'] and cleanup.get('preferencesExact') and cleanup.get('originalApkRestored') and cleanup.get('cameraPermissionUnchanged') and all(v and v['settingsExact'] and v['displayOff'] for v in cleanup['devices'].values())
        (a.output / 'cleanup.json').write_text(json.dumps(cleanup, indent=2), encoding='utf-8')
        print(json.dumps(cleanup, indent=2), flush=True)
    return result_code if cleanup['passed'] else 2

if __name__ == '__main__': sys.exit(main())
