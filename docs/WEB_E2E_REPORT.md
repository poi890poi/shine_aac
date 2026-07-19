# SHINE AAC Web E2E Report

Generated: 2026-07-19T06:17:11.926Z

Result: PASS

| Step | Status | Detail |
| --- | --- | --- |
| packaged-webview-build | PASS | built Android WebView assets with esbuild |
| server | PASS | served http://127.0.0.1:5173/app/build/generated/assets/shineWeb/www/apps/web/ |
| browser-load | PASS | rendered board and message panel |
| first-run-profile | PASS | clean storage opens the zh-TW communication board |
| test-config | PASS | seeded browser smoke scan timing through browser localStorage |
| first-column-progress | PASS | first and later cell progress fills restart and track their own scan durations |
| camera-hold-pause | PASS | camera hold freezes current scan target and resumes progress after eyes open |
| camera-hold-activation | PASS | accepted long blink activates from frozen scan position without a holdEnd resume delay |
| phrase | PASS | entered I want water with automatic trailing space through visible row/column scanning |
| undo-correction | PASS | undid WATER and selected FOOD |
| text-history | PASS | updated one live history line through composition, undo, and correction |
| session-draft | PASS | restored current composed message after reload |
| clear | PASS | selected CLR from the visible board |
| completion | PASS | typed movi and completed to movie with automatic trailing space |
| delete | PASS | selected DEL and removed the automatic trailing space |
| text-history-reset | PASS | started a new history line only after CLR and kept later edits on that line |
| text-history-migration | PASS | preserved version 1 snapshots and opened one version 2 live line |
| review-hold | PASS | default hold pauses after suggestion changes and resumes on next activation |
| input-calibration | PASS | records reliable switch activations and noisy sensor rest/trial diagnostics without changing the message |
| app-info | PASS | shows version, user data facts, and help links without diagnostics or release-test instructions |
| back-navigation | PASS | system back contract returns App Info and Input Test to Configuration, then Configuration to the board |
| demo-mode | PASS | activation clears the draft and holds, restarts top-row scanning, runs the demo, and tap exits it |
| pixel-4a-5g-layout | PASS | fits 12 rows in 851px viewport without scrolling |
| tablet-portrait-layout | PASS | fits 12 rows in 1280px viewport without scrolling |
| tablet-portrait-layout-config-actions | PASS | config action bar remains reachable |
| tablet-landscape-layout | PASS | fits 12 rows in 800px viewport without scrolling |
| tablet-landscape-layout-config-actions | PASS | config action bar remains reachable |
| large-text-phone-layout | PASS | fits 4 rows in 851px viewport without scrolling |
| large-text-cell-fit | PASS | fit 16 labels, including 2 long labels, without clipping |
| zh-tw-layout | PASS | migrated old zh-TW config to direct Zhuyin symbols and replacement suggestions |
| zh-tw-reset | PASS | reset restored packaged zh-TW defaults instead of stale stored layout |
| zh-tw-language-switch-review-hold | PASS | EN and 注音 language switches use the suggestion-change review hold setting |
| zh-tw-pixel-4a-5g-layout | PASS | fits 12 rows in 851px viewport without scrolling |
| zh-tw-demo-mode | PASS | completed a candidate after paging to a later Zhuyin continuation (1 commit) |
| screenshot | PASS | E:\workspace\shine_aac\e2e-artifacts\web-e2e-final.png |

Artifacts:

- `e2e-artifacts/web-e2e-final.png`
