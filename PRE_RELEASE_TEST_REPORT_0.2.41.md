# SHINE AAC 0.2.41 Pre-release Test Report

Generated: 2026-07-22

## Candidate

- Source branch: `main`
- Source tag: `v0.2.41` (to be created from the release commit)
- Version: 0.2.41
- Android version code: 44
- Package: `org.shineaac.app`
- Compile SDK: 36
- Target SDK: 36
- Play artifact: `shine-aac-v0.2.41-code44-release.aab`

## Result

PASS for Google Play Internal testing. Android 16 real-device behavior remains an Internal-testing requirement before promotion to a broader track.

| Gate | Result | Evidence |
| --- | --- | --- |
| Android toolchain | PASS | AGP 8.10.1, Gradle 8.11.1, JDK 17, Platform 36, Build Tools 36.0.0 |
| Full core | PASS | 215 / 215 tests |
| Communication evaluator | PASS | frozen 103-task paired baseline and all regression gates passed |
| Source browser E2E | PASS | rendered integration suite passed |
| Packaged WebView E2E | PASS | generated Android asset suite passed |
| Android unit tests | PASS | 14 / 14 `android-inputs` tests |
| Android lint | PASS | 0 errors across `app`, `android-inputs`, and `blinktest` |
| Debug assembly | PASS | all API-36 modules assembled |
| Release bundle | PASS | `bundleRelease`, 137 actionable tasks |
| Release manifest | PASS | version 0.2.41, code 44, min SDK 25, target SDK 36 |
| Signature | PASS | `jarsigner`: `jar verified` using the existing upload key |
| Bundle structure | PASS | configuration, base manifest, resources, and primary DEX present |
| Byte identity | PASS | versioned AAB matches Gradle's signed output |

## Artifact

- Path: `.artifacts/releases/v0.2.41/shine-aac-v0.2.41-code44-release.aab`
- Size: 21,804,529 bytes
- SHA-256: `ffe2ae5825e187db75ec88f0e6e50822f3aa656cdd8bd2b56023a421fd9dbf3e`
- Checksum file: `.artifacts/releases/v0.2.41/PLAY_AAB_SHA256SUMS.txt`

## Android 16 Review

- Existing `OnBackPressedCallback` integration satisfies the supported predictive-back dispatch path and remains covered by browser integration tests.
- MainActivity and camera setup already apply system-bar insets; lint found no edge-to-edge errors.
- Phone/tablet portrait, tablet landscape, short-height action reachability, and large-text layouts passed the existing rendered viewport suite.
- Android 16 can ignore orientation and resizability restrictions on large screens. This project no longer manifest-locks orientation and applies the phone portrait policy only below 600dp; tablet layouts remain adaptive.

## Runtime Limitation

The current API 34 emulator accepted and installed code 44, reported target SDK 36, started the app, and eventually displayed `MainActivity` without an app crash. The full timed hardware-switch run was not accepted as a pass because unrelated Android system processes ANRed and WebView startup took over one minute under emulator resource pressure. Do not reinterpret this infrastructure timeout as product evidence.

Internal testers should prioritize Android 16 predictive back, gesture/three-button system insets, tablet portrait/landscape, Save As export, Activity recreation, Mandarin TTS, and camera-switch setup before promotion.
