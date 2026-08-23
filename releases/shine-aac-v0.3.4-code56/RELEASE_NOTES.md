# SHINE AAC v0.3.4

Android version code: 56

## Optical switch setup screen

This release is a usability repair of the camera setup screen, driven by physical-device testing of
v0.3.3.

- The gesture choice is now a two-button segmented control. The previous control was a spinner drawn
  as plain text, which gave no sign that it could be changed. The active gesture is filled and
  outlined; the inactive one is a plain button.
- The screen fits on one page again. The controls no longer scroll: gesture, camera, activation hold
  and zoom are each a single "label plus buttons" row, and the preview takes whatever height is
  left. The static colour legend was removed because the preview now reports tracking state directly.
- The tracking marks follow the face. The preview surface is written by the camera in sensor
  orientation, but only the detector was compensating for it, so the overlay worked in an upright
  frame while the preview stayed sideways. On an upright phone that made pitching the head move the
  box sideways and yawing the head move the box vertically. The preview transform and the overlay are
  now both derived from one geometry function and share the same rotation and mirroring.
- In cheek twitch mode the overlay also draws the face landmarks, not just a box, so a helper can see
  at a glance whether tracking is locked on.
- The preview no longer changes size during setup. The status and metric lines above it now have a
  fixed height, so wording changes cannot resize the preview pane, and the transform is no longer
  applied with placeholder values before the camera reports its real buffer size and rotation.
- Every calibration cue is now both heard and seen. Tones and the on-screen signal are emitted from
  one place, so each step shows a coloured border, a headline naming the step, and the seconds left.
  A tone alone was easy to miss in a noisy room or by a user who cannot hear it.

## Verification

- Android inputs unit tests: 33 passing, including preview geometry cases that pin the rotated
  preview to the same rectangle the overlay maps detections onto.
- AAC core and web regression suites.
- Emulator screenshots for layout and control reachability only. The Android emulator's virtual
  camera renders its scene aligned to the display, so it cannot be used to judge preview rotation;
  that needs the physical device.

## Please confirm on device

The rotation repair was made from the reported symptom rather than from a screenshot. Please check
that the preview is upright and that the tracking marks stay on the face when pitching and yawing.
