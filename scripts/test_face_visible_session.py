import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('visible_session', Path(__file__).with_name('face-visible-session.py'))
SESSION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SESSION)
GUARD_SPEC = importlib.util.spec_from_file_location('visible_guard', Path(__file__).with_name('face-device-session-guard.py'))
GUARD = importlib.util.module_from_spec(GUARD_SPEC)
GUARD_SPEC.loader.exec_module(GUARD)


class VisibleSessionTest(unittest.TestCase):
    def test_starting_temperature_matches_discovery_within_one_degree(self):
        for actual in (27.5, 28.5, 29.5):
            SESSION.validate_starting_temperature(28.5, actual)
        for actual in (None, float('nan'), float('inf'), 27.4, 29.6):
            with self.subTest(actual=actual), self.assertRaisesRegex(RuntimeError, 'Starting battery'):
                SESSION.validate_starting_temperature(28.5, actual)

    def test_private_snapshots_cannot_go_to_share_or_escape_tmp(self):
        expected = (GUARD.ROOT / '.tmp' / 'visible-test' / 'private-state').resolve()
        for entry_point in (GUARD, SESSION):
            self.assertEqual(expected, entry_point.private_output_path(expected))
            for path in (GUARD.ROOT / 'share' / 'private-state', GUARD.ROOT / '.tmp' / '..' / 'share' / 'private-state', GUARD.ROOT / '.tmp'):
                with self.subTest(entry_point=entry_point.__name__, path=str(path)), self.assertRaisesRegex(ValueError, 'Private state'):
                    entry_point.private_output_path(path)

    def sample(self):
        return dict(pid='123', focused=True, wakefulness=['Awake'], display=['ON'], thermalStatus=0, batteryC=30)

    def test_foreground_alone_cannot_admit_sleeping_or_unknown_display(self):
        SESSION.validate_observation(self.sample(), '123')
        for changes in ({'display': ['OFF']}, {'display': []}, {'wakefulness': ['Dozing']}, {'focused': False}, {'pid': '456'}):
            with self.subTest(changes=changes), self.assertRaisesRegex(RuntimeError, 'admission lost'):
                SESSION.validate_observation(dict(self.sample(), **changes), '123')

    def test_thermal_missing_or_moderate_and_hot_battery_stop_without_pause(self):
        for changes in ({'thermalStatus': 2}, {'batteryC': 42}, {'thermalStatus': None}, {'batteryC': None}):
            with self.subTest(changes=changes), self.assertRaisesRegex(RuntimeError, 'Thermal'):
                SESSION.validate_observation(dict(self.sample(), **changes), '123')

    def test_only_selected_camera_clock_can_authorize_age_metric(self):
        source = ('== Camera HAL device device@3.5/legacy/0 (v3.5) static information: ==\n'
                  ' android.sensor.info.timestampSource (f0008): byte[1]\n [REALTIME]\n'
                  '== Camera HAL device device@3.5/legacy/1 (v3.5) static information: ==\n'
                  ' android.sensor.info.timestampSource (f0008): byte[1]\n [UNKNOWN]\n')
        self.assertTrue(SESSION.realtime_camera_clock(source, '0'))
        self.assertFalse(SESSION.realtime_camera_clock(source, '1'))
        self.assertFalse(SESSION.realtime_camera_clock(source, '10'))
        self.assertFalse(SESSION.realtime_camera_clock(source + source, '0'))


if __name__ == '__main__': unittest.main()
