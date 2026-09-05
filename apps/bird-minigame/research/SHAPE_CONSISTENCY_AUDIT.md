# Shape-consistency method audit — 2026-09-05

## Decision

The procedural bird and flower rendition introduced by the global pixel-style
change is **rejected by the user**. It substantially degrades the earlier drawing
quality. The prior bird and flower assets are the restoration/reference starting
point; their formal component-level acceptance must be established separately.

The failure has two layers: the earlier production method was documented but
never completed or enforced, and the latest change bypassed its central design
constraint. Passing rule and gameplay tests was incorrectly presented as supporting
shape preservation. The assistant's visual review also failed to reject obvious
loss of form, anatomy, and expression.

This audit changes review policy and evidence claims. It does not repair or approve
the current art, and does not install a complete production acceptance gate.

## Recovered earlier agreement

The inspected session `01a069cb-59e0-7340-8349-49c8f3abadfd` records:

- 2026-09-04 01:13 UTC: the user asked for accurate, repeatable body-component
  proportions while retaining cartoon character consistency.
- 01:37 UTC: the assistant rejected a guide-conditioned Mikado trial and described
  the production sequence: approve an anchor, separate components, then create
  poses through fixed pivots and rigging. Full redraws were not that method.
- 01:50 UTC: the user required natural long-feather curvature to be parameterized,
  rather than obtained by another unconstrained regeneration.

`research/generation-trials.json` still states the resulting conclusion: production
needs an approved component-separated anchor and deterministic rig/compositing.
The recorded Yellow Tit and 16-bird sheets remain candidates or rejected trials.
The Blue Magpie pilot used in the game has no adjacent approval manifest in the
inspected module. The neutral flower is explicitly an `mvp-candidate`.

Therefore earlier artwork can be a much better visual reference without pretending
that its formal shape acceptance was completed. My earlier description of it as
"approved raster artwork" was not supported by the records inspected here.

## Findings

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Scalar proportions are an incomplete shape model | `species-proportions.json` contains six size ratios and identity phrases; contour paths, component masks, landmarks, and approved pivots are absent | Many visibly different birds can satisfy the same nominal numbers |
| The prescribed production pipeline was never built | Trial conclusion and pose prompt require an approved anchor and component rig; runtime has neither an accepted component asset set nor its provenance | A guide/prompt workflow was mistaken for a shape-preserving implementation |
| The newest code replaced both designs | `src/pixel-art.js` builds bird bodies/wings and flower heads/leaves from new primitive geometry | Rounded feathered wings, body mass, expressive petals/faces, and fuller leaves were lost |
| The ratio tests are circular | `birdGeometry()` computes dimensions from the rule ratios; the test divides those dimensions and compares them with the same ratios | It does not measure the rendered silhouette, attachment positions, or visible component shapes |
| Asset acceptance is unenforced | `validate-rules.mjs` checks numeric ranges, flags, and required-file existence; it does not evaluate `hardFailures`, actual manifests, approval decisions, or image measurements | Candidate/rejected/unmanifested artwork can enter the build |
| The old guide's geometry is itself incomplete | Proportion guide uses generic ellipses, a straight tail triangle, a capped folded-wing ellipse, and hard-coded landmarks | It is a construction aid, not an independent full contour/pose authority |
| Curvature implementations disagree | PowerShell guide uses a Bezier with horizontal span equal to declared length; runtime uses a separate piecewise polynomial and arc normalization | The illustrated guide does not implement exact declared arc length or a literal straight-prefix bend location |
| Native pixel feasibility was not checked | Current head nominal diameter is 7.392 px; ellipse radius rounding creates a 9 px primitive before occlusion | A nominal 6% tolerance cannot be assumed to survive rasterization of tiny parts |
| Flower consistency was under-specified | Flower metadata records origin/transparency; there is no accepted petal, face, leaf, or expression geometry reference | A continuous stem and a changing face were treated as adequate proof of character preservation |
| Review lacked a mandatory old/new comparison | The latest atlas compared the replacement objects with one another | Internal style uniformity obscured a substantial quality downgrade from the previous art |
| Policy was weakened during implementation | `GAME_DESIGN.md` was changed from reusing sprite art to treating it as a loose visual reference | The implementation altered the constraint it should have been checked against |

The guides and species research retain value. Their scope must be described
accurately. In particular, the initial numeric ratios are declared art-direction
measurements, not independently established biological measurements.

## Adversarial test evidence

Run `node scripts/audit-shape-consistency.mjs` from the module. It copies source and
tests into `tmp/shape-consistency-audit-20260905/`; production source is untouched.
It runs the existing seven pixel/style tests against isolated mutated renderers.

