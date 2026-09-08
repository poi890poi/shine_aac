# Sixteen-bird flight sheet v8: parameterized tail curvature

Mode: built-in image generation, precise-object-edit.

References:

1. `assets/generated/taiwan-endemic-birds-16-rigged-flight-v7.png` — edit target
2. `assets/guides/tail-curvature-atlas.png` — parameter-derived centerline geometry

Do not regenerate the sheet. Edit only the tail feathers of the seven
long-tailed birds listed below. Preserve the other nine birds, all bodies,
heads, bills, wings, feet, poses, plumage, pixel-art rendering, grid positions,
white background, and all sixteen Traditional Chinese labels unchanged.

Tail length is the arc length measured along each curved feather centerline,
never the straight root-to-tip chord. The centerline leaves the tail root
tangent to the rearward body axis, stays nearly straight until
`bendStartRatio`, then flexes smoothly downward under aerodynamic load to
`tipDropRatio` and `tipTangentDegrees`. Preserve the existing tail-root position
and total feather length. Multiple feathers follow parallel related curves
according to `bundleCoherence`, with slight natural separation; they must not
become one solid ribbon.

- R1C1 臺灣藍鵲: arc 190; bend 0.28; drop 0.20; tip 24 degrees;
  coherence 0.90. Curve its two or three long tail feathers together and
  preserve their black-white tips.
- R2C2 白耳畫眉: arc 105; bend 0.40; drop 0.12; tip 16 degrees;
  coherence 0.92. Give its narrow black tail a gentle aerodynamic droop.
- R3C2 紋翼畫眉: arc 96; bend 0.42; drop 0.10; tip 14 degrees;
  coherence 0.90. Curve the barred tail while keeping individual feather edges.
- R3C4 小彎嘴: arc 95; bend 0.43; drop 0.10; tip 14 degrees;
  coherence 0.91. Curve only its tail; keep its curved bill unchanged.
- R4C1 黑長尾雉: arc 230; bend 0.24; drop 0.22; tip 27 degrees;
  coherence 0.88. The long barred tail must leave the rump horizontally, then
  sag smoothly; retain 2.3 torso lengths measured along the curve.
- R4C2 藍腹鷴: arc 135; bend 0.34; drop 0.14; tip 19 degrees;
  coherence 0.89. Curve each broad white feather without narrowing the tail.
- R4C3 臺灣白喉噪眉: arc 92; bend 0.46; drop 0.08; tip 11 degrees;
  coherence 0.92. Apply only a restrained downward flex.

Keep exactly sixteen visibly airborne right-facing birds in the same 4x4 order.
Keep every label verbatim. Keep all wing shapes and flight phases unchanged.
Preserve crisp high-detail pixel art, dark outlines, three shading bands, and
full margins around all tips.

Avoid straight ruler-like long feathers, upward tail curvature, sharp kinks,
circular curls, S-curves, ribbon tails, melted feather bundles, shortened arc
length, detached tail roots, changed birds, changed wings, changed labels,
cropped tips, overlaps, checkerboard, shadow, new text, or watermark.

