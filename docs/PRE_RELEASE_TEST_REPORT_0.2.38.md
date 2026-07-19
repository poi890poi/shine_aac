# SHINE AAC Focused Pre-release Test Report

Generated: 2026-07-19T09:52:49+08:00

## Candidate

- Release source commit: `4cd343d`
- Source tag: `v0.2.38`
- Version: 0.2.38
- Android version code: 41
- Package: `org.shineaac.app`
- Play Internal testing AAB: `shine-aac-v0.2.38-code41-release.aab`
- AAB size: 21,815,991 bytes
- AAB SHA-256: `cdda55df0eda443fb4e8d4eda1480dcbdcb4991f598e6938830b38e872aaf7f4`

## Decision

PASS for Google Play Internal testing upload and subsequent owner/helper/user testing.

Upload this file to Play Console:

- `.artifacts/releases/v0.2.38/shine-aac-v0.2.38-code41-release.aab`
- `.artifacts/releases/v0.2.38/PLAY_AAB_SHA256SUMS.txt`

The AAB is not directly installable. The retained 0.2.37 code-40 debug APK remains separate runtime-test evidence and must not be uploaded to Google Play. Confirm in Play Console that version code 41 is unused before uploading.

## Changes Since 0.2.37

- Prioritized fundamental non-initial Zhuyin continuations ahead of speculative glyph and word candidates while preserving exact-candidate priority for completed syllables.
- Made demo composition page through normal bounded `更多` controls for required Zhuyin symbols as well as final candidates.
- Scaled demo target timeouts to legal scanner settings and reduced column counts.
- Treated intentional demo cancellation as normal completion instead of leaking a false error.
- Added independent core ordering regressions and a two-column rendered demo regression that must complete a candidate after selecting a later-page continuation.

## Verification

| Layer | Result | Evidence |
| --- | --- | --- |
| Full core | PASS | 212 passed, 0 failed |
| Efficiency reports | PASS | inventory, phonetic access, and 103-task paired communication report regenerated |
| Paired communication gates | PASS | activations 846 to 836; scan time 2,866.3 to 2,663.4 sec; `更多` 68 to 63; no task regression |
| Source browser E2E | PASS | 31 steps, including later-page Zhuyin demo commit |
| Packaged WebView E2E | PASS | 32 steps including asset build and the same demo regression |
| Android data policy | PASS | cloud backup disabled and all app-data domains excluded |
| Signed Play AAB build | PASS | Gradle `bundleRelease`; 112 tasks |
| Package metadata | PASS | `org.shineaac.app`, version 0.2.38, code 41 |
| Bundle structure | PASS | `BundleConfig.pb`, base manifest, resources, DEX, and upload-key signature entries present |
| AAB signature | PASS | JAR signature verified with the existing SayToMe AAC upload key |
| AAB byte identity | PASS | versioned artifact SHA-256 matches Gradle `app-release.aab` |

## Internal Tester Focus

1. Compose continuation-heavy Zhuyin syllables and confirm fundamental symbols are offered before speculative glyphs or words.
2. Use `更多` to reach displaced continuation symbols and confirm the intended candidate remains completable.
3. Run auto demo with two-column and slower scan settings; confirm it pages normally and continues.
4. Tap to exit demo mode, then continue normal scanning without stale holds or errors.
5. Listen to Mandarin TTS and activation feedback on the physical device.
6. Run real-person camera alignment, blink detection, and calibration.
7. Upgrade from the installed code-40 build and perform a clean Internal testing install; verify settings, draft restoration, and reset behavior.

## Open Items

- Physical Samsung/device-owner/helper UX review.
- Real-person camera and Mandarin TTS validation.
- Play Console owner upload, tester assignment, and Internal testing rollout.

GitHub CI publication is unrelated to the Google Play Internal testing upload.
