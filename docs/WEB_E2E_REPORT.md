# SHINE AAC Web E2E Report

Generated: 2026-07-11T04:15:03.430Z

Result: PASS

| Step | Status | Detail |
| --- | --- | --- |
| server | PASS | served http://127.0.0.1:5173/apps/web/ |
| browser-load | PASS | rendered board and message panel |
| test-config | PASS | seeded browser smoke scan timing through browser localStorage |
| first-column-progress | PASS | first and later cell progress fills restart and track their own scan durations |
| phrase | PASS | entered I want water with automatic trailing space through visible row/column scanning |
| undo-correction | PASS | undid WATER and selected FOOD |
| clear | PASS | selected CLR from the visible board |
| completion | PASS | typed movi and completed to movie with automatic trailing space |
| delete | PASS | selected DEL and removed the automatic trailing space |
| review-hold | PASS | default hold pauses after suggestion changes and resumes on next activation |
| input-calibration | PASS | records reliable switch activations and noisy sensor rest/trial diagnostics without changing the message |
| demo-mode | PASS | hidden Config long-press starts extended conversation demo and tap exits it |
| pixel-4a-5g-layout | PASS | fits 12 rows in 851px viewport without scrolling |
| zh-tw-layout | PASS | migrated old zh-TW config to direct Zhuyin symbols and replacement suggestions |
| zh-tw-reset | PASS | reset restored packaged zh-TW defaults instead of stale stored layout |
| zh-tw-language-switch-review-hold | PASS | EN and 注音 language switches use the suggestion-change review hold setting |
| zh-tw-pixel-4a-5g-layout | PASS | fits 12 rows in 851px viewport without scrolling |
| screenshot | PASS | E:\workspace\shine_aac\e2e-artifacts\web-e2e-final.png |

Artifacts:

- `e2e-artifacts/web-e2e-final.png`
