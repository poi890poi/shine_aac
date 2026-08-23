"""Pixel-controlled OpenCV presenter for the monitor-to-phone optical rig."""

import ctypes
import argparse
import math
import os
import subprocess
import sys
import threading
import time
from pathlib import Path


WINDOW_TITLE = "SHINE AAC Optical Rig"
IDLE_WINDOW_TITLE = "SHINE AAC Optical Rig - Idle"


def enable_per_monitor_dpi_awareness():
    """Make desktop geometry and the OpenCV framebuffer use physical pixels."""
    if os.name != "nt":
        return
    user32 = ctypes.windll.user32
    try:
        user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
    except Exception:
        try:
            user32.SetProcessDPIAware()
        except Exception:
            pass


def virtual_desktop_rect():
    if os.name != "nt":
        raise RuntimeError("The physical monitor presenter currently requires Windows")
    user32 = ctypes.windll.user32
    return (
        int(user32.GetSystemMetrics(76)),
        int(user32.GetSystemMetrics(77)),
        int(user32.GetSystemMetrics(78)),
        int(user32.GetSystemMetrics(79)),
    )


def close_idle_presenter():
    """Close only the rig-owned idle window, if one is already running."""
    if os.name != "nt":
        return
    user32 = ctypes.windll.user32
    hwnd = user32.FindWindowW(None, IDLE_WINDOW_TITLE)
    if hwnd:
        user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
        deadline = time.time() + 3.0
        while time.time() < deadline and user32.IsWindow(hwnd):
            time.sleep(0.05)


def launch_idle_presenter(root):
    """Leave a detached, pixel-black rig window after the test process exits."""
    if os.name != "nt":
        return False
    close_idle_presenter()
    command = [sys.executable, str(Path(root) / "scripts" / "optical_stimulus.py"), "--idle"]
    flags = getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
    flags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
    subprocess.Popen(
        command,
        cwd=str(root),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=flags,
    )
    return True


def _make_fullscreen_window(cv2, title, desktop_rect):
    vx, vy, width, height = desktop_rect
    cv2.namedWindow(title, cv2.WINDOW_NORMAL)
    cv2.moveWindow(title, vx, vy)
    cv2.resizeWindow(title, width, height)
    if os.name != "nt":
        return None
    user32 = ctypes.windll.user32
    deadline = time.time() + 5.0
    hwnd = None
    while time.time() < deadline and not hwnd:
        hwnd = user32.FindWindowW(None, title)
        if not hwnd:
            cv2.waitKey(1)
            time.sleep(0.02)
    if not hwnd:
        raise RuntimeError("native OpenCV window handle was not found")
    style = user32.GetWindowLongW(hwnd, -16)
    style &= ~(0x00C00000 | 0x00040000 | 0x00020000 | 0x00010000 | 0x00080000)
    user32.SetWindowLongW(hwnd, -16, style)
    user32.SetWindowPos(hwnd, -1, vx, vy, width, height, 0x0040 | 0x0020)
    user32.SetForegroundWindow(hwnd)
    return hwnd


def load_opencv(root):
    dependency = Path(root) / ".optical-rig-python"
    if dependency.exists() and str(dependency) not in sys.path:
        sys.path.insert(0, str(dependency))
    try:
        import cv2
        import numpy
    except ImportError as error:
        raise RuntimeError(
            "OpenCV is missing. Run optical-rig-test.bat --setup-opencv once."
        ) from error
    return cv2, numpy


def atlas_tag_size(width, height):
    """Fit the 4-bit column/3-bit row payload over the full framebuffer."""
    minimum = max(128, int(math.ceil(width / 16.0)), int(math.ceil(height / 8.0)))
    return int(math.ceil(minimum / 16.0) * 16)


def _tag_bits(column, row):
    payload = [((column >> bit) & 1) for bit in range(4)]
    payload += [((row >> bit) & 1) for bit in range(3)]
    repeated = payload * 3
    bits = [[0] * 5 for _ in range(5)]
    bits[0][0] = 1
    index = 0
    for y in range(5):
        for x in range(5):
            if x in (0, 4) and y in (0, 4):
                continue
            bits[y][x] = repeated[index]
            index += 1
    return bits


