# Reusable scenery conversion — research and trial contract

Type: artwork tooling and review-only design change. Owns source preparation,
offline sampling, shared palette mapping, artifact validation and review sheets.
Does not change the live renderer, gameplay, bird/flower identity or Android app.

## Current decision: revision 0.3.0

The user rejected the experimental straight stems and explicitly froze flowers
and clouds. The Python composition function that redrew plants was removed.
The active recipe excludes both asset categories, and source hashes/category
guards reject attempts to convert them. Earlier comparison outputs remain rejected
research evidence, not candidates for integration. Historical trials below are
retained to explain the failure; their cloud/flower defaults are superseded.

The new composition uses the earlier JavaScript flower and cloud rendering with
identical source crops, curves, leaf presets, scales and placements. Its transparent
protected-layer PNG is compared against a snapshot extracted before the scenery
edit: SHA-256 `2d5d6e3da631a32911efcb41f95d2abd4b97865412a71573107bfd91625908ea`.
The comparison reports **zero changed pixels**, and a deliberate pixel mutation
is detected. This protects this specific artwork baseline; it is not a universal
shape-quality metric. Do not regenerate the baseline to make a new rendition pass.

### Rural references and reusable settings

The photographed [Fen-yuan farm shed and rice fields by 17旅行](https://www.17travel.tw/2020/06/blog-post_2.html)
(photographed June 1, 2020) informed the broad fields, sparse building placement,
warm materials and narrow paths. The photograph was visually inspected, not copied
into artwork or redistributed. The [Taiwan Historica courtyard entry](https://dict.th.gov.tw/detailPage.aspx?Ca=323&ID=1815)
describes the grain-drying courtyard; a small dry apron separates each cottage
from the rice. These are composition cues, not a reconstruction of that farm shed.

`rules/scenery-conversion.json` now records a 480×640 review scene, two identical
84×44 cottages at x=55/331 (192 native pixels of clear gap), minimum gap 180,
rice band y=520..609, grass starting at 610, path points, bank widths, plant spacing,
seed and rice colors. `daylightPalette` replaces only cottage material entries:
every sprite index and alpha value stays unchanged. Flowers and clouds have no
parameters in this scenery recipe. Tune these scenery settings, increment the
recipe version, export to a new candidate directory, and repeat pixel verification.

Verification: nine converter tests pass (including protected-source rejection,
palette-only brightness, sparse/equal houses and continuous ground). The browser
comparison independently reports zero changed flower/cloud pixels. The lowland
mountain source decision is still pending; the new rural review omits mountains.
No app integration or physical-device test was performed.

### Mountain omission correction

The user subsequently authorized attributed photos for conversion/color matching.
Cause: the new rural renderer loaded ground and protected art, but no mountain;
the existing pixel comparison could pass with that entire scenery layer missing.
Scope: review-only composition/tooling; gameplay, cottages, fields, flowers and
clouds remain fixed. The full scene now requires a visible mountain color region;
an actual omitted draw call (`--test-missing-mountain`) must fail before export.

Selected photo: Greenigor, “日出前的北大武山”, February 10, 2016, looking up from
大新村, 內埔鄉, 屏東. [Source](https://commons.wikimedia.org/wiki/File:日出前的北大武山.jpg),
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The source page's viewpoint and image were checked. `rules/mountain-photo.json`
records its SHA-256, crop, explicit source-specific sky matte, native size and
four daylight tones. `scripts/convert-mountain.py` uses Pillow BOX sampling and
a 5×5 median on native luminance to reduce photographic speckles before palette
mapping. The separately sampled source silhouette is unaffected by color cleanup.
This recipe converts a fixed photograph; it does not generate mountain shapes.
The adapted mountain and composed review are distributed with CC BY-SA 4.0 credit.
Mountain art remains a review candidate; source identity is not aesthetic approval.

Run `python scripts/convert-mountain.py` before the browser review. Eleven Python
tests cover the converter, including source skyline brackets, four colors, alpha
and mask invariance under color cleanup. The browser requires visible mountains
and compares flowers/clouds exactly. No device was used.

## Existing solutions checked first

- PixelOE (Apache-2.0): contrast-aware outline expansion and several samplers.
  https://github.com/KohakuBlueleaf/PixelOE
  Its current full package requires Torch, torchvision, OpenCV and Kornia. The
  legacy color-matching pass can introduce colors after quantization. Treat its
  palette reduction as an intermediate operation, not a final palette guarantee.
  Outline expansion changes contours; it is unsuitable as an unchecked default
  for geographic skylines or accepted character faces. Reviewed, not run here.
- Astropulse/pixeldetector (MIT), k-centroid: chooses the dominant cluster within
  each source tile. Reuse its pinned Pillow implementation rather than inventing
  a competing sampler. This trial disables optional outline expansion.
  https://github.com/Astropulse/pixeldetector/blob/6e88e18ddbd16529b5dd85b1c615cbb2e5778bf2/k-centroid.py
- PixelOver: non-destructive resampling, palette indexation and short-edge cleanup
  with manual animation/editing tools. Useful editor workflow, not installed or
  benchmarked here. https://docs.pixelover.io/manual/shader/
- Aseprite: indexed palettes, batch CLI and pixel editing for the final manual
  cleanup. Useful interchange/review tool, not installed or benchmarked here.
  https://www.aseprite.org/docs/cli/
  https://www.aseprite.org/docs/color-mode/
- Pillow: existing BOX/NEAREST samplers, explicit-palette quantization without
  dithering and indexed PNG export. These provide a small repeatable baseline.
  https://pillow.readthedocs.io/en/stable/reference/Image.html

## Frozen experiment

Compare NEAREST, BOX and pinned k-centroid (two centroids) on identical source
crops, alpha masks, target dimensions and palette subsets. No generation between
columns, no automatic contrast adjustment, no per-image palette extraction, no
dithering, no outline expansion. Record input, recipe, palette, code and output
hashes plus dependency versions. Algorithm timing excludes file I/O and review
sheet rendering; a single run is not a performance benchmark.

Development samples: the existing Taiwanese cottage and accepted cloud A design.
Holdouts: cloud E, the approved flower's source head, and the existing CC0 Dongli
photo crop. Dongli is only a conversion fixture, not an accepted mountain choice.
The user selected four lowland mountain viewpoints; none is replaced by Dongli.
No fresh photo capture is necessary or available for this offline tooling trial.

## Reusable conversion contract

1. Confirm source license and actual viewpoint. Record source hash, crop, landmarks
   and exact intended logical size. For mountains, preserve the named skyline
   from the photograph; image generation is not the conversion stage.
2. Prepare source alpha/mask separately; review the skyline/roof/petal silhouette.
   A flat background may use an explicitly recorded exterior flood matte. Never
   infer an automatic matte for an arbitrary photograph. Keep mask source evidence.
3. Rasterize each asset ONCE to its intended dimensions on one scene pixel grid.
   Round only the dependent height from the uniform width scale; never stretch
   axes independently. All display enlargement is integer nearest-neighbor.
4. Sample color with the selected existing sampler. Keep the independently
   rasterized coverage mask identical across method/palette experiments.
5. Map to a versioned shared palette using explicit material subsets. Two or three
   tones per material, with upper-left highlights in authored assets. An 8-bit
   indexed file alone does not establish 8-bit game art quality or hardware fidelity.
6. Manually review clusters, stair-step rhythm, eyes/windows, thin connections and
   negative space at 1x and 4x. Record edits as native-pixel patches/masks; do not
   regenerate the entire image. Never automatically delete all one-pixel details.
7. Verify exact dimensions, palette membership, binary alpha and lossless integer
   enlargement. Compare masks/landmarks with source; diagnostics do not certify
   aesthetic quality or character identity. Attach user decision to exact hashes.
8. Export native indexed PNG, integer preview, recipe and manifest. Keep candidates
   outside production until the source, grid and visual review are accepted.

## Scene composition additions

The user requested rice fields to fill the unnatural space between cottages and
flowers, and cottages of one size. Use equal visible cottage dimensions without
distorting façades; normalize source designs first, then use one shared scale.
Rice rows and narrow earthen banks are authored directly on the same native grid
and shared palette. They provide ground continuity, not new gameplay collision
objects. Verify the cottage bases meet the fields and grass without a sky gap.

## Trial result and selected defaults

| Input | NEAREST | BOX | k-centroid (2) | Decision |
| --- | --- | --- | --- | --- |
| Cottage, 84 x 44 | Noisy roof/brick marks | Quieter walls; clear roof, doors, windows | More sparse texture and altered small marks | BOX as scenery preparation default; manual roof cleanup and user review still needed |
| Clouds A/E (historical, now excluded) | Three shading bands retained | Three bands retained; slightly calmer transitions | Three bands retained; more angular local steps | Superseded: preserve previous rendering exactly |
| Flower head, 44 x 41 | Eyes/mouth differ from source | Expression blurred into different small clusters | Eyes/mouth differ from source | Reject all three as character replacements |
| CC0 photo fixture, 320 x 67 | Dense speckling | Broader, quieter regions | More fine speckling | BOX starting point; none is finished mountain art |

The first trial used an RGB-distance exterior sky matte. It erased blue shading
inside cloud A: source pixels at local (180,180), (250,180), (300,160), (100,195)
became transparent. Revision 0.2 uses an explicit source-specific blue-sky chroma
predicate, distinguishing cyan sky from neutral highlights and blue shadows.
Those manually inspected interior landmarks are now regression fixtures. This
does not establish a universal automatic background extractor.

The flower height trial also exposed a rounding distinction: deriving scale from
the already-rounded width produced 44 x 40; the approved renderer's source scale
0.125 produces 44 x 41. Recipes now allow an explicit uniform scale, rounding
both source axes only once. The corrected dimension still does not restore the
expression under this palette/sampling combination. Keep the failed outputs.

The rejected revision-0.2 ground composition used BOX, the same 84 x 44 cottage template at all three
placements, and native-grid rice plants/banks. Its focused review excludes flower
faces because their conversion failed visual acceptance. The full native scene is
an experimental fixture, not a proposed replacement for the approved flowers.

Historical revision-0.2 evidence: seven executable tests for source identity, independent expected
alpha geometry, sampler/palette mask invariance, deterministic pixels, integer
previews, rejection of invalid output, preserved cloud shadows, equal cottages,
and continuous rice-to-grass ground. File encoding is separately re-opened and
checked for dimensions, material-palette membership and binary alpha. This is
mechanical evidence, not an automatic character/landmark acceptance system.

No claim that BOX is universally best, no performance ranking, and no claim of
actual NES hardware constraints. The 32-color palette is scenery-only; it must
never be applied over the protected flowers, clouds or a complete frame.

## Reuse

Run from the bird-minigame directory with Python 3.12 and the pinned dependencies
in `scripts/pixel-conversion-requirements.txt` (Pillow 12.3.0, NumPy 2.3.5).
No Torch, GPU, model service or image-generation request is needed for conversion.

```sh
python scripts/convert-scenery.py --profile rules/scenery-conversion.json --method box --out assets/candidates/my-conversion
python scripts/convert-scenery.py --review
python scripts/test_pixel_conversion.py
node scripts/render-flower-review.mjs --leaf-revision --rural-scene
```

For another photograph, copy the profile, replace `recipes` with the new source
path/hash, source license, crop and uniform scale or native width, and select its
material subset. Keep the shared palette and native scene grid fixed. Use an
explicit supplied alpha or reviewed source-specific matte; `opaque` preserves a
photograph without attempting sky removal. Omit `--review` for custom inputs;
that flag is the bundled scenery-only comparison harness, not a requirement for conversion.
The sampler flag is the only variable in each comparison; all other recipe fields
are shared. Any edit produces a new profile version and review output directory.

Outputs: native indexed PNG, integer enlargement, prepared source crop, profile
snapshot and manifest with source/code/palette/output hashes and library versions.
Visual decisions bind to exact artifact hashes in `visual-review.json`.
