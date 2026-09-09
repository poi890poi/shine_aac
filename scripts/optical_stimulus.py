"""Pixel-controlled OpenCV presenter for the monitor-to-phone optical rig."""

import ctypes
import argparse
import json
import math
import os
import subprocess
import sys
import threading
import time
from pathlib import Path


WINDOW_TITLE = "SHINE AAC Optical Rig"
IDLE_WINDOW_TITLE = "SHINE AAC Optical Rig - Idle"
PRESENTER_REGISTRY = Path(".tmp/optical-rig-presenter.json")
IDLE_MUTEX_NAME = "Local\\ShineAacOpticalIdlePresenter"
IDLE_STOP_EVENT_NAME = "Local\\ShineAacOpticalIdleStop"
TOPMOST_REFRESH_SECONDS = 0.5


class WindowRect(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


def video_frames_due(now, deadline, period, maximum=60):
    """Return frames to advance so playback follows wall time instead of drifting."""
    if period <= 0:
        return 1
    late = max(0.0, now - deadline)
    return max(1, min(int(maximum), int(late / period) + 1))


def presenter_registry_path(root):
    return Path(root) / PRESENTER_REGISTRY


def register_presenter(root, mode, title):
    """Publish the exact owner PID so emergency cleanup does not depend on a window title."""
    path = presenter_registry_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "pid": os.getpid(),
        "registered_at": time.time(),
        "mode": mode,
        "title": title,
        "executable": str(Path(sys.executable).resolve()),
    }
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.replace(str(temporary), str(path))


def unregister_presenter(root):
    """Remove the registry only when this process still owns it."""
    path = presenter_registry_path(root)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if int(payload.get("pid", -1)) == os.getpid():
            path.unlink()
    except (OSError, ValueError, TypeError):
        pass


def windows_user32():
    """Return user32 with pointer-safe signatures for 64-bit window handles."""
    user32 = ctypes.windll.user32
    handle = ctypes.c_void_p
    boolean = ctypes.c_int
    unsigned = ctypes.c_uint32
    user32.FindWindowW.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
    user32.FindWindowW.restype = handle
    user32.SetWindowPos.argtypes = [
        handle, handle, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, unsigned
    ]
    user32.SetWindowPos.restype = boolean
    user32.IsWindow.argtypes = [handle]
    user32.IsWindow.restype = boolean
    user32.IsWindowVisible.argtypes = [handle]
    user32.IsWindowVisible.restype = boolean
    user32.IsIconic.argtypes = [handle]
    user32.IsIconic.restype = boolean
    user32.GetWindow.argtypes = [handle, unsigned]
    user32.GetWindow.restype = handle
    user32.GetWindowRect.argtypes = [handle, ctypes.POINTER(WindowRect)]
    user32.GetWindowRect.restype = boolean
    user32.PostMessageW.argtypes = [handle, unsigned, handle, handle]
    user32.PostMessageW.restype = boolean
    user32.GetWindowLongW.argtypes = [handle, ctypes.c_int]
    user32.GetWindowLongW.restype = ctypes.c_long
    user32.SetWindowLongW.argtypes = [handle, ctypes.c_int, ctypes.c_long]
    user32.SetWindowLongW.restype = ctypes.c_long
    user32.BringWindowToTop.argtypes = [handle]
    user32.BringWindowToTop.restype = boolean
    user32.SetForegroundWindow.argtypes = [handle]
    user32.SetForegroundWindow.restype = boolean
    user32.GetSystemMetrics.argtypes = [ctypes.c_int]
    user32.GetSystemMetrics.restype = ctypes.c_int
    user32.OpenInputDesktop.argtypes = [
        ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32
    ]
    user32.OpenInputDesktop.restype = handle
    user32.SetThreadDesktop.argtypes = [handle]
    user32.SetThreadDesktop.restype = boolean
    user32.CloseDesktop.argtypes = [handle]
    user32.CloseDesktop.restype = boolean
    return user32


