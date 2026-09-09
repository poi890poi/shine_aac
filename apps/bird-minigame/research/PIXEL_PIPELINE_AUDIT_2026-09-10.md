# Pixel pipeline audit — 2026-09-10

Type: evidence-backed artwork research and review tooling. Production baseline:
`ba30c2e45e0063a6a44175e3c6e965c58ff2f38e`. No game source, packaged assets, APK,
physics, flower stems, device settings, or display state is changed by this audit.

The user corrected the height report to **landscape**, then accepted the restored
cloud preview. Birds were subsequently added to the transparency investigation.
The approval covers the shown cloud treatment, not all artwork or the installed
pipeline. Review outputs are in `tmp/pixel-audit-20260910/`; the reproducible browser
entry point is `scripts/review-pixel-pipeline.mjs`. It requires the stated baseline
source checkout; do not rerun it against the corrected live renderer and label the
result as installed-before artwork. The saved baseline output remains immutable.

## Findings and causal evidence

| Finding | Responsible mechanism | Evidence and boundary |
| --- | --- | --- |
| Landscape bird starts too low | `gameplayBounds` reserves 148 native pixels, then maps startY=0.14 over the remaining height | On the tablet's 640 x 400 frame, anchor Y is 148 + 0.14 x 252 = 183.28, 45.8% down. The review-only 132-pixel anchor changes only bird placement. Portrait is unchanged. |
| Mixed apparent pixels remain | Output grid checks start after coarse asset geometry and resizing | Bush profiles are painted with units of 2 or 3. Grass doubles complete blade patterns below ground+30. Ammo also magnifies its template 3x. All can pass the final 3x framebuffer test. Larger color clusters alone are not defects; repeatedly magnifying a whole low-resolution motif makes its underlying grid visibly different. |
| Some birds have uneven detail/contours | Fourteen species are first downsampled to their catalogue scale, then enlarged 1.3x at draw time | The installed and direct-source comparisons hold pose/final dimensions fixed. A 1.3x nearest resize replicates some source pixels once and others twice. The original magpie/yellow tit use a different preparation path. |
| Birds/flowers still look unlike deliberate native sprites | Generated source blocks, many fine color variations, and arbitrary source-to-output sampling survive a shared framebuffer | Direct sampling removes a known double-resize problem, but does not finish pixel clusters or guarantee eyes/beaks/feathers/expressions. Flower heads are already sampled directly; applying the bird fix alone does not address them. Leaves have multiple sampled sizes. Stems are independently rasterized and must stay protected. |
| Clouds have missing interior shading | `reviewed-scenery.js:cut` flood-removes colors within RGB distance 48 of a cyan corner | Connected blue shadow regions also meet that predicate. Source-specific cyan extraction restores them before the unchanged flattening, size, palette, blur and alpha threshold. All six source clouds visibly show the difference on a contrasting backdrop. |
| Bird transparency is unreliable | `exteriorMatte` removes boundary-connected near-neutral pixels with min(R,G,B)>165 and channel spread<45 | It has no semantic distinction between backdrop and pale feathers. White feather pixels connected to the exterior can disappear; background enclosed by contour pixels can remain. Original magpie/tit source sheets contain a baked checkerboard. This rule cannot establish a correct per-pose mask. |

The cloud matte trial uses boundary-connected `(B-G)<=20 && (G-R)>=24` for this
specific source. It is not a general-purpose bird or photo background remover.
At the common 250-pixel diagnostic width, the corrected trial restores 2,622 to
7,804 native opaque pixels per cloud relative to the installed extraction. Those
counts measure the difference, not independent proof that every changed pixel is
correct. Source inspection and the user's visual approval establish the selected
cloud direction. The six exact native exports and hashes are recorded in audit.json.

The retained approved image is `cloud-preview-approved.png`; the later comparison
sheet uses integer 1x inspection instead of the first sheet's 1.15x presentation.
The six cloud asset pixels are unchanged between those presentations.

