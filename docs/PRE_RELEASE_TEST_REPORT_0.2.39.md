# SHINE AAC Focused Pre-release Test Report

Generated: 2026-07-19

## Candidate

- Release source: `main` after the v0.2.39 release commit
- Source tag: `v0.2.39`
- Version: 0.2.39
- Android version code: 42
- Package: `org.shineaac.app`
- Play Internal testing AAB: `shine-aac-v0.2.39-code42-release.aab`
- AAB size: 21,817,785 bytes
- AAB SHA-256: `3830c6f4aeb058a82ee25ac4ab0fff0c927fd05c2a03320502086ba2bc439df2`

## Decision

PASS for Google Play Internal testing upload and subsequent owner/helper/user testing.

Upload these files to Play Console after the verification table is complete:

- `.artifacts/releases/v0.2.39/shine-aac-v0.2.39-code42-release.aab`
- `.artifacts/releases/v0.2.39/PLAY_AAB_SHA256SUMS.txt`

The AAB is not directly installable. Confirm in Play Console that version code 42 is unused before uploading.

## Changes Since 0.2.38

- Added internal Android back navigation before app exit.
- Changed text history from per-edit snapshots to one mutable line per text-area session.
- Added explicit history boundaries for clear, demo reset, and configuration reset/save.
- Replaced Android share export with a system Create Document file-save flow.
- Simplified export to one plain-text entry per line and preserved version-1 history during migration.

## Verification

| Layer | Result | Evidence |
| --- | --- | --- |
| Core regression | PASS | core code and frozen 103-task evaluator unchanged from the verified 0.2.38 candidate |
| Source browser E2E | PASS | 34 steps including live-line edits, reset boundary, migration, and back navigation |
| Packaged WebView E2E | PASS | 35 steps including asset build and the same regressions |
| Android unit/compile | PASS | `testDebugUnitTest`; 58 tasks |
| Android debug assembly | PASS | `assembleDebug`; 99 tasks |
| Android back runtime | PASS | Android 14 gestural-navigation emulator |
| Android file export runtime | PASS | system Create Document picker and UTF-8 saved-content smoke |
| Android data policy | PASS | cloud backup disabled and all app-data domains excluded |
| Signed Play AAB build | PASS | Gradle `bundleRelease`; 112 tasks |
| Package metadata | PASS | `org.shineaac.app`, version 0.2.39, code 42 |
| Bundle structure | PASS | required bundle entries and upload-key JAR signature verified |
| AAB byte identity | PASS | versioned artifact matches Gradle output at SHA-256 `3830c6f4aeb058a82ee25ac4ab0fff0c927fd05c2a03320502086ba2bc439df2` |

## Internal Tester Focus

1. Verify back gestures navigate through app pages before exiting from the root board.
2. Compose, correct, undo, and delete within one text-area session; confirm exported history contains one updated line.
3. Clear the text area, compose another message, and confirm exactly one new export line appears.
4. Save the `.txt` to different user-selected locations and open it with another app.
5. Upgrade from code 41 and verify configuration, draft restoration, and existing history.
6. Recheck Zhuyin continuation priority, `更多` reachability, and auto-demo completion.

## Open Items

- Physical Samsung/device-owner/helper UX review.
- Real-person camera and Mandarin TTS validation.
- Play Console owner upload, tester assignment, and Internal testing rollout.

GitHub CI publication is unrelated to the Google Play Internal testing upload.
