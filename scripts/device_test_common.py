#!/usr/bin/env python3
# Shared helpers for SHINE AAC physical-device tests. Python 3.7+.

import csv
import re
import statistics
import time
import unicodedata
from pathlib import Path

THERMAL_NAMES = {
    0: "NONE",
    1: "LIGHT",
    2: "MODERATE",
    3: "SEVERE",
    4: "CRITICAL",
    5: "EMERGENCY",
    6: "SHUTDOWN",
}

def infer_camera_preview_metrics(nodes, screen_height):
    """
    Infer the native Camera Setup preview band from UIAutomator geometry.

    TextureView is not exposed in the accessibility hierarchy. Camera Setup's
    preview sits between the last header/status TextView and the controls
    ScrollView, so those two accessible landmarks give a stable measurement.
    """
    if not screen_height:
        return None
    described_previews = [
        node for node in (nodes or [])
        if (node.get("desc") or "").strip().lower() in (
            "camera preview", "相機預覽"
        )
        and node.get("bounds")
    ]
    if described_previews:
        left, top, right, bottom = max(
            described_previews,
            key=lambda node: (
                (node["bounds"][2] - node["bounds"][0])
                * (node["bounds"][3] - node["bounds"][1])
            ),
        )["bounds"]
        return {
            "top": top,
            "bottom": bottom,
            "height": max(0, bottom - top),
            "screen_fraction": float(max(0, bottom - top)) / float(screen_height),
            "source": "accessibility-frame",
        }
    scrolls = [
        node for node in (nodes or [])
        if node.get("cls", "").endswith("ScrollView") and node.get("bounds")
    ]
    if not scrolls:
        return None
    controls_top = min(node["bounds"][1] for node in scrolls)
    header_texts = [
        node for node in nodes
        if node.get("cls", "").endswith("TextView")
        and node.get("bounds")
        and node["bounds"][3] <= controls_top
    ]
    if not header_texts:
        return None
    header_left = min(node["bounds"][0] for node in header_texts)
    header_bottoms = [
        node["bounds"][3] for node in header_texts
        if node["bounds"][0] <= header_left + 2
    ]
    if not header_bottoms:
        return None
    preview_top = max(header_bottoms)
    preview_height = max(0, controls_top - preview_top)
    return {
        "top": preview_top,
        "bottom": controls_top,
        "height": preview_height,
        "screen_fraction": float(preview_height) / float(screen_height),
        "source": "inferred-landmarks",
    }

def touch_target_size_exemption(surface, node, viewport_bounds=None):
    """Return why a small accessibility node is not the effective touch target."""
    class_name = node.get("cls", "")
    if surface == "Communication-board" and class_name.endswith("Button"):
        # Board tiles are visual scan choices. MainActivity's WebView handles
        # every touch on the enclosing full-screen shell as one switch press.
        return "board-shell-is-the-effective-switch-target"
    if surface == "Configuration" and class_name.endswith("CheckBox"):
        # Android exposes only the 22px checkbox glyph. The enclosing HTML
        # label is the actual clickable target and is measured by the CDP audit.
        return "webview-label-is-the-effective-checkbox-target"
    bounds = node.get("bounds")
    if surface in ("Camera-setup", "Configuration") and bounds and viewport_bounds:
        _, _, _, bottom = bounds
        _, _, _, viewport_bottom = viewport_bounds
        if bottom >= viewport_bottom:
            # ScrollView clips accessibility bounds at its visible edge. A
            # clipped node cannot establish the control's laid-out target size.
            return "accessibility-bounds-clipped-at-viewport-edge"
    return None

def _rendered_text_width_units(text):
    """Approximate glyph width in em without assuming one language or font."""
    units = 0.0
    for character in text or "":
        if character.isspace():
            units += 0.35
        elif unicodedata.east_asian_width(character) in ("W", "F"):
            units += 1.0
        elif character.isupper():
            units += 0.65
        else:
            units += 0.55
    return units

