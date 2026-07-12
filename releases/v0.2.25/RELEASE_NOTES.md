# SHINE AAC v0.2.25

Android version code: 28

## Build

- Debug APK: `shine-aac-v0.2.25-code28-debug.apk`
- SHA-256: `cb94a81abe9e773a77e20a21cbf4d55a5bfbb5bb1e00ec56e658bc8ead14a54c`
- ZIP fallback: `shine-aac-v0.2.25-code28-debug.zip`

## Verification

- `npm run test:web:e2e`
- `.\build-test.bat`

## Notes

- Complete bundled ML Kit package for direct phone testing before Play publishing.
- Replaced device-specific Android tone constants with explicit generated tones.
- AAC runtime only plays the hold-reached cue for long blink; short blink audio remains setup-only.
- Setup tones are distinct: start = mid tone, short blink = high chirp, hold reached = low tone, long accepted = rising two-tone.
- AAC scanning now pauses the active target and progress timer while eyes are closed, then resumes on eye-open or hard timeout.
- Debug APK for user testing, not Play Store distribution.
