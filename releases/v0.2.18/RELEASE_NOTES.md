# SHINE AAC v0.2.18

Android version code: 21

## Build

- Debug APK: `shine-aac-v0.2.18-code21-debug.apk`
- SHA-256: `681c4bea6085d999452718f9f578919cf1f47049610c7cbaaa9181baa763d1a3`

## Verification

- `.\build-test.bat`

## Notes

- Preview feedback now distinguishes short and long blinks after the eyes reopen.
- Short blink uses a short acknowledgement cue and increments the short count.
- Long blink uses the long cue, increments the long count, and still validates that the current phone position works.
- Blinks just below the long-blink threshold are ignored as an ambiguous zone, so near-misses do not sound like successful long blinks.
- Debug APK for user testing, not Play Store distribution.
