# SHINE AAC v0.2.4

Android version code: 7

## Build

- Debug APK: `shine-aac-v0.2.4-code7-debug.apk`
- SHA-256: `ea1dbbbea70e373e6f48c82697f4474ce94504bb83f67bd863338683be5eaf28`

## Verification

- `npm run test:core` PASS: 199 tests
- `npm run test:web:e2e` PASS
- `.\package-release.bat -SdkDir E:\Android\Sdk` PASS: Gradle unit tests and debug APK build
- `.\e2e-switch-test.bat -SdkDir E:\Android\Sdk -NoBuild -ColdBoot` BLOCKED: local emulator/system WebView repeatedly ANR before app render; verify on a real device

## Notes

- Debug APK for user testing, not Play Store distribution.
- Includes zh-TW `注音` language switch refinement and v0.2.4 prerelease metadata.
