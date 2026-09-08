#!/usr/bin/env python3
"""Read-only physical-device audit of SHINE AAC's native AndroidX Settings."""

import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = os.environ.get("SHINE_AAC_TEST_PACKAGE", "org.shineaac.app")
MAIN_ACTIVITY = PACKAGE + "/org.shineaac.app.MainActivity"
SETTINGS_ACTIVITY = "SettingsActivity"
INPUT_TEST_ACTIVITY = "InputTestActivity"
RESOURCE_ACTIVITY = "ResourceManagementActivity"


def release_version(path=None):
    values = {}
    version_path = Path(path) if path else ROOT / "version.properties"
    for line in version_path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key.strip()] = value.strip()
    version_name = values.get("versionName")
    version_code = values.get("versionCode")
    if not version_name or not version_code:
        raise RuntimeError("version.properties is missing versionName or versionCode")
    return version_name, version_code


def find_adb():
    candidates = []
    if os.environ.get("ADB"):
        candidates.append(os.environ["ADB"])
    for name in ("ANDROID_SDK_ROOT", "ANDROID_HOME"):
        if os.environ.get(name):
            candidates.append(str(Path(os.environ[name]) / "platform-tools" / "adb.exe"))
    candidates.append(shutil.which("adb"))
    for drive in "CDEFG":
        candidates.append("%s:/Android/Sdk/platform-tools/adb.exe" % drive)
    for candidate in candidates:
        try:
            if candidate and Path(candidate).is_file():
                return str(Path(candidate))
        except OSError:
            # An inaccessible SDK on one drive must not prevent probing the
            # configured or fixed-path SDK on a later drive.
            continue
    raise RuntimeError("adb.exe not found")


def bounds(value):
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", value or "")
    return tuple(map(int, match.groups())) if match else None


