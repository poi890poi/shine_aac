# SHINE AAC Google Play Internal Testing Report

Generated: 2026-07-18

## Upload Artifact

- Track: Google Play Internal testing
- Application source tag: `v0.2.37`
- Package: `org.shineaac.app`
- Version: 0.2.37 (40)
- File: `shine-aac-v0.2.37-code40-release.aab`
- Local path: `.artifacts/releases/v0.2.37/shine-aac-v0.2.37-code40-release.aab`
- Size: 21,815,396 bytes
- SHA-256: `940abb9cecb618dffe4a3057e69c37a4afe49b35c84ec99f3f38616a847b4aa9`
- Checksum file: `.artifacts/releases/v0.2.37/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and DEX entries verified
- Byte identity: versioned AAB matches the Gradle `app-release.aab` output

## Decision

PASS for upload to the Google Play Internal testing track. Upload the versioned `.aab`, not the debug `.apk`.

The debug APK remains useful only for direct emulator/device installation and runtime smoke testing. Google Play generates installable APKs from the uploaded AAB.

Before upload, confirm that version code 40 has not already been used in Play Console. Google Play requires a new, higher version code for every subsequent upload.

## Supporting Verification

- Full core: 211 / 211 tests passed.
- Paired communication evaluator: 103 / 103 tasks passed with all regression gates passing.
- Source and packaged browser E2E: 31 steps passed in each run.
- Android inputs: 14 / 14 unit tests passed; lint had no errors.
- Exact debug APK runtime: packaged demo, hardware input, process recreation, and zh-TW rendering passed.
- Release bundle build: Gradle `bundleRelease` passed with 112 tasks.
- Android data policy: cloud backup disabled and all app-data domains excluded.

Physical-device Mandarin TTS, real-person camera, and human AAC UX evaluation remain goals of the Internal testing run.
