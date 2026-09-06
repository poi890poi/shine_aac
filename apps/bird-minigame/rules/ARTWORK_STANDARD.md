# Artwork standard — version 1.0.0

This is the governing artwork workflow. It supersedes conflicting procedural-art
recommendations in prototype documents. The September 5 procedural bird and flower
are rejected; numerical rule checks did not establish their visual quality.

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
