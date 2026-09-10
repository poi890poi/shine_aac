# Feather transparency correction and cross-bird audit

Type: diagnosed artwork bug fix with a reusable audit tool. Baseline: 2d0cf85.
User reported holes in Swinhoe's pheasant wing, then asked how the same problem
would be identified in other birds. Expected: original pale feathers remain opaque,
while genuine space between feathers/legs stays transparent.

## Cause and evidence

The offline exterior matte still treated boundary-connected near-neutral pixels
above 165 as background. It leaked through pale feather outlines into Swinhoe's
raised white wing. Earlier native/GPU tests preserved that flawed mask and therefore
could not prove semantic feather preservation. RGBA storage and pixel alignment
were correct; the source mask was wrong.

All 63 poses were scanned with a stricter exterior-key diagnostic and compared with
the original artwork on pink backgrounds. Large changed connected regions ranked
suspects; source/alpha contact sheets established the visual distinctions.
The audit confirmed a second instance: Mikado's folded-wing white tail tip.
Large flags between standing birds' feet were genuine background, demonstrating
why automatic filling or globally raising the key threshold is unsafe.
No comparable broad feather loss was seen elsewhere in the contact sheets; this
is not a claim that every fine edge in the other 61 poses is perfect.

The initial exploratory threshold sheet used an OpenCV positional argument that
left eight-connectivity active. It was not promoted. Final candidates were rebuilt
using the production four-connectivity rule and the actual current mask; the final
before/after review and regression use those corrected candidates.

## Fix and risk boundary

Two explicit source-reviewed foreground stencils restore source alpha independently
of the generic background flood. They preserve original RGB and all other alpha.
The Swinhoe stencil restores 14,366 source pixels, the Mikado stencil 472. Stencils
are hash/bounds/size checked in the offline builder. The other 61 pose records,
dimensions, anchors, source colors and all scenery remain unchanged. This is no
change to animation timing, physics, input, GPU code, AAC UI or persistent settings.

The repeatable audit tool is `scripts/audit-bird-alpha.py` (Python/OpenCV). It emits
ranked suspect regions and diagnostic overlays for every pose and never modifies
assets. Its threshold is a perturbation for finding suspects, not a replacement
segmentation policy. New ambiguous regions require source review.

## Regression and review

`scripts/test_bird_alpha.py` uses source-inspected native feather and background
landmarks. It failed on the installed Swinhoe mask before the fix. Saved broken
Swinhoe and Mikado images remain negative controls. Fixed images must preserve
feather opacity, keep neighboring background transparent, preserve dimensions/
anchors, and keep all other 61 pose records unchanged.

The all-pose asset gate separately verifies original RGB sampling and allows alpha
restoration only within the explicit foreground stencil. It reports 14,838 restored
source pixels, zero mask errors, zero native sampling errors, and six exact clouds.
This is separate from rendered GPU/Canvas parity and physical installation checks.

Review evidence is in `tmp/swinhoe-wing-fix-20260910/`, including the four original/
alpha contact sheets, detailed Mikado tail inspection, final correction preview,
ranked candidates and per-pose screening decisions. The user-accessible review is
published as `bird-alpha-audit-20260910.html` through the existing authorized tunnel.

## Validation and delivery

GPU/Canvas exact parity passes for all 16 species and four rendered states at three
viewports, including resize, context restoration and unavailable-GPU fallback.
The APK's two corrected PNGs were compared byte for byte with the reviewed exports.
APK SHA-256: `6a2abfdc0374a260b975afa7523bf4fccd90bd103f1632c13c958141f4ca0073`.

Physical tablet gate: `.tmp/tablet-adaptation/garden-R9JT201YLJF-1788999742118/`.
Physical phone gate: `.tmp/tablet-adaptation/garden-RFCR91GWXLX-1788999867525/`.
Both gates passed and both displays were verified OFF. Each required `device-test.bat --garden` run verifies the
installed APK hash, fullscreen, activation/drop, AAC return, and display OFF.
No optical behavior changed or optical PASS is claimed.