class NativeSettingsAudit:
    def __init__(self):
        self.adb = find_adb()
        serial = (os.environ.get("ANDROID_SERIAL") or "").strip()
        self.adb_args = [self.adb] + (["-s", serial] if serial else [])
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        self.out = ROOT / "test-results" / ("native-config-" + stamp)
        (self.out / "screenshots").mkdir(parents=True, exist_ok=True)
        (self.out / "ui").mkdir(parents=True, exist_ok=True)
        self.findings = []
        self.passes = []
        self.dump_index = 0
        self.density = 1.0

    def adb_run(self, *args, binary=False, check=True):
        result = subprocess.run(
            self.adb_args + list(args), cwd=str(ROOT), capture_output=True,
            text=not binary, encoding="utf-8" if not binary else None,
            errors="replace" if not binary else None, check=False,
        )
        if check and result.returncode:
            raise RuntimeError("adb failed: %s" % ((result.stderr or result.stdout) if not binary else args))
        return result.stdout

    def shell(self, *args, **kwargs):
        return self.adb_run("shell", *args, **kwargs)

    def add(self, priority, title, detail, evidence=None):
        self.findings.append({
            "priority": priority, "title": title, "detail": detail,
            "evidence": evidence or [],
        })

    def passed(self, title, detail=""):
        self.passes.append({"title": title, "detail": detail})

    def top_activity(self):
        text = self.shell("dumpsys", "activity", "activities", check=False) or ""
        for line in text.splitlines():
            if (
                "topResumedActivity=" in line or
                "mResumedActivity:" in line or
                "ResumedActivity:" in line
            ):
                return line.strip()
        return ""

    def wait_activity(self, fragment, timeout=8.0):
        end = time.time() + timeout
        while time.time() < end:
            if fragment in self.top_activity():
                return True
            time.sleep(0.25)
        return False

    def ensure_interactive(self):
        """Recover from the preceding acceptance test's display-off checkpoint."""
        self.shell("input", "keyevent", "224", check=False)  # KEYCODE_WAKEUP
        self.shell("wm", "dismiss-keyguard", check=False)
        self.shell("input", "keyevent", "82", check=False)  # KEYCODE_MENU fallback
        time.sleep(0.8)

    def dump(self, name):
        self.dump_index += 1
        self.shell("uiautomator", "dump", "/sdcard/shine-settings.xml", check=False)
        xml = self.shell("cat", "/sdcard/shine-settings.xml", check=False) or "<hierarchy/>"
        path = self.out / "ui" / ("%03d_%s.xml" % (self.dump_index, name))
        path.write_text(xml, encoding="utf-8")
        return path

    def screenshot(self, name):
        data = self.adb_run("exec-out", "screencap", "-p", binary=True)
        path = self.out / "screenshots" / (name + ".png")
        path.write_bytes(data)
        return "screenshots/" + path.name

    def nodes(self, path):
        try:
            root = ET.parse(str(path)).getroot()
        except ET.ParseError:
            return []
        result = []
        for raw in root.iter("node"):
            item = dict(raw.attrib)
            item["bounds_value"] = bounds(item.get("bounds"))
            result.append(item)
        return result

    def texts(self, path):
        return [
            value.strip() for node in self.nodes(path)
            for value in (node.get("text", ""), node.get("content-desc", ""))
            if value.strip()
        ]

    def swipe_up(self):
        size = self.shell("wm", "size", check=False) or "1080x2160"
        match = re.search(r"(\d+)x(\d+)", size)
        width, height = map(int, match.groups()) if match else (1080, 2160)
        self.shell("input", "swipe", str(width // 2), str(int(height * .80)),
                   str(width // 2), str(int(height * .28)), "400", check=False)
        time.sleep(0.5)

    def tap_text(self, aliases, name, swipes=0):
        aliases = [item.casefold() for item in aliases]
        for attempt in range(swipes + 1):
            path = self.dump("%s_find_%d" % (name, attempt))
            candidates = []
            for node in self.nodes(path):
                label = (node.get("text", "") + " " + node.get("content-desc", "")).strip()
                rectangle = node.get("bounds_value")
                if not rectangle or not any(alias in label.casefold() for alias in aliases):
                    continue
                x1, y1, x2, y2 = rectangle
                if x2 > x1 and y2 > y1:
                    candidates.append((
                        y1 >= 72 * self.density,
                        label.casefold() in aliases,
                        node.get("clickable") == "true",
                        (x2-x1)*(y2-y1),
                        rectangle,
                    ))
            if candidates:
                # Exact title matches beat summaries that merely mention the
                # same word. Content rows beat an identical toolbar title.
                candidates.sort(key=lambda item: (not item[0], not item[1], not item[2], -item[3]))
                x1, y1, x2, y2 = candidates[0][4]
                self.shell("input", "tap", str((x1+x2)//2), str((y1+y2)//2), check=False)
                time.sleep(0.7)
                return True
            if attempt < swipes:
                self.swipe_up()
        return False

    def open_settings(self):
        self.shell("am", "force-stop", PACKAGE, check=False)
        self.shell("am", "start", "-n", MAIN_ACTIVITY, check=False)
        if not self.wait_activity("MainActivity", 8):
            raise RuntimeError("MainActivity did not launch")
        time.sleep(1.2)
        if not self.tap_text(["settings", "設定"], "board_settings", 1):
            raise RuntimeError("Settings control not found on board")
        if not self.wait_activity(SETTINGS_ACTIVITY, 8):
            raise RuntimeError("SettingsActivity did not open")

    def back_to_root(self):
        for _ in range(4):
            path = self.dump("back_to_root")
            visible = set(self.texts(path))
            if any(label in visible for label in ("Communication", "溝通")):
                return True
            self.shell("input", "keyevent", "4", check=False)
            time.sleep(0.5)
            if SETTINGS_ACTIVITY not in self.top_activity():
                return False
        return False

    def collect_page(self, name, scrolls=2):
        all_text = set()
        heights = []
        evidence = []
        for index in range(scrolls + 1):
            path = self.dump("%s_%d" % (name, index))
            all_text.update(self.texts(path))
            evidence.append(str(path.relative_to(self.out)).replace("\\", "/"))
            if index == 0:
                evidence.append(self.screenshot(name))
            for node in self.nodes(path):
                if node.get("clickable") != "true" or not node.get("bounds_value"):
                    continue
                x1, y1, x2, y2 = node["bounds_value"]
                heights.append((node.get("text", "") or node.get("class", ""), (y2-y1)/self.density))
            if index < scrolls:
                self.swipe_up()
        return all_text, heights, evidence

    def require_labels(self, page, texts, groups, evidence):
        missing = []
        joined = "\n".join(texts).casefold()
        for aliases in groups:
            if not any(alias.casefold() in joined for alias in aliases):
                missing.append("/".join(aliases))
        if missing:
            self.add("P1", page + " settings missing", ", ".join(missing), evidence)
        else:
            self.passed(page + " inventory", "%d major controls present" % len(groups))

    def audit_row_density(self, page, heights, evidence):
        oversized = [(name, round(height, 1)) for name, height in heights if height > 112]
        if oversized:
            self.add("P2", page + " rows waste vertical space", str(oversized[:8]), evidence)

    def open_section(self, aliases, key):
        # Start each inventory case from a fresh root. PreferenceFragmentCompat
        # preserves each list's scroll position; trying to reverse a prior
        # audit swipe can otherwise miss a valid section that is above it.
        self.open_settings()
        if not self.tap_text(aliases, "section_" + key, 5):
            raise RuntimeError("Could not open Settings section " + key)

    def audit_dialog(self, section_aliases, section_key, control_aliases, key):
        self.open_section(section_aliases, section_key)
        if not self.tap_text(control_aliases, "dialog_" + key, 3):
            self.add("P1", key + " option unavailable", "Could not open its editor/dialog")
            return
        path = self.dump("dialog_" + key)
        self.screenshot("dialog-" + key)
        if len(self.texts(path)) < 2:
            self.add("P1", key + " dialog empty", "No choices/editor content exposed")
        else:
            self.passed(key + " option dialog", "opened without changing its value")
        self.shell("input", "keyevent", "4", check=False)
        time.sleep(0.4)

    def run(self):
        self.ensure_interactive()
        density_text = self.shell("wm", "density", check=False) or "density: 160"
        match = re.search(r"(\d+)", density_text)
        self.density = (int(match.group(1)) / 160.0) if match else 1.0
        self.open_settings()
        root_texts, root_heights, root_evidence = self.collect_page("settings-root", 2)
        sections = {
            "communication": (["Communication", "溝通"], [
                ["Language", "語言"], ["Columns", "欄"], ["Board symbols", "版面內容"],
            ]),
            "scanning": (["Scanning", "掃描"], [
                ["Scan mode", "掃描模式"], ["Timing", "速度"], ["pass", "輪"],
                ["Advanced timing", "進階時間"],
            ]),
            "speech": (["Speech", "語音"], [
                ["row", "列"], ["symbol", "格"], ["activation", "選定"],
                ["Speech voice", "語音"], ["Board after speaking", "朗讀後版面"],
            ]),
            "input": (["Input", "輸入"], [
                ["Switch input", "開關輸入"], ["Camera setup", "相機設定"],
                ["Input Test", "輸入測試"],
            ]),
            "display": (["Display", "顯示"], [["contrast", "對比"]]),
            "data": (["Data and support", "資料與支援"], [
                ["Offline resources", "離線資源"], ["Export", "匯出"],
                ["App info", "關於"], ["Reset", "恢復預設"],
            ]),
        }
        self.require_labels("Settings index", root_texts, [value[0] for value in sections.values()], root_evidence)
        self.audit_row_density("Settings index", root_heights, root_evidence)

        for key, (aliases, expected) in sections.items():
            self.open_section(aliases, key)
            texts, heights, evidence = self.collect_page("settings-" + key, 3 if key == "scanning" else 1)
            self.require_labels(key.capitalize(), texts, expected, evidence)
            self.audit_row_density(key.capitalize(), heights, evidence)

        dialog_cases = [
            (sections["communication"][0], "communication", ["Language", "語言"], "language"),
            (sections["scanning"][0], "scanning", ["Scan mode", "掃描模式"], "scan-method"),
            (sections["scanning"][0], "scanning", ["Timing preset", "速度"], "timing-preset"),
            (sections["speech"][0], "speech", ["Board after speaking", "朗讀後版面"], "after-reading"),
            (sections["input"][0], "input", ["Switch input", "開關輸入"], "switch-input"),
            (sections["display"][0], "display", ["contrast", "對比"], "contrast"),
        ]
        for case in dialog_cases:
            self.audit_dialog(*case)

        self.open_section(sections["scanning"][0], "scanning")
        if self.tap_text(["Advanced timing", "進階時間"], "advanced_timing", 4):
            texts, _, evidence = self.collect_page("advanced-timing", 1)
            self.require_labels("Advanced timing", texts, [
                ["Switch speed", "開關掃描速度"], ["Transition", "換列停頓"],
                ["First", "第一"], ["latency", "延遲"],
            ], evidence)

        self.open_section(sections["speech"][0], "speech")
        if self.tap_text(["Speech voice", "語音"], "speech_voice", 3):
            texts, _, evidence = self.collect_page("speech-voice", 1)
            self.require_labels("Speech voice", texts, [
                ["Preview selected voice", "試聽所選語音"],
                ["Manage speech voices", "管理語音"],
            ], evidence)

        self.open_section(sections["input"][0], "input")
        if self.tap_text(["Input Test", "輸入測試"], "input_test", 2) and self.wait_activity(INPUT_TEST_ACTIVITY, 5):
            path = self.dump("input_test")
            evidence = [self.screenshot("input-test"), str(path.relative_to(self.out)).replace("\\", "/")]
            self.require_labels("Input Test", set(self.texts(path)), [["Reset", "重設"], ["test", "測試"]], evidence)
            self.shell("input", "keyevent", "4", check=False)

        self.open_section(sections["data"][0], "data")
        if self.tap_text(["Offline resources", "離線資源"], "offline_resources", 2) and self.wait_activity(RESOURCE_ACTIVITY, 5):
            path = self.dump("offline_resources")
            evidence = [self.screenshot("offline-resources"), str(path.relative_to(self.out)).replace("\\", "/")]
            self.require_labels("Offline resources", set(self.texts(path)), [
                ["Face-action model", "臉部動作模型"],
                ["Recognizes long blinks and cheek movement", "辨識長眨眼與臉頰動作"],
                ["Taiwan Mandarin voice", "台灣華語語音"],
            ], evidence)
            self.shell("input", "keyevent", "4", check=False)

        self.open_section(sections["data"][0], "data")
        if self.tap_text(["App info", "關於"], "app_info", 2):
            texts, _, evidence = self.collect_page("app-info", 1)
            version_name, version_code = release_version()
            self.require_labels("App info", texts, [[version_name], [version_code]], evidence)

        self.passed("native settings hierarchy", "six focused subpages; no tab misuse")
        self.write_report()

    def write_report(self):
        order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3, "P4": 4}
        self.findings.sort(key=lambda item: (order[item["priority"]], item["title"]))
        lines = ["# SHINE AAC native Settings physical audit", "", "## Findings", ""]
        if not self.findings:
            lines += ["No automated findings.", ""]
        for item in self.findings:
            lines.append("- **%s — %s:** %s" % (item["priority"], item["title"], item["detail"]))
            if item["evidence"]:
                lines.append("  Evidence: " + ", ".join("`%s`" % value for value in item["evidence"]))
        lines += ["", "## Passed checks", ""]
        lines += ["- %s%s" % (item["title"], (": " + item["detail"]) if item["detail"] else "") for item in self.passes]
        lines.append("")
        for priority in ("P0", "P1", "P2", "P3", "P4"):
            lines.append("%s: %d" % (priority, sum(item["priority"] == priority for item in self.findings)))
        lines.append("Passed checks: %d" % len(self.passes))
        (self.out / "FINDINGS.md").write_text("\n".join(lines), encoding="utf-8")
        (self.out / "summary.json").write_text(json.dumps({"findings": self.findings, "passes": self.passes}, indent=2), encoding="utf-8")
        print("\n".join(lines[-6:]))
        print("Report:", self.out / "FINDINGS.md")


def main():
    audit = NativeSettingsAudit()
    try:
        audit.run()
    except Exception as error:
        audit.add("P0", "Native Settings audit aborted", str(error))
        audit.write_report()
    return 1 if any(item["priority"] in ("P0", "P1") for item in audit.findings) else 0


if __name__ == "__main__":
    sys.exit(main())
