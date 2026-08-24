import unittest

from scripts.device_test_common import (
    camera_setup_control_group_alignment_drift,
    camera_setup_excessively_padded_buttons,
    camera_permission_is_granted,
    find_excessive_related_gaps,
    find_edge_alignment_drift,
    find_geometry_drift,
    find_region_allocation_violations,
    infer_camera_preview_metrics,
    power_state_is_noninteractive,
    touch_target_size_exemption,
)


class CameraPreviewGeometryTest(unittest.TestCase):
    def nodes(self, status_bottom, controls_top):
        return [
            {"cls": "android.widget.TextView", "bounds": (36, 124, 1044, 218)},
            {"cls": "android.widget.TextView", "bounds": (36, 218, 1044, status_bottom)},
            {"cls": "android.widget.ScrollView", "bounds": (36, controls_top, 1044, 2168)},
        ]

    def test_captured_before_preview_is_identified_as_tiny(self):
        metrics = infer_camera_preview_metrics(self.nodes(777, 982), 2168)
        self.assertEqual(metrics["height"], 205)
        self.assertLess(metrics["screen_fraction"], 0.25)

    def test_captured_after_preview_uses_a_substantial_screen_area(self):
        metrics = infer_camera_preview_metrics(self.nodes(512, 1362), 2168)
        self.assertEqual(metrics["height"], 850)
        self.assertGreater(metrics["screen_fraction"], 0.25)

    def test_accessible_preview_frame_provides_exact_bounds(self):
        nodes = self.nodes(340, 1362) + [{
            "cls": "android.widget.FrameLayout",
            "desc": "相機預覽",
            "bounds": (36, 340, 1044, 1450),
        }]
        metrics = infer_camera_preview_metrics(nodes, 2400)
        self.assertEqual(metrics["top"], 340)
        self.assertEqual(metrics["bottom"], 1450)
        self.assertEqual(metrics["source"], "accessibility-frame")

    def test_inset_preview_banner_is_not_mistaken_for_header(self):
        nodes = self.nodes(340, 1362) + [{
            "cls": "android.widget.TextView",
            "bounds": (54, 360, 1026, 420),
        }]
        metrics = infer_camera_preview_metrics(nodes, 2400)
        self.assertEqual(metrics["top"], 340)


class GeneralLayoutGraphTest(unittest.TestCase):
    def test_semantic_gap_rule_is_screen_agnostic(self):
        relationships = [
            {"source": "label", "target": "control", "source_end": 40, "target_start": 48},
            {"source": "waste", "target": "control", "source_end": 40, "target_start": 90},
        ]
        findings = find_excessive_related_gaps(relationships, maximum_gap=20)
        self.assertEqual([item["source"] for item in findings], ["waste"])

    def test_geometry_drift_compares_named_regions_across_states(self):
        snapshots = [
            {"name": "primary-visual", "state": "idle", "bounds": (0, 100, 300, 500)},
            {"name": "primary-visual", "state": "active", "bounds": (0, 100, 300, 500)},
            {"name": "primary-visual", "state": "error", "bounds": (0, 130, 300, 500)},
        ]
        findings = find_geometry_drift(snapshots, tolerance=1)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["state"], "error")

    def test_region_allocation_uses_relative_ranges(self):
        findings = find_region_allocation_violations([
            {"name": "preview", "role": "primary-visual", "fraction": 0.45, "minimum_fraction": 0.40},
            {"name": "tiny", "role": "primary-visual", "fraction": 0.18, "minimum_fraction": 0.40},
        ])
        self.assertEqual([item["name"] for item in findings], ["tiny"])

    def test_edge_alignment_uses_the_group_anchor_not_screen_pixels(self):
        findings = find_edge_alignment_drift([
            {"name": "first", "edge": 320},
            {"name": "second", "edge": 320},
            {"name": "ragged", "edge": 250},
        ])
        self.assertEqual([item["name"] for item in findings], ["ragged"])


class EffectiveTouchTargetTest(unittest.TestCase):
    def test_board_tiles_use_the_full_shell_switch_surface(self):
        reason = touch_target_size_exemption(
            "Communication-board",
            {"cls": "android.widget.Button", "bounds": (24, 502, 270, 622)},
            (0, 0, 1080, 2168),
        )
        self.assertEqual(reason, "board-shell-is-the-effective-switch-target")

    def test_webview_checkbox_glyph_uses_its_label_target(self):
        reason = touch_target_size_exemption(
            "Configuration",
            {"cls": "android.widget.CheckBox", "bounds": (78, 232, 144, 376)},
            (0, 0, 1080, 2168),
        )
        self.assertEqual(reason, "webview-label-is-the-effective-checkbox-target")

    def test_camera_control_clipped_at_viewport_edge_is_not_measured_as_small(self):
        reason = touch_target_size_exemption(
            "Camera-setup",
            {"cls": "android.widget.Button", "bounds": (48, 2064, 528, 2168)},
            (0, 0, 1080, 2168),
        )
        self.assertEqual(reason, "accessibility-bounds-clipped-at-viewport-edge")

    def test_webview_control_slice_at_bottom_edge_is_not_measured_as_small(self):
        reason = touch_target_size_exemption(
            "Configuration",
            {"cls": "android.widget.EditText", "bounds": (66, 2056, 1014, 2168)},
            (0, 0, 1080, 2168),
        )
        self.assertEqual(reason, "accessibility-bounds-clipped-at-viewport-edge")

    def test_genuinely_small_independent_button_is_not_exempt(self):
        reason = touch_target_size_exemption(
            "Camera-setup",
            {"cls": "android.widget.Button", "bounds": (40, 500, 160, 620)},
            (0, 0, 1080, 2168),
        )
        self.assertIsNone(reason)


