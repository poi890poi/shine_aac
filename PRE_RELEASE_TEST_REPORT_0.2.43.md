# SHINE AAC 0.2.43 Pre-release Test Report

Generated: 2026-08-08

## Candidate

- Source branch: `main`
- Source tag: pending; artifacts were built from the current working tree
- Version: 0.2.43
- Android version code: 46
- Package: `org.shineaac.app`
- Compile SDK: 36
- Target SDK: 36
- Direct-install artifact: `shine-aac-v0.2.43-code46-release.apk`
- Play artifact: `shine-aac-v0.2.43-code46-release.aab`

## Result

SIGNED PACKAGE COMPLETE. CONDITIONAL for Google Play Internal testing.

The functional, browser, Android, signing, metadata, and package-integrity
checks pass. The frozen paired communication regression gate fails only its
elapsed-time limits: the first-use default changed from 1,300 ms to 1,800 ms in
response to reports that the prior speed was too fast. All 103 communication
tasks remain reachable, and switch activations improve from 846 to 822. The
frozen baseline was deliberately not changed.

Before upload, commit and tag the exact source used for these artifacts, confirm
that Play version code 46 is unused, and treat human timing review as a required
Internal-testing task. Do not promote this candidate to a broader track until
that review is complete.

| Gate | Result | Evidence |
| --- | --- | --- |
| Quick core | PASS | 110 / 110 functional tests |
| Web configuration unit tests | PASS | 2 / 2 tests |
| Full core | CONDITIONAL | 220 / 221; only the frozen paired scan-time regression gate failed |
| Communication task reachability | PASS | 103 / 103 tasks; 822 activations versus 846 frozen baseline |
| Communication elapsed time | EXPECTED TRADEOFF | 4,838.3 s total and 51.9 s P90 versus 2,866.3 s and 37.6 s baseline, caused by the slower first-use timing |
| Source browser E2E | PASS | 37 steps |
| Packaged WebView E2E | PASS | 38 steps, including asset generation |
| Export integration | PASS | Android save success, exact-document open, failure feedback, and browser export covered |
| Header learnability | PASS | no visible `Rows`, `First`, or `Symbols`; zh-TW status and distinct `⚙ 設定` control covered |
| Android input tests | PASS | 14 / 14 tests |
| Android lint | PASS | no errors across `app`, `android-inputs`, and `blinktest` |
| Signed release build | PASS | `assembleRelease bundleRelease`, 153 actionable tasks |
| Release manifest | PASS | package, version 0.2.43, code 46, min SDK 25, target SDK 36 |
| APK signature | PASS | APK Signature Scheme v2; one 4096-bit RSA upload-key signer |
| AAB signature | PASS | `jarsigner`: `jar verified` using the existing self-signed upload key |
| Bundle structure | PASS | configuration, base manifest, resources, and primary DEX present |
| Byte identity | PASS | versioned APK and AAB match Gradle outputs |
| Human AAC UX | OPEN | owner/helper/user review required, especially timing and the denser 37-symbol board |

## Artifacts

### Signed release APK

- Path: `.artifacts/releases/v0.2.43/shine-aac-v0.2.43-code46-release.apk`
- Size: 42,326,335 bytes
- SHA-256: `3aebcfbda7f202ffcca7ef35a176fe29e1a9de5855b5c605c658621d057372e0`
- Checksum: `.artifacts/releases/v0.2.43/RELEASE_APK_SHA256SUMS.txt`

### Signed Play AAB

- Path: `.artifacts/releases/v0.2.43/shine-aac-v0.2.43-code46-release.aab`
- Size: 22,030,625 bytes
- SHA-256: `18119ebe87e13303772d00680c60e4f97f5ecdace9fcddb87e87c9563ea9cb7d`
- Checksum: `.artifacts/releases/v0.2.43/PLAY_AAB_SHA256SUMS.txt`

## Internal Test Focus

- Confirm that `目前：選列` and `目前：選格` are understood as status text and
  that `⚙ 設定` is recognized as the control.
- Confirm that 1,800 ms is comfortable for first use, then calibrate per user.
- Find each of the 37 Zhuyin symbols without using `更多`.
- Distinguish function keys from input words and correct an error with `復原`.
- Save a text export, return to the App, and open the exact saved file.
- Verify Taiwan speech, `英文` announcement, predictive back, system insets,
  tablet rotation, Activity recreation, and optional camera input on devices.
