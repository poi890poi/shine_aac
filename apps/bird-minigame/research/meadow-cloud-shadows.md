# Offscreen cloud shadows — September 10

Type: intentional scenery feature. Add faint drifting shadows to the middle meadow
from clouds overhead outside the view. Keep this field independent of the visible
sky-cloud layout; do not add visible clouds to explain the shadows.

Scope: middle meadow illumination, behind existing bushes and gameplay. Preserve
mountains, sky-cloud order/art/motion, foreground grass, bird and plant pixels,
round randomness and AAC behavior. No storage, camera or input changes.

Use broad flattened, rounded patches, with two close palette-derived shadow tones,
no outline, blur, dithering or high-resolution overlay. Positions snap to the shared
native framebuffer. Seed the field independently, keep shapes stable for a round,
and use game time so pause freezes it; reduced motion freezes it explicitly.

Risk: shadows may resemble dark puddles or distract from accessible targets. Keep
contrast low (4.5% edge and 9% center blend toward a muted cool shade), move slowly
(1.8 native pixels per second), and limit them to the middle ground. Review matched
portrait/landscape images and a time comparison before packaging. Test bounded
placement, deterministic motion, reduced motion, protected-layer pixels and GPU
parity. Physical acceptance uses device-test.bat and display-off verification.

## Verification

- 91 unit tests pass, including 100-seed footprint bounds, stable recipes after
  cache eviction, integer drift, pause/reduced-motion freeze and subtle palettes.
- 24 paired raster comparisons across three seeds and two orientations: shadows
  move over time and alter only middle-meadow base pixels. Every other pixel is
  unchanged. Largest channel difference is at most 12/255.
- GPU/Canvas parity passes for 16 species, four states and three viewports, with
  zero differences or grid violations; resize, context restoration and fallback
  pass. Virtual-screen density/aspect and 3–8-column checks pass.
- Source and packaged AAC integration pass. Preview APK SHA-256:
  `e9e221582a71c9cce38eaa7961c2fe5a3a74677887b8e05e4e41e65ccea064c2`.
- `device-test.bat --garden` passes on SM-X200 landscape and SM-G781B portrait:
  hardware activation, full screen, zero grid violations and AAC return preserved.
  Rotation restored and both displays verified OFF.
- Internal device evidence directories:
  `.tmp/tablet-adaptation/garden-R9JT201YLJF-1789003235463/` and
  `.tmp/tablet-adaptation/garden-RFCR91GWXLX-1789003344705/`.
- Review generation: `scripts/review-meadow-shadows.mjs`; independent raster
  verification: `scripts/verify-meadow-shadow-review.py`. Preview includes paired
  full-game images and scenery comparisons at 0, 18 and 36 seconds.
