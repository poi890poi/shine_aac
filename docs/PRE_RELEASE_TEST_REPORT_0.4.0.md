# SayToMe AAC / 我想說 0.4.0 pre-release report

Date: 2026-08-25  
Version: 0.4.0 (60)
Candidate: `ca1c187` (`codex/release-v0.4.0-play`)

## Decision

- Direct debug APK: **GO** for release and wider testing.
- Google Play AAB: **GO** for internal/closed testing after the Play Console Data
  safety answers are updated to match the documented ML Kit diagnostics.
- Broad production rollout: **conditional GO**. Expand API 36/large-screen and
  physical UVC hardware coverage first; these are coverage gaps, not observed
  regressions in the candidate.

No open P0, P1, P2, P3, or P4 app defect was found by the completed automated,
physical-device, visual, configuration, or optical runs. Known product-quality and
compatibility work is listed separately below and must not be confused with a test
failure.

## Release artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `shine-aac-v0.4.0-code60-debug.apk` | 106,379,645 | `A2452DBDB31310D28D191BD84075D78BDC80B2E7C1BB901EE803E3B3DEF0360D` |
| `shine-aac-v0.4.0-code60-debug.zip` | 54,577,583 | `17D73E9836A0F5D4CA34D307A9C2510BC64529DC1A0B1A53DDF3A97E345493D8` |
| `shine-aac-v0.4.0-code60-release.aab` | 52,737,938 | `18AF40673B5E4D5877F52172DDF713515D0DAEAD623A9077D9C9D08B81B4D94` |

The direct artifact is intentionally a debug-signed APK. Only the signed AAB is for
Google Play. The APK packaging rebuild reproduced the exact hash used by the physical
device and optical tests. The AAB was verified with `jarsigner`; its upload certificate
SHA-256 is `AF:52:D7:C1:6A:8A:15:57:62:C7:AD:81:BC:DC:67:B2:87:1A:86:CC:26:05:9E:CE:18:04:B0:FC:CE:D6:DC:C7`.

## Test matrix and results

| Area | Evidence | Result |
| --- | --- | --- |
| Core/web logic | 314 tests | PASS |
| Web configuration/layout/accessibility | 48 tests | PASS |
| Scan performance | 3 scenarios, including 1M-word cold preparation and 10k transitions | PASS |
| Android JVM | app plus `android-inputs` debug unit tasks | PASS |
| Android lint/build | `lintDebug testDebugUnitTest assembleDebug`; 0 errors, 13 non-blocking warnings | PASS |
| Browser integration | source and packaged WebView runs, including clean dependency install | PASS |
| Rig logic | 65 Python tests | PASS |
| Dependency security | `npm audit`; 0 vulnerabilities | PASS |
| Physical Android regression | Samsung SM-G781B, Android 13/API 33; 48 checks | PASS, P0-P4 = 0 |
| Native Settings/configuration | 19 inventory, dialog, hierarchy, Input Test, resource, voice and About checks | PASS, P0-P4 = 0 |
| Long normal-use blink | 20 selections, 4 speech turns, correction, clear, language round-trip | PASS |
| Long normal-use twitch | 20 selections, 4 speech turns, correction, clear, language round-trip | PASS |
| Physical Hold to advance | 1 sustained blink; block to first row to first cell; held latch | PASS |
| Paused idle wake | 1-minute Stopped-only timeout; blink and downloaded twitch wake | 2/2 PASS |
| Focused twitch | 1 positive + 2 frown/surprise controls | 3/3 PASS |
| Focused blink | 9 natural/short/long/recovery/smile/surprise cases | 9/9 PASS |

Physical device evidence: `test-results/device-20260825-151421`. Native Settings
evidence: `test-results/native-config-20260825-152827`.

The first Settings audit incorrectly reported a P1 because its App info oracle still
hard-coded version code 59. The captured UI correctly showed `版本 0.4.0（60）`; only
the harness was changed to read `version.properties` dynamically (`9ddc1a4`). The
complete audit then passed 19/19. No app behavior was changed for that test failure.

The physical suite verified install/launch, package/version/signature, locale, camera
preview stability, background/display-off camera release, process recreation, 200%
font scaling, landscape, memory behavior, configuration, and crash/ANR logs. Preview
bounds stayed stable across changing status text.

## Optical confidence and performance

The required ordering was respected: the complete blink normal-use session
(`test-results/optical-20260825-153440`) and complete downloaded-video twitch session
(`test-results/optical-20260825-160039`) ran before focused repetition. Each completed
20 selections, four speech turns, a deliberate wrong choice and undo, clear operations,
and a Traditional Chinese/English round-trip. Each used 57 physical camera activations
with no timeout, miss, duplicate, or release-blocking finding.

The new bounded sustained-input gate (`test-results/optical-20260825-163217`) used one
real continuous blink. It changed the message from empty to `是` through block, first
row and first cell with exactly one native activation, then remained `是` for another
1.5 seconds while the stimulus stayed closed. Release was required before another
native activation.

