# SHINE AAC Testing Report

Current release candidate: 0.2.45, Android code 48, targeting Android 16 / API level 36.

Code 48 retains the learnability/export and adaptive layout work, makes review holds consistent after state changes, and replaces the heavy black hold frame with pale teal-gray tiles and a solid 3 px dark-teal whole-row perimeter.

Current focused results: `docs/reports/pre-release/v0.2.45.md`

Paired efficiency details: `docs/COMMUNICATION_BENCHMARK_REPORT.md`

## Summary

| Layer | Result | Evidence |
| --- | --- | --- |
| Clean dependency install | PASS | 0 vulnerabilities |
| Functional core | PASS | 237 / 237 full core tests; 10 / 10 web unit tests |
| Full core and efficiency | PASS | 103 / 103 communication tasks against the frozen paired baseline |
| Large-corpus computation | PASS | one-million-entry cold English prefix prepared once in 640 ms; empty English reads 8; empty zh-TW reads 45; scanning reads 0 corpus entries |
| Android input unit and lint | PASS | 14 / 14 unit tests; no lint errors |
| Source and packaged browser E2E | PASS | 52 source and 53 packaged steps, including held-row styling, release behavior, large text, tablet, zh-TW, Demo, and export |
| Android APK lifecycle | PASS | code-48 emulator: Config Demo, hardware input with review acknowledgements, process recreation, and zh-TW rendering |
| Signed release APK | PASS | code-48 APK; 42,489,045 bytes; SHA-256 `40c6426d2bebc2b5ecc7897a85e5464be12b3cc93f965556fc4ef544273e497e` |
| Play closed-testing AAB | PASS | code-48 AAB; 22,177,795 bytes; SHA-256 `2da121b0663ad9d2385f248b45a1381703b09829a365073337866b25765d86b9` |
| Human UX | PASS / OPEN | S23 Ultra adaptive layout passed; final paused-row device review remains a closed-testing task |

The current source and signed code-48 artifacts are ready for closed-tester handoff after confirming that Play version code 48 is unused.

## 2026-08-09 0.2.44 Code-47 Amendment

- Recommendation generation now performs core-level semantic/action-label deduplication against the full static board before truncation. English, custom, zh-TW, and embedded-English tests cover the invariant; in `podca`, `E`, `T`, and `空格` remain only in the static grid.
- The later official code-47 preparation adds a development-time simple-`+s` filter, reviews the resulting communication baseline, and passes 109 / 109 focused communication benchmarks.
- Function and word keys share spacing and typography. Built-in boards expose `英文`, `朗讀`, and `清除`, while contextual `復原` handles both single-input and compound-operation correction without a separate visible backspace key.
- Camera setup keeps `開始`, `測試`, and `完成` visible while secondary hold/zoom controls scroll, and all its zh-TW status text is localized.
- WebView text zoom follows Android font scale up to 200%; fixed cell labels have a tested 10px fitting floor.
- The zh-TW English sub-board reuses English suggestions and trims automatic boundary spaces; the demo now composes `聽podcast新資料夾` without selecting spaces.
- Full core/communication suite: PASS, 222 / 222. Final packaged WebView E2E: PASS, 41 steps. Kotlin compilation and Android unit tests: PASS.
- Physical Samsung combined font/display-size verification: OPEN and required before broader promotion.
- Signed APK: 42,345,611 bytes; SHA-256 `25d9a288264835cc103216f22b395c1276fd21416fb98dda57899deaa9a91ece`.
- Signed AAB: 22,036,425 bytes; SHA-256 `d725f2f361961cc81533f008dabcd8fd72a01c60d2b4e8e9dd60dd65ce5e7056`.

## 2026-08-08 0.2.43 Learnability And Export Candidate