def find_excessive_related_gaps(relationships, maximum_gap=20.0):
    """Evaluate semantic source→target spacing in any rendered layout graph."""
    findings = []
    for relationship in relationships or []:
        gap = relationship.get("target_start", 0) - relationship.get("source_end", 0)
        if gap > maximum_gap:
            item = dict(relationship)
            item["gap"] = round(gap, 1)
            findings.append(item)
    return findings

def find_geometry_drift(snapshots, tolerance=1):
    """Compare named region bounds across locale, scale, or interaction states."""
    grouped = {}
    for snapshot in snapshots or []:
        name = snapshot.get("name")
        bounds = snapshot.get("bounds")
        if not name or not bounds:
            continue
        grouped.setdefault(name, []).append(snapshot)
    findings = []
    for name, samples in grouped.items():
        baseline = samples[0]
        for sample in samples[1:]:
            delta = tuple(
                sample["bounds"][index] - baseline["bounds"][index]
                for index in range(len(baseline["bounds"]))
            )
            if any(abs(value) > tolerance for value in delta):
                findings.append({
                    "name": name,
                    "baseline_state": baseline.get("state"),
                    "state": sample.get("state"),
                    "baseline_bounds": baseline["bounds"],
                    "bounds": sample["bounds"],
                    "delta": delta,
                })
    return findings

def find_region_allocation_violations(regions):
    """Check declared region allocation ranges without screen-specific pixels."""
    findings = []
    for region in regions or []:
        fraction = region.get("fraction")
        if fraction is None:
            continue
        minimum = region.get("minimum_fraction")
        maximum = region.get("maximum_fraction")
        if ((minimum is not None and fraction < minimum)
                or (maximum is not None and fraction > maximum)):
            findings.append({
                "name": region.get("name"),
                "role": region.get("role"),
                "fraction": round(fraction, 4),
                "minimum_fraction": minimum,
                "maximum_fraction": maximum,
            })
    return findings

def find_edge_alignment_drift(items, tolerance=4.0):
    """Find items that break a shared visual edge without fixed screen coordinates."""
    samples = [item for item in (items or []) if item.get("edge") is not None]
    if len(samples) < 2:
        return []
    anchor = statistics.median(item["edge"] for item in samples)
    findings = []
    for item in samples:
        delta = item["edge"] - anchor
        if abs(delta) > tolerance:
            finding = dict(item)
            finding["anchor"] = round(anchor, 1)
            finding["delta"] = round(delta, 1)
            findings.append(finding)
    return findings

def camera_setup_excessively_padded_buttons(nodes, density_dpi, text_size_sp=14.0):
    """
    Find secondary camera-setup buttons whose cells are much wider than their text.

    This uses dp, glyph-width classes, and the bottom action row's geometry. It
    deliberately does not use a captured device's screen width or fixed x/y
    coordinates, so the check applies across resolutions and localizations.
    """
    if not density_dpi:
        return []
    buttons = [
        node for node in (nodes or [])
        if node.get("cls", "").endswith("Button")
        and (node.get("text") or "").strip()
        and node.get("bounds")
    ]
    if not buttons:
        return []
    density = float(density_dpi) / 160.0
    row_tolerance_px = 48.0 * density
    bottom_center = max(
        (node["bounds"][1] + node["bounds"][3]) / 2.0 for node in buttons
    )
    findings = []
    for node in buttons:
        x1, y1, x2, y2 = node["bounds"]
        center = (y1 + y2) / 2.0
        if abs(center - bottom_center) <= row_tolerance_px:
            # The bottom Start/Done pair are intentionally prominent actions.
            continue
        width_dp = (x2 - x1) / density
        text = node["text"].strip()
        estimated_text_dp = _rendered_text_width_units(text) * text_size_sp
        compact_width_dp = max(48.0, estimated_text_dp + 16.0)
        if width_dp > compact_width_dp * 1.4:
            findings.append({
                "name": text,
                "bounds": node["bounds"],
                "width_dp": round(width_dp, 1),
                "compact_width_dp": round(compact_width_dp, 1),
            })
    return findings

