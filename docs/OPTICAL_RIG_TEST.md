# Display-to-camera optical regression rig

The optical rig exercises SHINE AAC through the physical path that matters:

```text
exact-size presenter -> display pixels -> DUT camera -> SHINE detector
-> hold classifier -> normal AAC board state
```

The presenter can be the PC monitor or a second Android device. Fix the devices
in a comfortable position, aim the selected DUT camera at the presenter, and use
SHINE's normal Camera Setup zoom. The atlas measures the actual geometry; no
device-specific zoom is assumed or written as an app default.

The calibrated camera-up vector is mapped through the atlas homography into
presenter pixels to calculate content rotation. This compensates quarter-turns
and arbitrary camera/display angles, including mirrored front-camera previews,
without an additional horizontal flip. Apply the same rotation before placement
to video, still images and frame sequences, expanding the image bounds to avoid
cropping. The coordinate atlas itself and the physical presenter canvas retain
their original orientation. Persist the rotation in blink/cheek session fixtures;
older fixtures without orientation must be recalibrated. Physical acceptance
requires an upright whole face with margin in the DUT camera evidence, not just
a successfully decoded atlas. `CalibratedMediaOrientationTest` verifies the
projection, renderer paths, preserved atlas and expanded image bounds.

## Two-Android-device presenter

Every recording command must select the DUT serial explicitly; a connected
presenter makes an unscoped `adb shell screenrecord` ambiguous. Preserve both
the presenter timeline and DUT preview video before accepting calibration.
Visibility checks must use current UI orientation: `wm size` reports natural
display dimensions. A full-display hierarchy may swap those dimensions; a
partial dialog must never redefine the viewport. Regression coverage lives in
`test_device_orientation.py` and `TwoDeviceRigRoleTest`.

The preferred compact rig uses the native IRIS/aria-trace phone-target contract
v2 on the presenter device. Its full-bleed `SurfaceView` reports its real canvas,
holds the natural display orientation, and acknowledges the exact painted
revision. The host connects only through `adb reverse`; the presenter does not
need LAN access.

With one compatible presenter and one other authorized device, roles are
detected without relying on model names or on which devices happen to have SHINE
installed:

```bat
optical-rig-test.bat --geometry-only --no-build --no-install
```

For a stable bench, make the roles explicit (environment variables with the same
names are also supported):

```bat
optical-rig-test.bat --presenter-mode android ^
  --dut-serial RFCR91GWXLX --presenter-serial R9JT201YLJF
```

If the compatible target is not installed, pass its verified APK with
`--presenter-apk`. The SHINE repository does not vendor the presenter because the
referenced aria-trace repository currently has no declared source license.

Calibration renders SHINE's existing luminance atlas at the native presenter
surface size. The camera-decoded homography maps the Camera Setup preview centre
back into presenter pixels, so every public face/video is drawn in the observed
location. If the preview centre lies outside the presenter screen, zoom cannot
repair the physical aim. The run stops, preserves the DUT screenshot, and writes
`position-guidance.json` with movement in **DUT preview coordinates**; this stays
unambiguous when a front camera mirrors left and right. Reposition the devices and
rerun. A saved session fixture also records the presenter serial, surface size,
and contract version and is rejected after any of them changes.

## Full calibration

Run the full flow after moving the phone or monitor, changing display geometry,
changing cameras, or installing behavior that invalidates the fixture:

```bat
optical-rig-test.bat --calibration-only
```

The Windows wrapper installs its pinned, rig-local OpenCV dependency on first
use. The runner builds and installs the APK unless `--no-build` or `--no-install`
is explicitly supplied.

The full flow:

1. Opens one exact-size native presenter surface (Android or borderless OpenCV).
2. Displays a monochrome coordinate atlas edge-to-edge, including partial tiles.
3. Navigates SHINE's normal Settings and Camera Setup UI.
4. Tries available cameras through the real **Next camera** control until the
   preview decodes a consistent projective atlas mapping.
5. Uses SHINE's real zoom controls and the decoded homography to center the
   camera aim on the presenter at about 70% view occupancy.
6. Replays open/closed test-video poses through native long-blink calibration.
7. Caches the resulting test-session preferences under the gitignored
   `testdata/optical-rig/session/` directory.
8. Restores the user's original camera/calibration preferences and Switch input
   selection on exit.

The atlas is luminance-only. The rig does no color, white-balance, gamma, or tone
matching. Face media is shown at intrinsic size, centered at the decoded camera
aim. It is not cropped or rescaled to imitate the app; optical framing is
controlled through the same zoom function a user uses.

## Focused replay without recalibration

Once a session fixture exists, test only the relevant behavior:

