# Physical-device acceptance test

`device-test.bat` is SHINE AAC's standard physical Android acceptance test.

It complements core/browser/emulator tests with evidence from a real device.

## Run

```bat
device-test.bat
```

Equivalent:

```bat
python scripts\device-acceptance-test.py
```

Useful options:

```text
--cycles 10
--apk .artifacts\releases\v0.4.0\shine-aac-v0.4.0-code60-debug.apk
--no-build
--no-install
--skip-font-200
--skip-rotation
--thermal-stop-status 2
--thermal-hot-c 42
--thermal-resume-c 38
--thermal-stable-sec 30
```

Use `--apk` with `--no-build` to test a specific already-built artifact. The
runner records its resolved path, byte size, and SHA-256 in `apk.txt`; it never
silently substitutes the default Gradle debug output.

Android cannot replace an installed package with an APK signed by a different
key. Remove the existing package only after deciding whether its private app
data needs to be preserved.

The standard `device-test.bat` run continues with the configuration and UX
audit after the lifecycle/camera suite. To run that portion independently:

```bat
device-config-audit.bat
```

It uses the debuggable Android WebView on the physical device, captures every
configuration viewport, inventories all major options, verifies every timing
preset, scan method, pass limit, input profile, language and contrast theme,
checks numeric boundaries and save/cancel/reset/export behavior, opens Taiwan
voice/App Info/Input Test, checks target sizes/names/overflow/type size, and
restores the original stored configuration when it exits. Its report includes
P0 through P4 findings under `test-results\config-*`.

## Thermal governor

Every physical-device run records:

```text
test-results/device-*/thermal.csv
```

The runner prefers Android's aggregate thermal severity and uses battery temperature
as a fallback/sanity bound.

Default policy:

```text
NONE           continue
LIGHT          continue, record
MODERATE+      suspend current test work and cool down
battery >=42C  suspend if thermal severity is unavailable/lagging
resume         thermal NONE and battery <=38C, stable for 30 seconds
```

During cooldown SHINE is force-stopped, camera/resources are released and the display
is put to sleep. The runner wakes/relaunches the app after the cool state is stable.

The thresholds are command-line configurable because OEM thermal policies differ.

## Automated physical checks

The standard run covers:

- source revision and dirty-tree evidence;
- exactly one authorized ADB device;
- source/core tests + debug APK build;
- APK installation and app launch;
- camera permission state;
- scan/progress motion;
- Settings/config pause behavior;
- repeated `board -> Settings -> Camera setup -> Back -> Settings -> board`;
- config-draft preservation across native camera setup;
- camera acquisition/release;
- activation response after configuration;
- HOME/background and display off/on;
- process recreation;
- 200% font-scale layout;
- landscape evidence;
- visible touch-target size (48dp Android baseline);
- unnamed visible controls/accessibility metadata;
- crash/ANR/camera/app-owned exception logs;
- rough PSS growth;
- screenshots, UI hierarchy, dumpsys, preferences and logcat.
- full Configuration option/persistence/action/UX audit.

P0/P1 findings make the command return non-zero. Reports enumerate P0 through
P4 so minor polish and consistency observations are retained instead of being
discarded.

## Camera-action regression

Changes to long-blink/cheek detection should also run:

```bat
optical-rig-test.bat
```

See `docs/OPTICAL_RIG_TEST.md`.

## Human AAC review still required

Automation does not establish fatigue, posture, motor repeatability, cognitive load,
scan comfort, actual-user false-positive rates, speech burden or whether the UI is
usable by the intended person. Those remain release-review items.

- The device display is always turned off when the test exits, including test failures.
