# SHINE AAC v0.2.22

Android version code: 25

## Build

- Debug APK: `shine-aac-v0.2.22-code25-debug.apk`
- SHA-256: `73abcc529fb89e4e48a88bf321c4354a40be0f62a0a5717d27f13771d435f405`

## Verification

- `.\build-test.bat`

## Notes

- Camera long-blink input now uses ML Kit Face Detection eye-open probability through the Google Play Services unbundled model path.
- Removed the old ROI/platform FaceDetector camera switch detector and mirror-box calibration control from the AAC input module.
- Camera setup now uses the same ML Kit detector as runtime activation.
- ZIP fallback is included for Android browsers that stall on direct APK downloads.
- Debug APK for user testing, not Play Store distribution.
