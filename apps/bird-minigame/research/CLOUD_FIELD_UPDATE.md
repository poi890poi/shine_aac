# Larger parameterized clouds — 2026-09-06

Type: visual design change. Replace two hard-coded 42×18 cloud placements with a
shared six-cloud field, nominally 88×38 native pixels, with 20% size variation.
Clouds remain behind gameplay and use the existing shared pixel grid, outline,
palette and lighting. Character sprites, HUD transparency and physics are unchanged.

The `cloud` rule owns count, size, variation, altitude range, lobe centers/radii,
puffiness and base height. Deterministic spacing and modest drift variation avoid
random regeneration and keep tuning repeatable. Width/height change geometry on
the native grid, not bitmap scale. Both scene renderers use the same field function.
New fields have fallback defaults for existing exported styles.

Risk: larger clouds can crowd a small scene, lose their contours when clipped, or
wrap visibly mid-screen. Bound density and tuning values; include the whole cloud
width in wrap distance; constrain silhouettes and their outline to the native box.
Reduced motion freezes drift. Verify rendered area, parameter-driven silhouettes,
field count/motion, validation, and inspect a native-scale field before handoff.

Verification: all 52 tests passed and the packaged build succeeded. Inspected
`tmp/clouds-20260906/field.png` at native size: six larger, varied clouds have
readable lobes and flat bases, including clouds entering/leaving the screen.
No physical test display was used for this visual-only update.

Follow-up: the user requested more distinct shapes. Four named templates now vary
lobe arrangement and aspect ratio: rounded, broad, towering and twin-peaked.
Normalized silhouette tests compare masks at identical dimensions, so a size-only
change cannot satisfy the shape variation requirement. Whole-cloud wrap widths
include the variant width multiplier. These changes are included in the requested
game commit and a new phone demonstration covering all four gameplay outcomes.

Soft-cloud refinement: user rejected the sharp appearance. The previous normal
calculation created diagonal shade planes and the bottom clip produced corners.
Replace both with blended elliptical puffs, a rounded joining belly and a pale
curved underside shadow. Keep the four parameterized silhouettes and crisp native
pixels. Cache native tiles during drift, invalidating them when parameters change.
Risk/verification: check silhouette connectivity, parameter invalidation and palette
roles; compare actual clouds visually. This changes clouds only, not character art
or gameplay. No physical display is needed for the cloud-only preview.

User-requested depth: split the six clouds into two explicit layers, drawing the
far three first (0.7× size, 1.35 native pixels/second) and the near three second
(1.15× size, 4.2 pixels/second). Size/speed multipliers and altitude bands are
parameters. Layer order, actual displacement and reduced-motion freezing have
regression coverage. No cloud can affect bird/flower physics.

Verification of rounded layers: all 62 tests and the build pass. Native preview
`tmp/clouds-20260906/field-rounded.png` was visually reviewed: rounded, connected
white puffs with a pale curved underside replace the diagonal slabs and clipped
corners. No test display was woken. Cloud geometry is cached between drift frames.
