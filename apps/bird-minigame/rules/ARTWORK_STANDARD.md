# Artwork standard — version 1.0.0

September 9 integration approval: the user accepted the virtual-screen preview
and requested implementation. The active renderer draws all game artwork into a
separate virtual canvas, then copies that whole frame once at an integer scale.
Portrait reference is 360×800; integer fitting adapts the virtual extent to the
display aspect ratio (the tested tablet uses 640×400 at 3×). The grid origin is
always (0,0), with only right/bottom edge clipping for indivisible display sizes.
Promote the approved larger-cloud recipe and native scenery preparation; retain
bird/flower source art, curved stems, leaf anchors, gameplay and helper controls.
Do not add pixel-art overlays to the physical display after the frame copy.
Regression evidence must include the exact approved portrait, fractional movement,
off-grid negative controls and physical output pixels. Historical trials below
remain a record of their original review status.

September 9 global-pixel clarification: the complete game is rendered into one
low-resolution virtual framebuffer. Every pixelated layer, sprite, particle and
ammo indicator shares its origin and integer pixel coordinates. Upscale only the
completed framebuffer, once, with the same integer factor on both axes and no
smoothing. Do not move individually enlarged sprites on a higher-resolution
display surface. Fractional physics positions are permitted; drawing snaps to
virtual pixels. Display density must not silently redefine the artwork grid.
The larger cloud sizes are approved; their integration with the shared grid still
requires image review. Pixel alignment alone does not approve shape loss. The
coarse-grid trials that damaged faces and stems are rejected. The current 360×800
virtual-screen review is a candidate, not an approved replacement APK.

September 8 batch integration: the user requested tablet APK installation after
the eight-profile review. Promote the exact reviewed photographic masks/palettes
for Beidawu, Qilai-direction, Yushan/Chenyoulan, Dulan, Guanyin, Qixing, Huoyan and
Dajian. This authorizes the recorded additional Taiwanese locations and the
Qixing lower-hillside viewpoint. Keep all eight source credits in the package.
Haze and framing remain separate from mountain identity; preserve all characters,
flowers/stems/leaves, clouds, grass and gameplay.

September 7 tablet/readability amendment: fill the physical viewport with a square
pixel canvas, with no width cap. Shared display controls enlarge ammo from 2 to 3,
birds by 1.3, and flower heads from 1.15 to 1.4. Do not resize or straighten stems
or leaves. Airborne landing uses each species' existing flight cycle until won.
Mountain identity is sampled separately from haze; the source-backed Hualien
station/Qilai-direction profile is an additional photograph, not a warped Beidawu.

September 7 leaf/stem correction: leaf size must not scale embedded stalk pixels.
The source sheet remains immutable; isolate the left leaf via its recorded mask
and anchor, mirror as a pair behind the unchanged stem/head renderer. This fixes
the flawed legacy composite while preserving the actual stem curve and width.
Historical rendering is explicitly opt-in for the frozen baseline. Live acceptance
requires zero changed stem pixels against a leaves-disabled render across all
variants, expressions and short/tall heights (verify-leaf-attachments.mjs).

September 7 clearing approval: live scenery replaces cottages and rice with the
reviewed simple meadow/bush direction. Curated bush lobe profiles and bounded
placement/palette variation live in clearing-scenery.js. Mountain moods uniformly
frame and recolor the verified Beidawu image without altering source alpha or
inventing peaks. Freeze one cosmetic seed per round and preserve all existing
bird, flower/stem/leaf and cloud source contours. Historical rural assets and
baselines remain unchanged for reference; they are not the active background.

September 6 follow-up: user requests larger readiness icons, grass on the landing
foreground, flatter cloud shading, and slightly bigger flower heads without stem
changes. Apply a fixed 1.15 head-only display multiplier about the lower attachment;
retain the original stem and leaf calculations and source expression crops. Clouds
keep exact alpha and reduce RGB to three semantic tones. Historical pixel baselines
remain frozen and run with original cosmetic settings; current settings require
independent stem/leaf raster and cloud alpha/palette checks plus visual review.

This is the governing artwork workflow. It supersedes conflicting procedural-art
recommendations in prototype documents. The September 5 procedural bird and flower
are rejected; numerical rule checks did not establish their visual quality.

Integration decision, September 6: the complete Beidawu/cottages/rice scene was
accepted for a new full-length POC. The packaged renderer reuses the reviewed
cloud crops/matte/shading and full flower rendering. A 480×640 static comparison
against the frozen earlier layer must remain pixel-identical; motion may translate
clouds and gameplay may shorten flowers using their existing curved-stem renderer.
The 480-pixel reference width preserves approved sprite sampling without resizing
individual subjects. Portrait height adapts; display enlargement is integer-only.
The photographic mountain adaptation retains its source/license/attribution record.

Integration decision, September 5: the user approved the regenerated magpie and
flower designs and requested an app update. The exact source sheets and crop/pivot
records are in `rules/sprite-layout.json` and the candidate manifest. Their bitmap
sampling at fixed uniform scale onto a shared scene grid is an explicit integration
exception to the original no-resampling direction. It does not authorize replacing
their shapes, claim an exact hand-authored pixel grid, or certify the unimplemented
component-mask acceptance gate. The baked checkerboard is removed by the renderer's
exterior matte; the original candidate files remain unchanged.

## Character design is the shape authority

Keep the earlier Blue Magpie flight strip and flower artwork as provisional visual
references, identified by SHA-256 in `research/shape-review-decision.json`. They are
not yet an approved component library. Never replace their drawing with generic
ellipses, polygons, or a newly invented character during a styling change.

