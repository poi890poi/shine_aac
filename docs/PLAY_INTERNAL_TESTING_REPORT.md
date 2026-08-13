# SHINE AAC Google Play Closed Testing Report

Generated: 2026-08-13

## Upload Artifact

- Track: Google Play Closed testing
- Application source tag: `v0.2.45`
- Package: `org.shineaac.app`
- Version: 0.2.45 (48)
- Compile SDK: 36
- Target SDK: 36
- File: `shine-aac-v0.2.45-code48-release.aab`
- Release-package path: `binaries/shine-aac-v0.2.45-code48-release.aab`
- Size: 22,177,795 bytes
- SHA-256: `2da121b0663ad9d2385f248b45a1381703b09829a365073337866b25765d86b9`
- Checksum file: `binaries/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and primary DEX verified
- Byte identity: versioned AAB matches Gradle's signed `app-release.aab`

## Decision

READY for Google Play Closed testing after the owner confirms that version code
48 is unused. Upload the versioned AAB, not the APK. This remains an early test
build and is not approved for a broader track until the paused-row treatment,
scaling matrix, speech, and human AAC workflow are reviewed on real devices.

## Supporting Verification

- Full AAC core: 237 / 237 tests passed.
- Web unit tests: 10 / 10 passed.
- Communication reachability: 103 / 103 tasks; frozen paired gates passed.
- Source and packaged-WebView E2E: 52 and 53 steps passed, including the new
  paused-row visual contract and review-release behavior.
- Android data policy, app/input unit tests, and lint: PASS.
- Exact code-48 debug APK hardware-input/lifecycle/zh-TW smoke: PASS on API 34.
- Exact signed release APK cold install and launch: PASS; version 0.2.45 (48),
  `MainActivity` resumed, and no app crash/ANR was logged.
- APK v2 signature, ZIP alignment, AAB JAR signature, required bundle entries,
  checksums, and byte identity: PASS.

Full evidence: `docs/PRE_RELEASE_TEST_REPORT_0.2.45.md`.

## Required Closed Testing

- Confirm the pale teal-gray paused row and solid dark-teal perimeter are easy
  to locate without implying active scan progression.
- Confirm review acknowledgements after state-changing selections are
  understood and do not create avoidable fatigue.
- Repeat default/200% font size with default/larger display size on the Galaxy
  S23 Ultra.
- Exercise Taiwan TTS, Android predictive back, text export, Activity
  recreation, and optional camera input with users and helpers.
