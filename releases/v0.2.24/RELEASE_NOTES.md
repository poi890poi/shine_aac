# SHINE AAC v0.2.24

Android version code: 27

## Build

- Debug APK: `shine-aac-v0.2.24-code27-debug.apk`
- SHA-256: `58fe39437f9f2613cf1a27763f69806e72ca845d6b865356c6dc20c2b488bdc9`

## Verification

- `.\build-test.bat`

## Notes

- Polished Camera switch setup page with clearer primary actions and cleaner button styling.
- Added visible long-blink hold time with `-100 ms` and `+100 ms` adjustment controls.
- Added a runtime hold-reached audio cue: keep eyes closed until the long beep, then open to activate.
- Split setup tones: start tone, short-blink chirp, hold-reached beep, long-blink accepted double chirp.
- Fixed Traditional Chinese calibration cue text encoding.
- ZIP fallback is included for Android browsers that stall on direct APK downloads.
- Debug APK for user testing, not Play Store distribution.