The bird needs a rounded torso and head, attached bill, readable eye, broad wings
with distinct primary feathers, tucked feet, and long coherent tail feathers.
The flower needs its rounded pink petal crown, yellow expressive face, connected
curving stem, and pointed leaves. Preserve expression quality, not merely counts.

Record named component contours or alpha masks, local origins, attachment points,
pivots, eye/mouth landmarks, stacking order, and matched pose references. Species
ratios constrain these designs; six numbers cannot define an acceptable silhouette.
The existing ratio and tail-atlas drawing scripts are construction aids with known
limitations documented in the audit, not approved contour or arc-length evidence.

## One global rendering style

Use a shared square logical pixel unit for birds, flowers, clouds, grass, and
droplets. Author deliberate silhouettes and connected clusters on that grid.
Use one-pixel contours, upper-left light, and two or three flat tones per material.
Keep semantic blue, green, pink, yellow, white, and dark-outline ramps consistent.
No gradients, glow, random dithering, or whole-scene color-reduction filter.

Choose the global grid only after the bird eye/bill/feathers and flower expressions
remain readable at native size. The prototype's 20-pixel torso and primitive flower
dimensions are **unaccepted trial settings**, not mandatory character templates.
Increase the shared resolution when necessary; do not independently enlarge pixels
for one object. Review native size and integer zoom. Display with uniform integer
scaling, without smoothing, anisotropic stretching, or subpixel sprite rotation.

Grass is a meadow with irregular tufts and depth, never runway markings. Flower
column count equals active AAC columns (3–8), including portrait layouts. Art
changes must preserve those requirements and the existing gameplay behavior.

## Repeatable candidate generation

### Deterministic conversion of source scenery

Source-photo conversion is an offline asset preparation step, not image generation.
Use the researched workflow in `research/PIXEL_CONVERSION_METHOD.md` and explicit
`rules/scenery-conversion.json` recipes. Sample once onto the shared logical grid,
then map to a shared indexed palette; preserve a separately rasterized mask across
color/sampler comparisons. Disable outline expansion and dithering by default.
Native cleanup and visual acceptance remain necessary. Keep generated source art,
converted candidates and approved native assets distinct; never infer compliance
with a requested pixel size or palette from an image-generation prompt.

The current 0.3.0 conversion palette is a scenery review candidate, not an implicit
replacement for live pixel-style.json or the approved character source contours.
The user's September 6 scope correction freezes flowers AND clouds in full,
including curved stems, leaf variations and shading. Exclude them from conversion.
The scenery recipe owns cottages and photographic mountain preparation only.
The review renderer compares the protected layer pixel-for-pixel with the frozen
previous rendering; never update that baseline merely to accommodate a change.
Brightening cottages substitutes palette entries without changing indices or alpha.
Run `scripts/test_pixel_conversion.py` for mechanical and ground-continuity checks.
These tests deliberately make no aesthetic acceptance claim.

### Generating or editing source designs

1. Select one species and existing pose, or edit its existing pose strip in place.
   Supply actual earlier art as the shape reference. For a new anchor, supply a
   proportion construction guide first and explicitly distinguish its dimensional
   role from the actual character contour reference. Do not generate 16 species
   together before their individual anchors are accepted.
2. Save the exact prompt and all input image hashes. Specify edit targets versus
   style references, shared grid, palette/lighting, and locked shape invariants.
3. Generate a candidate non-destructively. An image prompt proposes parameters;
   it does not prove the output obeys them. Never infer a PASS from the prompt.
4. Compare against the earlier artwork in matched poses, at native size and zoom.
   Check silhouettes separately from color: component proportions, attachment,
   primary-feather structure, eye placement, petal form, and expression readability.
   Check actual alpha and effective pixel size; a checkerboard is not transparency.
5. Record visible deviations and reviewer decisions against the exact output hash.
   A candidate remains a candidate until reviewed; do not silently replace live art.

Once an anchor is accepted, separate its components and derive new animation poses
through fixed pivots and documented occlusion. Do not redraw anatomy per frame.
Tail bend-start, tip drop, tip tangent, and bundle coherence remain parameters;
preserve feather arc length, verified by an independent evaluator. Changing a
shape template requires another shape review; palette edits must not change it.

## Evidence and promotion

Keep rule-file consistency, gameplay tests, rendered-shape agreement, and visual
acceptance as separate results. Measure actual rendered masks and landmarks against
frozen references, after rasterization and compositing. Compare components locally;
whole-character overlap can hide a damaged eye, head, bill, or petal.

Before trusting automated acceptance, show it rejects missing birds/petals, stretched
bodies, triangular replacement wings, shortened or straightened long tails, detached
roots, displaced eyes, and flattened expressions. Freeze tolerances using reviewed
examples and native-grid feasibility, before evaluating the next candidate.

Production promotion must bind an accepted baseline, exact asset or renderer hash,
rule versions, rendered comparison evidence, and a recorded visual decision.
Missing or stale evidence, candidates, and rejected assets cannot be called approved.
This document specifies that gate; it does not claim the prototype implements it.

## Scope and verification of this standard

Type: documentation and artwork workflow. Impact: preserve character identity during
restyling and stop treating parameter checks as shape validation. Risk: a generated
image may still drift; mitigate through preserved references, explicit candidate
status, matched visual comparisons, and independent output measurements. Gameplay,
Android integration, and live renderer behavior are outside this documentation
commit. The audit records the previous negative tests; the production gate and
approved component set remain outstanding.

Technique references and historical review corrections are recorded in
`research/pixel-art-references.md`. Their artwork is not copied into this project.