Paused-idle gates used a real one-minute timeout after the visible scanner reached
`Stopped`. Blink (`test-results/optical-20260825-163323`) and downloaded twitch
(`test-results/optical-20260825-163527`) both emitted `powerSaving`; one physical
gesture then returned to `Rows` with the existing message unchanged. This proves the
first gesture wakes rather than selects. The Samsung window dump did not expose app
brightness, so panel dimming was not claimed as an automated optical measurement.

Focused twitch evidence (`test-results/optical-20260825-164224`) passed 3/3: one
positive activation and zero for frown/surprise controls. Analyzer windows averaged
29.5-32.8 ms and the worst observed frame was 71.9 ms.

Focused blink evidence (`test-results/optical-20260825-163810`) passed 9/9:

- natural and short blinks: 0 activations;
- four long/continuous positive variants: exactly 1 activation each;
- two-gesture recovery: exactly 2 activations;
- smile and surprise controls: 0 activations.

Atlas geometry remains the source of XY/framing. The rig uses the app's normal camera
zoom control and now targets 70% monitor occupancy, the middle of the accepted 60-80%
comfortable-distance range. Media remains intrinsic-size and centered; there is no app
crop, test-only WebView scaling, or altered preview behavior.

## Systematic visual, UX, accessibility and AAC review

The review used invariant checks rather than device-specific pixel matching:

- viewport matrix: 393x851, 320x694, 800x1280 and 1280x800;
- default and 200% font/display-scale combinations;
- overflow, clipping, minimum target size, sparse-density and excessive vertical-gap
  heuristics;
- stable camera preview geometry across changing instruction/status text;
- default, progress, active block, active row and active cell contrast states at
  0%, 50%, and 100% progress;
- native Settings hierarchy, option relevance, discoverability, back behavior and
  focused child pages;
- communication reachability, dead ends, phrase composition, correction, clear,
  speech lock, conversation display and language switching.

Contrast tests composite translucent progress/active backgrounds before checking text
and non-text contrast. All tested themes/states meet the configured 4.5:1 text and 3:1
non-text thresholds. Current physical screenshots show no dark-theme white patch,
camera-preview collapse, clipped action, or excessive settings-row padding.

The assessment follows Android core/adaptive quality guidance, WCAG 2.2 target/focus/
contrast guidance, and ASHA's emphasis on functional, individualized AAC access. It is
not a clinician or real-user fatigue study.

## Communication benchmarks

All regression gates pass and the candidate improves the paired baseline:

- estimated scan time: 4,747.20 s vs 4,993.80 s (`-4.94%`);
- switch activations: 802 vs 808 (`-0.74%`);
- urgent-phrase median: 6 s (target <= 10 s);
- switch median: 4 (target <= 4);
- direct first-symbol coverage: 100%; dead-end continuations: 0.

Open product-quality gaps remain: average benchmark time is 46.09 s vs a 15 s target,
average activations are 7.79 vs a target of 6, functional phrase surface is 48 vs a
target range of 80-120, and multi-concept coverage is 16 vs a target of 120. These are
P2 roadmap items requiring AAC/user validation, not safe release-eve special-casing.

## Compatibility, privacy and remaining uncertainty

- The app targets/compiles API 36, but this candidate was physically exercised on API
  33. API 36, foldable and tablet runtime coverage remains to be added.
- UVC discovery, persistence, permission, format selection and lifecycle logic are
  unit/build covered, and native libraries are packaged for four ABIs. No physical UVC
  webcam/device matrix was available in this session; keep UVC in internal testing
  until that matrix passes.
- AndroidX Activity 1.8.0 and WorkManager 2.10.5 are behind current stable releases.
  WorkManager 2.11 requires a coordinated Kotlin/AndroidX migration; do not make that a
  release-eve isolated bump. Treat this as P4 dependency-maintenance debt.
- Camera2's deprecated `createCaptureSession` overload remains P4 compatibility debt.
- ML Kit performs face processing on-device, but Google's Android disclosure states
  that ML Kit collects device/app information, per-installation identifiers,
  performance/API configuration and event/error metrics for diagnostics and usage
  analytics. Frames and AAC message text are not uploaded by SHINE. Play Data safety
  declarations and the published privacy page must match this before Play rollout.

## References

- Android core quality: https://developer.android.com/docs/quality-guidelines/core-app-quality
- Android adaptive quality: https://developer.android.com/develop/adaptive-apps/quality-guidelines/adaptive-app-quality
- ASHA AAC practice portal: https://www.asha.org/Practice-Portal/Professional-Issues/Augmentative-and-Alternative-Communication/
- WCAG target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG focus appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- WCAG enhanced contrast: https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- ML Kit Android data disclosure: https://developers.google.com/ml-kit/android-data-disclosure
