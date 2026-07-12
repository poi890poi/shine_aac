# SHINE AAC v0.2.27

Android version code: 30

## Build

- Debug APK: `shine-aac-v0.2.27-code30-debug.apk`
- SHA-256: `6f340bd6dbe82ee3d047cfbe1f27402a354546c5c6d9d7a3aa16872db744f876`
- ZIP fallback: `shine-aac-v0.2.27-code30-debug.zip`

## Verification

- `.\build-test.bat`

## Notes

- Removed automatic camera restarts from normal blink/detection flow.
- Camera health is now status-only: detection stalls show `Cam stale` instead of restarting the camera.
- ML Kit timeout no longer starts overlapping analyses.
- Runtime blink detection now requires stable closed/open frames before state changes.
- Raised runtime closed-eye threshold to reduce false positives.
- Debug APK for user testing, not Play Store distribution.
