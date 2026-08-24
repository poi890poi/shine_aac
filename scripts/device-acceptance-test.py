#!/usr/bin/env python3
# Python 3.7+
#
# SHINE AAC physical-device acceptance test.
#
# Standard repository command:
#   device-test.bat
# or:
#   python scripts/device-acceptance-test.py
#
# This complements core/browser/emulator E2E with evidence from a real Android
# device. It preserves app data and restores temporary device display settings.
#
# Options:
#   --no-build         skip quick/core + Android debug build
#   --apk PATH         install and test this exact APK instead of the debug output
#   --no-install       do not reinstall APK
#   --cycles 5         camera setup return cycles (default 5)
#   --skip-font-200    skip Android font-scale 2.0 layout pass
#   --skip-rotation    skip landscape layout pass
#   --leave-awake      do not restore screen timeout/stay-awake settings
#
# Output:
#   test-results/deep-YYYYMMDD-HHMMSS/
#     FINDINGS.md          ranked findings with evidence
#     summary.txt
#     screenshots/
#     ui/
#     dumpsys/
#     logcat.txt
#     prefs/
#     git.txt
#
# It also keeps the phone awake while USB-powered and restores prior power
# settings on exit unless --leave-awake is used.

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from device_test_common import (
    ThermalGovernor,
    camera_setup_control_group_alignment_drift,
    camera_setup_excessively_padded_buttons,
    camera_permission_is_granted,
    find_geometry_drift,
    find_region_allocation_violations,
    infer_camera_preview_metrics,
    power_state_is_noninteractive,
    touch_target_size_exemption,
)

PACKAGE = "org.shineaac.app"
MAIN_ACTIVITY = "org.shineaac.app/.MainActivity"
CAMERA_ACTIVITY_FRAGMENT = "CameraSwitchCalibrationActivity"
SETTINGS_ACTIVITY_FRAGMENT = "SettingsActivity"
DEFAULT_APK = Path("app/build/outputs/apk/debug/app-debug.apk")

PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3, "P4": 4, "INFO": 5}

def find_adb():
    candidates = []
    if os.environ.get("ADB"):
        candidates.append(Path(os.environ["ADB"]))
    for name in ("ANDROID_SDK_ROOT", "ANDROID_HOME"):
        if os.environ.get(name):
            candidates.append(
                Path(os.environ[name]) / "platform-tools" / "adb.exe"
            )
    if os.environ.get("LOCALAPPDATA"):
        candidates.append(Path(os.environ["LOCALAPPDATA"]) / "Android" / "Sdk" / "platform-tools" / "adb.exe")
    which = shutil.which("adb")
    if which:
        candidates.append(Path(which))
    # The repo's Windows setup instructions commonly use a short dedicated SDK
    # path. Probe fixed paths rather than recursively searching drives.
    if os.name == "nt":
        for drive in "CDEFG":
            candidates.append(
                Path("%s:/Android/Sdk/platform-tools/adb.exe" % drive)
            )
    for p in candidates:
        try:
            if p.is_file():
                return str(p)
        except OSError:
            # Sandboxed/unreadable default SDK locations must not prevent a
            # later configured or fixed-path candidate from being used.
            continue
    raise SystemExit("ADB not found.")

