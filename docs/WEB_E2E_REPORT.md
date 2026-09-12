# SHINE AAC Web E2E Report

Generated: 2026-09-12T04:09:54.655Z

Result: PASS

Scope: focused suggestion-resize and adaptive-header regressions. Complete source
and packaged suite results are recorded in the [release review](reports/pre-release/v0.5.0.md).

| Step | Status | Detail |
| --- | --- | --- |
| packaged-webview-build | PASS | built Android WebView assets with esbuild |
| server | PASS | served http://127.0.0.1:5174/app/build/generated/assets/shineWeb/www/apps/web/ |
| browser-load | PASS | rendered board and message panel |
| first-run-profile | PASS | clean storage opens the zh-TW board with instructional status and a distinct Settings control |
| initial-first-row-hold | PASS | initial launch holds row 1 with a calm, visible whole-row treatment until activation |
| real-English-resize | PASS | full shipped board: paused long word matches fresh one-line layout; active target, candidates and deadline preserved; pending geometry applied on review return without changing draft |
| real-embedded-English-resize | PASS | full shipped board: paused long word matches fresh one-line layout; active target, candidates and deadline preserved; pending geometry applied on review return without changing draft |
| adaptive-header-contract | PASS | status words stay intact; voice readable; named Settings target >=48px without vertical stretching; board fits. Synthetic font probe, verified separately on Android. |

Artifacts:

No final screenshot is captured by this focused mode.