## Open-source code and artist references checked

1. [Godot: multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)
   recommends viewport rendering and integer enlargement for pixel art. This
   validates our final-screen architecture; it does not repair poor source assets.
2. [Sprite Fusion Pixel Snapper, MIT](https://github.com/Hugo-Dz/spritefusion-pixel-snapper)
   and its [actual Rust implementation](https://github.com/Hugo-Dz/spritefusion-pixel-snapper/blob/main/src/lib.rs):
   edge profiles estimate an existing grid; an adaptive walker chooses cell cuts;
   resampling selects the most frequent RGBA value in each cell. A fixed palette
   is supported. Its source explicitly notes possible distortion from adaptive
   cuts. Useful for investigating generated pseudo-pixels, but independently
   detecting a grid in every bird pose could change relative proportions and
   animation stability. Reviewed, not installed or benchmarked here.
3. [PixelOE, Apache-2.0](https://github.com/KohakuBlueleaf/PixelOE) and its
   [legacy pipeline](https://github.com/KohakuBlueleaf/PixelOE/blob/main/src/pixeloe/legacy/pixelize.py):
   outline expansion precedes downsampling; nearest enlargement comes last.
   Expansion can preserve small features but changes contour thickness. The
   inspected legacy color-matching step follows quantization, so a fixed-palette
   contract needs a final explicit palette check. It is not an approved automatic
   replacement for species faces, flower expressions or mountain skylines.
   Reviewed, not executed here.
4. [Aseprite: color modes](https://www.aseprite.org/docs/color-mode/) separates
   RGBA opacity or an indexed transparent entry from visible color. White is not
   inherently transparent. [SpriteSize API](https://aseprite.org/api/command/SpriteSize)
   provides nearest resizing; that is a sampling operation, not shape acceptance.
5. [Cure: The Pixel Art Tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299)
   and [Saint11: Cluster Sketching and Painting](https://saint11.art/pixel_art_articles/article2/)
   emphasize meaningful clusters, readable forms and controlled contour steps.
   A common grid does not mean every cluster or every distant plant must have
   identical size. No tutorial artwork was copied into this project.
6. [OpenCV: GrabCut](https://docs.opencv.org/4.13.0/d8/d83/tutorial_py_grabcut.html)
   supports explicit foreground/background labels and corrective strokes. This
   is a useful mask-authoring workflow: semantic feather regions can be protected
   instead of broadening a color threshold. No GrabCut output is claimed here.

## Reusable preparation contract

- Keep the 360 x 800 portrait / aspect-adapted shared virtual framebuffer and one
  final integer display enlargement. Do not make the entire scene coarser to hide
  source inconsistency; previous eye/stem degradation remains rejected.
- Record source hash, intended final native dimensions, shared pose scale, anchor,
  source mask and palette. Build each sprite at that size once, then draw 1:1.
  Species may have different physical sizes; their drawing grid must not differ.
- Author explicit per-pose foreground masks. Review white cheeks, wing/tail bars,
  gaps between feathers, feet and beaks against the original. Seeded segmentation
  may assist, but mask corrections must be saved and reproducible. Do not remove
  all white, fill all holes, or infer opacity from a color after palette mapping.
- Maintain reviewed size variants for clouds/leaves instead of resizing an already
  reduced sprite repeatedly. Keep flower stem geometry and leaf attachment masks
  independent. Preserve the existing characters and visible object sizes.
- Shape bushes at the final native grid. Grow near grass by blade length/spread and
  designed clusters rather than multiplying every cell of a coarse motif. A motif
  can include thick clusters, but its contour must be deliberately drawn.
- Review native and integer-zoom crops. Check local eye/beak/tail and face/petal
  landmarks, not just a whole-image similarity score or palette count.
- Test opacity on white, dark, pink and actual scenery backgrounds, every shipped
  pose and animation transitions. Add named source landmarks that must remain
  opaque/transparent and adversarial missing-feather/trapped-background fixtures.
- Keep final output-grid checks, but name their limited scope. Add preparation
  checks that reject a second resize and unreviewed masks. Never convert those
  mechanical results into a blanket aesthetic PASS.

## Review disposition

- **Cloud matte:** selected by user visual review. Preserve exact shown treatment.
- **Direct bird sampling:** useful isolated improvement; not a complete style or
  transparency fix. Do not promote as finished art.
- **Foliage trial:** diagnostic. It removes coarse cell magnification, but the bush
  crowns still read too much like small ridges and grass needs deliberate cluster
  refinement. It is not approved final art.
- **Landscape 132-pixel start:** composition study, not a validated gameplay/HUD
  layout. Current flight poses extend up to 88 native pixels above the anchor.
  A raised path therefore needs explicit HUD clearance checks during every pass;
  do not hide controls or shrink birds to make that test pass. Portrait stays fixed.
- **Bird alpha:** unresolved asset-mask defect. All 16 species and 63 shipped pose
  images are exported across four diagnostic atlases (magpie has three poses).
  No new bird mask has been silently substituted.

No APK was rebuilt or installed, and no physical display was used in this audit.
The existing source-backed mountain credits remain applicable to scene previews:
`../../../../docs/reviews/2026-09-09/artwork-credits.html`.

## Native transparency and GPU / hardware composer follow-up

The user asked why native transparency and hardware scaling are not used directly.
Image metadata confirms magpie-v1.png, yellow-tit-v1.png and taiwan_barwing.png are
RGB, with implied alpha 255 everywhere. The baked white/checkerboard background is
not native transparency. The runtime currently synthesizes alpha via color/flood
rules. The target asset pipeline should export reviewed RGBA PNGs once, preserving
white artwork and explicit transparent gaps, and simply load that alpha at runtime.
There is no need to regenerate the character design to achieve this.

A concrete retained-background defect is visible in the standing Taiwan whistling
thrush: the white gap between its legs remains opaque on the pink review background.
Similar white wedges appear in several standing poses. Boundary-only flood removal
cannot reach these enclosed areas. Conversely, globally removing all white would
remove actual white plumage. These are distinct mask errors and need explicit labels.

Source inspection: MainActivity creates a normal WebView and does not force a
software layer. The manifest does not disable Android's default hardware acceleration.
The game uses Canvas2D for its native frame and `drawImage` for integer enlargement
into a physical-sized canvas. There is no explicit WebGL renderer, low-resolution
SurfaceView, or SurfaceControl scaling path. Canvas2D's actual GPU backing and
per-frame Hardware Composer assignment have not been traced on the devices.

[Android hardware acceleration](https://developer.android.com/develop/ui/views/graphics/hardware-accel)
explains the default and that accelerated windows do not guarantee every offscreen
canvas is accelerated. [Chromium's canvas readback explanation](https://github.com/fserb/canvas2D/blob/master/spec/will-read-frequently.md)
explains why CPU readback can change or stall a GPU path. Asset preprocessing here
uses getImageData; final-frame pixel reads are diagnostic operations, not normal
per-frame gameplay. Move preparation offline before evaluating runtime performance.

[SurfaceFlinger / HWC](https://source.android.com/docs/core/graphics/surfaceflinger-windowmanager)
composes submitted layer buffers and negotiates client versus device composition.
Our game frame is already enlarged inside WebView before that stage. HWC is not an
explicit game-scaling implementation here, and an application cannot promise a
particular hardware-plane assignment on every device.

A candidate for predictable GPU rendering is a WebGL native-resolution framebuffer,
RGBA texture sprites with fixed native dimensions, and one NEAREST-filtered integer
fullscreen pass. This is an experiment to benchmark against Canvas2D, not an assumed
performance win or an implemented change. A native GLES/SurfaceView path is a larger
Android integration change. Either path needs actual GPU/composition traces and
nearest-pixel output verification; hardware scaling does not fix incorrect masks.
