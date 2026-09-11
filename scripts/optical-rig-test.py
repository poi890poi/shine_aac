#!/usr/bin/env python3
# SHINE AAC monitor -> phone-camera optical regression rig.
# Python 3.7+, no third-party Python packages required.
#
# Standard use:
#   python scripts/optical-rig-test.py
#
# The phone's selected camera faces some part of the PC display. The rig does NOT
# assume which monitor region is visible. It presents one full-desktop coordinate
# atlas, discovers the camera/monitor geometry, uses Camera Setup's real zoom
# control, and centers every licensed public replay stimulus at the decoded camera aim.
# On Windows, a test-scoped guard also suppresses PC sleep/display timeout
# and temporarily disables an active screen saver, restoring state on exit.

import argparse
import ctypes
import importlib.util
import json
import math
import os
import random
import re
import struct
import subprocess
import sys
import threading
import time
import xml.etree.ElementTree as ET
import zlib
from ctypes import wintypes
from pathlib import Path

from android_apk import parse_device_abis, resolve_debug_apk
from android_surface_stimulus import (
    AndroidSurfaceStimulus,
    PRESENTER_PACKAGE,
    parse_adb_devices,
    parse_package_version,
    parse_wm_size,
    resolve_device_roles,
)
from device_test_common import ThermalGovernor
from optical_stimulus import (
    OpenCvStimulus,
    atlas_tag_size,
    enable_per_monitor_dpi_awareness,
    launch_idle_presenter,
)
import optical_sources

ROOT = Path.cwd()
PACKAGE = os.environ.get("SHINE_AAC_TEST_PACKAGE", "org.shineaac.app")
CAMERA_ACTIVITY_FRAGMENT = "CameraSwitchCalibrationActivity"
SETTINGS_ACTIVITY_FRAGMENT = "SettingsActivity"
SOURCES_PATH = ROOT / "testdata/optical-rig/sources.json"
DOWNLOADED = ROOT / "testdata/optical-rig/downloaded"
SESSION_ROOT = ROOT / "testdata/optical-rig/session"
APK_OUTPUT_DIRECTORY = ROOT / "app/build/outputs/apk/debug"
CAMERA_PREFS = "shared_prefs/shine_aac_camera_switch.xml"
CONFIG_PREFS = "shared_prefs/shine_aac_config.xml"
RIG_MONITOR_OCCUPANCY = 0.70
ATLAS_PRESENTATION_ATTEMPTS = 4
ATLAS_CAMERA_SETTLE_SECONDS = 1.0
MIN_RIG_FACE_HEIGHT = 0.55
MAX_RIG_FACE_HEIGHT = 0.82


def face_overlay_coverage_from_points(points, preview_rect):
    """Measure the face overlay while excluding the preview's bottom progress meter."""
    left, top, right, bottom = preview_rect
    preview_height = max(1, bottom - top)
    usable_bottom = bottom - int(round(preview_height * 0.12))
    inside = [
        (x, y) for x, y in points
        if left <= x <= right and top <= y <= usable_bottom
    ]
    if len(inside) < 20:
        return None
    xs = [point[0] for point in inside]
    ys = [point[1] for point in inside]
    bounds = [min(xs), min(ys), max(xs), max(ys)]
    return {
        "bounds": bounds,
        "height_fraction": (bounds[3] - bounds[1]) / float(preview_height),
        "width_fraction": (bounds[2] - bounds[0]) / float(max(1, right - left)),
        "point_count": len(inside),
    }


def runtime_bootstrap_face_state(fixture, source, desktop_rect):
    """Place a relaxed public face at a reused camera aim before app setup."""
    if fixture.get("purpose") != "rig-session-only":
        raise ValueError("fixture is not marked rig-session-only")
    if fixture.get("desktop_rect") != list(desktop_rect):
        raise ValueError("fixture desktop geometry does not match")
    vx, vy, _, _ = desktop_rect
    center = fixture["desktop_stimulus_center"]
    return {
        "mode": "video_still",
        "label": "RUNTIME INITIAL RELAXED FACE",
        "url": "/media/" + source["filename"],
        "start": float(source.get("rest_at_s", 0.0)),
        "center": [
            int(round(float(center[0]) - vx)),
            int(round(float(center[1]) - vy)),
        ],
        "scale": 1.0,
        "background": "#000",
    }


def board_phase_from_xml(xml_path):
    """Read the user-visible scanner phase from a UIAutomator hierarchy."""
    tree = ET.parse(xml_path)
    texts = [
        node.attrib.get("text", "").strip()
        for node in tree.iter("node")
        if node.attrib.get("text", "").strip()
    ]
    phases = [
        ("blink", ("眨眼確認中", "Blink detected")),
        ("review", ("暫停確認", "Review pause")),
        ("stopped", ("已停止", "Stopped")),
        ("blocks", ("選區中", "返回選區", "Scanning blocks", "Back to blocks")),
        ("rows", ("選列中", "返回選列", "Scanning rows", "Back to rows")),
        ("cells", ("選格中", "Scanning items")),
    ]
    for code, prefixes in phases:
        if any(any(text.startswith(prefix) for prefix in prefixes) for text in texts):
            return code
    return None


def scan_mode_from_settings_xml(xml_path):
    """Read the selected scan mode from legacy or native Settings.

    The legacy WebView exposes the selected value as clickable. AndroidX
    Preference exposes the same exact value as a non-clickable summary inside
    a clickable row, so exact localized value matching is the stable oracle.
    """
    labels = {
        "Rows, then columns": "row-column",
        "先列後格": "row-column",
        "Blocks, then rows and columns": "block-row-column",
        "區塊、列、格": "block-row-column",
    }
    try:
        tree = ET.parse(xml_path)
    except (ET.ParseError, OSError):
        return None
    for node in tree.iter("node"):
        attributes = node.attrib
        if attributes.get("bounds") == "[0,0][0,0]":
            continue
        mode = labels.get(attributes.get("text", "").strip())
        if mode:
            return mode
    return None


SWITCH_INPUT_LABELS = (
    "Buttons — keep volume control",
    "按鍵—保留音量控制",
    "Buttons — volume activates",
    "按鍵—音量鍵啟動",
    "Camera gesture",
    "相機動作",
    "Camera long blink",
    "相機長眨眼",
    "Buttons + camera gesture",
    "按鍵＋相機動作",
    "Buttons + camera",
    "按鍵＋相機",
    "Off",
    "關閉",
)


def switch_input_label_from_settings_xml(xml_path):
    """Return the exact visible value of Settings' Switch input select."""
    labels = set(SWITCH_INPUT_LABELS)
    try:
        tree = ET.parse(xml_path)
    except (ET.ParseError, OSError):
        return None
    for node in tree.iter("node"):
        attributes = node.attrib
        if attributes.get("bounds") == "[0,0][0,0]":
            continue
        label = attributes.get("text", "").strip()
        if label in labels:
            return label
    return None


def exact_visible_label(device, xml_path, labels):
    wanted = {label.strip().lower() for label in labels}
    return next((node for node in device.xml_nodes(xml_path)
        if node["text"].strip().lower() in wanted
        and device.node_is_visible_target(node)), None)


def is_camera_switch_input_label(label):
    return label in {
        "Camera gesture", "相機動作",
        "Camera long blink", "相機長眨眼",
        "Buttons + camera gesture", "按鍵＋相機動作",
        "Buttons + camera", "按鍵＋相機",
    }


def visible_activation_count(before_phase, after_phase, scan_mode):
    """Infer 0..2 inputs from the normal board's deterministic review reset."""
    if before_phase != "review":
        raise ValueError("case did not start from the visible review pause")
    if after_phase == "review":
        return 0
    if scan_mode == "row-column":
        mapping = {"rows": 1, "cells": 2}
    elif scan_mode == "block-row-column":
        mapping = {"blocks": 1, "rows": 2}
    else:
        raise ValueError("unknown scan mode: %s" % scan_mode)
    if after_phase not in mapping:
        raise ValueError(
            "phase %s is not a 0..2 activation result for %s"
            % (after_phase, scan_mode)
        )
    return mapping[after_phase]


def face_performance_samples(log_text):
    samples = []
    pattern = re.compile(
        r"(?:FACE|CHEEK)_PERF\s+path=(\S+)\s+frames=(\d+)\s+"
        r"avgUs=(\d+)\s+maxUs=(\d+)\s+size=(\d+)x(\d+)"
    )
    for match in pattern.finditer(log_text):
        samples.append({
            "path": match.group(1),
            "frames": int(match.group(2)),
            "avg_us": int(match.group(3)),
            "max_us": int(match.group(4)),
            "width": int(match.group(5)),
            "height": int(match.group(6)),
        })
    return samples


def cheek_performance_samples(log_text):
    """Compatibility alias for older rig reports/tests."""
    return face_performance_samples(log_text)


def optical_stall_events(log_text):
    states = []
    for source in ("android-camera-long-blink", "android-camera-cheek-twitch"):
        states.extend(
            state for state in e2e_camera_statuses(log_text, source)
            if state in {"cameraStale", "detectorStale"}
        )
    if "SignalStalled" in (log_text or ""):
        states.append("SignalStalled")
    return states


def android_preference_values(xml_text):
    if not xml_text or not xml_text.strip():
        return {}
    root = ET.fromstring(xml_text)
    values = {}
    for child in root:
        name = child.get("name")
        if not name:
            continue
        values[name] = child.text if child.tag == "string" else child.get("value")
    return values


def new_blink_calibration_record(before_xml, after_xml):
    before = android_preference_values(before_xml)
    after = android_preference_values(after_xml)
    try:
        before_timestamp = int(before.get("calibratedAtMs") or 0)
        after_timestamp = int(after.get("calibratedAtMs") or 0)
    except (TypeError, ValueError):
        return None
    required = (
        "longBlinkMs", "zoomRatio", "blinkCloseThreshold",
        "blinkReopenThreshold", "calibratedAtMs"
    )
    if after_timestamp <= before_timestamp or any(name not in after for name in required):
        return None
    return {name: after.get(name) for name in required + ("qualityLabel", "qualityDetail")}


def blink_calibration_quality_is_good(record):
    label = str((record or {}).get("qualityLabel", "")).strip().casefold()
    return label in {"quality good", "品質良好"}


def blink_calibration_artifact_passes(path):
    try:
        result = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return blink_calibration_quality_is_good(result.get("saved_record"))


def new_cheek_calibration_record(before_xml, after_xml):
    before = android_preference_values(before_xml)
    after = android_preference_values(after_xml)
    calibrated_at = after.get("cheekCalibratedAtMs")
    if not calibrated_at or calibrated_at == before.get("cheekCalibratedAtMs"):
        return None
    required = (
        "cheekCalibratedAtMs", "cheekModel", "cheekHoldMs", "zoomRatio",
        "cheekQualityLabel", "cheekQualityDetail",
    )
    if any(name not in after for name in required):
        return None
    return {name: after.get(name) for name in required}

