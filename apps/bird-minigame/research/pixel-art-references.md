# Global pixel-art direction

Correction after user review: the procedural bird and flower are rejected for
substantial shape and drawing-quality degradation. The positive visual assessment
below is a historical record of the failed review, not current acceptance. See
`SHAPE_CONSISTENCY_AUDIT.md` for adversarial evidence and the corrected method.

Primary artist references consulted on 2026-09-05:

1. [Cure — The Pixel Art Tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299).
   The useful principles are deliberate pixel placement, readable silhouettes,
   connected color clusters, controlled contour steps, and intentional color ramps.
   Its discussions of jaggies, noise, banding, and pillow shading are review checks.
2. [Pedro Medeiros / Saint11 — Cluster Sketching and Painting](https://saint11.art/pixel_art_articles/article2/).
   Begin with large forms, then refine clusters and contour rhythm. Isolated pixels
   need a reason, such as an eye; texture must not obscure the larger shape.
3. [Aseprite — Sprite Size](https://www.aseprite.org/docs/sprite-size/).
   Integer nearest-neighbor enlargement is useful for inspecting pixels. Resizing
   existing artwork is not a substitute for designing the native sprite.

These are technique references, not production assets. No tutorial artwork is
copied into the game. Palette values and shape templates are original project
choices; they are not claimed to reproduce historical C64 hardware exactly.

## Applying the references

The previous renderer sampled a detailed bird, stretched a high-resolution flower
stalk, and drew large rectangular clouds. A final palette filter unified colors
but left incompatible contour/detail density. The canvas was also stretched to
the available rectangle, making logical pixels non-square on some phone sizes.

The revised renderer uses one native integer grid for all objects, shared outline
width, upper-left lighting, material color ramps, and sparse connected texture
clusters. Bird, flower, cloud, grass, and droplets are drawn from parameterized
geometry directly on that grid. No whole-image color reduction, per-object bitmap
scaling, or smooth rotation is used. The previous raster artwork remains a visual
reference; species ratios and feather dynamics remain the geometry specification.

## Change impact

Type: visual design and configuration behavior change. Scope is the standalone
mini-game, including its host interface; Android and AAC UI code are unchanged.
`aacConfig.columns` is the host-supplied count, from AAC's active session config.
The standalone default is four, matching AAC's default. Valid counts are 3–8.
Portrait adjusts the common scene scale and spacing, never the flower count.

Risks: loss of bird identity at small sizes, unreadable flower expressions, dense
columns causing ambiguous hits, and distorted pixels during resize. Validation
must include geometry and style regression tests, complete rounds at all six
supported counts, and the phone browser at the actual AAC setting. Style metrics
are guardrails; the user remains the visual reviewer. Art is not approved merely
because its pixel dimensions and color counts pass.

## Verification record

- All 21 regression tests passed, plus rule validation and the production build.
- Complete simulated rounds passed at 30/60/120 Hz for each count from 3 to 8.
- Phone Chrome verified every count from 3 to 8, equal horizontal/vertical pixel
  scale, integer physical-pixel magnification, and visible action controls.
- The actual host getter was changed from 6 to 8 to 3 columns through mount,
  start, and reset; the game followed each value. AAC on this phone stores four.
- Eight-column phone sampling recorded 90 frames over 1.51 seconds, with a median
  frame interval of 16.9 ms. This is a short browser check, not a broad benchmark.
- A 36-second direct H.264 phone capture showed all 12 hits and a safe landing at
  approximately 28.5 seconds. Touch, Space, host input, pause/resume, and exit passed.
- The standalone art studio was opened on the phone: its atlas, eight-column
  preview, and live outline changes passed. It embeds code, styles, and rules.
- Source, phone captures, comparison atlas, and reports are retained in
  `tmp/phone-pixel-standard-20260905/`. No Android package or release gates were
  run because this change does not integrate with or modify the Android app.

Visual status: first shared-style rendition, awaiting user review. Reference-sheet
inspection confirms common pixel density, controlled shading, readable neutral/hit
expressions, and grassy ground; aesthetic refinement remains an iterative task.
