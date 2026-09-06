# Approved artwork and side landing — 2026-09-05

Type: artwork integration and intentional motion change requested by the user.
The user approved the latest generated bird and flower designs: “Yes these are
good.” They asked to update the app, approach landing smoothly from left or right,
and provide media.

## Implemented

- The live renderer uses the approved magpie flight sheet and four flower faces.
  The original generated files are unchanged. Exterior neutral-background matting
  removes the baked checkerboard at load time while preserving enclosed whites.
- `rules/sprite-layout.json` owns source crops, pose anchors, fixed uniform scale,
  flower expressions and continuous stem parameters. Pixel dimensions increased
  from the failed tiny procedural presentation, then fitted to the phone viewport.
- Final flight exits horizontally, turns completely off screen, and approaches
  on a cubic curve from either side. The curve eases to zero speed and levels out
  at grass height. `landingSide` and `landingSeconds` are configurable; the default
  selects a side from the bird's position when the last flower clears.
- Flower count remains the active AAC column count (3–8). Flight/drop/hit/recovery,
  single-switch control, retained progress and no-extra-input completion remain.

## Verification

- All 29 mini-game tests passed. New tests cover left/right landing at 30/60/120 Hz,
  no visible jump, off-screen turns, substantial horizontal approach, level final
  flight, single completion, pause/resume, and preservation of enclosed whites.
- The packaged build completed. Physical Samsung SM-G781B Chrome checks passed:
  assets, portrait fit, host activation, pause, exit, Space and browser touch.
- Actual button taps on the phone completed a round with 12 hits, all four flowers
  cleared, and landing at approximately 33.4 seconds. No flower height, position,
  score or physics state was overwritten to produce that recording.
- Direct H.264 video: 540×1200, 45.03 seconds. A nine-second H.264 excerpt shows the
  final right-side approach and landing. Screenshots show impact, approach and rest.
  This is a physical phone browser demonstration, not Android release acceptance.

Raw evidence: `tmp/approved-art-landing-20260905/phone-check.json`,
`physical-play.json`, recordings and screenshots. The media directory is exposed
through a temporary HTTPS delivery endpoint; it contains only the requested media.

## Limits

The source PNGs remain opaque RGB; real transparency is created in the app's
display preparation. Visual approval covers the generated designs. It does not
establish a complete approved component rig or exact 8-bit hardware palette. The
old procedural renderer remains available to its historical art-lab/tests but is
not used to draw live bird or flower shapes. Those legacy tests are not evidence
of accepted sprite geometry. No Android integration or release was performed.