def run(cmd, check=True, timeout=60, cwd=None):
    try:
        r = subprocess.run(
            cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            timeout=timeout
        )
    except subprocess.TimeoutExpired as e:
        out = e.output or b""
        if isinstance(out, bytes):
            out = out.decode("utf-8", errors="replace")
        if check:
            raise RuntimeError("Timed out: %s\n%s" % (" ".join(map(str, cmd)), out))
        class R:
            returncode = 124
            stdout = out
        return R()
    raw = r.stdout or b""
    if isinstance(raw, bytes):
        r.stdout = raw.decode("utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError("Command failed: %s\n%s" % (" ".join(map(str, cmd)), r.stdout))
    return r

def load_device_test_module():
    path = ROOT / "scripts/device-acceptance-test.py"
    if not path.exists():
        raise SystemExit("Missing standard device test: " + str(path))
    spec = importlib.util.spec_from_file_location("shine_device_acceptance", str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def adb_device_inventory(adb):
    result = run([adb, "devices", "-l"], check=False, timeout=20, cwd=ROOT)
    if result.returncode != 0:
        raise ValueError("could not enumerate ADB devices: %s" % (result.stdout or "").strip())
    return parse_adb_devices(result.stdout)


def adb_presenter_versions(adb, devices):
    versions = {}
    for item in devices:
        serial = item["serial"]
        result = run(
            [adb, "-s", serial, "shell", "dumpsys", "package", PRESENTER_PACKAGE],
            check=False, timeout=20, cwd=ROOT,
        )
        version = parse_package_version(result.stdout)
        if version:
            versions[serial] = version
    return versions


def adb_display_size(adb, serial):
    result = run(
        [adb, "-s", serial, "shell", "wm", "size"],
        check=False, timeout=20, cwd=ROOT,
    )
    if result.returncode != 0:
        raise ValueError("could not read presenter display size")
    return parse_wm_size(result.stdout)


def serial_deep_test(device_module, adb, root, outdir, serial):
    """Create the existing device harness with every ADB command scoped to DUT."""
    class SerialDeepTest(device_module.DeepTest):
        def __init__(self):
            super().__init__(adb, root, outdir)
            self.serial = serial

        def adb_cmd(self, *args, check=True, timeout=60):
            return run(
                [self.adb, "-s", self.serial] + list(args),
                check=check, timeout=timeout, cwd=self.root,
            )

        def screenshot(self, name):
            path = self.outdir / "screenshots" / (name + ".png")
            with path.open("wb") as output:
                result = subprocess.run(
                    [
                        self.adb, "-s", self.serial,
                        "exec-out", "screencap", "-p",
                    ],
                    cwd=str(self.root),
                    stdout=output,
                    stderr=subprocess.STDOUT,
                    timeout=30,
                )
            if result.returncode != 0:
                raise RuntimeError("DUT screenshot failed for %s" % self.serial)
            return path

    return SerialDeepTest()

STIMULUS_WINDOW_TITLE = "SHINE AAC Optical Rig"

_WINDOWS_USER32 = None
_WINDOWS_ENUM_PROC = None
_STIMULUS_WINDOW_HWND = None

def windows_user32():
    """Return 64-bit-safe User32 bindings used by the unattended window rig."""
    global _WINDOWS_USER32, _WINDOWS_ENUM_PROC
    if os.name != "nt":
        return None, None
    if _WINDOWS_USER32 is not None:
        return _WINDOWS_USER32, _WINDOWS_ENUM_PROC

    user32 = ctypes.windll.user32
    enum_proc = ctypes.WINFUNCTYPE(
        wintypes.BOOL, wintypes.HWND, wintypes.LPARAM
    )
    user32.EnumWindows.argtypes = [enum_proc, wintypes.LPARAM]
    user32.EnumWindows.restype = wintypes.BOOL
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.IsWindowVisible.restype = wintypes.BOOL
    user32.IsWindow.argtypes = [wintypes.HWND]
    user32.IsWindow.restype = wintypes.BOOL
    user32.GetClassNameW.argtypes = [
        wintypes.HWND, wintypes.LPWSTR, ctypes.c_int
    ]
    user32.GetClassNameW.restype = ctypes.c_int
    user32.GetWindowRect.argtypes = [
        wintypes.HWND, ctypes.POINTER(wintypes.RECT)
    ]
    user32.GetWindowRect.restype = wintypes.BOOL
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user32.GetWindowTextLengthW.restype = ctypes.c_int
    user32.GetWindowTextW.argtypes = [
        wintypes.HWND, wintypes.LPWSTR, ctypes.c_int
    ]
    user32.GetWindowTextW.restype = ctypes.c_int
    user32.GetWindowThreadProcessId.argtypes = [
        wintypes.HWND, ctypes.POINTER(wintypes.DWORD)
    ]
    user32.GetWindowThreadProcessId.restype = wintypes.DWORD
    user32.PostMessageW.argtypes = [
        wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM
    ]
    user32.PostMessageW.restype = wintypes.BOOL
    user32.SystemParametersInfoW.argtypes = [
        wintypes.UINT, wintypes.UINT, wintypes.LPVOID, wintypes.UINT
    ]
    user32.SystemParametersInfoW.restype = wintypes.BOOL
    user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.ShowWindow.restype = wintypes.BOOL
    user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetWindowLongW.restype = wintypes.LONG
    user32.SetWindowLongW.argtypes = [
        wintypes.HWND, ctypes.c_int, wintypes.LONG
    ]
    user32.SetWindowLongW.restype = wintypes.LONG
    user32.SetWindowPos.argtypes = [
        wintypes.HWND, wintypes.HWND,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT
    ]
    user32.SetWindowPos.restype = wintypes.BOOL
    user32.BringWindowToTop.argtypes = [wintypes.HWND]
    user32.BringWindowToTop.restype = wintypes.BOOL
    user32.SetForegroundWindow.argtypes = [wintypes.HWND]
    user32.SetForegroundWindow.restype = wintypes.BOOL
    user32.OpenInputDesktop.argtypes = [
        wintypes.DWORD, wintypes.BOOL, wintypes.DWORD
    ]
    user32.OpenInputDesktop.restype = wintypes.HANDLE
    user32.GetUserObjectInformationW.argtypes = [
        wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID,
        wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)
    ]
    user32.GetUserObjectInformationW.restype = wintypes.BOOL
    user32.CloseDesktop.argtypes = [wintypes.HANDLE]
    user32.CloseDesktop.restype = wintypes.BOOL

    _WINDOWS_USER32 = user32
    _WINDOWS_ENUM_PROC = enum_proc
    return user32, enum_proc

def windows_input_desktop_name():
    """Return the visible input-desktop name, or None for a locked/disconnected session."""
    if os.name != "nt":
        return "Default"
    user32, _ = windows_user32()
    DESKTOP_READOBJECTS = 0x0001
    UOI_NAME = 2
    desktop = user32.OpenInputDesktop(0, False, DESKTOP_READOBJECTS)
    if not desktop:
        return None
    try:
        needed = wintypes.DWORD()
        buffer = ctypes.create_unicode_buffer(256)
        ok = user32.GetUserObjectInformationW(
            desktop, UOI_NAME, buffer, ctypes.sizeof(buffer),
            ctypes.byref(needed)
        )
        return buffer.value if ok else None
    finally:
        user32.CloseDesktop(desktop)

def windows_desktop_pixels_available():
    """Prove this process can actually read pixels from the console desktop."""
    if os.name != "nt":
        return True
    user32, _ = windows_user32()
    gdi32 = ctypes.windll.gdi32
    user32.GetDC.argtypes = [wintypes.HWND]
    user32.GetDC.restype = wintypes.HDC
    user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
    user32.ReleaseDC.restype = ctypes.c_int
    gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
    gdi32.CreateCompatibleDC.restype = wintypes.HDC
    gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
    gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
    gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
    gdi32.SelectObject.restype = wintypes.HGDIOBJ
    gdi32.BitBlt.argtypes = [
        wintypes.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        wintypes.HDC, ctypes.c_int, ctypes.c_int, wintypes.DWORD
    ]
    gdi32.BitBlt.restype = wintypes.BOOL
    gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
    gdi32.DeleteObject.restype = wintypes.BOOL
    gdi32.DeleteDC.argtypes = [wintypes.HDC]
    gdi32.DeleteDC.restype = wintypes.BOOL

    screen_dc = user32.GetDC(None)
    if not screen_dc:
        return False
    memory_dc = bitmap = old_object = None
    try:
        memory_dc = gdi32.CreateCompatibleDC(screen_dc)
        if not memory_dc:
            return False
        bitmap = gdi32.CreateCompatibleBitmap(screen_dc, 1, 1)
        if not bitmap:
            return False
        old_object = gdi32.SelectObject(memory_dc, bitmap)
        # CAPTUREBLT includes layered windows; SRCCOPY performs no color/tone
        # interpretation.  Failure means the console framebuffer is unavailable
        # (typically locked, disconnected, or switched to a secure desktop).
        return bool(gdi32.BitBlt(
            memory_dc, 0, 0, 1, 1, screen_dc, 0, 0, 0x40CC0020
        ))
    finally:
        if memory_dc and old_object:
            gdi32.SelectObject(memory_dc, old_object)
        if bitmap:
            gdi32.DeleteObject(bitmap)
        if memory_dc:
            gdi32.DeleteDC(memory_dc)
        user32.ReleaseDC(None, screen_dc)

def windows_desktop_is_interactive():
    """Return whether Windows exposes the normal interactive input desktop.

    A GDI BitBlt probe is intentionally not part of this decision. On some unlocked
    GPU/compositor states GetDC succeeds while a one-pixel CAPTUREBLT returns false.
    The presenter window's real creation, focus, and state acknowledgement are the
    stronger automation proof used immediately after this check.
    """
    name = windows_input_desktop_name()
    return bool(name and name.lower() == "default")

def virtual_desktop_rect():
    if os.name != "nt":
        return (0, 0, 1920, 1080)
    user32, _ = windows_user32()
    # Entire virtual desktop, not an assumed primary-monitor center.
    return (
        user32.GetSystemMetrics(76),  # SM_XVIRTUALSCREEN
        user32.GetSystemMetrics(77),  # SM_YVIRTUALSCREEN
        user32.GetSystemMetrics(78),  # SM_CXVIRTUALSCREEN
        user32.GetSystemMetrics(79),  # SM_CYVIRTUALSCREEN
    )

def _window_title(hwnd):
    user32, _ = windows_user32()
    n = user32.GetWindowTextLengthW(hwnd)
    if n <= 0:
        return ""
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    return buf.value

def find_stimulus_window():
    if os.name != "nt":
        return None
    global _STIMULUS_WINDOW_HWND
    user32, enum_proc = windows_user32()
    found = [None]
    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        title = _window_title(hwnd)
        lowered = title.lower()
        if (
            STIMULUS_WINDOW_TITLE.lower() in lowered or
            "shine-aac-optical-rig" in lowered
        ):
            found[0] = hwnd
            return False
        return True
    user32.EnumWindows(enum_proc(cb), 0)
    if found[0]:
        _STIMULUS_WINDOW_HWND = int(found[0])
        return found[0]
    if (
        _STIMULUS_WINDOW_HWND and
        user32.IsWindow(_STIMULUS_WINDOW_HWND) and
        user32.IsWindowVisible(_STIMULUS_WINDOW_HWND)
    ):
        return _STIMULUS_WINDOW_HWND
    return None

def close_stale_stimulus_windows():
    if os.name != "nt":
        return
    global _STIMULUS_WINDOW_HWND
    user32, enum_proc = windows_user32()
    stale = []
    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        title = _window_title(hwnd)
        lowered = title.lower()
        if (
            STIMULUS_WINDOW_TITLE.lower() in lowered or
            "shine-aac-optical-rig" in lowered
        ):
            stale.append(hwnd)
        return True
    user32.EnumWindows(enum_proc(cb), 0)
    WM_CLOSE = 0x0010
    for hwnd in stale:
        user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
    _STIMULUS_WINDOW_HWND = None
    if stale:
        deadline = time.time() + 2.0
        while time.time() < deadline and any(user32.IsWindow(hwnd) for hwnd in stale):
            time.sleep(0.1)

# ---------------------- minimal PNG decoding for calibration -----------------

def paeth(a, b, c):
    p = a + b - c
    pa = abs(p - a); pb = abs(p - b); pc = abs(p - c)
    if pa <= pb and pa <= pc: return a
    if pb <= pc: return b
    return c

def decode_png_rgb(path):
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not PNG")
    pos = 8
    width = height = bit_depth = color_type = None
    idat = bytearray()
    while pos + 8 <= len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+length]
        pos += 12 + length
        if typ == b"IHDR":
            width, height, bit_depth, color_type, comp, filt, interlace = struct.unpack(">IIBBBBB", chunk)
            if bit_depth != 8 or interlace != 0:
                raise ValueError("unsupported PNG format")
        elif typ == b"IDAT":
            idat.extend(chunk)
        elif typ == b"IEND":
            break
    if color_type == 6:
        bpp = 4
    elif color_type == 2:
        bpp = 3
    else:
        raise ValueError("unsupported PNG color type %r" % color_type)
    raw = zlib.decompress(bytes(idat))
    stride = width * bpp
    rows = []
    prev = bytearray(stride)
    off = 0
    for _ in range(height):
        ft = raw[off]; off += 1
        src = raw[off:off+stride]; off += stride
        cur = bytearray(stride)
        for i, x in enumerate(src):
            a = cur[i-bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i-bpp] if i >= bpp else 0
            if ft == 0: v = x
            elif ft == 1: v = (x + a) & 255
            elif ft == 2: v = (x + b) & 255
            elif ft == 3: v = (x + ((a+b)//2)) & 255
            elif ft == 4: v = (x + paeth(a,b,c)) & 255
            else: raise ValueError("bad PNG filter")
            cur[i] = v
        rows.append(bytes(cur))
        prev = cur
    return width, height, bpp, rows


def app_audio_playback_start_count(log_text, app_pid):
    pattern = (
        r"AudioPlaybackConfiguration(?:(?!AudioPlaybackConfiguration).)*?"
        r"u/pid:\d+/%s\s+state:started" % re.escape(str(app_pid))
    )
    return len(re.findall(pattern, log_text or "", re.S))


def speech_audio_playback_start_count(log_text):
    pattern = (
        r"AudioPlaybackConfiguration(?:(?!AudioPlaybackConfiguration).)*?"
        r"state:started(?:(?!AudioPlaybackConfiguration).)*?"
        r"content=CONTENT_TYPE_SPEECH"
    )
    return len(re.findall(pattern, log_text or "", re.S))


def latest_e2e_state(log_text):
    matches = list(re.finditer(
        r"(?m)^([^\r\n]*?)SHINE_AAC_E2E_STATE\s+(\{[^\r\n]+\})",
        log_text or "",
    ))
    if not matches:
        return None
    try:
        state = json.loads(matches[-1].group(2))
        epoch = re.match(r"\s*(\d+(?:\.\d+)?)\b", matches[-1].group(1))
        if epoch:
            state["_logEpochS"] = float(epoch.group(1))
        return state
    except json.JSONDecodeError:
        return None


def semantic_board_target(state, labels):
    """Return the current label and coordinates for a semantic board item."""
    folded = {label.casefold() for label in labels}
    for row_index, row in enumerate((state or {}).get("rows", [])):
        for cell_index, value in enumerate(row):
            if value.casefold() in folded:
                return value, row_index, cell_index
    return None


def board_uses_flat_cell_scan(state):
    """Return true when the rendered surface has no separate row choice."""
    rows = [row for row in (state or {}).get("rows", []) if row]
    return len(rows) == 1


def semantic_speech_lock_action(labels):
    """Translate supported visible command aliases, never their board positions."""
    aliases = {
        "unlock-message": ("修改", "編輯", "Edit", "EDIT"),
        "speak": ("朗讀", "說出", "Speak", "Read aloud", "SAY"),
        "clear": ("清除", "清空", "Clear", "CLR"),
    }
    folded = {label.casefold() for label in labels}
    return next((action for action, names in aliases.items()
                 if folded.intersection(name.casefold() for name in names)), None)


PHYSICAL_NORMAL_USE_SCENARIOS = {
    "blink": {
        "role": "AAC user who operates the board with long blinks",
        "goal": "ask for water and rest, repair a wrong choice, and say hi",
        "steps": (
            {"kind": "append", "concept": "help", "labels": ("幫忙", "幫我", "Help"), "message": "幫忙"},
            {"kind": "append", "concept": "drink water", "labels": ("喝水", "飲水", "Drink water", "Water"), "message": "幫忙喝水"},
            {"kind": "speak", "concept": "speak water request", "labels": ("朗讀", "說出", "Speak", "Read aloud")},
            {"kind": "clear", "concept": "clear water request", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "append", "concept": "uncomfortable", "labels": ("不舒服", "不適", "Uncomfortable"), "message": "不舒服"},
            {"kind": "append", "concept": "rest", "labels": ("休息", "Rest"), "message": "不舒服休息"},
            {"kind": "speak", "concept": "speak rest request", "labels": ("朗讀", "說出", "Speak", "Read aloud")},
            {"kind": "clear", "concept": "clear rest request", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "append", "concept": "pain", "labels": ("痛", "疼痛", "Pain"), "message": "痛"},
            {"kind": "append_wrong_dynamic", "concept": "make a wrong choice"},
            {"kind": "undo", "concept": "repair wrong choice", "labels": ("復原", "撤銷", "Undo"), "message": "痛"},
            {"kind": "append", "concept": "help after repair", "labels": ("幫忙", "幫我", "Help"), "message": "痛幫忙"},
            {"kind": "speak", "concept": "speak repaired request", "labels": ("朗讀", "說出", "Speak", "Read aloud")},
            {"kind": "clear", "concept": "clear repaired request", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "open_category", "concept": "open English", "labels": ("英文", "English", "EN"), "reveals": ("注音", "Zhuyin")},
            {"kind": "append_dynamic", "concept": "English H", "labels": ("H",)},
            {"kind": "append_dynamic", "concept": "English I", "labels": ("I",)},
            {"kind": "speak", "concept": "speak hi", "labels": ("朗讀", "說出", "Speak", "SAY")},
            {"kind": "clear", "concept": "clear hi", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "close_category", "concept": "return to Zhuyin", "labels": ("注音", "Zhuyin"), "reveals": ("英文", "English", "EN")},
        ),
    },
    "cheek": {
        "role": "AAC user who operates the board with a cheek movement",
        "goal": "ask for the toilet, report fatigue, call family, and confirm OK",
        "steps": (
            {"kind": "append", "concept": "toilet request", "labels": ("廁所", "Toilet"), "message": "廁所"},
            {"kind": "speak", "concept": "speak toilet request", "labels": ("朗讀", "說出", "Speak", "Read aloud")},
            {"kind": "clear", "concept": "clear toilet request", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "append", "concept": "report fatigue", "labels": ("累", "Tired"), "message": "累"},
            {"kind": "speak", "concept": "speak fatigue report", "labels": ("朗讀", "說出", "Speak", "Read aloud")},
            {"kind": "clear", "concept": "clear fatigue report", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "append", "concept": "call family", "labels": ("家人", "Family"), "message": "家人"},
            {"kind": "append_wrong_dynamic", "concept": "make a wrong choice"},
            {"kind": "undo", "concept": "repair wrong choice", "labels": ("復原", "撤銷", "Undo"), "message": "家人"},
            {"kind": "speak", "concept": "speak family request", "labels": ("朗讀", "說出", "Speak", "Read aloud")},
            {"kind": "clear", "concept": "clear family request", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "open_category", "concept": "open English", "labels": ("英文", "English", "EN"), "reveals": ("注音", "Zhuyin")},
            {"kind": "append_dynamic", "concept": "English O", "labels": ("O",)},
            {"kind": "append_dynamic", "concept": "English K", "labels": ("K",)},
            {"kind": "speak", "concept": "speak OK", "labels": ("朗讀", "說出", "Speak", "SAY")},
            {"kind": "clear", "concept": "clear OK", "labels": ("清除", "清空", "Clear", "CLR"), "message": ""},
            {"kind": "close_category", "concept": "return to Zhuyin", "labels": ("注音", "Zhuyin"), "reveals": ("英文", "English", "EN")},
        ),
    },
}


def validate_physical_normal_use_scenarios(scenarios):
    for gesture in ("blink", "cheek"):
        scenario = scenarios.get(gesture) or {}
        if not scenario.get("role") or not scenario.get("goal"):
            return False
        steps = scenario.get("steps") or ()
        if sum(step.get("kind") == "speak" for step in steps) != 4:
            return False
        if not any(step.get("kind") == "undo" for step in steps):
            return False
    return scenarios["blink"]["steps"] != scenarios["cheek"]["steps"]


def e2e_input_count(log_text, intent, source):
    count = 0
    for payload in re.findall(r"SHINE_AAC_E2E_INPUT\s+(\{[^\r\n]+\})", log_text or ""):
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if event.get("intent") == intent and event.get("source") == source:
            count += 1
    return count


def e2e_camera_statuses(log_text, source):
    states = []
    for payload in re.findall(r"SHINE_AAC_E2E_INPUT\s+(\{[^\r\n]+\})", log_text or ""):
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if event.get("intent") != "cameraStatus" or event.get("source") != source:
            continue
        match = re.search(r"(?:^|;)state=([^;]+)", str(event.get("detail", "")))
        if match:
            states.append(match.group(1))
    return states


def window_brightness_values(dumpsys_text):
    return [
        float(value)
        for value in re.findall(r"screenBrightness=([-+]?[0-9]*\.?[0-9]+)", dumpsys_text or "")
    ]


def observed_case_activations(log_text, source, before_phase, after_phase, scan_mode):
    """Prefer exact diagnostic events; fall back to visible scan displacement."""
    if re.search(
        r'SHINE_AAC_E2E_INPUT\s+\{[^\r\n]*"source"\s*:\s*"%s"'
        % re.escape(source),
        log_text or "",
    ):
        return e2e_input_count(log_text, "activate", source), "e2e-exact"
    return (
        visible_activation_count(before_phase, after_phase, scan_mode),
        "visible-board-stage",
    )


def android_preferences_with_boolean(xml_text, name, value):
    """Return Android SharedPreferences XML with one boolean changed."""
    root = ET.fromstring(xml_text)
    if root.tag != "map":
        raise ValueError("SharedPreferences root must be <map>")
    item = next(
        (child for child in root if child.get("name") == name), None
    )
    if item is None:
        item = ET.SubElement(root, "boolean", {"name": name})
    elif item.tag != "boolean":
        raise ValueError("SharedPreferences %s is not boolean" % name)
    item.set("value", "true" if value else "false")
    body = ET.tostring(root, encoding="utf-8").decode("utf-8")
    return "<?xml version='1.0' encoding='utf-8'?>\n" + body


def demo_activation_result(before, after):
    """Classify one presented gesture; normal use must produce exactly one input."""
    delta = after - before
    if delta < 1:
        return "MISS"
    if delta == 1:
        return "PASS"
    return "DUPLICATE"


def blink_calibration_timeline_is_complete(timeline):
    """Require five visible open/long-closed/open calibration cycles."""
    events = (timeline or {}).get("events") or []
    if len(events) != 15:
        return False
    for cycle in range(5):
        group = events[cycle * 3:(cycle + 1) * 3]
        if [event.get("pose") for event in group] != [
            "open", "long-closed", "open"
        ]:
            return False
        closed = group[1]
        if float(closed.get("actual_presented_ms", 0)) < 850:
            return False
        if not all(event.get("presenter_acknowledged") for event in group):
            return False
    return True

def _percentile(values, q):
    if not values:
        raise ValueError("empty percentile")
    v = sorted(values)
    if len(v) == 1:
        return float(v[0])
    pos = (len(v) - 1) * float(q)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return float(v[lo])
    f = pos - lo
    return v[lo] * (1.0 - f) + v[hi] * f

def _fit_projective_atlas(phone_points, xs, ys):
    """Robustly map phone pixels to atlas coordinates with one homography."""
    if len(phone_points) != len(xs) or len(xs) != len(ys) or len(xs) < 4:
        raise ValueError("too few projective samples")

    # A phone normally sees the monitor obliquely, so an affine fit is not a
    # valid coherence oracle. Keep the fit bounded on high-resolution captures
    # while sampling the full visible region deterministically.
    stride = max(1, len(xs) // 5000)
    sample_indices = list(range(0, len(xs), stride))

    def fit(indices):
        ata = [[0.0] * 8 for _ in range(8)]
        atb = [0.0] * 8
        for index in indices:
            px, py = phone_points[index]
            ax, ay = xs[index], ys[index]
            rows = (
                ([px, py, 1.0, 0.0, 0.0, 0.0, -ax * px, -ax * py], ax),
                ([0.0, 0.0, 0.0, px, py, 1.0, -ay * px, -ay * py], ay),
            )
            for row, value in rows:
                for i in range(8):
                    atb[i] += row[i] * value
                    for j in range(8):
                        ata[i][j] += row[i] * row[j]
        return solve_linear(ata, atb)

    def residuals(coefficients, indices):
        values = []
        for index in indices:
            px, py = phone_points[index]
            denominator = coefficients[6] * px + coefficients[7] * py + 1.0
            if abs(denominator) < 1e-6:
                values.append(float("inf"))
                continue
            predicted_x = (
                coefficients[0] * px + coefficients[1] * py + coefficients[2]
            ) / denominator
            predicted_y = (
                coefficients[3] * px + coefficients[4] * py + coefficients[5]
            ) / denominator
            values.append(math.hypot(xs[index] - predicted_x, ys[index] - predicted_y))
        return values

    # The phone screenshot also contains product chrome and other high-contrast
    # shapes. Seed the fit with deterministic RANSAC so an accidentally decoded
    # shape cannot drag the homography away from the binary tag field.
    generator = random.Random(0x5348494E)
    best_inliers = []
    if len(sample_indices) >= 8:
        for _ in range(180):
            trial = generator.sample(sample_indices, 4)
            trial_points = [phone_points[index] for index in trial]
            if (
                max(point[0] for point in trial_points) - min(point[0] for point in trial_points) < 0.12 or
                max(point[1] for point in trial_points) - min(point[1] for point in trial_points) < 0.12
            ):
                continue
            try:
                trial_coefficients = fit(trial)
                trial_errors = residuals(trial_coefficients, sample_indices)
            except ValueError:
                continue
            trial_inliers = [
                index for index, error in zip(sample_indices, trial_errors)
                if math.isfinite(error) and error <= 0.085
            ]
            if len(trial_inliers) > len(best_inliers):
                best_inliers = trial_inliers

    inliers = best_inliers if len(best_inliers) >= 8 else sample_indices
    coefficients = None
    for _ in range(4):
        coefficients = fit(inliers)
        errors = residuals(coefficients, sample_indices)
        finite = [value for value in errors if math.isfinite(value)]
        if len(finite) < 8:
            raise ValueError("atlas projective fit is singular")
        inlier_errors = residuals(coefficients, inliers)
        finite_inliers = [
            value for value in inlier_errors if math.isfinite(value)
        ]
        cutoff = max(
            0.025,
            min(0.11, _percentile(finite_inliers, 0.80) * 1.8)
        )
        refined = [
            index for index, error in zip(sample_indices, errors)
            if math.isfinite(error) and error <= cutoff
        ]
        if len(refined) < 8:
            break
        inliers = refined

    coefficients = fit(inliers)
    errors = residuals(coefficients, inliers)
    x_values = [xs[index] for index in inliers]
    y_values = [ys[index] for index in inliers]

    def channel_quality(values, coefficient_slice):
        squared = 0.0
        for index in inliers:
            px, py = phone_points[index]
            denominator = coefficients[6] * px + coefficients[7] * py + 1.0
            predicted = (
                coefficients[coefficient_slice] * px +
                coefficients[coefficient_slice + 1] * py +
                coefficients[coefficient_slice + 2]
            ) / denominator
            actual = xs[index] if coefficient_slice == 0 else ys[index]
            squared += (actual - predicted) ** 2
        rmse = math.sqrt(squared / len(inliers))
        span = _percentile(values, 0.90) - _percentile(values, 0.10)
        return {
            "rmse": rmse,
            "p10_p90_span": span,
            "normalized_rmse": rmse / max(span, 1e-9),
        }

    return {
        "coefficients": coefficients,
        "inlier_indices": inliers,
        "inlier_count": len(inliers),
        "sample_count": len(sample_indices),
        "inlier_fraction": len(inliers) / float(len(sample_indices)),
        "joint_rmse": math.sqrt(sum(value * value for value in errors) / len(errors)),
        "x": channel_quality(x_values, 0),
        "y": channel_quality(y_values, 3),
        "inlier_xs": x_values,
        "inlier_ys": y_values,
    }

def _binary_tag_bits(column, row):
    payload = [((column >> bit) & 1) for bit in range(4)]
    payload += [((row >> bit) & 1) for bit in range(3)]
    repeated = payload * 3
    matrix = [[0] * 5 for _ in range(5)]
    matrix[0][0] = 1
    index = 0
    for y in range(5):
        for x in range(5):
            if x in (0, 4) and y in (0, 4):
                continue
            matrix[y][x] = repeated[index]
            index += 1
    return matrix

def _rotate_binary_matrix(matrix):
    return [list(row) for row in zip(*matrix[::-1])]

def _decode_binary_tag(matrix, columns, rows):
    candidates = []
    variants = [matrix, [list(reversed(row)) for row in matrix]]
    for mirrored, initial in enumerate(variants):
        oriented = initial
        for rotation in range(4):
            corners = (
                oriented[0][0], oriented[0][4],
                oriented[4][4], oriented[4][0]
            )
            if corners == (1, 0, 0, 0):
                data = []
                for y in range(5):
                    for x in range(5):
                        if x in (0, 4) and y in (0, 4):
                            continue
                        data.append(oriented[y][x])
                groups = [data[offset:offset + 7] for offset in (0, 7, 14)]
                payload = [
                    1 if sum(group[bit] for group in groups) >= 2 else 0
                    for bit in range(7)
                ]
                column = sum(payload[bit] << bit for bit in range(4))
                row = sum(payload[4 + bit] << bit for bit in range(3))
                if column < columns and row < rows:
                    expected = _binary_tag_bits(column, row)
                    hamming = sum(
                        expected[y][x] != oriented[y][x]
                        for y in range(5) for x in range(5)
                    )
                    if hamming <= 3:
                        candidates.append({
                            "column": column,
                            "row": row,
                            "hamming": hamming,
                            "rotation": rotation,
                            "mirrored": bool(mirrored),
                        })
            oriented = _rotate_binary_matrix(oriented)
    if not candidates:
        return None
    return min(candidates, key=lambda value: value["hamming"])

def decode_coordinate_atlas_from_png(path, desktop_rect):
    """Decode the one-shot atlas using only monochrome tag geometry."""
    width, height, bpp, rows_data = decode_png_rgb(path)
    vx, vy, desktop_width, desktop_height = desktop_rect
    tag_size = float(atlas_tag_size(desktop_width, desktop_height))
    tag_columns = int(math.ceil(desktop_width / tag_size))
    tag_rows = int(math.ceil(desktop_height / tag_size))
    if tag_columns < 2 or tag_rows < 2:
        raise ValueError("desktop is too small for binary atlas tags")

    def luminance(x, y):
        x = max(0, min(width - 1, int(round(x))))
        y = max(0, min(height - 1, int(round(y))))
        offset = x * bpp
        row_data = rows_data[y]
        return (
            row_data[offset] * 0.299 +
            row_data[offset + 1] * 0.587 +
            row_data[offset + 2] * 0.114
        )

    step = 2
    white = set()
    for y in range(0, height, step):
        row_data = rows_data[y]
        for x in range(0, width, step):
            offset = x * bpp
            r, g, b = row_data[offset], row_data[offset + 1], row_data[offset + 2]
            value = r * 0.299 + g * 0.587 + b * 0.114
            if value >= 145 and max(r, g, b) - min(r, g, b) <= 120:
                white.add((x // step, y // step))

    detections = []
    remaining = set(white)
    while remaining:
        seed = remaining.pop()
        stack = [seed]
        component = []
        while stack:
            point = stack.pop()
            component.append(point)
            px, py = point
            for nx in (px - 1, px, px + 1):
                for ny in (py - 1, py, py + 1):
                    neighbor = (nx, ny)
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        stack.append(neighbor)
        if len(component) < 20:
            continue
        grid_xs = [point[0] for point in component]
        grid_ys = [point[1] for point in component]
        left, right = min(grid_xs) * step, (max(grid_xs) + 1) * step
        top, bottom = min(grid_ys) * step, (max(grid_ys) + 1) * step
        box_width, box_height = right - left, bottom - top
        if min(box_width, box_height) < 18 or max(box_width, box_height) > min(width, height) * 0.55:
            continue
        aspect = box_width / float(max(1, box_height))
        fill = len(component) / float(
            max(1, (right // step - left // step) * (bottom // step - top // step))
        )
        if aspect < 0.55 or aspect > 1.75 or fill < 0.08 or fill > 0.68:
            continue

        def sample(fx, fy):
            return luminance(left + fx * box_width, top + fy * box_height)

        ring_samples = []
        quiet_samples = []
        for position in (0.22, 0.40, 0.60, 0.78):
            ring_samples += [
                sample(position, 0.035), sample(position, 0.965),
                sample(0.035, position), sample(0.965, position),
            ]
            quiet_samples += [
                sample(position, 0.115), sample(position, 0.885),
                sample(0.115, position), sample(0.885, position),
            ]
        ring_level = _percentile(ring_samples, 0.5)
        quiet_level = _percentile(quiet_samples, 0.5)
        if ring_level < 135 or ring_level - quiet_level < 45:
            continue
        threshold = (ring_level + quiet_level) * 0.5

        payload_start = 16.0 / 116.0
        payload_span = 84.0 / 116.0
        matrix = []
        for matrix_y in range(5):
            matrix.append([])
            for matrix_x in range(5):
                fx = payload_start + (matrix_x + 0.5) * payload_span / 5.0
                fy = payload_start + (matrix_y + 0.5) * payload_span / 5.0
                matrix[-1].append(1 if sample(fx, fy) >= threshold else 0)
        decoded = _decode_binary_tag(matrix, tag_columns, tag_rows)
        if decoded is None:
            continue
        decoded.update({
            "phone_x": (left + right) * 0.5 / float(max(1, width - 1)),
            "phone_y": (top + bottom) * 0.5 / float(max(1, height - 1)),
            "box": [left, top, right, bottom],
        })
        detections.append(decoded)

    best_by_coordinate = {}
    for detection in detections:
        key = (detection["column"], detection["row"])
        previous = best_by_coordinate.get(key)
        if previous is None or detection["hamming"] < previous["hamming"]:
            best_by_coordinate[key] = detection
    tags = list(best_by_coordinate.values())
    if len(tags) < 4:
        raise ValueError("too few verified binary atlas tags: %d" % len(tags))

    phone_points = [(tag["phone_x"], tag["phone_y"]) for tag in tags]
    xs = [((tag["column"] + 0.5) * tag_size) / desktop_width for tag in tags]
    ys = [((tag["row"] + 0.5) * tag_size) / desktop_height for tag in tags]
    if max(xs) - min(xs) < tag_size / desktop_width * 0.8:
        raise ValueError("binary atlas tags do not span multiple columns")
    if max(ys) - min(ys) < tag_size / desktop_height * 0.8:
        raise ValueError("binary atlas tags do not span multiple rows")

    projective = _fit_projective_atlas(phone_points, xs, ys)
    if projective["inlier_fraction"] < 0.70:
        raise ValueError(
            "binary atlas tags are spatially incoherent: inliers=%d/%d"
            % (projective["inlier_count"], projective["sample_count"])
        )
    verified = [tags[index] for index in projective["inlier_indices"]]
    center_xs = [(tag["column"] + 0.5) * tag_size for tag in verified]
    center_ys = [(tag["row"] + 0.5) * tag_size for tag in verified]
    x_low = max(0.0, min(center_xs) - tag_size * 0.5)
    x_high = min(float(desktop_width), max(center_xs) + tag_size * 0.5)
    y_low = max(0.0, min(center_ys) - tag_size * 0.5)
    y_high = min(float(desktop_height), max(center_ys) + tag_size * 0.5)
    center_x = vx + (x_low + x_high) * 0.5
    center_y = vy + (y_low + y_high) * 0.5

    return {
        "screenshot_width": width,
        "screenshot_height": height,
        "binary_tags": len(tags),
        "tag_detections": tags,
        "spatial_fit": projective,
        "phone_coordinate_center": [
            sum(point[0] for point in phone_points) / len(phone_points) * width,
            sum(point[1] for point in phone_points) / len(phone_points) * height,
        ],
        "desktop_center": [center_x, center_y],
        "estimated_visible_size": [x_high - x_low, y_high - y_low],
        "desktop_quantiles": {
            "x10": vx + x_low, "x50": center_x, "x90": vx + x_high,
            "y10": vy + y_low, "y50": center_y, "y90": vy + y_high,
        },
    }


def _invert_3x3(matrix):
    a, b, c = matrix[0]
    d, e, f = matrix[1]
    g, h, i = matrix[2]
    determinant = (
        a * (e * i - f * h) -
        b * (d * i - f * g) +
        c * (d * h - e * g)
    )
    if abs(determinant) < 1e-12:
        raise ValueError("atlas homography is singular")
    return [
        [(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
        [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
        [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant],
    ]


def atlas_point_to_phone(coefficients, atlas_x, atlas_y, screenshot_size):
    """Project a normalized desktop point into phone screenshot pixels."""
    matrix = [
        coefficients[0:3],
        coefficients[3:6],
        [coefficients[6], coefficients[7], 1.0],
    ]
    inverse = _invert_3x3(matrix)
    x = inverse[0][0] * atlas_x + inverse[0][1] * atlas_y + inverse[0][2]
    y = inverse[1][0] * atlas_x + inverse[1][1] * atlas_y + inverse[1][2]
    w = inverse[2][0] * atlas_x + inverse[2][1] * atlas_y + inverse[2][2]
    if abs(w) < 1e-9:
        raise ValueError("atlas point projects to infinity")
    width, height = screenshot_size
    return (x / w * width, y / w * height)


def phone_point_to_atlas(coefficients, phone_x, phone_y, screenshot_size):
    """Project a phone screenshot pixel into normalized desktop coordinates."""
    width, height = screenshot_size
    x = phone_x / float(width)
    y = phone_y / float(height)
    denominator = coefficients[6] * x + coefficients[7] * y + 1.0
    if abs(denominator) < 1e-9:
        raise ValueError("phone point projects to infinity")
    return (
        (coefficients[0] * x + coefficients[1] * y + coefficients[2]) / denominator,
        (coefficients[3] * x + coefficients[4] * y + coefficients[5]) / denominator,
    )


def desktop_aim_from_atlas(decoded, preview_rect, desktop_rect):
    left, top, right, bottom = preview_rect
    atlas_x, atlas_y = phone_point_to_atlas(
        decoded["spatial_fit"]["coefficients"],
        (left + right) * 0.5,
        (top + bottom) * 0.5,
        (decoded["screenshot_width"], decoded["screenshot_height"]),
    )
    vx, vy, width, height = desktop_rect
    return (vx + atlas_x * width, vy + atlas_y * height)


def media_orientation_from_atlas(decoded, preview_rect, desktop_rect):
    """Map camera-up through the measured homography into presenter pixels.

    Working in pixels (not normalized coordinates) preserves angle on unequal
    aspect ratios. Mapping the up vector also handles mirrored front previews
    without introducing a second horizontal flip into the stimulus.
    """
    left, top, right, bottom = preview_rect
    px, py = (left + right) * 0.5, (top + bottom) * 0.5
    size = (decoded["screenshot_width"], decoded["screenshot_height"])
    coefficients = decoded["spatial_fit"]["coefficients"]
    center = phone_point_to_atlas(coefficients, px, py, size)
    above = phone_point_to_atlas(coefficients, px, py - 1.0, size)
    dx = (above[0] - center[0]) * desktop_rect[2]
    dy = (above[1] - center[1]) * desktop_rect[3]
    if not all(math.isfinite(v) for v in (dx, dy)) or math.hypot(dx, dy) < 1e-9:
        raise ValueError("atlas cannot establish a finite upright direction")
    degrees = (math.degrees(math.atan2(-dx, -dy)) + 180.0) % 360.0 - 180.0
    return {"method": "camera-up-through-atlas-homography", "rotation_degrees_ccw": degrees}


def monitor_polygon_from_atlas(decoded):
    coefficients = decoded["spatial_fit"]["coefficients"]
    size = (decoded["screenshot_width"], decoded["screenshot_height"])
    return [
        atlas_point_to_phone(coefficients, 0.0, 0.0, size),
        atlas_point_to_phone(coefficients, 1.0, 0.0, size),
        atlas_point_to_phone(coefficients, 1.0, 1.0, size),
        atlas_point_to_phone(coefficients, 0.0, 1.0, size),
    ]


def camera_alignment_guidance(decoded, preview_rect, presenter_rect):
    """Describe physical alignment in preview coordinates, including mirroring."""
    polygon = monitor_polygon_from_atlas(decoded)
    left, top, right, bottom = preview_rect
    preview_center = ((left + right) * 0.5, (top + bottom) * 0.5)
    presenter_center_in_preview = (
        sum(point[0] for point in polygon) / len(polygon),
        sum(point[1] for point in polygon) / len(polygon),
    )
    move_in_preview = (
        preview_center[0] - presenter_center_in_preview[0],
        preview_center[1] - presenter_center_in_preview[1],
    )
    aim = desktop_aim_from_atlas(decoded, preview_rect, presenter_rect)
    preview_width = max(1.0, float(right - left))
    preview_height = max(1.0, float(bottom - top))

    horizontal = "none"
    if abs(move_in_preview[0]) >= preview_width * 0.03:
        horizontal = "right" if move_in_preview[0] > 0 else "left"
    vertical = "none"
    if abs(move_in_preview[1]) >= preview_height * 0.03:
        vertical = "down" if move_in_preview[1] > 0 else "up"
    phrases = []
    if horizontal != "none":
        phrases.append(
            "move the presenter's image %s by about %.0f%% of preview width"
            % (horizontal, abs(move_in_preview[0]) * 100.0 / preview_width)
        )
    if vertical != "none":
        phrases.append(
            "move it %s by about %.0f%% of preview height"
            % (vertical, abs(move_in_preview[1]) * 100.0 / preview_height)
        )
    return {
        "preview_rect": list(preview_rect),
        "preview_center": [round(value, 2) for value in preview_center],
        "presenter_polygon_in_dut": [
            [round(x, 2), round(y, 2)] for x, y in polygon
        ],
        "presenter_center_in_dut": [
            round(value, 2) for value in presenter_center_in_preview
        ],
        "move_presenter_image_by_dut_px": [
            round(value, 2) for value in move_in_preview
        ],
        "move_presenter_image_fraction": [
            round(move_in_preview[0] / preview_width, 4),
            round(move_in_preview[1] / preview_height, 4),
        ],
        "preview_center_in_presenter_px": [round(value, 2) for value in aim],
        "preview_center_inside_presenter": point_in_convex_polygon(
            preview_center, polygon
        ),
        "operator_guidance": "; then ".join(phrases) if phrases else "alignment is centered",
        "direction_space": "DUT Camera Setup preview; safe for mirrored front cameras",
    }


def _cross(a, b, point):
    return ((b[0] - a[0]) * (point[1] - a[1]) -
            (b[1] - a[1]) * (point[0] - a[0]))


def point_in_convex_polygon(point, polygon, tolerance=1e-6):
    signs = []
    for index, start in enumerate(polygon):
        value = _cross(start, polygon[(index + 1) % len(polygon)], point)
        if abs(value) > tolerance:
            signs.append(value > 0)
    return not signs or all(value == signs[0] for value in signs)


def required_zoom_multiplier(monitor_polygon, preview_rect):
    """Minimum center crop multiplier that makes the monitor cover preview."""
    left, top, right, bottom = preview_rect
    center = ((left + right) * 0.5, (top + bottom) * 0.5)
    if not point_in_convex_polygon(center, monitor_polygon):
        return None
    corners = [(left, top), (right, top), (right, bottom), (left, bottom)]

    def covers(multiplier):
        scaled = [
            (center[0] + (point[0] - center[0]) * multiplier,
             center[1] + (point[1] - center[1]) * multiplier)
            for point in monitor_polygon
        ]
        return all(point_in_convex_polygon(corner, scaled) for corner in corners)

    if covers(1.0):
        return 1.0
    high = 2.0
    while high < 32.0 and not covers(high):
        high *= 2.0
    if not covers(high):
        return None
    low = 1.0
    for _ in range(50):
        middle = (low + high) * 0.5
        if covers(middle):
            high = middle
        else:
            low = middle
    return high


def round_camera_zoom_up(value, step=0.2, minimum=1.0, maximum=4.0):
    bounded = max(minimum, min(maximum, float(value)))
    stepped = math.ceil((bounded - 1e-7) / step) * step
    return max(minimum, min(maximum, round(stepped, 1)))


def comfortable_camera_zoom(current, fill_multiplier, occupancy=RIG_MONITOR_OCCUPANCY):
    """Use normal app zoom while leaving realistic space around the monitor."""
    return round_camera_zoom_up(float(current) * float(fill_multiplier) * occupancy)

def latest_optical_camera_id(text, field):
    pattern = r"\bOPTICAL_CAMERA\s+%s=([^\s;]+)" % re.escape(field)
    matches = re.findall(pattern, text or "")
    return matches[-1] if matches else None

def camera_id_from_visible_strings(strings):
    for value in reversed(list(strings or [])):
        match = re.search(r"(?:\(|（)ID\s+([^\s\)）]+)(?:\)|）)", value, re.I)
        if match:
            return match.group(1)
    return None


def _parse_android_bounds(value):
    match = re.fullmatch(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", value or "")
    return tuple(map(int, match.groups())) if match else None


def camera_setup_geometry(xml_path):
    """Read preview bounds and the displayed zoom from the real setup UI."""
    root = ET.parse(str(xml_path)).getroot()
    visible = []
    zoom_ratio = None
    for node in root.iter("node"):
        bounds = _parse_android_bounds(node.get("bounds"))
        if not bounds or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
            continue
        visible.append((node, bounds))
        text_value = node.get("text") or ""
        match = re.search(
            r"(?:Camera zoom\s*:\s*|Zoom\s*|相機縮放\s*[：:]\s*|縮放\s*)(\d+(?:\.\d+)?)",
            text_value,
            re.I,
        )
        if match:
            zoom_ratio = float(match.group(1))
        elif node.get("class") == "android.widget.TextView":
            compact_zoom = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*[×x]\s*", text_value, re.I)
            if compact_zoom:
                zoom_ratio = float(compact_zoom.group(1))

    semantic_previews = [
        bounds for node, bounds in visible
        if (node.get("content-desc") or "").strip().lower()
        in ("camera preview", "相機預覽")
        and bounds[2] - bounds[0] >= 100
        and bounds[3] - bounds[1] >= 100
    ]
    if semantic_previews:
        # The accessibility role is the durable contract. The container may be
        # a FrameLayout, CardView, Compose node, or another implementation.
        preview = max(
            semantic_previews,
            key=lambda value: (value[2] - value[0]) * (value[3] - value[1])
        )
    else:
        scrolls = [
            bounds for node, bounds in visible
            if node.get("class") == "android.widget.ScrollView"
        ]
        if not scrolls:
            raise ValueError(
                "Camera Setup exposes neither a named preview nor usable layout landmarks"
            )
        controls = max(
            scrolls,
            key=lambda value: (value[2] - value[0]) * (value[3] - value[1])
        )
        explicit_previews = [
            bounds for node, bounds in visible
            if node.get("class") == "android.widget.FrameLayout"
            and bounds[3] <= controls[1]
            and bounds[0] >= controls[0]
            and bounds[2] <= controls[2]
            and bounds[2] - bounds[0] >= 100
            and bounds[3] - bounds[1] >= 100
        ]
        if explicit_previews:
            preview = max(
                explicit_previews,
                key=lambda value: (value[2] - value[0]) * (value[3] - value[1])
            )
        else:
            # Compatibility fallback for old builds without a semantic preview
            # name. It uses relative landmarks, not localized labels or pixels.
            before_controls = [
                bounds for node, bounds in visible
                if bounds[3] <= controls[1]
                and bounds[0] >= controls[0]
                and bounds[2] <= controls[2]
            ]
            if not before_controls:
                raise ValueError("Camera Setup preview boundary is not visible")
            preview_top = max(bounds[3] for bounds in before_controls)
            preview = (controls[0], preview_top, controls[2], controls[1])
    if preview[2] - preview[0] < 100 or preview[3] - preview[1] < 100:
        raise ValueError("Camera Setup preview is too small")
    if zoom_ratio is None:
        raise ValueError("Camera Setup zoom value is not visible")
    return {"preview_rect": preview, "zoom_ratio": zoom_ratio}


def camera_setup_geometry_with_fallback(*xml_paths):
    """Use the newest readable setup geometry, retaining prior stable evidence."""
    errors = []
    for xml_path in xml_paths:
        if not xml_path:
            continue
        try:
            return xml_path, camera_setup_geometry(xml_path)
        except (ET.ParseError, OSError, ValueError) as error:
            errors.append(str(error))
    raise ValueError(
        "Camera Setup geometry is unavailable"
        + ((": " + "; ".join(errors)) if errors else "")
    )

def solve_linear(a, b):
    n = len(b)
    m = [list(map(float, a[i])) + [float(b[i])] for i in range(n)]
    for col in range(n):
        pivot = max(range(col,n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) < 1e-12:
            raise ValueError("singular matrix")
        m[col],m[pivot] = m[pivot],m[col]
        p = m[col][col]
        m[col] = [v/p for v in m[col]]
        for r in range(n):
            if r == col: continue
            f = m[r][col]
            if f == 0: continue
            m[r] = [m[r][c]-f*m[col][c] for c in range(n+1)]
    return [m[i][n] for i in range(n)]

class PcDisplayGuard:
    """
    Test-scoped Windows PC awake guard.

    Prevents normal system sleep/display timeout with SetThreadExecutionState
    and temporarily disables an active Windows screen saver. Both are restored
    on exit. No permanent power-plan change is made.
    """

    ES_CONTINUOUS = 0x80000000
    ES_SYSTEM_REQUIRED = 0x00000001
    ES_DISPLAY_REQUIRED = 0x00000002

    SPI_GETSCREENSAVEACTIVE = 0x0010
    SPI_SETSCREENSAVEACTIVE = 0x0011
    WM_SYSCOMMAND = 0x0112
    SC_MONITORPOWER = 0xF170
    HWND_BROADCAST = 0xFFFF

    def __init__(self):
        self.enabled = False
        self.screen_saver_was_active = None
        self.screen_saver_disabled = False

    def _wake_display(self, user32):
        """Ask every top-level window to restore a powered-down monitor."""
        posted = user32.PostMessageW(
            wintypes.HWND(self.HWND_BROADCAST),
            self.WM_SYSCOMMAND,
            self.SC_MONITORPOWER,
            -1
        )
        if not posted:
            raise RuntimeError(
                "Windows display wake request failed; unlock/wake the host "
                "before starting the optical rig."
            )
        time.sleep(0.35)

    def _set_screen_saver_active(self, user32, active):
        ctypes.set_last_error(0)
        changed = user32.SystemParametersInfoW(
            self.SPI_SETSCREENSAVEACTIVE,
            1 if active else 0,
            None,
            0
        )
        return bool(changed), ctypes.get_last_error()

    def start(self, require_display=True):
        if os.name != "nt":
            print("PC stay-awake guard: non-Windows host; no Windows guard needed")
            return

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.SetThreadExecutionState.argtypes = [wintypes.DWORD]
        kernel32.SetThreadExecutionState.restype = wintypes.DWORD
        user32, _ = windows_user32()

        flags = self.ES_CONTINUOUS | self.ES_SYSTEM_REQUIRED
        if require_display:
            flags |= self.ES_DISPLAY_REQUIRED
        previous = kernel32.SetThreadExecutionState(flags)
        if previous == 0:
            raise RuntimeError(
                "Windows SetThreadExecutionState failed; refusing unattended "
                "optical testing because the PC may sleep."
            )
        self.enabled = True

        if not require_display:
            print("PASS PC kept awake: system sleep suppressed; monitor may turn off")
            return

        # SetThreadExecutionState prevents the next timeout but does not
        # necessarily illuminate a monitor that is already powered down.
        # Wake it before changing screen-saver state; Windows rejects that
        # change with ERROR_OPERATION_IN_PROGRESS while display power is down.
        self._wake_display(user32)
        if not windows_desktop_is_interactive():
            raise RuntimeError(
                "The optical-rig process is not attached to the Windows Default "
                "input desktop. The desktop may be secure, disconnected, or the "
                "process may have been launched in a non-interactive context."
            )

        active = ctypes.c_int()
        got_state = user32.SystemParametersInfoW(
            self.SPI_GETSCREENSAVEACTIVE,
            0,
            ctypes.byref(active),
            0
        )
        if got_state:
            self.screen_saver_was_active = bool(active.value)
            if self.screen_saver_was_active:
                changed, error_code = self._set_screen_saver_active(
                    user32, False
                )
                if not changed and error_code == 329:
                    self._wake_display(user32)
                    changed, error_code = self._set_screen_saver_active(
                        user32, False
                    )
                if not changed:
                    kernel32.SetThreadExecutionState(self.ES_CONTINUOUS)
                    self.enabled = False
                    raise RuntimeError(
                        "Windows screen saver is active but could not be "
                        "temporarily disabled (Win32 error %d); refusing "
                        "unattended optical test." % error_code
                    )
                self.screen_saver_disabled = True

        detail = "sleep/display timeout suppressed"
        if self.screen_saver_was_active:
            detail += "; screen saver temporarily disabled"
        else:
            detail += "; no active screen saver"
        print("PASS PC kept awake:", detail)

    def restore(self):
        if os.name != "nt":
            return

        user32, _ = windows_user32()
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.SetThreadExecutionState.argtypes = [wintypes.DWORD]
        kernel32.SetThreadExecutionState.restype = wintypes.DWORD

        if self.screen_saver_disabled:
            try:
                self._set_screen_saver_active(user32, True)
            except Exception:
                pass

        if self.enabled:
            try:
                kernel32.SetThreadExecutionState(self.ES_CONTINUOUS)
            except Exception:
                pass

        self.enabled = False
        self.screen_saver_disabled = False
        print("PC stay-awake guard restored")

class OpticalRig:
    def __init__(self, args, outdir):
        self.args = args
        self.root = ROOT
        self.outdir = outdir
        self.outdir.mkdir(parents=True, exist_ok=True)
        self.mod = load_device_test_module()
        self.adb = self.mod.find_adb()
        self.device = serial_deep_test(
            self.mod, self.adb, ROOT, outdir / "device", args.dut_serial
        )
        if args.presenter_mode == "android":
            self.host = AndroidSurfaceStimulus(
                ROOT,
                DOWNLOADED,
                self.adb,
                args.presenter_serial,
                args.presenter_size,
                apk_path=args.presenter_apk,
            )
        else:
            self.host = OpenCvStimulus(ROOT, DOWNLOADED, virtual_desktop_rect())
        self.presenter_mode = args.presenter_mode
        self.stimulus_center = None
        self.selected_setup_camera_id = None
        self.camera_setup_ui_path = None
        self.active_zoom_ratio = 1.0
        self.findings = []
        self.results = []
        self.camera_pref_original = None
        self.demo_config_original = None
        self.demo_config_existed = False
        self.demo_steps = []
        self.camera_pref_existed = False
        self.original_switch_input_label = None
        self.switch_input_changed = False
        self.scan_mode = None
        self.thermal = ThermalGovernor(
            self.device.shell,
            outdir / "thermal.csv",
            stop_status=args.thermal_stop_status,
            hot_battery_c=args.thermal_hot_c,
            resume_battery_c=args.thermal_resume_c,
            stable_seconds=args.thermal_stable_sec,
            poll_seconds=5,
        )

    def add(self, priority, title, detail, evidence=None):
        self.findings.append({
            "priority":priority,"title":title,"detail":detail,"evidence":evidence or []
        })
        print(priority, title + ":", detail)

    def pass_(self, title, detail=""):
        print("PASS", title + ((": " + detail) if detail else ""))

    def thermal_suspend(self):
        self.host.set_state(mode="standby", label="THERMAL COOLDOWN")
        if hasattr(self.host, "suspend"):
            self.host.suspend()
        self.device.shell("am","force-stop",PACKAGE,check=False)
        self.device.shell("input","keyevent","223",check=False)

    def thermal_resume(self):
        if hasattr(self.host, "resume"):
            self.host.resume()
        self.device.shell("input","keyevent","224",check=False)
        self.device.shell("wm","dismiss-keyguard",check=False)
        time.sleep(1)

    def guard(self,label):
        return self.thermal.guard(
            label, on_suspend=self.thermal_suspend, on_resume=self.thermal_resume
        )

    def preserve_camera_preferences(self):
        """Snapshot optical settings before using Camera Setup like a user."""
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        camera_original = self.device.shell(
            "run-as", PACKAGE, "cat", CAMERA_PREFS, check=False
        )
        self.camera_pref_existed = camera_original.returncode == 0
        self.camera_pref_original = camera_original.stdout or ""
        self.pass_("camera preference snapshot", "user settings will be restored")
        return True

    def restore_camera_preferences(self):
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        if not self.camera_pref_existed:
            self.device.shell(
                "run-as", PACKAGE, "rm", "-f", CAMERA_PREFS, check=False
            )
        else:
            camera_local = self.outdir / "shine_aac_camera_switch.original.xml"
            camera_local.write_text(self.camera_pref_original, encoding="utf-8")
            camera_remote = "/data/local/tmp/shine-aac-camera-switch-original.xml"
            self.device.adb_cmd(
                "push", str(camera_local), camera_remote, check=False, timeout=30
            )
            self.device.shell(
                "run-as", PACKAGE, "cp", camera_remote, CAMERA_PREFS,
                check=False, timeout=30
            )
            self.device.shell("rm", "-f", camera_remote, check=False)

    def install_demo_profile(self):
        """Install a temporary zh-TW camera/E2E profile for physical demo timing."""
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        original = self.device.shell(
            "run-as", PACKAGE, "cat", CONFIG_PREFS, check=False
        )
        self.demo_config_existed = original.returncode == 0
        self.demo_config_original = original.stdout or ""
        profile = """<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="columns" value="6" />
    <int name="configVersion" value="24" />
    <string name="profileId">zh-TW</string>
    <boolean name="e2eEnabled" value="true" />
    <boolean name="rowScanVoice" value="false" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="true" />
    <boolean name="restartScanFromTop" value="true" />
    <string name="switchInputProfile">camera-long-blink</string>
    <boolean name="hardwareButtons" value="false" />
    <boolean name="cameraSwitch" value="true" />
    <float name="scanIntervalMs" value="4000.0" />
    <float name="transitionPauseMs" value="0.0" />
    <float name="firstCellPauseMs" value="8000.0" />
    <float name="inputLatencyCompensationMs" value="250.0" />
</map>
"""
        local_path = self.outdir / "demo-config.applied.xml"
        local_path.write_text(profile, encoding="utf-8")
        remote = "/data/local/tmp/shine-aac-demo-config.xml"
        pushed = self.device.adb_cmd(
            "push", str(local_path), remote, check=False, timeout=30
        )
        if pushed.returncode != 0:
            self.add("P0", "Could not install demo profile", "ADB push failed.")
            return False
        created = self.device.shell(
            "run-as", PACKAGE, "mkdir", "-p", "shared_prefs",
            check=False, timeout=30,
        )
        copied = self.device.shell(
            "run-as", PACKAGE, "cp", remote, CONFIG_PREFS,
            check=False, timeout=30,
        ) if created.returncode == 0 else created
        self.device.shell("rm", "-f", remote, check=False)
        if copied.returncode != 0:
            self.add("P0", "Could not install demo profile", "run-as copy failed.")
            return False
        self.device.adb_cmd("logcat", "-c", check=False, timeout=15)
        if not self.device.launch() or not self.device.ensure_board():
            self.add("P0", "Demo board unavailable", "zh-TW demo profile did not launch.")
            return False
        self.pass_("temporary demo profile", "zh-TW camera input with E2E timing only")
        return True

    def install_feature_profile(self, feature):
        """Install a temporary profile for one focused physical feature test."""
        if feature not in ("hold-advance", "idle-wake"):
            raise ValueError("unknown focused feature: " + str(feature))
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        original = self.device.shell(
            "run-as", PACKAGE, "cat", CONFIG_PREFS, check=False
        )
        self.demo_config_existed = original.returncode == 0
        self.demo_config_original = original.stdout or ""
        hold_advance = feature == "hold-advance"
        profile = """<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="columns" value="6" />
    <int name="configVersion" value="33" />
    <int name="scanPassLimit" value="%d" />
    <string name="profileId">zh-TW</string>
    <string name="scanMode">%s</string>
    <string name="scanTimingPreset">custom</string>
    <string name="idleTimeoutMinutes">%s</string>
    <boolean name="e2eEnabled" value="true" />
    <boolean name="rowScanVoice" value="false" />
    <boolean name="scanVoice" value="false" />
    <boolean name="activationVoice" value="false" />
    <boolean name="restartScanFromTop" value="true" />
    <boolean name="holdToAdvance" value="%s" />
    <string name="switchInputProfile">camera-long-blink</string>
    <boolean name="hardwareButtons" value="false" />
    <boolean name="cameraSwitch" value="true" />
    <float name="scanIntervalMs" value="%s" />
    <float name="transitionPauseMs" value="0.0" />
    <float name="firstCellPauseMs" value="%s" />
    <float name="inputLatencyCompensationMs" value="250.0" />
</map>
""" % (
            0 if hold_advance else 1,
            "block-row-column" if hold_advance else "row-column",
            "0" if hold_advance else "1",
            "true" if hold_advance else "false",
            "4000.0" if hold_advance else "300.0",
            "8000.0" if hold_advance else "300.0",
        )
        local_path = self.outdir / ("%s-config.applied.xml" % feature)
        local_path.write_text(profile, encoding="utf-8")
        remote = "/data/local/tmp/shine-aac-%s-config.xml" % feature
        pushed = self.device.adb_cmd(
            "push", str(local_path), remote, check=False, timeout=30
        )
        copied = self.device.shell(
            "run-as", PACKAGE, "cp", remote, CONFIG_PREFS,
            check=False, timeout=30,
        ) if pushed.returncode == 0 else pushed
        self.device.shell("rm", "-f", remote, check=False)
        if copied.returncode != 0:
            self.add("P0", "Could not install focused feature profile", feature)
            return False
        self.pass_(
            "temporary focused profile",
            "%s settings only; original preferences will be restored" % feature,
        )
        return True

    def enable_e2e_telemetry(self):
        """Enable diagnostic events without changing any user-facing test setting."""
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        original = self.device.shell(
            "run-as", PACKAGE, "cat", CONFIG_PREFS, check=False
        )
        if original.returncode != 0 or not (original.stdout or "").strip():
            self.add(
                "P0", "Could not enable optical telemetry",
                "The existing app preferences could not be read without replacing them."
            )
            return False
        self.demo_config_existed = True
        self.demo_config_original = original.stdout or ""
        try:
            profile = android_preferences_with_boolean(
                self.demo_config_original, "e2eEnabled", True
            )
        except (ET.ParseError, ValueError) as error:
            self.add("P0", "Could not enable optical telemetry", str(error))
            return False
        local_path = self.outdir / "e2e-telemetry-config.applied.xml"
        local_path.write_text(profile, encoding="utf-8")
        remote = "/data/local/tmp/shine-aac-e2e-telemetry.xml"
        pushed = self.device.adb_cmd(
            "push", str(local_path), remote, check=False, timeout=30
        )
        copied = self.device.shell(
            "run-as", PACKAGE, "cp", remote, CONFIG_PREFS,
            check=False, timeout=30,
        ) if pushed.returncode == 0 else pushed
        self.device.shell("rm", "-f", remote, check=False)
        if copied.returncode != 0:
            self.add("P0", "Could not enable optical telemetry", "run-as copy failed.")
            return False
        if not self.device.launch() or not self.device.ensure_board():
            self.add("P0", "Optical telemetry board unavailable", "App did not relaunch.")
            return False
        self.pass_(
            "temporary E2E telemetry",
            "only e2eEnabled changed; original preferences will be restored"
        )
        return True

    def restore_demo_profile(self):
        if self.demo_config_original is None:
            return
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        if not self.demo_config_existed:
            self.device.shell(
                "run-as", PACKAGE, "rm", "-f", CONFIG_PREFS, check=False
            )
        else:
            local_path = self.outdir / "shine_aac_config.original.xml"
            local_path.write_text(self.demo_config_original, encoding="utf-8")
            remote = "/data/local/tmp/shine-aac-config-original.xml"
            self.device.adb_cmd(
                "push", str(local_path), remote, check=False, timeout=30
            )
            self.device.shell(
                "run-as", PACKAGE, "cp", remote, CONFIG_PREFS,
                check=False, timeout=30,
            )
            self.device.shell("rm", "-f", remote, check=False)
        self.demo_config_original = None

    def _install_camera_preferences(self, xml_text, local_name, gesture="blink"):
        """Install a rig-owned camera preference snapshot for this run only."""
        try:
            values = android_preference_values(xml_text)
        except ET.ParseError as error:
            raise ValueError("invalid camera preference fixture: %s" % error)
        required = {"cameraId", "cameraLensFacing", "zoomRatio"}
        if gesture == "cheek":
            required.update({
                "gesture", "cheekCalibratedAtMs", "cheekModel", "cheekHoldMs",
            })
        else:
            required.update({
                "calibratedAtMs", "longBlinkMs", "blinkCloseThreshold",
                "blinkReopenThreshold",
            })
        missing = sorted(required.difference(values))
        if missing:
            raise ValueError("camera preference fixture is missing: %s" % ", ".join(missing))
        local_path = self.outdir / local_name
        local_path.write_text(xml_text, encoding="utf-8")
        remote_path = "/data/local/tmp/shine-aac-optical-session.xml"
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        pushed = self.device.adb_cmd(
            "push", str(local_path), remote_path, check=False, timeout=30
        )
        if pushed.returncode != 0:
            raise RuntimeError("could not push rig session calibration to the phone")
        copied = self.device.shell(
            "run-as", PACKAGE, "cp", remote_path, CAMERA_PREFS,
            check=False, timeout=30
        )
        self.device.shell("rm", "-f", remote_path, check=False)
        if copied.returncode != 0:
            raise RuntimeError("could not apply rig session calibration")
        return values

    def save_session_calibration(self, calibration, preferences_xml):
        """Cache test-video calibration outside app state for focused later runs."""
        values = android_preference_values(preferences_xml)
        if not new_blink_calibration_record("<map />", preferences_xml):
            raise ValueError("completed long-blink calibration record is required")
        SESSION_ROOT.mkdir(parents=True, exist_ok=True)
        (SESSION_ROOT / "blink-preferences.xml").write_text(
            preferences_xml, encoding="utf-8"
        )
        fixture = {
            "schema": 1,
            "purpose": "rig-session-only",
            "created_at_ms": int(time.time() * 1000),
            "selected_camera_id": str(calibration["selected_camera_id"]),
            "desktop_stimulus_center": calibration["desktop_stimulus_center"],
            "estimated_visible_size": calibration["estimated_visible_size"],
            "stimulus_orientation": calibration["stimulus_orientation"],
            "desktop_rect": list(self.host.desktop_rect),
            "presenter": self.host.fixture_identity() if hasattr(
                self.host, "fixture_identity"
            ) else {"kind": "windows_opencv", "rect": list(self.host.desktop_rect)},
            "zoom_ratio": float(values["zoomRatio"]),
            "quality_label": values.get("qualityLabel", "unknown"),
            "quality_detail": values.get("qualityDetail", ""),
            "source": "test-video-calibration",
        }
        (SESSION_ROOT / "blink-fixture.json").write_text(
            json.dumps(fixture, indent=2), encoding="utf-8"
        )
        self.pass_(
            "rig session calibration cached",
            "later focused runs can reuse it without changing app defaults"
        )

    def save_cheek_session_calibration(
        self, calibration, preferences_xml,
        source="downloaded-test-video-calibration",
    ):
        """Cache a personalized cheek model outside product defaults/state."""
        values = android_preference_values(preferences_xml)
        if not values.get("cheekCalibratedAtMs") or not values.get("cheekModel"):
            raise ValueError("completed cheek calibration record is required")
        SESSION_ROOT.mkdir(parents=True, exist_ok=True)
        (SESSION_ROOT / "cheek-preferences.xml").write_text(
            preferences_xml, encoding="utf-8"
        )
        fixture = {
            "schema": 1,
            "purpose": "rig-session-only",
            "gesture": "cheek",
            "created_at_ms": int(time.time() * 1000),
            "selected_camera_id": str(calibration["selected_camera_id"]),
            "desktop_stimulus_center": calibration["desktop_stimulus_center"],
            "estimated_visible_size": calibration["estimated_visible_size"],
            "stimulus_orientation": calibration["stimulus_orientation"],
            "desktop_rect": list(self.host.desktop_rect),
            "presenter": self.host.fixture_identity() if hasattr(
                self.host, "fixture_identity"
            ) else {"kind": "windows_opencv", "rect": list(self.host.desktop_rect)},
            "zoom_ratio": float(values["zoomRatio"]),
            "quality_label": values.get("cheekQualityLabel", "unknown"),
            "quality_detail": values.get("cheekQualityDetail", ""),
            "source": source,
        }
        (SESSION_ROOT / "cheek-fixture.json").write_text(
            json.dumps(fixture, indent=2), encoding="utf-8"
        )
        self.pass_(
            "cheek rig session cached",
            "focused cheek runtime/demo runs can reuse it without changing app defaults"
        )

    def apply_session_calibration(self, gesture="blink"):
        """Apply the ignored session fixture after user preferences were saved."""
        prefix = "cheek" if gesture == "cheek" else "blink"
        fixture_path = SESSION_ROOT / (prefix + "-fixture.json")
        preference_path = SESSION_ROOT / (prefix + "-preferences.xml")
        if not fixture_path.exists() or not preference_path.exists():
            self.add(
                "P0", "No reusable rig calibration session",
                "Create the %s session fixture before focused runtime replay." % prefix
            )
            return None
        try:
            fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
            if fixture.get("purpose") != "rig-session-only":
                raise ValueError("fixture is not marked rig-session-only")
            current_rect = list(self.host.desktop_rect)
            if fixture.get("desktop_rect") != current_rect:
                raise ValueError(
                    "desktop geometry changed from %s to %s"
                    % (fixture.get("desktop_rect"), current_rect)
                )
            expected_presenter = self.host.fixture_identity() if hasattr(
                self.host, "fixture_identity"
            ) else {"kind": "windows_opencv", "rect": current_rect}
            if fixture.get("presenter") != expected_presenter:
                raise ValueError(
                    "presenter identity changed from %s to %s"
                    % (fixture.get("presenter"), expected_presenter)
                )
            orientation = fixture.get("stimulus_orientation")
            if not orientation:
                raise ValueError("session predates upright stimulus calibration; recalibrate")
            rotation = float(orientation["rotation_degrees_ccw"])
            if not math.isfinite(rotation):
                raise ValueError("session media rotation is not finite")
            values = self._install_camera_preferences(
                preference_path.read_text(encoding="utf-8"),
                "%s-session-preferences.applied.xml" % prefix,
                gesture=gesture,
            )
            quality_prefix = "cheekQuality" if gesture == "cheek" else "quality"
            fixture["quality_label"] = values.get(
                quality_prefix + "Label", fixture.get("quality_label", "unknown")
            )
            fixture["quality_detail"] = values.get(
                quality_prefix + "Detail", fixture.get("quality_detail", "")
            )
            vx, vy, _, _ = current_rect
            center = fixture["desktop_stimulus_center"]
            self.stimulus_center = [
                int(round(float(center[0]) - vx)),
                int(round(float(center[1]) - vy)),
            ]
            self.selected_setup_camera_id = str(fixture["selected_camera_id"])
            self.host.set_media_rotation(rotation)
        except (KeyError, TypeError, ValueError, ET.ParseError, OSError, RuntimeError) as error:
            self.add("P0", "Reusable rig calibration is invalid", str(error))
            return None
        self.pass_(
            "rig session calibration applied",
            "camera %s at %.1fx; original phone state remains queued for restoration"
            % (self.selected_setup_camera_id, float(values["zoomRatio"]))
        )
        return fixture

    def ensure_stimuli(self):
        manifest = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
        missing = [
            item["filename"] for item in manifest["sources"]
            if not (DOWNLOADED / item["filename"]).exists()
        ]
        if missing:
            print("Fetching public stimuli:", ", ".join(missing))
            run(
                [sys.executable, "scripts/fetch-optical-stimuli.py"],
                check=False, timeout=240, cwd=ROOT
            )

        available_ids = {
            item["id"] for item in manifest["sources"]
            if (DOWNLOADED / item["filename"]).exists()
        }
        if "commons_blinking" not in available_ids:
            raise SystemExit(
                "Required public blink stimulus is unavailable: commons_blinking"
            )
        for item in manifest["sources"]:
            if item["id"] not in available_ids:
                self.add(
                    "P2",
                    "Optional public optical stimulus unavailable",
                    "%s could not be downloaded; its cases are skipped."
                    % item["id"]
                )
        manifest["sources"] = [
            item for item in manifest["sources"]
            if item["id"] in available_ids
        ]
        manifest["blink_cases"] = [
            case for case in manifest.get("blink_cases", [])
            if case.get("source") in available_ids
        ]
        manifest["negative_cases"] = [
            case for case in manifest.get("negative_cases", [])
            if case.get("source") in available_ids
        ]
        manifest["cheek_cases"] = [
            case for case in manifest.get("cheek_cases", [])
            if case.get("source") in available_ids
        ]
        return manifest

    def start_host(self, source_by_id):
        if self.presenter_mode == "monitor" and not windows_desktop_is_interactive():
            self.add(
                "P0",
                "Windows console is not accessible to the rig process",
                "The runner is not attached to the Windows Default input desktop."
            )
            return False
        vx, vy, vw, vh = self.host.desktop_rect
        initial_state = {
            "mode": "atlas",
            "label": "ONE-SHOT CAMERA VIEW ATLAS",
            "background": "#000",
        }
        if self.args.runtime_only:
            prefix = (
                "blink" if self.args.calibrate_cheek_session
                else self.args.session_gesture
            )
            try:
                fixture = json.loads(
                    (SESSION_ROOT / (prefix + "-fixture.json")).read_text(
                        encoding="utf-8"
                    )
                )
                initial_state = runtime_bootstrap_face_state(
                    fixture, source_by_id["commons_blinking"],
                    self.host.desktop_rect,
                )
                self.host.set_media_rotation(
                    fixture["stimulus_orientation"]["rotation_degrees_ccw"]
                )
            except (KeyError, OSError, TypeError, ValueError):
                initial_state = {
                    "mode": "standby",
                    "label": "SESSION REPLAY STANDBY",
                }
        token = self.host.set_state(**initial_state)
        close_stale_stimulus_windows()
        try:
            self.host.start()
        except RuntimeError as error:
            self.add("P0", "OpenCV stimulus failed to start", str(error))
            return False
        if not self.host.reassert_window(self.host.desktop_rect, timeout=8.0):
            if self.presenter_mode == "monitor" and not windows_desktop_is_interactive():
                self.add(
                    "P0",
                    "Windows console access lost during atlas launch",
                    "The runner left the Windows Default input desktop before the atlas window became visible."
                )
                return False
            self.add(
                "P0",
                "Stimulus presenter could not be verified",
                "The selected presenter did not report a usable target surface."
            )
            return False
        if not self.host.wait_event(token, "state_applied", 20.0):
            diagnostics = {
                "token": token,
                "events": list(self.host.events),
                "presenter_error": str(self.host.error) if self.host.error else None,
                "presenter_hwnd_registered": bool(getattr(self.host, "hwnd", None)),
            }
            (self.outdir / "host-startup-diagnostics.json").write_text(
                json.dumps(diagnostics, indent=2), encoding="utf-8"
            )
            self.add(
                "P0",
                "Atlas did not become ready",
                "The presenter did not acknowledge the pre-armed atlas state.",
                ["host-startup-diagnostics.json"]
            )
            return False

        if self.args.runtime_only:
            print(
                "%s active across presenter surface %dx%d at (%d,%d); "
                "camera-crop-safe standby is the fallback."
                % (
                    "Relaxed public face" if initial_state["mode"] == "video_still"
                    else "Tiled dim standby",
                    vw, vh, vx, vy,
                )
            )
        else:
            print(
                "One-shot coordinate atlas active immediately across presenter surface "
                "%dx%d at (%d,%d); no gray intermediate window."
                % (vw, vh, vx, vy)
            )
        print("Stimulus presenter:", self.host.url)
        return True

    def ensure_stimulus_visible(self, token, label):
        if self.presenter_mode == "monitor" and not windows_desktop_is_interactive():
            self.add(
                "P0", "Windows console access lost during optical test",
                "The runner left the Windows Default input desktop before %s."
                % label
            )
            return False
        if not self.host.reassert_window(self.host.desktop_rect, timeout=4.0):
            self.add(
                "P0", "Stimulus presenter lost",
                "Could not verify the selected presenter for %s." % label
            )
            return False
        if not self.host.wait_event(token, "state_applied", 5.0):
            self.add(
                "P1", "Stimulus state not acknowledged",
                "The presenter did not acknowledge %s before measurement." % label
            )
            return False
        return True

    def optical_camera_log(self):
        result = self.device.adb_cmd(
            "logcat", "-d", "-v", "brief",
            "ShineCameraSetup:I", "ShineCameraSwitch:I", "*:S",
            check=False, timeout=30
        )
        return result.stdout or ""

    def clear_optical_camera_log(self):
        self.device.adb_cmd("logcat", "-c", check=False, timeout=30)

    def current_setup_camera_id(self, ui_checkpoint=None):
        camera_id = latest_optical_camera_id(
            self.optical_camera_log(), "setupId"
        )
        if camera_id or not ui_checkpoint:
            return camera_id
        xml = self.device.ui_dump(ui_checkpoint)
        return camera_id_from_visible_strings(
            self.device.visible_strings(xml)
        )

    def wait_setup_camera_id(self, previous=None, timeout=10.0, checkpoint="rig_camera_identity"):
        deadline = time.time() + timeout
        ui_attempt = 0
        while time.time() < deadline:
            camera_id = self.current_setup_camera_id()
            if camera_id and (previous is None or camera_id != previous):
                return camera_id
            if ui_attempt == 0 or ui_attempt % 4 == 0:
                camera_id = self.current_setup_camera_id(
                    "%s_%02d" % (checkpoint, ui_attempt)
                )
                if camera_id and (previous is None or camera_id != previous):
                    return camera_id
            ui_attempt += 1
            time.sleep(0.25)
        return None

    def _write_camera_cycle(self, attempts):
        (self.outdir / "camera-cycle.json").write_text(
            json.dumps({"attempts": attempts}, indent=2),
            encoding="utf-8"
        )

    def capture_decodable_atlas(self, camera_attempt, camera_id, desktop_rect):
        """Retry presenter-to-camera propagation before rejecting a camera.

        Camera Setup can become ready while another topmost desktop window still
        covers the freshly created OpenCV window. A single screenshot then records
        that stale window and incorrectly looks like a camera-selection failure.
        Re-arm the atlas state and foreground the verified presenter immediately
        before each bounded phone capture. The atlas decoder is the readiness
        oracle; every failed capture remains available as evidence.
        """
        vx, vy, vw, vh = desktop_rect
        captures = []
        for presentation_attempt in range(ATLAS_PRESENTATION_ATTEMPTS):
            label = "coordinate atlas attempt %d.%d" % (
                camera_attempt + 1, presentation_attempt + 1
            )
            token = self.host.set_state(
                mode="atlas",
                label="ONE-SHOT CAMERA VIEW ATLAS RETRY %02d" %
                    (presentation_attempt + 1),
            )
            ready = self.ensure_stimulus_visible(token, label)
            if ready:
                # Reapply the exact full-desktop rectangle after state
                # acknowledgement. This also raises the verified native window
                # immediately before the camera is allowed to settle.
                ready = self.host.reassert_window(
                    (vx, vy, vw, vh), timeout=3.0
                )
            if not ready:
                captures.append({
                    "presentation_attempt": presentation_attempt,
                    "decode_error": "presenter could not be foregrounded",
                })
                continue

            time.sleep(ATLAS_CAMERA_SETTLE_SECONDS)
            screenshot_name = "rig_atlas_camera_%02d_try_%02d" % (
                camera_attempt, presentation_attempt
            )
            shot = self.device.screenshot(screenshot_name)
            capture = {
                "presentation_attempt": presentation_attempt,
                "screenshot": "device/screenshots/%s.png" % screenshot_name,
            }
            try:
                decoded = decode_coordinate_atlas_from_png(
                    shot, desktop_rect
                )
                visible_w, visible_h = decoded["estimated_visible_size"]
                if (
                    decoded["binary_tags"] < 4 or
                    visible_w < 120 or visible_h < 120
                ):
                    raise ValueError("decoded geometry below acceptance bounds")
                capture["atlas_decoded"] = True
                capture["binary_tags"] = decoded["binary_tags"]
                captures.append(capture)
                return decoded, shot, captures
            except Exception as error:
                capture["decode_error"] = str(error)
                captures.append(capture)
                print(
                    "atlas presentation retry %d/%d for cameraId=%s: %s"
                    % (
                        presentation_attempt + 1,
                        ATLAS_PRESENTATION_ATTEMPTS,
                        camera_id,
                        error,
                    )
                )
        return None, None, captures

    def discover_visible_patch(self, timeout):
        vx, vy, vw, vh = self.host.desktop_rect
        if not self.host.reassert_window((vx, vy, vw, vh), timeout=4.0):
            self.add(
                "P0", "Stimulus window could not be positioned",
                "The presenter did not acknowledge its complete atlas rectangle."
            )
            return None
        token = self.host.set_state(
            mode="atlas",
            label="ONE-SHOT CAMERA VIEW ATLAS"
        )
        if not self.ensure_stimulus_visible(token, "coordinate atlas"):
            return None

        deadline = time.time() + max(15.0, float(timeout))
        camera_id = self.wait_setup_camera_id(
            timeout=min(12.0, max(1.0, deadline-time.time()))
        )
        if not camera_id:
            self.add(
                "P0",
                "Camera Setup did not report an active camera",
                "Neither OPTICAL_CAMERA setupId telemetry nor the real Camera label exposed a camera ID.",
                ["device/ui/rig_camera_identity_00.xml"]
            )
            return None

        tested_ids = set()
        attempts = []
        while time.time() < deadline:
            if camera_id in tested_ids:
                self._write_camera_cycle(attempts)
                self.add(
                    "P0",
                    "No reachable camera can see the atlas",
                    "Camera Setup returned to already-tested camera ID %s; all reachable cameras were exhausted."
                    % camera_id,
                    ["camera-cycle.json", "device/screenshots/rig_atlas_camera_*.png"]
                )
                return None

            attempted = len(attempts)
            tested_ids.add(camera_id)
            attempt = {
                "index": attempted,
                "camera_id": camera_id,
            }
            decoded, shot, captures = self.capture_decodable_atlas(
                attempted, camera_id, (vx, vy, vw, vh)
            )
            attempt["captures"] = captures
            if decoded is not None:
                cx, cy = decoded["desktop_center"]
                visible_w, visible_h = decoded["estimated_visible_size"]
                decoded["selected_camera_attempt"] = attempted
                decoded["selected_camera_id"] = camera_id
                attempt["atlas_decoded"] = True
                attempt["binary_tags"] = decoded["binary_tags"]
                attempt["screenshot"] = captures[-1]["screenshot"]
                attempts.append(attempt)
                self._write_camera_cycle(attempts)
                self.selected_setup_camera_id = camera_id
                (self.outdir / "atlas-calibration.json").write_text(
                    json.dumps(decoded, indent=2),
                    encoding="utf-8"
                )
                print(
                    "atlas camera match:",
                    "attempt=%d" % attempted,
                    "cameraId=%s" % camera_id,
                    "center=(%.0f,%.0f)" % (cx,cy),
                    "visible=%.0fx%.0f" % (visible_w,visible_h)
                )
                return {
                    "x": cx-visible_w/2.0,
                    "y": cy-visible_h/2.0,
                    "width": visible_w,
                    "height": visible_h,
                    "center_x": cx,
                    "center_y": cy,
                    "decoded": decoded,
                }
            attempt["decode_error"] = (
                captures[-1].get("decode_error")
                if captures else "atlas presenter produced no capture"
            )
            print(
                "atlas camera attempt %d cameraId=%s did not see display after %d presentation attempts: %s"
                % (
                    attempted, camera_id, len(captures),
                    attempt["decode_error"],
                )
            )
            attempts.append(attempt)
            self._write_camera_cycle(attempts)

            changed = self.device.find_tap(
                [
                    "Next front camera", "下一個前置相機",
                    "Next camera", "下一個相機",
                    "Switch camera", "切換相機",
                ],
                "rig_next_camera_%02d" % attempted,
                swipes=4
            )
            if not changed:
                self.add(
                    "P0",
                    "No reachable camera can see the atlas",
                    "Atlas decode failed for camera ID %s and Camera Setup exposes no usable Next camera control."
                    % camera_id,
                    ["camera-cycle.json"]
                )
                return None
            print("cycling Camera Setup from camera ID", camera_id)
            next_id = self.wait_setup_camera_id(
                previous=camera_id,
                timeout=min(12.0, max(1.0, deadline-time.time())),
                checkpoint="rig_camera_transition_%02d" % attempted
            )
            if not next_id:
                self.add(
                    "P0",
                    "Camera switch did not change the active camera",
                    "The real Next camera control was tapped from camera ID %s, but no different setupId appeared."
                    % camera_id,
                    ["camera-cycle.json"]
                )
                return None
            camera_id = next_id

        self.add(
            "P0",
            "Camera atlas discovery timed out",
            "The rig did not finish camera cycling and one-shot atlas decoding within %d seconds."
            % timeout,
            ["camera-cycle.json", "device/screenshots/rig_atlas_camera_*.png"]
        )
        return None

    def open_camera_setup(self, gesture):
        previous_ui_path = self.camera_setup_ui_path
        if not self.device.launch():
            self.add(
                "P0",
                "Could not launch SHINE",
                "MainActivity did not become ready before Camera Setup navigation."
            )
            return False

        if not self.device.ensure_board():
            self.device.shell("input", "keyevent", "4", check=False)
            time.sleep(0.5)
            if not self.device.ensure_board():
                self.add(
                    "P0",
                    "Communication board unavailable",
                    "Could not reach the board before opening Settings."
                )
                return False

        if not self.device.open_config(901):
            self.add(
                "P0",
                "Could not open Settings",
                "The optical rig could not open SHINE's configuration page."
            )
            return False

        time.sleep(0.6)

        if not self.read_scan_mode_from_settings():
            return False
        if not self.select_runtime_optical_profile():
            return False

        # Do NOT rely on UIAutomator's `scrollable=true` bounds here.
        # SHINE's configuration is inside a WebView and Android can expose a
        # technically scrollable ancestor that does not respond to the helper's
        # chosen gesture. Use a deliberate on-screen swipe so the physical phone
        # visibly scrolls exactly as a user would.
        patterns = ["camera setup", "相機設定"]
        opened = False
        tap_attempts = 0
        last_xml = None

        for attempt in range(13):
            xml = self.device.ui_dump(
                "rig_camera_setup_nav_%02d" % attempt
            )
            self.device.screenshot(
                "rig_camera_setup_nav_%02d" % attempt
            )
            last_xml = xml

            node = exact_visible_label(self.device, xml, patterns)
            if node and self.device.tap_node(node):
                tap_attempts += 1
                print(
                    "camera setup navigation: visible target tap %d "
                    "after %d config-page swipe(s)" % (tap_attempts, attempt)
                )
                if self.device.wait_activity(CAMERA_ACTIVITY_FRAGMENT, 3):
                    opened = True
                    break
                # A WebView select change can still be settling when the first
                # synthetic tap arrives.  Re-dump and retry the same visible
                # control; never call a tap successful until Android proves the
                # native Activity is top-resumed.
                print(
                    "camera setup navigation: tap did not open native Activity; "
                    "retrying from fresh UI state"
                )
                time.sleep(0.5)
                continue

            if attempt >= 12:
                break

            # Gesture coordinates are intentionally based on the actual device
            # dimensions rather than UIAutomator scroll-container metadata.
            x = int(self.device.screen_w * 0.50)
            start_y = int(self.device.screen_h * 0.80)
            end_y = int(self.device.screen_h * 0.24)
            print(
                "camera setup navigation: Camera Setup not visible; "
                "scrolling config page %d/12" % (attempt + 1)
            )
            self.device.shell(
                "input",
                "swipe",
                str(x),
                str(start_y),
                str(x),
                str(end_y),
                "520",
                check=False
            )
            time.sleep(0.70)

        if not opened:
            evidence = []
            if last_xml:
                evidence.append(
                    "device/ui/rig_camera_setup_nav_12.xml"
                )
            evidence.append(
                "device/screenshots/rig_camera_setup_nav_12.png"
            )
            self.add(
                "P0",
                "Camera Setup Activity did not open",
                "Settings opened and the visible Camera Setup control was "
                "retried, but CameraSwitchCalibrationActivity never became "
                "top-resumed.",
                evidence
            )
            return False

        time.sleep(1.0)

        if gesture == "blink":
            self.device.find_tap(
                ["Long blink", "長眨眼"],
                "rig_mode_blink",
                swipes=1
            )
        elif gesture == "cheek":
            self.device.find_tap(
                ["Cheek movement", "臉頰動作"],
                "rig_mode_cheek",
                swipes=1
            )

        time.sleep(0.7)
        ready_path = self.device.ui_dump("rig_camera_setup_ready_" + gesture)
        try:
            selected_path, ready_geometry = camera_setup_geometry_with_fallback(
                ready_path, previous_ui_path
            )
            self.camera_setup_ui_path = selected_path
            self.active_zoom_ratio = float(ready_geometry["zoom_ratio"])
            if selected_path == previous_ui_path and ready_path != previous_ui_path:
                print(
                    "camera setup geometry: fresh UI dump unavailable; "
                    "retaining prior stable layout evidence"
                )
        except ValueError:
            self.camera_setup_ui_path = None
        return True

    def case_display_scale(self, case):
        base_face_height = case.get("face_height_at_zoom_1x")
        target_face_height = case.get("target_face_height")
        if base_face_height is None or target_face_height is None:
            return float(case.get("display_scale", 1.0))
        denominator = max(0.01, float(base_face_height) * self.active_zoom_ratio)
        return max(0.1, min(2.0, float(target_face_height) / denominator))

    def verify_cheek_framing(self, screenshot_path, trial):
        if not self.camera_setup_ui_path:
            self.add("P1", "Cheek framing could not be measured", "Camera Setup geometry is missing.")
            return False
        try:
            preview = camera_setup_geometry(self.camera_setup_ui_path)["preview_rect"]
            image = self.host.cv2.imread(str(screenshot_path), self.host.cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("screenshot could not be decoded")
            blue, green, red = self.host.cv2.split(image)
            mask = (
                (green > 150) & (red < 110) & (blue < 200) &
                (green > red * 1.45)
            )
            ys, xs = self.host.numpy.where(mask)
            measured = face_overlay_coverage_from_points(
                list(zip(xs.tolist(), ys.tolist())), preview
            )
            if measured is None:
                raise ValueError("face overlay was not found")
        except (ET.ParseError, OSError, ValueError) as error:
            self.add(
                "P1", "Cheek framing could not be measured", str(error),
                [str(screenshot_path.relative_to(self.outdir))]
            )
            return False
        measured.update({
            "trial": trial,
            "preview_rect": list(preview),
            "camera_zoom_ratio": self.active_zoom_ratio,
            "accepted_height_range": [MIN_RIG_FACE_HEIGHT, MAX_RIG_FACE_HEIGHT],
        })
        (self.outdir / "cheek-framing.json").write_text(
            json.dumps(measured, indent=2), encoding="utf-8"
        )
        height = measured["height_fraction"]
        if not MIN_RIG_FACE_HEIGHT <= height <= MAX_RIG_FACE_HEIGHT:
            self.add(
                "P1", "Public cheek stimulus framing is outside the 70% target",
                "Measured face height %.1f%%; required %.0f-%.0f%%."
                % (height * 100, MIN_RIG_FACE_HEIGHT * 100, MAX_RIG_FACE_HEIGHT * 100),
                ["cheek-framing.json", str(screenshot_path.relative_to(self.outdir))]
            )
            return False
        self.pass_(
            "public cheek face framing",
            "measured %.1f%% of preview height (target about 70%%)" % (height * 100)
        )
        return True

    def select_runtime_optical_profile(self):
        """Ensure a real camera-gesture input option is selected in Settings."""
        first_xml = self.device.ui_dump("rig_switch_input_root")
        if not switch_input_label_from_settings_xml(first_xml):
            # Substring matching also selects "restart after input" in the
            # neighboring Scanning pane. Use the category's exact visible label.
            section = exact_visible_label(self.device, first_xml, ["input", "輸入"])
            if section and self.device.tap_node(section):
                time.sleep(0.6)
        for attempt in range(7):
            xml = self.device.ui_dump(
                "rig_switch_input_nav_%02d" % attempt
            )
            current = switch_input_label_from_settings_xml(xml)
            if current:
                if self.original_switch_input_label is None:
                    self.original_switch_input_label = current
                if is_camera_switch_input_label(current):
                    print(
                        "runtime input navigation: existing %s already enables camera gestures"
                        % current
                    )
                    return True
            selector = self.device.find_node(
                xml, [current] if current else [], visible_only=True
            ) if current else None
            if selector and self.device.tap_node(selector):
                time.sleep(0.6)
                dialog = self.device.ui_dump("rig_switch_input_dialog")
                option = self.device.find_node(
                    dialog,
                    ["camera gesture", "相機動作", "camera long blink", "相機長眨眼"],
                    visible_only=True
                )
                if option and self.device.tap_node(option):
                    self.switch_input_changed = not is_camera_switch_input_label(
                        self.original_switch_input_label
                    )
                    print(
                        "runtime input navigation: selected Camera gesture "
                        "through SHINE Settings"
                    )
                    time.sleep(0.5)
                    return True
                self.device.shell("input", "keyevent", "4", check=False)
                self.add(
                    "P0",
                    "Camera input option unavailable",
                    "The real Switch input selector opened, but Camera gesture was not available.",
                    ["device/ui/rig_switch_input_dialog.xml"]
                )
                return False
            if attempt < 6:
                self.device.shell(
                    "input", "swipe",
                    str(int(self.device.screen_w * 0.50)),
                    str(int(self.device.screen_h * 0.80)),
                    str(int(self.device.screen_w * 0.50)),
                    str(int(self.device.screen_h * 0.30)),
                    "500", check=False
                )
                time.sleep(0.6)
        self.add(
            "P0",
            "Switch input selector not reachable",
            "SHINE Settings opened, but the real Switch input control was not reachable."
        )
        return False

    def read_scan_mode_from_settings(self):
        """Read, without changing, the real scan mode needed by the UI oracle."""
        xml = self.device.ui_dump("rig_scan_mode")
        self.scan_mode = scan_mode_from_settings_xml(xml)
        opened_native_section = False
        if not self.scan_mode:
            section = self.device.find_node(
                xml, ["scanning", "掃描"], visible_only=True
            )
            if section and self.device.tap_node(section):
                opened_native_section = True
                time.sleep(0.6)
                xml = self.device.ui_dump("rig_scan_mode_section")
                self.scan_mode = scan_mode_from_settings_xml(xml)
        # Expanded Settings retains its category list beside the detail pane.
        # Back there exits Settings entirely; compact detail still needs Back.
        category_visible = opened_native_section and exact_visible_label(
            self.device, xml, ["input", "輸入"]
        )
        if opened_native_section and not category_visible:
            self.device.shell("input", "keyevent", "4", check=False)
            time.sleep(0.5)
        if not self.scan_mode:
            self.add(
                "P0", "Unknown scan mode",
                "No recognized visible scan-mode value was exposed by Settings.",
                ["device/ui/rig_scan_mode.xml"]
            )
            return None
        self.pass_("visible activation oracle", "scan mode is " + self.scan_mode)
        return self.scan_mode

    def save_settings_to_board(self):
        """Save the currently visible Settings draft through the real UI."""
        if SETTINGS_ACTIVITY_FRAGMENT in self.device.top_activity():
            for _ in range(3):
                self.device.shell("input", "keyevent", "4", check=False)
                time.sleep(0.7)
                xml = self.device.ui_dump("rig_native_settings_back")
                if self.device.is_board_ui(xml):
                    return True
            self.add(
                "P0", "Could not return to board",
                "Native Settings Back navigation did not return to the board.",
                ["device/ui/rig_native_settings_back.xml"],
            )
            return False
        saved = False
        for attempt in range(6):
            xml = self.device.ui_dump("rig_save_nav_%02d" % attempt)
            save_node = self.device.find_node(
                xml, ["save", "儲存"], visible_only=True
            )
            if save_node and self.device.tap_node(save_node):
                saved = True
                time.sleep(0.9)
                break
            if attempt < 5:
                self.device.shell(
                    "input", "swipe",
                    str(int(self.device.screen_w * 0.50)),
                    str(int(self.device.screen_h * 0.80)),
                    str(int(self.device.screen_w * 0.50)),
                    str(int(self.device.screen_h * 0.30)),
                    "500", check=False
                )
                time.sleep(0.6)
        if not saved:
            self.add(
                "P0", "Could not save optical input profile",
                "The real Save control was not reachable in Settings."
            )
            return False
        xml = self.device.ui_dump("rig_board")
        if not self.device.is_board_ui(xml):
            self.add(
                "P0", "Could not return to board",
                "Board unavailable after saving Settings."
            )
            return False
        return True

    def camera_setup_to_board(self):
        self.device.shell("input","keyevent","4",check=False)
        time.sleep(.8)
        xml = self.device.ui_dump("rig_after_camera_back")
        if not self.device.is_config_ui(xml):
            self.add("P0","Camera setup did not return to config",
                     "Optical rig cannot continue reliably.",
                     ["device/ui/rig_after_camera_back.xml"])
            return False
        return self.save_settings_to_board()

    def prepare_runtime_from_session(self):
        """Enable normal Camera input without reopening native calibration."""
        if not self.device.launch() or not self.device.ensure_board():
            self.add("P0", "Communication board unavailable", "Could not prepare focused runtime cases.")
            return False
        if not self.device.open_config(901):
            self.add("P0", "Could not open Settings", "Focused runtime setup could not reach Settings.")
            return False
        time.sleep(0.6)
        if not self.read_scan_mode_from_settings():
            return False
        if not self.select_runtime_optical_profile():
            return False
        return self.save_settings_to_board()

    def restore_switch_input_profile(self):
        """Undo the rig's temporary Switch input choice through normal Settings."""
        if not self.switch_input_changed or not self.original_switch_input_label:
            return True
        if not self.device.launch():
            return False
        if self.device.wait_activity(CAMERA_ACTIVITY_FRAGMENT, 1.0):
            self.device.shell("input", "keyevent", "4", check=False)
            time.sleep(0.8)
        current = self.device.ui_dump("rig_restore_switch_start")
        if not self.device.is_config_ui(current):
            if not self.device.ensure_board():
                self.device.shell("input", "keyevent", "4", check=False)
                time.sleep(0.5)
            if not self.device.ensure_board() or not self.device.open_config(901):
                return False
        time.sleep(0.6)
        for attempt in range(7):
            xml = self.device.ui_dump("rig_restore_switch_nav_%02d" % attempt)
            current = switch_input_label_from_settings_xml(xml)
            selector = self.device.find_node(
                xml, [current], visible_only=True
            ) if current else None
            if selector and self.device.tap_node(selector):
                time.sleep(0.5)
                dialog = self.device.ui_dump("rig_restore_switch_dialog")
                original = self.device.find_node(
                    dialog, [self.original_switch_input_label], visible_only=True
                )
                if not original or not self.device.tap_node(original):
                    return False
                time.sleep(0.4)
                restored = self.save_settings_to_board()
                if restored:
                    self.switch_input_changed = False
                return restored
            if attempt < 6:
                self.device.shell(
                    "input", "swipe",
                    str(int(self.device.screen_w * 0.50)),
                    str(int(self.device.screen_h * 0.80)),
                    str(int(self.device.screen_w * 0.50)),
                    str(int(self.device.screen_h * 0.30)),
                    "500", check=False
                )
                time.sleep(0.6)
        return False

    def show_video_still(self, source, at_s, label, scale=1.0):
        token = self.host.set_state(
            mode="video_still",
            label=label,
            url="/media/" + source["filename"],
            start=float(at_s),
            center=self.stimulus_center,
            scale=float(scale),
        )
        return token if self.ensure_stimulus_visible(token, label) else None

    def wait_setup_text(self, patterns, timeout, checkpoint):
        wanted = [p.casefold() for p in patterns]
        deadline = time.time() + timeout
        attempt = 0
        while time.time() < deadline:
            xml = self.device.ui_dump("%s_%02d" % (checkpoint, attempt))
            visible = "\n".join(self.device.visible_strings(xml)).casefold()
            if any(pattern in visible for pattern in wanted):
                return visible
            attempt += 1
            time.sleep(0.35)
        return None

    def wait_for_app_audio_playback_starts(
        self, app_pid, required, timeout, log_name
    ):
        """Wait for a count of SHINE-owned AudioTrack playback starts."""
        deadline = time.time() + timeout
        last_log = ""
        while time.time() < deadline:
            result = self.device.adb_cmd(
                "logcat", "-d", "-v", "epoch",
                "AudioPlayerStateMonitor:D", "*:S",
                check=False, timeout=15
            )
            last_log = result.stdout or ""
            if app_audio_playback_start_count(last_log, app_pid) >= required:
                (self.outdir / log_name).write_text(
                    last_log, encoding="utf-8", errors="replace"
                )
                return True
            time.sleep(0.18)
        (self.outdir / log_name).write_text(
            last_log, encoding="utf-8", errors="replace"
        )
        return False

    def wait_for_calibration_start_tones(self, app_pid, required=2, timeout=45.0):
        """Wait for SHINE-owned start tones; tone two begins slow-blink capture."""
        return self.wait_for_app_audio_playback_starts(
            app_pid, required, timeout, "blink-calibration-audio.log"
        )

    def run_video_still_sequence(self, case, source, evidence_path=None):
        timeline = {
            "case": case["id"],
            "source": source["id"],
            "started_epoch_s": time.time(),
            "events": [],
        }
        for index, item in enumerate(case["stills"]):
            gesture = case.get("gesture", "blink")
            activation_source = (
                "android-camera-cheek-twitch"
                if gesture == "cheek" else "android-camera-long-blink"
            )
            activation_count_before = self.observed_activation_count(activation_source) if item.get("hold_until_activation") else None
            token = self.show_video_still(
                source,
                item["start"],
                "%s %02d" % (case["id"], index + 1),
            )
            if not token:
                return False
            applied = next(
                (
                    event for event in self.host.events
                    if event.get("token") == token and
                    event.get("type") == "state_applied"
                ),
                None,
            )
            presented_at = time.time()
            applied_at = float((applied or {}).get("t", presented_at))
            requested_duration = max(0.03, float(item.get("ms", 100)) / 1000.0)
            duration = requested_duration
            activation_observed = None
            traces = []
            if (
                self.args.trace_hold and duration >= 1.0 and
                float(item.get("start", 0.0)) != 0.75
            ):
                safe_case = re.sub(r"[^A-Za-z0-9_-]", "_", case["id"])
                for trace_index, delay in enumerate((0.35, 0.90), 1):
                    def capture_after(wait_s=delay, suffix=trace_index):
                        time.sleep(wait_s)
                        self.device.screenshot(
                            "case_%s_hold_%02d_%02d"
                            % (safe_case, index + 1, suffix)
                        )
                    trace = threading.Thread(target=capture_after, daemon=True)
                    trace.start()
                    traces.append(trace)
            if item.get("hold_until_activation"):
                # Model normal AAC use: the user keeps holding until the
                # feedback tone/event, rather than releasing on a host timer.
                # The timeout is a missed-input bound, not the target duration.
                activation_observed = False
                timeout_s = max(
                    requested_duration,
                    float(item.get("activation_timeout_ms", 5000)) / 1000.0,
                )
                deadline = time.time() + timeout_s
                while time.time() < deadline:
                    current_count = self.observed_activation_count(activation_source)
                    if current_count > activation_count_before:
                        activation_observed = True
                        # Retain the pose briefly so activation feedback is not
                        # coupled to the presenter changing on the same tick.
                        time.sleep(0.20)
                        break
                    time.sleep(0.12)
            else:
                time.sleep(duration)
            for trace in traces:
                trace.join(timeout=0.2)
            ended_at = time.time()
            timeline["events"].append({
                "index": index + 1,
                "cycle": int(item.get("cycle", index // 3 + 1)),
                "pose": item.get("pose", "unspecified"),
                "source_time_s": float(item["start"]),
                "requested_ms": int(item.get("ms", 100)),
                "presenter_token": token,
                "presenter_acknowledged": bool(applied),
                "presented_epoch_s": applied_at,
                "ended_epoch_s": ended_at,
                "actual_presented_ms": round((ended_at - applied_at) * 1000.0, 1),
                "hold_until_activation": bool(item.get("hold_until_activation")),
                "activation_observed": activation_observed,
            })
            if evidence_path:
                evidence_path.write_text(
                    json.dumps(timeline, indent=2), encoding="utf-8"
                )
        timeline["completed_epoch_s"] = time.time()
        if evidence_path:
            evidence_path.write_text(
                json.dumps(timeline, indent=2), encoding="utf-8"
            )
        return True

    def start_device_screen_recording(self, label, limit=30):
        safe_label = re.sub(r"[^A-Za-z0-9_-]", "_", label)
        remote = "/sdcard/shine-rig-%s.mp4" % safe_label
        self.device.shell("rm", remote, check=False)
        process = subprocess.Popen(
            [
                self.adb, "-s", self.device.serial, "shell", "screenrecord", "--time-limit",
                str(int(limit)), remote,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(0.35)
        if process.poll() is not None:
            return None
        return {
            "process": process,
            "remote": remote,
            "path": self.outdir / (label + ".mp4"),
            "limit": int(limit),
        }

    def finish_device_screen_recording(self, recording):
        if not recording:
            return None
        process = recording["process"]
        try:
            process.wait(timeout=recording["limit"] + 5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        destination = recording["path"]
        self.device.adb_cmd(
            "pull", recording["remote"], str(destination),
            check=False, timeout=60,
        )
        self.device.shell("rm", recording["remote"], check=False)
        return destination if destination.exists() and destination.stat().st_size else None

    def calibrate_long_blink(self, source):
        """Exercise native blink calibration with real open/closed face frames."""
        calibration_started_at = time.time()
        if not self.show_video_still(source, 0.75, "BLINK CALIBRATION OPEN"):
            return False
        before_preferences = self.device.shell(
            "run-as", PACKAGE, "cat", CAMERA_PREFS, check=False
        ).stdout or ""
        setup_started = False
        app_pid = None
        for attempt in range(3):
            xml = self.camera_setup_ui_path if attempt == 0 else self.device.ui_dump(
                "rig_blink_calibration_start_%02d" % attempt
            )
            self.device.screenshot("rig_blink_calibration_start_%02d" % attempt)
            node = self.device.find_node(
                xml, ["Start setup", "開始設定"], visible_only=True
            )
            if node:
                pid_result = self.device.shell("pidof", PACKAGE, check=False)
                app_pids = (pid_result.stdout or "").strip().split()
                app_pid = app_pids[0] if app_pids else None
                self.device.adb_cmd("logcat", "-c", check=False, timeout=15)
                setup_started = bool(app_pid) and self.device.tap_node(node)
                if setup_started:
                    time.sleep(0.2)
                    break
            if attempt < 2:
                self.device.scroll_forward(xml)
        if not setup_started:
            self.add(
                "P1", "Long-blink calibration could not start",
                "The photographed Camera Setup layout exposed no usable Start setup control."
            )
            return False

        # Keep the verified open pose through preparation and rest. TTS runs in
        # its engine process, while both native start tones are AudioTracks owned
        # by SHINE. The second SHINE-owned playback begins the 12-second slow-
        # blink capture, independent of speech duration or UIAutomator idleness.
        if not self.wait_for_calibration_start_tones(app_pid):
            self.add(
                "P1", "Long-blink calibration phase was not observed",
                "The second SHINE-owned calibration start tone was not observed.",
                ["blink-calibration-audio.log"]
            )
            return False

        calibration_audio = (
            self.outdir / "blink-calibration-audio.log"
        ).read_text(encoding="utf-8", errors="replace")
        speech_starts = speech_audio_playback_start_count(calibration_audio)
        if speech_starts < 1:
            self.add(
                "P1", "Long-blink calibration speech was not observed",
                "No system TTS speech playback started before the calibration tones.",
                ["blink-calibration-audio.log"]
            )
            return False
        self.pass_(
            "long-blink calibration speech playback",
            "%d system TTS speech start(s) observed before app-owned tones"
            % speech_starts,
        )

        calibration_case = {
            "id": "blink_calibration_trials",
            "stills": [],
        }
        # Five complete deliberate closures fit within the remaining native capture
        # window even when hierarchy observation consumed part of its first
        # second. Alternate verified closed poses to avoid one-pose overfit.
        verified_closed_times = (0.00, 3.00)
        for cycle in range(5):
            calibration_case["stills"].extend([
                {"start": 0.75, "ms": 400, "pose": "open", "cycle": cycle + 1},
                {
                    "start": verified_closed_times[cycle % len(verified_closed_times)],
                    "ms": 1600,
                    "pose": "long-closed",
                    "cycle": cycle + 1,
                },
                {"start": 0.75, "ms": 400, "pose": "open", "cycle": cycle + 1},
            ])
        recording = self.start_device_screen_recording(
            "blink-calibration-preview", limit=30
        )
        timeline_path = self.outdir / "blink-calibration-stimulus-timeline.json"
        sequence_completed = self.run_video_still_sequence(
            calibration_case, source, timeline_path
        )
        if not sequence_completed:
            self.finish_device_screen_recording(recording)
            return False
        time.sleep(5.0)
        preview_path = self.finish_device_screen_recording(recording)
        try:
            timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            timeline = None
        if not blink_calibration_timeline_is_complete(timeline) or not preview_path:
            self.add(
                "P1", "Long-blink calibration evidence is incomplete",
                "The rig did not preserve both the 15-step presenter timeline and the phone Camera Setup preview recording.",
                [
                    "blink-calibration-stimulus-timeline.json",
                    "blink-calibration-preview.mp4",
                ],
            )
            return False
        completed = self.wait_setup_text(
            ["calibration complete", "校準完成"], 18,
            "rig_blink_calibration_complete"
        )
        self.device.screenshot("rig_blink_calibration_complete")
        after_preferences = self.device.shell(
            "run-as", PACKAGE, "cat", CAMERA_PREFS, check=False
        ).stdout or ""
        (self.outdir / "blink-calibration-preferences.xml").write_text(
            after_preferences, encoding="utf-8"
        )
        try:
            saved_record = new_blink_calibration_record(
                before_preferences, after_preferences
            )
        except (ET.ParseError, ValueError):
            saved_record = None
        if not saved_record:
            self.add(
                "P1", "Long-blink calibration did not complete",
                "The native setup workflow did not save a newer calibratedAtMs record with timing and threshold fields.",
                [
                    "device/screenshots/rig_blink_calibration_complete.png",
                    "blink-calibration-preferences.xml",
                ]
            )
            return False
        result = {
            "gesture": "long-blink",
            "elapsed_s": round(time.time() - calibration_started_at, 3),
            "source": source["id"],
            "open_time_s": 0.75,
            "closed_times_s": list(verified_closed_times),
            "replay_cycles": 5,
            "stimulus_timeline": "blink-calibration-stimulus-timeline.json",
            "camera_preview_recording": "blink-calibration-preview.mp4",
            "saved_record": saved_record,
            "completion_text_observed": bool(completed),
        }
        (self.outdir / "blink-calibration.json").write_text(
            json.dumps(result, indent=2), encoding="utf-8"
        )
        if not blink_calibration_quality_is_good(saved_record):
            self.add(
                "P1", "Native long-blink calibration quality is not good",
                saved_record.get("qualityDetail") or saved_record.get("qualityLabel") or "unknown",
                ["blink-calibration.json", "blink-calibration-preferences.xml"]
            )
            return False
        self.pass_(
            "native long-blink calibration",
            "good-quality real-face rest/trial capture saved in %.1fs" % result["elapsed_s"]
        )
        return True

    def calibrate_cheek(self, cases, source_by_id=None):
        """Exercise native unlabeled cheek-sample discovery with real video or frames."""
        neutral = next((c for c in cases if c.get("expect") == "no_activate"), None)
        positives = [c for c in cases if c.get("expect") == "activate"][:6]
        if neutral is None or not positives:
            self.add(
                "P2", "Cheek calibration pack is incomplete",
                "Calibration needs one neutral sequence and at least one twitch sequence."
            )
            return False
        before_preferences = self.device.shell(
            "run-as", PACKAGE, "cat", CAMERA_PREFS, check=False
        ).stdout or ""
        if "frames" in neutral:
            token = self.host.set_state(
                mode="sequence", label="CHEEK CALIBRATION NEUTRAL",
                frames=neutral["frames"], mirror=bool(neutral.get("mirror", False)),
                loop=True,
                center=self.stimulus_center,
                scale=self.case_display_scale(neutral),
            )
            if not self.ensure_stimulus_visible(token, "cheek calibration neutral"):
                return False
        else:
            source = source_by_id[neutral["source"]]
            if not self.show_video_still(
                source, float(neutral.get("rest_at", source.get("rest_at_s", 0.0))),
                "CHEEK CALIBRATION NEUTRAL",
                scale=self.case_display_scale(neutral),
            ):
                return False
        pid_result = self.device.shell("pidof", PACKAGE, check=False)
        app_pids = (pid_result.stdout or "").strip().split()
        app_pid = app_pids[0] if app_pids else None
        self.device.adb_cmd("logcat", "-c", check=False, timeout=15)
        if not self.device.find_tap(
            ["Start setup", "開始設定"], "rig_cheek_calibration_start", swipes=2
        ):
            self.add(
                "P1", "Cheek calibration could not start",
                "Camera Setup exposed no usable Start setup control in cheek mode."
            )
            return False
        if not app_pid or not self.device.wait_activity(CAMERA_ACTIVITY_FRAGMENT, 3.0):
            self.add(
                "P1", "Cheek calibration did not remain active",
                "The normal Start setup tap did not leave Camera Setup top-resumed."
            )
            return False

        # Camera Setup needs 36 successfully analyzed relaxed frames. Keep the
        # natural neutral sequence looping for a conservative interval; unlike
        # UIAutomator hierarchy polling this never stalls the live camera page.
        time.sleep(8.0)
        self.device.screenshot("rig_cheek_calibration_rest_complete")

        started = time.time()
        replayed_cases = []
        saved_record = None
        after_preferences = before_preferences
        for trial, case in enumerate(positives, 1):
            if "frames" in case:
                nominal = sum(float(f.get("ms", 100)) for f in case["frames"]) / 1000.0
                token = self.host.set_state(
                    mode="sequence", label="CHEEK CALIBRATION SAMPLE %d" % trial,
                    frames=case["frames"], mirror=bool(case.get("mirror", False)),
                    center=self.stimulus_center,
                    scale=self.case_display_scale(case),
                )
            else:
                source = source_by_id[case["source"]]
                start = float(case.get("start", 0.0))
                end_at = case.get("end")
                source_end = float(end_at) if end_at is not None else float(source["duration_s"])
                rate = float(case.get("rate", 1.0))
                nominal = max(0.0, source_end - start) / max(rate, 0.01)
                token = self.host.set_state(
                    mode="video", label="CHEEK CALIBRATION SAMPLE %d" % trial,
                    url="/media/" + source["filename"], rate=rate, loop=False,
                    start=start, end=end_at, center=self.stimulus_center,
                    scale=self.case_display_scale(case),
                )
            if not self.ensure_stimulus_visible(token, "cheek calibration %d" % trial):
                return False
            if not self.host.wait_event(token, "ended", nominal + 5.0):
                self.add(
                    "P1", "Cheek calibration replay stalled",
                    "Downloaded trial %d did not finish in the OpenCV presenter." % trial
                )
                return False
            replayed_cases.append(case)
            sample_screenshot = self.device.screenshot(
                "rig_cheek_calibration_sample_%02d" % trial
            )
            if not self.verify_cheek_framing(sample_screenshot, trial):
                return False

            # Completion is quality-based rather than a per-twitch registration event. Poll the
            # durable model after each continuous sample sequence and stop as soon as it is saved.
            save_deadline = time.time() + 3.0
            while time.time() < save_deadline and saved_record is None:
                after_preferences = self.device.shell(
                    "run-as", PACKAGE, "cat", CAMERA_PREFS, check=False
                ).stdout or ""
                try:
                    saved_record = new_cheek_calibration_record(
                        before_preferences, after_preferences
                    )
                except (ET.ParseError, ValueError):
                    saved_record = None
                if saved_record is None:
                    time.sleep(0.25)
            if saved_record is not None:
                break

        # The durable newer model below is the completion oracle. A screenshot
        # records the normal user-visible result without asking UIAutomator to
        # idle against continuously changing preview metrics.
        time.sleep(1.0)
        self.device.screenshot("rig_cheek_calibration_complete")
        (self.outdir / "cheek-calibration-preferences.xml").write_text(
            after_preferences, encoding="utf-8"
        )
        if not saved_record:
            self.add(
                "P1", "Cheek calibration did not save",
                "%d real twitch sequences were replayed, but no newer durable personalized model was saved."
                % len(replayed_cases),
                [
                    "device/screenshots/rig_cheek_calibration_complete.png",
                    "cheek-calibration-preferences.xml",
                ]
            )
            return False
        if len(replayed_cases) >= 6:
            self.add(
                "P1", "Cheek calibration still behaved like a six-registration gate",
                "The known clear fixture did not save a quality-approved model before all six legacy sequences were replayed.",
                [
                    "device/screenshots/rig_cheek_calibration_complete.png",
                    "cheek-calibration-preferences.xml",
                ],
            )
            return False
        if app_pid:
            self.wait_for_app_audio_playback_starts(
                app_pid, 1, 2.0, "cheek-calibration-audio.log"
            )
        result = {
            "gesture": "cheek-twitch",
            "elapsed_s": round(time.time() - started, 3),
            "neutral_case": neutral["id"],
            "sample_cases": [case["id"] for case in replayed_cases],
            "sample_sequence_count": len(replayed_cases),
            "completed_before_legacy_six": len(replayed_cases) < 6,
            "saved_record": saved_record,
        }
        (self.outdir / "cheek-calibration.json").write_text(
            json.dumps(result, indent=2), encoding="utf-8"
        )
        self.pass_(
            "native cheek calibration",
            "quality-approved model discovered from %d unlabeled twitch sequence(s) in %.1fs"
            % (len(replayed_cases), result["elapsed_s"])
        )
        return True

    def verify_runtime_camera_selection(self, timeout=12.0):
        deadline = time.time() + timeout
        runtime_id = None
        last_log = ""
        while time.time() < deadline:
            last_log = self.optical_camera_log()
            runtime_id = latest_optical_camera_id(last_log, "runtimeId")
            if runtime_id:
                break
            time.sleep(0.3)
        (self.outdir / "runtime-camera.log").write_text(
            last_log, encoding="utf-8", errors="replace"
        )
        expected = self.selected_setup_camera_id
        if not runtime_id:
            self.add(
                "P0",
                "Runtime camera identity was not reported",
                "The enabled runtime camera pipeline emitted no OPTICAL_CAMERA runtimeId telemetry.",
                ["runtime-camera.log"]
            )
            return False
        if not expected or runtime_id != expected:
            self.add(
                "P0",
                "Setup and runtime selected different cameras",
                "Camera Setup selected ID %s, but runtime opened ID %s."
                % (expected or "unknown", runtime_id),
                ["camera-cycle.json", "runtime-camera.log"]
            )
            return False
        self.pass_(
            "selected camera persists into runtime",
            "setupId=%s runtimeId=%s" % (expected, runtime_id)
        )
        return True

    def calibrate(self, timeout):
        found = self.discover_visible_patch(timeout)
        if not found:
            return None

        zoom_result = self.adjust_camera_zoom_from_atlas(found)
        if zoom_result is None:
            return None

        vx, vy, vw, vh = self.host.desktop_rect
        final_ui = self.device.ui_dump("rig_final_atlas_geometry")
        self.camera_setup_ui_path = final_ui
        try:
            final_geometry = camera_setup_geometry(final_ui)
            cx, cy = desktop_aim_from_atlas(
                found["decoded"],
                final_geometry["preview_rect"],
                (vx, vy, vw, vh),
            )
        except (ET.ParseError, OSError, ValueError) as error:
            self.add("P0", "Could not calculate final stimulus XY", str(error))
            return None
        if not (vx <= cx <= vx + vw and vy <= cy <= vy + vh):
            self.add(
                "P0", "Camera aim falls outside the PC display",
                "Atlas maps the preview center to desktop (%.0f, %.0f), outside %s. Camera zoom cannot correct this physical aim."
                % (cx, cy, (vx, vy, vw, vh)),
                ["atlas-calibration.json", "device/ui/rig_final_atlas_geometry.xml"]
            )
            return None
        self.stimulus_center = [int(round(cx - vx)), int(round(cy - vy))]
        orientation = media_orientation_from_atlas(
            found["decoded"], final_geometry["preview_rect"], self.host.desktop_rect
        )
        self.host.set_media_rotation(orientation["rotation_degrees_ccw"])
        self.pass_("calibrated upright media",
            "presenter content rotates %.2f degrees counter-clockwise from the measured camera-up direction"
            % orientation["rotation_degrees_ccw"])
        result = {
            "discovery": "one-shot-full-desktop-coordinate-atlas",
            "desktop_stimulus_center": [cx, cy],
            "estimated_visible_size": [found["width"], found["height"]],
            "desktop_center": [cx, cy],
            "selected_camera_attempt":
                found["decoded"].get("selected_camera_attempt", 0),
            "selected_camera_id":
                found["decoded"].get("selected_camera_id"),
            "camera_zoom": zoom_result,
            "stimulus_orientation": orientation,
        }
        (self.outdir / "calibration.json").write_text(
            json.dumps(result, indent=2),
            encoding="utf-8"
        )
        self.pass_(
            "monitor/camera calibration",
            "full-screen atlas identified camera attempt %d; unscaled media uses desktop aim (%.0f, %.0f)"
            % (result["selected_camera_attempt"], cx, cy)
        )
        return result

    def clear_runtime_log(self):
        self.device.adb_cmd("logcat","-c",check=False)

    def runtime_log(self):
        r = self.device.adb_cmd(
            "logcat", "-d", "-v", "epoch",
            "ShineCameraSwitch:I", "ShineFaceAnalysis:I", "ShineAacE2E:I", "*:S",
            check=False,timeout=30
        )
        return r.stdout or ""

    def e2e_log(self):
        result = self.device.adb_cmd(
            "logcat", "-d", "-v", "epoch", "ShineAacE2E:I", "*:S",
            check=False, timeout=30,
        )
        return result.stdout or ""

    def observed_activation_count(self, source):
        """Retain event identities so Android log rotation cannot subtract inputs."""
        observed = getattr(self, "_observed_activation_lines", set())
        previous_size = len(observed)
        for line in self.e2e_log().splitlines():
            match = re.search(r"SHINE_AAC_E2E_INPUT\s+(\{[^\r\n]+\})", line)
            if not match:
                continue
            try:
                event = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
            if event.get("intent") != "activate":
                continue
            if not re.match(r"\s*\d+\.\d+\s", line):
                raise RuntimeError("Activation evidence lacks an epoch event identity")
            observed.add(line.strip())
        self._observed_activation_lines = observed
        if len(observed) != previous_size and hasattr(self, "outdir"):
            (self.outdir / "observed-activation-events.log").write_text(
                "\n".join(sorted(observed)) + "\n", encoding="utf-8"
            )
        return e2e_input_count("\n".join(observed), "activate", source)

    def e2e_recent_log(self, lookback_seconds=15.0):
        """Read fresh E2E state without retransferring the whole growing camera log.

        A full log dump becomes several seconds old during a long physical session.
        Using that stale snapshot to aim a delayed gesture can select the next cell.
        Android logcat accepts an epoch start time, so keep target observation bounded
        to the latest scan intervals while retaining the complete log for evidence.
        """
        since = time.time() - max(5.0, float(lookback_seconds))
        result = self.device.adb_cmd(
            "logcat", "-d", "-t", "%.3f" % since, "-v", "epoch",
            "ShineAacE2E:I", "*:S", check=False, timeout=15,
        )
        return result.stdout or ""

    def wait_demo_state(
        self, timeout=35.0, stage=None, row_index=None, cell_index=None,
        message=None, not_before_epoch_s=None, speech_lock_action=None,
    ):
        deadline = time.time() + timeout
        last_state = None
        while time.time() < deadline:
            last_state = latest_e2e_state(self.e2e_recent_log())
            if last_state:
                matches = (
                    (stage is None or last_state.get("stage") == stage) and
                    (row_index is None or last_state.get("rowIndex") == row_index) and
                    (cell_index is None or last_state.get("cellIndex") == cell_index) and
                    (message is None or last_state.get("message") == message) and
                    (speech_lock_action is None or (
                        last_state.get("phase") == "SpeechLock" and
                        last_state.get("speechLockSurface") == "board" and
                        last_state.get("speechLockAction") == speech_lock_action and
                        speech_lock_action in last_state.get("speechLockReachableActions", [])
                    )) and
                    (
                        not_before_epoch_s is None or
                        float(last_state.get("_logEpochS", 0)) >= not_before_epoch_s
                    )
                )
                if matches:
                    return last_state
            time.sleep(0.25)
        return None

    def demo_activate(
        self, case, source_by_id, step_label, report_miss=True,
        activation_count_before=None,
    ):
        """Perform one normal optical activation without resetting board state."""
        gesture = case.get("gesture", "blink")
        source_name = (
            "android-camera-cheek-twitch"
            if gesture == "cheek" else "android-camera-long-blink"
        )
        before = (
            activation_count_before
            if activation_count_before is not None
            else self.observed_activation_count(source_name)
        )
        started_at = time.time()
        if "frames" in case:
            token = self.host.set_state(
                mode="sequence", label="DEMO " + step_label,
                frames=case["frames"], mirror=bool(case.get("mirror", False)),
                center=self.stimulus_center,
            )
            nominal = sum(float(frame.get("ms", 100)) for frame in case["frames"]) / 1000.0
        elif "stills" in case:
            source = source_by_id[case["source"]]
            nominal = sum(
                float(item.get("ms", 100)) for item in case["stills"]
            ) / 1000.0
            if not self.run_video_still_sequence(case, source):
                return False
            token = None
        else:
            source = source_by_id[case["source"]]
            start = float(case.get("start", 0.0))
            end_at = case.get("end")
            rate = float(case.get("rate", 1.0))
            source_end = float(end_at) if end_at is not None else float(source["duration_s"])
            nominal = max(0.0, source_end - start) / max(rate, 0.01)
            token = self.host.set_state(
                mode="video", label="DEMO " + step_label,
                url="/media/" + source["filename"], rate=rate, loop=False,
                start=start, end=end_at, center=self.stimulus_center,
            )
        if token:
            if not self.ensure_stimulus_visible(token, "demo-" + step_label):
                return False
            self.host.wait_event(token, "ended", nominal + 6.0)
        if not self.demo_show_rest(case, source_by_id, step_label):
            return False
        deadline = time.time() + 4.0
        while time.time() < deadline:
            after = self.observed_activation_count(source_name)
            result = demo_activation_result(before, after)
            if result == "DUPLICATE":
                self.demo_steps.append({
                    "step": step_label,
                    "gesture": case.get("gesture", "blink"),
                    "case": case.get("id"),
                    "started_epoch_s": started_at,
                    "completed_epoch_s": time.time(),
                    "activation_count_before": before,
                    "activation_count_after": after,
                    "result": result,
                })
                (self.outdir / "demo-steps.json").write_text(
                    json.dumps(self.demo_steps, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                self.add(
                    "P1", "One physical gesture produced duplicate activations",
                    "%s produced %d activations." % (step_label, after - before),
                    ["demo-e2e-%s.log" % gesture, "demo-steps.json"],
                )
                return None
            if result == "PASS":
                self.demo_steps.append({
                    "step": step_label,
                    "gesture": case.get("gesture", "blink"),
                    "case": case.get("id"),
                    "started_epoch_s": started_at,
                    "completed_epoch_s": time.time(),
                    "activation_count_before": before,
                    "activation_count_after": after,
                    "result": result,
                })
                (self.outdir / "demo-steps.json").write_text(
                    json.dumps(self.demo_steps, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                time.sleep(0.35)
                return True
            time.sleep(0.15)
        self.demo_steps.append({
            "step": step_label,
            "gesture": case.get("gesture", "blink"),
            "case": case.get("id"),
            "started_epoch_s": started_at,
            "completed_epoch_s": time.time(),
            "activation_count_before": before,
            "activation_count_after": self.observed_activation_count(source_name),
            "result": "MISS",
        })
        (self.outdir / "demo-steps.json").write_text(
            json.dumps(self.demo_steps, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if report_miss:
            gesture = case.get("gesture", "blink")
            self.add(
                "P1", "Physical demo activation missed", step_label,
                ["demo-e2e-%s.log" % gesture, "demo-steps.json"],
            )
        return False

    def demo_activate_with_retries(
        self, case, source_by_id, step_label, target_wait=None, attempts=3
    ):
        presented_attempts = 0
        for attempt in range(1, attempts + 1):
            activation_count_before = None
            if target_wait:
                source_name = (
                    "android-camera-cheek-twitch"
                    if case.get("gesture", "blink") == "cheek"
                    else "android-camera-long-blink"
                )
                activation_count_before = self.observed_activation_count(source_name)
            if target_wait and not target_wait():
                self.demo_steps.append({
                    "step": "%s ATTEMPT %d" % (step_label, attempt),
                    "gesture": case.get("gesture", "blink"),
                    "case": case.get("id"),
                    "completed_epoch_s": time.time(),
                    "result": "TARGET_TIMEOUT",
                })
                (self.outdir / "demo-steps.json").write_text(
                    json.dumps(self.demo_steps, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                continue
            presented_attempts += 1
            activation_result = self.demo_activate(
                case, source_by_id,
                "%s ATTEMPT %d" % (step_label, attempt),
                report_miss=False,
                activation_count_before=activation_count_before,
            )
            if activation_result is None:
                return False
            if activation_result:
                if attempt > 1:
                    gesture = case.get("gesture", "blink")
                    self.add(
                        "P2", "Physical demo required gesture retry",
                        "%s succeeded on attempt %d." % (step_label, attempt),
                        ["demo-steps.json", "demo-e2e-%s.log" % gesture],
                    )
                return True
        gesture = case.get("gesture", "blink")
        self.add(
            "P1", ("Physical demo activation missed after retries" if presented_attempts
                   else "Physical demo scan target unavailable"),
            "%s failed after %d attempts; %d gestures presented."
            % (step_label, attempts, presented_attempts),
            ["demo-steps.json", "demo-e2e-%s.log" % gesture],
        )
        return False

    def demo_release_review_if_held(self, case, source_by_id, step_label):
        """Wake a camera review hold only when scan motion does not resume itself."""
        initial = latest_e2e_state(self.e2e_recent_log()) or {}
        initial_position = (
            initial.get("stage"), initial.get("blockIndex"),
            initial.get("rowIndex"), initial.get("cellIndex"),
        )
        initial_epoch = float(initial.get("_logEpochS", 0))
        deadline = time.time() + 5.5
        while time.time() < deadline:
            current = latest_e2e_state(self.e2e_recent_log()) or {}
            current_position = (
                current.get("stage"), current.get("blockIndex"),
                current.get("rowIndex"), current.get("cellIndex"),
            )
            if (
                float(current.get("_logEpochS", 0)) > initial_epoch and
                current_position != initial_position
            ):
                return True
            time.sleep(0.25)
        return self.demo_activate_with_retries(
            case, source_by_id, "WAKE REVIEW " + step_label
        )

    def demo_show_rest(self, case, source_by_id, step_label):
        """Keep a real relaxed/open face visible between physical gestures."""
        if "frames" in case:
            rest = [
                dict(frame) for frame in case["frames"]
                if frame.get("phase") in ("Neutral", "Rest", "Idle")
            ]
            if not rest:
                rest = [dict(case["frames"][0])]
            token = self.host.set_state(
                mode="sequence", label="DEMO REST " + step_label,
                frames=rest, mirror=bool(case.get("mirror", False)), loop=True,
                center=self.stimulus_center,
                scale=self.case_display_scale(case),
            )
            return self.ensure_stimulus_visible(token, "demo-rest-" + step_label)
        source = source_by_id[case["source"]]
        return bool(self.show_video_still(
            source, float(case.get(
                "rest_at", source.get("rest_at_s", case.get("start", 0.0))
            )),
            "DEMO REST " + step_label,
            scale=self.case_display_scale(case),
        ))

    def demo_select_label(self, labels, case, source_by_id):
        """Select a semantic board item from the currently rendered state.

        The rig discovers the item's current row and cell. It does not assume
        a fixed coordinate, and accepts copy aliases so harmless wording
        changes do not masquerade as optical failures.
        """
        if isinstance(labels, str):
            labels = [labels]
        state = latest_e2e_state(self.e2e_recent_log())
        if not state:
            self.add("P0", "Demo render state unavailable", ", ".join(labels))
            return None
        target = semantic_board_target(state, labels)
        if target is None:
            self.add(
                "P0", "Demo semantic item unavailable",
                "Expected one of %s; current rows were %s."
                % (labels, state.get("rows", [])),
                ["demo-e2e.log"],
            )
            return None
        matched_label, row_index, cell_index = target
        if state.get("phase") == "SpeechLock":
            action = semantic_speech_lock_action(labels)
            if (not action or state.get("speechLockSurface") != "board" or
                    action not in state.get("speechLockReachableActions", [])):
                self.add("P1", "Demo locked action unavailable", matched_label)
                return None
            if not self.demo_show_rest(case, source_by_id, "WAIT ACTION " + matched_label):
                return None
            def wait_action():
                return bool(self.wait_demo_state(
                    speech_lock_action=action, timeout=35.0,
                    not_before_epoch_s=time.time(),
                ))
            if self.demo_activate_with_retries(
                case, source_by_id, "ACTION " + matched_label, target_wait=wait_action
            ):
                return matched_label
            return None
        if not board_uses_flat_cell_scan(state):
            if not self.demo_show_rest(case, source_by_id, "WAIT ROW " + matched_label):
                return None
            def wait_row():
                return bool(self.wait_demo_state(
                    stage="Rows", row_index=row_index, timeout=70.0,
                    not_before_epoch_s=time.time(),
                ))
            if not self.demo_activate_with_retries(
                case, source_by_id, "ROW " + matched_label, target_wait=wait_row
            ):
                return None
        elif not self.demo_show_rest(
            case, source_by_id, "WAIT CELL " + matched_label
        ):
            return None
        def wait_cell():
            if cell_index == 0:
                return bool(self.wait_demo_state(
                    stage="FirstCell", row_index=row_index, cell_index=0,
                    timeout=35.0, not_before_epoch_s=time.time(),
                ))
            return bool(self.wait_demo_state(
                stage="Cells", row_index=row_index,
                cell_index=cell_index, timeout=25.0,
                not_before_epoch_s=time.time(),
            ))
        if not self.demo_activate_with_retries(
            case, source_by_id, "CELL " + matched_label, target_wait=wait_cell
        ):
            return None
        return matched_label

    def wait_demo_message_change(self, before, not_before_epoch_s, timeout=8.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            state = latest_e2e_state(self.e2e_recent_log())
            if (
                state and state.get("message") != before and
                float(state.get("_logEpochS", 0)) >= not_before_epoch_s
            ):
                return state
            time.sleep(0.2)
        return None

    def wait_demo_semantic_available(self, labels, timeout=12.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            state = latest_e2e_state(self.e2e_recent_log())
            if semantic_board_target(state, labels):
                return state
            time.sleep(0.25)
        return None

    def demo_prepare_scanner(self, case, source_by_id):
        initial_scan = self.wait_demo_state()
        if not initial_scan:
            self.add("P0", "Demo scanner did not start", case.get("gesture", "blink"))
            return False
        if not self.demo_show_rest(case, source_by_id, "INITIAL"):
            return False
        if initial_scan.get("phase") == "Review":
            return self.demo_activate_with_retries(case, source_by_id, "RELEASE REVIEW")
        return True

    def run_physical_demo(self, gesture, manifest, source_by_id):
        started_at = time.time()
        scenario = PHYSICAL_NORMAL_USE_SCENARIOS[gesture]
        source_name = ("android-camera-cheek-twitch" if gesture == "cheek"
                       else "android-camera-long-blink")
        activation_baseline = self.observed_activation_count(source_name)
        if gesture == "cheek":
            cases = [
                dict(case, gesture="cheek") for case in manifest.get("cheek_cases", [])
                if case.get("expect") == "activate"
            ]
            case = cases[0] if cases else None
            if case:
                case["id"] += "_demo"
        else:
            case = next((
                dict(item, gesture="blink")
                for item in manifest.get("blink_cases", [])
                if item.get("id") == "blink_long_positive_01"
            ), None)
            if case:
                case["stills"] = [dict(item) for item in case["stills"]]
                case["stills"][0]["ms"] = 250
                case["id"] += "_demo_timed"
        if not case:
            self.add("P0", "No physical demo gesture", gesture)
            return False
        if not self.demo_prepare_scanner(case, source_by_id):
            return False
        initial_state = latest_e2e_state(self.e2e_recent_log()) or {}
        message = initial_state.get("message", "")
        spoken_messages = []
        selections = []
        if message:
            normalize_started_at = time.time()
            matched_label = self.demo_select_label(
                ("清除", "清空", "Clear", "CLR"), case, source_by_id
            )
            if not matched_label:
                return False
            cleared = self.wait_demo_state(
                message="", timeout=8.0,
                not_before_epoch_s=normalize_started_at,
            )
            if not cleared:
                self.add(
                    "P1", "Extended demo could not clear retained text",
                    "Normal-use setup started with %r." % message,
                )
                return False
            selections.append({
                "index": 0,
                "kind": "clear",
                "concept": "clear retained message",
                "visible_label": matched_label,
            })
            message = ""
            if not self.demo_release_review_if_held(
                case, source_by_id, "INITIAL CLEAR"
            ):
                return False
        current_state = latest_e2e_state(self.e2e_recent_log()) or {}
        if not semantic_board_target(current_state, ("幫忙", "幫我")):
            if not semantic_board_target(current_state, ("注音", "Zhuyin")):
                self.add(
                    "P0", "Demo Chinese board unavailable",
                    "The current board exposed neither the Chinese help item nor a Zhuyin return control.",
                )
                return False
            matched_label = self.demo_select_label(
                ("注音", "Zhuyin"), case, source_by_id
            )
            if not matched_label:
                return False
            if not self.wait_demo_semantic_available(("幫忙", "幫我")):
                self.add(
                    "P1", "Demo could not return to Chinese board",
                    "Selecting the visible Zhuyin control did not reveal the Chinese help item.",
                )
                return False
            selections.append({
                "index": -1,
                "kind": "close_category",
                "concept": "normalize to Zhuyin",
                "visible_label": matched_label,
            })
            if not self.demo_release_review_if_held(
                case, source_by_id, "INITIAL ZHUYIN"
            ):
                return False
        for index, step in enumerate(scenario["steps"], 1):
            before_message = message
            selected_at = time.time()
            labels = step.get("labels")
            if step["kind"] == "append_wrong_dynamic":
                state = latest_e2e_state(self.e2e_recent_log()) or {}
                labels = next((
                    (value,)
                    for row in state.get("rows", [])[:4]
                    for value in row
                    if value and value not in {"復原", "撤銷", "Undo"}
                ), None)
                if not labels:
                    self.add(
                        "P0", "Demo dynamic suggestion unavailable",
                        "No current non-function suggestion could exercise Undo.",
                    )
                    return False
            matched_label = self.demo_select_label(labels, case, source_by_id)
            if not matched_label:
                return False
            selections.append({
                "index": index,
                "kind": step["kind"],
                "concept": step["concept"],
                "visible_label": matched_label,
            })

            expected_message = step.get("message")
            if expected_message is not None:
                state = self.wait_demo_state(
                    message=expected_message,
                    timeout=8.0,
                    not_before_epoch_s=selected_at,
                )
                if not state:
                    self.add(
                        "P1", "Extended demo message did not update",
                        "%s expected %r" % (step["concept"], expected_message),
                    )
                    return False
                message = state.get("message", "")
            elif step["kind"] in ("append_dynamic", "append_wrong_dynamic"):
                state = self.wait_demo_message_change(
                    before_message, selected_at, timeout=8.0
                )
                if not state:
                    self.add(
                        "P1", "Extended demo dynamic text did not update",
                        step["concept"],
                    )
                    return False
                message = state.get("message", "")
                if (
                    step["kind"] == "append_dynamic" and
                    message != before_message + matched_label.lower()
                ):
                    self.add(
                        "P1", "Extended demo selected the wrong dynamic cell",
                        "%s expected %r but produced %r"
                        % (step["concept"], before_message + matched_label.lower(), message),
                    )
                    return False
            else:
                current = latest_e2e_state(self.e2e_recent_log()) or {}
                message = current.get("message", message)

            if step["kind"] == "speak":
                if not message:
                    self.add("P1", "Extended demo tried to speak empty text", step["concept"])
                    return False
                spoken_messages.append(message)

            if not self.demo_release_review_if_held(
                case, source_by_id, step["concept"]
            ):
                return False

            if step.get("reveals") and not self.wait_demo_semantic_available(
                step["reveals"]
            ):
                self.add(
                    "P1", "Extended demo category transition failed",
                    "%s did not reveal %s" % (step["concept"], step["reveals"]),
                )
                return False

        if len(spoken_messages) != 4:
            self.add(
                "P1", "Extended demo did not complete four speech turns",
                str(spoken_messages),
            )
            return False
        log = self.e2e_log()
        (self.outdir / ("demo-e2e-%s.log" % gesture)).write_text(
            log, encoding="utf-8", errors="replace"
        )
        self.device.screenshot("demo_%s_complete" % gesture)
        result = {
            "gesture": gesture,
            "scenario": "extended-normal-use",
            "role": scenario["role"],
            "goal": scenario["goal"],
            "spoken_messages": spoken_messages,
            "selections": selections,
            "selection_count": len(selections),
            "elapsed_s": round(time.time() - started_at, 3),
            "physical_activations": self.observed_activation_count(source_name) - activation_baseline,
        }
        (self.outdir / ("physical-demo-%s.json" % gesture)).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self.pass_(
            "physical %s demo" % gesture,
            "%d selections completed goal %r through real camera activations"
            % (len(selections), scenario["goal"]),
        )
        return True

    def reset_board_for_case(self, label):
        """Recreate the normal board so every case starts at Review pause."""
        self.device.shell("am", "force-stop", PACKAGE, check=False)
        if not self.device.launch() or not self.device.ensure_board():
            self.add("P0", "Could not reset board for optical case", label)
            return None
        time.sleep(1.2)
        xml = self.device.ui_dump("case_%s_before" % label)
        self.device.screenshot("case_%s_before" % label)
        try:
            phase = board_phase_from_xml(xml)
        except (ET.ParseError, OSError) as error:
            self.add("P0", "Could not read board phase", str(error))
            return None
        if phase != "review":
            self.add(
                "P0", "Optical case did not start from Review pause",
                "%s started in visible phase %r." % (label, phase),
                [
                    "device/ui/case_%s_before.xml" % label,
                    "device/screenshots/case_%s_before.png" % label,
                ]
            )
            return None
        return phase

    def focused_positive_case(self, gesture, manifest):
        if gesture == "cheek":
            candidates = [
                dict(case, gesture="cheek")
                for case in manifest.get("cheek_cases", [])
                if case.get("expect") == "activate"
            ]
            return candidates[0] if candidates else None
        case = next((
            dict(item, gesture="blink")
            for item in manifest.get("blink_cases", [])
            if item.get("id") == "blink_long_positive_01"
        ), None)
        return case

    def run_hold_advance_feature(self, manifest, source_by_id):
        case = self.focused_positive_case("blink", manifest)
        if not case:
            self.add("P0", "No blink stimulus for Hold to advance", "")
            return False
        if not self.wait_demo_state(stage="Blocks", timeout=12.0):
            self.add("P0", "Hold test did not start in block scanning", "")
            return False
        if not self.demo_show_rest(case, source_by_id, "HOLD INITIAL REST"):
            return False
        if not self.demo_activate_with_retries(
            case, source_by_id, "HOLD RELEASE INITIAL REVIEW"
        ):
            return False
        time.sleep(1.0)
        self.clear_runtime_log()
        if not self.demo_show_rest(case, source_by_id, "HOLD PRE-ROLL"):
            return False
        time.sleep(0.8)
        before = latest_e2e_state(self.e2e_recent_log()) or {}
        before_message = str(before.get("message", ""))
        source = source_by_id[case["source"]]
        if not self.show_video_still(
            source, 3.00, "HOLD TO ADVANCE — KEEP CLOSED"
        ):
            return False
        source_name = "android-camera-long-blink"
        selected = None
        deadline = time.time() + 7.0
        while time.time() < deadline:
            state = latest_e2e_state(self.e2e_recent_log()) or {}
            if str(state.get("message", "")) != before_message:
                selected = state
                break
            time.sleep(0.2)
        self.device.screenshot("hold_advance_leaf_while_closed")
        if not selected:
            self.add(
                "P1", "Sustained gesture did not reach a leaf",
                "One real long blink did not change the message through block, first row, and first cell.",
                ["device/screenshots/hold_advance_leaf_while_closed.png"],
            )
            self.show_video_still(source, 0.75, "HOLD RELEASE")
            return False
        selected_message = str(selected.get("message", ""))
        first_count = self.observed_activation_count(source_name)
        time.sleep(1.5)
        latched = latest_e2e_state(self.e2e_recent_log()) or {}
        latched_count = self.observed_activation_count(source_name)
        self.device.screenshot("hold_advance_latched_while_closed")
        self.show_video_still(source, 0.75, "HOLD RELEASE")
        time.sleep(1.0)
        result = {
            "before_message": before_message,
            "selected_message": selected_message,
            "latched_message": str(latched.get("message", "")),
            "native_activation_count_at_leaf": first_count,
            "native_activation_count_while_latched": latched_count,
            "final_stage": latched.get("stage"),
        }
        (self.outdir / "hold-advance-feature.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        if (
            not selected_message or
            str(latched.get("message", "")) != selected_message or
            first_count != 1 or latched_count != 1
        ):
            self.add(
                "P1", "Hold to advance was not bounded",
                json.dumps(result, ensure_ascii=False),
                [
                    "hold-advance-feature.json",
                    "device/screenshots/hold_advance_leaf_while_closed.png",
                    "device/screenshots/hold_advance_latched_while_closed.png",
                ],
            )
            return False
        self.pass_(
            "physical Hold to advance",
            "one real sustained blink selected one leaf and remained latched until release",
        )
        return True

    def run_idle_wake_feature(self, gesture, manifest, source_by_id):
        case = self.focused_positive_case(gesture, manifest)
        if not case:
            self.add("P0", "No positive stimulus for idle wake", gesture)
            return False
        source_name = (
            "android-camera-cheek-twitch"
            if gesture == "cheek" else "android-camera-long-blink"
        )
        if not self.wait_demo_state(stage="Rows", timeout=12.0):
            self.add("P0", "Idle test did not start in row scanning", gesture)
            return False
        if not self.demo_show_rest(case, source_by_id, "IDLE INITIAL REST"):
            return False
        if not self.demo_activate_with_retries(
            case, source_by_id, "IDLE RELEASE INITIAL REVIEW"
        ):
            return False
        stopped = self.wait_demo_state(stage="Stopped", timeout=18.0)
        if not stopped:
            self.add(
                "P1", "Scanner did not stop before idle countdown",
                "The focused profile uses one scan pass, but no Stopped state appeared.",
            )
            return False
        stopped_message = str(stopped.get("message", ""))
        self.clear_runtime_log()
        if not self.demo_show_rest(case, source_by_id, "IDLE WAIT"):
            return False
        idle_log = ""
        idle_deadline = time.time() + 75.0
        while time.time() < idle_deadline:
            idle_log = self.e2e_log()
            if "powerSaving" in e2e_camera_statuses(idle_log, source_name):
                break
            time.sleep(0.5)
        (self.outdir / "idle-camera.log").write_text(
            idle_log, encoding="utf-8", errors="replace"
        )
        idle_statuses = e2e_camera_statuses(idle_log, source_name)
        if "powerSaving" not in idle_statuses:
            self.add(
                "P1", "Paused idle did not engage",
                "No powerSaving camera status appeared after a full Stopped-only timeout.",
                ["idle-camera.log"],
            )
            return False
        brightness_result = self.device.shell(
            "dumpsys", "window", "windows", check=False
        )
        brightness_text = brightness_result.stdout or ""
        (self.outdir / "idle-window.txt").write_text(
            brightness_text, encoding="utf-8", errors="replace"
        )
        brightness_values = window_brightness_values(brightness_text)
        self.device.screenshot("idle_power_saving")
        activation_started = time.time()
        if not self.demo_activate(case, source_by_id, "IDLE OPTICAL WAKE"):
            return False
        resumed = self.wait_demo_state(
            stage="Rows", message=stopped_message, timeout=12.0,
            not_before_epoch_s=activation_started,
        )
        wake_log = self.e2e_log()
        wake_statuses = e2e_camera_statuses(wake_log, source_name)
        self.device.screenshot("idle_resumed")
        result = {
            "gesture": gesture,
            "stopped_message": stopped_message,
            "idle_statuses": idle_statuses,
            "window_brightness_values": brightness_values,
            "resumed_stage": (resumed or {}).get("stage"),
            "resumed_message": (resumed or {}).get("message"),
            "wake_statuses": wake_statuses,
        }
        (self.outdir / "idle-wake-feature.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        if not resumed:
            self.add(
                "P1", "Idle optical activation did not wake safely",
                json.dumps(result, ensure_ascii=False),
                [
                    "idle-wake-feature.json", "idle-camera.log",
                    "device/screenshots/idle_power_saving.png",
                    "device/screenshots/idle_resumed.png",
                ],
            )
            return False
        self.pass_(
            "physical paused idle wake",
            "%s entered powerSaving only after Stopped; one gesture resumed without selection" % gesture,
        )
        return True

    def play_case(self, case, source_by_id=None, retry=0):
        label = case["id"]
        cooled = self.guard("optical-case-"+label)
        if cooled:
            gesture = case.get("gesture") or "blink"
            if not self.open_camera_setup(gesture) or not self.camera_setup_to_board():
                self.add("P0","Could not restore app after thermal cooldown",label)
                return None

        # A real user's relaxed face is already present while CameraX and the
        # detector start. Starting every trial from the rig's black idle frame
        # made the calibrated open-baseline requirement depend on cold ML Kit
        # latency rather than on the gesture under test.
        if not self.demo_show_rest(case, source_by_id, "PRE-ROLL " + label):
            return None
        before_phase = self.reset_board_for_case(label)
        if before_phase is None:
            return None
        self.clear_runtime_log()
        t0 = time.time()
        token = None
        ended = None
        if "frames" in case:
            token = self.host.set_state(
                mode="sequence", label=label,
                frames=case["frames"], mirror=bool(case.get("mirror",False)),
                center=self.stimulus_center,
                scale=self.case_display_scale(case),
            )
            nominal = sum(float(f.get("ms",100)) for f in case["frames"]) / 1000.0
        elif "stills" in case:
            source = source_by_id[case["source"]]
            nominal = sum(float(f.get("ms", 100)) for f in case["stills"]) / 1000.0
        else:
            source = source_by_id[case["source"]]
            url = "/media/" + source["filename"]
            rate = float(case.get("rate",1.0))
            start = float(case.get("start", 0.0))
            end_at = case.get("end")
            token = self.host.set_state(
                mode="video", label=label, url=url, rate=rate, loop=False,
                start=start, end=end_at,
                center=self.stimulus_center,
                scale=self.case_display_scale(case),
            )
            source_end = float(end_at) if end_at is not None else float(source["duration_s"])
            nominal = max(0.0, source_end - start) / max(rate,0.01)

        if "stills" in case:
            if not self.run_video_still_sequence(case, source):
                return None
            ended = {"type": "ended", "synthetic": "video-still-sequence"}
        else:
            if not self.ensure_stimulus_visible(token, label):
                return None

        timeout = min(max(nominal + 8.0, 12.0), 75.0)
        end = time.time() + timeout
        while ended is None and time.time() < end:
            ended = self.host.wait_event(token,"ended",0.5)
            if ended:
                break
            sample = self.thermal.sample("case-"+label,"during_case")
            if self.thermal.should_cool(sample):
                self.demo_show_rest(case, source_by_id, "THERMAL HOLD " + label)
                self.thermal.guard(
                    "mid-case-"+label,
                    on_suspend=self.thermal_suspend,
                    on_resume=self.thermal_resume
                )
                if retry < 1:
                    return self.play_case(case,source_by_id,retry=retry+1)
                self.add("P1","Thermal interruption repeated",
                         "Case %s was interrupted twice."%label,
                         ["thermal.csv"])
                return None

        if not self.demo_show_rest(case, source_by_id, "INTER-CASE REST " + label):
            return None
        time.sleep(1.0)
        after_xml = self.device.ui_dump("case_%s_after" % label)
        self.device.screenshot("case_%s_after" % label)
        log = self.runtime_log()
        expected_source = (
            "android-camera-cheek-twitch"
            if case.get("gesture") == "cheek"
            else "android-camera-long-blink"
        )
        try:
            after_phase = board_phase_from_xml(after_xml)
            observed_activations, activation_oracle = observed_case_activations(
                log, expected_source, before_phase, after_phase, self.scan_mode
            )
        except (ET.ParseError, OSError, ValueError) as error:
            after_phase = None
            observed_activations = None
            activation_oracle = "unavailable"
            self.add(
                "P0", "Uncertain visible activation result: " + label,
                str(error),
                [
                    "device/ui/case_%s_before.xml" % label,
                    "device/screenshots/case_%s_before.png" % label,
                    "device/ui/case_%s_after.xml" % label,
                    "device/screenshots/case_%s_after.png" % label,
                ]
            )
        (self.outdir/("case-%s.log"%label)).write_text(log,encoding="utf-8")
        perf = face_performance_samples(log)
        stalls = optical_stall_events(log)
        result = {
            "id":label,
            "expect":case.get("expect","observe"),
            "activations": observed_activations,
            "oracle": activation_oracle,
            "presenter": ended or {},
            "before_phase": before_phase,
            "after_phase": after_phase,
            "elapsed_s":time.time()-t0,
            "ended":bool(ended),
            "log":"case-%s.log"%label,
            "source": expected_source,
            "face_performance": perf,
            "stall_events": stalls,
        }
        self.results.append(result)
        expect = result["expect"]
        min_activations = int(case.get(
            "min_activations", 1 if expect == "activate" else 0
        ))
        max_activations = int(case.get(
            "max_activations",
            1 if expect == "activate" else (0 if expect == "no_activate" else 999999)
        ))
        if observed_activations is None:
            return result
        if expect == "no_activate" and observed_activations:
            self.add(case.get("severity","P1"),
                     "False optical activation: "+label,
                     "%d activation(s) during negative stimulus."%observed_activations,
                     [
                         "case-%s.log" % label,
                         "device/screenshots/case_%s_before.png" % label,
                         "device/screenshots/case_%s_after.png" % label,
                     ])
        elif expect == "activate" and observed_activations < min_activations:
            self.add(case.get("severity","P1"),
                     "Missed optical activation: "+label,
                     "Observed %d activation(s); expected at least %d."
                     % (observed_activations, min_activations),
                     [
                         "case-%s.log" % label,
                         "device/screenshots/case_%s_before.png" % label,
                         "device/screenshots/case_%s_after.png" % label,
                     ])
        elif observed_activations > max_activations:
            self.add(
                case.get("severity", "P1"),
                "Duplicate optical activation: " + label,
                "Observed %d activation(s); expected no more than %d."
                % (observed_activations, max_activations),
                [
                    "case-%s.log" % label,
                    "device/screenshots/case_%s_before.png" % label,
                    "device/screenshots/case_%s_after.png" % label,
                ]
            )
        elif expect == "observe":
            print("OBSERVE",label,"activations",observed_activations)
        else:
            self.pass_(label,"%d activation(s)"%observed_activations)
        if stalls:
            self.add(
                "P1", "Optical pipeline stalled: " + label,
                ", ".join(stalls), ["case-%s.log" % label]
            )
        if perf:
            worst_ms = max(p["max_us"] for p in perf) / 1000.0
            self.pass_(
                label + " MediaPipe timing",
                "avg %.1fms, worst %.1fms across %d sample window(s)"
                % (
                    sum(p["avg_us"] for p in perf) / len(perf) / 1000.0,
                    max(p["max_us"] for p in perf) / 1000.0,
                    len(perf),
                )
            )
            if worst_ms >= 100.0:
                self.add(
                    "P2", "MediaPipe inference exceeded 100 ms: " + label,
                    "Worst reported inference was %.1f ms; inspect resolution, "
                    "backpressure, thermal state, and CPU delegate behavior."
                    % worst_ms,
                    ["case-%s.log" % label, "thermal.csv"],
                )
        return result

    def adjust_camera_zoom_from_atlas(self, found):
        xml_path = self.device.ui_dump("rig_zoom_geometry_before")
        try:
            geometry = camera_setup_geometry(xml_path)
            polygon = monitor_polygon_from_atlas(found["decoded"])
            multiplier = required_zoom_multiplier(
                polygon, geometry["preview_rect"]
            )
        except (ET.ParseError, OSError, ValueError) as error:
            self.add(
                "P0", "Could not calculate camera zoom",
                "Atlas/UI geometry was incomplete: %s" % error,
                ["device/ui/rig_zoom_geometry_before.xml", "atlas-calibration.json"]
            )
            return None
        if multiplier is None:
            guidance = camera_alignment_guidance(
                found["decoded"], geometry["preview_rect"], self.host.desktop_rect
            )
            (self.outdir / "position-guidance.json").write_text(
                json.dumps(guidance, indent=2), encoding="utf-8"
            )
            self.add(
                "P0", "Presenter is not centered in the camera preview",
                "The atlas presenter quadrilateral does not contain the preview center; "
                "camera zoom alone cannot correct physical aim. In the DUT preview, %s."
                % guidance["operator_guidance"],
                [
                    "device/screenshots/rig_atlas_camera_00_try_00.png",
                    "atlas-calibration.json",
                    "position-guidance.json",
                ]
            )
            return None

        current = geometry["zoom_ratio"]
        fill_requested = current * multiplier
        requested = fill_requested * RIG_MONITOR_OCCUPANCY
        target = comfortable_camera_zoom(current, multiplier)
        tap_delta = int(round((target - current) / 0.2))
        taps = abs(tap_delta)
        zoom_labels = ["Zoom +", "放大"] if tap_delta >= 0 else ["Zoom -", "縮小"]
        for index in range(taps):
            if not self.device.find_tap(
                zoom_labels,
                "rig_zoom_%s_%02d" % ("plus" if tap_delta >= 0 else "minus", index),
                swipes=3,
            ):
                self.add(
                    "P0", "Camera zoom control was not reachable",
                    "Atlas requested %.1fx, but the real %s control stopped after %d tap(s)."
                    % (target, zoom_labels[0], index)
                )
                return None
            time.sleep(0.25)

        after_path = self.device.ui_dump("rig_zoom_geometry_after")
        try:
            applied = camera_setup_geometry(after_path)["zoom_ratio"]
        except (ET.ParseError, OSError, ValueError) as error:
            self.add("P0", "Could not verify camera zoom", str(error))
            return None
        if abs(applied - target) > 0.051:
            self.add(
                "P0", "Calculated camera zoom was not applied",
                "Requested %.1fx via %d real tap(s), UI reports %.1fx."
                % (target, taps, applied)
            )
            return None
        self.active_zoom_ratio = applied

        result = {
            "initial_ratio": current,
            "required_multiplier": round(multiplier, 4),
            "fill_target_ratio": round(fill_requested, 4),
            "target_monitor_occupancy": RIG_MONITOR_OCCUPANCY,
            "unclamped_target_ratio": round(requested, 4),
            "applied_ratio": applied,
            "taps": taps,
            "changed": taps > 0,
            "preview_rect": list(geometry["preview_rect"]),
            "monitor_polygon": [[round(x, 2), round(y, 2)] for x, y in polygon],
        }
        (self.outdir / "camera-zoom.json").write_text(
            json.dumps(result, indent=2), encoding="utf-8"
        )
        self.pass_(
            "atlas-calculated camera zoom",
            "%.1fx -> %.1fx using %d real %s tap(s); monitor target %.0f%%"
            % (current, applied, taps, zoom_labels[0], RIG_MONITOR_OCCUPANCY * 100)
        )
        if requested > 4.0 + 0.05:
            print(
                "INFO atlas zoom estimate %.2fx exceeds the app range; "
                "the physically verified normal maximum 4.0x is used"
                % requested
            )
        return result

    def record_setup_evidence(self, case, source_by_id=None):
        label = case["id"]
        remote = "/sdcard/shine-rig-%s.mp4" % re.sub(r"[^A-Za-z0-9_-]","_",label)
        if "frames" in case:
            nominal = sum(float(f.get("ms",100)) for f in case["frames"])/1000.0
            token = self.host.set_state(
                mode="sequence", label="PREVIEW "+label,
                frames=case["frames"], mirror=bool(case.get("mirror",False)),
                center=self.stimulus_center,
                scale=self.case_display_scale(case),
            )
        else:
            source = source_by_id[case["source"]]
            rate=float(case.get("rate",1.0))
            start=float(case.get("start",0.0))
            end_at=case.get("end")
            source_end=(
                float(end_at) if end_at is not None
                else float(source["duration_s"])
            )
            nominal=max(0.0,source_end-start)/max(rate,.01)
            token=self.host.set_state(mode="video",label="PREVIEW "+label,
                                      url="/media/"+source["filename"],rate=rate,
                                      loop=False,start=start,end=end_at,
                                      center=self.stimulus_center,
                                      scale=self.case_display_scale(case))
        if not self.ensure_stimulus_visible(token, "preview-" + label):
            return None

        limit=max(4,min(15,int(math.ceil(nominal))+3))
        p=subprocess.Popen(
            [self.adb,"-s",self.device.serial,"shell","screenrecord","--time-limit",str(limit),remote],
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL
        )
        self.host.wait_event(token,"ended",min(limit-1,max(3,nominal+2)))
        if not self.demo_show_rest(case, source_by_id, "PREVIEW DONE " + label):
            return None
        try: p.wait(timeout=limit+4)
        except Exception:
            p.kill()
        dst=self.outdir/("preview-%s.mp4"%label)
        self.device.adb_cmd("pull",remote,str(dst),check=False,timeout=60)
        self.device.shell("rm",remote,check=False)
        return dst if dst.exists() else None

    def downloaded_cheek_calibration_cases(self, manifest):
        """Build repeated native setup samples only from licensed public media."""
        return optical_sources.cheek_calibration_cases(manifest)

    def write_report(self, calibration):
        report = [
            "# SHINE AAC optical-rig test",
            "",
            "## Calibration",
            "",
            "- Geometry/atlas result: %s" % ("PASS" if calibration else "FAIL"),
        ]
        if calibration:
            report += [
                "- Discovery: `%s`" % calibration["discovery"],
                "- Selected setup camera ID: `%s`" % calibration["selected_camera_id"],
                "- Estimated visible desktop size: `%.0f x %.0f`" % tuple(calibration["estimated_visible_size"]),
                "- Desktop camera aim: `%s`" % calibration["desktop_stimulus_center"],
            ]
            if calibration["discovery"] == "reused-rig-session":
                report.append("- Evidence: ignored rig-session fixture plus per-case before/after screenshots")
                report.append(
                    "- Session gesture: `%s`" % (
                        "cheek-calibration"
                        if self.args.calibrate_cheek_session
                        else ("cheek" if self.args.session_gesture == "cheek" else "blink")
                    )
                )
                report.append(
                    "- Session calibration quality: `%s`" %
                    calibration.get("quality_label", "unknown")
                )
            else:
                report.append("- Evidence: `calibration.json`, `atlas-calibration.json`, `camera-cycle.json`")
                if (self.outdir / "blink-calibration-stimulus-timeline.json").exists():
                    report.append(
                        "- Blink stimulus evidence: `blink-calibration-stimulus-timeline.json`, "
                        "`blink-calibration-preview.mp4`"
                    )
        report += [
            "- Native long-blink calibration: `%s`" % (
                "PASS" if blink_calibration_artifact_passes(
                    self.outdir / "blink-calibration.json"
                )
                else ("REUSED SESSION FIXTURE" if self.args.runtime_only
                      else ("NOT RUN" if self.args.geometry_only else "FAIL"))
            ),
            "- Native cheek calibration: `%s`" % (
                "PASS" if (self.outdir / "cheek-calibration.json").exists()
                else (
                    "REUSED SESSION FIXTURE"
                    if self.args.runtime_only and self.args.session_gesture == "cheek"
                    else (
                        "NOT RUN"
                        if (
                            self.args.geometry_only or self.args.calibration_only or
                            not (self.outdir / "cheek-calibration-preferences.xml").exists()
                        ) else "FAIL"
                    )
                )
            ),
        ]
        report += ["", "## Normal-use functional sessions", ""]
        demos = []
        for gesture in ("blink", "cheek"):
            demo_path = self.outdir / ("physical-demo-%s.json" % gesture)
            if not demo_path.exists():
                continue
            try:
                demos.append(json.loads(demo_path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass
        if not demos:
            report.append("No complete normal-use session recorded.")
        else:
            for demo in demos:
                report.append(
                    "- `%s`: %s selections, four speech turns `%s`, correction, clear, and language round-trip through %s camera activations in %ss"
                    % (
                        demo.get("gesture", "unknown"),
                        demo.get("selection_count", "unknown"),
                        " / ".join(demo.get("spoken_messages", [])),
                        demo.get("physical_activations", "unknown"),
                        demo.get("elapsed_s", "unknown"),
                    )
                )
        report += [
            "",
            "Normal-use sessions run before repeated detector sequences. A failure here stops the full suite before stress testing.",
            "",
            "## Repeated detector and stress sequences",
            "",
        ]
        if not self.results:
            report.append("No stimulus cases completed.")
        else:
            report.append("| Case | Expected | Activations | Elapsed |")
            report.append("|---|---:|---:|---:|")
            for r in self.results:
                activation_text = (
                    str(r["activations"]) if r["activations"] is not None else "UNCERTAIN"
                )
                report.append("| %s | %s | %s | %.1fs |" %
                              (r["id"],r["expect"],activation_text,r["elapsed_s"]))
        perf = [
            sample for result in self.results
            for sample in result.get("cheek_performance", [])
        ]
        if perf:
            report += [
                "",
                "## Cheek runtime performance",
                "",
                "- Path: `%s`" % perf[0]["path"],
                "- Telemetry windows: `%d`" % len(perf),
                "- Mean analyzer time: `%.1f ms`" % (
                    sum(item["avg_us"] for item in perf) / len(perf) / 1000.0
                ),
                "- Worst observed frame: `%.1f ms`" % (
                    max(item["max_us"] for item in perf) / 1000.0
                ),
            ]
        report += ["","## Findings",""]
        if not self.findings:
            report.append("No release-blocking automated optical-rig findings.")
        for i,f in enumerate(self.findings,1):
            report += [
                "### %d. [%s] %s" % (i,f["priority"],f["title"]),
                "",
                f["detail"],
            ]
            if f["evidence"]:
                report.append("")
                report.append("Evidence:")
                report += ["- `%s`"%x for x in f["evidence"]]
            report.append("")
        report += [
            "## Interpretation",
            "",
            "- Functional confidence comes first from two distinct complete board sessions with four useful speech turns each: one using long blink and one using cheek movement.",
            "- Repeated short sequences are detector stress checks and are reported separately; they do not substitute for a normal-use session.",
            "- `no_activate` cases are automated false-positive checks.",
            "- Positive blink still cases keep the verified closed pose until observable activation (bounded by a generous timeout); fixed-duration negative controls enforce false-positive counts, while boundary-timing cases are non-blocking diagnostics.",
            "- Downloaded cheek-movement calibration trials first exercise native personalization, then enforce runtime missed/duplicate activation counts.",
            "- Test-video calibration values are session fixtures only; the rig restores SHINE's original camera/calibration preferences and Switch input choice after the run.",
            "- Replay uses one persistent exact-size presenter surface. Licensed media is centered at the atlas-projected camera aim and scaled against the measured camera zoom; cheek framing is measured from the DUT overlay.",
            "- Passing this rig does not replace testing on a real user; it makes regressions reproducible.",
        ]
        (self.outdir/"FINDINGS.md").write_text("\n".join(report),encoding="utf-8")

    def prepare_test_apk(self):
        """Build/install only after the visible presenter has claimed the desktop."""
        if not self.args.no_build:
            print("==> Building/testing debug APK while atlas remains visible")
            if os.name == "nt":
                # Keep the captured build process local to this rig run. A
                # Gradle daemon can otherwise retain the Windows output pipe
                # after the APK is complete and prevent optical setup.
                result = run(
                    ["cmd.exe", "/c", "build-test.bat", "-NoDaemon"],
                    check=False,
                    timeout=900,
                    cwd=ROOT,
                )
            else:
                result = run(
                    ["./gradlew", "testDebugUnitTest", "assembleDebug"],
                    check=False, timeout=900, cwd=ROOT
                )
            (self.outdir / "build.txt").write_text(
                result.stdout or "", encoding="utf-8", errors="replace"
            )
            if result.returncode != 0:
                self.add("P0", "Build failed", "See build.txt.", ["build.txt"])
                return False

        self.device.setup_power_guard()
        if self.args.no_install:
            return True
        abi_result = self.device.shell(
            "getprop", "ro.product.cpu.abilist", check=False, timeout=20
        )
        try:
            apk_path = resolve_debug_apk(
                APK_OUTPUT_DIRECTORY,
                parse_device_abis(abi_result.stdout),
            )
        except (FileNotFoundError, json.JSONDecodeError, OSError) as error:
            self.add("P0", "APK missing", str(error))
            return False
        result = self.device.adb_cmd(
            "install", "-r", str(apk_path), check=False, timeout=120
        )
        (self.outdir / "install.txt").write_text(
            result.stdout or "", encoding="utf-8", errors="replace"
        )
        if result.returncode != 0 or "Success" not in (result.stdout or ""):
            self.add(
                "P0", "APK install failed", (result.stdout or "").strip(),
                ["install.txt"]
            )
            return False
        return True

    def run(self):
        manifest=self.ensure_stimuli()
        source_by_id={x["id"]:x for x in manifest["sources"]}

        if not self.start_host(source_by_id):
            self.write_report(None)
            return 2
        try:
            if not self.prepare_test_apk():
                self.write_report(None)
                return 2
            if not self.preserve_camera_preferences():
                self.write_report(None)
                return 2
            if self.args.runtime_only:
                session_gesture = self.args.session_gesture
                fixture = self.apply_session_calibration(
                    "blink" if self.args.calibrate_cheek_session else session_gesture
                )
                if not fixture:
                    self.write_report(None)
                    return 2
                self.active_zoom_ratio = float(fixture["zoom_ratio"])
                calibration = {
                    "discovery": "reused-rig-session",
                    "selected_camera_id": fixture["selected_camera_id"],
                    "estimated_visible_size": fixture.get("estimated_visible_size", [0, 0]),
                    "desktop_stimulus_center": fixture["desktop_stimulus_center"],
                    "quality_label": fixture.get("quality_label", "unknown"),
                }
                if self.args.calibrate_cheek_session:
                    calibration_cases = self.downloaded_cheek_calibration_cases(manifest)
                    if not calibration_cases:
                        self.add(
                            "P0", "No downloaded cheek calibration stimulus",
                            "The public test manifest needs a positive cheek movement video."
                        )
                        self.write_report(calibration)
                        return 2
                    self.guard("before-cheek-session-calibration")
                    if not self.open_camera_setup("cheek"):
                        self.add(
                            "P0", "Could not open cheek Camera Setup",
                            "The native setup page did not expose Cheek movement."
                        )
                        self.write_report(calibration)
                        return 2
                    positive = next(
                        (case for case in calibration_cases if case.get("expect") == "activate"),
                        None,
                    )
                    if positive:
                        self.record_setup_evidence(positive, source_by_id)
                    if not self.calibrate_cheek(calibration_cases, source_by_id):
                        self.write_report(calibration)
                        return 2
                    try:
                        cheek_preferences = (
                            self.outdir / "cheek-calibration-preferences.xml"
                        ).read_text(encoding="utf-8")
                        self.save_cheek_session_calibration(
                            calibration, cheek_preferences
                        )
                    except (ET.ParseError, OSError, ValueError) as error:
                        self.add(
                            "P1", "Could not cache cheek rig session", str(error),
                            [
                                "cheek-calibration-preferences.xml",
                                "cheek-calibration.json",
                            ],
                        )
                    self.write_report(calibration)
                    return 1 if any(
                        item["priority"] in ("P0", "P1")
                        for item in self.findings
                    ) else 0
                if self.args.inspect_blink_poses:
                    self.clear_optical_camera_log()
                    if not self.open_camera_setup("blink"):
                        self.add(
                            "P0", "Could not inspect blink poses",
                            "Camera Setup could not be opened with the reusable session fixture."
                        )
                        self.write_report(calibration)
                        return 2
                    source = source_by_id["commons_blinking"]
                    for label, position in (
                        ("open", 0.75),
                        ("closed_01", 0.25),
                        ("closed_02", 2.00),
                        ("closed_03", 3.00),
                    ):
                        if not self.show_video_still(
                            source, position, "INSPECT BLINK POSE " + label
                        ):
                            self.write_report(calibration)
                            return 2
                        time.sleep(2.0)
                        self.device.screenshot("inspect_blink_pose_" + label)
                    continuous = next(
                        (
                            case for case in manifest.get("blink_cases", [])
                            if case.get("id") == "blink_slow_continuous_02"
                        ),
                        None,
                    )
                    if continuous:
                        self.record_setup_evidence(continuous, source_by_id)
                    self.pass_(
                        "blink pose inspection",
                        "captured normal Camera Setup metrics for poses and the continuous blink"
                    )
                    self.write_report(calibration)
                    return 1 if any(
                        item["priority"] in ("P0", "P1") for item in self.findings
                    ) else 0
                if self.args.test_hold_advance:
                    if not self.install_feature_profile("hold-advance"):
                        self.write_report(calibration)
                        return 2
                elif self.args.test_idle_wake:
                    if not self.install_feature_profile("idle-wake"):
                        self.write_report(calibration)
                        return 2
                self.clear_optical_camera_log()
                if not self.prepare_runtime_from_session():
                    self.write_report(calibration)
                    return 2
                if self.args.test_hold_advance:
                    if not self.verify_runtime_camera_selection():
                        self.write_report(calibration)
                        return 2
                    self.run_hold_advance_feature(manifest, source_by_id)
                    self.write_report(calibration)
                    return 1 if any(
                        item["priority"] in ("P0", "P1") for item in self.findings
                    ) else 0
                if self.args.test_idle_wake:
                    if not self.verify_runtime_camera_selection():
                        self.write_report(calibration)
                        return 2
                    self.run_idle_wake_feature(
                        session_gesture, manifest, source_by_id
                    )
                    self.write_report(calibration)
                    return 1 if any(
                        item["priority"] in ("P0", "P1") for item in self.findings
                    ) else 0
                if self.args.trace_hold:
                    if not self.install_demo_profile():
                        self.write_report(calibration)
                        return 2
                if self.args.demo_phrase:
                    if not self.install_demo_profile():
                        self.write_report(calibration)
                        return 2
                    if not self.verify_runtime_camera_selection():
                        self.write_report(calibration)
                        return 2
                    if not self.run_physical_demo(
                        session_gesture, manifest, source_by_id
                    ):
                        (self.outdir / ("demo-e2e-%s.log" % session_gesture)).write_text(
                            self.e2e_log(), encoding="utf-8", errors="replace"
                        )
                        self.write_report(calibration)
                        return 2
                    self.write_report(calibration)
                    return 1 if any(
                        item["priority"] in ("P0", "P1")
                        for item in self.findings
                    ) else 0
                if not self.enable_e2e_telemetry():
                    self.write_report(calibration)
                    return 2
                if not self.verify_runtime_camera_selection():
                    self.write_report(calibration)
                    return 2
                available_cases = []
                if session_gesture == "cheek":
                    for case in manifest.get("cheek_cases", []):
                        item = dict(case)
                        item["gesture"] = "cheek"
                        available_cases.append(item)
                    if not available_cases:
                        self.add(
                            "P0", "No downloaded cheek runtime stimulus",
                            "Fetch the public optical sources before focused replay."
                        )
                        self.write_report(calibration)
                        return 2
                else:
                    for case in (
                        manifest.get("blink_cases", []) +
                        manifest.get("negative_cases", [])
                    ):
                        item = dict(case)
                        item["gesture"] = "blink"
                        available_cases.append(item)
                if self.args.case:
                    wanted = set(self.args.case)
                    known = {case["id"] for case in available_cases}
                    unknown = sorted(wanted.difference(known))
                    if unknown:
                        self.add(
                            "P0", "Unknown focused optical case",
                            ", ".join(unknown)
                        )
                        self.write_report(calibration)
                        return 2
                    available_cases = [
                        case for case in available_cases if case["id"] in wanted
                    ]
                if self.args.repeat > 1:
                    repeated_cases = []
                    for case in available_cases:
                        for repetition in range(1, self.args.repeat + 1):
                            repeated = dict(case)
                            repeated["base_id"] = case["id"]
                            repeated["id"] = "%s_r%02d" % (case["id"], repetition)
                            repeated_cases.append(repeated)
                    available_cases = repeated_cases
                for case in available_cases:
                    self.play_case(case, source_by_id)
                self.write_report(calibration)
                blocking = [
                    finding for finding in self.findings
                    if finding["priority"] in ("P0", "P1")
                ]
                return 1 if blocking else 0
            self.guard("before-calibration")
            self.clear_optical_camera_log()
            if not self.install_demo_profile():
                self.write_report(None)
                return 2
            if not self.open_camera_setup("blink"):
                self.add("P0","Could not open camera setup",
                         "Automatic Settings -> Camera setup navigation failed.")
                self.write_report(None); return 2
            calibration=self.calibrate(self.args.calibration_timeout)
            if not calibration:
                self.write_report(None); return 2

            natural=manifest["blink_cases"][0]
            neutral_source = source_by_id[natural["source"]]
            if not self.show_video_still(
                neutral_source,
                float(neutral_source.get("rest_at_s", 0.0)),
                "POST-ATLAS NEUTRAL FACE",
            ):
                self.write_report(calibration)
                return 2
            if self.args.geometry_only:
                time.sleep(3.0)
                self.device.screenshot("rig_geometry_unscaled_face")
                self.write_report(calibration)
                return 1 if any(
                    item["priority"] in ("P0", "P1") for item in self.findings
                ) else 0
            self.record_setup_evidence(natural,source_by_id)
            if not self.calibrate_long_blink(source_by_id[natural["source"]]):
                self.write_report(calibration)
                return 2
            try:
                session_preferences = (
                    self.outdir / "blink-calibration-preferences.xml"
                ).read_text(encoding="utf-8")
                self.save_session_calibration(calibration, session_preferences)
            except (ET.ParseError, OSError, ValueError) as error:
                self.add(
                    "P1", "Could not cache rig session calibration", str(error),
                    ["blink-calibration-preferences.xml", "calibration.json"]
                )
            if self.args.calibration_only:
                self.write_report(calibration)
                return 1 if any(
                    item["priority"] in ("P0", "P1") for item in self.findings
                ) else 0

            self.clear_optical_camera_log()
            if not self.camera_setup_to_board():
                self.write_report(calibration); return 2
            self.device.dump_prefs()
            if not self.verify_runtime_camera_selection():
                self.write_report(calibration); return 2

            print("==> FUNCTIONAL SESSION 1/2: normal long-blink demo")
            if not self.run_physical_demo("blink", manifest, source_by_id):
                (self.outdir / "demo-e2e-blink.log").write_text(
                    self.e2e_log(), encoding="utf-8", errors="replace"
                )
                self.write_report(calibration)
                return 2

            public_cheek_cases = self.downloaded_cheek_calibration_cases(manifest)
            if not public_cheek_cases:
                self.add(
                    "P0", "No licensed public cheek calibration stimulus",
                    "The manifest must name a verified HTTPS source with page, license, author, and checksum."
                )
                self.write_report(calibration)
                return 2
            self.guard("before-cheek")
            if self.open_camera_setup("cheek"):
                positive=next((c for c in public_cheek_cases if c.get("expect")=="activate"),None)
                if positive:
                    self.record_setup_evidence(positive, source_by_id)
                if not self.calibrate_cheek(public_cheek_cases, source_by_id):
                    self.write_report(calibration)
                    return 2
                try:
                    cheek_preferences = (
                        self.outdir / "cheek-calibration-preferences.xml"
                    ).read_text(encoding="utf-8")
                    self.save_cheek_session_calibration(
                        calibration, cheek_preferences,
                        source="licensed-public-video-calibration",
                    )
                except (ET.ParseError, OSError, ValueError) as error:
                    self.add(
                        "P1", "Could not cache cheek rig session", str(error),
                        [
                            "cheek-calibration-preferences.xml",
                            "cheek-calibration.json",
                        ],
                    )
                self.clear_optical_camera_log()
                if self.camera_setup_to_board():
                    if not self.verify_runtime_camera_selection():
                        self.write_report(calibration)
                        return 2
                    print("==> FUNCTIONAL SESSION 2/2: normal cheek-twitch demo")
                    if not self.run_physical_demo(
                        "cheek", manifest, source_by_id
                    ):
                        (self.outdir / "demo-e2e-cheek.log").write_text(
                            self.e2e_log(), encoding="utf-8", errors="replace"
                        )
                        self.write_report(calibration)
                        return 2

                    print("==> STRESS: repeated cheek detector sequences")
                    runtime_cases = [
                        dict(case, gesture="cheek")
                        for case in manifest.get("cheek_cases", [])
                    ]
                    for case in runtime_cases:
                        self.play_case(case, source_by_id)
                else:
                    self.write_report(calibration)
                    return 2
            else:
                self.add("P0","Could not switch to cheek mode",
                         "Camera setup did not expose Cheek movement.")
                self.write_report(calibration)
                return 2

            print("==> STRESS: repeated blink and false-positive sequences")
            if not self.open_camera_setup("blink"):
                self.write_report(calibration)
                return 2
            if not self.camera_setup_to_board():
                self.write_report(calibration)
                return 2
            for case in manifest.get("blink_cases",[]):
                c=dict(case); c["gesture"]="blink"
                self.play_case(c,source_by_id)
            for case in manifest.get("negative_cases",[]):
                c=dict(case); c["gesture"]="blink"
                self.play_case(c,source_by_id)

            self.write_report(calibration)
            blocking=[f for f in self.findings if f["priority"] in ("P0","P1")]
            return 1 if blocking else 0
        finally:
            try:
                self.host.set_state(mode="standby",label="DONE")
            except Exception: pass
            try:
                if not self.restore_switch_input_profile():
                    print("WARNING could not restore the original Switch input profile")
            except Exception as error:
                print("WARNING Switch input cleanup failed:", error)
            try:
                self.restore_demo_profile()
            except Exception as error:
                print("WARNING demo profile cleanup failed:", error)
            try: self.host.close()
            except Exception: pass
            try: self.restore_camera_preferences()
            except Exception: pass
            if not self.args.leave_awake:
                self.device.restore_power_guard()
            # Test policy: always finish with the phone display off.
            try:
                self.device.shell("input","keyevent","223",check=False)
            except Exception:
                pass

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--geometry-only", action="store_true",
                    help="verify atlas-calculated Camera Setup zoom/XY and stop")
    ap.add_argument("--calibration-only", action="store_true",
                    help="verify geometry and native long-blink calibration, then stop")
    ap.add_argument("--runtime-only", action="store_true",
                    help="reuse the ignored test-session calibration and skip native calibration")
    ap.add_argument("--session-gesture", choices=("blink", "cheek"), default="blink",
                    help="with --runtime-only, select the blink or cheek session fixture")
    ap.add_argument("--calibrate-cheek-session", action="store_true",
                    help="with --runtime-only, create a reusable cheek session from downloaded public video")
    ap.add_argument("--demo-phrase", action="store_true",
                    help="with --runtime-only, run the extended normal-use scenario using physical camera gestures")
    ap.add_argument("--test-hold-advance", action="store_true",
                    help="with --runtime-only blink, prove one sustained gesture selects one bounded leaf")
    ap.add_argument("--test-idle-wake", action="store_true",
                    help="with --runtime-only, prove Stopped-only idle and wake-only optical activation")
    ap.add_argument("--case", action="append", default=[],
                    help="with --runtime-only, run only this case ID (repeatable)")
    ap.add_argument("--repeat", type=int, default=1,
                    help="repeat each selected --runtime-only case this many times")
    ap.add_argument("--trace-hold", action="store_true",
                    help="capture timed UI screenshots during deterministic closed holds")
    ap.add_argument("--inspect-blink-poses", action="store_true",
                    help="with --runtime-only, capture Camera Setup metrics for verified blink poses")
    ap.add_argument("--no-build",action="store_true")
    ap.add_argument("--no-install",action="store_true")
    ap.add_argument(
        "--presenter-mode", choices=("auto", "monitor", "android"), default="auto",
        help="use the PC monitor, a second Android SurfaceView, or auto-detect",
    )
    ap.add_argument(
        "--dut-serial", default=os.environ.get("SHINE_DUT_SERIAL"),
        help="ADB serial of the Android device running SHINE",
    )
    ap.add_argument(
        "--presenter-serial", default=os.environ.get("SHINE_PRESENTER_SERIAL"),
        help="ADB serial of the second Android display",
    )
    ap.add_argument(
        "--presenter-apk", default=os.environ.get("SHINE_PRESENTER_APK"),
        help="optional verified IRIS/aria-trace phone-target APK",
    )
    ap.add_argument("--calibration-timeout",type=int,default=120)
    ap.add_argument("--thermal-stop-status",type=int,default=2,
                    help="pause at Android thermal status >= this value (2=MODERATE)")
    ap.add_argument("--thermal-hot-c",type=float,default=42.0)
    ap.add_argument("--thermal-resume-c",type=float,default=38.0)
    ap.add_argument("--thermal-stable-sec",type=int,default=30)
    ap.add_argument("--leave-awake",action="store_true")
    args=ap.parse_args()
    if args.runtime_only and (args.geometry_only or args.calibration_only):
        ap.error("--runtime-only cannot be combined with calibration/geometry/cheek modes")
    if args.session_gesture != "blink" and not args.runtime_only:
        ap.error("--session-gesture requires --runtime-only")
    if args.calibrate_cheek_session and not args.runtime_only:
        ap.error("--calibrate-cheek-session requires --runtime-only")
    if args.calibrate_cheek_session and args.session_gesture != "blink":
        ap.error("--calibrate-cheek-session starts from the reusable blink geometry fixture")
    if args.demo_phrase and not args.runtime_only:
        ap.error("--demo-phrase requires --runtime-only")
    if (args.test_hold_advance or args.test_idle_wake) and not args.runtime_only:
        ap.error("focused feature tests require --runtime-only")
    if args.test_hold_advance and args.session_gesture != "blink":
        ap.error("--test-hold-advance requires the blink session fixture")
    if args.case and not args.runtime_only:
        ap.error("--case requires --runtime-only")
    if args.repeat < 1 or (args.repeat > 1 and not args.runtime_only):
        ap.error("--repeat must be >= 1 and values above 1 require --runtime-only")
    if args.trace_hold and not args.runtime_only:
        ap.error("--trace-hold requires --runtime-only")
    if args.inspect_blink_poses and not args.runtime_only:
        ap.error("--inspect-blink-poses requires --runtime-only")
    if args.inspect_blink_poses and (args.case or args.repeat != 1 or args.trace_hold):
        ap.error("--inspect-blink-poses cannot be combined with cases, repeats, or trace hold")
    if args.inspect_blink_poses and args.session_gesture != "blink":
        ap.error("--inspect-blink-poses requires the blink session fixture")
    if args.calibrate_cheek_session and (args.case or args.repeat != 1 or args.trace_hold or args.inspect_blink_poses):
        ap.error("--calibrate-cheek-session cannot be combined with focused case options")
    if args.demo_phrase and (args.case or args.repeat != 1 or args.trace_hold or args.inspect_blink_poses or args.calibrate_cheek_session or args.test_hold_advance or args.test_idle_wake):
        ap.error("--demo-phrase cannot be combined with focused case/calibration options")
    if (args.test_hold_advance or args.test_idle_wake) and (
        args.test_hold_advance and args.test_idle_wake or
        args.case or args.repeat != 1 or args.trace_hold or
        args.inspect_blink_poses or args.calibrate_cheek_session
    ):
        ap.error("focused feature tests cannot be combined with other focused modes")

    if not SOURCES_PATH.exists():
        raise SystemExit("Optical rig is not installed; run the repo installer.")
    device_module = load_device_test_module()
    adb = device_module.find_adb()
    devices = adb_device_inventory(adb)
    presenter_versions = adb_presenter_versions(adb, devices)
    try:
        roles = resolve_device_roles(
            devices,
            presenter_versions,
            requested_mode=args.presenter_mode,
            dut_serial=args.dut_serial,
            presenter_serial=args.presenter_serial,
        )
    except ValueError as error:
        inventory = ", ".join(
            "%s (%s%s)" % (
                item["serial"], item["model"],
                ", presenter v%d" % presenter_versions[item["serial"]]
                if item["serial"] in presenter_versions else "",
            )
            for item in devices
        ) or "none"
        raise SystemExit("Optical rig device roles are unresolved: %s\nDevices: %s" % (error, inventory))
    args.presenter_mode = roles["mode"]
    args.dut_serial = roles["dut_serial"]
    args.presenter_serial = roles["presenter_serial"]
    args.presenter_size = (
        adb_display_size(adb, args.presenter_serial)
        if args.presenter_mode == "android" else None
    )
    if args.presenter_mode == "monitor":
        enable_per_monitor_dpi_awareness()
    else:
        print(
            "Two-device rig: DUT=%s presenter=%s surface=%dx%d"
            % (
                args.dut_serial, args.presenter_serial,
                args.presenter_size[0], args.presenter_size[1],
            )
        )
    stamp=time.strftime("%Y%m%d-%H%M%S")
    out=ROOT/"test-results"/("optical-"+stamp)
    rig = OpticalRig(args,out)
    pc_guard = PcDisplayGuard()
    try:
        try:
            pc_guard.start(require_display=args.presenter_mode == "monitor")
        except RuntimeError as error:
            rig.add(
                "P0", "Windows input desktop unavailable to rig process", str(error)
            )
            rig.write_report(None)
            return 2
        return rig.run()
    finally:
        # Android cleanup is independent: phone display always ends off.
        try:
            rig.device.shell("input","keyevent","223",check=False)
        except Exception:
            pass
        try:
            pc_guard.restore()
        except Exception:
            pass
        try:
            if args.presenter_mode == "monitor":
                launch_idle_presenter(ROOT)
        except Exception as error:
            print("WARNING could not launch idle standby presenter:", error)

if __name__=="__main__":
    sys.exit(main() or 0)
