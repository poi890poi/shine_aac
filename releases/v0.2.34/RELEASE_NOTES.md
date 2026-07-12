# SHINE AAC v0.2.34

Android version code: 37

## Build

- Debug APK: `shine-aac-v0.2.34-code37-debug.apk`
- Debug ZIP: `shine-aac-v0.2.34-code37-debug.zip`
- SHA-256: `149f155e5cc4d870e6330b3bf3eabd3ad71a97f12a256f2c3c573936113306a8`
- ZIP SHA-256: `cc00a3339f5492c810977ee74c092de84187e2fee4775177607de14de3d99de4`

## Verification

- `.\build-test.bat`

## Notes

- Adds saved camera zoom for the camera switch input profile.
- Defaults camera switch zoom to 1.6x to make the face larger at comfortable phone viewing distance.
- Applies saved zoom in AAC runtime through CameraX `setZoomRatio()`.
- Adds setup controls for helper-adjusted camera zoom.
- Applies setup zoom through Camera2 `SCALER_CROP_REGION` and saves it with calibration.
- Debug APK for user testing, not Play Store distribution.
