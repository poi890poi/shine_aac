# Bird mini-game working rules

- September 8: respond to mountain-variety work with a substantial batch, minimum
  eight distinct source-backed mountain identities. Haze, recolors and alternate
  crops of one mountain do not count as additional identities. Review the whole
  batch together; `scripts/test_mountain_batch.py` protects the candidate library,
  source/contour and palette invariants. The September 8 request to install the APK
  after reviewing the batch authorizes all eight profiles, including the additional
  Taiwan locations. Preserve their explicitly recorded viewpoints and source masks.

- Leaf size/direction must never alter the stem's curve, width, outline or color.
  Use isolated leaf art with an attachment landmark, behind the independent stem
  pass. Never scale a crop containing a stalk fragment. Run
  scripts/verify-leaf-attachments.mjs against stem-only pixels. Historical flawed
  composites stay available only for frozen-baseline comparison, not live play.

- September 7 clearing approval supersedes cottages/rice in live scenes. Use 5–8
  seeded bush clusters and three muted palettes, stable for the entire round.
  Mountains use licensed lowland photo profiles with discrete haze/framing
  variants, now including the Qilai-direction panorama above Hualien station.
  Keep source/viewpoint evidence in mountain-variants.json. Never perturb
  peaks or reroll scenery on ticks, collision, pause, rotation or bird selection.
  Keep scenery randomness independent of bird choice. Preserve flowers/clouds and
  the grassy landing surface; historical rural baselines remain immutable.

- All 16 species are selectable in the standalone POC via a picture-only paged
  picker. SHINE AAC hosting defaults to `speciesSelection: 'random'`: sample once
  per new round, hide manual choices, and keep the bird fixed through flybys,
  pause, collision and landing. POC uses explicit manual mode and retains selection
  on replay. Test uniform random boundaries with an injected RNG; repeats are valid.

- Species choice is picture-only and available between rounds. Keep the magpie as
  default; a second species changes sprites, cosmetic cadence and feather palette,
  never drop/collision/landing physics or AAC columns. Preserve selection on replay.
  The yellow-tit pose sheet remains an explicit POC art candidate; source hashes and
  fixed cells/pivots/scales belong in its sprite record, not ad hoc per-frame edits.
  Size the yellow tit for readable body/head details (roughly 90 native pixels
  bill-to-tail in flight), and keep completion choices clear of the landed bird.

- The foreground meadow must overlap the rice margin with an uneven connected
  fringe and varied grass blades, not a straight horizontal cutoff. Keep this
  transition within 24 native pixels above the old meadow seam; preserve the rice
  above it and the existing landing height. `test/grass-transition.test.mjs`
  verifies the rendered edge varies, remains bounded and has no gaps below it.

- September 6 follow-up explicitly authorizes bigger charge icons, 15% bigger
  flower heads, three-tone flatter clouds and textured foreground grass.
  `src/visual-tuning.js` owns these cosmetic controls. Stem geometry, leaves,
  cloud silhouettes/placements/drift and gameplay remain unchanged. This narrow
  amendment supersedes the older full cloud/head pixel freeze below. Keep the
  historical baseline immutable; verify it with original cosmetic settings and
  separately compare current stem/leaf pixels and cloud alpha in
  `scripts/verify-visual-tuning.mjs`.

- The live game is text-free: no titles, instructions, score counters, visible
  labels or droplet/action button. Keep invisible accessibility labels and status.
  Playfield touch, Space/Enter and the host switch are the activation paths.
- September 7: default `recharge` mode starts with three charges, capped at three,
  refilling one every six active seconds. Explicit `flyby` remains selectable and
  allows one drop per flyby including misses. The recharge mode refills one every
  six active seconds. Both modes have one active projectile and never queue input.
  Pause freezes refill; collision/pass transitions grant no recharge bonus. Select
  mode only between rounds. Protect both contracts with behavioral tests.
- Readiness belongs in a fixed upper corner, never on the bird's head. Use filled
  and empty icons and visual recharge progress, without visible text or buttons.
  Keep the HUD background and empty interiors transparent; preserve dark visible
  outlines on charge icons and the refill bar. Never restore an opaque panel.
- Each collision emits one brief blue/white feather burst that falls and flutters.
  Preserve bird contours; pause freezes particles and reduced motion hides them.
- Clouds use a shared parameterized field: six by default, nominal 88×38 native
  pixels with size variation. Keep count, lobe shape, puffiness, base height,
  altitude and drift tunable; never restore two hard-coded placements.
  Use distinct parameterized silhouettes, not merely different sizes of one shape.
  Clouds must look soft and rounded: blend the puffs into a rounded underside,
  without clipped flat corners, detached sharp lobes or diagonal slab-like shading.
  Draw two cloud layers back to front: distant/small/slow, then nearby/large/fast.
  Both remain behind gameplay; reduced motion freezes both layers.
- Flower variants are deterministic per column and parameterized in sprite-layout.
  Reuse approved petal/face/leaf contours; vary petal palettes, uniform fixed head
  scale, stem curvature and leaf levels. Preserve variant identity across hits.
  "Flower" includes the entire plant: stem width/curve/green ramp and leaf size,
  number and placement are parameters too. Stems remain continuous when shortened.
- Every demo video must show a miss, a hit, a collision with recovery, and the final
  side-approach landing. Verify coverage from actual game events and retain it in
  the edited clip; never infer coverage from a recording filename or planned inputs.
- Preserve Super Blitz-style descent each pass. On a tall-flower collision, show
  a brief comic bump/flutter and flower wobble, then climb smoothly in place to
  give three more clear flybys (default). Preserve progress; no restart or lives.
- Phone UI regression: `scripts/phone-textfree-check.mjs`. Every phone automation
  must sleep the display and verify OFF in a finally block, including failures.