def camera_setup_control_group_alignment_drift(
    nodes, density_dpi, tolerance_dp=4.0
):
    """Find secondary control rows that break the common trailing grid edge."""
    if not density_dpi:
        return []
    density = float(density_dpi) / 160.0
    buttons = [
        node for node in (nodes or [])
        if node.get("cls", "").endswith("Button")
        and node.get("bounds")
    ]
    if not buttons:
        return []
    bottom_center = max(
        (node["bounds"][1] + node["bounds"][3]) / 2.0 for node in buttons
    )
    primary_tolerance_px = 48.0 * density
    row_tolerance_px = 24.0 * density
    rows = []
    for button in sorted(
        buttons,
        key=lambda node: (
            (node["bounds"][1] + node["bounds"][3]) / 2.0,
            node["bounds"][0],
        ),
    ):
        center = (button["bounds"][1] + button["bounds"][3]) / 2.0
        if abs(center - bottom_center) <= primary_tolerance_px:
            continue
        row = next(
            (item for item in rows if abs(item["center"] - center) <= row_tolerance_px),
            None,
        )
        if row is None:
            row = {"center": center, "buttons": []}
            rows.append(row)
        row["buttons"].append(button)
    groups = []
    for row in rows:
        groups.append({
            "name": " / ".join(
                node.get("text", "").strip() for node in row["buttons"]
            ),
            "edge": max(node["bounds"][2] for node in row["buttons"]) / density,
            "bounds": (
                min(node["bounds"][0] for node in row["buttons"]),
                min(node["bounds"][1] for node in row["buttons"]),
                max(node["bounds"][2] for node in row["buttons"]),
                max(node["bounds"][3] for node in row["buttons"]),
            ),
        })
    return find_edge_alignment_drift(groups, tolerance_dp)

def camera_permission_is_granted(command_output, package_dump):
    command = (command_output or "").lower()
    if "granted" in command and "not granted" not in command:
        return True
    return bool(re.search(
        r"(?im)^\s*android\.permission\.camera:\s*granted=true\b",
        package_dump or "",
    ))

def power_state_is_noninteractive(power_dump):
    text = power_dump or ""
    wakefulness = re.search(r"(?im)^\s*mWakefulness=(\w+)\s*$", text)
    if wakefulness and wakefulness.group(1).lower() in ("asleep", "dozing"):
        return True
    legacy = re.search(r"(?im)^\s*Wakefulness:\s*(\w+)\s*$", text)
    if legacy and legacy.group(1).lower() in ("asleep", "dozing"):
        return True
    interactive = re.search(r"(?im)^\s*mHalInteractiveModeEnabled=(true|false)\s*$", text)
    display_blocker = re.search(r"(?im)^\s*mHoldingDisplaySuspendBlocker=(true|false)\s*$", text)
    return bool(
        interactive and interactive.group(1).lower() == "false"
        and display_blocker and display_blocker.group(1).lower() == "false"
    )

