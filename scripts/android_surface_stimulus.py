"""ADB-driven Android SurfaceView presenter for the two-device optical rig.

The companion presenter implements the small IRIS/aria-trace phone-target HTTP
contract.  SHINE owns the renderer and atlas decoder; this module only transports
the resulting exact-size framebuffer to a second Android display and accepts a
paint acknowledgement from that display.
"""

import json
import re
import subprocess
import threading
import time
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from optical_stimulus import OpenCvStimulus, close_idle_presenter


PRESENTER_PACKAGE = "io.iris.phonetarget"
PRESENTER_COMPONENT = (
    "io.iris.phonetarget/io.iris.phonetarget.PhoneTargetActivity"
)
MINIMUM_CONTRACT_VERSION = 2


def parse_adb_devices(output):
    """Return authorized ADB devices without treating offline rows as usable."""
    devices = []
    for raw in (output or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("List of devices attached"):
            continue
        fields = line.split()
        if len(fields) < 2 or fields[1] != "device":
            continue
        metadata = {}
        for field in fields[2:]:
            if ":" in field:
                key, value = field.split(":", 1)
                metadata[key] = value
        devices.append({
            "serial": fields[0],
            "model": metadata.get("model", "unknown"),
            "product": metadata.get("product", "unknown"),
        })
    return devices


def resolve_device_roles(
    devices,
    presenter_versions,
    requested_mode="auto",
    dut_serial=None,
    presenter_serial=None,
):
    """Resolve roles conservatively; never guess between equally valid phones."""
    mode = str(requested_mode or "auto").strip().lower()
    if mode not in ("auto", "monitor", "android"):
        raise ValueError("presenter mode must be auto, monitor, or android")
    serials = [item["serial"] for item in devices]
    if not serials:
        raise ValueError("no authorized ADB device is connected")
    if dut_serial and dut_serial not in serials:
        raise ValueError("requested DUT is not an authorized ADB device: %s" % dut_serial)
    if presenter_serial and presenter_serial not in serials:
        raise ValueError(
            "requested presenter is not an authorized ADB device: %s"
            % presenter_serial
        )
    if dut_serial and presenter_serial and dut_serial == presenter_serial:
        raise ValueError("DUT and presenter must be different Android devices")

    compatible = sorted(
        serial for serial, version in (presenter_versions or {}).items()
        if serial in serials and int(version or 0) >= MINIMUM_CONTRACT_VERSION
    )
    if mode == "auto":
        if presenter_serial or len(compatible) == 1:
            mode = "android"
        elif len(serials) == 1:
            mode = "monitor"
        else:
            raise ValueError(
                "multiple ADB devices are connected and no unique compatible "
                "Android presenter was found; pass --dut-serial and "
                "--presenter-serial"
            )

    if mode == "monitor":
        if presenter_serial:
            raise ValueError("--presenter-serial requires the Android presenter")
        if not dut_serial:
            if len(serials) != 1:
                raise ValueError(
                    "monitor mode has multiple ADB devices; pass --dut-serial"
                )
            dut_serial = serials[0]
        return {"mode": "monitor", "dut_serial": dut_serial, "presenter_serial": None}

    if not presenter_serial:
        candidates = [serial for serial in compatible if serial != dut_serial]
        if len(candidates) != 1:
            raise ValueError(
                "Android presenter is ambiguous; pass --presenter-serial"
            )
        presenter_serial = candidates[0]
    if not dut_serial:
        candidates = [serial for serial in serials if serial != presenter_serial]
        if len(candidates) != 1:
            raise ValueError("DUT is ambiguous; pass --dut-serial")
        dut_serial = candidates[0]
    return {
        "mode": "android",
        "dut_serial": dut_serial,
        "presenter_serial": presenter_serial,
    }


def parse_wm_size(output):
    matches = re.findall(r"(?:Physical|Override) size:\s*(\d+)x(\d+)", output or "")
    if not matches:
        raise ValueError("could not read Android display size")
    width, height = matches[-1]
    return int(width), int(height)


def parse_package_version(output):
    match = re.search(r"\bversionCode=(\d+)", output or "")
    return int(match.group(1)) if match else 0


class _FrameStore:
    """Thread-safe revision store; versioned bytes prevent state/image races."""

    def __init__(self):
        self.lock = threading.Lock()
        self.condition = threading.Condition(self.lock)
        self.revision = 0
        self.mode = "black"
        self.token = "boot"
        self.label = "BOOT"
        self.issued_time_ns = time.monotonic_ns()
        self.images = OrderedDict()
        self.revisions = OrderedDict()
        self.telemetry = {}
        self.acknowledgements = []

    def publish(self, mode, token, label, image_png=None):
        with self.condition:
            self.revision += 1
            self.mode = mode
            self.token = token
            self.label = label
            self.issued_time_ns = time.monotonic_ns()
            if image_png is not None:
                self.images[self.revision] = image_png
            self.revisions[self.revision] = {
                "revision": self.revision,
                "mode": mode,
                "token": token,
                "label": label,
                "issued_time_ns": self.issued_time_ns,
            }
            while len(self.revisions) > 64:
                expired, _ = self.revisions.popitem(last=False)
                self.images.pop(expired, None)
            self.condition.notify_all()
            return self.revision

    def state(self):
        with self.lock:
            return {
                "revision": self.revision,
                "mode": self.mode,
                "token": self.token,
                "label": self.label,
                "issued_time_ns": self.issued_time_ns,
            }

    def image(self, revision):
        with self.lock:
            return self.images.get(revision)

    def revision_state(self, revision):
        with self.lock:
            value = self.revisions.get(revision)
            return dict(value) if value is not None else None


def _handler(owner):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, content_type, body):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urlsplit(self.path)
            if parsed.path == "/state.json":
                body = json.dumps(
                    owner._frames.state(), separators=(",", ":")
                ).encode("utf-8")
                self._send(200, "application/json", body)
                return
            if parsed.path == "/image.png":
                query = parse_qs(parsed.query)
                try:
                    revision = int((query.get("v") or ["0"])[0])
                except ValueError:
                    revision = 0
                body = owner._frames.image(revision)
                if body is None:
                    self._send(404, "text/plain", b"frame revision unavailable")
                else:
                    self._send(200, "image/png", body)
                return
            self._send(404, "text/plain", b"not found")

        def do_POST(self):
            if self.path not in ("/telemetry", "/ack"):
                self._send(404, "text/plain", b"not found")
                return
            try:
                length = min(int(self.headers.get("Content-Length", "0")), 65536)
                value = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(value, dict):
                    raise ValueError("JSON object required")
                value["server_receive_time_ns"] = time.monotonic_ns()
                if self.path == "/telemetry":
                    owner._receive_telemetry(value)
                else:
                    owner._receive_ack(value)
                self._send(204, "text/plain", b"")
            except Exception as error:
                self._send(400, "text/plain; charset=utf-8", str(error).encode("utf-8"))

        def log_message(self, _format, *_args):
            return

    return Handler


