# SHINE AAC v0.2.2

Android version code: 5

## Build

- Debug APK: `shine-aac-v0.2.2-code5-debug.apk`
- SHA-256: `08257e3c95b2598e2338e1699426a34fef36808f6d223c0eb1861451f31328db`

## Verification

- `.\build-test.bat`
- `npm --prefix packages/aac-core test`
- `.\e2e-web.bat` with isolated beta verification ports
- `.\e2e-switch-test.bat -NoBuild`
- `.\package-release.bat`

## Notes

- Debug APK for user testing, not Play Store distribution.
- Includes zh-TW phonetic access improvements, dead-end continuation filtering, and source-backed benchmark reports.
- Includes scan timing presets and benchmarked real-world quality metrics for symbols, glyphs, phrases, utterances, time, actions, and activations.
- Fixes long message display so the latest symbols remain visible through horizontal scrolling.
- Known beta gap: zh-TW functional phrase and multi-concept utterance coverage are not complete.
- Public download is the versioned APK in this folder, not `app-debug.apk`.
