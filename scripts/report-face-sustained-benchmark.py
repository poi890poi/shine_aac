"""Report sustained single-model timing without inferring energy or thermal causation."""
import argparse
import json
import math
import pathlib
import statistics
import re


def distribution(values):
    if not values:
        return None
    values = sorted(values)
    def q(fraction): return values[max(0, math.ceil(fraction * len(values)) - 1)]
    return dict(n=len(values), mean=statistics.mean(values), p50=q(.5), p95=q(.95), p99=q(.99), max=values[-1])


def interval_overlap(first, second):
    """Intersection duration of two disjoint interval streams, in linear scan time."""
    first, second = sorted(first), sorted(second)
    i = j = 0
    overlap = 0.0
    while i < len(first) and j < len(second):
        a, b = first[i], second[j]
        overlap += max(0, min(a[1], b[1]) - max(a[0], b[0]))
        if a[1] <= b[1]: i += 1
        else: j += 1
    return overlap


def window(rows, start, end):
    selected = [r for r in rows if start <= r['captureMs'] < end and r['accepted']]
    return {'startMs': start, 'endMs': end, 'accepted': len(selected),
            'freshFps': len(selected) * 1000 / (end - start),
            'present': sum(r['present'] for r in selected),
            'ageMs': distribution([r['deliveredMs'] - r['captureMs'] for r in selected]),
            'nativeMs': distribution([r['inferenceEndMs'] - r['inferenceBeginMs'] for r in selected]),
            'prepareMs': distribution([r['prepareEndMs'] - r['prepareBeginMs'] for r in selected]),
            'freshGapMs': distribution([b['deliveredMs'] - a['deliveredMs'] for a, b in zip(selected, selected[1:])])}


def host_summary(records):
    sensors = {}
    displays = []
    charging = []
    for record in records:
        displays.extend(record.get('display', []))
        charging.extend(re.findall(r'(?m)^\s+status:\s*(\d+)', record.get('battery', '')))
        current = record.get('thermal', '').split('Current temperatures from HAL:')[-1].split('Current cooling devices')[0]
        for value, name in re.findall(r'Temperature\{mValue=([\d.]+), mType=-?\d+, mName=([^,]+), mStatus=\d+\}', current):
            sensors.setdefault(name.strip(), []).append(float(value))
    return {'samples': len(records), 'displayStates': sorted(set(displays)),
            'chargingStatusCodes': sorted(set(charging)),
            'errors': [r['error'] for r in records if r.get('error')],
            'aborted': [r['aborted'] for r in records if r.get('aborted')],
            'sensorsC': {name: {'first': values[0], 'last': values[-1], 'min': min(values), 'max': max(values)}
                         for name, values in sensors.items()}}


def foreground_control(raw, telemetry):
    result = summarize(raw, telemetry)
    reasons = []
    if raw.get('endingInteractive') is not True or not telemetry or any(r.get('interactive') is not True for r in telemetry):
        reasons.append('Continuous awake-screen evidence missing or false')
    if not telemetry or any(r.get('keyguardLocked') is not False or r.get('deviceLocked') is not False for r in telemetry):
        reasons.append('Unlocked-screen evidence missing or false')
    if raw.get('foregroundActivity') is True and raw.get('foregroundWindowFocusAfterWarmup') is not True:
        reasons.append('Foreground window focus unverified')
    if raw.get('controlKeepAwake') is True and raw.get('endingControlWakeLockHeld') is not True:
        reasons.append('Requested control wake lock was not retained through measurement')
    if (raw.get('primaryDelegate'), raw.get('mode'), raw.get('periodMs'), raw.get('frameWidth'), raw.get('cycles')) != ('GPU', 'serial', 66, 320, 1):
        reasons.append('Control configuration differs from contract')
    if not isinstance(raw.get('foregroundActivity'), bool): reasons.append('Foreground state unidentified')
    if not result['semanticCasesPassed']: reasons.append('Gesture cases failed')
    result.update(foregroundActivity=raw.get('foregroundActivity'), processCgroup=raw.get('processCgroup'),
                  controlKeepAwake=raw.get('controlKeepAwake', False),
                  comparisonUsable=not reasons, comparisonLimitations=reasons)
    return result


