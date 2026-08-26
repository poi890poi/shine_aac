import importlib.util
import inspect
import json
import struct
import sys
import tempfile
import threading
import time
import unittest
import zlib
from pathlib import Path
from unittest import mock

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import optical_stimulus
import optical_sources
SPEC = importlib.util.spec_from_file_location(
    "shine_optical_rig", SCRIPT_DIR / "optical-rig-test.py"
)
RIG = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RIG)


def write_rgb_png(path, width, height, pixel):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel(x, y))

    def chunk(kind, payload):
        return (
            struct.pack(">I", len(payload)) + kind + payload +
            struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(bytes(raw)))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


class CameraIdentityTest(unittest.TestCase):
    def test_latest_camera_telemetry_wins(self):
        text = "\n".join([
            "I/ShineCameraSetup: OPTICAL_CAMERA setupId=1 facing=front",
            "I/ShineCameraSetup: OPTICAL_CAMERA setupId=3 facing=front",
        ])
        self.assertEqual("3", RIG.latest_optical_camera_id(text, "setupId"))
        self.assertIsNone(RIG.latest_optical_camera_id(text, "runtimeId"))

    def test_camera_label_is_a_telemetry_fallback(self):
        strings = ["Gesture", "Camera: Front 2/3 (ID front-wide)"]
        self.assertEqual(
            "front-wide", RIG.camera_id_from_visible_strings(strings)
        )


