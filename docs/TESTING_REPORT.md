# SHINE AAC Testing Report

Current candidate: 0.2.37, Android code 40.

Current focused results: `docs/PRE_RELEASE_TEST_REPORT_0.2.37.md`

Paired efficiency details: `docs/COMMUNICATION_BENCHMARK_REPORT.md`

## Summary

| Layer | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | 0 vulnerabilities |
| Full core and efficiency | PASS | 211 / 211 tests; 103 / 103 benchmark tasks |
| Android input unit and lint | PASS | 14 / 14 unit tests; no lint errors |
| Source and packaged browser E2E | PASS | 31 steps in each run |
| Android APK lifecycle | PASS | packaged demo, hardware input, native draft, forced process recreation, zh-TW render |
| APK package | PASS | `shine-aac-v0.2.37-code40-debug.apk`; SHA-256 verified |
| Play Internal testing AAB | PASS | signed `shine-aac-v0.2.37-code40-release.aab`; checksum and bundle signature verified |
| Human UX | OPEN | physical-device owner/helper/user review required |

The signed AAB is ready for Google Play Internal testing upload. The debug APK is retained only for direct-install runtime evidence and must not be uploaded to Play Console. GitHub Release publication is unrelated to the Play Internal testing handoff.

## 2026-07-18 0.2.37 Candidate

- Full core: PASS, 211 / 211 tests.
- Paired communication evaluator: PASS; estimated scan time improved 36.8 seconds with unchanged activations, paging, and P90 metrics.
- Source and packaged WebView E2E: PASS, 31 steps each, including demo-state reset and zh-TW behavior.
- Android inputs: PASS, 14 / 14 unit tests.
- Android lint: PASS, 0 errors; existing warnings remain documented.
- Exact APK runtime: PASS on a rebuilt API 34 test AVD, including packaged demo, hardware keys, persistence, and zh-TW render.
- Artifact metadata, v2 signature, ZIP alignment, installed version, byte identity, and SHA-256: PASS.
- Signed Play AAB: PASS; 21,815,396 bytes, JAR signature and required bundle entries verified, SHA-256 `940abb9cecb618dffe4a3057e69c37a4afe49b35c84ec99f3f38616a847b4aa9`.

## 2026-07-15 Large-text Compatibility Rerun

- Quick core: PASS, 93 / 93 tests.
- Android inputs: PASS, 14 / 14 unit tests, including five camera preview geometry cases.
- Android lint: PASS, 0 errors; one pre-existing redundant-label warning.
- Source Web E2E: PASS, including doubled AAC typography and long custom labels.
- Packaged WebView E2E: PASS on rerun; one prior timing run selected an adjacent Zhuyin symbol and did not reproduce.
- API 34 emulator at font scale 2.0: PASS on phone portrait and tablet portrait/landscape.
- Live emulated front camera: PASS with aspect-correct 3:4 portrait and 4:3 landscape preview.
- Narrow-phone controls: PASS; preview remains fixed while actions remain reachable in the independent scroll pane.

These fixes are included in the versioned 0.2.37 code-40 AAB and debug APK. Older versioned artifacts remain historical builds and do not contain the current Zhuyin and evaluator changes.
