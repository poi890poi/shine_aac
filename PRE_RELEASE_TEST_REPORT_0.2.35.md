# SHINE AAC Pre-release Test Report

Generated: 2026-07-14T23:53:41+08:00

## Candidate

- Version: 0.2.35
- Android version code: 38
- Package: `org.shineaac.app`
- Source base: `3ac103cfacc47c0bc78edd45477ddaec24a0bccc`
- Source state: base commit plus current uncommitted candidate changes
- Artifact: `shine-aac-v0.2.35-code38-debug.apk`
- Size: 43,314,755 bytes
- SHA-256: `3a5af45ee89969a7d170e449e5fd6164e70f3bb0a843db9685b763ef6311dbb6`

## Release Decision

PASS for owner/internal UX testing.

This is not a production or Google Play artifact. It is debug-signed, human UX review is still open, and the source changes must be committed before a reproducible release build is made.

## Test Summary

| Layer | Command / Method | Result | Count / Evidence |
| --- | --- | --- | --- |
| Full core | `npm test` | PASS | 200 passed, 0 failed; 196.9 sec test duration |
| Efficiency reports | `npm run report:efficiency` | PASS | inventory, phonetic, and 103-task communication reports regenerated |
| Android unit | `gradlew testDebugUnitTest` | PASS | 9 passed, 0 failed |
| Android lint | `gradlew lintDebug` | PASS | all modules; no lint errors |
| Source browser E2E | `npm run test:web:e2e` | PASS | 112 sec |
| Packaged browser E2E | `npm run test:web:packaged` | PASS | 28 steps; 112.8 sec |
| Backup policy | release policy verifier | PASS | backup disabled; all app-data domains excluded |
| Android build/package | `package-release.bat` | PASS | versioned code-38 APK created |
| Phone APK runtime | API 34 emulator, cold boot | PASS | install, demo, hardware input, zh-TW render |
| Tablet portrait runtime | `sw800dp`, 1600x2560, 320 dpi | PASS | install, hardware input, zh-TW render, system-taskbar clearance |
| Tablet landscape runtime | `sw800dp`, 2560x1600 | PASS | main board, Config, Input Test, Camera Setup, rotation persistence |
| Camera permission recovery | deny permission in Camera Setup | PASS | recovery text and Open app settings action visible |
| Camera initialization | emulated front camera | PASS | Camera2 device 1 open, nonblank rotated preview, no app exception |
| Artifact verification | `aapt`, `apksigner`, `zipalign`, install | PASS | metadata, v2 signature, alignment, assets, exact APK install |

## Core And Efficiency

The full deterministic suite passed 200 of 200 tests. It includes scanner/message behavior and the intentionally long communication benchmark cases.

The regenerated reports retain the designed previous-version comparisons:

| Metric | Previous | Current | Difference |
| --- | ---: | ---: | ---: |
| Dictionary entries | 60,000 | 60,000 | 0 |
| Weighted phonetic reachability | 98.87% | 98.87% | 0.00 pp |
| Direct glyph reachability | 85.30% | 85.30% | effectively 0.00 pp |
| Direct word/phrase reachability | 98.22% | 98.22% | effectively 0.00 pp |
| Top-500 glyph direct reachability | 98.60% | 98.60% | 0 pp |
| Top-500 phrase direct reachability | 99.20% | 99.20% | 0 pp |
| Benchmark tasks passing | 103 | 103 | 0 |
| Average switch activations | 8.16 | 8.16 | effectively 0 |
| Median switch activations | 4 | 4 | 0 |

No broad dictionary, coverage, or efficiency regression was detected.

Known benchmark gaps remain:

- Average switch activations: 8.16 versus target at most 6.
- Average estimated scan time: 27.02 sec versus target at most 15 sec.
- Median estimated scan time: 13.80 sec versus urgent-phrase target at most 10 sec.
- Multi-concept utterance evidence: 16 of target 120.
- Licensed/reviewed sentence audit: 0; generated filler is intentionally not counted.