def render_atlas(numpy, width, height):
    """Render tags through every edge pixel, including clipped edge tiles."""
    image = numpy.zeros((height, width, 3), dtype=numpy.uint8)
    tag = atlas_tag_size(width, height)
    gutter = max(6, int(round(tag * 6.0 / 128.0)))
    frame = max(8, int(round(tag * 8.0 / 128.0)))
    quiet = max(8, int(round(tag * 8.0 / 128.0)))
    columns = int(math.ceil(width / float(tag)))
    rows = int(math.ceil(height / float(tag)))
    if columns > 16 or rows > 8:
        raise ValueError("atlas payload cannot address %dx%d tiles" % (columns, rows))

    def fill(x0, y0, x1, y1, value):
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(width, x1), min(height, y1)
        if x1 > x0 and y1 > y0:
            image[y0:y1, x0:x1] = value

    for row in range(rows):
        for column in range(columns):
            x, y = column * tag, row * tag
            outer = tag - gutter * 2
            fill(x + gutter, y + gutter, x + gutter + outer, y + gutter + outer, 255)
            fill(
                x + gutter + frame,
                y + gutter + frame,
                x + gutter + outer - frame,
                y + gutter + outer - frame,
                0,
            )
            start = gutter + frame + quiet
            payload_size = tag - 2 * start
            cell = payload_size / 5.0
            bits = _tag_bits(column, row)
            for matrix_y in range(5):
                for matrix_x in range(5):
                    if not bits[matrix_y][matrix_x]:
                        continue
                    inset = max(1, int(round(cell * 0.12)))
                    left = int(round(x + start + matrix_x * cell)) + inset
                    top = int(round(y + start + matrix_y * cell)) + inset
                    right = int(round(x + start + (matrix_x + 1) * cell)) - inset
                    bottom = int(round(y + start + (matrix_y + 1) * cell)) - inset
                    fill(left, top, right, bottom, 255)
    return image


