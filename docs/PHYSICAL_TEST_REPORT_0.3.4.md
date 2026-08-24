# SHINE AAC 0.3.4 physical-device and configuration review

Date: 2026-08-24

Application artifact: `shine-aac-v0.3.4-code58-debug.apk`

SHA-256: `47aa2a83863292af14aa82591df70e14d0d408547753e333f3cb35b3854c9b4e`

Device: Samsung SM-G781B, Android 13 (API 33), serial RFCR91GWXLX

This is a one-device release-artifact review. It is extensive within that
device, but it is not multi-device compatibility evidence.

## Release decision

Version 0.3.4 is not ready to be treated as a clean upgrade release. One
distribution blocker and several normal-use UI/UX defects remain. The physical
functional loops were stable, but that does not cancel the release and
accessibility findings below.

## Distinct findings

### P0

1. **Published debug APKs cannot reliably update one another.** The public
   v0.3.1 debug APK certificate is
   `9b23f4cc819ad71ed3cde130e0fe76ace4161d833175c0160aca998dc53e954e`;
   the public v0.3.4 debug APK certificate is
   `641b9726b1cdb1a373ed0eed4bc191e17bd8553316bde315dabfc1988f8a15bb`;
   and the host-tested v0.3.4 debug certificate is
   `edf08f77fe28853ffe8afe6bfbb2c1c83ba0b60c346c27c7d5650ff0b5edd4c7`.
   Android correctly rejects an in-place update across these keys. Uninstalling
   bypasses the check but can destroy private user configuration and is not an
   acceptable update path. Tagged CI must not publish an APK signed by a fresh
   hosted-runner debug key.

### P1

1. **High-contrast dark is not a valid high-contrast theme.** On the physical
   device, the review row is white on near-white at 1.11:1 and Clear is 1.50:1.
   The selected Taiwan voice title is also effectively invisible, and App Info
   secondary text is approximately 2.73:1 to 3.25:1. Several screens use fixed
   light colors instead of theme colors.
2. **Android 200% font scaling breaks Camera Setup.** Labels are truncated,
   values become ellipses, the camera/mode/timing rows collide, and the bottom
   actions overlap. The screen is reachable but not reliably understandable or
   operable.
3. **Reset is destructive and immediate.** A single tap replaces customized
   layout, dictionary, scan values, input selection, voice settings, and theme,
   then closes Configuration. There is no confirmation, summary, backup prompt,
   or undo. The automated test proved that reset works mechanically; the UX is
   still unsafe for real users.

### P2

1. **The sticky six-button action tray obscures Configuration.** It occupies
   roughly the lower third to half of the phone viewport, covers fields while
   scrolling, and becomes a white slab in the dark theme.
2. **Configuration is an ungrouped 2,100 CSS-pixel form.** Twenty-one persisted
   settings, five raw timing numbers, input and speech controls, a 501,373
   character/27,715-line English dictionary, and raw board symbols are placed
   in one flat screen. Advanced editors and destructive actions are not
   separated from routine settings.
3. **Configuration has undersized and inaccessible controls.** Twenty-five DOM
   controls measure 34-42 CSS pixels high rather than 48. At device checkpoints,
   three to four visible WebView checkboxes are marked `NAF=true` and expose
   neither Android text nor content-description, despite visible adjacent label
   text.
4. **Communication-board targets are slightly below the Android 48dp baseline.**
   Sixty dense board controls are reported below the minimum at repeated board
   checkpoints. This may require a deliberate AAC density tradeoff, but it must
   be documented and tested with intended users rather than silently ignored.
5. **Two Camera Setup controls are below 48dp.** This is separate from the 200%
   font layout failure.
6. **Localization and relevance are inconsistent.** English Configuration still
   shows the Zhuyin pass-two setting, the Taiwan Voice setting summary is
   Chinese, and opening it produces a Chinese-only page.
