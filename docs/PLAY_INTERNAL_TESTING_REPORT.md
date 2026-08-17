# SHINE AAC Google Play Closed Testing Report

Generated: 2026-08-14

## Upload Artifact

- Track: Google Play Closed testing
- Application source commit: `111576a8d51fba2f2f0d8baf1089f02ef897688e`
- Application source tag: `v0.3.0` (not created)
- Package: `org.shineaac.app`
- Version: 0.3.0 (49)
- Compile SDK: 36
- Target SDK: 36
- File: `shine-aac-v0.3.0-code49-release.aab`
- Release-package path: `binaries/shine-aac-v0.3.0-code49-release.aab`
- Size: 22,193,769 bytes
- SHA-256: `6a65a3927935648bd24d79d5f2795d7aa35593105beb727d75e09a678b50d95b`
- Checksum file: `binaries/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and primary DEX verified
- Byte identity: versioned AAB matches Gradle's signed `app-release.aab`

## Decision

READY for Google Play Closed testing after the owner confirms that version code
49 is unused. Upload the versioned AAB, not the APK. This remains an early test
build and is not approved for a broader track until the escape ladder,
suggestion changes, scaling matrix, speech, and human AAC workflow are reviewed
on real devices.

## Supporting Verification

- Full AAC core: 248 / 248 tests passed.
- Web unit tests: 11 / 11 passed.
- Communication reachability: 103 / 103 tasks; frozen paired gates passed.
- Source and packaged-WebView E2E: PASS, including the miss-tolerant escape
  ladder, suggestion behavior, and review-release behavior.
- Cumulative visible scan timing: PASS at 80 row and 80 cell transitions.
- Android data policy, app/input unit tests, and lint: PASS.
- Exact signed release APK install and launch: PASS; version 0.3.0 (49),
  `MainActivity` resumed, and no app crash/ANR was logged.
- APK v2 signature, ZIP alignment, AAB JAR signature, required bundle entries,
  checksums, and byte identity: PASS.

Full evidence: `docs/PRE_RELEASE_TEST_REPORT_0.3.0.md`.

## Required Closed Testing

- Confirm two missed item passes, return to rows, stopped scanning, and
  wake-only activation are understood without avoidable fatigue.
- Review the bounded first-symbol reranking and weak-intent sensitive-label
  demotion with Taiwan users and helpers.
- Repeat default/200% font size with default/larger display size on the Galaxy
  S23 Ultra.
- Exercise Taiwan TTS, Android predictive back, text export, Activity
  recreation, and optional camera input with users and helpers.
