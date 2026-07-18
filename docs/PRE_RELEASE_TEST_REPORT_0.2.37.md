# SHINE AAC Focused Pre-release Test Report

Generated: 2026-07-18T20:59:36+08:00

## Candidate

- Tested source commit: `b48860b35c3a3517988b7f703c3953268713671a`
- Version: 0.2.37
- Android version code: 40
- Package: `org.shineaac.app`
- Artifact: `shine-aac-v0.2.37-code40-debug.apk`
- Size: 43,318,907 bytes
- SHA-256: `9229b2557d34b63225fd2265d4ddaffb927d6b4ab602b9b45030c75340e84ec7`

## Decision

PASS for local owner/internal UX testing. The artifact is debug-signed and is not the signed Play Store AAB.

Internal handoff is ready using these two local files:

- `.artifacts/releases/v0.2.37/shine-aac-v0.2.37-code40-debug.apk`
- `.artifacts/releases/v0.2.37/SHA256SUMS.txt`

The source tag is `v0.2.37`. GitHub Release publication is unavailable and is not a gate for this internal debug test.

## Changes Since 0.2.36

- Added tolerant whole-buffer Zhuyin repair when an invalid combination has no exact suggestions, trying mistakes near the end first without excluding earlier-symbol mistakes.
- Added `重選` for multi-symbol Zhuyin buffers; it removes only the pending Zhuyin buffer and remains distinct from full-message `清除`.
- Reset the message draft and scanner state when developer demo mode starts.
- Added a frozen paired communication evaluator with aggregate, P90, function-group, reachability, and bounded-paging gates.
- Adapted multi-symbol candidate/continuation allocation by exact-match ambiguity while reserving command and high-priority continuation capacity.
- Updated APK E2E setup to config schema 18 and made the harness dismiss only known Android system/Pixel Launcher ANR dialogs without masking a SHINE ANR.

## Verification

| Layer | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | `npm ci`; 0 vulnerabilities |
| Full core | PASS | 211 passed, 0 failed; 165.4 sec |
| Efficiency reports | PASS | inventory, phonetic access, and 103-task paired communication report |
| Paired communication gates | PASS | 36.8 sec lower estimated scan time; activations and `更多` unchanged |
| Source browser E2E | PASS | 31 steps; 144.6 sec |
| Packaged WebView E2E | PASS | 31 steps; 147.5 sec |
| Android input unit tests | PASS | 14 passed, 0 failed |
| Android lint | PASS | 0 errors; 98 existing warnings across app and camera/input modules |
| Android data policy | PASS | cloud backup disabled and all app-data domains excluded |
| Android debug build | PASS | Gradle unit tests and `assembleDebug`; 111 tasks |
| APK byte identity | PASS | intermediate and versioned APK SHA-256 hashes match |
| APK metadata/install | PASS | exact artifact installed; emulator reports 0.2.37, code 40, min 25, target 35 |
| Signature/alignment | PASS | Android debug certificate; APK Signature Scheme v2; ZIP alignment verified |
| Packaged demo activation | PASS | Config long-press started the demo after deterministic app reset |
| Android hardware input | PASS | entered `I want water ` through volume-key switch input |
| Native draft persistence | PASS | draft survived forced process stop and restart |
| Packaged zh-TW render | PASS | direct Zhuyin first layer and `更多` rendered after restart |

## Emulator Infrastructure Note

The existing API 34 AVD repeatedly displayed Android `system` and Pixel Launcher ANR dialogs before app assertions. The dedicated `ShineAacApi34` test AVD was wiped and rebuilt. The APK harness was then constrained to dismiss only those known emulator-system dialogs with dialog-focused key events. It does not dismiss or ignore an ANR from `org.shineaac.app`.

After recovery, the complete combined APK flow passed in one run in 135.7 seconds. No SHINE crash or ANR was observed.

## What To Test Manually

1. On the target Samsung phone, verify bottom controls with gesture and three-button navigation and confirm the screen remains awake.
2. Start demo mode with existing text and scanning in progress; confirm both reset before the demo begins.
3. Enter invalid Zhuyin combinations with mistakes at the first, middle, and last position; verify repairs and whole-buffer replacement.
4. Confirm `重選` appears only for multi-symbol Zhuyin buffers and does not clear committed message text.
5. Compare dense and continuation-heavy Zhuyin input for unexpected `更多` pages or missing continuation symbols.
6. Listen to Mandarin TTS and activation feedback on the physical device.
7. Run real-person camera alignment, blink detection, and calibration.
8. Upgrade from 0.2.36 as well as clean-install 0.2.37; verify settings, draft restoration, and reset behavior.

## Open Items

- Physical Samsung/device-owner/helper UX review.
- Real-person camera and Mandarin TTS validation.
- Signed AAB and Play Store readiness; not required for this internal debug candidate.

GitHub CI publication remains an infrastructure limitation, not an unresolved product-test result.