class OpticalOracleTest(unittest.TestCase):
    def test_demo_state_wait_uses_bounded_recent_log(self):
        rig = object.__new__(RIG.OpticalRig)
        fresh = (
            '1.000 I ShineAacE2E: SHINE_AAC_E2E_STATE '
            '{"message":"","stage":"Cells","rowIndex":2,"cellIndex":3}'
        )
        rig.e2e_recent_log = mock.Mock(return_value=fresh)
        rig.e2e_log = mock.Mock(side_effect=AssertionError("full log must not aim a gesture"))

        state = rig.wait_demo_state(
            timeout=0.1, stage="Cells", row_index=2, cell_index=3
        )

        self.assertEqual(3, state["cellIndex"])
        rig.e2e_recent_log.assert_called()

    def test_cheek_performance_telemetry_is_structured(self):
        samples = RIG.cheek_performance_samples(
            "I/ShineCameraSwitch: CHEEK_PERF path=rgba-mediaimage "
            "frames=50 avgUs=18500 maxUs=42700 size=480x360"
        )
        self.assertEqual(1, len(samples))
        self.assertEqual(18500, samples[0]["avg_us"])
        self.assertEqual(42700, samples[0]["max_us"])
        self.assertEqual("rgba-mediaimage", samples[0]["path"])

    def test_e2e_demo_helpers_use_latest_state_and_physical_source(self):
        log = "\n".join([
            'I/ShineAacE2E: SHINE_AAC_E2E_STATE {"message":"","stage":"Rows","rowIndex":0}',
            'I/ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"activate","source":"android-camera-long-blink"}',
            'I/ShineAacE2E: SHINE_AAC_E2E_STATE {"message":"喝水","stage":"Rows","rowIndex":1}',
        ])
        self.assertEqual("喝水", RIG.latest_e2e_state(log)["message"])
        self.assertEqual(
            1,
            RIG.e2e_input_count(
                log, "activate", "android-camera-long-blink"
            ),
        )

    def test_demo_activation_requires_exactly_one_input(self):
        self.assertEqual("MISS", RIG.demo_activation_result(4, 4))
        self.assertEqual("PASS", RIG.demo_activation_result(4, 5))
        self.assertEqual("DUPLICATE", RIG.demo_activation_result(4, 6))

    def test_camera_status_parser_tracks_power_policy_for_one_source(self):
        log = "\n".join([
            'I ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"cameraStatus","source":"android-camera-long-blink","detail":"state=active;score=0.1"}',
            'I ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"cameraStatus","source":"android-camera-cheek-twitch","detail":"state=analysis"}',
            'I ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"cameraStatus","source":"android-camera-long-blink","detail":"state=powerSaving;threshold=0.5"}',
        ])
        self.assertEqual(
            ["active", "powerSaving"],
            RIG.e2e_camera_statuses(log, "android-camera-long-blink"),
        )

    def test_window_brightness_parser_accepts_oem_window_dump_format(self):
        dump = "mAttrs={(0,0)(fillxfill) sim={adjust=pan} screenBrightness=0.12}\nother screenBrightness=-1.0"
        self.assertEqual([0.12, -1.0], RIG.window_brightness_values(dump))

    def test_e2e_telemetry_toggle_preserves_other_preferences(self):
        source = (
            "<?xml version='1.0' encoding='utf-8'?><map>"
            "<string name='profileId'>zh-TW</string>"
            "<boolean name='e2eEnabled' value='false'/>"
            "<float name='scanIntervalMs' value='2400.0'/></map>"
        )
        changed = RIG.android_preferences_with_boolean(
            source, "e2eEnabled", True
        )
        values = RIG.android_preference_values(changed)
        self.assertEqual("zh-TW", values["profileId"])
        self.assertEqual("true", values["e2eEnabled"])
        self.assertEqual("2400.0", values["scanIntervalMs"])

    def test_case_oracle_prefers_exact_e2e_count_over_wrapped_board_phase(self):
        log = "\n".join([
            'I ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"cameraStatus","source":"android-camera-long-blink"}',
            'I ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"activate","source":"android-camera-long-blink"}',
            'I ShineAacE2E: SHINE_AAC_E2E_INPUT {"intent":"activate","source":"android-camera-long-blink"}',
        ])
        count, oracle = RIG.observed_case_activations(
            log, "android-camera-long-blink", "review", "review", "row-column"
        )
        self.assertEqual(2, count)
        self.assertEqual("e2e-exact", oracle)

    def test_latest_e2e_state_preserves_log_epoch_for_fresh_target_waits(self):
        log = (
            '1787515415.700 14353 I ShineAacE2E: SHINE_AAC_E2E_STATE '
            '{"message":"幫忙","stage":"FirstCell","rowIndex":1,"cellIndex":0}'
        )
        state = RIG.latest_e2e_state(log)
        self.assertEqual("FirstCell", state["stage"])
        self.assertEqual(1787515415.7, state["_logEpochS"])
        self.assertEqual(
            0,
            RIG.e2e_input_count(
                log, "activate", "android-camera-cheek-twitch"
            ),
        )

    def test_semantic_demo_target_follows_current_text_and_position(self):
        state = {
            "rows": [
                ["清除", "喝水"],
                ["說出", "幫我"],
            ]
        }
        self.assertEqual(
            ("幫我", 1, 1),
            RIG.semantic_board_target(state, ["幫忙", "幫我", "Help"]),
        )
        self.assertEqual(
            ("說出", 1, 0),
            RIG.semantic_board_target(state, ["朗讀", "說出", "Speak"]),
        )

    def test_flat_action_surface_skips_a_redundant_row_activation(self):
        self.assertTrue(RIG.board_uses_flat_cell_scan({
            "rows": [["朗讀", "清除", "編輯"]],
        }))
        self.assertFalse(RIG.board_uses_flat_cell_scan({
            "rows": [["幫忙", "喝水"], ["朗讀", "清除"]],
        }))

    def test_physical_normal_use_scenarios_are_distinct_and_goal_based(self):
        scenarios = RIG.PHYSICAL_NORMAL_USE_SCENARIOS
        self.assertTrue(RIG.validate_physical_normal_use_scenarios(scenarios))
        self.assertNotEqual(
            scenarios["blink"]["goal"], scenarios["cheek"]["goal"]
        )
        for scenario in scenarios.values():
            script = scenario["steps"]
            self.assertGreaterEqual(len(script), 17)
            self.assertEqual(4, sum(step["kind"] == "speak" for step in script))
            self.assertTrue(any(step["kind"] == "undo" for step in script))
            self.assertTrue(any(step["kind"] == "append_wrong_dynamic" for step in script))
            self.assertTrue(any(step["kind"] == "open_category" for step in script))
            self.assertTrue(any(step["kind"] == "close_category" for step in script))

    def test_blink_calibration_timeline_requires_five_long_closures(self):
        events = []
        for cycle in range(1, 6):
            events.extend([
                {
                    "cycle": cycle, "pose": "open",
                    "actual_presented_ms": 400,
                    "presenter_acknowledged": True,
                },
                {
                    "cycle": cycle, "pose": "long-closed",
                    "actual_presented_ms": 900,
                    "presenter_acknowledged": True,
                },
                {
                    "cycle": cycle, "pose": "open",
                    "actual_presented_ms": 400,
                    "presenter_acknowledged": True,
                },
            ])
        self.assertTrue(
            RIG.blink_calibration_timeline_is_complete({"events": events})
        )
        events[7]["actual_presented_ms"] = 600
        self.assertFalse(
            RIG.blink_calibration_timeline_is_complete({"events": events})
        )

    def test_blink_calibration_oracle_uses_durable_record(self):
        before = '<map><long name="calibratedAtMs" value="100" /></map>'
        after = (
            '<map><long name="calibratedAtMs" value="200" />'
            '<long name="longBlinkMs" value="550" />'
            '<float name="zoomRatio" value="4.0" />'
            '<float name="blinkCloseThreshold" value="0.7" />'
            '<float name="blinkReopenThreshold" value="0.4" />'
            '<string name="qualityLabel">品質良好</string></map>'
        )
        record = RIG.new_blink_calibration_record(before, after)
        self.assertEqual("200", record["calibratedAtMs"])
        self.assertEqual("550", record["longBlinkMs"])
        self.assertTrue(RIG.blink_calibration_quality_is_good(record))

    def test_weak_blink_calibration_is_not_a_rig_pass(self):
        self.assertFalse(RIG.blink_calibration_quality_is_good({"qualityLabel": "品質偏低"}))
        self.assertFalse(RIG.blink_calibration_quality_is_good({"qualityLabel": "Quality needs retry"}))

    def test_blink_calibration_report_requires_good_saved_quality(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "blink-calibration.json"
            path.write_text(json.dumps({
                "saved_record": {"qualityLabel": "請重新設定"}
            }), encoding="utf-8")
            self.assertFalse(RIG.blink_calibration_artifact_passes(path))
            path.write_text(json.dumps({
                "saved_record": {"qualityLabel": "品質良好"}
            }), encoding="utf-8")
            self.assertTrue(RIG.blink_calibration_artifact_passes(path))

    def test_cheek_calibration_oracle_requires_new_complete_model(self):
        before = '<map><long name="cheekCalibratedAtMs" value="100" /></map>'
        after = (
            '<map><long name="cheekCalibratedAtMs" value="200" />'
            '<string name="cheekModel">model-json</string>'
            '<long name="cheekHoldMs" value="500" />'
            '<float name="zoomRatio" value="4.0" />'
            '<string name="cheekQualityLabel">品質良好</string>'
            '<string name="cheekQualityDetail">6/6</string></map>'
        )
        record = RIG.new_cheek_calibration_record(before, after)
        self.assertEqual("200", record["cheekCalibratedAtMs"])
        self.assertEqual("model-json", record["cheekModel"])

    def test_cheek_calibration_oracle_rejects_unchanged_timestamp(self):
        xml = (
            '<map><long name="cheekCalibratedAtMs" value="100" />'
            '<string name="cheekModel">model-json</string>'
            '<long name="cheekHoldMs" value="500" />'
            '<float name="zoomRatio" value="4.0" />'
            '<string name="cheekQualityLabel">品質良好</string>'
            '<string name="cheekQualityDetail">6/6</string></map>'
        )
        self.assertIsNone(RIG.new_cheek_calibration_record(xml, xml))

    def test_visible_board_oracle_counts_row_column_stages(self):
        self.assertEqual(0, RIG.visible_activation_count("review", "review", "row-column"))
        self.assertEqual(1, RIG.visible_activation_count("review", "rows", "row-column"))
        self.assertEqual(2, RIG.visible_activation_count("review", "cells", "row-column"))

    def test_visible_board_oracle_counts_block_row_column_stages(self):
        self.assertEqual(1, RIG.visible_activation_count("review", "blocks", "block-row-column"))
        self.assertEqual(2, RIG.visible_activation_count("review", "rows", "block-row-column"))

    def test_reads_visible_zh_tw_board_phase(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "board.xml"
            path.write_text(
                '<hierarchy><node text="選格中 · 第 1 / 2 次" /></hierarchy>',
                encoding="utf-8",
            )
            self.assertEqual("cells", RIG.board_phase_from_xml(path))

    def test_reads_visible_scan_mode_value_without_opening_select_dialog(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.xml"
            path.write_text(
                '<hierarchy><node text="掃描方式" clickable="false" '
                'bounds="[66,853][249,913]" />'
                '<node text="先列後格" clickable="true" '
                'bounds="[66,931][1014,1078]" /></hierarchy>',
                encoding="utf-8",
            )
            self.assertEqual(
                "row-column", RIG.scan_mode_from_settings_xml(path)
            )

    def test_reads_native_scan_mode_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.xml"
            path.write_text(
                '<hierarchy><node text="掃描模式" clickable="false" '
                'bounds="[216,304][400,374]" />'
                '<node text="先列後格" clickable="false" '
                'bounds="[216,374][376,436]" /></hierarchy>',
                encoding="utf-8",
            )
            self.assertEqual(
                "row-column", RIG.scan_mode_from_settings_xml(path)
            )

    def test_scan_mode_reader_ignores_offscreen_webview_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.xml"
            path.write_text(
                '<hierarchy><node text="區塊、列、格" clickable="true" '
                'bounds="[0,0][0,0]" />'
                '<node text="Rows, then columns" clickable="true" '
                'bounds="[66,931][1014,1078]" /></hierarchy>',
                encoding="utf-8",
            )
            self.assertEqual(
                "row-column", RIG.scan_mode_from_settings_xml(path)
            )

    def test_reads_current_camera_input_without_opening_select_dialog(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.xml"
            path.write_text(
                '<hierarchy><node text="開關輸入" clickable="false" '
                'bounds="[66,853][249,913]" />'
                '<node text="相機動作" clickable="true" '
                'bounds="[66,931][1014,1078]" /></hierarchy>',
                encoding="utf-8",
            )
            label = RIG.switch_input_label_from_settings_xml(path)
            self.assertEqual("相機動作", label)
            self.assertTrue(RIG.is_camera_switch_input_label(label))

    def test_reads_native_camera_input_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.xml"
            path.write_text(
                '<hierarchy><node text="開關輸入" clickable="false" '
                'bounds="[216,304][400,374]" />'
                '<node text="相機動作" clickable="false" '
                'bounds="[216,374][376,436]" /></hierarchy>',
                encoding="utf-8",
            )
            label = RIG.switch_input_label_from_settings_xml(path)
            self.assertEqual("相機動作", label)
            self.assertTrue(RIG.is_camera_switch_input_label(label))

    def test_switch_input_reader_ignores_hidden_and_unrelated_off_labels(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.xml"
            path.write_text(
                '<hierarchy><node text="Off" clickable="true" '
                'bounds="[0,0][0,0]" />'
                '<node text="Continue input (off)" clickable="true" '
                'bounds="[66,400][1014,540]" />'
                '<node text="Buttons — keep volume control" clickable="true" '
                'bounds="[66,931][1014,1078]" /></hierarchy>',
                encoding="utf-8",
            )
            label = RIG.switch_input_label_from_settings_xml(path)
            self.assertEqual("Buttons — keep volume control", label)
            self.assertFalse(RIG.is_camera_switch_input_label(label))

    def test_builds_downloaded_cheek_calibration_pack_without_private_frames(self):
        rig = object.__new__(RIG.OpticalRig)
        manifest = {
            "sources": [{
                "id": "public-video",
                "url": "https://example.org/public.webm",
                "page": "https://example.org/source",
                "license": "CC BY 4.0",
                "author": "Example author",
                "sha1": "0123456789abcdef0123456789abcdef01234567",
            }],
            "cheek_cases": [{
                "id": "public-positive",
                "source": "public-video",
                "rest_at": 0.25,
                "expect": "activate",
            }]
        }
        cases = rig.downloaded_cheek_calibration_cases(manifest)
        self.assertEqual(7, len(cases))
        self.assertEqual("no_activate", cases[0]["expect"])
        self.assertTrue(all(case["source"] == "public-video" for case in cases))
        self.assertTrue(all("frames" not in case for case in cases))
        self.assertEqual(6, sum(case["expect"] == "activate" for case in cases))

    def test_rejects_unlicensed_or_unverified_cheek_calibration_source(self):
        rig = object.__new__(RIG.OpticalRig)
        manifest = {
            "sources": [{"id": "private-video", "url": "C:/upload.mp4"}],
            "cheek_cases": [{
                "id": "private-positive",
                "source": "private-video",
                "expect": "activate",
            }],
        }
        self.assertEqual([], rig.downloaded_cheek_calibration_cases(manifest))

    def test_public_source_policy_has_no_local_media_fallback(self):
        source = {
            "url": "file:///C:/private-face.mp4",
            "page": "https://example.org/source",
            "license": "CC BY 4.0",
            "author": "Example author",
            "sha1": "0123456789abcdef0123456789abcdef01234567",
        }

        self.assertFalse(optical_sources.is_licensed_public_source(source))

    def test_public_face_scale_tracks_camera_zoom_for_seventy_percent_target(self):
        rig = object.__new__(RIG.OpticalRig)
        case = {"face_height_at_zoom_1x": 0.26, "target_face_height": 0.70}
        rig.active_zoom_ratio = 2.4
        self.assertAlmostEqual(1.1218, rig.case_display_scale(case), places=3)
        rig.active_zoom_ratio = 4.0
        self.assertAlmostEqual(0.6731, rig.case_display_scale(case), places=3)

    def test_face_overlay_measurement_excludes_bottom_progress_meter(self):
        preview = (36, 388, 1044, 1706)
        face = [(x, y) for x in range(300, 700, 10) for y in (600, 1520)]
        face += [(x, y) for x in (300, 690) for y in range(600, 1521, 10)]
        progress = [(x, 1668) for x in range(90, 190)]
        measured = RIG.face_overlay_coverage_from_points(face + progress, preview)
        self.assertAlmostEqual(920 / 1318, measured["height_fraction"], places=3)
        self.assertEqual([300, 600, 690, 1520], measured["bounds"])


class CoordinateAtlasDecoderTest(unittest.TestCase):
    def _decode(self, pixel, size=(512, 384)):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "atlas.png"
            write_rgb_png(path, size[0], size[1], pixel)
            return RIG.decode_coordinate_atlas_from_png(
                path, (0, 0, 512, 384)
            )

    def _atlas_pixel(self, coordinate_for_position=lambda column, row: (column, row)):
        def pixel(x, y):
            tag = 128
            column, row = x // tag, y // tag
            local_x, local_y = x % tag, y % tag
            gutter, frame, quiet = 6, 8, 8
            outer = tag - gutter * 2
            if not (gutter <= local_x < gutter + outer and gutter <= local_y < gutter + outer):
                return (0, 0, 0)
            if (
                local_x < gutter + frame or local_x >= gutter + outer - frame or
                local_y < gutter + frame or local_y >= gutter + outer - frame
            ):
                return (245, 245, 245)
            start = gutter + frame + quiet
            payload_size = tag - start * 2
            if not (start <= local_x < start + payload_size and start <= local_y < start + payload_size):
                return (0, 0, 0)
            matrix_x = int((local_x - start) * 5 / payload_size)
            matrix_y = int((local_y - start) * 5 / payload_size)
            cell = payload_size / 5.0
            in_cell_x = (local_x - start) - matrix_x * cell
            in_cell_y = (local_y - start) - matrix_y * cell
            inset = max(1.0, cell * 0.12)
            encoded_column, encoded_row = coordinate_for_position(column, row)
            bit = RIG._binary_tag_bits(encoded_column, encoded_row)[matrix_y][matrix_x]
            if bit and inset <= in_cell_x < cell - inset and inset <= in_cell_y < cell - inset:
                return (245, 245, 245)
            return (0, 0, 0)
        return pixel

    def test_binary_payload_survives_rotation_mirror_and_bit_error(self):
        matrix = RIG._binary_tag_bits(9, 5)
        matrix[2][2] ^= 1
        transformed = RIG._rotate_binary_matrix(
            [list(reversed(row)) for row in matrix]
        )
        decoded = RIG._decode_binary_tag(transformed, 12, 7)
        self.assertEqual((9, 5), (decoded["column"], decoded["row"]))

    def test_decodes_monochrome_coordinate_tags(self):
        decoded = self._decode(self._atlas_pixel())
        self.assertGreaterEqual(decoded["binary_tags"], 10)
        self.assertAlmostEqual(256, decoded["desktop_center"][0], delta=10)
        self.assertAlmostEqual(192, decoded["desktop_center"][1], delta=10)
        self.assertGreater(decoded["spatial_fit"]["inlier_fraction"], 0.9)

    def test_rejects_spatially_shuffled_valid_tags(self):
        def shuffled(column, row):
            return ((column * 3 + row) % 4, (row * 2 + column) % 3)

        with self.assertRaisesRegex(ValueError, "spatially incoherent|singular"):
            self._decode(self._atlas_pixel(shuffled))


class CameraZoomGeometryTest(unittest.TestCase):
    def test_inverse_homography_projects_desktop_to_phone(self):
        point = RIG.atlas_point_to_phone(
            [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
            0.25,
            0.75,
            (1000, 2000),
        )
        self.assertAlmostEqual(250.0, point[0])
        self.assertAlmostEqual(1500.0, point[1])
        atlas = RIG.phone_point_to_atlas(
            [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
            point[0], point[1], (1000, 2000),
        )
        self.assertAlmostEqual(0.25, atlas[0])
        self.assertAlmostEqual(0.75, atlas[1])

    def test_calculates_center_crop_needed_to_cover_preview(self):
        monitor = [(25, 25), (75, 25), (75, 75), (25, 75)]
        multiplier = RIG.required_zoom_multiplier(monitor, (0, 0, 100, 100))
        self.assertAlmostEqual(2.0, multiplier, places=5)
        self.assertEqual(3.4, RIG.round_camera_zoom_up(3.21))
        self.assertEqual(4.0, RIG.round_camera_zoom_up(5.0))
        self.assertEqual(2.4, RIG.comfortable_camera_zoom(1.0, 3.4))
        self.assertEqual(1.0, RIG.comfortable_camera_zoom(1.0, 1.0))

    def test_rejects_zoom_only_solution_when_monitor_misses_center(self):
        monitor = [(0, 0), (20, 0), (20, 20), (0, 20)]
        self.assertIsNone(
            RIG.required_zoom_multiplier(monitor, (40, 40, 100, 100))
        )

    def test_reads_real_setup_preview_and_zoom(self):
        xml = """<hierarchy><node class="android.widget.FrameLayout" bounds="[0,0][1080,2168]">
          <node class="android.widget.TextView" text="未偵測到臉部" bounds="[36,340][1044,456]" />
          <node class="android.widget.ScrollView" bounds="[36,1362][1044,2168]">
            <node class="android.widget.TextView" text="相機縮放：1.6 倍" bounds="[36,1929][431,1995]" />
          </node>
        </node></hierarchy>"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "setup.xml"
            path.write_text(xml, encoding="utf-8")
            geometry = RIG.camera_setup_geometry(path)
        self.assertEqual((36, 456, 1044, 1362), geometry["preview_rect"])
        self.assertEqual(1.6, geometry["zoom_ratio"])

    def test_prefers_explicit_stable_camera_preview_container(self):
        xml = """<hierarchy><node class="android.widget.FrameLayout" bounds="[0,0][1080,2168]">
          <node class="android.widget.TextView" text="未偵測到臉部" bounds="[54,392][750,468]" />
          <node class="android.widget.FrameLayout" bounds="[36,340][1044,1656]" />
          <node class="android.widget.ScrollView" bounds="[36,1656][1044,2168]">
            <node class="android.widget.TextView" text="縮放 1.6×" bounds="[546,1824][1044,1890]" />
          </node>
        </node></hierarchy>"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "setup.xml"
            path.write_text(xml, encoding="utf-8")
            geometry = RIG.camera_setup_geometry(path)
        self.assertEqual((36, 340, 1044, 1656), geometry["preview_rect"])
        self.assertEqual(1.6, geometry["zoom_ratio"])

    def test_reads_material_card_preview_and_compact_overlay_zoom(self):
        xml = """<hierarchy><node class="android.widget.FrameLayout" bounds="[0,0][1080,2168]">
          <node class="androidx.cardview.widget.CardView" content-desc="相機預覽" bounds="[36,388][1044,1706]">
            <node class="android.widget.TextView" text="3.4×" bounds="[432,1514][648,1658]" />
          </node>
        </node></hierarchy>"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "setup.xml"
            path.write_text(xml, encoding="utf-8")
            geometry = RIG.camera_setup_geometry(path)
        self.assertEqual((36, 388, 1044, 1706), geometry["preview_rect"])
        self.assertEqual(3.4, geometry["zoom_ratio"])

    def test_setup_geometry_falls_back_to_prior_stable_ui_dump(self):
        valid_xml = """<hierarchy><node class="android.widget.FrameLayout" bounds="[0,0][1080,2168]">
          <node class="androidx.cardview.widget.CardView" content-desc="Camera preview" bounds="[36,388][1044,1706]">
            <node class="android.widget.TextView" text="2.4×" bounds="[432,1514][648,1658]" />
          </node>
        </node></hierarchy>"""
        with tempfile.TemporaryDirectory() as directory:
            prior = Path(directory) / "prior.xml"
            prior.write_text(valid_xml, encoding="utf-8")
            selected, geometry = RIG.camera_setup_geometry_with_fallback(
                None, prior
            )
        self.assertEqual(prior, selected)
        self.assertEqual((36, 388, 1044, 1706), geometry["preview_rect"])
        self.assertEqual(2.4, geometry["zoom_ratio"])


class OpenCvFramebufferTest(unittest.TestCase):
    def test_default_input_desktop_is_interactive_even_if_gdi_capture_probe_fails(self):
        with mock.patch.object(RIG, "windows_input_desktop_name", return_value="Default"):
            with mock.patch.object(RIG, "windows_desktop_pixels_available", return_value=False):
                self.assertTrue(RIG.windows_desktop_is_interactive())

    def test_secure_input_desktop_is_not_interactive(self):
        with mock.patch.object(RIG, "windows_input_desktop_name", return_value="Winlogon"):
            self.assertFalse(RIG.windows_desktop_is_interactive())

    def test_release_runner_has_no_private_cheek_replay_switch(self):
        runner = (SCRIPT_DIR / "optical-rig-test.py").read_text(encoding="utf-8")
        self.assertNotIn("--with-local-cheek", runner)
        self.assertNotIn("testdata/optical-rig/local", runner)
        self.assertNotIn("load_local_cheek", runner)
        self.assertFalse((SCRIPT_DIR / "import-cheek-calibration.py").exists())

    def test_video_scheduler_drops_late_frames_without_accumulating_drift(self):
        self.assertEqual(1, optical_stimulus.video_frames_due(10.0, 10.0, 1 / 30))
        self.assertEqual(3, optical_stimulus.video_frames_due(10.1, 10.0, 1 / 30))

    def test_presenter_resolves_only_verified_media_cache_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            presenter = object.__new__(optical_stimulus.OpenCvStimulus)
            presenter.media_root = Path(directory)
            self.assertEqual(
                Path(directory).resolve() / "public.webm",
                presenter._resolve("/media/public.webm"),
            )
            with self.assertRaisesRegex(ValueError, "open-data media cache"):
                presenter._resolve("/local/private-face.mp4")
            with self.assertRaisesRegex(ValueError, "open-data media cache"):
                presenter._resolve("C:/private-face.mp4")

    def test_presenter_registry_is_owned_and_removed_by_exact_pid(self):
        with tempfile.TemporaryDirectory() as directory:
            optical_stimulus.register_presenter(directory, "idle", "test title")
            path = optical_stimulus.presenter_registry_path(directory)
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(optical_stimulus.os.getpid(), payload["pid"])
            self.assertEqual("idle", payload["mode"])
            self.assertLess(abs(time.time() - payload["registered_at"]), 5)
            optical_stimulus.unregister_presenter(directory)
            self.assertFalse(path.exists())

    def test_escape_aborts_presenter_without_killing_process(self):
        presenter = object.__new__(optical_stimulus.OpenCvStimulus)
        presenter.hwnd = 123
        presenter.topmost = True
        presenter.operator_abort = False
        presenter.error = None
        presenter.stop_event = threading.Event()
        presenter.condition = threading.Condition()
        presenter._handle_operator_key(27)
        self.assertTrue(presenter.operator_abort)
        self.assertTrue(presenter.stop_event.is_set())
        self.assertIn("Esc", str(presenter.error))

    def test_t_toggles_only_presenter_topmost_state(self):
        presenter = object.__new__(optical_stimulus.OpenCvStimulus)
        presenter.hwnd = 123
        presenter.topmost = True
        with mock.patch.object(optical_stimulus, "set_window_topmost", return_value=True) as setter:
            presenter._handle_operator_key(ord("t"))
        setter.assert_called_once_with(123, False)
        self.assertFalse(presenter.topmost)

    def test_enabling_topmost_also_raises_presenter_above_existing_topmost_window(self):
        user32 = mock.Mock()
        user32.SetWindowPos.return_value = 1
        with mock.patch.object(optical_stimulus, "windows_user32", return_value=user32):
            self.assertTrue(optical_stimulus.set_window_topmost(123, True))

        user32.BringWindowToTop.assert_called_once_with(123)

    def test_active_presenter_periodically_reasserts_topmost_without_focus(self):
        presenter = object.__new__(optical_stimulus.OpenCvStimulus)
        presenter.hwnd = 123
        presenter.topmost = True
        presenter._next_topmost_refresh = 0.0
        with mock.patch.object(optical_stimulus, "set_window_topmost", return_value=True) as setter:
            self.assertTrue(presenter._refresh_topmost(now=10.0))
            self.assertFalse(presenter._refresh_topmost(now=10.1))
            self.assertTrue(presenter._refresh_topmost(now=10.6))

        self.assertEqual(
            [mock.call(123, True), mock.call(123, True)],
            setter.call_args_list,
        )

    def test_manifest_uses_visually_verified_closed_eye_frames(self):
        manifest = json.loads(
            (SCRIPT_DIR.parent / "testdata/optical-rig/sources.json").read_text(
                encoding="utf-8"
            )
        )
        cases = {case["id"]: case for case in manifest["blink_cases"]}
        sources = {source["id"]: source for source in manifest["sources"]}
        cheek_cases = {case["id"]: case for case in manifest["cheek_cases"]}
        self.assertEqual(0.75, sources["commons_blinking"]["rest_at_s"])
        self.assertEqual(0.0, sources["commons_smiling"]["rest_at_s"])
        self.assertEqual(0.26, cheek_cases["cheek_smile_positive"]["face_height_at_zoom_1x"])
        self.assertEqual(0.70, cheek_cases["cheek_smile_positive"]["target_face_height"])
        for source in sources.values():
            self.assertTrue(source["url"].startswith("https://"))
            self.assertTrue(all(source.get(field) for field in (
                "page", "license", "author", "sha1"
            )))
        self.assertEqual(
            [0.75, 0.25, 0.75, 2.0, 0.75],
            [item["start"] for item in cases["blink_two_gestures_recovery"]["stills"]],
        )
        self.assertEqual(
            [0.25, 2.0, 3.0],
            [
                cases["blink_long_positive_%02d" % index]["stills"][1]["start"]
                for index in range(1, 4)
            ],
        )
        continuous = cases["blink_slow_continuous_02"]
        self.assertEqual((1.4, 2.1, 0.15), (
            continuous["start"], continuous["end"], continuous["rate"],
        ))

    def test_cheek_runtime_uses_only_downloaded_manifest_videos(self):
        manifest = json.loads(
            (SCRIPT_DIR.parent / "testdata/optical-rig/sources.json").read_text(
                encoding="utf-8"
            )
        )
        cases = manifest["cheek_cases"]
        self.assertGreaterEqual(len(cases), 3)
        self.assertTrue(all("source" in case for case in cases))
        self.assertTrue(all("frames" not in case for case in cases))
        self.assertTrue(any(case["expect"] == "activate" for case in cases))
        self.assertTrue(any(case["expect"] == "no_activate" for case in cases))

    def test_blank_framebuffer_is_exact_black(self):
        _, numpy = optical_stimulus.load_opencv(SCRIPT_DIR.parent)
        presenter = object.__new__(optical_stimulus.OpenCvStimulus)
        presenter.numpy = numpy
        presenter.desktop_rect = (0, 0, 32, 24)
        blank = presenter._background({})
        self.assertEqual((24, 32, 3), blank.shape)
        self.assertEqual(0, int(numpy.count_nonzero(blank)))

    def test_idle_framebuffer_is_dim_but_identifiable(self):
        cv2, numpy = optical_stimulus.load_opencv(SCRIPT_DIR.parent)
        standby = optical_stimulus.render_idle_cue(cv2, numpy, 640, 360)

        self.assertEqual((360, 640, 3), standby.shape)
        self.assertGreater(int(numpy.count_nonzero(standby)), 0)
        self.assertLessEqual(int(standby.max()), 96)
        self.assertGreater(len(numpy.unique(standby.reshape(-1, 3), axis=0)), 3)

    def test_idle_cue_is_visible_inside_any_camera_sized_crop(self):
        cv2, numpy = optical_stimulus.load_opencv(SCRIPT_DIR.parent)
        standby = optical_stimulus.render_idle_cue(cv2, numpy, 1920, 1080)
        for left, top in ((0, 0), (744, 180), (1488, 0), (1488, 360)):
            crop = standby[top:top + 720, left:left + 432]
            self.assertEqual((720, 432, 3), crop.shape)
            self.assertGreater(int(crop.max()), 40)
            self.assertGreater(len(numpy.unique(crop.reshape(-1, 3), axis=0)), 3)

    def test_runtime_bootstrap_places_public_face_at_reused_camera_aim(self):
        state = RIG.runtime_bootstrap_face_state(
            {
                "purpose": "rig-session-only",
                "desktop_rect": [-1920, 0, 3840, 1080],
                "desktop_stimulus_center": [1656.4, 360.2],
            },
            {"filename": "public.webm", "rest_at_s": 0.75},
            (-1920, 0, 3840, 1080),
        )
        self.assertEqual("video_still", state["mode"])
        self.assertEqual([3576, 360], state["center"])
        self.assertEqual("/media/public.webm", state["url"])
        self.assertEqual(0.75, state["start"])

    def test_active_presenter_starts_on_identifiable_standby(self):
        presenter = object.__new__(optical_stimulus.OpenCvStimulus)
        presenter.root = SCRIPT_DIR.parent
        presenter.media_root = SCRIPT_DIR.parent / "testdata/optical-rig/downloaded"
        presenter.desktop_rect = (0, 0, 640, 360)
        presenter.cv2, presenter.numpy = optical_stimulus.load_opencv(
            SCRIPT_DIR.parent
        )
        prepared = presenter._prepare({"mode": "standby"})
        frame, ended = presenter._render_state(
            {"mode": "standby"}, prepared
        )

        self.assertFalse(ended)
        self.assertGreater(int(presenter.numpy.count_nonzero(frame)), 0)
        self.assertLessEqual(int(frame.max()), 96)

    def test_completed_sequence_freezes_last_face_frame(self):
        _, numpy = optical_stimulus.load_opencv(SCRIPT_DIR.parent)
        presenter = object.__new__(optical_stimulus.OpenCvStimulus)
        presenter.numpy = numpy
        presenter.cv2 = mock.Mock()
        presenter.desktop_rect = (0, 0, 32, 24)
        face_frame = numpy.full((8, 10, 3), 127, dtype=numpy.uint8)
        state = {
            "mode": "sequence",
            "frames": [{"url": "/media/open.png", "ms": 100}],
        }
        prepared = {
            "index": 1,
            "deadline": 0.0,
            "ended": False,
            "frame": face_frame,
        }

        frame, ended = presenter._render_state(state, prepared)

        self.assertTrue(ended)
        self.assertGreater(int(numpy.count_nonzero(frame)), 0)
        self.assertTrue(numpy.array_equal(frame[8:16, 11:21], face_frame))

    def test_runtime_rig_has_no_explicit_black_transitions(self):
        runner = (SCRIPT_DIR / "optical-rig-test.py").read_text(encoding="utf-8")
        self.assertNotIn('mode="blank"', runner)
        self.assertNotIn("idle black presenter", runner)

    def test_atlas_covers_partial_bottom_tile_without_browser_gap(self):
        _, numpy = optical_stimulus.load_opencv(SCRIPT_DIR.parent)
        atlas = optical_stimulus.render_atlas(numpy, 1536, 864)
        self.assertEqual((864, 1536, 3), atlas.shape)
        # 864 is not divisible by the 128px tag size. The former browser
        # renderer left rows 768..863 entirely black.
        self.assertGreater(int(numpy.count_nonzero(atlas[768:864])), 0)

    def test_calibration_audio_oracle_counts_only_shine_owned_starts(self):
        log = "\n".join([
            "AudioPlaybackConfiguration piid:1 deviceId:0 u/pid:10313/4535 state:started",
            "AudioPlaybackConfiguration piid:2 deviceId:0 u/pid:10313/9957 state:started",
            "AudioPlaybackConfiguration piid:3 deviceId:0 u/pid:10313/4535 state:stopped",
            "AudioPlaybackConfiguration piid:4 deviceId:0 u/pid:10313/4535 state:started",
        ])
        self.assertEqual(2, RIG.app_audio_playback_start_count(log, "4535"))

    def test_calibration_audio_oracle_recognizes_system_tts_speech(self):
        log = "\n".join([
            "AudioPlaybackConfiguration piid:1 u/pid:1000/5568 state:started "
            "attr:AudioAttributes: usage=USAGE_MEDIA content=CONTENT_TYPE_SPEECH",
            "AudioPlaybackConfiguration piid:2 u/pid:10313/4535 state:started "
            "attr:AudioAttributes: usage=USAGE_MEDIA content=CONTENT_TYPE_MUSIC",
            "AudioPlaybackConfiguration piid:3 u/pid:1000/5568 state:stopped "
            "attr:AudioAttributes: usage=USAGE_MEDIA content=CONTENT_TYPE_SPEECH",
        ])
        self.assertEqual(1, RIG.speech_audio_playback_start_count(log))

    def test_tts_oracle_gates_blink_calibration_not_cheek_calibration(self):
        blink_source = inspect.getsource(RIG.OpticalRig.calibrate_long_blink)
        cheek_source = inspect.getsource(RIG.OpticalRig.calibrate_cheek)
        self.assertIn("speech_audio_playback_start_count", blink_source)
        self.assertNotIn("speech_audio_playback_start_count", cheek_source)


if __name__ == "__main__":
    unittest.main()
