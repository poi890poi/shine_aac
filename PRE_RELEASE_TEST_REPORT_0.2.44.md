# SHINE AAC 0.2.44 Pre-release Test Report

Generated: 2026-08-11

## Candidate

- Version: 0.2.44
- Android version code: 47
- Target SDK: 36
- APK: `shine-aac-v0.2.44-code47-release.apk`
- AAB: `shine-aac-v0.2.44-code47-release.aab`

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| AOSP English dictionary integrity | PASS | 27,717 source-ranked entries after 6,534 simple +s forms are removed during generation; 0 normalized duplicates; 0 invalid retained forms |
| English ranking simplification | PASS | Prefixes and word boundaries preserve AOSP unigram order; handcrafted AAC priority and transition tables removed |
| Core-level recommendation nonredundancy | PASS | English, custom, zh-TW, and embedded-English unit coverage; filtering occurs before the visible limit so later useful candidates backfill duplicates |
| Quick core/web suite | PASS | 123 / 123 core and 3 / 3 web configuration tests |
| Full core suite | PASS | 237 / 237, including the reviewed communication baseline and large-corpus acceptance |
| Communication efficiency gate | PASS | 109 / 109 against the reviewed baseline after the intentional plural-policy change |
| Source and packaged Web interaction/scanning E2E | PASS | complete source run followed by rebuilt packaged-WebView run, including large text, tablet, zh-TW locale, Demo, and embedded-English board |
| Packaged WebView interaction/scanning E2E | PASS | 41 steps including asset build, oversized English, dense 13-row Zhuyin, locale, and embedded-English suggestions |
| Scan timing invariant | PASS | non-polling trace covers Reset/init, automatic row switch before activation, row activation, automatic column switches, and column activation; visible restart limit 80 ms and deadline-drift limit 50 ms |
| Million-entry computation gate | PASS | adversarial English cold prefix: one 1,000,000-entry preparation pass in 640 ms and zero later scan reads; empty English: 8 reads; empty zh-TW: 45 reads |
| Physical Android pause regression | PASS | user verified the scan-optimized candidate on a real Android device before official history reconstruction |
| Android emulator hardware-input E2E | PASS | installed final debug assets, Config long-press Demo, volume-key entry of `I want water `, process recreation, and zh-TW first-layer render |
| Android font mapping unit test | PASS | 85%, 100%, 130%, and 200%, plus bounds |
| Kotlin compile and Android unit tests | PASS | app and camera input modules |
| Signed release APK/AAB | PASS | `assembleRelease bundleRelease`, data policy, upload-key signing |
| Physical Samsung scaling matrix | OPEN | emulator automation passes; a physical Samsung check remains required for device-specific font/display behavior |

## Current Artifacts

These files contain the active filtered AOSP English dictionary and simplified source-order ranking. Sizes and hashes below are replaced after the final clean-history build:

- APK: 42,493,955 bytes; SHA-256
  `f9ae42bcf1e5adc3297d9c2327168401eefff0e4cbf44f99933fb5979af0dd50`.
- AAB: 22,184,114 bytes; SHA-256
  `3af69b04dbd130457eae7683dff2beb0d6ff55727db17c2f829723f1611dfbbe`.

## Decision

Ready for closed-tester handoff. Source and packaged-WebView E2E pass and the
APK/AAB were rebuilt and signed from the amended source. The reporting Samsung
phone must still pass default/200% font with default/larger display size,
especially the combined maximum case, before wider promotion. This remains an
early test build and must not be the user's only or emergency communication
method.
