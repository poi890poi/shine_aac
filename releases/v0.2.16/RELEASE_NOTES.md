# SHINE AAC v0.2.16

Android version code: 19

## Build

- Debug APK: `shine-aac-v0.2.16-code19-debug.apk`
- SHA-256: `6210dc589ede280ce02431724ed77f280dbf5a955e0812a29df1810c41ed52fb`

## Verification

- `.\build-test.bat`

## Notes

- Adds post-calibration quality feedback: open sample count, closed sample count, measured slow blinks, rest false activations, and saved long-blink hold time.
- Adds a repeatable "Test Long Blink" flow in camera calibration. It loads saved calibration when reopened, so you can move the phone and test whether the saved calibration still works before recalibrating.
- Refreshes saved camera calibration baselines in the shared input adapter while it is running, so AAC can pick up calibration changes without requiring an app restart.
- Debug APK for user testing, not Play Store distribution.
