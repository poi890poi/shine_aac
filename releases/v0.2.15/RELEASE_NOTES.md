# SHINE AAC v0.2.15

Android version code: 18

## Build

- Debug APK: `shine-aac-v0.2.15-code18-debug.apk`
- SHA-256: `36c9569bde3155ef52515f4677064ec25697af0a5a927a3ec36230474a64681d`

## Verification

- `.\build-test.bat`

## Notes

- Camera calibration now waits for each spoken instruction to finish before beeping and capturing.
- Cues include capture durations and avoid the ambiguous phrase `長眨眼`.
- Calibration prefers an exact `zh-TW` TTS voice when installed and reports the active voice on screen.
- Debug APK for user testing, not Play Store distribution.
