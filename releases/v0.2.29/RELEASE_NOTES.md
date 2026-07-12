# SHINE AAC v0.2.29

Android version code: 32

## Build

- Debug APK: `shine-aac-v0.2.29-code32-debug.apk`
- Debug ZIP: `shine-aac-v0.2.29-code32-debug.zip`
- SHA-256: `9486eeec65724ccbf0b89e3ad088a7973c7837cfb165ddf4a460be56cf34063a`
- ZIP SHA-256: `aa4dbdff2dcc6f49c54038cd05829426c383b18058c96fb6917d54040c25793d`

## Verification

- `.\build-test.bat`

## Notes

- Replaces AAC runtime camera switch capture with CameraX `ImageAnalysis` only.
- Runtime no longer creates a hidden Camera2 preview surface.
- Camera analysis is bound to the AAC activity lifecycle, so it stops when AAC leaves the foreground.
- Uses CameraX `STRATEGY_KEEP_ONLY_LATEST` backpressure so slow ML Kit frames are dropped instead of queued.
- Setup/calibration preview remains separate for phone positioning.
- Debug APK for user testing, not Play Store distribution.
