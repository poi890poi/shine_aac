# SHINE AAC Web E2E Report

Generated: 2026-08-10T02:16:50.431Z

Result: PASS

| Step | Status | Detail |
| --- | --- | --- |
| server | PASS | served http://127.0.0.1:5173/apps/web/ |
| browser-load | PASS | rendered board and message panel |
| first-run-profile | PASS | clean storage opens the zh-TW board with instructional status and a distinct Settings control |
| test-config | PASS | seeded browser smoke scan timing through browser localStorage |
| strict-scan-timing | PASS | non-polling trace {"resetToTargetMs":13,"resetTargetToProgressMs":41.20000000298023,"rowDeadlineDriftMs":-33.30000001192093,"nextRowTargetToProgressMs":48.70000000298023,"activationToTargetMs":2.7000000029802322,"activationTargetToProgressMs":47.8999999910593,"firstDeadlineDriftMs":-16.299999997019768,"secondTargetToProgressMs":47.20000000298023,"laterDeadlineDriftMs":-13.100000008940697,"thirdTargetToProgressMs":47.400000005960464,"selectionToTargetMs":5,"selectionTargetToProgressMs":35.29999999701977} |

Artifacts:

- `e2e-artifacts/web-e2e-final.png`
