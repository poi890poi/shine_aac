# SHINE AAC Testing Report

Current candidate: 0.2.36, Android code 39.

Current focused results: `docs/PRE_RELEASE_TEST_REPORT_0.2.36.md`

Previous full core/efficiency baseline: `docs/PRE_RELEASE_TEST_REPORT_0.2.35.md`

## Summary

| Layer | Result | Evidence |
| --- | --- | --- |
| Quick core | PASS | 93 / 93 tests; core unchanged from full code-38 baseline |
| Full core and efficiency baseline | PASS | 200 / 200 tests; 103 / 103 benchmark tasks |
| Android input unit and lint | PASS | 14 / 14 unit tests; no lint errors |
| Source and packaged browser E2E | PASS | 31 steps in each run |
| Android APK lifecycle | PASS | hardware input, native draft, forced process recreation, zh-TW render |
| APK package | PASS | `shine-aac-v0.2.36-code39-debug.apk` |
| Human UX | OPEN | physical-device owner/helper/user review required |

The APK is approved for owner/internal UX testing, not production or Google Play upload.

## 2026-07-15 Large-text Compatibility Rerun

- Quick core: PASS, 93 / 93 tests.
- Android inputs: PASS, 14 / 14 unit tests, including five camera preview geometry cases.
- Android lint: PASS, 0 errors; one pre-existing redundant-label warning.
- Source Web E2E: PASS, including doubled AAC typography and long custom labels.
- Packaged WebView E2E: PASS on rerun; one prior timing run selected an adjacent Zhuyin symbol and did not reproduce.
- API 34 emulator at font scale 2.0: PASS on phone portrait and tablet portrait/landscape.
- Live emulated front camera: PASS with aspect-correct 3:4 portrait and 4:3 landscape preview.
- Narrow-phone controls: PASS; preview remains fixed while actions remain reachable in the independent scroll pane.

These fixes are present in `app/build/outputs/apk/debug/app-debug.apk`. The older versioned APK in `.artifacts/releases/v0.2.35` predates this rerun and does not contain them.
