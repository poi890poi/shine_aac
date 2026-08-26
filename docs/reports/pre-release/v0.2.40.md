# SHINE AAC Focused Pre-release Test Report

Generated: 2026-07-19

## Candidate

- Release source: `main` after the v0.2.40 release commit
- Source tag: `v0.2.40`
- Version: 0.2.40
- Android version code: 43
- Package: `org.shineaac.app`
- Play Internal testing AAB: `shine-aac-v0.2.40-code43-release.aab`
- AAB size: 21,818,356 bytes
- AAB SHA-256: `7d83b55a52cfc00b68acb4c238f5b6aeaa48899ba8b0763977a8a0e11710e0a2`

## Decision

PASS for Google Play Internal testing upload and subsequent owner/helper/user testing. Version 0.2.39 code 42 is superseded and must not be uploaded.

Upload these files:

- `.artifacts/releases/v0.2.40/shine-aac-v0.2.40-code43-release.aab`
- `.artifacts/releases/v0.2.40/PLAY_AAB_SHA256SUMS.txt`

## Defect Reproduction And Repair

The code-42 migration incorrectly treated every legacy per-input snapshot as a completed line. The exact reported 47-line export was added as a pure core regression fixture.

Expected migrated export:

```text
聽 podcast 新資料夾
冰紅茶少冰不要太甜
```

The repair upgrades history storage to version 3, compacts both original version-1 snapshots and polluted code-42 version-2 storage, preserves explicit reset markers, and keeps the final matching draft line open for later edits.

## Verification

| Layer | Result | Evidence |
| --- | --- | --- |
| Exact core fixture | PASS | 47 reported snapshots reduced to exactly 2 final text-area session lines |
| Explicit reset core fixture | PASS | reset remains a boundary even when the next line extends prior text |
| Repair-operation core fixture | PASS | Zhuyin candidate commits, deletion, and undo branching remain one session |
| Quick core | PASS | 104 / 104 tests |
| Full core and evaluator | PASS | 215 / 215 tests; frozen 103-task baseline unchanged |
| Source browser E2E | PASS | real export path repairs version 1 and code-42 version 2 storage |
| Packaged WebView E2E | PASS | built assets pass the same upgrade regression |
| Android unit/compile | PASS | `testDebugUnitTest`; 58 tasks |
| Android data policy | PASS | cloud backup disabled and all app-data domains excluded |
| Signed Play AAB build | PASS | Gradle `bundleRelease`; 112 tasks |
| Package metadata | PASS | `org.shineaac.app`, version 0.2.40, code 43 |
| Bundle structure/signature | PASS | required entries and upload-key JAR signature verified |
| AAB byte identity | PASS | versioned artifact matches Gradle output at SHA-256 `7d83b55a52cfc00b68acb4c238f5b6aeaa48899ba8b0763977a8a0e11710e0a2` |

## Internal Tester Focus

1. Upgrade from code 42 without clearing app data and export existing text history.
2. Confirm old intermediate Zhuyin, Latin, and candidate states are absent.
3. Confirm the final message from each text-area session remains, with a new line only after reset.
4. Continue editing the latest restored draft and confirm its existing line updates.
5. Recheck Android back gestures and Save As file export.

## Open Items

- Physical Samsung/device-owner/helper UX review.
- Real-person camera and Mandarin TTS validation.
- Play Console owner upload, tester assignment, and Internal testing rollout.

GitHub CI publication is unrelated to the Google Play Internal testing upload.
