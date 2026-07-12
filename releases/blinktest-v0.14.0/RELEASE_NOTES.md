# Blink Input Test v0.14.0

Standalone developer test app for camera blink input. This release does not change the AAC app.

## What changed

- Added a detector selector under Detection.
- Kept the existing Legacy ROI detector for comparison.
- Added ML Kit Eye mode using bundled Google ML Kit face detection and eye-open probabilities.
- ML Kit score is closedness: `1 - averageEyeOpenProbability`.
- Exported calibration/test summary now includes `detectorMode`.

## How to test

1. Install `blink-input-test-v0.14.0-code14-debug.apk`.
2. Open Blink Input Test and tap Start Camera.
3. Tap ML Kit Eye.
4. Watch Score while eyes are open, during short blinks, and during long blinks.
5. Compare with Legacy ROI mode.
6. Capture/tag/export samples after testing both modes.

## Notes

- The ML Kit model is bundled in the APK, so it should work without waiting for a Play Services model download.
- This is a first detector experiment. The current camera pipeline still uses the existing low-resolution analysis frame, so accuracy may improve further after raising analysis resolution or moving this test app to CameraX.