class OpenCvStimulus:
    def __init__(self, root, media_root, local_root, desktop_rect):
        self.root = Path(root)
        self.media_root = Path(media_root)
        self.local_root = Path(local_root)
        self.desktop_rect = tuple(desktop_rect)
        self.cv2, self.numpy = load_opencv(root)
        self.state = {"mode": "blank", "label": "BOOT", "token": "boot"}
        self.events = []
        self.requests = []
        self.condition = threading.Condition()
        self.stop_event = threading.Event()
        self.ready_event = threading.Event()
        self.thread = None
        self.error = None
        self._token_counter = 0

    @property
    def url(self):
        return "opencv://single-framebuffer"

    def start(self):
        close_idle_presenter()
        self.thread = threading.Thread(target=self._run, name="ShineOpticalOpenCV", daemon=True)
        self.thread.start()
        if not self.ready_event.wait(10.0):
            raise RuntimeError("OpenCV stimulus window did not become ready")
        if self.error:
            raise RuntimeError("OpenCV stimulus failed: %s" % self.error)

    def close(self):
        self.stop_event.set()
        with self.condition:
            self.condition.notify_all()
        if self.thread:
            self.thread.join(timeout=5.0)

    def set_state(self, **state):
        with self.condition:
            self._token_counter += 1
            state = dict(state)
            state["token"] = "%d-%d-%d" % (
                int(time.time() * 1000), os.getpid(), self._token_counter
            )
            self.state = state
            self.events = []
            self.condition.notify_all()
            return state["token"]

    def wait_event(self, token, event_type, timeout):
        deadline = time.time() + timeout
        with self.condition:
            while time.time() < deadline:
                for event in self.events:
                    if event.get("token") == token and event.get("type") == event_type:
                        return event
                self.condition.wait(max(0.01, min(0.1, deadline - time.time())))
        return None

    def _emit(self, token, event_type, **extra):
        with self.condition:
            event = {"token": token, "type": event_type, "t": time.time()}
            event.update(extra)
            self.events.append(event)
            self.events = self.events[-500:]
            self.condition.notify_all()

    def _resolve(self, url):
        value = str(url or "")
        if value.startswith("/media/"):
            base, relative = self.media_root, value[len("/media/"):]
        elif value.startswith("/local/"):
            base, relative = self.local_root, value[len("/local/"):]
        else:
            candidate = Path(value)
            if candidate.is_absolute():
                return candidate
            raise ValueError("unsupported stimulus path: %s" % value)
        candidate = (base / relative).resolve()
        candidate.relative_to(base.resolve())
        return candidate

    def _fullscreen_window(self):
        _make_fullscreen_window(self.cv2, WINDOW_TITLE, self.desktop_rect)

    def _background(self, state):
        value = state.get("background", "#000000").lstrip("#")
        if len(value) == 3:
            value = "".join(character * 2 for character in value)
        try:
            red, green, blue = int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)
        except Exception:
            red, green, blue = 0, 0, 0
        _, _, width, height = self.desktop_rect
        image = self.numpy.empty((height, width, 3), dtype=self.numpy.uint8)
        image[:] = (blue, green, red)
        return image

    def _composite_intrinsic(self, canvas, frame, center, mirror=False):
        if frame is None:
            return canvas
        if mirror:
            frame = self.cv2.flip(frame, 1)
        height, width = frame.shape[:2]
        canvas_height, canvas_width = canvas.shape[:2]
        center = center if isinstance(center, (list, tuple)) and len(center) == 2 else (canvas_width // 2, canvas_height // 2)
        left, top = int(round(center[0] - width / 2.0)), int(round(center[1] - height / 2.0))
        source_left, source_top = max(0, -left), max(0, -top)
        target_left, target_top = max(0, left), max(0, top)
        copy_width = min(width - source_left, canvas_width - target_left)
        copy_height = min(height - source_top, canvas_height - target_top)
        if copy_width > 0 and copy_height > 0:
            canvas[target_top:target_top + copy_height, target_left:target_left + copy_width] = frame[
                source_top:source_top + copy_height, source_left:source_left + copy_width
            ]
        return canvas

    def _read_video_frame(self, path, seconds):
        capture = self.cv2.VideoCapture(str(path))
        try:
            capture.set(self.cv2.CAP_PROP_POS_MSEC, max(0.0, float(seconds)) * 1000.0)
            ok, frame = capture.read()
            if not ok:
                raise ValueError("OpenCV could not decode %s at %.3fs" % (path, seconds))
            return frame
        finally:
            capture.release()

    def _prepare(self, state):
        mode = state.get("mode", "blank")
        if mode == "atlas":
            _, _, width, height = self.desktop_rect
            return {"frame": render_atlas(self.numpy, width, height)}
        if mode == "video_still":
            return {"frame": self._read_video_frame(self._resolve(state.get("url")), state.get("start", 0.0))}
        if mode == "sequence":
            return {"index": 0, "deadline": time.perf_counter(), "ended": False}
        if mode == "video":
            path = self._resolve(state.get("url"))
            capture = self.cv2.VideoCapture(str(path))
            if not capture.isOpened():
                raise ValueError("OpenCV could not open %s" % path)
            start = max(0.0, float(state.get("start", 0.0)))
            capture.set(self.cv2.CAP_PROP_POS_MSEC, start * 1000.0)
            fps = capture.get(self.cv2.CAP_PROP_FPS) or 30.0
            return {"capture": capture, "fps": fps, "next": time.perf_counter(), "frame": None, "ended": False}
        return {}

    def _render_state(self, state, prepared):
        mode = state.get("mode", "blank")
        if mode == "atlas":
            return prepared["frame"], False
        canvas = self._background(state)
        if mode == "blank":
            return canvas, False
        if mode == "video_still":
            return self._composite_intrinsic(canvas, prepared["frame"], state.get("center")), False
        if mode == "sequence":
            items = state.get("frames") or []
            now = time.perf_counter()
            if prepared["index"] >= len(items):
                return canvas, True
            if now >= prepared["deadline"]:
                item = items[prepared["index"]]
                prepared["frame"] = self.cv2.imread(str(self._resolve(item.get("url"))), self.cv2.IMREAD_COLOR)
                if prepared["frame"] is None:
                    raise ValueError("OpenCV could not decode sequence frame")
                prepared["index"] += 1
                prepared["deadline"] = now + max(0.03, float(item.get("ms", 100)) / 1000.0)
            return self._composite_intrinsic(
                canvas, prepared.get("frame"), state.get("center"), bool(state.get("mirror", False))
            ), False
        if mode == "video":
            now = time.perf_counter()
            if now >= prepared["next"] and not prepared["ended"]:
                ok, frame = prepared["capture"].read()
                if ok:
                    prepared["frame"] = frame
                    rate = max(0.01, float(state.get("rate", 1.0)))
                    prepared["next"] = now + 1.0 / (prepared["fps"] * rate)
                elif state.get("loop"):
                    prepared["capture"].set(self.cv2.CAP_PROP_POS_FRAMES, 0)
                else:
                    prepared["ended"] = True
            return self._composite_intrinsic(canvas, prepared.get("frame"), state.get("center")), prepared["ended"]
        return canvas, False

    def _run(self):
        active_token = None
        prepared = None
        applied = False
        ended_sent = False
        try:
            self._fullscreen_window()
            self.ready_event.set()
            while not self.stop_event.is_set():
                with self.condition:
                    state = dict(self.state)
                token = state["token"]
                if token != active_token:
                    if prepared and prepared.get("capture"):
                        prepared["capture"].release()
                    prepared = self._prepare(state)
                    active_token = token
                    applied = False
                    ended_sent = False
                frame, ended = self._render_state(state, prepared)
                self.cv2.imshow(WINDOW_TITLE, frame)
                self.cv2.waitKey(1)
                if not applied:
                    self._emit(token, "state_applied", viewport=[frame.shape[1], frame.shape[0]])
                    if state.get("mode") == "video":
                        self._emit(token, "playing")
                    applied = True
                if ended and not ended_sent:
                    self._emit(token, "ended")
                    ended_sent = True
                time.sleep(0.004)
        except Exception as error:
            self.error = error
            self.ready_event.set()
        finally:
            if prepared and prepared.get("capture"):
                prepared["capture"].release()
            try:
                self.cv2.destroyWindow(WINDOW_TITLE)
                self.cv2.waitKey(1)
            except Exception:
                pass


def run_idle_presenter(root):
    """Own the monitor while the test rig is idle, showing only black pixels."""
    enable_per_monitor_dpi_awareness()
    cv2, numpy = load_opencv(root)
    rect = virtual_desktop_rect()
    _, _, width, height = rect
    black = numpy.zeros((height, width, 3), dtype=numpy.uint8)
    hwnd = _make_fullscreen_window(cv2, IDLE_WINDOW_TITLE, rect)
    try:
        while True:
            cv2.imshow(IDLE_WINDOW_TITLE, black)
            key = cv2.waitKey(100)
            if key == 27:
                break
            if os.name == "nt" and hwnd and not ctypes.windll.user32.IsWindow(hwnd):
                break
            try:
                if cv2.getWindowProperty(IDLE_WINDOW_TITLE, cv2.WND_PROP_VISIBLE) < 1:
                    break
            except Exception:
                break
    finally:
        try:
            cv2.destroyWindow(IDLE_WINDOW_TITLE)
            cv2.waitKey(1)
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--idle", action="store_true", help="show the rig's idle black framebuffer")
    args = parser.parse_args()
    if not args.idle:
        parser.error("only standalone --idle mode is supported")
    run_idle_presenter(Path(__file__).resolve().parent.parent)


if __name__ == "__main__":
    main()
