import importlib.util
import pathlib
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location('face_benchmark_report', pathlib.Path(__file__).with_name('report-face-analysis-benchmark.py'))
REPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REPORT)
BENCH_SPEC = importlib.util.spec_from_file_location('face_benchmark', pathlib.Path(__file__).with_name('face-analysis-benchmark.py'))
BENCH = importlib.util.module_from_spec(BENCH_SPEC)
BENCH_SPEC.loader.exec_module(BENCH)


class FaceAnalysisBenchmarkTest(unittest.TestCase):
    def test_failed_app_stop_still_turns_display_off_and_verifies(self):
        calls, recorded = [], []
        failure = RuntimeError('force-stop failed')
        def adb(*args):
            calls.append(args)
            if 'force-stop' in args:
                raise failure
            return b'mScreenState=OFF' if 'display' in args else b''
        with mock.patch.object(BENCH.time, 'sleep'):
            with self.assertRaises(RuntimeError) as caught:
                BENCH.cleanup_device(adb, recorded.append)
        self.assertIs(failure, caught.exception)
        self.assertIn(('shell', 'input', 'keyevent', '223'), calls)
        self.assertEqual(('shell', 'dumpsys', 'display'), calls[-1])
        self.assertEqual([True], recorded)

    def test_unverified_display_off_is_recorded_as_failure(self):
        recorded = []
        with mock.patch.object(BENCH.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'OFF not verified'):
                BENCH.cleanup_device(lambda *args: b'mScreenState=ON', recorded.append)
        self.assertEqual([False], recorded)

    def test_percentile_is_computed_from_individual_samples(self):
        self.assertEqual(95, REPORT.stats(list(range(1, 101)))['p95'])
        self.assertEqual(50.5, REPORT.stats(list(range(1, 101)))['median'])
        self.assertIsNone(REPORT.stats([]))

    def test_overlapping_logs_count_unique_observations_not_snapshots(self):
        event = '1789060000.123 10 11 I ShineCameraSwitch: FACE_BLOCK backend=GPU frameMs=100 durationUs=20000 frameAgeMs=40'
        second = event.replace('0000.123', '0000.223').replace('durationUs=20000', 'durationUs=40000')
        with tempfile.TemporaryDirectory() as folder:
            directory = pathlib.Path(folder)
            (directory / 'case-a.log').write_text(event + '\n' + event, encoding='utf-8')
            (directory / 'case-b.log').write_text(event + '\n' + second, encoding='utf-8')
            (directory / 'runtime-camera.log').write_text(event, encoding='utf-8')
            group = REPORT.optical(directory)['backends']['GPU']
            self.assertIsNone(group['usableFrames'])
            self.assertIsNone(group['failedFrames'])
            self.assertEqual(0, group['stageSamples'])
            result = group['blockMs']
            self.assertEqual(2, result['samples'])
            self.assertEqual(30, result['mean'])
            self.assertEqual(40, result['p95'])


if __name__ == '__main__': unittest.main()
