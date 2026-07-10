# SHINE AAC Testing Report

Generated: 2026-07-10

Methodology: `docs/TESTING_PLAN.md`

## Summary

| Layer | Command / Method | Result | Count / Stats | Report |
| --- | --- | --- | --- | --- |
| Core unit and benchmark tests | `npm test` | PASS | 199 passed, 0 failed | this report |
| Communication benchmark report | `node scripts/report-communication-benchmarks.mjs` | PASS | 103 / 103 benchmark tasks passing | `docs/COMMUNICATION_BENCHMARK_REPORT.md` |
| Browser E2E | `npm run test:web:e2e` with fresh ports | PASS | 16 reported steps/artifacts, Pixel 4a 5G viewport fit checks pass | `docs/WEB_E2E_REPORT.md` |
| Android debug build | `.\build-test.bat -SdkDir E:\Android\Sdk` | PASS | Gradle debug APK built | `docs/APK_REPORT.md` |
| APK package | `.\package-release.bat -SdkDir E:\Android\Sdk` | PASS | `shine-aac-v0.2.3-code6-debug.apk`, SHA-256 `1b1f8945bb15479c41a8ffe6105935ea1fcf694821d3fdec88aa98b2626ed2f4` | `docs/APK_REPORT.md` |
| Human UX verification | manual Taiwan trial checklist | Pending | owner/helper/user feedback required | release notes / UX notes |

## Current Communication Benchmark Stats

| Metric | Current | Target | Status |
| --- | ---: | ---: | --- |
| Benchmark pass rate | 103 / 103 | 100% | pass |
| Direct zh-TW phonetic symbols | 98.87% weighted coverage | >= 98% | pass |
| Dead-end continuation symbols | 0 | 0 | pass |
| Top zh-TW glyph reachability | 222 / 224 (99.11%) | >= 99% | pass |
| Top zh-TW phrase reachability | 141 / 141 (100.00%) | >= 95% | pass |
| Multi-concept utterance coverage | 16 | 120 | gap |
| Corpus-style zh-TW sentence audit | 0 | external 400-sentence reference scale | gap |
| Average switch activations | 8.16 | <= 6 | gap |
| Median switch activations | 4.00 | <= 4 | pass |
| Average estimated scan time | 27.02 sec | <= 15 sec | gap |
| Median estimated scan time | 13.80 sec | <= 10 sec urgent phrase target | gap |

## What The Core Tests Cover

- scanner state machine, row/cell scanning, wrapping, skipped empty rows, transition pause, and latency compensation
- message composition, append, space, delete, clear, undo, and replacement candidate behavior
- board parsing, chunking, density, localized labels, profile defaults, and migration
- English defaults, auto-spacing, and suggestion ranking
- `zh-TW` no-space composition, function labels, direct Zhuyin board, English `EN` entry point, and profile isolation
- `zh-TW` source-backed suggestion quality: exact syllable ranking, valid continuations, dense suggestion pages, no dead-end visible continuations, no unrelated filler for typed buffers, bounded `更多` pages
- deterministic virtual communication benchmarks for English core words, `zh-TW` first-page/second-page/third-page phrases, multi-concept utterances, phonetic home-setting expressions, and occasional English inside `zh-TW`

Reachability and efficiency tests do not use real-time sleeps. They select through visible core rows and suggestions, then count selections, switch activations, scanner advances, and estimated configured scan time.

## What Browser E2E Covers

- clean browser launch and rendered board/message panel
- visible one-switch row/column scanning for `I want water `
- undo correction from `WATER` to `FOOD`
- clear, delete, and partial-word completion
- suggestion review hold and input calibration behavior
- demo mode start/exit smoke test
- stale `zh-TW` config migration and reset to packaged defaults
- `zh-TW` rendered labels and replacement suggestions
- Pixel 4a 5G-sized viewport fit without vertical scrolling

Browser E2E intentionally stays small. It verifies rendered integration and normal-speed scanning smoke flows; it does not replace the virtual communication benchmark suite.

## What APK Checks Cover

The latest Android build check passed with:

```powershell
.\build-test.bat -SdkDir E:\Android\Sdk
```

The current prerelease package step generated:

```text
releases/v0.2.3/shine-aac-v0.2.3-code6-debug.apk
SHA-256: 1b1f8945bb15479c41a8ffe6105935ea1fcf694821d3fdec88aa98b2626ed2f4
```

Runtime device/emulator smoke should be repeated when native shell behavior changes, especially hardware switch input, TTS, storage, WebView loading, or Android permissions.

## UX Verification Still Needed

Before wider sharing, test the versioned APK on a real Android device:

| Case | Profile | Expected |
| --- | --- | --- |
| Early-development warning | all | downloader understands this is not a finished medical product |
| Basic urgent phrase | zh-TW | user/helper can enter and speak a short need |
| Longer thought or feeling | zh-TW | one-line message remains readable and repairable |
| Occasional English | zh-TW | `EN` opens English symbols and returns predictably |
| Repair controls | all | `復原`, `刪`, and `清除` are understandable and recover mistakes |
| Scan timing comfort | all | first cell is not rushed and total pace is tolerable |
| Audio/TTS | zh-TW | Mandarin voice and volume are acceptable on device |
| Layout fit | phone viewport | rows do not clip and message area does not grow vertically |

Known benchmark gaps are not blockers for a small UX trial, but they are blockers for claiming broad daily-conversation readiness.
