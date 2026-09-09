# Native artwork and GPU rendering — 2026-09-10

## Scope and decision

Authorized by the user's Go after review of cloud alpha, native transparency and
GPU scaling. Baseline: ba30c2e. This change repairs asset preparation and landscape
placement and adopts the measured WebGL renderer. Bird identities, flower stems,
portrait starting height, physics, input preferences, AAC columns/drafts, hidden
entry, ammo, recovery, landing and source mountain identities remain unchanged.

The supplied cloud preview is the only newly accepted aesthetic reference. Other
implementation images remain available for user review; passing numeric checks
is not a claim that every source sprite has hand-authored pixel-art quality.

## Cause and implementation

- Fourteen birds were resized twice, while magpie/tit followed another path.
  Sixty-three poses now sample original crops once at final readable dimensions.
  PNGs carry actual RGBA; drawing uses native dimensions and aligned anchors.
- Generic matte removal retained enclosed white background between legs/toes.
  Inspected source-space seeds remove 11,346 background pixels across the source
  crops. The independent legacy-mask comparison finds no changes outside those
  regions and preserves 205,294 opaque near-white source pixels. This verifies
  the known corrections; it does not semantically certify every pale feather.
- Flower heads and isolated leaf sizes are baked once; stems remain independent.
  Eighty expression/height/variant cases have zero changed stem pixels and 34,200
  visible added leaf pixels. Grass/bush silhouettes use native columns/pixels
  instead of enlarging whole coarse grids. Ammo keeps its large footprint and
  transparent interior, with native contour steps.
- The cyan cloud key erased blue shadows. The corrected source-specific matte
  reproduces the reviewed source mask. However, replaying the historical browser
  blur changed up to 542 RGBA channel values at diagnostic size, and disabling
  accelerated canvas changed the result again. Browser resampling is therefore
  not an exact portable artwork reference. The six accepted native PNG masters
  are retained byte for byte and used directly at their native dimensions;
  cloud size variants derive from them. Original source-sized masks are retained
  for audit. Cloud sizes, layers and placements retain their original dimensions.
- Landscape starts at native y=144 rather than 183.28 on 640x400. The shared
  clear-sky projection fades to identity before flowers, preserving contact and
  landing. The tallest 88-pixel flight extent clears the charge/refill row.
- WebGL draws the complete scene into one native RGBA framebuffer. A single
  NEAREST integer pass enlarges it to the physical canvas. High-precision texture
  coordinates, premultiplied alpha and disabled dithering retain aligned pixels.
  Normal frames have no framebuffer readback. Unavailable WebGL uses Canvas2D;
  context restoration recreates resources and redraws the retained state.
  SurfaceFlinger/HWC composition remains Android's decision, not a game-specified
  nearest-neighbor hardware-composer scaling path.

## Causal experiments and verification

The initial WebGL adapter matched pixels but was slower on the desktop: median
submission time 9.0 ms versus Canvas2D 2.5 ms. A typed vertex batch reduced it to
5.4 ms; caching parsed colors reduced it to 2.6 ms, versus Canvas2D 2.3 ms in that
run. These are development comparisons, not a desktop speedup claim.

Fresh physical sessions alternate Canvas/GPU/GPU/Canvas, 120 measured frames each
following 30 warmup frames, identical eight-column scenes and deterministic motion.
No screenshots/readbacks occur inside timed frames. The existing ready game remains
mounted equally for both candidates, so these are comparative submission timings
under that load, not isolated GPU execution time or guaranteed frame rates.

| Device / orientation | Canvas median draw ms, two runs | GPU median draw ms, two runs | GPU p95 frame interval ms |
| --- | --- | --- | --- |
| SM-X200 landscape, Mali-G52 | 9.2 / 8.8 | 7.9 / 7.0 | 16.8 / 16.8 |
| SM-G781B portrait, Adreno 650 | 5.9 / 5.7 | 4.1 / 3.9 | 8.6 / 8.6 |

The earlier tablet portrait run was 13.4 ms Canvas versus 9.6 ms GPU; it was a
single-order development run, separately retained. The decision to adopt WebGL
uses correctness parity plus the fresh two-order physical comparisons.

Verified:

- Native asset gate: all 63 bird poses use one source sampling, masks only remove
  the inspected regions, bird draws never resize; all six cloud references exact.
- Behavioral/unit checks: 85 tests, including the shared-readability export check.
- Independent leaf/stem check: 80 cases, zero changed stem pixels.
- GPU/Canvas exact RGB/alpha parity: 16 species x four states across landscape,
  portrait and fractional-density viewports; context loss/restoration, resizing,
  and unavailable-GPU fallback also pass. No changed-pixel tolerance is used.
- Output-grid gate: density/aspect matrix, 3–8 columns, subpixel versus one-native-
  pixel movement and an intentionally corrupted off-grid negative control pass.
  The old full-scene reference is preserved as history. Its expected differences
  are recorded; exact accepted cloud and independent stem gates own preservation.
- Source and packaged garden integration pass for columns, random species, input
  routing, pause, ammo, exit and AAC draft preservation.
- Required device-test.bat --garden passes on the physical tablet in portrait and
  landscape, and phone portrait. Installed APK hashes, fullscreen, six columns,
  hardware activation/drop, AAC return and zero physical grid violations verified.
  Final APK was rerun on tablet landscape and phone portrait. Tablet rotation
  preferences were restored; both displays were verified OFF after testing.
- Full-round browser video reached won with actual miss, hit, collision, landing
  and won events. Inspected collision and approach frames; flight poses remain
  active during approach. Video is silent H.264, approximately 10 fps, normal
  game timing; it is animation evidence, not the performance benchmark.

No camera/detector/calibration/activation implementation changed. Optical gates are
outside this change; earlier unrelated optical failures are not claimed fixed.

## Reproduction and evidence

From the repository root, build native birds with Python/OpenCV using
`apps/bird-minigame/scripts/build-native-assets.py`; build native flowers using
`apps/bird-minigame/scripts/build-native-flowers.mjs` with SHINE_PLAYWRIGHT_ROOT set.
The former verifies source hashes, seed component sizes/bounds, and frozen cloud
master hashes. The latter reads shared flower-head tuning. Original sources remain
untouched; native export tuning is protected by an executable regression check.

Local evidence directories:

- `.tmp/native-art-assets/`, `.tmp/native-renderer/`, `.tmp/virtual-screen-integration/`
- `apps/bird-minigame/tmp/native-leaf-check-20260910/`
- `.tmp/tablet-adaptation/garden-R9JT201YLJF-1788973062968/` (portrait, earlier build)
- `.tmp/tablet-adaptation/garden-R9JT201YLJF-1788973381193/` (landscape, final APK)
- `.tmp/tablet-adaptation/garden-RFCR91GWXLX-1788973518143/` (phone, final APK)
- `.tmp/native-art-motion/`, `.tmp/native-art-delivery/`

Final tested arm64 preview APK SHA-256:
`04308f55244893a069d253c64bb369973a93810a4dad38b350aa8b0b42af0f0a`.
Only offline recipe validation and documentation were refined after that build;
production renderer and exported artwork are the tested versions.

Published review, video and ZIP were downloaded through the user-authorized HTTPS
tunnel and compared byte for byte. The review page contains all poses and game
screenshots; the ZIP includes credits and the tested APK. The temporary tunnel is
not a permanent release host. No release tag or full-app release is claimed.
