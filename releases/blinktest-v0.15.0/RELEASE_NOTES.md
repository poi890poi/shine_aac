# Blink Input Test v0.15.0

Standalone developer test app for camera blink input. This release does not change the AAC app.

## What changed

- Optimized ML Kit Eye mode to pass camera `media.Image` frames directly through `InputImage.fromMediaImage`.
- Removed the per-frame ML Kit bitmap conversion path.
- Kept crop bitmap generation only when a review frame is requested by manual capture, burst capture, or auto calibration.
- Added an on-screen ML Kit performance row with completed frames, p50/p95 latency, dropped frames, no-face/no-eye counts, and errors.
- Added ML Kit performance counters to `summary.json` export.
- Added a zipped APK fallback for Android browsers that stall or hide APK download completion.

## How to test

1. Download `blink-input-test-v0.15.0-code15-debug.zip` if direct APK download stalls.
2. Extract the APK from the zip on the phone.
3. Install `blink-input-test-v0.15.0-code15-debug.apk`.
4. Open Blink Input Test and tap Start Camera.
5. Tap ML Kit Eye.
6. Watch the Perf row after 10-20 seconds.
7. Test normal blinks and long blinks while watching Score and Perf.
8. Use Capture Crop or Blink Burst 5s to collect examples, then export results.

## Notes

- ML Kit is still throttled to roughly one detector call every 90 ms.
- The analysis frame is still 320x240. That keeps performance low-cost but is below ML Kit's recommended 480x360 real-time baseline.
- This release is intended to measure whether the direct camera image path is fast enough on phone hardware before AAC integration.
