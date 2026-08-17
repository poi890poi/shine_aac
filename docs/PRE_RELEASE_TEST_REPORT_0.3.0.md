# SHINE AAC 0.3.0 Pre-release Test Report

Generated: 2026-08-14

## Candidate

- Source branch: `main`
- Source commit: `111576a8d51fba2f2f0d8baf1089f02ef897688e`
- Source tag: `v0.3.0` (not created)
- Version: 0.3.0
- Android version code: 49
- Package: `org.shineaac.app`
- Compile SDK: 36
- Target SDK: 36
- Direct-install artifact: `shine-aac-v0.3.0-code49-release.apk`
- Play artifact: `shine-aac-v0.3.0-code49-release.aab`

## Result

SIGNED PACKAGE COMPLETE. READY for internal or closed-tester handoff after the
owner confirms that Play version code 49 is unused. Physical-device scaling,
camera, Taiwan speech, and human AAC review remain required before promotion to
a broader track.

| Gate | Result | Evidence |
| --- | --- | --- |
| Full AAC core | PASS | 248 / 248 tests |
| Web unit tests | PASS | 11 / 11 tests |
| Generated sensitive suggestion policy | PASS | 10 generated soft-demotion labels verified |
| Source browser E2E | PASS | Full interaction/scanning suite |
| Packaged WebView E2E | PASS | Full generated-asset interaction/scanning suite |
| Cumulative scan timing | PASS | 80 row and 80 cell transitions; mean excess 6.17 ms and 5.80 ms; activation latency 1.0 ms and 3.6 ms |
| Android data policy | PASS | Backup disabled and all app-data domains excluded |
| Android unit tests and lint | PASS | App, diagnostic app, and Android-input modules; no lint errors |
| Signed release build | PASS | `assembleRelease bundleRelease`; 153 actionable tasks |
| Release metadata | PASS | `org.shineaac.app`, version 0.3.0 code 49, min SDK 25, target SDK 36 |
| APK signature and alignment | PASS | APK Signature Scheme v2; one 4096-bit RSA upload-key signer; ZIP alignment verified |
| AAB signature and structure | PASS | JAR signature verified; configuration, base manifest/resources, and primary DEX present |
| Byte identity | PASS | Versioned APK and AAB match Gradle outputs |
| Signed APK install and launch | PASS | Exact release APK installed on API 34 emulator; `MainActivity` resumed; no app crash/ANR lines |
| Physical-device and human AAC review | OPEN | Complete the documented scaling, camera, Taiwan speech, persistence, and usability checks before broader promotion |

## Artifacts

### Signed release APK

- File: `shine-aac-v0.3.0-code49-release.apk`
- Size: 42,504,869 bytes
- SHA-256: `bf0aa0c2368b87f86ae1bf109f9c9bac77ce06dcb7ebb28cc02894996d18a0c6`

### Signed Play AAB

- File: `shine-aac-v0.3.0-code49-release.aab`
- Size: 22,193,769 bytes
- SHA-256: `6a65a3927935648bd24d79d5f2795d7aa35593105beb727d75e09a678b50d95b`

## Closed-testing Focus

- Confirm the miss-tolerant two-pass escape ladder is understandable and does
  not make scanning feel slow or ambiguous.
- Confirm stopped scanning and wake-only activation are visible and predictable.
- Review first-symbol suggestion changes and sensitive-label demotion with
  Taiwan users and helpers.
- Repeat default and 200% font size with default and larger display size on the
  target Samsung device.
- Exercise Taiwan speech, predictive back, text export, Activity recreation,
  screen-awake behavior, and optional camera input with users and helpers.

This remains an early testing release and must not be the user's only or
emergency communication method.