def attach_current_thread_to_input_desktop():
    """Bind a presenter thread to the desktop the unlocked user can see.

    A process started while Windows is locked or while the desktop is changing can
    retain a different `Default` desktop. Its HWND remains valid and accepts
    topmost calls, but the physical monitor continues to show another window.
    OpenCV creates its native window on the calling thread, so attach that thread
    before HighGUI creates any HWND and retain the desktop handle for its lifetime.
    """
    if os.name != "nt":
        return None
    user32 = windows_user32()
    DESKTOP_READOBJECTS = 0x0001
    DESKTOP_CREATEWINDOW = 0x0002
    DESKTOP_WRITEOBJECTS = 0x0080
    access = (
        DESKTOP_READOBJECTS |
        DESKTOP_CREATEWINDOW |
        DESKTOP_WRITEOBJECTS
    )
    desktop = user32.OpenInputDesktop(0, False, access)
    if not desktop:
        raise RuntimeError("Windows input desktop is unavailable")
    if not user32.SetThreadDesktop(desktop):
        user32.CloseDesktop(desktop)
        raise RuntimeError("presenter thread could not attach to Windows input desktop")
    return desktop


def _native_window_rect(user32, hwnd):
    rect = WindowRect()
    if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return None
    return (rect.left, rect.top, rect.right, rect.bottom)


def _rectangles_overlap(first, second):
    return not (
        first[2] <= second[0] or second[2] <= first[0] or
        first[3] <= second[1] or second[3] <= first[1]
    )


def presenter_window_needs_raise(hwnd, rect=None):
    """Return true only when the persistent presenter is not fully on top."""
    if os.name != "nt":
        return False
    user32 = windows_user32()
    if (
        not hwnd or not user32.IsWindow(hwnd) or
        not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd)
    ):
        return True
    current = _native_window_rect(user32, hwnd)
    if current is None:
        return True
    if rect is not None:
        x, y, width, height = (int(value) for value in rect)
        if current != (x, y, x + width, y + height):
            return True
    WS_EX_TOPMOST = 0x00000008
    if not (int(user32.GetWindowLongW(hwnd, -20)) & WS_EX_TOPMOST):
        return True

    # GW_HWNDPREV walks windows above this HWND in z-order. Only a visible,
    # non-minimized window that overlaps the presenter can hide camera pixels.
    above = user32.GetWindow(hwnd, 3)
    visited = set()
    while above and int(above) not in visited:
        visited.add(int(above))
        if user32.IsWindowVisible(above) and not user32.IsIconic(above):
            other = _native_window_rect(user32, above)
            if other and _rectangles_overlap(current, other):
                return True
        above = user32.GetWindow(above, 3)
    return False


def set_window_topmost(hwnd, enabled):
    """Change only the rig window's z-order, preserving its pixel geometry."""
    if os.name != "nt" or not hwnd:
        return False
    if enabled and not presenter_window_needs_raise(hwnd):
        return True
    user32 = windows_user32()
    insert_after = -1 if enabled else -2  # HWND_TOPMOST / HWND_NOTOPMOST
    flags = 0x0001 | 0x0002 | 0x0010  # NOSIZE | NOMOVE | NOACTIVATE
    positioned = bool(user32.SetWindowPos(
        hwnd, ctypes.c_void_p(insert_after), 0, 0, 0, 0, flags
    ))
    if enabled and positioned:
        user32.BringWindowToTop(hwnd)
    return positioned


def raise_presenter_window(hwnd, rect=None):
    """Raise/resize the native presenter from the thread that owns its desktop."""
    if os.name != "nt" or not hwnd:
        return os.name != "nt"
    if not presenter_window_needs_raise(hwnd, rect):
        return True
    user32 = windows_user32()
    if rect is None:
        x = y = width = height = 0
        flags = 0x0001 | 0x0002 | 0x0040  # NOSIZE | NOMOVE | SHOWWINDOW
    else:
        x, y, width, height = (int(value) for value in rect)
        flags = 0x0040  # SHOWWINDOW
    positioned = bool(user32.SetWindowPos(
        hwnd, ctypes.c_void_p(-1), x, y, width, height, flags
    ))
    if positioned:
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
    return positioned


def enable_per_monitor_dpi_awareness():
    """Make desktop geometry and the OpenCV framebuffer use physical pixels."""
    if os.name != "nt":
        return
    user32 = windows_user32()
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
    user32 = windows_user32()
    return (
        int(user32.GetSystemMetrics(76)),
        int(user32.GetSystemMetrics(77)),
        int(user32.GetSystemMetrics(78)),
        int(user32.GetSystemMetrics(79)),
    )


