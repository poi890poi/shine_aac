"""Strict per-frame accounting for a continuously visible camera session.

Input is retained epoch logcat, not independently rotating counter totals.
Classifier usability is distinct from gesture accuracy and visible feedback.
"""
import json
import math
import re
import statistics

IDENTITY = re.compile(r'^\s*(\d+\.\d+)\s+(\d+)\s+(\d+)\s+[VDIWEF]\s+')
FIELDS = re.compile(r'(\w+)=([^\s]+)')


def stats(values):
    if not values:
        return None
    ordered = sorted(values)
    return dict(samples=len(values), mean=statistics.mean(values),
                median=statistics.median(values),
                p95=ordered[math.ceil(len(values) * .95) - 1],
                p99=ordered[math.ceil(len(values) * .99) - 1], max=ordered[-1])


class Evidence:
    def __init__(self):
        self.lines = set()
        self.stages = {}
        self.blocks = {}
        self.activations = {}
        self.backends = set()
        self.backend_events = {}
        self.camera_binds = {}
        self.fallback = False

    def ingest(self, text):
        for raw in text.splitlines():
            line = raw.strip()
            relevant = any(token in line for token in (
                'FACE_STAGE ', 'FACE_BLOCK ', 'FACE_BACKEND ', 'OPTICAL_CAMERA runtimeId=', 'SHINE_AAC_E2E_INPUT '))
            if not relevant or line in self.lines:
                continue
            identity = IDENTITY.match(line)
            if not identity:
                raise ValueError('Telemetry lacks epoch/PID/TID identity')
            self.lines.add(line)
            epoch, pid, _ = identity.groups()
            if 'SHINE_AAC_E2E_INPUT ' in line:
                payload = json.loads(line.split('SHINE_AAC_E2E_INPUT ', 1)[1])
                if payload.get('intent') == 'activate':
                    self.activations[line] = dict(epoch=float(epoch), pid=pid, event=payload)
                continue
            fields = dict(FIELDS.findall(line))
            if 'OPTICAL_CAMERA runtimeId=' in line:
                self.camera_binds[line] = dict(epoch=float(epoch), fields=fields)
                continue
            if 'FACE_BACKEND ' in line:
                self.backends.add((fields.get('requested'), fields.get('actual')))
                self.backend_events[line] = dict(epoch=float(epoch), fields=fields)
                self.fallback |= 'fallback=' in line
                continue
            key = (pid, int(fields['frameMs']), fields['backend'])
            table = self.stages if 'FACE_STAGE ' in line else self.blocks
            if key in table and table[key]['fields'] != fields:
                raise ValueError('Conflicting telemetry for the same camera frame')
            table[key] = dict(epoch=float(epoch), fields=fields)

    def window(self, start_epoch, end_epoch):
        """Select completed camera blocks after the stream has been drained.

        A stage may start before the boundary. Pair it with its block rather
        than dropping it by a second, independently applied time filter.
        """
        if end_epoch < start_epoch:
            raise ValueError('Reversed evidence window')
        result = Evidence()
        result.backends = set(self.backends)
        result.fallback = self.fallback
        result.backend_events = {key: row for key, row in self.backend_events.items()
                                 if start_epoch <= row['epoch'] <= end_epoch}
        result.camera_binds = {key: row for key, row in self.camera_binds.items()
                               if start_epoch <= row['epoch'] <= end_epoch}
        result.blocks = {key: row for key, row in self.blocks.items()
                         if start_epoch <= row['epoch'] <= end_epoch}
        result.stages = {key: row for key, row in self.stages.items()
                         if key in result.blocks or
                         (key not in self.blocks and start_epoch <= row['epoch'] <= end_epoch)}
        result.activations = {key: row for key, row in self.activations.items()
                              if start_epoch <= row['epoch'] <= end_epoch}
        return result

    def summary(self, expected_backend, clock_verified=False):
        all_keys = set(self.stages) | set(self.blocks)
        matched = set(self.stages) & set(self.blocks)
        rows = sorted(matched, key=lambda k: (k[0], k[1]))
        pids = {key[0] for key in all_keys}
        backend_ok = self.backends == {(expected_backend, expected_backend)} and not self.fallback
        backend_ok &= all(key[2] == expected_backend for key in all_keys)
        stages = [self.stages[key]['fields'] for key in rows]
        blocks = [self.blocks[key]['fields'] for key in rows]
        usable_keys = [key for key in rows if self.stages[key]['fields']['usable'] == 'true']
        gaps = [b[1] - a[1] for a, b in zip(usable_keys, usable_keys[1:]) if a[0] == b[0]]
        durations = [int(row['durationUs']) / 1000 for row in blocks]
        ages = [int(row['frameAgeMs']) for row in blocks]
        errors = []
        if not rows: errors.append('no paired frames')
        if not backend_ok: errors.append('backend mismatch, fallback, or missing backend proof')
        if len(pids) != 1: errors.append('not exactly one app process')
        if len(matched) != len(all_keys): errors.append('unpaired stage/block evidence')
        if any(row.get('usable') not in ('true', 'false', 'null') for row in stages): errors.append('unknown usability state')
        if any(value < 0 for value in ages): errors.append('negative frame age')
        if any(value < 0 for value in durations): errors.append('negative duration')
        # Use elapsed capture time, so a slower tail cannot select a longer
        # time window merely because it produced fewer frames.
        span = rows[-1][1] - rows[0][1] if rows else 0
        early_end = rows[0][1] + span * .2 if rows else 0
        late_start = rows[-1][1] - span * .2 if rows else 0
        first = stats([value for key, value in zip(rows, durations) if key[1] <= early_end])
        last = stats([value for key, value in zip(rows, durations) if key[1] >= late_start])
        return dict(
            evidenceErrors=errors, backendVerified=bool(backend_ok), pairedFrames=len(rows),
            backendInitializations=len(self.backend_events), cameraBinds=len(self.camera_binds),
            processCount=len(pids), unmatchedStages=len(set(self.stages) - set(self.blocks)),
            unmatchedBlocks=len(set(self.blocks) - set(self.stages)),
            usableClassifierFrames=len(usable_keys),
            absentOrUnusableFrames=sum(row['usable'] == 'false' for row in stages),
            failedFrames=sum(row['usable'] == 'null' for row in stages),
            retainedOutputFrames=None,
            dimensions=sorted({(int(row['width']), int(row['height'])) for row in stages}),
            blockMs=stats(durations), cameraToClassifierMs=stats(ages) if clock_verified else None,
            rawFrameAgeMs=stats(ages), cameraClockVerified=clock_verified,
            usableCaptureGapMs=stats(gaps), earlyBlockMs=first, lateBlockMs=last,
            lateEarlyP95Ratio=last['p95'] / first['p95'] if first and first['p95'] > 0 else None,
            activationEvents=len(self.activations),
            stageMs={name: stats([int(row[name]) / 1000 for row in stages if name in row])
                     for name in ('copyUs', 'orientUs', 'wrapUs', 'inferenceUs', 'resultCleanupUs', 'totalUs')},
            interpretation='Fresh usable classifier results are not an independent gesture or feedback oracle. Unobserved retained output remains unknown.')