```bat
optical-rig-test.bat --runtime-only --case blink_long_positive_02
optical-rig-test.bat --runtime-only --case blink_long_positive_02 --repeat 10
optical-rig-test.bat --runtime-only --case blink_short_control --case smile_negative
```

`--case` is repeatable. `--repeat` supports reliability sampling. A replay
temporarily applies the ignored fixture, verifies that the virtual-desktop
geometry still matches, launches normal SHINE runtime, then restores the exact
original preferences. Calibration values are never copied into product defaults.

Use `--trace-hold` only to capture timed diagnostic screenshots. Screen capture
changes scheduling, so a traced pass is diagnostic evidence rather than clean
performance or reliability evidence.

## Cases and activation oracle

Natural blinking, smile, and surprise videos are negative controls. Deterministic
cases hold verified open and closed frames for known durations: a short closure
must stay quiet, a long closure must activate exactly once, and the recovery case
must activate exactly twice.

Each case force-stops and relaunches the normal board, records its visible scan
phase before and after the stimulus, and derives activation count from the actual
UI transition. For example, Review -> Rows is one row/column activation and
Review -> Cells is two. This does not depend on a test-only activation preference
or debug event oracle. Camera analyzer logs are retained only for normal
`CHEEK_PERF` timing telemetry.

If the visible result cannot be classified, the rig reports it as uncertain and
preserves the paired screenshots and UI XML for human review. Do not change app
behavior from an uncertain rig result; inspect that evidence first.

## Evidence

Each run writes `test-results/optical-*`, including:

- `camera-cycle.json` and camera preview screenshots;
- `atlas-calibration.json` and `calibration.json`;
- `blink-calibration.json` and the durable calibration preference snapshot;
- per-case before/after screenshots and UI hierarchies;
- per-case normal camera performance logs;
- `thermal.csv` and `FINDINGS.md`.

A cached fixture is reported as `REUSED (not verified this run)` for geometry,
never as a fresh atlas PASS. A successful older calibration does not prove current
physical framing after the rig or camera view changes.

The report labels focused runs as a reused session fixture and records its
calibration quality. One or two accepted slow blinks are weak calibration, not
"quality good"; such a fixture may still be useful for targeted investigation
but must not be represented as a product default or broad reliability result.

The required rig uses only checksum-verified, publicly licensed media declared in
`testdata/optical-rig/sources.json`. User uploads and private captures are never
discovered by the runner. Cheek stimuli are scaled so the whole face remains visible
with margin, targeting roughly 70% of preview height; the app rejects near-full-frame
faces and asks the operator to move the camera farther away.

## Idle, Windows, and thermal behavior

Run the rig from a process with permission to create GUI windows on the visible
interactive Windows desktop. A sandboxed or service desktop may acknowledge its own
presenter window while the physical monitor continues to show the ordinary desktop;
successful camera atlas decode is the visibility proof. Do not describe this condition
as Windows being locked unless the input desktop is actually a secure desktop such as
`Winlogon`.

When no test is running, start the low-intrusion black framebuffer:

```bat
optical-rig-idle.bat
```

The test closes only the named idle presenter, uses the same native OpenCV
window for atlas and face stimuli, and relaunches the black idle presenter on
exit. Black is also used between cases and during cooldown.

The PC-monitor backend needs the visible interactive Windows `Default` desktop.
The Android presenter backend has no PC window: it suppresses PC system sleep but
allows the PC monitor to turn off, and it never launches the idle topmost black
window. Windows can remain unlocked; ordinary apps cannot draw calibration
patterns over the secure Winlogon desktop. The monitor backend still suppresses
system/display timeout and temporarily disables an active screen saver, restoring
it in `finally`.

At Android thermal MODERATE or approximately 42 C battery temperature, the rig
blacks the stimulus, force-stops SHINE to release camera resources, turns off the
phone display, and waits. It resumes only after thermal NONE and at most 38 C are
stable for 30 seconds. Every exit path attempts to turn the phone display off.

This rig makes physical regressions reproducible. It does not replace evaluation
with the intended AAC user, access site, posture, lighting, fatigue, and comfort.

### Portable cheek-source framing

A video's empirical face height at 1x is only an initial estimate; it cannot
establish face size across different cameras, presenter surfaces, or preview
layouts. Before native cheek calibration, a declared source with a target face
height is shown at its relaxed pose, measured in the current camera preview,
scaled once toward its declared target, and measured again. Missing overlays,
cropped bounds, unsupported scale, or an unconfirmed target stop admission before
gesture learning. Framing thresholds are unchanged.

The measured source scale is saved in the ignored cheek session fixture with its
camera, presenter geometry, upright orientation, and zoom. Focused CPU/GPU runs
reuse that frozen scale; changed zoom or a legacy cheek fixture without measured
framing requires calibration again. Blink cases retain their existing scaling.
No gesture score or activation outcome determines the source scale.
