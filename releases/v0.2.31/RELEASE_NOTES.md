# SHINE AAC v0.2.31

Android version code: 34

## Build

- Debug APK: `shine-aac-v0.2.31-code34-debug.apk`
- Debug ZIP: `shine-aac-v0.2.31-code34-debug.zip`
- SHA-256: `55cceba3760619270bf89b4093bb0d247b53e76bc3fda8267c725c23685a9d0a`
- ZIP SHA-256: `9821d1fcf4cd43c57dcce64a105ecc2b9844f550e5e8b279189a863d76772fb9`

## Verification

- `.\build-test.bat`

## Notes

- Uses 480x360 analysis frames, matching ML Kit's minimum practical face-detection guidance better than 320x240.
- Throttles ML Kit detector calls to about 5 fps to reduce CPU pressure while keeping enough samples for long blink detection.
- Runs ML Kit callbacks on the analysis executor instead of the UI/WebView thread.
- Keeps CameraX `STRATEGY_KEEP_ONLY_LATEST` so frames are dropped, not queued, while ML Kit is busy.
- Debug APK for user testing, not Play Store distribution.
