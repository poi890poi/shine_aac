"""Aggregate bounded-overlap evidence; latency and freshness remain separate from throughput."""
import argparse
import json
import math
import pathlib
import statistics


def stats(values):
    if not values: return None
    values = sorted(values)
    return {'n': len(values), 'mean': statistics.mean(values), 'median': statistics.median(values),
            'p95': values[max(0, math.ceil(.95 * len(values)) - 1)], 'max': values[-1]}


def summarize(raw):
    rows = raw['samples']
    if len({x['frame'] for x in rows}) != len(rows): raise ValueError('Duplicate processed input')
    accepted, newest = [], -1
    for row in rows:
        if not row['accepted'] and row.get('events'): raise ValueError('Late result emitted a classifier event')
        should_accept = row['frame'] > newest
        if row['accepted'] != should_accept: raise ValueError('Output acceptance is not monotonic')
        if row['deliveredMs'] < row['completedMs']: raise ValueError('Delivery precedes completion')
        if should_accept:
            newest = row['frame']; accepted.append(row)
    if len(rows) + raw['droppedRaw'] + raw['droppedPrepared'] != raw['inputFrames']:
        raise ValueError('Input accounting does not conserve frames')
    def durations(items, end, begin): return stats([x[end] - x[begin] for x in items])
    absent_runs, run_start, longest_absence = 0, None, 0
    for row in accepted:
        if not row['present']:
            if run_start is None: absent_runs += 1; run_start = row['captureMs']
            longest_absence = max(longest_absence, row['captureMs'] - run_start)
        else: run_start = None
    events = [{'frame': row['frame'], 'captureMs': row['captureMs'], 'deliveredMs': row['deliveredMs'], 'event': event}
              for row in accepted for event in row.get('events', [])]
    cases = []
    for case in raw.get('stimulusCases', []):
        activations = [event for event in events if event['event'] == 'Activated'
                       and case['startMs'] <= event['captureMs'] < case['endMs']]
        cases.append(dict(case, observedActivations=len(activations),
                          activationDeliveryFromOnsetMs=[event['deliveredMs']-case['startMs'] for event in activations]))
    cpu_gpu_overlap = sum(max(0, min(a['inferenceEndMs'], b['inferenceEndMs']) -
                              max(a['inferenceBeginMs'], b['inferenceBeginMs']))
                          for a in rows if a['backend'] == 'CPU'
                          for b in rows if b['backend'] == 'GPU')
    return {**{key: raw[key] for key in ('run', 'mode', 'periodMs', 'pairedModels', 'inputFrames',
        'preparations', 'droppedRaw', 'droppedPrepared', 'peakOwnedImages', 'elapsedMs', 'processCpuMs')},
        'frameWidth': raw.get('frameWidth', 480), 'frameHeight': raw.get('frameHeight', 360),
        'nativeTimestampPolicy': raw.get('nativeTimestampPolicy', 'source-time'),
        'classifierEvents': events, 'stimulusCases': cases,
        'cpuGpuNativeCallOverlapMs': cpu_gpu_overlap,
        'processed': len(rows), 'accepted': len(accepted), 'lateDiscarded': len(rows)-len(accepted),
        'presentProcessed': sum(x['present'] for x in rows), 'presentAccepted': sum(x['present'] for x in accepted),
        'absentEpisodes': absent_runs, 'longestAbsentSampleSpanMs': longest_absence,
        'freshFps': len(accepted)*1000/raw['elapsedMs'], 'cpuMsPerAccepted': raw['processCpuMs']/len(accepted) if accepted else None,
        'cpuCoreEquivalent': raw['processCpuMs']/raw['elapsedMs'],
        'allFrameAgeMs': durations(rows, 'deliveredMs', 'captureMs'),
        'acceptedFrameAgeMs': durations(accepted, 'deliveredMs', 'captureMs'),
        'sourceLatenessMs': durations(rows, 'arrivalMs', 'captureMs'),
        'prepareMs': durations(rows, 'prepareEndMs', 'prepareBeginMs'),
        'nativeCallMs': durations(rows, 'inferenceEndMs', 'inferenceBeginMs'),
        'preparedWaitMs': durations(rows, 'inferenceBeginMs', 'prepareEndMs'),
        'processingMs': durations(rows, 'completedMs', 'prepareBeginMs'),
        'freshGapMs': stats([b['deliveredMs']-a['deliveredMs'] for a,b in zip(accepted, accepted[1:])]),
        'workers': {backend: {'count': len([x for x in rows if x['backend']==backend]),
            'nativeCallMs': durations([x for x in rows if x['backend']==backend], 'inferenceEndMs', 'inferenceBeginMs')}
            for backend in sorted({x['backend'] for x in rows})}}


def agreement(base, candidate):
    if not base.get('landmarksRetained', True) or not candidate.get('landmarksRetained', True):
        raise ValueError('Landmark agreement unavailable for compact sustained records')
    left = {x['frame']: x for x in base['samples']}
    right = {x['frame']: x for x in candidate['samples']}
    common = sorted(left.keys() & right.keys())
    score_deltas, point_distances = [], []
    presence_disagreements = 0
    for frame in common:
        a,b=left[frame],right[frame]
        presence_disagreements += a['present'] != b['present']
        if a['present'] and b['present']:
            if set(a['scores']) != set(b['scores']): raise ValueError('Expression output schema differs')
            score_deltas.extend(abs(a['scores'][k]-b['scores'][k]) for k in a['scores'])
            if len(a['landmarks']) != len(b['landmarks']): raise ValueError('Landmark output schema differs')
            for i in range(0,len(a['landmarks']),3):
                point_distances.append(math.sqrt(sum((a['landmarks'][j]-b['landmarks'][j])**2 for j in range(i,i+3))))
    return {'commonFrames': len(common), 'presenceDisagreements': presence_disagreements,
            'scoreAbsoluteDifference': stats(score_deltas), 'normalizedLandmarkDistance': stats(point_distances),
            'interpretation': 'Output agreement on shared inputs, not independent gesture accuracy.'}


def batch(directory):
    manifest=json.loads((directory/'run-manifest.json').read_text(encoding='utf-8-sig'))
    raws=[json.loads((directory/(r['run']+'.json')).read_text(encoding='utf-8-sig')) for r in manifest['runs']]
    return {'directory':directory.name,'manifest':manifest,'runs':[summarize(x) for x in raws],
            'agreementAgainstFirst':[{'run':x['run'],**agreement(raws[0],x)} for x in raws[1:]]}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=pathlib.Path,action='append',required=True)
    parser.add_argument('--output',type=pathlib.Path,required=True)
    args=parser.parse_args()
    results=[batch(p) for p in args.input]
    args.output.write_text(json.dumps(results,indent=2),encoding='utf-8')
    for result in results:
        print(result['directory'])
        for row in result['runs']:
            print('%s: %.2ffps, age median/p95 %.1f/%.1fms, gap p95 %.1fms, accepted %d/%d, late %d, CPU %.1fms/result'%
                  (row['run'],row['freshFps'],row['acceptedFrameAgeMs']['median'],row['acceptedFrameAgeMs']['p95'],
                   row['freshGapMs']['p95'] if row['freshGapMs'] else 0,row['accepted'],row['inputFrames'],row['lateDiscarded'],row['cpuMsPerAccepted']))
