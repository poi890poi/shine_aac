# SHINE AAC Google Play Internal Testing Report

Generated: 2026-07-19

## Upload Artifact

- Track: Google Play Internal testing
- Application source tag: `v0.2.40`
- Package: `org.shineaac.app`
- Version: 0.2.40 (43)
- File: `shine-aac-v0.2.40-code43-release.aab`
- Local path: `.artifacts/releases/v0.2.40/shine-aac-v0.2.40-code43-release.aab`
- Size: 21,818,356 bytes
- SHA-256: `7d83b55a52cfc00b68acb4c238f5b6aeaa48899ba8b0763977a8a0e11710e0a2`
- Checksum file: `.artifacts/releases/v0.2.40/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and DEX entries verified
- Byte identity: versioned AAB matches the Gradle `app-release.aab` output

## Decision

PASS for upload to the Google Play Internal testing track. Upload the versioned `.aab`, not the debug `.apk`.

The debug APK remains useful only for direct emulator/device installation and runtime smoke testing. Google Play generates installable APKs from the uploaded AAB.

Do not upload the superseded code-42 bundle. Before upload, confirm that version code 43 has not already been used in Play Console.

## Supporting Verification

- Full core: 215 / 215 tests passed, including the exact 47-snapshot reported export fixture.
- Paired communication evaluator: 103 / 103 tasks passed with all regression gates passing.
- Source browser E2E: 34 steps passed.
- Packaged WebView E2E: 35 steps passed, including the asset build, history/export regressions, back navigation, and later-continuation demo regression.
- Android inputs: 14 / 14 unit tests passed; lint had no errors.
- Android 14 debug runtime: back gesture, system document-picker export, packaged demo, hardware input, process recreation, and zh-TW rendering passed.
- Release bundle build: Gradle `bundleRelease` passed with 112 tasks.
- Android data policy: cloud backup disabled and all app-data domains excluded.

The exact reported legacy sequence compacts to two lines: `聽 podcast 新資料夾` and `冰紅茶少冰不要太甜`. Browser integration also repairs code-42 version-2 storage through the real export path.

Physical-device Mandarin TTS, real-person camera, and human AAC UX evaluation remain goals of the Internal testing run.