def windows_kernel32():
    """Return kernel32 with pointer-safe signatures for named rig primitives."""
    kernel32 = ctypes.windll.kernel32
    handle = ctypes.c_void_p
    dword = ctypes.c_uint32
    boolean = ctypes.c_int
    kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, boolean, ctypes.c_wchar_p]
    kernel32.CreateMutexW.restype = handle
    kernel32.OpenMutexW.argtypes = [dword, boolean, ctypes.c_wchar_p]
    kernel32.OpenMutexW.restype = handle
    kernel32.CreateEventW.argtypes = [ctypes.c_void_p, boolean, boolean, ctypes.c_wchar_p]
    kernel32.CreateEventW.restype = handle
    kernel32.OpenEventW.argtypes = [dword, boolean, ctypes.c_wchar_p]
    kernel32.OpenEventW.restype = handle
    kernel32.WaitForSingleObject.argtypes = [handle, dword]
    kernel32.WaitForSingleObject.restype = dword
    for name in ("SetEvent", "ResetEvent", "ReleaseMutex", "CloseHandle"):
        function = getattr(kernel32, name)
        function.argtypes = [handle]
        function.restype = boolean
    return kernel32


def close_idle_presenter():
    """Close only the rig-owned idle window, if one is already running."""
    if os.name != "nt":
        return
    user32 = windows_user32()
    kernel32 = windows_kernel32()
    mutex = kernel32.OpenMutexW(0x00100001, False, IDLE_MUTEX_NAME)
    stop_event = kernel32.OpenEventW(0x0002, False, IDLE_STOP_EVENT_NAME)
    if stop_event:
        kernel32.SetEvent(stop_event)
        kernel32.CloseHandle(stop_event)
    hwnd = user32.FindWindowW(None, IDLE_WINDOW_TITLE)
    if hwnd:
        user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
        deadline = time.time() + 3.0
        while time.time() < deadline and user32.IsWindow(hwnd):
            time.sleep(0.05)
    if mutex:
        result = kernel32.WaitForSingleObject(mutex, 3000)
        if result in (0, 0x00000080):  # WAIT_OBJECT_0 / WAIT_ABANDONED
            kernel32.ReleaseMutex(mutex)
        kernel32.CloseHandle(mutex)


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
    user32 = windows_user32()
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
    user32.SetWindowPos(
        hwnd, ctypes.c_void_p(-1), vx, vy, width, height, 0x0040 | 0x0020
    )
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
    def __init__(self, root, media_root, desktop_rect):
        self.root = Path(root)
        self.media_root = Path(media_root)
        self.desktop_rect = tuple(desktop_rect)
        self.cv2, self.numpy = load_opencv(root)
        self.state = {"mode": "standby", "label": "BOOT", "token": "boot"}
        self.events = []
        self.requests = []
        self.condition = threading.Condition()
        self.stop_event = threading.Event()
        self.ready_event = threading.Event()
        self.thread = None
        self.error = None
        self.hwnd = None
        self.topmost = True
        self._next_topmost_refresh = 0.0
        self.operator_abort = False
        self._token_counter = 0
        self._window_request_counter = 0
        self.media_rotation_degrees = 0.0
        self._window_requests = []

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

    def reassert_window(self, rect=None, timeout=5.0):
        """Ask the input-desktop presenter thread to raise its own HWND."""
        if os.name != "nt":
            return True
        deadline = time.time() + timeout
        with self.condition:
            self._window_request_counter += 1
            request = {
                "id": self._window_request_counter,
                "rect": tuple(rect) if rect is not None else None,
                "result": None,
            }
            self._window_requests.append(request)
            self.condition.notify_all()
            while request["result"] is None and time.time() < deadline:
                if self.error or self.stop_event.is_set():
                    break
                self.condition.wait(max(0.01, min(0.1, deadline - time.time())))
            return bool(request["result"])

    def _apply_window_requests(self):
        with self.condition:
            requests = list(self._window_requests)
            self._window_requests.clear()
        for request in requests:
            try:
                result = raise_presenter_window(self.hwnd, request["rect"])
            except Exception:
                result = False
            with self.condition:
                request["result"] = bool(result)
                self.condition.notify_all()

    def set_state(self, **state):
        if self.operator_abort:
            raise RuntimeError("optical rig stopped by operator")
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
                if self.operator_abort:
                    raise RuntimeError("optical rig stopped by operator")
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
        else:
            raise ValueError(
                "optical release stimuli must come from the verified open-data media cache: %s"
                % value
            )
        candidate = (base / relative).resolve()
        candidate.relative_to(base.resolve())
        return candidate

    def _fullscreen_window(self):
        self.hwnd = _make_fullscreen_window(self.cv2, WINDOW_TITLE, self.desktop_rect)
        register_presenter(self.root, "active", WINDOW_TITLE)

    def _abort_from_operator(self, reason):
        self.operator_abort = True
        self.error = RuntimeError(reason)
        self.stop_event.set()
        with self.condition:
            self.condition.notify_all()
        print("\n[optical rig] %s" % reason, flush=True)

    def _handle_operator_key(self, key):
        key = key & 0xFF
        if key == 27:
            self._abort_from_operator("operator pressed Esc; test aborted and window closed")
            return
        if key in (ord("t"), ord("T")):
            self.topmost = not self.topmost
            if set_window_topmost(self.hwnd, self.topmost):
                self._next_topmost_refresh = 0.0
                state = "enabled" if self.topmost else "disabled"
                print("\n[optical rig] always-on-top %s (press T to toggle)" % state, flush=True)
            else:
                self.topmost = not self.topmost
                print("\n[optical rig] could not change always-on-top", flush=True)

    def _refresh_topmost(self, now=None, force=False):
        """Keep the active stimulus ahead of other topmost apps without taking focus."""
        if not self.topmost or not self.hwnd:
            return False
        now = time.monotonic() if now is None else now
        if not force and now < self._next_topmost_refresh:
            return False
        refreshed = set_window_topmost(self.hwnd, True)
        self._next_topmost_refresh = now + TOPMOST_REFRESH_SECONDS
        return refreshed

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

    def set_media_rotation(self, degrees):
        """Counter-clockwise content rotation; atlas/canvas coordinates stay fixed."""
        degrees = float(degrees)
        if not math.isfinite(degrees):
            raise ValueError("media rotation must be finite")
        self.media_rotation_degrees = (degrees + 180.0) % 360.0 - 180.0

    def _composite_intrinsic(self, canvas, frame, center, mirror=False, scale=1.0):
        if frame is None:
            return canvas
        if mirror:
            frame = self.cv2.flip(frame, 1)
        rotation = getattr(self, "media_rotation_degrees", 0.0)
        if abs(rotation) > 0.001:
            height, width = frame.shape[:2]
            matrix = self.cv2.getRotationMatrix2D(((width - 1) / 2.0, (height - 1) / 2.0), rotation, 1.0)
            cosine, sine = abs(matrix[0, 0]), abs(matrix[0, 1])
            rotated_width = int(math.ceil(width * cosine + height * sine - 1e-9))
            rotated_height = int(math.ceil(height * cosine + width * sine - 1e-9))
            matrix[0, 2] += (rotated_width - width) / 2.0
            matrix[1, 2] += (rotated_height - height) / 2.0
            frame = self.cv2.warpAffine(frame, matrix, (rotated_width, rotated_height),
                flags=self.cv2.INTER_LINEAR, borderMode=self.cv2.BORDER_CONSTANT)
        scale = max(0.1, min(2.0, float(scale)))
        if abs(scale - 1.0) > 0.001:
            height, width = frame.shape[:2]
            frame = self.cv2.resize(
                frame,
                (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
                interpolation=self.cv2.INTER_AREA if scale < 1.0 else self.cv2.INTER_LINEAR,
            )
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
        if mode == "standby":
            _, _, width, height = self.desktop_rect
            return {"frame": render_idle_cue(self.cv2, self.numpy, width, height)}
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
            rate = max(0.01, float(state.get("rate", 1.0)))
            now = time.perf_counter()
            end = state.get("end")
            return {
                "capture": capture,
                "fps": fps,
                "period": 1.0 / (fps * rate),
                "next": now,
                "started": now,
                "frame": None,
                "ended": False,
                "end": max(start, float(end)) if end is not None else None,
                "decoded_frames": 0,
                "dropped_frames": 0,
                "max_late_ms": 0.0,
            }
        return {}

    def _render_state(self, state, prepared):
        mode = state.get("mode", "blank")
        if mode == "standby":
            return prepared["frame"], False
        if mode == "atlas":
            return prepared["frame"], False
        canvas = self._background(state)
        if mode == "blank":
            return canvas, False
        if mode == "video_still":
            return self._composite_intrinsic(
                canvas, prepared["frame"], state.get("center"),
                scale=state.get("scale", 1.0)
            ), False
        if mode == "sequence":
            items = state.get("frames") or []
            now = time.perf_counter()
            if prepared["index"] >= len(items):
                if state.get("loop") and items:
                    prepared["index"] = 0
                    prepared["deadline"] = now
                else:
                    return self._composite_intrinsic(
                        canvas, prepared.get("frame"), state.get("center"),
                        bool(state.get("mirror", False)), state.get("scale", 1.0)
                    ), True
            if now >= prepared["deadline"]:
                item = items[prepared["index"]]
                prepared["frame"] = self.cv2.imread(str(self._resolve(item.get("url"))), self.cv2.IMREAD_COLOR)
                if prepared["frame"] is None:
                    raise ValueError("OpenCV could not decode sequence frame")
                prepared["index"] += 1
                prepared["deadline"] = now + max(0.03, float(item.get("ms", 100)) / 1000.0)
            return self._composite_intrinsic(
                canvas, prepared.get("frame"), state.get("center"),
                bool(state.get("mirror", False)), state.get("scale", 1.0)
            ), False
        if mode == "video":
            now = time.perf_counter()
            if now >= prepared["next"] and not prepared["ended"]:
                prepared["max_late_ms"] = max(
                    prepared["max_late_ms"], (now - prepared["next"]) * 1000.0
                )
                due = video_frames_due(now, prepared["next"], prepared["period"])
                for _ in range(due - 1):
                    if (
                        prepared.get("end") is not None and
                        prepared["capture"].get(self.cv2.CAP_PROP_POS_MSEC) / 1000.0 >= prepared["end"]
                    ):
                        prepared["ended"] = True
                        break
                    if not prepared["capture"].grab():
                        prepared["ended"] = True
                        break
                    prepared["dropped_frames"] += 1
                if not prepared["ended"]:
                    if (
                        prepared.get("end") is not None and
                        prepared["capture"].get(self.cv2.CAP_PROP_POS_MSEC) / 1000.0 >= prepared["end"]
                    ):
                        prepared["ended"] = True
                        ok, frame = False, None
                    else:
                        ok, frame = prepared["capture"].read()
                    if ok:
                        prepared["frame"] = frame
                        prepared["decoded_frames"] += 1
                    elif state.get("loop") and prepared.get("end") is None:
                        prepared["capture"].set(self.cv2.CAP_PROP_POS_FRAMES, 0)
                    else:
                        prepared["ended"] = True
                prepared["next"] += due * prepared["period"]
            return self._composite_intrinsic(
                canvas, prepared.get("frame"), state.get("center"),
                scale=state.get("scale", 1.0)
            ), prepared["ended"]
        return canvas, False

    def _run(self):
        active_token = None
        prepared = None
        applied = False
        ended_sent = False
        input_desktop = None
        try:
            input_desktop = attach_current_thread_to_input_desktop()
            self._fullscreen_window()
            print(
                "[optical rig] window controls: Esc closes/aborts; T toggles always-on-top; "
                "optical-rig-window.bat works from another terminal",
                flush=True,
            )
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
                self._apply_window_requests()
                self._refresh_topmost(force=not applied)
                key = self.cv2.waitKey(1)
                if key >= 0:
                    self._handle_operator_key(key)
                if self.stop_event.is_set():
                    break
                if os.name == "nt" and self.hwnd and not windows_user32().IsWindow(self.hwnd):
                    self._abort_from_operator("operator closed the rig window; test aborted")
                    break
                if not applied:
                    self._emit(token, "state_applied", viewport=[frame.shape[1], frame.shape[0]])
                    if state.get("mode") == "video":
                        self._emit(token, "playing")
                    applied = True
                if ended and not ended_sent:
                    metrics = {}
                    if state.get("mode") == "video":
                        metrics = {
                            "playback_s": round(time.perf_counter() - prepared["started"], 4),
                            "decoded_frames": prepared["decoded_frames"],
                            "dropped_frames": prepared["dropped_frames"],
                            "max_late_ms": round(prepared["max_late_ms"], 3),
                        }
                    self._emit(token, "ended", **metrics)
                    ended_sent = True
                time.sleep(0.004)
        except Exception as error:
            self.error = error
            self.ready_event.set()
        finally:
            with self.condition:
                for request in self._window_requests:
                    request["result"] = False
                self._window_requests.clear()
                self.condition.notify_all()
            unregister_presenter(self.root)
            if prepared and prepared.get("capture"):
                prepared["capture"].release()
            try:
                self.cv2.destroyWindow(WINDOW_TITLE)
                self.cv2.waitKey(1)
            except Exception:
                pass
            if input_desktop and os.name == "nt":
                try:
                    windows_user32().CloseDesktop(input_desktop)
                except Exception:
                    pass


def render_idle_cue(cv2, numpy, width, height):
    """Render a low-contrast cue repeated densely enough for a camera crop."""
    canvas = numpy.empty((height, width, 3), dtype=numpy.uint8)
    canvas[:] = (24, 21, 18)
    label = "SHINE  |  standby"
    scale = 0.48
    thickness = 1
    size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    step_x = max(220, size[0] + 56)
    step_y = 150
    for row, y in enumerate(range(54, height + step_y, step_y)):
        offset = -(step_x // 2) if row % 2 else 18
        for x in range(offset, width + step_x, step_x):
            cv2.putText(
                canvas, label, (x + 22, y), cv2.FONT_HERSHEY_SIMPLEX,
                scale, (68, 63, 56), thickness, cv2.LINE_AA
            )
            cv2.circle(
                canvas, (x + 8, y - max(3, size[1] // 3)), 4,
                (84, 78, 68), -1
            )
    return canvas


def run_idle_presenter(root):
    """Own the monitor while idle, with one dim identifiable standby window."""
    enable_per_monitor_dpi_awareness()
    kernel32 = windows_kernel32() if os.name == "nt" else None
    mutex = kernel32.CreateMutexW(None, True, IDLE_MUTEX_NAME) if kernel32 else None
    if mutex and kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        kernel32.CloseHandle(mutex)
        return
    stop_event = kernel32.CreateEventW(None, True, False, IDLE_STOP_EVENT_NAME) if kernel32 else None
    if stop_event:
        kernel32.ResetEvent(stop_event)
    cv2, numpy = load_opencv(root)
    rect = virtual_desktop_rect()
    _, _, width, height = rect
    standby = render_idle_cue(cv2, numpy, width, height)
    input_desktop = attach_current_thread_to_input_desktop()
    hwnd = _make_fullscreen_window(cv2, IDLE_WINDOW_TITLE, rect)
    set_window_topmost(hwnd, False)
    register_presenter(root, "idle", IDLE_WINDOW_TITLE)
    topmost = False
    try:
        print(
            "[optical rig idle] Esc closes; T toggles always-on-top; "
            "optical-rig-window.bat works from another terminal",
            flush=True,
        )
        while True:
            cv2.imshow(IDLE_WINDOW_TITLE, standby)
            key = cv2.waitKey(100)
            if key == 27:
                break
            if key >= 0 and (key & 0xFF) in (ord("t"), ord("T")):
                topmost = not topmost
                set_window_topmost(hwnd, topmost)
                print(
                    "[optical rig idle] always-on-top %s" %
                    ("enabled" if topmost else "disabled"),
                    flush=True,
                )
            if os.name == "nt" and hwnd and not windows_user32().IsWindow(hwnd):
                break
            if stop_event and kernel32.WaitForSingleObject(stop_event, 0) == 0:
                break
            try:
                if cv2.getWindowProperty(IDLE_WINDOW_TITLE, cv2.WND_PROP_VISIBLE) < 1:
                    break
            except Exception:
                break
    finally:
        unregister_presenter(root)
        try:
            cv2.destroyWindow(IDLE_WINDOW_TITLE)
            cv2.waitKey(1)
        except Exception:
            pass
        if input_desktop and os.name == "nt":
            try:
                windows_user32().CloseDesktop(input_desktop)
            except Exception:
                pass
        if stop_event:
            kernel32.CloseHandle(stop_event)
        if mutex:
            kernel32.ReleaseMutex(mutex)
            kernel32.CloseHandle(mutex)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--idle", action="store_true", help="show the rig's dim standby framebuffer")
    args = parser.parse_args()
    if not args.idle:
        parser.error("only standalone --idle mode is supported")
    run_idle_presenter(Path(__file__).resolve().parent.parent)


if __name__ == "__main__":
    main()
