# Pixel-style parameter guide

Review status: the current procedural bird and flower shapes are **user-rejected**.
This parameter system does not establish acceptable shape or drawing quality.
Read `../research/SHAPE_CONSISTENCY_AUDIT.md` before continuing. The earlier positive
comparison-sheet assessment is superseded by the user's rejection and this audit.

`pixel-style.json` is the global rendering specification. `species-proportions.json`
owns anatomy, `cartoon-style.json` owns exaggeration, and `feather-dynamics.json`
owns feather curves. A style change must not silently change those independent rules.

| Parameters | Meaning and adjustment |
| --- | --- |
| `grid.minimumWidth`, `columnPitch` | Common native scene resolution. Width is at least column count × pitch. Every object shares this grid. |
| `grid.minimumHeight`, `maximumHeight` | Portrait/landscape fitting bounds. Display uses one integer physical-pixel multiplier on both axes. Letterboxing is intentional. |
| `outline.width` | One or two native pixels, shared across silhouettes. Interior semantic details may remain one pixel. |
| `outline.foreground`, `background` | Named palette roles. Foreground has stronger contrast; clouds use a lighter outline of the same width. |
| `shading.bands`, `lightDirection` | Two or three bands; a common 2D light vector. Curved cloud lobes use local surface directions. |
| `highlightThreshold`, `shadowThreshold` | Where shared light/base/shadow bands transition. Avoid narrowing bands into contour-hugging rings. |
| `palette`, `ramps` | Sixteen semantic colors; shadow/base/light relationships for each material. White droppings remain pure white. |
| `clusters.minimumArea` | Review target for connected shading/texture clusters; the prompt and grass highlight rule consume it. It is not an automatic guarantee of every cluster's aesthetic quality. |
| `clusters.textureDensity` | Grass tuft spacing. Zero removes surface texture while preserving the grassy silhouette. No random pixel noise. |
| `animation.framesPerSecond` | Native key-pose cadence. Positions snap to the same grid; no rotated or interpolated bitmap pixels. Physics timing is independent. |
| `animation.cloudPixelsPerSecond` | Decorative cloud drift, suppressed for reduced motion. |
| `bird.torsoPixels` | Uniform character scale. All component lengths derive from the locked bird ratios. Do not use it as a head/wing/tail exaggeration control. |
| `tailFeathers`, `tailTipFraction`, `eyePixels` | Two/three feather identity, white tip marking, and minimum readable eye detail. |
| `flower.*` | Native petal/face sizes, count, stem width, and leaf shape/locations. Stems are redrawn continuously at each height, never stretched source images. |
| `cloud.*` | Native size and normalized lobe placement. Shape and lighting remain connected to the common outline/grid. |
| `grass.*` | Reusable tuft size, blade height, and texture-cluster width. The ground is always a grass meadow. |

The validation function rejects out-of-range values and malformed palette/ramp
definitions. Boolean fields in `acceptance` describe non-negotiable review rules,
not switches for enabling mixed-resolution or filtered art.

## Review and iteration

1. Open `art-lab.html`; compare bird poses, neutral/hit flowers, clouds, and grass
   together at native 1× and integer 2×/4× zoom.
2. Change one global parameter at a time. Check silhouette readability, connected
   clusters, contour rhythm, common lighting, and detail density. Inspect white
   splashes and the neutral-versus-hit expression at gameplay size.
3. Check three and eight AAC columns as well as the active device setting. Never
   resize one asset category independently to make a dense layout fit.
4. Export the JSON, increment its rule version, retain a comparison image, and
   record the visual review decision. Run `npm test`, `npm run validate`, and the
   build. Bird anatomy and tail length checks must still pass.
5. A new bitmap candidate is not accepted merely because it uses few colors or
   has the right dimensions. Preserve its provenance and review it alongside the
   complete native set before changing production art.

## Current implementation status

This is the first common native-pixel rendition, available for user review and
further refinement. Tests protect grid/palette rules, configurable outlines and
lighting, preserved species dimensions and curved tail arc length, continuous
stems, and all AAC column counts. They do not claim expert art approval.
