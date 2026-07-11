# SHINE AAC v0.2.17

Android version code: 20

## Build

- Debug APK: `shine-aac-v0.2.17-code20-debug.apk`
- SHA-256: `15f7ee0a657481480783c22dd22fe0aed322f454485b18bac4a06059c7e71a1e`

## Verification

- `.\build-test.bat`

## Notes

- Camera calibration now saves the previous calibration quality summary and shows it when reopening calibration.
- The live preview now passively listens for long blink when saved calibration exists. A short beep plays when the current phone position successfully detects a long blink.
- The calibration screen distinguishes previous calibration quality from current-position validation, because phone position, distance, angle, and lighting commonly change.
- Debug APK for user testing, not Play Store distribution.