## Browser Evidence

Both source modules and the exact esbuild-generated WebView asset tree passed. The packaged run reported 28 passing steps, including:

- clean first launch uses zh-TW
- row/cell progress and camera hold behavior
- phrase entry, undo, clear, completion, and delete
- local text history save/export and current-draft restoration
- demo and input-calibration behavior
- phone portrait, tablet portrait, and tablet landscape fit
- Config action reachability
- zh-TW migration, reset, and direct Zhuyin rendering

Chrome emitted GCM deprecated-endpoint and Cast CRL messages. These are browser infrastructure messages and did not affect product assertions.

## Android Runtime Evidence

Phone API 34 cold-boot smoke passed installation and entered `I want water ` using Android volume-key events. It also verified the packaged zh-TW first layer.

Tablet testing used Android's active runtime configuration, not a resized marketing screenshot:

- portrait: `sw800dp`, 1600x2560, 320 dpi
- landscape: `sw800dp`, 2560x1600, rotation 90
- Android taskbar/system controls remained visible during screenshots
- main board rows and all bottom actions remained clear of system controls
- Config, Input Test, and Camera Setup actions remained reachable
- `KEEP_SCREEN_ON` was present on MainActivity and CameraSwitchCalibrationActivity
- `I want water ` survived portrait-to-landscape Activity recreation
- no app crash or ANR appeared in the runtime checks

Camera checks covered permission denial/recovery and Camera2 startup. After enabling the AVD's emulated front camera, Camera2 reported device 1 open for `org.shineaac.app`; the landscape preview was nonblank and controls stayed reachable. The synthetic camera scene cannot validate real face/eye classification quality.

Two tablet automation attempts initially failed before product assertions because the helper used phone-specific Config coordinates. The helper was corrected to prefer active `wm size` overrides and gained switches to separate the phone demo gesture from reusable input/render and lifecycle checks. The corrected tablet tests passed.

## Artifact Verification

- `aapt`: package `org.shineaac.app`, versionName 0.2.35, versionCode 38
- minSdk 25, targetSdk 35, compileSdk 35
- `apksigner`: APK Signature Scheme v2 verified; Android debug certificate
- `zipalign`: verification successful
- embedded assets include `index.html`, `src/bundle.js`, and `src/styles.css`
- versioned artifact and Gradle intermediate have identical size and SHA-256
- the exact versioned artifact installed successfully; Android reported version 0.2.35 code 38

## Warnings And Open Checks

- Android Gradle Plugin 8.5 is officially tested only through compileSdk 34, while this project compiles with SDK 35. Build and lint passed.
- Gradle reports deprecated features that will need attention before Gradle 9.
- Physical Samsung navigation-bar/gesture behavior still needs owner confirmation.
- Real-person camera alignment, blink detection, and calibration remain device tests.
- Mandarin TTS voice, volume, and pronunciation require listening on the target device.
- Human AAC UX review, comfort, comprehension, and fatigue review remain open.
- This candidate was built from uncommitted worktree changes. Commit and rebuild before Play upload or a durable tagged release.

## Evidence Files

- `docs/COMMUNICATION_BENCHMARK_REPORT.md`
- `docs/ZHTW_DICTIONARY_INVENTORY_REPORT.md`
- `docs/ZHTW_PHONETIC_ACCESS_REPORT.md`
- `docs/WEB_E2E_REPORT.md`
- `e2e-artifacts/hardware-button-final.png`
- `e2e-artifacts/tablet-current.png`
- `e2e-artifacts/tablet-landscape.png`
- `e2e-artifacts/tablet-landscape-config.png`
- `e2e-artifacts/tablet-landscape-input-test.png`
- `e2e-artifacts/tablet-landscape-camera-denied.png`
- `e2e-artifacts/tablet-landscape-camera-emulated.png`
- `e2e-artifacts/tablet-rotation-persisted.png`
