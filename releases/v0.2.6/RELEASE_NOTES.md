# SHINE AAC v0.2.6

Android version code: 9

## Build

- Debug APK: `shine-aac-v0.2.6-code9-debug.apk`
- SHA-256: `afd1f3ac3fde3dc73c097f0255aec2347ee88b26b8d361c5d89795410857e91b`

## Verification

- `npm run test:core` PASS: 199 tests
- `npm run test:web:e2e` PASS
- `.\package-release.bat -SdkDir E:\Android\Sdk` PASS: Gradle unit tests and debug APK build

## Notes

- Debug APK for user testing, not Play Store distribution.
- Performance test build: scan row/symbol movement now updates existing tiles instead of rebuilding the whole board DOM on every scan tick.
- Progress bars now use transform-based updates to reduce layout work in Android WebView.
- Feature graphic experiment was reverted; this APK does not depend on that store graphic.
