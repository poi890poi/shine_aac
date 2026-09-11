import importlib.util
import pathlib
import unittest

SPEC = importlib.util.spec_from_file_location('overlap_report', pathlib.Path(__file__).with_name('report-face-overlap-benchmark.py'))
REPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REPORT)


def sample(index, delivered, accepted=True):
    return {'frame': index, 'accepted': accepted, 'present': True, 'backend': 'GPU',
            'captureMs': index*10, 'arrivalMs': index*10, 'prepareBeginMs': index*10,
            'prepareEndMs': index*10+1, 'inferenceBeginMs': index*10+1,
            'inferenceEndMs': delivered-1, 'completedMs': delivered, 'deliveredMs': delivered,
            'scores': {'blink': .2}, 'landmarks': [0., .5, 0.]}


def raw(samples):
    return {'run': 'unit', 'mode': 'dual', 'periodMs': 66, 'pairedModels': True,
            'inputFrames': len(samples), 'preparations': len(samples), 'droppedRaw': 0,
            'droppedPrepared': 0, 'peakOwnedImages': 2, 'elapsedMs': 100,
            'processCpuMs': 80, 'samples': samples}


class OverlapReportTest(unittest.TestCase):
    def test_compact_sustained_presence_is_not_landmark_geometry(self):
        data = raw([sample(0, 30)])
        data['landmarksRetained'] = False
        with self.assertRaisesRegex(ValueError, 'Landmark agreement unavailable'):
            REPORT.agreement(data, data)

    def test_native_call_overlap_is_measured_separately_from_fps(self):
        first, second = sample(0, 30), sample(1, 40)
        second['backend'] = 'CPU'
        self.assertEqual(18, REPORT.summarize(raw([first, second]))['cpuGpuNativeCallOverlapMs'])

    def test_activation_counts_and_delay_use_accepted_result_and_known_onset(self):
        row = sample(1, 40)
        row['events'] = ['Activated']
        data = raw([row])
        data['stimulusCases'] = [{'id': 'hold', 'startMs': 5, 'endMs': 20, 'expectedActivations': 1}]
        case = REPORT.summarize(data)['stimulusCases'][0]
        self.assertEqual(1, case['observedActivations'])
        self.assertEqual([35], case['activationDeliveryFromOnsetMs'])

    def test_late_results_cannot_trigger_classifier(self):
        late = sample(0, 50, False)
        late['events'] = ['Activated']
        with self.assertRaisesRegex(ValueError, 'Late result emitted'):
            REPORT.summarize(raw([sample(1, 40), late]))

    def test_late_result_does_not_inflate_freshness_or_hide_latency(self):
        report = REPORT.summarize(raw([sample(0, 30), sample(2, 50), sample(1, 90, False)]))
        self.assertEqual(3, report['processed'])
        self.assertEqual(2, report['accepted'])
        self.assertEqual(1, report['lateDiscarded'])
        self.assertEqual(20, report['freshFps'])
        self.assertEqual(80, report['allFrameAgeMs']['max'])
        self.assertEqual(30, report['acceptedFrameAgeMs']['max'])
        self.assertEqual(40, report['cpuMsPerAccepted'])

    def test_out_of_order_output_cannot_be_marked_accepted(self):
        with self.assertRaisesRegex(ValueError, 'monotonic'):
            REPORT.summarize(raw([sample(2, 50), sample(1, 90)]))

    def test_input_accounting_requires_every_dropped_frame(self):
        data = raw([sample(0, 30)])
        data.update(inputFrames=3, droppedRaw=1, droppedPrepared=1)
        self.assertEqual(1, REPORT.summarize(data)['accepted'])
        data['droppedRaw'] = 0
        with self.assertRaisesRegex(ValueError, 'conserve'):
            REPORT.summarize(data)

    def test_comparison_uses_shared_frame_identity(self):
        baseline = raw([sample(0, 30), sample(1, 40)])
        candidate = raw([sample(1, 40)])
        candidate['samples'][0]['scores']['blink'] = .4
        result = REPORT.agreement(baseline, candidate)
        self.assertEqual(1, result['commonFrames'])
        self.assertAlmostEqual(.2, result['scoreAbsoluteDifference']['mean'])
        self.assertEqual(0, result['normalizedLandmarkDistance']['max'])
        candidate['samples'][0]['landmarks'] = []
        with self.assertRaisesRegex(ValueError, 'schema'):
            REPORT.agreement(baseline, candidate)


if __name__ == '__main__': unittest.main()
