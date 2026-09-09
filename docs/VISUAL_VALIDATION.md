# Rendered visual validation

This harness is test tooling, separate from AAC scanning, camera detection and
gameplay. It observes visible DOM geometry/styles and sampled rendered pixels;
game state cannot supply its own visual PASS. Existing artwork and interaction
semantics remain unchanged during review. Before any visual product change,
provide current-state evidence and a separately labeled proposal image for user
review. Test-only previews must not silently become app changes.

Static checks cover viewport and clipping bounds, overlapping/occluded controls,
text overflow, readable contrast, target size and keyboard focus. Intentional
scrolling and ellipsis are reported separately rather than silently treated as
visible text. Cover phone/tablet, portrait/landscape, split-window, themes,
language, large text, active scanning, locked conversation and game overlays.
Compact landscape (below 600 dp smallest width) is unsupported by product
decision. Such forced browser captures are diagnostic only; do not make them a
release blocker. Native compact screens retain their portrait orientation policy.
Physical target visibility must use the current display rotation, not natural
`wm size` orientation. Every optical recording must explicitly select the DUT
serial, including when a second Android device is the presenter.

Dynamic checks report frame interval median/p95/max, intervals over 50ms, longest
unchanged rendered-pixel interval and blank frames during an expected-moving
segment. Browser requestAnimationFrame timing and canvas pixels are diagnostic
observations, not proof of physical display presentation. Physical screen video
and device frame statistics complement them. Do not treat pause/ready/landing
completion as a freeze or expected scene changes as animation discontinuities.

Validate sensitivity before accepting results: inject clipped/overlapping
controls, low contrast, a blank canvas, a frozen animation and a long main-thread
stall. Each must produce its corresponding finding; clean controls must pass.
Preserve raw samples, named scenarios, screenshots and environment/build identity.
Use fixed development scenes and fresh random scenarios as holdouts. Do not tune
thresholds on a failed holdout or run timing acceptance while other benchmarks
consume the host. Record partial, failed, unavailable and unrun gates explicitly.

Automation cannot recognize every artistic or visual defect. A contact sheet and
captured animation must still be inspected for sprite shape, style consistency,
stems/leaves, camera orientation, visual hierarchy and distracting motion.
Review apparent scale, empty space, crowding, alignment, competing emphasis,
recognizable poses, depth/layer coherence and natural movement even when every
geometry check passes. Record these as design judgments with specific images,
not as numerical test failures or an invented aesthetic score.
Do not make a universal “no visual defects” claim from these bounded checks.

## Running the review tools

Use the installed Playwright runtime; set `SHINE_PLAYWRIGHT_ROOT` to its
`package.json` when it is outside this repository. Run:

```
node --test scripts/visual-audit.test.mjs
node scripts/visual-review.mjs .tmp/visual-review-20260909
node scripts/visual-review-sheets.mjs .tmp/visual-review-20260909
```

The first command exercises clean and deliberately broken rendered examples.
The second saves raw screenshots and findings for seven synthetic-content
phone/tablet scenarios, plus a review-only tablet CSS proposal. The third makes
the labeled review sheets for that specific proposal. Edit its editorial text
when reviewing a different design; it is not an automatic aesthetic verdict.

The current capture matrix is a starting set, not the complete coverage matrix
above. Theme/font-scale/scan-state expansion and physical animation review remain
separate required work before claiming comprehensive visual acceptance. The
canvas sampler can miss a frozen bird when clouds still move; review object
motion and landing/collision sequences separately. CSS contrast checks do not
measure icon contrast, complex compositing or gradient backgrounds.
