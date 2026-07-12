# SHINE AAC v0.2.28

Android version code: 31

## Build

- Debug APK: `shine-aac-v0.2.28-code31-debug.apk`
- SHA-256: `dcdeade79d8586f86abece569cea34d82fd5a1cf634bfec3c2897e4c13496d03`
- ZIP fallback: `shine-aac-v0.2.28-code31-debug.zip`

## Verification

- `.\gradlew.bat :android-inputs:testDebugUnitTest`
- `.\build-test.bat`

## Notes

- Added a shared time-based blink gesture classifier for AAC runtime.
- A single mistakenly open frame no longer breaks a long blink.
- Brief no-face/signal-loss gaps no longer break a long blink.
- Long blink still activates at the calibrated hold threshold without waiting for eye-open.
- Re-arm requires stable open evidence after activation.
- Added unit tests for false closed spikes, short blinks, one-frame open glitches, brief signal loss, long signal loss, and repeat activation prevention.
- Debug APK for user testing, not Play Store distribution.