class AndroidSurfaceStimulus(OpenCvStimulus):
    """Render SHINE stimuli on a second Android device's native surface."""

    def __init__(
        self,
        root,
        media_root,
        adb,
        serial,
        display_size,
        apk_path=None,
    ):
        width, height = map(int, display_size)
        super().__init__(root, media_root, (0, 0, width, height))
        self.adb = str(adb)
        self.serial = str(serial)
        self.apk_path = Path(apk_path).resolve() if apk_path else None
        self._frames = _FrameStore()
        self._server = None
        self._server_thread = None
        self._server_port = None
        self._applied_tokens = set()
        self._playing_tokens = set()
        self._latest_telemetry = {}

    @property
    def url(self):
        return "android-surface://%s" % self.serial

    def fixture_identity(self):
        return {
            "kind": "android_native_surface",
            "serial": self.serial,
            "rect": list(self.desktop_rect),
            "contract_version": MINIMUM_CONTRACT_VERSION,
        }

    def _adb(self, *args, **kwargs):
        check = kwargs.pop("check", True)
        timeout = kwargs.pop("timeout", 30)
        if kwargs:
            raise TypeError("unexpected adb options")
        result = subprocess.run(
            [self.adb, "-s", self.serial] + list(args),
            cwd=str(self.root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
        )
        raw = result.stdout or b""
        output = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else raw
        if check and result.returncode != 0:
            raise RuntimeError("ADB presenter command failed: %s" % output.strip())
        return result.returncode, output

    def _installed_version(self):
        _, output = self._adb(
            "shell", "dumpsys", "package", PRESENTER_PACKAGE,
            check=False, timeout=20,
        )
        return parse_package_version(output)

    def _ensure_presenter(self):
        version = self._installed_version()
        if version >= MINIMUM_CONTRACT_VERSION:
            return version
        if self.apk_path is None or not self.apk_path.is_file():
            raise RuntimeError(
                "Android presenter %s contract v%d is required on %s; install the "
                "verified aria-trace/IRIS phone target or pass --presenter-apk"
                % (PRESENTER_PACKAGE, MINIMUM_CONTRACT_VERSION, self.serial)
            )
        self._adb("install", "-r", str(self.apk_path), timeout=120)
        version = self._installed_version()
        if version < MINIMUM_CONTRACT_VERSION:
            raise RuntimeError("installed Android presenter is not contract v2 compatible")
        return version

    def _launch_presenter(self):
        self._adb("shell", "input", "keyevent", "KEYCODE_WAKEUP", check=False)
        self._adb("shell", "wm", "dismiss-keyguard", check=False)
        self._adb("shell", "am", "force-stop", PRESENTER_PACKAGE, check=False)
        self._adb(
            "shell", "am", "start", "-W", "-n", PRESENTER_COMPONENT,
            "-a", "android.intent.action.VIEW",
            "-d", "http://127.0.0.1:%d/" % self._server_port,
            timeout=40,
        )

    def start(self):
        close_idle_presenter()
        self._ensure_presenter()
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), _handler(self))
        self._server.daemon_threads = True
        self._server_port = int(self._server.server_address[1])
        self._server_thread = threading.Thread(
            target=self._server.serve_forever,
            name="ShineAndroidPresenterHttp",
            daemon=True,
        )
        self._server_thread.start()
        self._adb(
            "reverse", "tcp:%d" % self._server_port, "tcp:%d" % self._server_port
        )
        self.thread = threading.Thread(
            target=self._run_android,
            name="ShineAndroidPresenterRenderer",
            daemon=True,
        )
        self.thread.start()
        try:
            self._launch_presenter()
            if not self.ready_event.wait(20.0):
                raise RuntimeError("Android presenter did not paint an acknowledged frame")
            if self.error:
                raise RuntimeError("Android presenter failed: %s" % self.error)
        except Exception:
            self.close()
            raise

    def close(self):
        self.stop_event.set()
        with self.condition:
            self.condition.notify_all()
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=5.0)
        try:
            self._adb("shell", "am", "force-stop", PRESENTER_PACKAGE, check=False)
            self._adb("shell", "input", "keyevent", "KEYCODE_SLEEP", check=False)
        except Exception:
            pass
        if self._server_port is not None:
            try:
                self._adb(
                    "reverse", "--remove", "tcp:%d" % self._server_port,
                    check=False,
                )
            except Exception:
                pass
        self._server_port = None
        server, self._server = self._server, None
        if server is not None:
            server.shutdown()
            server.server_close()
        if self._server_thread and self._server_thread is not threading.current_thread():
            self._server_thread.join(timeout=2.0)

    def reassert_window(self, rect=None, timeout=5.0):
        del timeout
        if rect is not None and tuple(map(int, rect)) != tuple(self.desktop_rect):
            return False
        return bool(
            self.thread and self.thread.is_alive() and not self.error
            and self._latest_telemetry.get("canonical_orientation_ready") is True
        )

    def suspend(self):
        token = self.set_state(mode="blank", label="THERMAL COOLDOWN")
        self.wait_event(token, "state_applied", 3.0)
        self._adb("shell", "input", "keyevent", "KEYCODE_SLEEP", check=False)

    def resume(self):
        self._adb("shell", "input", "keyevent", "KEYCODE_WAKEUP", check=False)
        self._adb("shell", "wm", "dismiss-keyguard", check=False)
        time.sleep(0.5)

    def _receive_telemetry(self, value):
        with self.condition:
            self._latest_telemetry = dict(value)
            self.condition.notify_all()

    def _receive_ack(self, value):
        emit_applied = False
        emit_playing = False
        applied_token = None
        with self.condition:
            revision = int(value.get("revision", -1))
            state = self._frames.revision_state(revision)
            canvas = (
                int(value.get("canvas_width", 0) or 0),
                int(value.get("canvas_height", 0) or 0),
            )
            expected = (int(self.desktop_rect[2]), int(self.desktop_rect[3]))
            compatible = (
                value.get("painted") is True
                and int(value.get("target_contract_version", 0) or 0)
                    >= MINIMUM_CONTRACT_VERSION
                and value.get("canonical_orientation_ready") is True
                and int(value.get("display_rotation", -1)) == 0
                and canvas == expected
                and state is not None
                and str(value.get("token", "")) == str(state["token"])
            )
            if compatible:
                token = str(value["token"])
                if token not in self._applied_tokens:
                    self._applied_tokens.add(token)
                    applied_token = token
                    emit_applied = True
                    current_mode = self.state.get("mode")
                    if current_mode == "video" and token not in self._playing_tokens:
                        self._playing_tokens.add(token)
                        emit_playing = True
                self.ready_event.set()
            self.condition.notify_all()
        with self._frames.lock:
            self._frames.acknowledgements.append(dict(value))
            del self._frames.acknowledgements[:-256]
        if emit_applied:
            self._emit(applied_token, "state_applied", viewport=list(expected))
        if emit_playing:
            self._emit(applied_token, "playing")

    def _encode_png(self, frame):
        ok, encoded = self.cv2.imencode(
            ".png", frame, [self.cv2.IMWRITE_PNG_COMPRESSION, 1]
        )
        if not ok:
            raise RuntimeError("could not encode Android presenter frame")
        return encoded.tobytes()

    def _publish_frame(self, frame, state):
        mode = "black" if not self.numpy.any(frame) else "image"
        encoded = None if mode == "black" else self._encode_png(frame)
        self._frames.publish(
            mode, state["token"], state.get("label", "SHINE optical target"), encoded
        )

    def _wait_for_surface(self, timeout=15.0):
        deadline = time.time() + timeout
        expected = (int(self.desktop_rect[2]), int(self.desktop_rect[3]))
        with self.condition:
            while time.time() < deadline and not self.stop_event.is_set():
                telemetry = self._latest_telemetry
                canvas = (
                    int(telemetry.get("canvas_width", 0) or 0),
                    int(telemetry.get("canvas_height", 0) or 0),
                )
                if (
                    int(telemetry.get("target_contract_version", 0) or 0)
                        >= MINIMUM_CONTRACT_VERSION
                    and telemetry.get("canonical_orientation_ready") is True
                    and int(telemetry.get("display_rotation", -1)) == 0
                    and canvas == expected
                ):
                    return
                self.condition.wait(max(0.01, min(0.1, deadline - time.time())))
        raise RuntimeError(
            "presenter surface did not reach canonical %dx%d orientation" % expected
        )

    def _run_android(self):
        active_token = None
        prepared = None
        ended_sent = False
        last_publish = 0.0
        try:
            self._wait_for_surface()
            while not self.stop_event.is_set():
                with self.condition:
                    state = dict(self.state)
                token = state["token"]
                if token != active_token:
                    if prepared and prepared.get("capture"):
                        prepared["capture"].release()
                    prepared = self._prepare(state)
                    active_token = token
                    ended_sent = False
                    last_publish = 0.0

                frame, ended = self._render_state(state, prepared)
                dynamic = state.get("mode") in ("video", "sequence")
                now = time.perf_counter()
                if last_publish == 0.0 or (dynamic and now - last_publish >= 0.04):
                    self._publish_frame(frame, state)
                    last_publish = now
                if ended and not ended_sent:
                    metrics = {}
                    if state.get("mode") == "video":
                        metrics = {
                            "playback_s": round(now - prepared["started"], 4),
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
            with self.condition:
                self.condition.notify_all()
        finally:
            if prepared and prepared.get("capture"):
                prepared["capture"].release()
