#!/usr/bin/env python3
# Shared helpers for SHINE AAC physical-device tests. Python 3.7+.

import csv
import re
import time
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
    scrolls = [
        node for node in (nodes or [])
        if node.get("cls", "").endswith("ScrollView") and node.get("bounds")
    ]
    if not scrolls:
        return None
    controls_top = min(node["bounds"][1] for node in scrolls)
    header_bottoms = [
        node["bounds"][3] for node in nodes
        if node.get("cls", "").endswith("TextView")
        and node.get("bounds")
        and node["bounds"][3] <= controls_top
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
    }

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
