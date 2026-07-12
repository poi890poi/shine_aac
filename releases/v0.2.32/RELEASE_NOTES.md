# SHINE AAC v0.2.32

Android version code: 35

## Build

- Debug APK: `shine-aac-v0.2.32-code35-debug.apk`
- Debug ZIP: `shine-aac-v0.2.32-code35-debug.zip`
- SHA-256: `9c967c1dd6974b95c4ba86500b9477f4a07e5d42ad7c30543c48a5be9c073ef8`
- ZIP SHA-256: `852210d275f31c6755e5d3913851976addd9177037889977a71aee15b0f3c6ba`

## Verification

- `.\build-test.bat`

## Notes

- Fixes the calibration face box X mapping for the mirrored front-camera preview.
- Calibration box now indicates ML Kit status: green means usable eye signal, amber means face only.
- Reduces intermittent calibration startup crashes by preventing duplicate camera open attempts.
- Requests a lower camera AE FPS range for both AAC runtime and calibration when the device supports it.
- Calibration now uses 480x360 analysis frames and 5 fps ML Kit throttling, matching runtime behavior.
- Debug APK for user testing, not Play Store distribution.
