# SHINE AAC 0.3.1 Pre-release Test Report

Generated: 2026-08-18

## Candidate

- Source branch: `main`
- Source tag: `v0.3.1`
- Version: 0.3.1
- Android version code: 50
- Package: `org.shineaac.app`
- Compile SDK: 36
- Minimum SDK: 25
- Target SDK: 36
- Direct-install artifact: `shine-aac-v0.3.1-code50-release.apk`
- Play artifact: `shine-aac-v0.3.1-code50-release.aab`

## Result

SIGNED PACKAGE COMPLETE. READY for internal or closed-tester handoff after the
owner confirms that Play version code 50 is unused. Physical-device scaling,
camera, Taiwan speech, and human AAC review remain required before promotion to
a broader track.

| Gate | Result | Evidence |
| --- | --- | --- |
| Dependency install | PASS | `npm ci`; 0 vulnerabilities |
| Full AAC core | PASS | 272 / 272 tests |
| Web unit tests | PASS | 15 / 15 tests |
| Communication benchmarks | PASS | Frozen paired gates; English four-column/four-block suite: 273 activations, 305 advances |
| Scan-mode benchmark | PASS | Average advance reduction: 46.0% en-US, 44.7% zh-TW; recognition-load proxies reported separately |
| Source browser E2E | PASS | Full interaction/scanning suite |
| Packaged WebView E2E | PASS | Full generated-asset interaction/scanning suite |
| Android data policy | PASS | Backup disabled and all app-data domains excluded |
| Android unit tests and debug build | PASS | Versioned code-50 debug APK created |
| Signed release build | PASS | `assembleRelease bundleRelease`; 153 actionable tasks |
| Release metadata | PASS | `org.shineaac.app`, version 0.3.1 code 50, min SDK 25, target SDK 36 |
| APK signature and alignment | PASS | APK Signature Scheme v2; one 4096-bit RSA upload-key signer; ZIP alignment verified |
| AAB signature and structure | PASS | JAR signature verified; configuration, base manifest/resources, and primary DEX present |
| Signed APK install and launch | PASS | Exact release APK installed on API 34 emulator; `MainActivity` resumed; no matching app crash/ANR lines |
| Physical-device and human AAC review | OPEN | Complete scaling, camera, Taiwan speech, persistence, and usability checks before broader promotion |

## Artifacts

### Debug APK

- File: `shine-aac-v0.3.1-code50-debug.apk`
- Size: 43,781,612 bytes
- SHA-256: `64ed650cc5525ba8d66b4b09ea5a56fe9fef3af065caace30e69379476069d13`

### Signed release APK

- File: `shine-aac-v0.3.1-code50-release.apk`
- Size: 42,507,681 bytes
- SHA-256: `8bc2ae8fc68cd8b40655af48ccd745a37fa900c310ef1cdf07bf253aa6bbc7a8`

### Signed Play AAB

- File: `shine-aac-v0.3.1-code50-release.aab`
- Size: 22,196,511 bytes
- SHA-256: `7bd840836c51a86d4327666b7a6a66f2da7055ede592e324d130832c358538dd`

## Closed-testing Focus

- Compare row/column and block/row/column scanning with actual users; measure
  fatigue and recognition demand in addition to scanner advances.
- Confirm the persistent purple block outline makes the selected scope clear
  during row scanning.
- Confirm automatic activation of singleton blocks and rows is predictable.
- Confirm the English `I` is understood as a fixed alphabet key and works as
  both pronoun and within-word spelling input.
- Repeat default and 200% font size with default and larger display size on the
  target Samsung device.
- Exercise Taiwan speech, predictive back, text export, Activity recreation,
  screen-awake behavior, and optional camera input with users and helpers.

This remains an early testing release and must not be the user's only or
emergency communication method.
