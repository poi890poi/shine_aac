# Parameterized flower variations — 2026-09-06

Type: user-requested visual design change. Runtime variations reuse the approved
petal/face/leaf contours. Four stable column presets vary petal color, uniform head
size, stem thickness/curvature/green ramp and leaf size/levels/direction. The user's
clarification explicitly includes stems as part of flowers. No regeneration or
new anatomy. Stem width is 5 or 7 native pixels including its outline; curvature
spans -3 to +5 native pixels across the presets, and never separates the stalk.

`rules/sprite-layout.json` owns production flower parameters; legacy procedural
flower geometry in the art-lab atlas is not the production character authority.
Color preparation is cached once per expression/preset. Only petal-colored pixels
within the source head are recolored; alpha, outlines, eyes, yellow face, white hit
splashes remain intact. A separate green-only pass below the head matches leaf
tones to the stem ramp while preserving leaf alpha and contours. Every reaction
uses the same preset. Uniform
head scale is fixed per column and never follows shrinking flower height.

Risks: a broad color selection could tint faces or splashes; template size could
change during hit reactions; detached leaves could expose old stalk fragments.
Use a restricted petal color selection, fixed column identity, shared stem anchor,
bounded configuration, alpha/non-petal tests and physical-phone visual review.
AAC column counts, hit physics, progress, collision recovery, ammo and landing stay
unchanged. The new variants are available for user review, not claimed as newly
user-approved character artwork.

Verification: 60 module tests passed, including petal/leaf recolor exclusions,
stable per-column identity, fixed head dimensions while shortening, continuous
stems at configured widths/colors, and bounded parameters. Packaged physical phone
capture shows all four whole-plant variants and distinct cloud shapes. The normal
gameplay round cleared all flowers and landed, with no state/physics overrides.
The art-lab atlas now uses the actual production sprite renderer rather than the
rejected procedural character shapes. Display cleanup was verified OFF.
