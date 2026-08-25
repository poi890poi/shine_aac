# SayToMe AAC / 我想說 0.4.0 pre-release report

Date: 2026-08-25  
Version: 0.4.0 (59)  
Candidate: `340ebcb` (`codex/release-v0.4.0-play`)

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
| `shine-aac-v0.4.0-code59-debug.apk` | 106,518,738 | `6AE2D816A22020930EE7972426F40E1F6E26745DC5FC33311ED113055DA251F9` |
| `shine-aac-v0.4.0-code59-debug.zip` | 54,572,984 | `44B27387DD10260A122BF9F44A202375E288EC59DA0084399CCA9DA9CE9E3876` |
| `shine-aac-v0.4.0-code59-release.aab` | 52,741,197 | `91147750CB882BBA1B2277605FDB9CC6B1CB33DF53615868D9EF6AACFA67A357` |

The direct artifact is intentionally a debug-signed APK. Only the signed AAB is for
Google Play. The APK packaging rebuild reproduced the exact hash used by the physical
device and optical tests. The AAB was verified with `jarsigner`; its upload certificate
SHA-256 is `AF:52:D7:C1:6A:8A:15:57:62:C7:AD:81:BC:DC:67:B2:87:1A:86:CC:26:05:9E:CE:18:04:B0:FC:CE:D6:DC:C7`.

## Test matrix and results

| Area | Evidence | Result |
| --- | --- | --- |
| Core/web logic | 314 tests | PASS |
| Web configuration/layout/accessibility | 46 tests | PASS |
| Scan performance | 3 scenarios, including 1M-word cold preparation and 10k transitions | PASS |
| Android JVM | app plus `android-inputs` debug unit tasks | PASS |
| Android lint/build | `lintDebug testDebugUnitTest assembleDebug`; 0 errors, 13 non-blocking warnings | PASS |
| Browser integration | source and packaged WebView runs, including clean dependency install | PASS |
| Rig logic | 61 Python tests | PASS |
| Dependency security | `npm audit`; 0 vulnerabilities | PASS |
| Physical Android regression | Samsung SM-G781B, Android 13/API 33; 33 checks | PASS, P0-P4 = 0 |
| Native Settings/configuration | 19 inventory, dialog, hierarchy, Input Test, resource, voice and About checks | PASS, P0-P4 = 0 |
| Long normal-use blink | 20 selections, 4 speech turns, correction, clear, language round-trip | PASS |
| Long normal-use twitch | 21 selections, 4 speech turns, correction, clear, language round-trip | PASS |
| Focused twitch | 3 positive + 6 frown/surprise controls | 9/9 PASS |
| Focused blink | 27 natural/short/long/recovery/smile/surprise cases | 27/27 PASS |

Physical device evidence: `test-results/device-20260825-103556`. The same APK also
completed an earlier five-cycle run in `test-results/device-20260825-095417`.

The physical suite verified install/launch, package/version/signature, locale, camera
preview stability, background/display-off camera release, process recreation, 200%
font scaling, landscape, memory behavior, configuration, and crash/ANR logs. Preview
bounds stayed stable across changing status text.

## Optical confidence and performance

The required ordering was respected: complete normal-use sessions ran before focused
repetition. The first blink run exposed three rig-created clear-row retries. Evidence
showed the harness was injecting an unconditional extra activation after every camera
selection. The app was not changed. The rig now observes scan motion and sends a wake
gesture only when review remains held.

The corrected twitch session used the public downloaded movement video, not the private
frame pack. Native setup accepted 6/6 registration trials in 28.4 seconds. It then
completed 60/60 physical gesture steps: 43 selection gestures and 17 consumed review
wake gestures, with zero timeout, miss, duplicate, or release-blocking finding. A
50-frame normal-use analyzer window averaged 16.7 ms and peaked at 35.8 ms.

Focused twitch evidence (`test-results/optical-20260825-132204`) recorded exactly one
activation for every positive repetition and zero for all frown/surprise controls.
Across nine performance windows, analyzer mean was 36.2 ms and the worst observed frame
was 68.4 ms.

Focused blink evidence (`test-results/optical-20260825-132615`) passed 27/27:

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