- All 37 Zhuyin symbols are directly visible in seven stable rows; recommendation rows exclude redundant static symbols and hidden placeholders are not scanned.
- Function keys have consistent badges/icons. `復原` restores the prior candidate page, `EN` is announced as `英文`, and the header replaces `First` with `目前：選列／選格` beside a distinct `⚙ 設定` control.
- Text export uses Android Save As, reports the actual saved filename, and can open that exact document immediately. The user guide now has a dedicated export section.
- Quick core/web unit: PASS, 110 / 110 and 2 / 2.
- Source and packaged WebView E2E: PASS, 37 and 38 steps.
- Android inputs/lint/release build: PASS; 14 / 14 input tests, no lint errors, and signed APK/AAB produced.
- Full core: 220 / 221. All 103 communication tasks pass and activations improve from 846 to 822, but frozen scan-time thresholds fail because the new 1,800 ms default is intentionally slower than the 1,300 ms baseline.
- Signed APK: 42,326,335 bytes; SHA-256 `3aebcfbda7f202ffcca7ef35a176fe29e1a9de5855b5c605c658621d057372e0`.
- Signed AAB: 22,030,625 bytes; SHA-256 `18119ebe87e13303772d00680c60e4f97f5ecdace9fcddb87e87c9563ea9cb7d`.
- Release boundary: conditional Internal-testing candidate; exact source commit/tag and human timing/board review remain open.

## 2026-07-22 0.2.41 Android 16 Target

- Android build configuration: PASS; app and diagnostic targets compile against API 36, and release apps target API 36.
- Supported toolchain: PASS; Android Gradle Plugin 8.10.1, Gradle 8.11.1, JDK 17, Android SDK Platform 36, and Build Tools 36.0.0.
- Full core/evaluator: PASS, 215 / 215 tests; frozen 103-task paired baseline unchanged.
- Source and packaged WebView E2E: PASS, including history/export, back navigation, demo paging, Zhuyin priority, and phone/tablet viewport checks.
- Android unit/lint/debug build: PASS; 14 / 14 Android input tests, 0 lint errors across all modules, and API-36 debug assembly completed.
- Signed Play AAB: PASS; 21,804,529 bytes, version 0.2.41 code 44, target SDK 36, upload-key signature and required entries verified.
- SHA-256 and byte identity: PASS; `ffe2ae5825e187db75ec88f0e6e50822f3aa656cdd8bd2b56023a421fd9dbf3e`.
- API 34 emulator: current code-44 APK installed and `MainActivity` eventually rendered with no app crash. The timed switch flow was inconclusive because unrelated system processes ANRed under severe emulator pressure; it is not counted as a product pass.
- Internal-test focus: exercise predictive back, edge-to-edge controls, tablet/landscape layout, file export, and process recreation on an Android 16 device before wider promotion.

## 2026-07-19 0.2.40 Legacy Text-History Repair

- Root cause: code 42 preserved every version-1 per-input snapshot as a completed line during migration, so upgraded installs exported intermediate Zhuyin, Latin, and candidate states.
- Core regression: PASS; the exact 47-line user-reported export reduces to `聽 podcast 新資料夾` and `冰紅茶少冰不要太甜`.
- Boundary regression: PASS; explicit resets remain separate even when the next message extends previous text.
- Repair regression: PASS; candidate commits, deletion, and undo branches remain within one session.
- Upgrade integration: PASS; source and packaged WebView E2E repair both version-1 storage and polluted code-42 version-2 storage through the real export path.
- Full core/evaluator: PASS, 215 / 215 tests; frozen 103-task baseline unchanged.
- Android unit/compile: PASS; `testDebugUnitTest` completed 58 tasks.
- Signed Play AAB: PASS; 21,818,356 bytes, version 0.2.40 code 43, upload-key signature and required entries verified.
- SHA-256 and byte identity: PASS; `7d83b55a52cfc00b68acb4c238f5b6aeaa48899ba8b0763977a8a0e11710e0a2`.
- Release boundary: code 42 is superseded and must not be uploaded; use code 43.

## 2026-07-19 Post-0.2.38 Android Back Navigation

- Android predictive/back dispatch now asks the web UI to navigate internally before consulting WebView URL history or exiting the Activity.
- Page order: App Info and Input Test return to Configuration; Configuration returns to the communication board; only the root board leaves back unhandled for app exit.
- Source and packaged WebView E2E: PASS, 32 source steps and 33 packaged steps including the asset build.
- Android compile/unit verification: PASS; `testDebugUnitTest` completed 58 tasks.
- Android debug assembly: PASS; `assembleDebug` completed 99 tasks.
- Gestural-navigation emulator smoke: PASS; a real left-edge swipe returned Configuration to the communication board while `MainActivity` remained foreground.
- Release boundary: included in the 0.2.39 code-42 AAB; not included in 0.2.38 code 41.

