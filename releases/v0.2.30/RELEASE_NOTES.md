# SHINE AAC v0.2.30

Android version code: 33

## Build

- Debug APK: `shine-aac-v0.2.30-code33-debug.apk`
- Debug ZIP: `shine-aac-v0.2.30-code33-debug.zip`
- SHA-256: `19337567da488f3325963776e208ea3b423314310ecc7432f26c4826d9075ff5`
- ZIP SHA-256: `09a4ebea3f78ae8520971bb520795246547e8ffe7a1cabaa5d50d9cfbdc7b2a9`

## Verification

- `.\build-test.bat`

## Notes

- Fixes ML Kit timeout recovery so a stale frame is closed and future frames can continue.
- Ignores late ML Kit completions after timeout cleanup.
- Requires stable open eyes before a long-blink hold can start, reducing startup false positives.
- Requires both eye probabilities and a reasonably front-facing face before accepting closed-eye scores.
- Debug APK for user testing, not Play Store distribution.
