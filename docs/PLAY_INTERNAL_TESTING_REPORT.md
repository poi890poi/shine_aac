# SHINE AAC Google Play Internal Testing Report

Generated: 2026-07-19

## Upload Artifact

- Track: Google Play Internal testing
- Application source tag: `v0.2.39`
- Package: `org.shineaac.app`
- Version: 0.2.39 (42)
- File: `shine-aac-v0.2.39-code42-release.aab`
- Local path: `.artifacts/releases/v0.2.39/shine-aac-v0.2.39-code42-release.aab`
- Size: 21,817,785 bytes
- SHA-256: `3830c6f4aeb058a82ee25ac4ab0fff0c927fd05c2a03320502086ba2bc439df2`
- Checksum file: `.artifacts/releases/v0.2.39/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and DEX entries verified
- Byte identity: versioned AAB matches the Gradle `app-release.aab` output

## Decision

PASS for upload to the Google Play Internal testing track. Upload the versioned `.aab`, not the debug `.apk`.

The debug APK remains useful only for direct emulator/device installation and runtime smoke testing. Google Play generates installable APKs from the uploaded AAB.

Before upload, confirm that version code 42 has not already been used in Play Console. Google Play requires a new, higher version code for every subsequent upload.

## Supporting Verification

- Full core: 212 / 212 tests passed.
- Paired communication evaluator: 103 / 103 tasks passed with all regression gates passing.
- Source browser E2E: 34 steps passed.
- Packaged WebView E2E: 35 steps passed, including the asset build, history/export regressions, back navigation, and later-continuation demo regression.
- Android inputs: 14 / 14 unit tests passed; lint had no errors.
- Android 14 debug runtime: back gesture, system document-picker export, packaged demo, hardware input, process recreation, and zh-TW rendering passed.
- Release bundle build: Gradle `bundleRelease` passed with 112 tasks.
- Android data policy: cloud backup disabled and all app-data domains excluded.

Physical-device Mandarin TTS, real-person camera, and human AAC UX evaluation remain goals of the Internal testing run.
