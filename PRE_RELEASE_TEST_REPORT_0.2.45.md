# SHINE AAC 0.2.45 Pre-release Test Report

Generated: 2026-08-13

## Candidate

- Source branch: `main`
- Source tag: `v0.2.45`
- Version: 0.2.45
- Android version code: 48
- Package: `org.shineaac.app`
- Compile SDK: 36
- Target SDK: 36
- Direct-install artifact: `shine-aac-v0.2.45-code48-release.apk`
- Play artifact: `shine-aac-v0.2.45-code48-release.aab`

## Result

SIGNED PACKAGE COMPLETE. READY for closed-tester handoff, conditional only on
confirming in Play Console that version code 48 is unused. The final paused-row
appearance remains a real-device closed-testing focus before promotion beyond
the test track.

| Gate | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | `npm ci`; 0 vulnerabilities |
| Full AAC core | PASS | 237 / 237 tests |
| Web unit tests | PASS | 10 / 10 tests, including paused-row style contract |
| Communication baseline | PASS | 103 / 103 benchmark tasks; frozen paired gates accepted |
| zh-TW reachability | PASS | 37 / 37 first-layer symbols; 0 hidden continuation symbols; top 500 source entries reachable |
| Source browser E2E | PASS | 52 steps, including hold geometry/release, scaling, timing, locale, export, and navigation |
| Packaged WebView E2E | PASS | 53 steps, including generated Android assets |
| Android data policy | PASS | backup disabled and all app-data domains excluded |
| Android unit tests and lint | PASS | app and Android-input modules; no lint errors |
| Exact debug APK runtime | PASS | API 34 emulator; review acknowledgements, volume-button composition of `I want water `, process recreation, and zh-TW render |
| Signed release build | PASS | `assembleRelease bundleRelease`; 153 actionable tasks |
| Release metadata | PASS | `org.shineaac.app`, version 0.2.45 code 48 |
| APK signature and alignment | PASS | APK Signature Scheme v2; one 4096-bit RSA upload-key signer; ZIP alignment verified |
| AAB signature and structure | PASS | JAR signature verified; configuration, base manifest/resources, and primary DEX present |
| Byte identity | PASS | versioned APK and AAB match Gradle outputs |
| Signed APK cold launch | PASS | exact release APK installed on API 34; `MainActivity` resumed; 0 crash/ANR lines |
| Physical Samsung layout | PASS | preceding adaptive-layout candidate passed on the user's Galaxy S23 Ultra |
| Final paused-row device review | OPEN | approved mockup and automated/emulator rendering pass; confirm visibility and fatigue on the S23 Ultra during closed testing |

## Artifacts

### Signed release APK

- File: `shine-aac-v0.2.45-code48-release.apk`
- Size: 42,489,045 bytes
- SHA-256: `40c6426d2bebc2b5ecc7897a85e5464be12b3cc93f965556fc4ef544273e497e`

### Signed Play AAB

- File: `shine-aac-v0.2.45-code48-release.aab`
- Size: 22,177,795 bytes
- SHA-256: `2da121b0663ad9d2385f248b45a1381703b09829a365073337866b25765d86b9`

## Closed-testing Focus

- Confirm that the pale teal-gray held row and solid dark-teal perimeter remain
  easy to locate without being mistaken for active scan progression.
- Confirm the review acknowledgement after message-changing actions is
  understood and does not increase fatigue.
- Repeat default and 200% font size with default and larger display size on the
  Galaxy S23 Ultra.
- Exercise Taiwan speech, predictive back, text export, and optional camera
  input with real users and helpers.

This remains an early testing release and must not be the user's only or
emergency communication method.
