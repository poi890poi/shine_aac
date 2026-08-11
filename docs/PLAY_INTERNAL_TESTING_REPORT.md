# SHINE AAC Google Play Closed Testing Report

Generated: 2026-08-11

## Upload Artifact

- Track: Google Play Closed testing
- Application source tag: `v0.2.44`
- Package: `org.shineaac.app`
- Version: 0.2.44 (47)
- Compile SDK: 36
- Target SDK: 36
- File: `shine-aac-v0.2.44-code47-release.aab`
- Release-package path: `binaries/shine-aac-v0.2.44-code47-release.aab`
- Size: 22,184,114 bytes
- SHA-256: `3af69b04dbd130457eae7683dff2beb0d6ff55727db17c2f829723f1611dfbbe`
- Checksum file: `binaries/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and primary DEX verified
- Byte identity: versioned AAB matches Gradle's signed `app-release.aab`

## Decision

CONDITIONAL for upload to Google Play Closed testing. The signed AAB is valid
and the exact source is committed for tag `v0.2.44`; version code 47 must still
be confirmed unused in Play Console. Upload the versioned `.aab`, not the APK.

This is an appropriate closed-testing candidate for evaluating the requested
slower scanning default, adaptive large-text layout, localized setup flow, and
embedded-English suggestions. It is not approved for a broader track until the
physical Samsung scaling matrix and human timing/board review pass. The reviewed
communication baseline now records the deliberate 1,800 ms first-use interval;
all benchmark tasks and paired gates pass.

## Supporting Verification

- Quick functional core: 123 / 123 tests passed; web configuration unit tests:
  3 / 3 passed.
- Full core and communication suite: 237 / 237 passed.
- Packaged WebView E2E: 41 steps passed, including generated assets, zh-TW
  locale consistency, English completions, and compact language boundaries.
- Android inputs: 14 / 14 unit tests passed; lint completed without errors
  across all modules.
- Android release: `assembleRelease bundleRelease` completed 153 actionable
  tasks; data-policy verification passed.
- Manifest: `org.shineaac.app`, version 0.2.44 code 47, min SDK 25, target SDK
  36.
- APK v2 signature, AAB JAR signature, checksums, bundle structure, and byte
  identity all verified.

Full evidence: `docs/PRE_RELEASE_TEST_REPORT_0.2.44.md`.

## Required Internal Testing

- Human comfort and fatigue at the new default speed; retain per-user timing
  calibration.
- Recognition of header status versus the `⚙ 設定` control.
- All-symbol Zhuyin finding, function-key recognition, `復原`, and candidate
  paging.
- Android Save As export followed by direct `開啟文字檔`.
- Android 16 predictive back, edge-to-edge controls, phone/tablet layouts,
  Activity recreation, Taiwan TTS, and real-person camera input.