class ThermalGovernor:
    """
    Device thermal guard.

    Prefer Android's aggregate ThermalStatus because OEM raw temperatures are
    not comparable across devices. Battery temperature is used as a fallback
    and an independent sanity bound.

    shell must be callable like:
        shell("dumpsys", "thermalservice", check=False)
    and return an object with .stdout.
    """
    def __init__(
        self,
        shell,
        csv_path,
        stop_status=2,
        resume_status=0,
        hot_battery_c=42.0,
        resume_battery_c=38.0,
        stable_seconds=30,
        poll_seconds=10,
    ):
        self.shell = shell
        self.csv_path = Path(csv_path)
        self.csv_path.parent.mkdir(parents=True, exist_ok=True)
        self.stop_status = int(stop_status)
        self.resume_status = int(resume_status)
        self.hot_battery_c = float(hot_battery_c)
        self.resume_battery_c = float(resume_battery_c)
        self.stable_seconds = int(stable_seconds)
        self.poll_seconds = int(poll_seconds)
        self.last = None
        if not self.csv_path.exists():
            self.csv_path.write_text(
                "epoch_ms,local_time,label,thermal_status,thermal_name,battery_c,event\n",
                encoding="utf-8",
            )

    def _out(self, *args):
        try:
            r = self.shell(*args, check=False)
            return getattr(r, "stdout", "") or ""
        except Exception:
            return ""

    @staticmethod
    def parse_thermal_status(text):
        patterns = [
            r"(?im)^\s*Thermal Status:\s*(\d+)\s*$",
            r"(?im)^\s*Current Thermal Status:\s*(\d+)\s*$",
            r"(?im)^\s*mStatus:\s*(\d+)\s*$",
            r"(?im)\bthermal(?:\s+status)?\s*[=:]\s*(\d+)\b",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                value = int(m.group(1))
                if 0 <= value <= 6:
                    return value
        return None

    @staticmethod
    def parse_battery_c(text):
        m = re.search(r"(?im)^\s*temperature:\s*(-?\d+)\s*$", text)
        if not m:
            return None
        # dumpsys battery uses tenths of a degree Celsius.
        return int(m.group(1)) / 10.0

    def sample(self, label="", event="sample"):
        thermal_text = self._out("dumpsys", "thermalservice")
        status = self.parse_thermal_status(thermal_text)
        battery_text = self._out("dumpsys", "battery")
        battery_c = self.parse_battery_c(battery_text)
        now = time.time()
        self.last = {
            "epoch_ms": int(now * 1000),
            "status": status,
            "battery_c": battery_c,
        }
        with self.csv_path.open("a", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow([
                int(now * 1000),
                time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now)),
                label,
                "" if status is None else status,
                "UNKNOWN" if status is None else THERMAL_NAMES.get(status, str(status)),
                "" if battery_c is None else "%.1f" % battery_c,
                event,
            ])
        return self.last

    def should_cool(self, sample):
        status = sample.get("status")
        battery_c = sample.get("battery_c")
        return (
            (status is not None and status >= self.stop_status)
            or (battery_c is not None and battery_c >= self.hot_battery_c)
        )

    def cool_enough(self, sample):
        status = sample.get("status")
        battery_c = sample.get("battery_c")
        status_ok = status is None or status <= self.resume_status
        battery_ok = battery_c is None or battery_c <= self.resume_battery_c
        return status_ok and battery_ok

    def format_sample(self, sample):
        status = sample.get("status")
        battery_c = sample.get("battery_c")
        return "thermal=%s battery=%s" % (
            "unknown" if status is None else "%d/%s" % (
                status, THERMAL_NAMES.get(status, "?")
            ),
            "unknown" if battery_c is None else "%.1fC" % battery_c,
        )

    def guard(self, label, on_suspend=None, on_resume=None):
        """
        Returns True if cooldown was entered, False if testing may continue
        immediately.
        """
        first = self.sample(label, "guard")
        if not self.should_cool(first):
            return False

        print("THERMAL COOLDOWN:", label, self.format_sample(first))
        self.sample(label, "cooldown_start")
        if on_suspend:
            on_suspend()

        stable_since = None
        while True:
            time.sleep(max(1, self.poll_seconds))
            current = self.sample(label, "cooldown_poll")
            print("  cooldown:", self.format_sample(current))
            if self.cool_enough(current):
                if stable_since is None:
                    stable_since = time.time()
                if time.time() - stable_since >= self.stable_seconds:
                    break
            else:
                stable_since = None

        self.sample(label, "cooldown_end")
        if on_resume:
            on_resume()
        print("THERMAL RESUME:", label)
        return True