| Renderer under test | Tests passed | Visual defect caught? |
| --- | --- | --- |
| Current baseline | 7 / 7 | Not an art acceptance result |
| Bird drawing completely removed | 7 / 7 | No |
| Flower replaced by bare stem and small circle; petals, leaves and face removed | 7 / 7 | No |
| Both failures together | 7 / 7 | No |

This directly establishes that the current suite cannot substantiate the claimed
bird/flower shape consistency. The other tests cover gameplay, API, and prompt
content; they do not supply the missing visual acceptance evidence.

The same audit independently integrates the PowerShell guide's actual Bezier
control points: Blue Magpie arc length is **2.52% longer** than its declared span;
Mikado is **3.01% longer**. These are not asserted to exceed the general 6% ratio
tolerance. They contradict the stronger claim that the guide preserves exact arc
length. They are a separate method defect, not the cause of the large quality loss.

Raw TAP results, source/test hashes, copied mutations, and measurements are in
`tmp/shape-consistency-audit-20260905/audit.json` and its sibling files. The hash
identifies the tested source because this mini-game remains untracked in the
parent Git repository. No missing-bird image was substituted into production.

## Corrected method

### 1. Establish actual visual baselines

Recover the previous bird strip, neutral flower, and hit-expression sheet as
provisional baselines. Preserve their file hashes and prior screenshots. Record
which exact views the user accepts; do not infer approval from a filename, a
successful generation, or a gameplay demonstration.

For the one-bird MVP, prepare one character component set and its three flight
poses, plus the flower's neutral and hit expressions. Include both native-size
and enlarged comparisons to the existing artwork. A new common style must retain
the previous level of shape design, expression, and readability.

### 2. Separate shape ownership from rendering style

The shape specification needs actual named component contours/masks, attachment
landmarks, pivots, feather structure, and approved pose/occlusion references.
Flower shapes need petal/face/leaf contours and expression landmarks too.

Anatomy and character design belong to this accepted geometry. Pixel scale,
palette ramps, outline treatment, and lighting belong to style. A style request
does not authorize replacing the shape templates or independent component scaling.
If the chosen native resolution cannot preserve essential features, adjust the
global resolution or seek a specifically reviewed simplification.

### 3. Use one tested geometry implementation

A corrected shared curve implementation should generate guide and runtime
centerlines. Verify arc length, root/tip tangents, bend position, and individual
feather paths by an independent numerical evaluator. Reusing the same code for
construction and expected answers would repeat the current test error.

Create poses by transforming the accepted components around recorded pivots.
Keep any restyle/redraw as a separate candidate until its geometry comparison
and visual review are complete.

### 4. Test output and test the tests

Evaluate actual rendered component masks and landmarks against frozen reference
data, including after rasterization, compositing, and display scaling. Compare
matched poses; allow only documented translation, uniform scale, and legitimate
occlusion. Independent head/tail stretching must not be normalized away.

Use local contour/landmark and component-area measurements as diagnostics; a
whole-bird overlap score can conceal a damaged head, bill, or wing. Establish
tolerances from accepted examples and native pixel feasibility, then freeze them
before evaluating new candidates. Do not invent an arbitrary overlap threshold
and call it evidence of artistic quality.

Before trusting the gate, prove that it rejects missing birds, missing petals,
stretched bodies, triangular wing substitutions, shortened/straightened tails,
detached roots, misplaced eyes, and flattened expressions. Retain those negative
examples as regressions. New candidates need a fresh reviewed comparison.

### 5. Make visual acceptance a separate promotion requirement

A proposed production-art gate must require the exact asset/renderer hash,
accepted baseline identity, rule versions, rendered comparison evidence, and a
recorded visual decision. Missing, stale, candidate, or rejected evidence cannot
produce an art-acceptance PASS. This applies to procedural code as well as PNGs.

Rule-file consistency, gameplay correctness, rendered shape agreement, and visual
quality are separate results. No one result substitutes for another. Human visual
review remains necessary for the expressive/drawing-quality gap seen here.

## Current disposition

- **Retain:** previous bird/flower art as provisional visual baselines; species
  research; the useful proportion/rig/feather concepts; working AAC column logic.
- **Reject:** the procedural bird and flower rendition and its positive visual
  assessment. Parameterization alone does not justify keeping poor shape templates.
- **Correct next:** reconstruct and review the actual component/pose baselines,
  repair guide/runtime geometry agreement, and implement an independently tested
  output/promotion gate before attempting another production restyle.
- **Not established:** a complete approved component set, reliable rendered-shape
  evaluator, or enforced build-time art promotion gate. This audit must not itself
  be cited as evidence that those items are implemented.