def run(cmd, check=True, timeout=60, cwd=None):
    # One-pipe implementation avoids Python 3.7/Windows adb communicate bugs.
    try:
        r = subprocess.run(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
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

def parse_bounds(value):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", value or "")
    return tuple(map(int, m.groups())) if m else None

class DeepTest:
    def __init__(self, adb, root, outdir):
        self.adb = adb
        self.root = root
        self.outdir = outdir
        self.findings = []
        self.passes = []
        self.screen_w = 1080
        self.screen_h = 1920
        self.density = 420
        self.original_timeout = None
        self.original_stay = None
        self.original_font_scale = None
        self.original_auto_rotate = None
        self.original_user_rotation = None
        self.memory_samples = []
        self.thermal = None
        for name in ("screenshots", "ui", "dumpsys", "prefs"):
            (outdir / name).mkdir(parents=True, exist_ok=True)

    def adb_cmd(self, *args, check=True, timeout=60):
        return run([self.adb] + list(args), check=check, timeout=timeout, cwd=self.root)

    def shell(self, *args, check=True, timeout=60):
        return self.adb_cmd("shell", *args, check=check, timeout=timeout)

    def add(self, priority, title, detail, evidence=None):
        item = {
            "priority": priority,
            "title": title,
            "detail": detail,
            "evidence": evidence or [],
        }
        self.findings.append(item)
        print("%s  %s: %s" % (priority, title, detail))

    def add_layout_observation(self, priority, title, count, checkpoint, evidence):
        existing = next((item for item in self.findings if item["title"] == title), None)
        observation = {"checkpoint": checkpoint, "count": count}
        if existing is None:
            existing = {
                "priority": priority,
                "title": title,
                "detail": "",
                "evidence": [],
                "observations": [],
            }
            self.findings.append(existing)
        existing["observations"].append(observation)
        for item in evidence:
            if item not in existing["evidence"]:
                existing["evidence"].append(item)
        counts = [item["count"] for item in existing["observations"]]
        existing["detail"] = (
            "Observed at %d checkpoint(s); %d-%d visible control(s) affected per checkpoint. "
            "See findings.json for every checkpoint."
            % (len(counts), min(counts), max(counts))
        )
        print("%s  %s: %d at %s" % (priority, title, count, checkpoint))

    def passed(self, title, detail=""):
        self.passes.append((title, detail))
        print("PASS %s%s" % (title, (": " + detail) if detail else ""))

    def save(self, rel, text):
        p = self.outdir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8", errors="replace")
        return p

    def screenshot(self, name):
        p = self.outdir / "screenshots" / (name + ".png")
        with p.open("wb") as f:
            r = subprocess.run(
                [self.adb, "exec-out", "screencap", "-p"],
                stdout=f, stderr=subprocess.STDOUT, timeout=30
            )
        return p

    def ui_dump(self, name):
        safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", name)
        remote = "/sdcard/shine_aac_ui_%s.xml" % safe_name
        local = self.outdir / "ui" / (name + ".xml")
        self.shell("rm", "-f", remote, check=False, timeout=10)
        for _ in range(3):
            result = self.shell(
                "uiautomator", "dump", "--compressed", remote,
                check=False, timeout=30
            )
            if result.returncode == 0:
                pulled = self.adb_cmd(
                    "pull", remote, str(local), check=False, timeout=30
                )
                if pulled.returncode == 0 and local.exists():
                    self.shell("rm", "-f", remote, check=False, timeout=10)
                    return local
            time.sleep(0.35)
        self.shell("rm", "-f", remote, check=False, timeout=10)
        return None

    def dump_text(self, name, *cmd):
        r = self.shell(*cmd, check=False, timeout=40)
        return self.save("dumpsys/" + name + ".txt", r.stdout or "")

    def checkpoint(self, name):
        shot = self.screenshot(name)
        xml = self.ui_dump(name)
        self.dump_text(name + "_activity", "dumpsys", "activity", "activities")
        self.dump_text(name + "_window", "dumpsys", "window", "windows")
        self.dump_text(name + "_power", "dumpsys", "power")
        self.dump_text(name + "_camera", "dumpsys", "media.camera")
        if xml:
            self.analyze_layout(name, xml)
        return shot, xml

    def xml_nodes(self, xml_path):
        if not xml_path or not xml_path.exists():
            return []
        try:
            root = ET.parse(str(xml_path)).getroot()
        except Exception:
            return []
        nodes = []
        for n in root.iter("node"):
            a = n.attrib
            nodes.append({
                "text": a.get("text", ""),
                "desc": a.get("content-desc", ""),
                "cls": a.get("class", ""),
                "clickable": a.get("clickable") == "true",
                "enabled": a.get("enabled") != "false",
                "selected": a.get("selected") == "true",
                "focusable": a.get("focusable") == "true",
                "scrollable": a.get("scrollable") == "true",
                "resource_id": a.get("resource-id", ""),
                "bounds": parse_bounds(a.get("bounds")),
            })
        return nodes

    def visible_strings(self, xml_path):
        values = []
        for n in self.xml_nodes(xml_path):
            for key in ("text", "desc"):
                v = n[key].strip()
                if v:
                    values.append(v)
        return values

    def form_value_signature(self, xml_path):
        if not xml_path or not xml_path.exists():
            return ()
        try:
            root = ET.parse(str(xml_path)).getroot()
        except Exception:
            return ()
        items = []
        for raw in root.iter("node"):
            a = raw.attrib
            cls = a.get("class", "")
            if cls in ("android.widget.EditText", "android.widget.Spinner", "android.widget.CheckBox"):
                items.append((
                    cls,
                    a.get("text", ""),
                    a.get("checked", ""),
                    a.get("selected", ""),
                ))
        return tuple(sorted(items))

    def node_is_visible_target(self, node, min_height_px=24):
        b = node.get("bounds")
        if not b:
            return False
        x1, y1, x2, y2 = b
        w, h = x2 - x1, y2 - y1
        if w <= 1 or h < min_height_px:
            return False
        cx, cy = (x1+x2)//2, (y1+y2)//2
        # UIAutomator exposes offscreen WebView descendants clamped to the
        # viewport edge (for example [55,2277][1023,2277]). Never tap them.
        if cx < 0 or cx >= self.screen_w or cy < 0 or cy >= self.screen_h:
            return False
        return True

    def find_node(self, xml_path, patterns, clickable_preferred=True, visible_only=False):
        pats = [p.lower() for p in patterns]
        candidates = []
        for n in self.xml_nodes(xml_path):
            hay = (n["text"] + " " + n["desc"]).lower()
            if any(p in hay for p in pats) and n["bounds"]:
                if visible_only and not self.node_is_visible_target(n):
                    continue
                candidates.append(n)
        if clickable_preferred:
            clickable = [n for n in candidates if n["clickable"] and n["enabled"]]
            if clickable:
                candidates = clickable
        # Prefer the largest visible candidate. WebView often exposes both a
        # wrapper node and the actual button.
        candidates.sort(
            key=lambda n: (
                0 if self.node_is_visible_target(n) else 1,
                -((n["bounds"][2]-n["bounds"][0]) * (n["bounds"][3]-n["bounds"][1]))
            )
        )
        return candidates[0] if candidates else None

    def tap_node(self, node):
        x1, y1, x2, y2 = node["bounds"]
        if not self.node_is_visible_target(node):
            return False
        self.shell("input", "tap", str((x1 + x2)//2), str((y1 + y2)//2), check=False)
        return True

    def largest_scrollable_bounds(self, xml_path):
        candidates = []
        for n in self.xml_nodes(xml_path):
            if not n.get("bounds"):
                continue
            # xml_nodes currently does not retain scrollable; reparse here.
        if not xml_path or not xml_path.exists():
            return None
        try:
            root = ET.parse(str(xml_path)).getroot()
        except Exception:
            return None
        for raw in root.iter("node"):
            if raw.attrib.get("scrollable") != "true":
                continue
            b = parse_bounds(raw.attrib.get("bounds"))
            if not b:
                continue
            x1,y1,x2,y2=b
            if x2 > x1 and y2 > y1:
                candidates.append(b)
        if not candidates:
            return None
        return max(candidates, key=lambda b:(b[2]-b[0])*(b[3]-b[1]))

    def scroll_forward(self, xml_path):
        b = self.largest_scrollable_bounds(xml_path)
        if b:
            x1,y1,x2,y2=b
            x=(x1+x2)//2
            start_y = min(y2-80, int(y1+(y2-y1)*0.82))
            end_y = max(y1+80, int(y1+(y2-y1)*0.28))
        else:
            x=self.screen_w//2
            start_y=int(self.screen_h*0.78)
            end_y=int(self.screen_h*0.28)
        self.shell("input","swipe",str(x),str(start_y),str(x),str(end_y),"450",check=False)
        time.sleep(0.55)

    def find_tap(self, patterns, checkpoint_prefix, swipes=0):
        last_xml = None
        for i in range(swipes + 1):
            xml = self.ui_dump("%s_find_%d" % (checkpoint_prefix, i))
            self.screenshot("%s_find_%d" % (checkpoint_prefix, i))
            last_xml = xml
            node = self.find_node(xml, patterns, visible_only=True)
            if node and self.tap_node(node):
                time.sleep(0.9)
                return True
            if i < swipes:
                self.scroll_forward(xml)
        return False

    def top_activity(self):
        text = self.shell("dumpsys", "activity", "activities", check=False).stdout or ""
        # Return the actual system top-resumed Activity, regardless of package.
        # The old tester fell back to any historical SHINE ActivityRecord and
        # therefore falsely claimed SHINE was foreground after HOME.
        for line in text.splitlines():
            if "topResumedActivity=" in line:
                return line.strip()
        for line in text.splitlines():
            if re.search(r"\bResumedActivity:", line):
                return line.strip()
        for line in text.splitlines():
            if "mResumedActivity:" in line:
                return line.strip()
        return ""

    def wait_activity(self, fragment, timeout=8):
        end = time.time() + timeout
        while time.time() < end:
            line = self.top_activity()
            if fragment in line:
                return True
            time.sleep(0.25)
        return False

    def launch(self):
        # A failed prior optical run may leave CameraSwitchCalibrationActivity
        # on top of SHINE's existing task. Starting MainActivity alone can then
        # just foreground that stale task. Preserve data but reset the process/
        # task so every acceptance run begins from the communication board.
        self.shell("am", "force-stop", PACKAGE, check=False)
        for attempt in range(2):
            if attempt:
                self.shell("input", "keyevent", "224", check=False)
                self.shell("wm", "dismiss-keyguard", check=False)
                time.sleep(0.8)
            self.shell("am", "start", "-n", MAIN_ACTIVITY, check=False, timeout=30)
            if self.wait_activity("MainActivity", 8) and self.wait_web_ui_ready(12):
                return True
        return False

    def wait_web_ui_ready(self, timeout=12):
        end = time.time() + timeout
        attempt = 0
        while time.time() < end:
            xml = self.ui_dump("wait_ui_%02d" % attempt)
            texts = "\n".join(self.visible_strings(xml)).lower()
            if (
                "settings" in texts or "設定" in texts or
                "camera setup" in texts or "相機設定" in texts
            ):
                return True
            attempt += 1
            time.sleep(0.4)
        return False

    def active_camera_for_shine(self, text):
        text = text or ""
        pos = text.find("Active Camera Clients:")
        if pos < 0:
            return False
        section = text[pos:pos + 5000]
        # Camera-service formatting differs by Android release. Stop at a
        # known following section when present; otherwise inspect the bounded
        # section only.
        for marker in ("Allowed user IDs:", "Camera service events:", "Camera Provider HAL"):
            cut = section.find(marker, len("Active Camera Clients:"))
            if cut >= 0:
                section = section[:cut]
                break
        return PACKAGE in section

    def runtime_camera_bind_count(self):
        """Count runtime-camera bind telemetry currently present in logcat."""
        text = self.shell(
            "logcat", "-d", "-v", "brief", "-s",
            "ShineCameraSwitch:I", "*:S", check=False
        ).stdout or ""
        return len(re.findall(r"OPTICAL_CAMERA\s+runtimeId=", text))

    def camera_gesture_preference(self):
        result = self.shell(
            "run-as", PACKAGE, "cat",
            "shared_prefs/shine_aac_camera_switch.xml",
            check=False,
        )
        match = re.search(
            r'<string\s+name="gesture">([^<]+)</string>',
            result.stdout or "",
        )
        return match.group(1) if match else "long-blink"

    def camera_preview_bounds(self, xml_path):
        metrics = infer_camera_preview_metrics(
            self.xml_nodes(xml_path), self.screen_h
        )
        if not metrics:
            return None
        return (
            metrics["top"], metrics["bottom"], metrics["height"]
        )

    def is_config_ui(self, xml):
        if SETTINGS_ACTIVITY_FRAGMENT in self.top_activity():
            return True
        texts = "\n".join(self.visible_strings(xml)).lower()
        has_camera_setup = ("camera setup" in texts or "相機設定" in texts)
        has_save = ("save" in texts or "儲存" in texts)
        return has_camera_setup and has_save

    def is_board_ui(self, xml):
        activity = self.top_activity()
        if SETTINGS_ACTIVITY_FRAGMENT in activity or CAMERA_ACTIVITY_FRAGMENT in activity:
            return False
        if "MainActivity" not in activity:
            return False
        texts = "\n".join(self.visible_strings(xml)).lower()
        config_button = ("settings" in texts or "設定" in texts)
        camera_setup = ("camera setup" in texts or "相機設定" in texts)
        return config_button and not camera_setup

    def ensure_board(self):
        # Normalize only navigation state; no stored config changes.
        for i in range(4):
            line = self.top_activity()
            if CAMERA_ACTIVITY_FRAGMENT in line:
                self.shell("input", "keyevent", "4", check=False)
                time.sleep(0.7)
                continue
            xml = self.ui_dump("normalize_%d" % i)
            if self.is_board_ui(xml):
                return True
            self.shell("input", "keyevent", "4", check=False)
            time.sleep(0.7)
        return self.is_board_ui(self.ui_dump("normalize_final"))

    def open_config(self, cycle):
        xml = self.ui_dump("cycle%02d_board_before_config" % cycle)
        node = self.find_node(xml, ["⚙ 設定", "settings", "設定"])
        if node:
            self.tap_node(node)
        else:
            # Board config button is top-right in current UI; accessibility failure
            # gets recorded separately, but continue with a geometric fallback.
            self.add(
                "P2", "Settings button not exposed to UIAutomator",
                "Used top-right coordinate fallback; accessibility automation is weaker.",
                ["ui/cycle%02d_board_before_config.xml" % cycle]
            )
            self.shell(
                "input", "tap",
                str(int(self.screen_w*0.90)), str(int(self.screen_h*0.09)),
                check=False
            )
        time.sleep(0.8)
        xml2 = self.ui_dump("cycle%02d_config" % cycle)
        self.screenshot("cycle%02d_config" % cycle)
        return self.is_config_ui(xml2)

    def open_camera_setup_from_config(self, label, section_swipes=5, camera_swipes=5):
        """Follow the native Settings index into Input, then Camera Setup."""
        if not self.find_tap(
            ["input", "輸入"], label + "_input_section", swipes=section_swipes
        ):
            return False
        return bool(self.find_tap(
            ["camera setup", "相機設定"], label, swipes=camera_swipes
        ))

    def analyze_layout(self, name, xml):
        """
        Device-side accessibility/layout heuristics.

        Android recommends 48dp minimum touch targets. UIAutomator exposes many
        offscreen WebView descendants clamped to the viewport edge, so checks
        are intentionally restricted to actual visible rectangles.
        """
        nodes = self.xml_nodes(xml)
        viewport_bounds = nodes[0].get("bounds") if nodes else None
        min_px = int(48.0 * self.density / 160.0)
        small = []
        size_exemptions = []
        unnamed = []
        visible_controls = []

        if "board" in name or name in (
            "launch", "scan_motion_board", "background_before", "background_return",
            "screenoff_before", "screenoff_return", "recreation_after"
        ):
            surface = "Communication-board"
        elif "camera_setup" in name:
            surface = "Camera-setup"
        elif "config" in name or "return_from_camera" in name:
            surface = "Configuration"
        else:
            surface = "Communication-board"

        for n in nodes:
            b = n["bounds"]
            if not b or not n["clickable"] or not n["enabled"]:
                continue
            if not self.node_is_visible_target(n, min_height_px=2):
                continue
            cls = n["cls"]
            if not (
                "Button" in cls or "CheckBox" in cls or "Spinner" in cls or
                "EditText" in cls or "Switch" in cls or "ImageButton" in cls
            ):
                continue
            visible_controls.append(n)
            x1,y1,x2,y2 = b
            if (x2-x1) < min_px or (y2-y1) < min_px:
                exemption = touch_target_size_exemption(surface, n, viewport_bounds)
                item = {
                    "name": n["text"] or n["desc"] or cls,
                    "class": cls,
                    "bounds": b,
                    "width_px": x2-x1,
                    "height_px": y2-y1,
                }
                if exemption:
                    item["reason"] = exemption
                    size_exemptions.append(item)
                else:
                    small.append(item)
            if not n["text"].strip() and not n["desc"].strip():
                unnamed.append((cls, b, n["resource_id"]))

        if small:
            self.add_layout_observation(
                "P2", "%s touch targets below 48dp" % surface,
                len(small), name,
                [
                    "ui/%s.xml" % name,
                    "screenshots/%s.png" % name,
                    "dumpsys/%s_layout.json" % name,
                ]
            )

        if unnamed:
            self.add_layout_observation(
                "P2", "Visible controls missing Android accessibility names",
                len(unnamed), name,
                ["ui/%s.xml" % name, "screenshots/%s.png" % name]
            )

        layout_metrics = {
            "surface": surface,
            "minimum_target_px": min_px,
            "small_targets": small,
            "effective_target_exemptions": size_exemptions,
        }

        if "camera_setup" in name:
            preview = infer_camera_preview_metrics(nodes, self.screen_h)
            if preview:
                layout_metrics["camera_preview"] = preview
                allocation_findings = find_region_allocation_violations([{
                    "name": "camera-preview",
                    "role": "primary-visual",
                    "fraction": preview["screen_fraction"],
                    "minimum_fraction": 0.50,
                }])
                layout_metrics["region_allocation_findings"] = allocation_findings
                if allocation_findings:
                    self.add_layout_observation(
                        "P2", "Camera preview occupies less than 50% of the screen",
                        1, name,
                        [
                            "ui/%s.xml" % name,
                            "screenshots/%s.png" % name,
                            "dumpsys/%s_layout.json" % name,
                        ]
                    )
            padded_buttons = camera_setup_excessively_padded_buttons(nodes, self.density)
            layout_metrics["excessively_padded_secondary_buttons"] = padded_buttons
            if padded_buttons:
                self.add_layout_observation(
                    "P3", "Camera setup secondary controls use over-expanded cells",
                    len(padded_buttons), name,
                    [
                        "ui/%s.xml" % name,
                        "screenshots/%s.png" % name,
                        "dumpsys/%s_layout.json" % name,
                    ]
                )
            alignment_drift = camera_setup_control_group_alignment_drift(
                nodes, self.density
            )
            layout_metrics["control_group_alignment_drift"] = alignment_drift
            if alignment_drift:
                self.add_layout_observation(
                    "P3", "Camera setup control groups break the trailing grid edge",
                    len(alignment_drift), name,
                    [
                        "ui/%s.xml" % name,
                        "screenshots/%s.png" % name,
                        "dumpsys/%s_layout.json" % name,
                    ]
                )
        self.save(
            "dumpsys/%s_layout.json" % name,
            json.dumps(layout_metrics, indent=2)
        )

    def visible_text_set(self, xml_path):
        result = set()
        for n in self.xml_nodes(xml_path):
            b = n.get("bounds")
            if not b:
                continue
            x1,y1,x2,y2 = b
            if x2 <= 0 or y2 <= 0 or x1 >= self.screen_w or y1 >= self.screen_h:
                continue
            if x2-x1 <= 1 or y2-y1 <= 1:
                continue
            for key in ("text", "desc"):
                v = (n.get(key) or "").strip()
                if v:
                    result.add(v)
        return result

    def mem_pss_kb(self, label):
        r = self.shell("dumpsys", "meminfo", PACKAGE, check=False, timeout=30)
        text = r.stdout or ""
        self.save("dumpsys/mem_%s.txt" % label, text)
        pss = None
        for pat in (
            r"TOTAL PSS:\s*(\d+)",
            r"TOTAL\s+(\d+)\s+\d+\s+\d+\s+\d+",
        ):
            m = re.search(pat, text)
            if m:
                pss = int(m.group(1))
                break
        if pss is not None:
            self.memory_samples.append((label, pss))
        return pss

    def screenshot_hash_sequence(self, prefix, count=5, interval=0.65):
        hashes = []
        paths = []
        for i in range(count):
            p = self.screenshot("%s_%02d" % (prefix, i))
            paths.append(p)
            try:
                hashes.append(hashlib.sha256(p.read_bytes()).hexdigest())
            except Exception:
                pass
            time.sleep(interval)
        return hashes, paths

    def configure_thermal(
        self,
        stop_status=2,
        hot_battery_c=42.0,
        resume_battery_c=38.0,
        stable_seconds=30
    ):
        self.thermal = ThermalGovernor(
            self.shell,
            self.outdir / "thermal.csv",
            stop_status=stop_status,
            hot_battery_c=hot_battery_c,
            resume_battery_c=resume_battery_c,
            stable_seconds=stable_seconds,
            poll_seconds=5,
        )

    def _thermal_suspend(self):
        # Release camera/CPU/GPU work aggressively so cooldown is meaningful.
        self.shell("am", "force-stop", PACKAGE, check=False)
        self.shell("input", "keyevent", "223", check=False)  # SLEEP

    def _thermal_resume(self):
        self.shell("input", "keyevent", "224", check=False)  # WAKEUP
        self.shell("wm", "dismiss-keyguard", check=False)
        time.sleep(1)
        self.launch()
        time.sleep(1)

    def thermal_guard(self, label):
        if self.thermal is None:
            return False
        return self.thermal.guard(
            label,
            on_suspend=self._thermal_suspend,
            on_resume=self._thermal_resume,
        )

    def setup_power_guard(self):
        r = self.shell("wm", "size", check=False).stdout or ""
        m = re.search(r"(?:Physical|Override) size:\s*(\d+)x(\d+)", r)
        if m:
            self.screen_w, self.screen_h = int(m.group(1)), int(m.group(2))
        r = self.shell("wm", "density", check=False).stdout or ""
        dens = re.findall(r"(?:Physical|Override) density:\s*(\d+)", r)
        if dens:
            self.density = int(dens[-1])

        self.original_timeout = (self.shell(
            "settings", "get", "system", "screen_off_timeout", check=False
        ).stdout or "").strip()
        self.original_stay = (self.shell(
            "settings", "get", "global", "stay_on_while_plugged_in", check=False
        ).stdout or "").strip()
        self.original_font_scale = (self.shell(
            "settings", "get", "system", "font_scale", check=False
        ).stdout or "").strip()
        self.original_auto_rotate = (self.shell(
            "settings", "get", "system", "accelerometer_rotation", check=False
        ).stdout or "").strip()
        self.original_user_rotation = (self.shell(
            "settings", "get", "system", "user_rotation", check=False
        ).stdout or "").strip()

        self.shell("settings", "put", "system", "screen_off_timeout", "2147483647", check=False)
        self.shell("settings", "put", "global", "stay_on_while_plugged_in", "7", check=False)
        self.shell("svc", "power", "stayon", "true", check=False)
        self.shell("input", "keyevent", "224", check=False)  # WAKEUP
        self.shell("wm", "dismiss-keyguard", check=False)
        time.sleep(0.8)
        self.passed("screen kept awake", "timeout extended; stay-on enabled while powered")

    def restore_power_guard(self):
        if self.original_timeout and self.original_timeout not in ("null", "None"):
            self.shell("settings", "put", "system", "screen_off_timeout",
                       self.original_timeout, check=False)
        if self.original_stay and self.original_stay not in ("null", "None"):
            self.shell("settings", "put", "global", "stay_on_while_plugged_in",
                       self.original_stay, check=False)
        else:
            self.shell("settings", "delete", "global", "stay_on_while_plugged_in", check=False)
        if self.original_font_scale and self.original_font_scale not in ("null", "None"):
            self.shell("settings", "put", "system", "font_scale",
                       self.original_font_scale, check=False)
        if self.original_auto_rotate and self.original_auto_rotate not in ("null", "None"):
            self.shell("settings", "put", "system", "accelerometer_rotation",
                       self.original_auto_rotate, check=False)
        if self.original_user_rotation and self.original_user_rotation not in ("null", "None"):
            self.shell("settings", "put", "system", "user_rotation",
                       self.original_user_rotation, check=False)

    def dump_prefs(self):
        ls = self.shell("run-as", PACKAGE, "ls", "shared_prefs", check=False)
        if ls.returncode != 0:
            self.add("INFO", "Preferences unavailable", "run-as could not read shared_prefs.")
            return
        for fn in (ls.stdout or "").splitlines():
            fn = fn.strip()
            if not fn:
                continue
            r = self.shell("run-as", PACKAGE, "cat", "shared_prefs/" + fn, check=False)
            self.save("prefs/" + fn, r.stdout or "")

    def test_camera_return_cycles(self, cycles):
        for cycle in range(1, cycles+1):
            self.thermal_guard("camera-cycle-%d" % cycle)
            if not self.ensure_board():
                self.add(
                    "P0", "Cannot reach scanning board",
                    "Navigation normalization failed before camera setup cycle %d." % cycle,
                    ["ui/normalize_final.xml", "screenshots/cycle%02d_config.png" % cycle]
                )
                return False

            if not self.open_config(cycle):
                self.add(
                    "P0", "Cannot open configuration",
                    "Settings was tapped but Camera setup/Save controls were not present.",
                    ["ui/cycle%02d_config.xml" % cycle, "screenshots/cycle%02d_config.png" % cycle]
                )
                return False

            config_before_xml = self.outdir / "ui" / ("cycle%02d_config.xml" % cycle)
            config_before_signature = self.form_value_signature(config_before_xml)

            if not self.open_camera_setup_from_config(
                "cycle%02d_camera_button" % cycle,
                section_swipes=6,
                camera_swipes=3,
            ):
                self.add(
                    "P0", "Camera setup button not reachable",
                    "Could not follow Settings > Input > Camera setup.",
                    ["ui/cycle%02d_config.xml" % cycle]
                )
                return False

            if not self.wait_activity(CAMERA_ACTIVITY_FRAGMENT, 8):
                self.checkpoint("cycle%02d_camera_launch_failed" % cycle)
                top = self.top_activity()
                self.add(
                    "P0", "Camera setup Activity failed to launch",
                    "A VISIBLE Camera setup button was tapped, but CameraSwitchCalibrationActivity "
                    "did not become top-resumed. Top activity: %s" % top,
                    ["ui/cycle%02d_camera_button_find_0.xml" % cycle,
                     "screenshots/cycle%02d_camera_launch_failed.png" % cycle,
                     "dumpsys/cycle%02d_camera_launch_failed_activity.txt" % cycle]
                )
                return False

            self.checkpoint("cycle%02d_camera_setup" % cycle)
            cam_dump = self.outdir / "dumpsys" / ("cycle%02d_camera_setup_camera.txt" % cycle)
            cam_dump_text = cam_dump.read_text(encoding="utf-8", errors="replace") if cam_dump.exists() else ""
            if self.active_camera_for_shine(cam_dump_text):
                self.passed("camera active in setup cycle %d" % cycle)
            else:
                self.add(
                    "P1", "Camera not active in setup",
                    "Camera setup Activity is foreground but SHINE is not listed as an active camera client.",
                    ["dumpsys/cycle%02d_camera_setup_camera.txt" % cycle,
                     "screenshots/cycle%02d_camera_setup.png" % cycle]
                )
            if cycle == 1:
                self.mem_pss_kb("after_camera_cycle01")
            cam_xml = self.outdir / "ui" / ("cycle%02d_camera_setup.xml" % cycle)
            cam_text = "\n".join(self.visible_strings(cam_xml)).lower()
            if ("long blink" in cam_text or "長眨眼" in cam_text) and (
                "cheek twitch" in cam_text or "臉頰抽動" in cam_text
            ):
                self.passed("camera setup controls cycle %d" % cycle)
            else:
                self.add(
                    "P1", "Camera setup mode controls missing",
                    "Long blink/Cheek twitch controls were not both visible in UI hierarchy.",
                    ["ui/cycle%02d_camera_setup.xml" % cycle,
                     "screenshots/cycle%02d_camera_setup.png" % cycle]
                )

            if cycle == 1:
                original_gesture = self.camera_gesture_preference()
                if original_gesture == "cheek-twitch":
                    alternate_patterns = ["long blink", "長眨眼"]
                    restore_patterns = ["cheek twitch", "臉頰抽動"]
                else:
                    alternate_patterns = ["cheek twitch", "臉頰抽動"]
                    restore_patterns = ["long blink", "長眨眼"]
                initial_bounds = self.camera_preview_bounds(cam_xml)
                initial_text = set(self.visible_strings(cam_xml))
                original_node = self.find_node(
                    cam_xml, restore_patterns, visible_only=True
                )
                alternate = self.find_node(
                    cam_xml, alternate_patterns, visible_only=True
                )
                changed_xml = None
                restored_xml = None
                geometry_drift = []
                if alternate and self.tap_node(alternate):
                    time.sleep(0.6)
                    _, changed_xml = self.checkpoint(
                        "cycle01_camera_setup_message_change"
                    )
                    restore = (
                        self.find_node(
                            changed_xml, restore_patterns, visible_only=True
                        )
                        if changed_xml else None
                    ) or original_node
                    if restore and self.tap_node(restore):
                        time.sleep(0.6)
                        _, restored_xml = self.checkpoint(
                            "cycle01_camera_setup_message_restored"
                        )
                changed_bounds = self.camera_preview_bounds(changed_xml)
                restored_bounds = self.camera_preview_bounds(restored_xml)
                changed_text = (
                    set(self.visible_strings(changed_xml))
                    if changed_xml else set()
                )
                evidence = [
                    "ui/cycle01_camera_setup.xml",
                    "ui/cycle01_camera_setup_message_change.xml",
                    "ui/cycle01_camera_setup_message_restored.xml",
                    "screenshots/cycle01_camera_setup.png",
                    "screenshots/cycle01_camera_setup_message_change.png",
                    "screenshots/cycle01_camera_setup_message_restored.png",
                ]
                if not initial_bounds or not changed_bounds or not restored_bounds:
                    self.add(
                        "P2", "Camera preview stability could not be measured",
                        "The test could not obtain preview bounds before, during, and after a setup message/mode change.",
                        evidence,
                    )
                elif initial_text == changed_text:
                    self.add(
                        "P2", "Camera preview message-change scenario was inconclusive",
                        "Switching optical modes did not expose a different visible message state.",
                        evidence,
                    )
                else:
                    geometry_drift = find_geometry_drift([
                        {"name": "camera-preview", "state": "initial", "bounds": initial_bounds},
                        {"name": "camera-preview", "state": "message-change", "bounds": changed_bounds},
                        {"name": "camera-preview", "state": "restored", "bounds": restored_bounds},
                    ])
                if (initial_bounds and changed_bounds and restored_bounds
                        and initial_text != changed_text and not geometry_drift):
                    self.passed(
                        "camera preview bounds stable across message/mode change",
                        "bounds=%s; original gesture restored" % (initial_bounds,)
                    )
                elif (initial_bounds and changed_bounds and restored_bounds
                        and initial_text != changed_text):
                    self.add(
                        "P2", "Camera preview moves when setup messages change",
                        "Named-region geometry drift: %s" % geometry_drift,
                        evidence,
                    )

            # Native Back must return to native Settings, not the board.
            # Preserve a log watermark for legacy MainActivity-hosted settings.
            runtime_binds_before_back = self.runtime_camera_bind_count()
            self.shell("input", "keyevent", "4", check=False)
            if not self.wait_activity(SETTINGS_ACTIVITY_FRAGMENT, 8):
                self.add(
                    "P0", "Settings did not resume after camera setup",
                    "Back from camera setup did not resume SettingsActivity.",
                    ["dumpsys/cycle%02d_return_activity.txt" % cycle]
                )
                self.checkpoint("cycle%02d_return_failed" % cycle)
                return False
            time.sleep(0.8)
            shot, xml = self.checkpoint("cycle%02d_return_from_camera" % cycle)

            return_cam_dump = self.outdir / "dumpsys" / ("cycle%02d_return_from_camera_camera.txt" % cycle)
            return_cam_text = return_cam_dump.read_text(encoding="utf-8", errors="replace") if return_cam_dump.exists() else ""
            if self.active_camera_for_shine(return_cam_text):
                runtime_binds_after_back = self.runtime_camera_bind_count()
                if runtime_binds_after_back > runtime_binds_before_back:
                    self.passed(
                        "runtime camera resumed after setup cycle %d" % cycle,
                        "OPTICAL_CAMERA runtimeId telemetry proves this is the enabled input adapter, not a leaked setup session."
                    )
                else:
                    self.add(
                        "P0", "Camera remains active after leaving setup",
                        "SHINE remains an active camera client after Back returned to Settings, without a new runtime-camera bind.",
                        ["dumpsys/cycle%02d_return_from_camera_camera.txt" % cycle]
                    )
            else:
                self.passed("camera released after setup cycle %d" % cycle)

            if not self.is_config_ui(xml):
                evidence = [
                    "ui/cycle%02d_return_from_camera.xml" % cycle,
                    "screenshots/cycle%02d_return_from_camera.png" % cycle,
                    "dumpsys/cycle%02d_return_from_camera_activity.txt" % cycle
                ]
                if self.is_board_ui(xml):
                    before = xml.read_bytes() if xml and xml.exists() else b""
                    self.shell("input","tap",str(self.screen_w//2),str(self.screen_h//2),check=False)
                    time.sleep(0.20)
                    a1 = self.ui_dump("cycle%02d_wrong_page_activation_1" % cycle)
                    self.shell("input","tap",str(self.screen_w//2),str(self.screen_h//2),check=False)
                    time.sleep(0.20)
                    a2 = self.ui_dump("cycle%02d_wrong_page_activation_2" % cycle)
                    b1 = a1.read_bytes() if a1 and a1.exists() else b""
                    b2 = a2.read_bytes() if a2 and a2.exists() else b""
                    evidence += [
                        "ui/cycle%02d_wrong_page_activation_1.xml" % cycle,
                        "ui/cycle%02d_wrong_page_activation_2.xml" % cycle
                    ]
                    if before and before == b1 == b2:
                        self.add(
                            "P0", "Wrong-page return also blocks activation",
                            "The board was displayed after camera setup, and two touch activations "
                            "produced no UI state change. This matches stale configOpen.",
                            evidence
                        )
                self.add(
                    "P0", "Camera setup returns to wrong page",
                    "Back returned from Camera setup, but native Settings is absent.",
                    evidence
                )
                return False
            self.passed("camera setup returns to config cycle %d" % cycle)

            config_after_signature = self.form_value_signature(xml)
            if config_before_signature and config_after_signature:
                if config_before_signature == config_after_signature:
                    self.passed("config draft preserved cycle %d" % cycle)
                else:
                    self.add(
                        "P1", "Configuration draft changed across camera setup",
                        "Form values before opening native camera setup differ after returning.",
                        ["ui/cycle%02d_config.xml" % cycle,
                         "ui/cycle%02d_return_from_camera.xml" % cycle]
                    )

            # Camera setup returns to the Input subsection. Unwind the section
            # and root Settings screens before evaluating the live board.
            if not self.ensure_board():
                self.add(
                    "P0", "Cannot leave configuration after camera return",
                    "Back navigation did not unwind Input and root Settings.",
                    ["ui/cycle%02d_return_from_camera.xml" % cycle]
                )
                return False
            shot, board_xml = self.checkpoint("cycle%02d_board_after_config" % cycle)
            if not self.is_board_ui(board_xml):
                self.add(
                    "P0", "Cannot leave configuration after camera return",
                    "Back from restored configuration did not produce a normal board.",
                    ["ui/cycle%02d_board_after_config.xml" % cycle,
                     "screenshots/cycle%02d_board_after_config.png" % cycle]
                )
                return False

            # Touch activation smoke test. A stale hidden configOpen state makes
            # activateSwitch() return immediately; in that case UI tends to remain
            # byte-for-byte stable despite two deliberate activations.
            before = board_xml.read_bytes() if board_xml and board_xml.exists() else b""
            self.shell("input", "tap", str(self.screen_w//2), str(self.screen_h//2), check=False)
            time.sleep(0.18)
            mid = self.ui_dump("cycle%02d_activation_1" % cycle)
            self.shell("input", "tap", str(self.screen_w//2), str(self.screen_h//2), check=False)
            time.sleep(0.18)
            after = self.ui_dump("cycle%02d_activation_2" % cycle)
            mid_b = mid.read_bytes() if mid and mid.exists() else b""
            after_b = after.read_bytes() if after and after.exists() else b""
            if before and (before != mid_b or mid_b != after_b):
                self.passed("board activation responds cycle %d" % cycle)
            else:
                self.add(
                    "P1", "Board activation response inconclusive",
                    "Two board taps produced no UI hierarchy change. "
                    "Inspect screenshot/log evidence; this can indicate stale configOpen.",
                    ["ui/cycle%02d_board_after_config.xml" % cycle,
                     "ui/cycle%02d_activation_1.xml" % cycle,
                     "ui/cycle%02d_activation_2.xml" % cycle]
                )
        return True

    def test_background(self):
        if not self.ensure_board():
            self.add("P1", "Background test skipped", "Could not normalize to board.")
            return

        self.checkpoint("background_before")
        before_cam_text = (
            self.outdir / "dumpsys" / "background_before_camera.txt"
        ).read_text(encoding="utf-8", errors="replace")
        before_active = self.active_camera_for_shine(before_cam_text)

        self.shell("input", "keyevent", "3", check=False)  # HOME
        time.sleep(3)
        act = self.top_activity()
        self.dump_text("background_while_home_activity", "dumpsys", "activity", "activities")
        cam_path = self.dump_text("background_while_home_camera", "dumpsys", "media.camera")
        cam_text = cam_path.read_text(encoding="utf-8", errors="replace")

        if PACKAGE in act:
            self.add(
                "P1", "App still top-resumed after HOME",
                "System top-resumed Activity still belongs to SHINE after HOME: %s" % act,
                ["dumpsys/background_while_home_activity.txt"]
            )
        else:
            self.passed("app backgrounds normally", act)

        if self.active_camera_for_shine(cam_text):
            self.add(
                "P0", "Camera remains active in background",
                "SHINE AAC is still listed under Active Camera Clients three seconds after HOME.",
                ["dumpsys/background_while_home_camera.txt"]
            )
        else:
            self.passed(
                "camera released in background",
                "active before HOME=%s; active after HOME=false" % str(before_active).lower()
            )

        if not self.launch():
            self.add("P0", "App failed to foreground after HOME",
                     "MainActivity/WebView did not become ready.")
            return
        time.sleep(0.5)
        self.checkpoint("background_return")
        self.passed("app returns after background")

    def test_screen_off(self):
        if not self.ensure_board():
            self.add("P1", "Screen-off test skipped", "Could not normalize to board.")
            return

        self.checkpoint("screenoff_before")
        self.shell("input", "keyevent", "26", check=False)  # POWER -> off
        time.sleep(3)

        power_path = self.dump_text("screenoff_off_power", "dumpsys", "power")
        cam_path = self.dump_text("screenoff_off_camera", "dumpsys", "media.camera")
        act_path = self.dump_text("screenoff_off_activity", "dumpsys", "activity", "activities")
        power = power_path.read_text(encoding="utf-8", errors="replace")
        cam = cam_path.read_text(encoding="utf-8", errors="replace")

        if self.active_camera_for_shine(cam):
            self.add(
                "P0", "Camera remains active with display off",
                "SHINE AAC remains an Active Camera Client three seconds after screen-off.",
                ["dumpsys/screenoff_off_camera.txt", "dumpsys/screenoff_off_power.txt"]
            )
        else:
            self.passed("camera released with display off")

        if power_state_is_noninteractive(power):
            self.passed("screen-off power state confirmed")
        else:
            self.add(
                "INFO", "Screen-off state not confirmed",
                "Power dump did not report a non-interactive sleep/doze state; camera-release result is still recorded.",
                ["dumpsys/screenoff_off_power.txt"]
            )

        self.shell("input", "keyevent", "224", check=False)  # WAKEUP
        time.sleep(0.5)
        self.shell("wm", "dismiss-keyguard", check=False)
        if not self.launch():
            self.add("P0", "App failed to recover after screen off",
                     "MainActivity/WebView did not become ready after wake.")
            return
        time.sleep(0.5)
        self.checkpoint("screenoff_return")
        self.passed("app returns after screen off")

    def test_package_permissions(self):
        package_path = self.dump_text("package_permissions", "dumpsys", "package", PACKAGE)
        package_dump = package_path.read_text(encoding="utf-8", errors="replace")
        cam = self.shell(
            "pm", "check-permission", "android.permission.CAMERA", PACKAGE, check=False
        ).stdout or ""
        if camera_permission_is_granted(cam, package_dump):
            self.passed("camera permission granted")
        else:
            self.add(
                "INFO", "Camera permission is not granted",
                "Optical input cannot operate until the user grants CAMERA permission.",
                ["dumpsys/package_permissions.txt"]
            )

    def test_scan_feedback_and_config_pause(self):
        if not self.ensure_board():
            self.add("P1", "Scan feedback test skipped", "Could not normalize to board.")
            return

        self.checkpoint("scan_motion_board")
        hashes, paths = self.screenshot_hash_sequence("scan_motion_board", count=6, interval=0.55)
        if len(set(hashes)) >= 2:
            self.passed("board provides changing scan/progress feedback",
                        "%d distinct screenshots over %.1fs" %
                        (len(set(hashes)), 0.55 * max(0, len(hashes)-1)))
        else:
            # Initial/review/stopped holds are intentional static states. One
            # switch activation must resume them, while an already-running
            # scanner will simply enter its next stage. Only fail if feedback
            # remains static after that explicit activation.
            self.shell(
                "input", "tap",
                str(self.screen_w // 2), str(self.screen_h // 2),
                check=False,
            )
            time.sleep(0.25)
            resumed_hashes, resumed_paths = self.screenshot_hash_sequence(
                "scan_motion_after_activation", count=6, interval=0.55
            )
            if len(set(resumed_hashes)) >= 2:
                self.passed(
                    "board scan/progress resumes from a static hold",
                    "%d distinct screenshots after one switch activation" %
                    len(set(resumed_hashes))
                )
            else:
                self.add(
                    "P2", "Board scan/progress feedback not observed",
                    "The board remained byte-identical both before and after one explicit switch activation.",
                    ["screenshots/%s" % p.name for p in paths + resumed_paths]
                )

        if not self.open_config(90):
            self.add("P1", "Configuration pause test skipped", "Could not open configuration.")
            return
        hashes, paths = self.screenshot_hash_sequence("config_static", count=4, interval=0.7)
        # Do not fail if subtle WebView redraws change bytes; only record evidence.
        self.passed("configuration pause evidence captured",
                    "%d distinct screenshots while settings open" % len(set(hashes)))
        self.shell("input", "keyevent", "4", check=False)
        time.sleep(0.5)
        self.ensure_board()

    def test_process_recreation(self):
        if not self.ensure_board():
            self.add("P1", "Process recreation skipped", "Could not normalize to board.")
            return
        before = self.ui_dump("recreation_before")
        before_text = self.visible_text_set(before)
        self.mem_pss_kb("before_recreation")
        self.shell("am", "force-stop", PACKAGE, check=False)
        time.sleep(0.5)

        cam = self.shell("dumpsys", "media.camera", check=False).stdout or ""
        if self.active_camera_for_shine(cam):
            self.add(
                "P0", "Camera survives force-stop",
                "SHINE is still an active camera client after force-stop.",
                ["dumpsys/mem_before_recreation.txt"]
            )
        if not self.launch():
            self.add("P0", "Process recreation failed", "App did not relaunch after force-stop.")
            return
        time.sleep(0.8)
        shot, after = self.checkpoint("recreation_after")
        if not self.is_board_ui(after):
            self.add(
                "P1", "Wrong page after process recreation",
                "Relaunch after force-stop did not return to the communication board.",
                ["ui/recreation_after.xml", "screenshots/recreation_after.png"]
            )
        else:
            self.passed("process recreation returns to board")
        after_text = self.visible_text_set(after)
        if before_text and after_text:
            # A broad content sanity check, not an exact dynamic-suggestion equality.
            overlap = len(before_text & after_text) / float(max(1, len(before_text)))
            if overlap < 0.45:
                self.add(
                    "P2", "Board content changed substantially after recreation",
                    "Only %.0f%% of previously visible labels remained. Dynamic suggestions "
                    "can explain some change; inspect evidence." % (overlap * 100.0),
                    ["ui/recreation_before.xml", "ui/recreation_after.xml"]
                )
            else:
                self.passed("board content survives recreation",
                            "%.0f%% visible-label overlap" % (overlap * 100.0))

    def test_font_scale_200(self):
        original = self.original_font_scale or "1.0"
        try:
            self.shell("settings", "put", "system", "font_scale", "2.0", check=False)
            self.shell("am", "force-stop", PACKAGE, check=False)
            if not self.launch():
                self.add("P1", "200% font layout test failed to launch",
                         "App did not relaunch with font_scale=2.0.")
                return
            time.sleep(1.0)
            shot, board = self.checkpoint("font200_board")
            if not self.is_board_ui(board):
                self.add(
                    "P1", "Board not usable at 200% font",
                    "Normal board identity could not be recognized at font_scale=2.0.",
                    ["ui/font200_board.xml", "screenshots/font200_board.png"]
                )
            else:
                self.passed("board renders at 200% font")

            if self.open_config(91):
                self.checkpoint("font200_config")
                self.passed("configuration opens at 200% font")
                # Camera setup must still be reachable even if it is far below fold.
                if self.open_camera_setup_from_config(
                    "font200_camera_button",
                    section_swipes=10,
                    camera_swipes=5,
                ):
                    if self.wait_activity(CAMERA_ACTIVITY_FRAGMENT, 8):
                        self.checkpoint("font200_camera_setup")
                        self.passed("camera setup reachable at 200% font")
                        self.shell("input", "keyevent", "4", check=False)
                        self.wait_activity(SETTINGS_ACTIVITY_FRAGMENT, 8)
                    else:
                        self.add(
                            "P1", "Camera setup launch failed at 200% font",
                            "Camera setup button was reachable but native Activity did not launch.",
                            ["ui/font200_camera_button_find_0.xml"]
                        )
                else:
                    self.add(
                        "P1", "Camera setup unreachable at 200% font",
                        "Could not reach Camera setup after extended settings scrolling.",
                        ["screenshots/font200_config.png", "ui/font200_config.xml"]
                    )
            else:
                self.add(
                    "P1", "Configuration not usable at 200% font",
                    "Settings page could not be recognized.",
                    ["screenshots/font200_board.png"]
                )
        finally:
            self.shell("settings", "put", "system", "font_scale", original, check=False)
            self.shell("am", "force-stop", PACKAGE, check=False)
            self.launch()
            time.sleep(0.6)
            self.ensure_board()

    def test_landscape_layout(self):
        auto = self.original_auto_rotate or "1"
        rot = self.original_user_rotation or "0"
        try:
            self.shell("settings", "put", "system", "accelerometer_rotation", "0", check=False)
            self.shell("settings", "put", "system", "user_rotation", "1", check=False)
            time.sleep(1.0)
            self.shell("am", "force-stop", PACKAGE, check=False)
            if not self.launch():
                self.add("P1", "Landscape launch failed", "App did not relaunch after rotation.")
                return
            time.sleep(0.8)
            self.checkpoint("landscape_board")
            self.passed("landscape evidence captured")
            if self.open_config(92):
                self.checkpoint("landscape_config")
                self.passed("configuration opens in landscape/orientation-constrained state")
                self.shell("input", "keyevent", "4", check=False)
        finally:
            self.shell("settings", "put", "system", "accelerometer_rotation", auto, check=False)
            self.shell("settings", "put", "system", "user_rotation", rot, check=False)
            time.sleep(0.8)
            self.shell("am", "force-stop", PACKAGE, check=False)
            self.launch()
            time.sleep(0.6)
            self.ensure_board()

    def assess_memory_growth(self):
        self.mem_pss_kb("final")
        if len(self.memory_samples) < 2:
            return
        # Compare after the first expensive camera-model load with final state;
        # this avoids blaming the expected first-load model residency.
        base = None
        for label, kb in self.memory_samples:
            if label == "after_camera_cycle01":
                base = kb
                break
        if base is None:
            base = self.memory_samples[0][1]
        final = self.memory_samples[-1][1]
        growth = final - base
        self.save(
            "memory.txt",
            "\n".join("%s: %d KB" % item for item in self.memory_samples) +
            "\nGrowth from post-first-camera baseline: %d KB\n" % growth
        )
        if growth > max(60 * 1024, int(base * 0.35)):
            self.add(
                "P1", "Large memory growth across device test",
                "PSS grew by %.1f MiB from the post-first-camera baseline. "
                "This is a leak heuristic, not proof." % (growth / 1024.0),
                ["memory.txt"]
            )
        else:
            self.passed("memory growth bounded",
                        "%+.1f MiB after first camera load" % (growth / 1024.0))

    def scan_logs(self):
        r = self.adb_cmd("logcat", "-d", "-v", "threadtime", check=False, timeout=60)
        text = r.stdout or ""
        self.save("logcat.txt", text)

        # Identify SHINE PIDs seen during this run. Do not report arbitrary
        # Google Play Services / launcher exceptions as SHINE failures.
        shine_pids = set()
        for line in text.splitlines():
            if PACKAGE in line:
                m = re.match(r"\S+\s+\S+\s+\S+\s+(\d+)\s+(\d+)\s+", line)
                if m:
                    shine_pids.add(m.group(1))
        filtered = []
        for line in text.splitlines():
            lo = line.lower()
            pid_match = re.match(r"\S+\s+\S+\s+\S+\s+(\d+)\s+(\d+)\s+", line)
            pid = pid_match.group(1) if pid_match else None
            if (
                PACKAGE.lower() in lo or "shineaac" in lo or
                (pid and pid in shine_pids) or
                ("camera" in lo and PACKAGE.lower() in lo)
            ):
                filtered.append(line)
        filtered_text = "\n".join(filtered)
        self.save("logcat_filtered.txt", filtered_text)

        # Fatal/ANR checks explicitly require this app. Exception-class scans
        # are restricted to app-owned/filter lines.
        fatal = re.search(
            r"FATAL EXCEPTION[\s\S]{0,1200}?Process:\s*" + re.escape(PACKAGE),
            text, re.I
        )
        anr = re.search(r"ANR in\s+" + re.escape(PACKAGE), text, re.I)
        if fatal:
            self.add("P0", "Fatal exception", "SHINE AAC fatal exception found.",
                     ["logcat.txt", "logcat_filtered.txt"])
        if anr:
            self.add("P0", "ANR", "SHINE AAC ANR found.",
                     ["logcat.txt", "logcat_filtered.txt"])

        for title, pat in [
            ("Camera access exception", r"CameraAccessException"),
            ("Illegal state exception", r"IllegalStateException"),
        ]:
            hits = [line for line in filtered_text.splitlines() if re.search(pat, line, re.I)]
            if hits:
                self.add(
                    "P1", title,
                    "%d SHINE-filtered matching log line(s)." % len(hits),
                    ["logcat_filtered.txt"]
                )
        if not fatal and not anr:
            self.passed("no fatal crash/ANR in collected log")

    def write_report(self):
        findings = sorted(
            self.findings,
            key=lambda f: (PRIORITY_ORDER.get(f["priority"], 99), f["title"])
        )
        lines = [
            "# SHINE AAC device regression findings",
            "",
            "Device test directory: `%s`" % self.outdir.name,
            "",
            "## Ranked findings",
            "",
        ]
        if not findings:
            lines += ["No automated failures found.", ""]
        else:
            for i, f in enumerate(findings, 1):
                lines.append("### %d. [%s] %s" % (i, f["priority"], f["title"]))
                lines.append("")
                lines.append(f["detail"])
                lines.append("")
                if f["evidence"]:
                    lines.append("Evidence:")
                    report_evidence = f["evidence"]
                    if len(report_evidence) > 6:
                        report_evidence = report_evidence[:4] + report_evidence[-2:]
                    for e in report_evidence:
                        lines.append("- `%s`" % e)
                    if len(f["evidence"]) > len(report_evidence):
                        lines.append("- `%d additional evidence files listed in findings.json`" %
                                     (len(f["evidence"]) - len(report_evidence)))
                    lines.append("")
        lines += ["## Passed checks", ""]
        for title, detail in self.passes:
            lines.append("- **%s**%s" % (title, (": " + detail) if detail else ""))
        lines += [
            "",
            "## Priority meaning",
            "",
            "- **P0** — blocks primary workflow, activation, launch/return, or crashes.",
            "- **P1** — major functional/reliability issue; should fix before release.",
            "- **P2** — UI/layout/accessibility defect or automation weakness.",
            "- **P3** — minor/cosmetic issue.",
            "- **P4** — polish, consistency, or low-impact usability improvement.",
            "",
            "## AAC / UI / accessibility review basis",
            "",
            "- Android: visible interactive targets should be at least 48dp; icon-only controls need an accessible name.",
            "- WCAG 2.2: targets need adequate size/spacing; keyboard/switch focus needs a visible indicator; small text should meet 4.5:1 contrast and large text/graphics 3:1.",
            "- SHINE AAC project invariants: the communication board is a single-switch surface; configuration pauses scanning; scan timing/access method is user-configurable; mistakes need cheap recovery; board positions should remain stable.",
            "- AAC access practice: scan type/rate, activation timing, calibration, prompts/feedback and reset/rescan behavior are user-specific access settings and must remain adjustable.",
            "",
            "## Human review still required",
            "",
            "- Perform real long-blink and cheek-twitch activation. Confirm low false positives at rest and reliable intentional activation across head position/light changes.",
            "- Inspect camera keypoint alignment, live strength indicator, threshold marker and selected-mode highlight in the captured/native setup UI.",
            "- Confirm the active scan target is unmistakable without relying on color alone; inspect contrast and focus/highlight appearance.",
            "- Confirm board scanning does not create surprising target jumps, hidden state, or accidental double activation; verify UNDO/repair remains cheap.",
            "- Confirm speech/auditory prompts are understandable and do not make operation slower or fatiguing for the intended user.",
            "- Test with the actual user's access posture and switch site. Automation cannot assess fatigue, movement repeatability, cognition, vision or calibration quality.",
            "",
            "## Thermal control",
            "",
            "- `thermal.csv` records Android aggregate thermal status plus battery temperature throughout the run.",
            "- Testing automatically suspends at MODERATE-or-higher thermal status (configurable) or the battery-temperature fallback threshold, force-stops SHINE, sleeps the display, waits for a stable cool state, then resumes.",
            "",
            "## Automated-test limitations",
            "",
            "- ADB cannot generate a real cheek twitch or long blink.",
            "- CSS color/contrast and selected-button styling are captured in screenshots but are not reliably available in UIAutomator XML.",
            "- Dynamic suggestions can legitimately change some board labels across process recreation.",
        ]
        self.save("FINDINGS.md", "\n".join(lines))
        self.save("findings.json", json.dumps(self.findings, ensure_ascii=False, indent=2))
        summary = [
            "Findings: %d" % len(findings),
            "P0: %d" % sum(1 for f in findings if f["priority"] == "P0"),
            "P1: %d" % sum(1 for f in findings if f["priority"] == "P1"),
            "P2: %d" % sum(1 for f in findings if f["priority"] == "P2"),
            "P3: %d" % sum(1 for f in findings if f["priority"] == "P3"),
            "P4: %d" % sum(1 for f in findings if f["priority"] == "P4"),
            "Passed checks: %d" % len(self.passes),
            "Report: " + str((self.outdir / "FINDINGS.md").resolve()),
        ]
        self.save("summary.txt", "\n".join(summary))
        print()
        print("\n".join(summary))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-build", action="store_true",
                    help="skip npm quick tests and Android debug build")
    ap.add_argument("--apk",
                    help="install and test this exact APK (relative paths use the repository root)")
    ap.add_argument("--no-install", action="store_true")
    ap.add_argument("--cycles", type=int, default=5)
    ap.add_argument("--skip-font-200", action="store_true")
    ap.add_argument("--skip-rotation", action="store_true")
    ap.add_argument("--leave-awake", action="store_true")
    ap.add_argument("--thermal-stop-status", type=int, default=2,
                    help="pause testing at Android thermal status >= this value (2=MODERATE)")
    ap.add_argument("--thermal-hot-c", type=float, default=42.0,
                    help="battery-temperature fallback cooldown threshold")
    ap.add_argument("--thermal-resume-c", type=float, default=38.0,
                    help="battery temperature required before resuming")
    ap.add_argument("--thermal-stable-sec", type=int, default=30,
                    help="cool state must remain stable this many seconds before resume")
    args = ap.parse_args()

    root = Path.cwd()
    if not (root / "app").exists() or not (root / "packages" / "aac-core").exists():
        raise SystemExit("Run from shine_aac repository root.")

    apk_path = Path(args.apk).expanduser() if args.apk else DEFAULT_APK
    if not apk_path.is_absolute():
        apk_path = root / apk_path
    apk_path = apk_path.resolve()

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    outdir = root / "test-results" / ("device-" + stamp)
    outdir.mkdir(parents=True, exist_ok=True)

    # Standard physical acceptance begins from source-level quick tests + a
    # fresh debug APK unless explicitly skipped.
    if not args.no_build:
        print("==> Running repository quick tests")
        npm_cmd = (
            ["cmd.exe", "/c", "npm.cmd", "run", "test:quick"]
            if os.name == "nt"
            else ["npm", "run", "test:quick"]
        )
        r = run(npm_cmd, check=False, timeout=300, cwd=root)
        (outdir / "prereq-npm.txt").write_text(r.stdout or "", encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise SystemExit("npm run test:quick failed; see %s" % (outdir / "prereq-npm.txt"))
        print("==> Building/testing Android debug APK")
        if os.name == "nt":
            r = run(["cmd.exe", "/c", "build-test.bat"], check=False, timeout=900, cwd=root)
        else:
            r = run(["./gradlew", "testDebugUnitTest", "assembleDebug"],
                    check=False, timeout=900, cwd=root)
        (outdir / "prereq-android.txt").write_text(r.stdout or "", encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise SystemExit("Android build/unit tests failed; see %s" %
                             (outdir / "prereq-android.txt"))

    adb = find_adb()
    t = DeepTest(adb, root, outdir)

    if apk_path.exists():
        apk_sha256 = hashlib.sha256(apk_path.read_bytes()).hexdigest()
        t.save(
            "apk.txt",
            "path=%s\nsize=%d\nsha256=%s\n" %
            (apk_path, apk_path.stat().st_size, apk_sha256),
        )
    else:
        apk_sha256 = "missing"

    git = []
    for cmd in (
        ["git", "rev-parse", "HEAD"],
        ["git", "status", "--short"],
        ["git", "log", "-1", "--oneline"],
    ):
        r = run(cmd, check=False, cwd=root)
        git.append("$ " + " ".join(cmd) + "\n" + (r.stdout or ""))
    t.save("git.txt", "\n".join(git))

    dev = t.adb_cmd("devices", "-l")
    lines = [
        x for x in (dev.stdout or "").splitlines()
        if x.strip() and not x.startswith("List of devices")
    ]
    authorized = [x for x in lines if re.search(r"\sdevice(?:\s|$)", x)]
    if len(authorized) != 1:
        raise SystemExit("Expected exactly one authorized adb device.\n" + (dev.stdout or ""))
    t.passed("ADB device", authorized[0].split()[0])

    exit_code = 0
    try:
        t.setup_power_guard()
        t.configure_thermal(
            stop_status=args.thermal_stop_status,
            hot_battery_c=args.thermal_hot_c,
            resume_battery_c=args.thermal_resume_c,
            stable_seconds=args.thermal_stable_sec,
        )
        t.thermal_guard("test-start")
        t.dump_text("device_properties", "getprop")
        t.dump_text("display_initial", "dumpsys", "display")
        t.dump_text("battery_initial", "dumpsys", "battery")

        if not args.no_install:
            if not apk_path.exists():
                raise SystemExit("APK missing: " + str(apk_path))
            r = t.adb_cmd("install", "-r", str(apk_path), check=False, timeout=120)
            t.save("install.txt", r.stdout or "")
            if r.returncode != 0 or "Success" not in (r.stdout or ""):
                t.add("P0", "APK install failed", (r.stdout or "").strip(), ["install.txt"])
                t.write_report()
                return 2
            t.passed("APK install", "%s sha256=%s" % (apk_path.name, apk_sha256))

        t.thermal_guard("before-permissions")
        t.test_package_permissions()
        t.adb_cmd("logcat", "-c", check=False)
        t.shell("am", "force-stop", PACKAGE, check=False)
        launch_started = time.time()
        if not t.launch():
            t.add("P0", "App launch failed", "MainActivity did not become resumed.")
            t.checkpoint("launch_failed")
            t.scan_logs()
            t.write_report()
            return 2
        t.passed("app launch", "%.2fs until board-ready check" % (time.time() - launch_started))
        t.checkpoint("launch")
        t.mem_pss_kb("launch")
        t.dump_prefs()

        t.thermal_guard("before-scan-config")
        t.test_scan_feedback_and_config_pause()
        t.thermal_guard("before-camera-cycles")
        t.test_camera_return_cycles(max(1, args.cycles))
        t.thermal_guard("before-background")
        t.test_background()
        t.thermal_guard("before-screen-off")
        t.test_screen_off()
        t.thermal_guard("before-process-recreation")
        t.test_process_recreation()
        if not args.skip_font_200:
            t.thermal_guard("before-font-200")
            t.test_font_scale_200()
        if not args.skip_rotation:
            t.thermal_guard("before-landscape")
            t.test_landscape_layout()
        t.thermal_guard("before-final-analysis")
        t.assess_memory_growth()
        t.scan_logs()
        t.dump_prefs()
        t.write_report()

        blocking = [f for f in t.findings if f["priority"] in ("P0", "P1")]
        exit_code = 1 if blocking else 0
    finally:
        if not args.leave_awake:
            t.restore_power_guard()
        # Test policy: always finish with the phone display off.
        try:
            t.shell("input", "keyevent", "223", check=False)
        except Exception:
            pass

    return exit_code

if __name__ == "__main__":
    sys.exit(main() or 0)
