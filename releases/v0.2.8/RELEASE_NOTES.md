# SHINE AAC v0.2.8

Android version code: 11

## Build

- Debug APK: `shine-aac-v0.2.8-code11-debug.apk`
- SHA-256: `069d771b2157000bfa220a34c07a05c827b9c11e6b95b67630c0f481d0e17f40`

## Verification

- `.\gradlew.bat testDebugUnitTest`
- `.\e2e-switch-test.bat -SdkDir E:\Android\Sdk`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Moves Android TTS feedback off the UI thread so activation voice does not compete with WebView scanning/rendering.
- Keeps scanner timing and app layout unchanged.
- Android E2E now exercises activation voice during hardware-button input.
- Debug APK for user testing, not Play Store distribution.
