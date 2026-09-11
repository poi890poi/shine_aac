"""Summarize retained per-frame telemetry without double-counting log snapshots."""
import argparse
import json
import math
import pathlib
import re
import statistics


def stats(values):
    if not values:
        return None
    ordered = sorted(values)
    return {'samples': len(values), 'mean': statistics.mean(values),
            'median': statistics.median(values),
            'p95': ordered[max(0, math.ceil(len(values) * .95) - 1)], 'max': ordered[-1]}


def optical(directory):
    # Case captures are epoch-stamped. Brief runtime-camera snapshots are
    # excluded because they cannot establish unique event identity reliably.
    lines = set(line.strip() for path in directory.glob('case-*.log')
                for line in path.read_text(encoding='utf-8').splitlines())
    groups = {}
    for line in lines:
        if not re.match(r'^\d+\.\d+\s+\d+\s+\d+\s+', line):
            continue
        if 'FACE_STAGE ' not in line and 'FACE_BLOCK ' not in line:
            continue
        fields = dict(re.findall(r'(\w+)=([^\s]+)', line))
        group = groups.setdefault(fields['backend'], {'stages': [], 'blocks': []})
        group['stages' if 'FACE_STAGE ' in line else 'blocks'].append(fields)
    result = {}
    for backend, group in groups.items():
        result[backend] = {
            'blockMs': stats([int(x['durationUs']) / 1000 for x in group['blocks']]),
            'frameAgeMs': stats([int(x['frameAgeMs']) for x in group['blocks']]),
            'dimensions': sorted(set((x['width'], x['height']) for x in group['stages'])),
            'stageSamples': len(group['stages']),
            'usableFrames': sum(x['usable'] == 'true' for x in group['stages']) if group['stages'] else None,
            'absentOrUnusableFrames': sum(x['usable'] == 'false' for x in group['stages']) if group['stages'] else None,
            'failedFrames': sum(x['usable'] == 'null' for x in group['stages']) if group['stages'] else None,
            'stageMs': {name: stats([int(x[name]) / 1000 for x in group['stages'] if name in x])
                        for name in ('copyUs', 'orientUs', 'wrapUs', 'inferenceUs', 'resultCleanupUs', 'totalUs')},
        }
    return {'directory': directory.name, 'backends': result}


def replay(directory):
    manifest = json.loads((directory / 'run-manifest.json').read_text(encoding='utf-8'))
    result = []
    samples = {}
    for run in manifest['runs']:
        raw = json.loads((directory / (run['run'] + '.json')).read_text(encoding='utf-8'))
        rows = raw['samples']
        samples[run['run']] = rows
        result.append({**run, 'initMs': raw['initMs'], 'latencyMs': stats([x['durationMs'] for x in rows]),
                       'present': sum(x['present'] for x in rows), 'usable': sum(x['usable'] for x in rows)})
    comparisons = []
    if manifest['runs']:
        first = manifest['runs'][0]['run']
        for run, rows in samples.items():
            if run == first:
                continue
            base = samples[first]
            if len(rows) != len(base):
                raise ValueError('Frame sequence differs')
            deltas, present_changes, usable_changes = [], 0, 0
            for left, right in zip(base, rows):
                if left['frame'] != right['frame']:
                    raise ValueError('Frame identity differs')
                present_changes += left['present'] != right['present']
                usable_changes += left['usable'] != right['usable']
                if left['present'] and right['present']:
                    deltas.extend(abs(value - right['blendshapes'][key]) for key, value in left['blendshapes'].items())
            comparisons.append({'baseline': first, 'candidate': run, 'presenceDisagreements': present_changes,
                                'usableDisagreements': usable_changes, 'absoluteScoreDifference': stats(deltas)})
    return {'serial': manifest['serial'], 'runs': result, 'comparisons': comparisons,
            'displayOff': manifest['displayOff'], 'frameManifestSha256': manifest['frameManifestSha256'],
            'interpretation': 'Numerical differences are not independent gesture accuracy.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--optical', action='append', type=pathlib.Path, default=[])
    parser.add_argument('--replay', action='append', type=pathlib.Path, default=[])
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    output = {'optical': [optical(p) for p in args.optical], 'replay': [replay(p) for p in args.replay]}
    args.output.write_text(json.dumps(output, indent=2), encoding='utf-8')
    print('Wrote benchmark aggregates to ' + str(args.output))