class CameraControlPaddingTest(unittest.TestCase):
    def button(self, text, bounds):
        return {
            "cls": "android.widget.Button",
            "text": text,
            "bounds": bounds,
        }

    def test_equal_weight_cells_from_captured_layout_are_flagged(self):
        nodes = [
            self.button("長眨眼", (322, 1386, 665, 1530)),
            self.button("臉頰抽動", (689, 1386, 1032, 1530)),
            self.button("下一個相機", (621, 1554, 1031, 1698)),
            self.button("-100", (443, 1722, 725, 1866)),
            self.button("+100", (749, 1722, 1032, 1866)),
            self.button("縮小", (443, 1890, 725, 2034)),
            self.button("放大", (749, 1890, 1032, 2034)),
            self.button("開始設定", (48, 2064, 528, 2208)),
            self.button("完成", (552, 2064, 1032, 2208)),
        ]
        findings = camera_setup_excessively_padded_buttons(nodes, density_dpi=480)
        self.assertEqual(
            {item["name"] for item in findings},
            {"長眨眼", "臉頰抽動", "下一個相機", "-100", "+100", "縮小", "放大"},
        )

    def test_content_sized_controls_and_primary_actions_pass(self):
        nodes = [
            self.button("長眨眼", (498, 1386, 714, 1530)),
            self.button("臉頰抽動", (738, 1386, 1002, 1530)),
            self.button("-100", (684, 1722, 834, 1866)),
            self.button("+100", (858, 1722, 1008, 1866)),
            self.button("開始設定", (48, 2064, 528, 2208)),
            self.button("完成", (552, 2064, 1032, 2208)),
        ]
        self.assertEqual(
            camera_setup_excessively_padded_buttons(nodes, density_dpi=480),
            [],
        )

    def test_different_width_groups_with_a_shared_right_edge_pass(self):
        nodes = [
            self.button("長眨眼", (480, 1386, 744, 1530)),
            self.button("臉頰抽動", (768, 1386, 1032, 1530)),
            self.button("下一個相機", (816, 1554, 1032, 1698)),
            self.button("-100", (684, 1722, 834, 1866)),
            self.button("+100", (858, 1722, 1032, 1866)),
            self.button("開始設定", (48, 2064, 528, 2208)),
            self.button("完成", (552, 2064, 1032, 2208)),
        ]
        self.assertEqual(
            camera_setup_control_group_alignment_drift(nodes, density_dpi=480),
            [],
        )

    def test_control_group_pulled_to_the_left_is_flagged(self):
        nodes = [
            self.button("長眨眼", (146, 1428, 314, 1572)),
            self.button("臉頰抽動", (338, 1428, 546, 1572)),
            self.button("下一個相機", (816, 1596, 1032, 1740)),
            self.button("-100", (684, 1764, 834, 1908)),
            self.button("+100", (858, 1764, 1032, 1908)),
            self.button("縮小", (684, 1900, 834, 2044)),
            self.button("放大", (858, 1900, 1032, 2044)),
            self.button("開始設定", (48, 2064, 528, 2208)),
            self.button("完成", (552, 2064, 1032, 2208)),
        ]
        findings = camera_setup_control_group_alignment_drift(
            nodes, density_dpi=480
        )
        self.assertEqual([item["name"] for item in findings], ["長眨眼 / 臉頰抽動"])

    def test_compound_parameter_grid_is_not_compared_with_gesture_row(self):
        nodes = [
            self.button("長眨眼", (633, 1680, 801, 1824)),
            self.button("臉頰抽動", (825, 1680, 1032, 1824)),
            self.button("-100", (129, 1896, 279, 2040)),
            self.button("+100", (303, 1896, 453, 2040)),
            self.button("縮小", (639, 1896, 789, 2040)),
            self.button("放大", (813, 1896, 951, 2040)),
            self.button("開始設定", (48, 2064, 528, 2208)),
            self.button("完成", (552, 2064, 1032, 2208)),
        ]
        self.assertEqual(
            camera_setup_control_group_alignment_drift(nodes, density_dpi=480),
            [],
        )


class DeviceStateParserTest(unittest.TestCase):
    def test_package_dump_confirms_camera_permission_when_pm_command_is_unavailable(self):
        package_dump = """
          runtime permissions:
            android.permission.CAMERA: granted=true, flags=[ USER_SET]
        """
        self.assertTrue(camera_permission_is_granted("Unknown command: check-permission", package_dump))

    def test_denied_camera_permission_is_not_misread_as_granted(self):
        package_dump = "android.permission.CAMERA: granted=false"
        self.assertFalse(camera_permission_is_granted("", package_dump))

    def test_samsung_dozing_state_is_noninteractive(self):
        power_dump = """
          mWakefulness=Dozing
          mHalInteractiveModeEnabled=false
          mHoldingDisplaySuspendBlocker=false
        """
        self.assertTrue(power_state_is_noninteractive(power_dump))

    def test_awake_interactive_state_is_not_screen_off(self):
        power_dump = """
          mWakefulness=Awake
          mHalInteractiveModeEnabled=true
          mHoldingDisplaySuspendBlocker=true
        """
        self.assertFalse(power_state_is_noninteractive(power_dump))


if __name__ == "__main__":
    unittest.main()
