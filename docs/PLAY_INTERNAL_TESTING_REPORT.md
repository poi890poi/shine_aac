# SHINE AAC Google Play Internal Testing Report

Generated: 2026-07-22

## Upload Artifact

- Track: Google Play Internal testing
- Application source tag: `v0.2.41`
- Package: `org.shineaac.app`
- Version: 0.2.41 (44)
- Compile SDK: 36
- Target SDK: 36
- File: `shine-aac-v0.2.41-code44-release.aab`
- Local path: `.artifacts/releases/v0.2.41/shine-aac-v0.2.41-code44-release.aab`
- Size: 21,804,529 bytes
- SHA-256: `ffe2ae5825e187db75ec88f0e6e50822f3aa656cdd8bd2b56023a421fd9dbf3e`
- Checksum file: `.artifacts/releases/v0.2.41/PLAY_AAB_SHA256SUMS.txt`
- Signing: existing private upload key; JAR signature verified
- Bundle structure: `BundleConfig.pb`, base manifest, resources, and DEX entries verified
- Byte identity: versioned AAB matches the Gradle `app-release.aab` output

## Decision

PASS for upload to the Google Play Internal testing track. Upload the versioned `.aab`, not the debug `.apk`.

The debug APK remains useful only for direct emulator/device installation and runtime smoke testing. Google Play generates installable APKs from the uploaded AAB.

Do not upload the superseded code-43 bundle. Before upload, confirm that version code 44 has not already been used in Play Console.

## Supporting Verification

- Full core: 215 / 215 tests passed, including the exact 47-snapshot reported export fixture.
- Paired communication evaluator: 103 / 103 tasks passed with all regression gates passing.
- Source browser E2E: 34 steps passed.
- Packaged WebView E2E: 35 steps passed, including the asset build, history/export regressions, back navigation, and later-continuation demo regression.
- Android inputs: 14 / 14 unit tests passed; API-36 lint had no errors across all modules.
- Android build: all modules compiled and assembled against API 36; the merged release manifest confirms target SDK 36.
- Existing API 34 emulator installed code 44 and displayed `MainActivity` without an app crash. The timed switch run was inconclusive because unrelated Android system processes ANRed under resource pressure.
- Release bundle build: Gradle `bundleRelease` passed with 137 actionable tasks.
- Android data policy: cloud backup disabled and all app-data domains excluded.

The exact reported legacy sequence compacts to two lines: `聽 podcast 新資料夾` and `冰紅茶少冰不要太甜`. Browser integration also repairs code-42 version-2 storage through the real export path.

Android 16 physical-device predictive-back/insets/tablet behavior, Mandarin TTS, real-person camera, and human AAC UX evaluation remain goals of the Internal testing run.
