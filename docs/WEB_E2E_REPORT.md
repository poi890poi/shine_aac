# SHINE AAC Web E2E Report

Generated: 2026-08-20T08:18:02.524Z

Result: PASS

| Step | Status | Detail |
| --- | --- | --- |
| server | PASS | served http://127.0.0.1:5173/apps/web/ |
| browser-load | PASS | rendered board and message panel |
| first-run-profile | PASS | clean storage opens the zh-TW board with instructional status and a distinct Settings control |
| initial-first-row-hold | PASS | initial launch holds row 1 with a calm, visible whole-row treatment until activation |
| test-config | PASS | seeded browser smoke scan timing through browser localStorage |
| visible-escape-ladder | PASS | two missed item passes return to the same row; two board passes stop; wake activation only resumes |
| strict-scan-timing | PASS | non-polling trace {"resetToTargetMs":65.19999998807907,"resetTargetToProgressMs":32.90000003576279,"rowDeadlineDriftMs":-31.900000035762787,"nextRowTargetToProgressMs":31.600000023841858,"activationToTargetMs":1.300000011920929,"activationTargetToProgressMs":32.5,"firstDeadlineDriftMs":-25,"secondTargetToProgressMs":23.5,"laterDeadlineDriftMs":-22,"thirdTargetToProgressMs":23.5,"selectionToHoldMs":4.199999988079071,"holdReleaseToTargetMs":0.800000011920929,"selectionTargetToProgressMs":22.5} |
| first-column-progress | PASS | first and later cell progress fills restart and track their own scan durations |
| camera-hold-pause | PASS | camera hold freezes current scan target and resumes progress after eyes open |
| camera-hold-activation | PASS | accepted long blink activates from frozen scan position without a holdEnd resume delay |
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
| review-hold | PASS | state changes always hold row 1 and resume on the next activation |
| input-calibration | PASS | records reliable switch activations and noisy sensor rest/trial diagnostics without changing the message |
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
| large-text-cell-fit | PASS | fit 15 realistic board labels on one line at 18px or larger without clipping |
| long-English-suggestion-span-layout | PASS | fits 5 rows in 694px viewport without scrolling |
| long-English-suggestion-spans | PASS | kept ACCESSIBILITY at the normal word size while expanding from 2 to 4 columns |
| zh-tw-dense-function-key-layout | PASS | 4 function keys share word-key metrics; rendered 20-20px with a 20px normal-board floor |
| zh-tw-official-zhuyin-route | PASS | Zhuyin activation uses the dedicated Ministry of Education audio route |
| zh-tw-layout | PASS | migrated old zh-TW config to direct Zhuyin symbols and replacement suggestions |
| auto-scan-more-pages | PASS | opt-in More navigation scans each four-row suggestion page as one target and confirms the visible page |
| zh-tw-reset | PASS | reset restored packaged zh-TW defaults and held the first row for deliberate startup |
| function-label-default-default | PASS | 4 function keys share word-key metrics; rendered 20-20px with a 20px normal-board floor |
| function-label-default-default-viewport | PASS | fits 13 rows in 851px viewport without scrolling |
| function-label-default-larger-display | PASS | 4 function keys share word-key metrics; rendered 18-18px with a 20px normal-board floor |
| function-label-default-larger-display-viewport | PASS | fits 13 rows in 694px viewport without scrolling |
| function-label-200pct-default | PASS | 4 function keys share word-key metrics; rendered 31.5-31.5px with a 20px normal-board floor |
| function-label-200pct-default-viewport | PASS | fits 13 rows in 851px viewport without scrolling |
| function-label-200pct-larger-display | PASS | 4 function keys share word-key metrics; rendered 21.9-21.9px with a 20px normal-board floor |
| function-label-200pct-larger-display-viewport | PASS | fits 13 rows in 694px viewport without scrolling |
| zh-tw-locale | PASS | configuration, input test, and app information remain consistently Traditional Chinese |
| zh-tw-language-switch-review-hold | PASS | 英文 and 注音 switches preserve review hold; the embedded English board reuses English suggestions |
| zh-tw-pixel-4a-5g-layout | PASS | fits 13 rows in 851px viewport without scrolling |
| zh-tw-demo-mode | PASS | greedily completed a visible candidate after direct first-layer Zhuyin input (1 matched characters) |
| singleton-row-auto-activation | PASS | both modes skip redundant singleton item activation; block mode also skips redundant activation for a one-row block |
| block-row-column | PASS | reused the exact en-US and zh-TW suggestions/layout, persisted 4-3-3-3 mode, selected through block/row/cell, and completed an Auto Demo Zhuyin commit |
| screenshot | PASS | E:\workspace\shine_aac\e2e-artifacts\web-e2e-final.png |

Artifacts:

- `e2e-artifacts/web-e2e-final.png`
