# Visual review before implementation — 9 September 2026

This records the initial review. The subsequent approval and implementation are
tracked in [approved UI decisions](../../UI_REVIEW_DECISIONS_2026-09-09.md).

The user requested images before visual changes. No app UI, renderer, sprite,
flower/stem, cloud, mountain, detector or gameplay changes were made in this
review. The proposal is isolated browser CSS in test tooling. Approval is pending.
Screenshots contain synthetic AAC messages and existing approved game assets.
They are browser viewport captures, not physical-device screenshots.
Mountain source credits and adaptation licenses are in
[artwork attribution](artwork-attribution.txt).

## Review images

- [Tablet current/proposed panel](tablet-panel-review.png): current history text
  is visibly clipped into strips. Most of the panel remains empty. The proposed
  layout gives the draft more room, makes history readable, and anchors helper
  controls at the bottom. The communication board is identical.
- [Phone defects and composition](phone-design-review.png): at 800 × 360 the
  board remains within its container but its labels are compressed into unreadable
  slivers. This is a functional visual defect. The tall stems/low mountain horizon
  at 360 × 800 and smooth helper buttons against pixel scenery are separate design
  judgments, not automatically scored defects. Preserve approved sprite and stem
  shapes while discussing any responsive composition change.
- [Current tablet garden](tablet-garden.png): reference for comparing scene scale
  and composition across aspect ratios. An edge-clipped bird during fly-in is not
  sufficient evidence of a defect; its motion must be reviewed as a sequence.

## Test results and limits

Current production source baseline: `f7ce5b3`. Harness repair: `11211f6`.
Internal raw evidence is under `.tmp/full-validation-20260909`,
`.tmp/visual-review-20260909`, `.tmp/visual-motion-20260909`, and
`.tmp/visual-motion-holdout-20260909`.

| Gate | Result |
| --- | --- |
| Full core suite | 322 passed |
| Web/game/contrast unit suites | 132 passed |
| Android app, inputs and optical-core unit suites | 119 passed across 26 JUnit XML reports |
| Python harness suite | 122 passed |
| New visual sensitivity checks | 2 tests passed; clean control plus injected clipping, overlap, low contrast, text clipping, small target, uniform black/colored canvas, freeze and actual main-thread stall |
| Fresh phone physical acceptance | 52 passed, zero findings; five setup cycles, 200% font, orientation, lifecycle and process recreation |
| Fresh phone native settings audit | 20 passed, zero findings, including final display-off verification |
| Full source browser E2E | Failed replay-lock geometry invariant |
| Full packaged WebView E2E | Same failure; later scenarios not reached |
| Physical optical run | Atlas, upright face, preserved preview recording and native long-blink calibration passed; normal-use sequence stopped at replay-lock target selection |
| Browser game motion | Two random rounds reached won with miss, hit, collision, landing and won events; raw video and frames preserved |

The replay browser failure moves the board down 18 px (186.7 to 204.7) when the
top panel grows. The test is retained. No app fix was applied pending visual review.

Phone physical evidence: `test-results/device-20260909-092139` and
`test-results/native-config-20260909-092913`. The unchanged
tablet Preview APK retains the earlier device/settings evidence documented in
`docs/TABLET_GARDEN_VERIFICATION_2026-09-08.md`; a fresh complete tablet acceptance
run was not performed in this image-review pass. The fresh tablet/phone optical
run is recorded separately and does not substitute for that gate.

The optical failure is a harness semantic mismatch: its replay-lock state still
contains all board rows, but its three reachable actions scan directly in Cells.
The rig waited for Rows/clear three times without presenting a gesture. The log
labels this an activation miss, which is misleading. This target-selection and
failure-classification issue remains open. It does not establish a detector miss.
Evidence: `test-results/optical-20260909-091016/demo-e2e-blink.log` and
`demo-steps.json`. Native cheek calibration, both complete normal-use sessions and
stress cases were not completed. Full optical acceptance is not a PASS.

Two earlier harness failures were reproduced and repaired: natural portrait
dimensions rejected a visible landscape Start setup button, and an unscoped
screenrecord command could not select between the DUT and Android presenter.
Regression tests protect both fixes; the subsequent physical run completed
long-blink calibration with its required timeline and preview video.

Browser motion samples cover the initial six seconds only. Development round:
p95 39.5 ms, max gap 66.8 ms, longest unchanged pixels 120 ms. Fresh random round:
p95 26.6 ms, max gap 40 ms, longest unchanged pixels 133.4 ms. Neither sample
contained a blank frame. These are diagnostics under concurrent rig load, not
physical smoothness acceptance. Approximately 10 fps silent browser videos
preserve screencast timestamps and are suitable for composition/sequence review,
not measuring physical display frame pacing. Inspected collision and landing
frames retain recognizable bird shapes and end in standing poses.

Theme/font-scale/scan-state visual matrix expansion, object-specific motion
checks and physical full-round media review remain open. The earlier native
MediaPipe crash also remains unresolved; subsequent successful calibration does
not establish that it is fixed. This review does not declare release readiness.

## Reproduction

See [the visual validation method](../../VISUAL_VALIDATION.md). Browser review
scripts use an installed Playwright/Edge runtime. Motion capture additionally
uses the existing `ffmpeg` executable (or `FFMPEG` override), without downloading
Playwright's optional encoder. Run:

```
node scripts/visual-motion-review.mjs .tmp/visual-motion-review
```

The first attempt to use Playwright's optional video encoder could not start
because that encoder was absent. The final runner uses the installed encoder;
both completed rounds were captured through that path.
