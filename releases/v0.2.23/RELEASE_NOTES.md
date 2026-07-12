# SHINE AAC v0.2.23

Android version code: 26

## Build

- Debug APK: `shine-aac-v0.2.23-code26-debug.apk`
- SHA-256: `2a7b3584923414bc6fa42a9062f8a71eb4499cd06e674c6739017302ba7d5412`

## Verification

- `.\build-test.bat`

## Notes

- Bundles ML Kit Face Detection in the APK for easier phone testing.
- Camera long-blink detection should work immediately after install without waiting for a Google Play Services model download.
- APK size is significantly larger than v0.2.22 because the face detector model is bundled.
- ZIP fallback is included for Android browsers that stall on direct APK downloads.
- Debug APK for user testing, not Play Store distribution.
