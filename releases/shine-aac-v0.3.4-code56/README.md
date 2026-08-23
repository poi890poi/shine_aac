# SHINE AAC v0.3.4 (build 56) — optical switch setup repair

Install this over v0.3.3. If Android refuses, uninstall SHINE AAC first.

## What changed

All six items from the v0.3.3 device test are addressed:

1. The gesture choice is a two-button segmented control instead of plain-looking text.
2. The screen fits on one page; the controls no longer scroll at normal text sizes.
3. The tracking marks follow the face. The preview was not being rotated to match the detector, which
   is why pitching the head moved the box sideways and yawing moved it vertically.
4. The preview keeps a fixed size through every state change.
5. Every calibration cue is now shown as well as played: a coloured border, the step name, and the
   seconds remaining.
6. Cheek twitch mode also draws the face landmarks, not only a bounding box.

## Please check on the phone

The rotation repair was made from your description of the symptom, because the Android emulator
cannot reproduce it: its virtual camera renders the scene aligned to the display, so it never shows
sensor orientation. Please confirm on the device:

- The preview is upright with the phone held upright.
- Pitching your head moves the box vertically, and yawing moves it horizontally.
- With the front camera the preview is mirrored, and the box still sits on your face.
- The preview does not change size when setup moves between steps.
- Each step shows a coloured border and a countdown at the same moment you hear the tone.

If the preview is upright but the box is horizontally inverted, that is a mirroring problem, not a
rotation one; say so and it is a one-line change.
