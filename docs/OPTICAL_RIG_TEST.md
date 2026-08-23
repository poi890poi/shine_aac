# Monitor-to-camera optical regression rig

The optical rig exercises SHINE AAC through the physical path that matters:

```text
OpenCV framebuffer -> monitor pixels -> phone camera -> SHINE detector
-> hold classifier -> normal AAC board state
```

The phone can see only part of the monitor. Fix it in a comfortable position,
aim the selected camera at the display, and use SHINE's normal Camera Setup zoom.
The verified rig framing uses 4.0x zoom; this is session setup, not an app default.

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

1. Opens one native, borderless OpenCV framebuffer over the virtual desktop.
2. Displays a monochrome coordinate atlas edge-to-edge, including partial tiles.
3. Navigates SHINE's normal Settings and Camera Setup UI.
4. Tries available cameras through the real **Next camera** control until the
   preview decodes a consistent projective atlas mapping.
5. Uses SHINE's real zoom controls and the decoded homography to center the
   camera aim on the monitor.
6. Replays open/closed test-video poses through native long-blink calibration.
7. Caches the resulting test-session preferences under the gitignored
   `testdata/optical-rig/session/` directory.
8. Restores the user's original camera/calibration preferences and Switch input
   selection on exit.

The atlas is luminance-only. The rig does no color, white-balance, gamma, or
tone matching. Face media is shown at intrinsic size, centered at the decoded
camera aim. It is not cropped or rescaled to imitate the app; optical framing is
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

The report labels focused runs as a reused session fixture and records its
calibration quality. One or two accepted slow blinks are weak calibration, not
"quality good"; such a fixture may still be useful for targeted investigation
but must not be represented as a product default or broad reliability result.

Private cheek-positive recordings can exercise personalization and runtime:

```bat
python scripts\import-cheek-calibration.py cheek-calibration-....zip
optical-rig-test.bat --with-local-cheek
```

Imported frames stay under gitignored `testdata/optical-rig/local/` and must not
be committed.

## Idle, Windows, and thermal behavior

When no test is running, start the low-intrusion black framebuffer:

```bat
optical-rig-idle.bat
```

The test closes only the named idle presenter, uses the same native OpenCV
window for atlas and face stimuli, and relaunches the black idle presenter on
exit. Black is also used between cases and during cooldown.

The runner needs the visible interactive Windows `Default` desktop. Windows can
remain unlocked with display sleep disabled or managed separately; ordinary
apps cannot draw calibration patterns over the secure Winlogon desktop. During
a run, `SetThreadExecutionState` prevents system/display timeout and the runner
temporarily disables an active screen saver, restoring it in `finally`.

At Android thermal MODERATE or approximately 42 C battery temperature, the rig
blacks the stimulus, force-stops SHINE to release camera resources, turns off the
phone display, and waits. It resumes only after thermal NONE and at most 38 C are
stable for 30 seconds. Every exit path attempts to turn the phone display off.

This rig makes physical regressions reproducible. It does not replace evaluation
with the intended AAC user, access site, posture, lighting, fatigue, and comfort.