7. **Camera input labels do not represent cheek-twitch configuration.** The
   top-level choices remain `Camera long blink` and `Buttons + camera` even
   though Camera Setup can select cheek twitch. Returning from a cheek setup
   therefore leaves the parent setting describing the wrong gesture.
8. **The 200% board header truncates state.** The voice status is shortened to
   `語...`, removing useful operating feedback even though the board itself
   remains reachable.

### P3

1. **Taiwan Voice summary text is only 13.33 CSS pixels.** It is smaller than the
   rest of the configuration hierarchy and becomes harder to read in a dense
   panel.
2. **Raw millisecond controls are presented as primary settings.** Labels such
   as `Switch speed ms` and `Row cancel pause ms` require implementation
   knowledge. Presets should be primary; exact timing belongs in an Advanced
   screen with plain-language explanations.

### P4

1. **App naming is inconsistent.** App Info is titled `我想說` but its camera
   privacy explanation says frames are not stored by `SayToMe AAC`. This is a
   low-impact polish/trust issue.

## Passed physical checks

- Exact APK identity recorded before installation.
- Twenty consecutive Board -> Configuration -> Camera Setup -> Configuration ->
  Board cycles.
- Camera active in setup and runtime camera reacquired after return.
- Pending configuration draft preserved across the native Camera Setup activity.
- Board activation still responds after each configuration cycle.
- Scanning/progress produces changing visual feedback.
- Configuration pauses board scanning.
- HOME/background releases the camera and return succeeds.
- Display-off releases the camera and return succeeds.
- Process recreation returns to the board with 100% visible-label overlap.
- Board, Configuration, and Camera Setup remain reachable at 200% font.
- Portrait/orientation-constrained relaunch remains reachable.
- No fatal crash or ANR in the collected application log.
- PSS did not grow across the repeated camera loop; final measured change was
  -56.8 MiB relative to the first camera-model load.

## Passed configuration checks

- All 21 expected persisted settings were present.
- Save and reload succeeded for all five timing presets.
- Save and reload succeeded for both scan methods.
- Save and reload succeeded for pass limits 1, 2, 3, and unlimited.
- Save and reload succeeded for default, high-contrast light, and
  high-contrast dark themes.
- Save and reload succeeded for hardware buttons, volume buttons, camera,
  buttons plus camera, and input off.
- Both language profiles saved and reloaded.
- Numeric lower and upper bounds saved and reloaded.
- Fourteen representative cross-setting changes persisted together.
- Cancel discarded unsaved language/theme changes.
- Reset restored the packaged zh-TW defaults.
- Android's document picker opened for text export; cancellation returned to
  Configuration without writing a document.
- App Info showed version 0.3.4 and code 58.
- Taiwan Voice exposed one installed voice with named controls.
- Input Test opened and returned to Configuration.
- Original application configuration was restored after the audit.

## Evidence

- Device lifecycle/camera report:
  `test-results/device-20260824-084722/FINDINGS.md`
- Configuration matrix report:
  `test-results/config-20260824-014104/FINDINGS.md`
- Configuration inventory and layout measurements:
  `test-results/config-20260824-014104/baseline.json`
- Full option matrix:
  `test-results/config-20260824-014104/option-matrix.json`
- Dark-theme color samples:
  `test-results/config-20260824-014104/matrix.json`
- Exact post-test storage verification:
  `test-results/config-20260824-014104/restoration.json`
- Screenshots are in both result directories under `screenshots/`.

`test-results` is intentionally ignored and remains local test evidence. This
report is the durable, deduplicated result.

## Optical scope and limitations

The Windows host was at its lock screen (`LockApp` and `LogonUI` were active),
so the optical monitor test was skipped as requested. The repeated camera test
therefore proves acquisition, release, lifecycle, navigation, and activation
routing, but it does not prove real long-blink/cheek detection in this run.

The next unlocked-host optical run still needs the complete demo script for
both long blink and cheek twitch, including calibration samples, intentional
activations, idle false positives, varied head position, and varied lighting.
