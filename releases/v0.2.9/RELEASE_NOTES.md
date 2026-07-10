# SHINE AAC v0.2.9

Android version code: 12

## Build

- Debug APK: `shine-aac-v0.2.9-code12-debug.apk`
- SHA-256: `5a79e063de950a848620ef4bd4f64b04f39f1eb9b128d9432f38d00c8e860543`

## Verification

- `npm run test:web:e2e`
- `.\build-test.bat -SdkDir E:\Android\Sdk`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

The full core test suite was not completed in this run because it exceeded the local timeout after many passing cases. The packaged Android E2E wrapper also hung before producing useful output, so it was not counted as passed for this release.

## Notes

- Progress fill animation now uses CSS transitions instead of a continuous JavaScript animation loop.
- Reduces per-frame WebView main-thread work during row and symbol scanning.
- Includes the adaptive launcher icon sizing fix from `main`.
- Debug APK for user testing, not Play Store distribution.
