# SHINE AAC v0.2.21

Android version code: 24

## Build

- Debug APK: `shine-aac-v0.2.21-code24-debug.apk`
- SHA-256: `ec986cbc63d7c2e4568595744fb9d45b76dcb9454319b07264272cff553f604d`

## Verification

- `.\build-test.bat`

## Notes

- Adds a separate runtime timing profile for camera long blink input.
- Existing AAC timing settings are not overwritten. Hardware/button timing remains unchanged.
- When camera input is active, scanning uses slower camera-safe timing: 2600ms scan interval, 800ms row pause, 3200ms first-symbol hold, and 900ms latency compensation.
- Camera activation uses camera-specific latency compensation; non-camera activation keeps the saved AAC timing.
- Debug APK for user testing, not Play Store distribution.
