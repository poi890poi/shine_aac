"""Continuous visible AAC camera workload, after the independent optical gates.

Run inside both Android device leases and the private state/APK restoration
envelope. This script never installs an APK or changes a detector default.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from types import SimpleNamespace

from face_visible_metrics import Evidence
from face_device_paths import private_output_path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = 'org.shineaac.app.preview'


def realtime_camera_clock(camera_dump, camera_id):
    sections = re.split(r'(?=== Camera HAL device )', camera_dump)
    selected = [section for section in sections if re.match(
        r'== Camera HAL device [^\n]*/' + re.escape(camera_id) +
        r'\s+\(v[^\n]+static information:', section)]
    return len(selected) == 1 and re.search(
        r'android\.sensor\.info\.timestampSource[^\n]*\s*\[\s*REALTIME\s*\]', selected[0]) is not None


def validate_observation(row, initial_pid):
    if (row['pid'] != initial_pid or not row['focused'] or
            row['wakefulness'] != ['Awake'] or not row['display'] or
            any(value != 'ON' for value in row['display'])):
        raise RuntimeError('Visible app / same-process / awake admission lost')
    if row['thermalStatus'] is None or row['batteryC'] is None:
        raise RuntimeError('Thermal evidence missing')
    if row['thermalStatus'] >= 2 or row['batteryC'] >= 42:
        raise RuntimeError('Thermal stop: session is incomplete, never paused')


def validate_starting_temperature(reference_c, actual_c):
    if actual_c is None or not all(math.isfinite(value) for value in (reference_c, actual_c)):
        raise RuntimeError('Starting battery temperature is missing or invalid')
    if abs(actual_c - reference_c) > 1:
        raise RuntimeError('Starting battery temperature differs from discovery by more than 1 C')


def load_rig():
    spec = importlib.util.spec_from_file_location('visible_optical_rig', ROOT / 'scripts/optical-rig-test.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dut-serial', required=True)
    parser.add_argument('--presenter-serial', required=True)
    parser.add_argument('--backend', choices=('CPU', 'GPU'), required=True)
    parser.add_argument('--seconds', type=int, required=True)
    parser.add_argument('--reference-battery-c', type=float, required=True,
                        help='DUT battery temperature recorded at campaign discovery; require within 1 C')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 60 <= args.seconds <= 3600 or args.seconds % 15:
        parser.error('seconds must be a multiple of 15 in [60, 3600]')
    if args.dut_serial == args.presenter_serial:
        parser.error('DUT and presenter must differ')
    if not math.isfinite(args.reference_battery_c):
        parser.error('reference battery temperature must be finite')
    if os.environ.get('SHINE_AAC_TEST_PACKAGE') != PACKAGE:
        parser.error('preview package environment is required')
    args.output = private_output_path(args.output)
    args.output.mkdir(parents=True, exist_ok=False)
    module = load_rig()
    adb = module.load_device_test_module().find_adb()
    rig_args = SimpleNamespace(
        dut_serial=args.dut_serial, presenter_serial=args.presenter_serial,
        presenter_mode='android', presenter_size=module.adb_display_size(adb, args.presenter_serial),
        presenter_apk=None, runtime_only=True, session_gesture='blink',
        calibrate_cheek_session=False, no_build=True, no_install=True,
        thermal_stop_status=2, thermal_hot_c=42.0, thermal_resume_c=38.0,
        thermal_stable_sec=30, leave_awake=False, trace_hold=False,
    )
    rig = module.OpticalRig(rig_args, args.output)
    pc = module.PcDisplayGuard()
    stream = None
    stream_out = None
    stream_err = None
    reader = None
    evidence = Evidence()
    observations = []
    trials = []
    result = {'completed': False, 'durationRequestedS': args.seconds, 'expectedBackend': args.backend}
    result['revision'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=str(ROOT)).decode().strip()
    result['toolSha256'] = {name: hashlib.sha256((ROOT / 'scripts' / name).read_bytes()).hexdigest()
                           for name in ('face-visible-session.py', 'face_visible_metrics.py',
                                        'face_device_paths.py', 'face-device-session-guard.py',
                                        'optical-rig-test.py')}
    prefs_saved = False
    setup_guard = False
    timed_started = None
    initial_pid = None

    def shell(*command):
        response = rig.device.shell(*command, check=True, timeout=30)
        return response.stdout or ''

    def collect(require_alive=True):
        if require_alive and stream.poll() is not None:
            raise RuntimeError('Continuous telemetry stream ended unexpectedly')
        # readlines on an ordinary file retains complete logcat line boundaries;
        # defer a partial trailing line until its newline reaches the file.
        while True:
            position = reader.tell()
            line = reader.readline()
            if not line:
                break
            if not line.endswith('\n'):
                reader.seek(position)
                break
            evidence.ingest(line)

    def monitor(label):
        collect()
        pid = shell('pidof', PACKAGE).strip()
        window = shell('dumpsys', 'window', 'windows')
        focus = [line.strip() for line in window.splitlines() if 'mCurrentFocus=' in line]
        power = shell('dumpsys', 'power')
        wake = re.findall(r'mWakefulness=(\w+)', power)
        display = re.findall(r'mScreenState=(\w+)', shell('dumpsys', 'display'))
        thermal = shell('dumpsys', 'thermalservice')
        battery = shell('dumpsys', 'battery')
        status = re.search(r'Thermal Status:\s*(\d+)', thermal)
        temperature = re.search(r'temperature:\s*(-?\d+)', battery)
        row = dict(label=label, hostMonotonicS=time.monotonic(), pid=pid,
                   focused=any(PACKAGE in value and 'MainActivity' in value for value in focus),
                   wakefulness=wake, display=display,
                   thermalStatus=int(status.group(1)) if status else None,
                   batteryC=int(temperature.group(1)) / 10 if temperature else None,
                   stageFrames=len(evidence.stages), activations=len(evidence.activations))
        index = len(observations)
        (args.output / ('thermal-%03d.txt' % index)).write_text(thermal, encoding='utf-8')
        observations.append(row)
        (args.output / 'observations.json').write_text(json.dumps(observations, indent=2), encoding='utf-8')
        validate_observation(row, initial_pid)
        if evidence.fallback or any(pair != (args.backend, args.backend) for pair in evidence.backends):
            raise RuntimeError('Backend mismatch or fallback')
        if index % 4 == 0:
            (args.output / ('memory-%03d.txt' % index)).write_text(shell('dumpsys', 'meminfo', PACKAGE), encoding='utf-8')
            (args.output / ('cpu-%03d.txt' % index)).write_text(shell('run-as', PACKAGE, 'cat', '/proc/' + pid + '/stat'), encoding='utf-8')

    try:
        pc.start(require_display=False)
        # Both leases and the outer restoration envelope remain held. This is
        # before the timed experiment; a thermal stop never cools/resumes it.
        def device_shell(serial, *command):
            return subprocess.check_output([str(adb), '-s', serial, 'shell'] + list(command),
                                           timeout=30).decode('utf-8')
        for serial in (args.dut_serial, args.presenter_serial):
            device_shell(serial, 'input', 'keyevent', '223')
        time.sleep(1)
        cooldown_start = time.monotonic()
        cooldown = []
        for index in range(13):
            if index:
                time.sleep(max(0, cooldown_start + index * 15 - time.monotonic()))
            row = dict(elapsedS=time.monotonic() - cooldown_start, devices={})
            for serial in (args.dut_serial, args.presenter_serial):
                power = device_shell(serial, 'dumpsys', 'power')
                display = re.findall(r'mScreenState=(\w+)', device_shell(serial, 'dumpsys', 'display'))
                row['devices'][serial] = dict(wakefulness=re.findall(r'mWakefulness=(\w+)', power), display=display)
                if 'Awake' in row['devices'][serial]['wakefulness'] or not display or any(value != 'OFF' for value in display):
                    raise RuntimeError('Display-off cooldown admission lost')
            cooldown.append(row)
            (args.output / 'cooldown.json').write_text(json.dumps(cooldown, indent=2), encoding='utf-8')
            if index % 4 == 0:
                print('Display-off cooldown: %d/180s' % (index * 15), flush=True)
        temperature = re.search(r'temperature:\s*(-?\d+)', shell('dumpsys', 'battery'))
        actual_c = int(temperature.group(1)) / 10 if temperature else None
        result['startingTemperature'] = dict(referenceC=args.reference_battery_c, measuredC=actual_c)
        validate_starting_temperature(args.reference_battery_c, actual_c)
        manifest = rig.ensure_stimuli()
        sources = {source['id']: source for source in manifest['sources']}
        if not rig.start_host(sources): raise RuntimeError('Presenter admission failed')
        if not rig.prepare_test_apk(): raise RuntimeError('Device power guard failed')
        setup_guard = True
        if not rig.preserve_camera_preferences(): raise RuntimeError('Preferences not preserved')
        prefs_saved = True
        fixture = rig.apply_session_calibration('blink')
        if not fixture: raise RuntimeError('No valid calibrated fixture')
        rig.active_zoom_ratio = float(fixture['zoom_ratio'])
        if not rig.install_demo_profile(): raise RuntimeError('Visible AAC demo profile failed')
        if not rig.verify_runtime_camera_selection(): raise RuntimeError('Runtime camera differs from calibration')
        source = sources['commons_blinking']
        result['source'] = source
        result['gesture'] = 'long-blink'
        result['expectedAnalysisIntervalMs'] = 100
        result['fixtureSha256'] = hashlib.sha256((module.SESSION_ROOT / 'blink-preferences.xml').read_bytes()).hexdigest()
        result['geometry'] = fixture
        apk_paths = shell('pm', 'path', PACKAGE).strip().splitlines()
        if len(apk_paths) != 1 or not apk_paths[0].startswith('package:/data/app/'):
            raise RuntimeError('Installed APK identity is ambiguous')
        result['installedApkSha256'] = shell('sha256sum', apk_paths[0][8:]).split()[0]
        result['device'] = {key: shell('getprop', key).strip() for key in
                            ('ro.product.model', 'ro.hardware', 'ro.build.version.release', 'ro.build.fingerprint')}
        if not rig.show_video_still(source, .75, 'CONTINUOUS WARMUP'): raise RuntimeError('Warmup face not visible')
        time.sleep(30)
        initial_pid = shell('pidof', PACKAGE).strip()
        if not re.fullmatch(r'\d+', initial_pid): raise RuntimeError('No unique app PID')
        initial_log = rig.runtime_log()
        proof = Evidence()
        proof.ingest(initial_log)
        if proof.backends != {(args.backend, args.backend)} or proof.fallback:
            raise RuntimeError('Actual backend not proven before timed session')
        if any(row['event'].get('source') == 'android-camera-long-blink' for row in proof.activations.values()):
            raise RuntimeError('False activation during relaxed-face warmup')
        # Keep only backend proof in the timed accounting, not warmup frames.
        evidence.backends = set(proof.backends)
        (args.output / 'warmup.log').write_text(initial_log, encoding='utf-8')
        latest_backend = max(proof.backend_events, key=lambda event: proof.backend_events[event]['epoch'])
        owner = re.match(r'^\s*\d+\.\d+\s+(\d+)\s+(\d+)\s+', latest_backend)
        if owner.group(1) != initial_pid: raise RuntimeError('Backend proof belongs to another process')
        tid = owner.group(2)
        (args.output / ('owner-' + tid + '-cgroup.txt')).write_text(
            shell('run-as', PACKAGE, 'cat', '/proc/' + initial_pid + '/task/' + tid + '/cgroup'), encoding='utf-8')
        (args.output / 'process-cgroup.txt').write_text(
            shell('run-as', PACKAGE, 'cat', '/proc/' + initial_pid + '/cgroup'), encoding='utf-8')
        camera = shell('dumpsys', 'media.camera')
        (args.output / 'camera-metadata.txt').write_text(camera, encoding='utf-8')
        clock_verified = realtime_camera_clock(camera, fixture['selected_camera_id'])
        result['cameraClockVerified'] = clock_verified
        if not clock_verified: raise RuntimeError('Selected camera timestamp clock is not independently verified')
        rig.device.screenshot('visible_session_before')
        shell('dumpsys', 'gfxinfo', PACKAGE, 'reset')
        telemetry_path = args.output / 'continuous-telemetry.log'
        stream_out = telemetry_path.open('wb')
        stream_err = (args.output / 'continuous-telemetry-stderr.log').open('wb')
        # Include overlap to retain pairs straddling stream startup. The final
        # completion-time window excludes these warmup samples from metrics.
        device_time = shell('date', '+%s.%N').strip()
        stream = subprocess.Popen([str(adb), '-s', args.dut_serial, 'logcat', '-v', 'epoch', '-T', '%.6f' % (float(device_time) - 10), 'ShineFaceAnalysis:I', 'ShineCameraSwitch:I', 'ShineAacE2E:I', '*:S'], stdout=stream_out, stderr=stream_err)
        reader = telemetry_path.open('r', encoding='utf-8')
        time.sleep(.3)
        monitor('before')
        result['deviceStartEpochS'] = float(shell('date', '+%s.%N').strip())
        timed_started = time.monotonic()
        result['startedEpochS'] = time.time()
        # Fixed 15-second cycles: deliberate five-second closures alternate
        # with 350-ms ordinary-blink controls. No retries or feedback-adaptive
        # stimulus timing; the same public poses and schedule serve each APK.
        for index in range(args.seconds // 15):
            cycle_start = timed_started + index * 15
            collect()
            before = len(evidence.activations)
            positive = index % 2 == 0
            closed_ms = 5000 if positive else 350
            pose = (0.25, 2.0, 3.0)[(index // 2) % 3]
            trial = dict(index=index, positive=positive, sourcePoseS=pose, expectedActivations=int(positive), requestedClosedMs=closed_ms)
            token = rig.show_video_still(source, pose, 'FIXED BLINK %03d' % index)
            if not token: raise RuntimeError('Closed pose was not acknowledged')
            trial['presenterToken'] = token
            trial['closedAcknowledgedMonotonicS'] = time.monotonic()
            time.sleep(closed_ms / 1000)
            if not rig.show_video_still(source, .75, 'FIXED REST %03d' % index): raise RuntimeError('Open pose was not acknowledged')
            trial['openAcknowledgedMonotonicS'] = time.monotonic()
            # Keep diagnostics in the long rest interval and retain the fixed
            # cycle deadline; never extend a closure until the app succeeds.
            monitor('cycle-%03d' % index)
            remaining = cycle_start + 15 - time.monotonic()
            if remaining < 0: raise RuntimeError('Host missed a fixed stimulus cycle deadline')
            time.sleep(remaining)
            collect()
            trial['observedActivations'] = len(evidence.activations) - before
            trial['completedMonotonicS'] = time.monotonic()
            trials.append(trial)
            (args.output / 'trials.json').write_text(json.dumps(trials, indent=2), encoding='utf-8')
            if trial['observedActivations'] != trial['expectedActivations']:
                raise RuntimeError('Fixed optical trial activation count failed at cycle %d' % index)
            if index % 4 == 3:
                print('Visible session %s: %d/%ds; %d classifier frames; %d activations' % (args.backend, (index + 1)*15, args.seconds, len(evidence.stages), len(evidence.activations)), flush=True)
        result['elapsedS'] = time.monotonic() - timed_started
        result['deviceEndEpochS'] = float(shell('date', '+%s.%N').strip())
        monitor('after')
        result['completed'] = True
    except Exception as error:
        result['failure'] = str(error)
        print('INCOMPLETE:', error, flush=True)
    finally:
        cleanup_errors = []
        def cleanup(label, action):
            try: action()
            except Exception as error: cleanup_errors.append(label + ': ' + str(error))
        if timed_started is not None:
            result.setdefault('elapsedS', time.monotonic() - timed_started)
            if 'deviceEndEpochS' not in result:
                cleanup('end clock', lambda: result.update(deviceEndEpochS=float(shell('date', '+%s.%N').strip())))
            cleanup('final gfxinfo', lambda: (args.output / 'gfxinfo-final.txt').write_text(shell('dumpsys', 'gfxinfo', PACKAGE), encoding='utf-8'))
            cleanup('final screenshot', lambda: rig.device.screenshot('visible_session_after'))
        if stream:
            cleanup('telemetry final read', collect)
            cleanup('stop telemetry', stream.terminate)
            cleanup('join telemetry', lambda: stream.wait(timeout=15))
            cleanup('drain telemetry', lambda: collect(require_alive=False))
        for handle in (reader, stream_out, stream_err):
            if handle: cleanup('close file', handle.close)
        def summarize():
            timed_evidence = evidence.window(result['deviceStartEpochS'], result['deviceEndEpochS']) if 'deviceStartEpochS' in result and 'deviceEndEpochS' in result else evidence
            result['metrics'] = timed_evidence.summary(args.backend, result.get('cameraClockVerified', False))
            if result['metrics']['backendInitializations'] or result['metrics']['cameraBinds']:
                result['metrics']['evidenceErrors'].append('camera or native backend restarted during timed session')
            result['completed'] = result['completed'] and not result['metrics']['evidenceErrors']
        cleanup('metrics summary', summarize)
        cleanup('demo profile', rig.restore_demo_profile)
        cleanup('presenter', rig.host.close)
        if prefs_saved: cleanup('camera preferences', rig.restore_camera_preferences)
        if setup_guard: cleanup('power settings', rig.device.restore_power_guard)
        cleanup('DUT display off', lambda: shell('input', 'keyevent', '223'))
        cleanup('PC power state', pc.restore)
        result['cleanupErrors'] = cleanup_errors
        result['completed'] = result['completed'] and not cleanup_errors
        (args.output / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return 0 if result['completed'] else 2


if __name__ == '__main__': sys.exit(main())
