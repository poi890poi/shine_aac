# Cloud and mountain depth — September 10

Type: intentional scenery composition change, with regression coverage.

Previously both cloud layers were behind mountains. The requested order is sky,
far clouds, mountains, near clouds, clearing and grass, then gameplay. Near clouds
can overlap the upper 35% of the mountain image; their complete bounding boxes
stay above its lower slopes. A 32-native-pixel stagger preserves varied cloud
bottoms when landscape height requires lifting them. Portrait placements that
already clear this ceiling stay unchanged. These controls live in cloud-layout.js.

Scope: shared scenery renderer, including its historical rural fallback. Preserve
all source artwork and masks, six/five cloud counts, approved sizes, three shades,
1.35/4.2 drift, reduced motion, round seeds, eight mountain identities, flowers,
stems, birds and gameplay. No storage, API, input or camera changes.

Risk: large clouds on short screens can hide peaks or crop above the viewport.
Review both orientations across eight mountain profiles and multiple seeds. Verify
actual raster occlusion, lower-slope clearance, native pixel alignment and GPU
parity. This is composition evidence, not approval of new artwork.

## Verification

- 87 unit tests pass, including altitude bounds across 100 seeds, eight mountain
  heights, three framing scales and four viewport shapes.
- Review harness: 52 images, all eight profiles and both orientations. Synthetic
  raster probes verify far-cloud occlusion, near-cloud overlap and clear lower
  slopes. The previous renderer fails the near-cloud overlap probe.
- GPU/Canvas parity: all 16 species, four states and three viewports; zero pixel
  differences or grid violations. Resize, context restoration and fallback pass.
- Virtual-screen density/aspect and 3–8 column matrix, including off-grid negative
  control, passes. Source and packaged AAC integration pass.
- Preview APK SHA-256:
  `76fb66c8ee3f6e6d8601c6ab9e63957c94a61540a8c51f50e746f70b104d07b6`.
- `device-test.bat --garden` passes on SM-X200 landscape and SM-G781B portrait:
  hardware activation, fullscreen, zero grid violations and preserved AAC return.
  Both displays verified OFF; temporary rotation restored.
- Device evidence (internal workspace paths):
  `.tmp/tablet-adaptation/garden-R9JT201YLJF-1789002440971/` and
  `.tmp/tablet-adaptation/garden-RFCR91GWXLX-1789002533373/`.
- Images reviewed at native resolution and as an eight-mountain comparison.
  Landscape has upper-ridge cloud overlap; the tested portrait placements remain
  unchanged. No artwork source bytes were modified.