## 2026-07-19 Post-0.2.38 Text History And File Export

- Text-history persistence now maintains one mutable line for the current text area. Composition, suggestion completion, undo, and Zhuyin repair update that line instead of appending snapshots.
- Selecting `CLR`, activating demo reset, or applying a configuration reset/save closes the current line; the next non-empty text starts a new line.
- Stored version-1 snapshots migrate as completed lines so existing local history is not discarded. Version-2 live lines remain editable across WebView reload and Activity recreation.
- Export content is UTF-8 plain text with one non-empty history entry per line and no diagnostic metadata. Browser export downloads a `.txt`; Android uses the system Create Document picker with a suggested dated filename.
- Source and packaged-WebView E2E cover contextual undo correction, explicit-reset boundaries, and version-1 history migration.
- Android compile/unit verification: PASS; `testDebugUnitTest` completed successfully and `assembleDebug` completed 99 tasks.
- Android 14 emulator export smoke: PASS; the system DocumentsUI picker opened, created the suggested `.txt`, wrote the expected line-based UTF-8 content, returned to `MainActivity`, and the temporary test file was removed.
- Release boundary: included in the 0.2.39 code-42 AAB; not included in 0.2.38 code 41.

## 2026-07-19 0.2.39 Internal Testing AAB

- Source tag: `v0.2.39`.
- Signed Play AAB: PASS; 21,817,785 bytes, upload-key JAR signature and required bundle entries verified.
- Package metadata: PASS; `org.shineaac.app`, version 0.2.39, code 42.
- Byte identity: PASS; the versioned AAB matches Gradle `app-release.aab`.
- SHA-256: `3830c6f4aeb058a82ee25ac4ab0fff0c927fd05c2a03320502086ba2bc439df2`.
- Android data policy: PASS; cloud backup disabled and all app-data domains excluded.
- Release build: PASS; `bundleRelease` completed 112 tasks.
- Direct-install runtime used the equivalent debug build because an AAB is not directly installable; Play generates installable APKs after upload.

## 2026-07-19 0.2.38 Internal Testing AAB

- Source tag: `v0.2.38` at release source commit `4cd343d`.
- Signed Play AAB: PASS; 21,815,991 bytes, upload-key JAR signature and required bundle entries verified.
- Package metadata: PASS; `org.shineaac.app`, version 0.2.38, code 41.
- Byte identity: PASS; the versioned AAB matches Gradle `app-release.aab`.
- SHA-256: `cdda55df0eda443fb4e8d4eda1480dcbdcb4991f598e6938830b38e872aaf7f4`.
- Android data policy: PASS; cloud backup disabled and all app-data domains excluded.
- Direct-install runtime was not repeated because an AAB is not directly installable; the separate code-40 debug APK remains the latest emulator/device lifecycle evidence.

## 2026-07-18 Post-0.2.37 Zhuyin Priority And Demo Paging

- Product ordering: PASS; fundamental non-initial Zhuyin continuations precede speculative glyph/word candidates while useful candidates remain reachable. Completed syllables still lead with exact candidates when no phonetic continuation is needed.
- Demo operation: PASS; every required Zhuyin symbol can be found across bounded `更多` pages, target timeouts scale with legal scan settings, and intentional tap-to-exit no longer leaks a false demo error.
- Source and packaged WebView E2E: PASS, 31 source steps and 32 packaged steps including the asset build. The two-column regression completed a candidate after selecting a later-page Zhuyin continuation.
- Full core: PASS, 212 / 212 tests. The frozen 103-task evaluator baseline was not changed.
- Paired communication evaluator: PASS; switch activations improved from 846 to 836, estimated scan time improved from 2,866.3 to 2,663.4 seconds, `更多` selections improved from 68 to 63, P90 metrics were unchanged, and no task regressed.
- Release boundary: these changes are included in the 0.2.38 code-41 AAB and are not included in the retained 0.2.37 code-40 debug APK.

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
