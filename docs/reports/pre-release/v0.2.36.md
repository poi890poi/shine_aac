# SHINE AAC Focused Pre-release Test Report

Generated: 2026-07-17T20:16:00+08:00

## Candidate

- Version: 0.2.36
- Android version code: 39
- Package: `org.shineaac.app`
- Artifact: `shine-aac-v0.2.36-code39-debug.apk`
- Size: 43,316,963 bytes
- SHA-256: `4b0ae1a502bf8615fd2ef60b8ad9aba6571c01d7a4b2692df852b92b281dd845`

## Decision

PASS for owner/internal UX testing. This artifact is debug-signed and is not the Play Store release AAB.

## Changes Since Code 38

- Added redundant current-draft persistence in WebView local storage and Android private SharedPreferences.
- Added lifecycle saves when the app becomes hidden or its WebView page unloads.
- Draft restore validates the schema/profile and selects the newest valid copy.
- Added a user-facing App Info page with runtime version, purpose, local-data/privacy facts, and help links.
- Bumped the visible version to 0.2.36 (39), removing ambiguity with the earlier test APK.

No AAC core, dictionary, coverage, or efficiency logic changed after the code-38 full pre-release baseline.

## Verification

| Layer | Result | Evidence |
| --- | --- | --- |
| JavaScript syntax | PASS | app and E2E scripts parsed successfully |
| Quick core | PASS | 93 passed, 0 failed |
| Android input unit tests | PASS | 14 passed, 0 failed |
| Android lint | PASS | no errors; existing toolchain notices only |
| Source browser E2E | PASS | 31 steps; 122.8 sec |
| Packaged WebView E2E | PASS | 31 steps; 120.6 sec |
| App Info content | PASS | required user content present; diagnostics and test instructions absent |
| Android hardware input | PASS | entered `I want water ` through volume-key switch input |
| Native draft persistence | PASS | Android private draft contained the composed message |
| Process recreation | PASS | message restored after forced app stop and restart |
| Packaged zh-TW render | PASS | direct Zhuyin first layer rendered after restart |
| Backup policy | PASS | Android backup disabled; all app-data domains excluded |
| APK metadata/install | PASS | emulator reports 0.2.36, code 39; exact artifact installed |
| Signature/alignment | PASS | debug v2 signature and ZIP alignment verified |

The optional coordinate-based Demo long-press emulator check initially could not run because Android system and launcher ANR dialogs owned window focus. After the emulator overlay was cleared, the deterministic APK lifecycle run passed. Demo mode itself passed in both source and packaged browser E2E.

## What To Test Manually

1. Compose a message, leave/reopen the app, and use Android Developer Options to destroy/recreate the Activity; confirm the message remains.
2. Confirm App Info reports `0.2.36 (39)` and contains only useful app, data, privacy, and support information.
3. On a phone, confirm portrait layout stays clear of status/navigation controls and remains awake past the normal display timeout.
4. On a tablet, check portrait and landscape rotation, message persistence, and system-bar clearance.
5. At a large Android font size, confirm long AAC labels stay inside cells and all controls remain reachable.
6. In Camera setup, confirm the preview keeps the correct aspect ratio, has useful space, and all controls remain reachable.
7. Confirm local text history and Export text contain the expected messages.

## Baseline Not Repeated

The hours-long full 200-test core, dictionary/coverage reports, and 103-task efficiency benchmark passed for code 38 and were not repeated for this shell-only persistence and App Info patch. Their code and data inputs did not change. Quick core plus both full UI E2E variants were rerun.
