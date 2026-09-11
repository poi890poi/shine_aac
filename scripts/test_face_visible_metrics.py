import unittest

from face_visible_metrics import Evidence, stats


def line(message, timestamp='1789060000.123', pid=10):
    return '%s %s 11 I ShineFaceAnalysis: %s' % (timestamp, pid, message)


def frame(timestamp=100, usable='true', pid=10, duration=20000):
    return '\n'.join([
        line('FACE_STAGE backend=GPU frameMs=%d width=320 height=240 usable=%s totalUs=19000 inferenceUs=18000' % (timestamp, usable), pid=pid),
        line('FACE_BLOCK backend=GPU frameMs=%d durationUs=%d frameAgeMs=40' % (timestamp, duration), pid=pid)])


class VisibleMetricsTest(unittest.TestCase):
    def evidence(self):
        result = Evidence()
        result.ingest(line('FACE_BACKEND requested=GPU actual=GPU owner=ShineFaceInference'))
        return result

    def test_rollover_overlap_duplicates_and_zero_inputs(self):
        evidence = self.evidence()
        activation = line('SHINE_AAC_E2E_INPUT {"intent":"activate","source":"android-camera-long-blink"}')
        evidence.ingest(frame() + '\n' + activation)
        evidence.ingest(frame() + '\n' + activation + '\n' + frame(166))
        evidence.ingest(frame(232))  # older events no longer in the latest snapshot
        result = evidence.summary('GPU', True)
        self.assertEqual([], result['evidenceErrors'])
        self.assertEqual(3, result['pairedFrames'])
        self.assertEqual(1, result['activationEvents'])
        self.assertEqual(66, result['usableCaptureGapMs']['max'])
        zero = self.evidence()
        zero.ingest(frame())
        self.assertEqual(0, zero.summary('GPU')['activationEvents'])

    def test_same_frame_conflicting_observation_is_rejected(self):
        evidence = self.evidence()
        evidence.ingest(frame())
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            evidence.ingest(frame(usable='false'))

    def test_missing_identity_is_not_silently_counted(self):
        with self.assertRaisesRegex(ValueError, 'identity'):
            Evidence().ingest('I ShineFaceAnalysis: FACE_BLOCK backend=GPU frameMs=100')

    def test_failed_and_unavailable_frames_are_not_fresh_usable(self):
        evidence = self.evidence()
        evidence.ingest(frame() + '\n' + frame(166, 'false') + '\n' + frame(232, 'null') + '\n' + frame(298))
        result = evidence.summary('GPU')
        self.assertEqual(2, result['usableClassifierFrames'])
        self.assertEqual(1, result['absentOrUnusableFrames'])
        self.assertEqual(1, result['failedFrames'])
        self.assertEqual(198, result['usableCaptureGapMs']['max'])
        self.assertIsNone(result['cameraToClassifierMs'])
        self.assertIsNone(result['retainedOutputFrames'])

    def test_unpaired_and_restarted_process_are_invalid(self):
        evidence = self.evidence()
        evidence.ingest(frame() + '\n' + frame(166, pid=20).splitlines()[0])
        result = evidence.summary('GPU')
        self.assertIn('not exactly one app process', result['evidenceErrors'])
        self.assertIn('unpaired stage/block evidence', result['evidenceErrors'])

    def test_actual_backend_cannot_be_assumed_from_requested(self):
        evidence = Evidence()
        evidence.ingest(line('FACE_BACKEND requested=GPU actual=CPU fallback=initialization'))
        evidence.ingest(frame().replace('backend=GPU', 'backend=CPU'))
        self.assertFalse(evidence.summary('GPU')['backendVerified'])

    def test_empty_and_percentiles(self):
        self.assertIsNone(stats([]))
        self.assertEqual(99, stats(list(range(1, 101)))['p99'])
        self.assertIn('no paired frames', Evidence().summary('CPU')['evidenceErrors'])

    def test_early_late_windows_use_time_when_frame_rate_changes(self):
        evidence = self.evidence()
        for capture in (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000):
            evidence.ingest(frame(capture, duration=90000 if capture == 1000 else 20000))
        result = evidence.summary('GPU')
        self.assertEqual(11, result['earlyBlockMs']['samples'])
        self.assertEqual(1, result['lateBlockMs']['samples'])
        self.assertEqual(4.5, result['lateEarlyP95Ratio'])

    def test_window_uses_completion_without_breaking_pairs(self):
        evidence = self.evidence()
        evidence.ingest(frame().splitlines()[0].replace('1789060000.123', '1789060000.999'))
        evidence.ingest(frame().splitlines()[1].replace('1789060000.123', '1789060001.001'))
        result = evidence.window(1789060001.0, 1789060002.0).summary('GPU')
        self.assertEqual(1, result['pairedFrames'])
        self.assertEqual([], result['evidenceErrors'])
        self.assertEqual(0, evidence.window(1789060000.0, 1789060001.0).summary('GPU')['pairedFrames'])

    def test_same_process_native_restart_is_retained(self):
        evidence = self.evidence()
        bind = line('OPTICAL_CAMERA runtimeId=1')
        restart = line('FACE_BACKEND requested=GPU actual=GPU owner=ShineFaceInference', timestamp='1789060001.123')
        evidence.ingest(bind + '\n' + restart + '\n' + restart)
        result = evidence.window(1789060001, 1789060002).summary('GPU')
        self.assertEqual(1, result['backendInitializations'])
        self.assertEqual(0, result['cameraBinds'])


if __name__ == '__main__': unittest.main()