- Read `rules/ARTWORK_STANDARD.md` first for artwork. It is the governing workflow
  and supersedes conflicting prototype rendering recommendations below.
- Offline scenery conversion follows `research/PIXEL_CONVERSION_METHOD.md` and
  the versioned `rules/scenery-conversion.json` review recipe. Conversion is
  deterministic sampling plus shared indexed palette mapping, never a fresh
  image-generation prompt or a filter over the whole game. Technical checks do
  not grant artwork approval. Keep exact source hashes, crops and frozen masks.
- Cottages use one visible size and flat front elevations of older rural Taiwan.
  Keep placements sparse and use the daylight material ramp in the reusable recipe.
  Connect cottage bases to foreground grass with rice fields and narrow banks;
  no sky-colored gap in the ground. Review tools protect these requirements in
  `scripts/test_pixel_conversion.py`. The user accepted the September 6 complete
  scenery and requested its live POC integration and a full-length video.
- Scenery edits must not change the accepted flowers or clouds, including stem
  curves, leaves, colors, shading, sampling, or placement. Reuse the previous
  review renderer, never redraw plants in a scenery script or quantize these
  protected assets. Run `node scripts/render-flower-review.mjs --leaf-revision
  --rural-scene`: it compares all protected pixels with a frozen earlier rendering
  and must report zero changed pixels. Do not regenerate the baseline to pass.
  Live integration additionally runs `scripts/verify-live-scenery.mjs` against
  the packaged renderer and the same frozen protected-layer reference.
- Mountain sources must show high mountains from lowlands: 北大武山 from 屏東,
  玉山 from 嘉義, 南湖大山 from 宜蘭, or 奇萊 from 花蓮. Verify the named profile
  and source viewpoint; do not substitute aerial slopes or unidentified local hills.
  Attributed open-license photos are authorized for pixel conversion and color
  matching. Record author, source page, license and adaptation details. Complete
  scenery reviews must include a visible static mountain backdrop; test the real
  missing-layer failure with `--test-missing-mountain` (expected nonzero exit).
- The user approved the September 5 generated magpie and flower designs and asked
  for app integration. Preserve their source contours and `rules/sprite-layout.json`
  crop/pivot records. The older procedural rendition remains rejected.
- Final landing must approach from a side, level out, and decelerate onto grass.
  Keep flight poses animated until touchdown for every species; never select a
  standing pose throughout approach. Reduced-motion mode may freeze a flight pose.
  September 7 low-vision readability: shared ammo scale 3, bird multiplier 1.3,
  flower head multiplier 1.4. Preserve stem/leaf geometry and character proportions.
  Tablet playfield fills the viewport with square pixels in both orientations;
  controls overlay it and native system bars stay transient. No phone-width cap.
  Keep `test/landing.test.mjs` passing for left/right at 30/60/120 Hz.

- Read `research/SHAPE_CONSISTENCY_AUDIT.md` before another shape/style change.
  The 2026-09-05 procedural bird and flower rendition is user-rejected. Do not
  promote it, describe it as accepted, or use its contours as a golden reference.
- A styling request preserves the established bird and flower character designs.
  Do not replace their contours with generic geometry or weaken the acceptance
  policy to fit an implementation. Apply shape acceptance to procedural code as
  well as bitmap assets. Numeric helper tests are not rendered-shape evidence.

- Read `GAME_DESIGN.md` before changing gameplay. It is the design specification.
  Preserve automatic fly-by/drop/shorten/descent/landing, fixed flower columns,
  white liquid droppings, and continuous stems. Do not substitute flap-to-rise,
  gates, scrolling, or lives. Add behavioral regression coverage for changed rules.
- Capture demo videos directly as H.264 MP4; do not create MJPEG intermediates.
- Use professional terminology in documentation: design specification, requirements,
  interface specification, and acceptance criteria.

- Keep every mini-game artifact inside `apps/bird-minigame` unless integration
  with another SHINE AAC component is explicitly requested.
- Treat `rules/species-proportions.json` as the character-identity specification.
  Poses may rotate or occlude components but must not resize them.
- Treat `rules/cartoon-style.json` as the only cartoon-exaggeration policy.
  Never improvise a different head, eye, bill, wing, or tail scale per image.
- Treat `rules/pixel-style.json` as a draft shared rendering configuration for all
  objects. Use one square native pixel grid, common outline and light direction,
  deliberate clusters and semantic color ramps. Do not restore mixed-resolution
  sprite scaling or a whole-frame quantization filter. Review at native scale.
- Flower count equals the active AAC `columns` value (3–8). The host passes
  `aacConfig` or `getAacConfig`; never silently reduce the count for portrait.
- Treat `rules/feather-dynamics.json` as the tail-flex specification. Preserve the
  declared arc length while applying its bend-start, tip-drop, tangent, and
  bundle-coherence parameters; a long straight tail is a hard failure.
- Repair and independently verify the guide's arc-length construction before
  treating `assets/guides/tail-curvature-atlas.png` as quantitative geometry evidence.
- Use the source species for body proportions and plumage. When direct flight
  evidence is unavailable, use the analogue declared in `research/sources.json`
  for motion only; never copy the analogue's plumage or body identity.
- Generate one species anchor at a time. Do not generate the final 16-bird sheet
  until all individual anchors are approved.
- Always render and provide the species proportion guide as the first image when
  generating an anchor. Label it a dimensional construction aid, not a character
  contour reference. Supply the earlier actual artwork as the shape reference too.
- Derive new poses by editing the approved anchor. Repeat the locked identity
  invariants in every edit prompt.
- Generated assets are candidates until their manifest records the prompt,
  source rule versions, validation result, and reviewer decision.
- Preserve genuine alpha when transparency is requested. A checkerboard image
  is not transparency.
