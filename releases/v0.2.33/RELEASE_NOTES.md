# SHINE AAC v0.2.33

Android version code: 36

## Build

- Debug APK: `shine-aac-v0.2.33-code36-debug.apk`
- Debug ZIP: `shine-aac-v0.2.33-code36-debug.zip`
- SHA-256: `7aa39674e0c9fdc55b1c5e0d9836e8f40d6d89304babd87f5b6fd7d2001370c0`
- ZIP SHA-256: `e60b3537004f627146c69295c69f4634126d72b710c422944d96486d06358bb7`

## Verification

- `.\build-test.bat`

## Notes

- Smooths camera switch audio cues with lower volume, 44.1 kHz PCM, fade in/out, and silence padding.
- Prevents overlapping cue playback so rapid blink feedback cannot stack multiple AudioTracks.
- Debug APK for user testing, not Play Store distribution.
