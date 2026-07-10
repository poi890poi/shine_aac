# SHINE AAC v0.2.7

Android version code: 10

## Build

- Debug APK: `shine-aac-v0.2.7-code10-debug.apk`
- SHA-256: `faee4c2a88f37b440a12821894e7ae5649599e383a77885e8616b55ce62ac1f6`

## Verification

- `npm run test:core`
- `npm run test:web:e2e`
- `.\e2e-switch-test.bat -SdkDir E:\Android\Sdk`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Keeps the existing hidden Demo design: long-press `Config` starts the demo.
- Fixes Android WebView long-press activation by tolerating touch cancellation/context-menu events during the hold.
- Adds packaged APK regression coverage for Config long-press Demo activation before hardware-button checks.
- Debug APK for user testing, not Play Store distribution.
