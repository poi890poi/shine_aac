# SHINE AAC Web E2E Report

Generated: 2026-09-12T01:12:54.058Z

Result: FAIL

| Step | Status | Detail |
| --- | --- | --- |
| server | PASS | served http://127.0.0.1:5173/apps/web/ |
| browser-load | PASS | rendered board and message panel |
| first-run-profile | PASS | clean storage opens the zh-TW board with instructional status and a distinct Settings control |
| initial-first-row-hold | PASS | initial launch holds row 1 with a calm, visible whole-row treatment until activation |
| test-config | PASS | seeded browser smoke scan timing through browser localStorage |
| visible-escape-ladder | PASS | two missed item passes return to the same row; two board passes stop; wake activation only resumes |
| strict-scan-timing | PASS | non-polling trace {"resetToTargetMs":71.79999999701977,"resetTargetToProgressMs":34.20000000298023,"rowDeadlineDriftMs":-33.099999994039536,"nextRowTargetToProgressMs":31.899999991059303,"activationToTargetMs":1.5,"activationTargetToProgressMs":24.900000005960464,"firstDeadlineDriftMs":-15.700000002980232,"secondTargetToProgressMs":32,"laterDeadlineDriftMs":-23.799999997019768,"thirdTargetToProgressMs":24.099999994039536,"selectionToHoldMs":4.299999997019768,"holdReleaseToTargetMs":0.9000000059604645,"selectionTargetToProgressMs":23.700000002980232} |
| first-column-progress | PASS | first and later cell progress fills restart and track their own scan durations |
| directional-row-cell-progress | PASS | row progress descends from the top while individual-cell progress remains left-to-right |
| camera-hold-pause | PASS | camera hold freezes current scan target and resumes progress after eyes open |
| camera-hold-activation | PASS | accepted long blink activates from frozen scan position without a holdEnd resume delay |
| camera-hold-to-advance | PASS | one sustained camera gesture advances block → first row → first cell, commits once, and remains latched until release |
| english-filled-rows | PASS | filled both spare cells, kept ? at the bottom, and moved CLR to the matching final position |
| phrase | PASS | entered I want water with automatic trailing space through visible row/column scanning |
| undo-correction | PASS | undid WATER and selected FOOD |
| text-history | PASS | updated one live history line through composition, undo, and correction |
| session-draft | PASS | restored current composed message after reload |
| clear | PASS | selected CLR from the visible board |
| english-nonredundancy | PASS | exposed one context-aware I key and no one-character English suggestions |
| completion | PASS | typed movi and completed to movie with automatic trailing space |
| undo-completion | PASS | selected UNDO and restored the spelling before whole-word completion |
| text-history-reset | PASS | started a new history line only after CLR and kept later edits on that line |
| text-history-migration | PASS | compacted version 1 and code-42 version 2 per-input snapshots into one live line |
| speech-lock-replay-controls | PASS | fits 13 rows in 851px viewport without scrolling |
| speech-lock-replay | PASS | layout lock preserves every tile rectangle, dims every unreachable tile, and shares the bottom EDIT/SAY/CLR controls |
| speech-lock-conversation-display | PASS | fits 1 rows in 851px viewport without scrolling |
| speech-lock-conversation | PASS | enhanced mode shares the bottom EDIT/SAY/CLR row, excludes drafts, pauses without a row target, and resumes directly into flat item scanning |
| review-hold | PASS | state changes always hold row 1 and resume on the next activation |
| input-calibration | PASS | records reliable switch activations and noisy sensor rest/trial diagnostics without changing the message |
| config-profile-relevance | PASS | shows the Zhuyin-only option only for zh-TW and resets it when returning to English |
| app-info | PASS | shows version, user data facts, and help links without diagnostics or release-test instructions |
| text-export-result | PASS | shows the saved filename, opens the exact Android document directly, and reports write failures |
| speech-voice-settings | PASS | uses a dedicated accessible list with engine, ready/downloadable states, inline preview, immediate selection, and refresh |
| back-navigation | PASS | system back contract returns App Info and Input Test to Configuration, then Configuration to the board |
| demo-mode | PASS | visibly demonstrates item escape, stopped scanning, and wake-only resume before communication; preserves accessibility settings |
| pixel-4a-5g-layout | PASS | fits 13 rows in 851px viewport without scrolling |
| tablet-portrait-layout | PASS | fits 13 rows in 1280px viewport without scrolling |
| tablet-portrait-layout-config-actions | PASS | config action bar remains reachable |
| tablet-landscape-layout | PASS | fits 13 rows in 800px viewport without scrolling |
| tablet-landscape-layout-config-actions | PASS | config action bar remains reachable |
| large-text-function-key-layout | PASS | 3 function keys share word-key metrics; rendered 23.2-34.7px with a 20px normal-board floor |
| large-text-phone-layout | PASS | fits 5 rows in 851px viewport without scrolling |
| large-text-cell-fit | PASS | fit 19 realistic board labels on one line at 18px or larger without clipping |
| fatal | FAIL | Error: Long English suggestion did not adapt at 200% text size: {"span":2,"tileFontSize":40,"labelFontSize":15.7,"clipped":false}<br>    at scenarioLongEnglishSuggestionSpans (file:///E:/workspace/shine_aac/.artifacts/release-v0.5.0/scripts/e2e-web.mjs:1558:11)<br>    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)<br>    at async main (file:///E:/workspace/shine_aac/.artifacts/release-v0.5.0/scripts/e2e-web.mjs:249:3)<br>    at async file:///E:/workspace/shine_aac/.artifacts/release-v0.5.0/scripts/e2e-web.mjs:4889:1 |

Artifacts:

- `e2e-artifacts/web-e2e-final.png`
