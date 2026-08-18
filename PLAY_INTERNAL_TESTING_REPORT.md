# SHINE AAC Google Play Closed Testing Report

Generated: 2026-08-18

## Upload Artifact

- Track: Google Play Closed testing
- Application source tag: `v0.3.1`
- Package: `org.shineaac.app`
- Version: 0.3.1 (50)
- Compile SDK: 36
- Target SDK: 36
- File: `shine-aac-v0.3.1-code50-release.aab`
- Release-package path: `binaries/shine-aac-v0.3.1-code50-release.aab`
- Size: 22,196,511 bytes
- SHA-256: `7bd840836c51a86d4327666b7a6a66f2da7055ede592e324d130832c358538dd`
- Checksum file: `binaries/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and primary DEX verified
- Byte identity: versioned AAB matches Gradle's signed `app-release.aab`

## Decision

READY for Google Play Closed testing after the owner confirms that version code
50 is unused. Upload the versioned AAB, not the APK. This remains an early test
build and is not approved for a broader track until both scanning modes,
singleton activation, scaling, speech, and human AAC workflow are reviewed on
real devices.

## Supporting Verification

- Full AAC core: 272 / 272 tests passed.
- Web unit tests: 15 / 15 passed.
- Communication reachability: 103 / 103 tasks; frozen paired gates passed.
- Source and packaged-WebView E2E: PASS, including row/column and
  block/row/column scanning, singleton activation, layout independence,
  suggestion behavior, and Auto Demo.
- Cumulative visible scan timing: PASS at 80 row and 80 cell transitions.
- Android data policy, app/input unit tests, and lint: PASS.
- Exact signed release APK install and launch: PASS; version 0.3.1 (50),
  `MainActivity` resumed, and no app crash/ANR was logged.
- APK v2 signature, ZIP alignment, AAB JAR signature, required bundle entries,
  checksums, and byte identity: PASS.

Full evidence: `docs/PRE_RELEASE_TEST_REPORT_0.3.1.md`.

## Required Closed Testing

- Compare both scanning modes with users and measure fatigue and recognition
  demand, not only scanner advances.
- Confirm the purple block context, singleton auto-activation, and corrected
  fixed English `I` are understood without avoidable errors.
- Repeat default/200% font size with default/larger display size on the Galaxy
  S23 Ultra.
- Exercise Taiwan TTS, Android predictive back, text export, Activity
  recreation, and optional camera input with users and helpers.
