# SHINE AAC 0.2.44 Pre-release Test Report

Generated: 2026-08-10

## Candidate

- Version: 0.2.44
- Android version code: 47
- Target SDK: 36
- APK: `shine-aac-v0.2.44-code47-release.apk`
- AAB: `shine-aac-v0.2.44-code47-release.aab`

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| AOSP English dictionary integrity | PASS | 34,251 source-ranked entries; 0 normalized duplicates; 0 invalid retained forms; all 26 initial letters have at least four candidates |
| English ranking simplification | PASS | Prefixes and word boundaries preserve AOSP unigram order; handcrafted AAC priority and transition tables removed |
| Core-level recommendation nonredundancy | PASS | English, custom, zh-TW, and embedded-English unit coverage; filtering occurs before the visible limit so later useful candidates backfill duplicates |
| Quick core/web suite | PASS | 119 / 119 core and 3 / 3 web configuration tests |
| Communication efficiency gate | REGRESSION | 108 / 109; `shine-current-want-water` remains reachable but rises from 6.4 s to 16.7 s after duplicate shortcuts are removed |
| Source and packaged Web interaction/scanning E2E | PASS | complete source run followed by rebuilt packaged-WebView run, including large text, tablet, zh-TW locale, Demo, and embedded-English board |
| Packaged WebView interaction/scanning E2E | PASS | 41 steps including asset build, oversized English, dense 13-row Zhuyin, locale, and embedded-English suggestions |
| Scan timing invariant | PASS | non-polling trace covers Reset/init, automatic row switch before activation, row activation, automatic column switches, and column activation; visible restart limit 80 ms and deadline-drift limit 50 ms |
| Android emulator hardware-input E2E | PASS | installed final debug assets, Config long-press Demo, volume-key entry of `I want water `, process recreation, and zh-TW first-layer render |
| Android font mapping unit test | PASS | 85%, 100%, 130%, and 200%, plus bounds |
| Kotlin compile and Android unit tests | PASS | app and camera input modules |
| Signed release APK/AAB | PASS | `assembleRelease bundleRelease`, data policy, upload-key signing |
| Physical Samsung scaling matrix | OPEN | emulator automation passes; a physical Samsung check remains required for device-specific font/display behavior |

## Current Artifacts

These files contain the active AOSP English dictionary and simplified source-order ranking:

- APK: 42,525,831 bytes; SHA-256
  `87274611c7f57dd6f4e613529687d7726c013229d351e76d46cbe9636b70cf42`.
- APK ZIP: 21,975,618 bytes; SHA-256
  `5f0350342915b748a1f0fa5fb1493be8ba6f5009b7aa95d84430002ed1c92ab3`.
- AAB: 22,216,672 bytes; SHA-256
  `1f1a55c481e852577ed8144b4299cf049602de9d6aed54da30ca3abdb1db5620`.

## Decision

Ready for closed-tester handoff. Source and packaged-WebView E2E pass and the
APK/AAB were rebuilt and signed from the amended source. The reporting Samsung
phone must still pass default/200% font with default/larger display size,
especially the combined maximum case, before wider promotion. This remains an
early test build and must not be the user's only or emergency communication
method.
