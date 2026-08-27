import importlib.util
import inspect
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("benchmark.py")
SPEC = importlib.util.spec_from_file_location("blink_model_benchmark", MODULE_PATH)
benchmark = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = benchmark
SPEC.loader.exec_module(benchmark)


class AnnotationTest(unittest.TestCase):
    def test_unambiguous_states_only(self):
        closed = benchmark.Annotation(1, 4, True, True, True, True, True)
        open_frame = benchmark.Annotation(2, -1, True, False, True, False, True)
        transition = benchmark.Annotation(3, 4, True, False, True, False, True)
        hidden = benchmark.Annotation(4, -1, True, False, False, False, True)

        self.assertTrue(benchmark.labeled_eye_state(closed, "left"))
        self.assertFalse(benchmark.labeled_eye_state(open_frame, "left"))
        self.assertIsNone(benchmark.labeled_eye_state(transition, "left"))
        self.assertIsNone(benchmark.labeled_eye_state(hidden, "left"))

    def test_parser_uses_documented_flags(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.tag"
            path.write_text(
                "#start\n7:3:X:C:X:X:N:0:0:1:1:0:0:0:0:0:0:0:0\n", encoding="utf-8"
            )
            value = benchmark.parse_annotations(path)[7]
        self.assertEqual(3, value.blink_id)
        self.assertTrue(value.image_left_closed)
        self.assertTrue(value.image_left_visible)
        self.assertFalse(value.image_right_closed)
        self.assertFalse(value.image_right_visible)


class MetricsTest(unittest.TestCase):
    def test_confusion_and_missing_views_are_separate(self):
        samples = [(True, 0.9), (True, None), (False, 0.8), (False, 0.1)]
        detected = benchmark.confusion_for_samples(samples, 0.55, False)
        pipeline = benchmark.confusion_for_samples(samples, 0.55, True)
        self.assertEqual(benchmark.Confusion(tp=1, fp=1, tn=1, fn=0), detected)
        self.assertEqual(benchmark.Confusion(tp=1, fp=1, tn=1, fn=1), pipeline)

    def test_wilson_interval_contains_observed_fraction(self):
        low, high = benchmark.wilson_interval(90, 100)
        self.assertLess(low, 0.9)
        self.assertGreater(high, 0.9)

    def test_ranking_metrics_are_perfect_for_separated_scores(self):
        values = benchmark.ranking_metrics([(True, 0.9), (True, 0.8), (False, 0.2), (False, 0.1)])
        self.assertEqual(1.0, values["roc_auc"])
        self.assertEqual(1.0, values["average_precision"])

    def test_dataset_image_left_maps_to_mediapipe_anatomical_right(self):
        row = {
            "annotated": True,
            "frame_id": 1,
            "blink_id": 2,
            "frontal": True,
            "image_left_closed": True,
            "image_left_visible": True,
            "image_right_closed": False,
            "image_right_visible": True,
            "eye_blink_left": 0.1,
            "eye_blink_right": 0.9,
        }
        self.assertEqual([(True, 0.9)], benchmark.samples_for([row], "left"))

    def test_inference_is_independent_image_mode(self):
        source = inspect.getsource(benchmark.process_video)
        self.assertIn("RunningMode.IMAGE", source)
        self.assertIn("landmarker.detect(image)", source)
        self.assertNotIn("detect_for_video", source)

    def test_temporal_policy_is_not_part_of_model_benchmark(self):
        self.assertFalse(hasattr(benchmark, "BlinkPolicySimulator"))
        self.assertFalse(hasattr(benchmark, "PolicyConfig"))


if __name__ == "__main__":
    unittest.main()
