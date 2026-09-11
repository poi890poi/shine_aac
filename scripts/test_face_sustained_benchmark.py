import importlib.util
import pathlib
import unittest

SPEC = importlib.util.spec_from_file_location('sustained', pathlib.Path(__file__).with_name('report-face-sustained-benchmark.py'))
REPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REPORT)


def fixture():
    rows = [dict(frame=i, captureMs=i*1000, deliveredMs=i*1000+10, accepted=True,
                 backend='GPU', present=True, events=['Activated'] if i % 2 else [],
                 inferenceBeginMs=i*1000+1, inferenceEndMs=i*1000+9,
                 prepareBeginMs=i*1000, prepareEndMs=i*1000+1) for i in range(4)]
    cases = [dict(id=str(i), startMs=i*1000, endMs=(i+1)*1000, expectedActivations=i % 2) for i in range(4)]
    return dict(samples=rows, droppedRaw=0, droppedPrepared=0, inputFrames=4, primaryDelegate='GPU',
                stimulusCases=cases, cycleFrames=2, periodMs=1000, cycles=2, elapsedMs=4000,
                run='test', mode='serial', peakOwnedImages=1, processCpuMs=100)


class SustainedReportTest(unittest.TestCase):
    def test_preparation_native_overlap_requires_simultaneous_intervals(self):
        self.assertEqual(0, REPORT.interval_overlap([(0, 2), (10, 12)], [(2, 8), (12, 18)]))
        self.assertEqual(3, REPORT.interval_overlap([(0, 2), (10, 14)], [(1, 5), (12, 18)]))
        self.assertEqual(0, REPORT.interval_overlap([], [(1, 5)]))

    def test_sensor_summary_uses_current_hal_not_stale_cached_reading(self):
        out = REPORT.host_summary([{'display': ['ON'], 'thermal':
            'Cached temperatures:\nTemperature{mValue=90.0, mType=-1, mName=soc, mStatus=0}\n'
            'Current temperatures from HAL:\nTemperature{mValue=42.0, mType=-1, mName=soc\n, mStatus=0}\n'
            'Current cooling devices from HAL:'}])
        self.assertEqual(42, out['sensorsC']['soc']['max'])
        self.assertEqual(['ON'], out['displayStates'])

    def test_short_success_does_not_become_sustained_or_energy_claim(self):
        out = REPORT.summarize(fixture(), [])
        self.assertTrue(out['semanticCasesPassed'])
        self.assertFalse(out['sustainedDurationCovered'])
        self.assertIsNone(out['energyWh'])
        self.assertIsNone(out['headroom'])
        self.assertEqual({}, out['thermalStatusCounts'])

    def test_equal_total_cannot_hide_miss_and_false_positive(self):
        data = fixture()
        data['samples'][0]['events'], data['samples'][1]['events'] = ['Activated'], []
        out = REPORT.summarize(data, [])
        self.assertEqual(out['expectedActivations'], out['observedActivations'])
        self.assertEqual(2, len(out['failedCases']))
        self.assertFalse(out['semanticCasesPassed'])

    def test_matched_cycle_windows_detect_late_slowdown(self):
        data = fixture()
        for row in data['samples'][2:]: row['deliveredMs'] += 10
        out = REPORT.summarize(data, [])
        self.assertEqual(2, out['lateEarlyP95Ratio'])
        self.assertTrue(out['degradationFlag'])
        self.assertEqual(2000, out['early']['endMs'])
        self.assertEqual(2000, out['late']['startMs'])

    def test_missing_frame_must_be_accounted(self):
        data = fixture(); data['samples'].pop()
        with self.assertRaisesRegex(ValueError, 'conserved'): REPORT.summarize(data, [])

    def test_backend_fallback_cannot_be_labeled_gpu(self):
        data = fixture(); data['samples'][0]['backend'] = 'CPU'
        with self.assertRaisesRegex(ValueError, 'backend'): REPORT.summarize(data, [])

    def test_unsupported_headroom_not_zero(self):
        out = REPORT.summarize(fixture(), [{'thermalHeadroom': None, 'thermalStatus': 0, 'plugged': 2}])
        self.assertIsNone(out['headroom'])
        self.assertEqual({'0': 1}, out['thermalStatusCounts'])

    def test_foreground_control_requires_awake_evidence_including_end(self):
        data = fixture()
        data.update(periodMs=66, frameWidth=320, cycles=1, cycleFrames=4,
                    foregroundActivity=False, endingInteractive=True)
        awake = {'interactive': True, 'keyguardLocked': False, 'deviceLocked': False}
        good = REPORT.foreground_control(data, [awake])
        self.assertTrue(good['comparisonUsable'])
        self.assertFalse(REPORT.foreground_control(data, [])['comparisonUsable'])
        self.assertFalse(REPORT.foreground_control(data, [dict(awake, interactive=False)])['comparisonUsable'])
        self.assertFalse(REPORT.foreground_control(data, [dict(awake, keyguardLocked=True)])['comparisonUsable'])
        data['foregroundActivity'] = True
        self.assertFalse(REPORT.foreground_control(data, [awake])['comparisonUsable'])
        data['foregroundWindowFocusAfterWarmup'] = True
        self.assertTrue(REPORT.foreground_control(data, [awake])['comparisonUsable'])
        data['controlKeepAwake'] = True
        self.assertFalse(REPORT.foreground_control(data, [awake])['comparisonUsable'])
        data['endingControlWakeLockHeld'] = True
        self.assertTrue(REPORT.foreground_control(data, [awake])['comparisonUsable'])
        data['endingInteractive'] = False
        self.assertFalse(REPORT.foreground_control(data, [awake])['comparisonUsable'])


if __name__ == '__main__': unittest.main()
