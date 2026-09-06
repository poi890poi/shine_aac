# Bird mini-game working rules

- The live game is text-free: no titles, instructions, score counters, visible
  labels or droplet/action button. Keep invisible accessibility labels and status.
  Playfield touch, Space/Enter and the host switch are the activation paths.
- Default `flyby` mode allows one drop per flyby, including misses. Optional
  `recharge` mode starts with three charges, capped at three, refilling one every
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
- The user approved the September 5 generated magpie and flower designs and asked
  for app integration. Preserve their source contours and `rules/sprite-layout.json`
  crop/pivot records. The older procedural rendition remains rejected.
- Final landing must approach from a side, level out, and decelerate onto grass.
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