def summarize(raw, telemetry):
    rows = raw['samples']
    if len(rows) + raw['droppedRaw'] + raw['droppedPrepared'] != raw['inputFrames']:
        raise ValueError('Frames not conserved')
    if len({r['frame'] for r in rows}) != len(rows):
        raise ValueError('Duplicate frame identity')
    if {r['backend'] for r in rows} != {raw['primaryDelegate']}:
        raise ValueError('Actual backend differs from declared primary')
    newest = -1
    for row in rows:
        if row['accepted'] != (row['frame'] > newest): raise ValueError('Non-monotonic acceptance')
        if row['accepted']: newest = row['frame']
        elif row['events']: raise ValueError('Stale event')
    cases = []
    for case in raw['stimulusCases']:
        activations = [r for r in rows if r['accepted'] and 'Activated' in r['events']
                       and case['startMs'] <= r['captureMs'] < case['endMs']]
        cases.append(dict(case, observed=len(activations),
                          deliveryFromOnsetMs=[r['deliveredMs'] - case['startMs'] for r in activations]))
    matched = sum(c['observed'] for c in cases)
    all_activations = sum(r['events'].count('Activated') for r in rows)
    if matched != all_activations: raise ValueError('Unassigned or overlapping activation cases')
    cycle_ms = raw['cycleFrames'] * raw['periodMs']
    total_ms = cycle_ms * raw['cycles']
    # Same number of whole cycles and same stimulus phase in early/late windows.
    window_cycles = max(1, min(int(300000 // cycle_ms), raw['cycles'] // 2))
    length = window_cycles * cycle_ms
    early = window(rows, 0, length)
    late = window(rows, total_ms - length, total_ms)
    ratio = late['ageMs']['p95'] / early['ageMs']['p95'] if early['ageMs'] and late['ageMs'] else None
    headroom = [r['thermalHeadroom'] for r in telemetry if isinstance(r.get('thermalHeadroom'), (int, float))]
    temperatures = [r['batteryTemperatureTenthsC'] / 10 for r in telemetry
                    if isinstance(r.get('batteryTemperatureTenthsC'), (int, float)) and r['batteryTemperatureTenthsC'] >= 0]
    statuses = [r['thermalStatus'] for r in telemetry if isinstance(r.get('thermalStatus'), int)]
    return {'run': raw['run'], 'primaryDelegate': raw['primaryDelegate'], 'mode': raw['mode'],
            'durationSeconds': raw['elapsedMs'] / 1000, 'cycles': raw['cycles'],
            'inputFrames': raw['inputFrames'], 'accepted': sum(r['accepted'] for r in rows),
            'dropped': raw['droppedRaw'] + raw['droppedPrepared'], 'peakOwnedImages': raw['peakOwnedImages'],
            'processCpuMs': raw['processCpuMs'], 'cpuCoreEquivalent': raw['processCpuMs'] / raw['elapsedMs'],
            'retainedPreparationNativeCallOverlapMs': interval_overlap(
                [(r['prepareBeginMs'], r['prepareEndMs']) for r in rows],
                [(r['inferenceBeginMs'], r['inferenceEndMs']) for r in rows]),
            'preparationOverlapCoverage': 'complete' if raw['droppedPrepared'] == 0 else 'processed frames only; dropped preparation intervals unavailable',
            'caseCount': len(cases), 'expectedActivations': sum(c['expectedActivations'] for c in cases),
            'observedActivations': all_activations,
            'failedCases': [c for c in cases if c['observed'] != c['expectedActivations']],
            'activationDeliveryFromOnsetMs': distribution([v for c in cases for v in c['deliveryFromOnsetMs']]),
            'overall': window(rows, 0, total_ms), 'early': early, 'late': late,
            'lateEarlyP95Ratio': ratio, 'degradationFlag': ratio is not None and ratio > 1.10,
            'minuteWindows': [window(rows, start, min(start + 60000, total_ms)) for start in range(0, total_ms, 60000)],
            'telemetrySamples': len(telemetry), 'thermalStatusCounts': {str(s): statuses.count(s) for s in set(statuses)},
            'headroom': distribution(headroom), 'batteryTemperatureC': distribution(temperatures),
            'batteryTemperatureFirstLastC': [temperatures[0], temperatures[-1]] if temperatures else None,
            'chargingStates': sorted({r['plugged'] for r in telemetry if r.get('plugged') is not None}),
            'energyWh': None, 'energyLimitation': 'USB powered; battery counters do not measure device input power',
            'sustainedDurationCovered': raw['elapsedMs'] >= 1800000,
            'semanticCasesPassed': all(c['observed'] == c['expectedActivations'] for c in cases)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directories', nargs='+', type=pathlib.Path)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    args = parser.parse_args()
    reports = {}
    for directory in args.directories:
        paths = [p for p in directory.glob('prepared-66-*.json') if not p.name.endswith('-pixels.json')]
        if len(paths) != 1: raise ValueError('Expected exactly one completed run in ' + str(directory))
        raw = json.loads(paths[0].read_text(encoding='utf-8'))
        telemetry_path = directory / (raw['run'] + '-telemetry.jsonl')
        telemetry = [json.loads(line) for line in telemetry_path.read_text(encoding='utf-8').splitlines()]
        report = summarize(raw, telemetry)
        host_path = directory / (raw['run'] + '-host-telemetry.jsonl')
        report['hostTelemetry'] = host_summary([json.loads(line) for line in host_path.read_text(encoding='utf-8').splitlines()])
        report['cleanup'] = json.loads((directory / 'cleanup.json').read_text(encoding='utf-8'))
        report['preferenceVerification'] = json.loads((directory / 'preference-verification.json').read_text(encoding='utf-8'))
        reports[directory.name] = report
    args.output.write_text(json.dumps(reports, indent=2), encoding='utf-8')
