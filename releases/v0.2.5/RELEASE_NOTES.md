# SHINE AAC v0.2.5

Android version code: 8

## Build

- Debug APK: `shine-aac-v0.2.5-code8-debug.apk`
- SHA-256: `c6f111e90b6602d914e923b904b9ecff8498771f881d476f07d3ea5f912023a5`

## Verification

- `.\package-release.bat -SdkDir E:\Android\Sdk` PASS: Gradle unit tests and debug APK build
- `.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties` PASS
- Signed Play AAB SHA-256: `5071038dcff000cb77cdfeea21435688bfe190c05f1c42d80de6ed0479799a52`

## Notes

- Debug APK for user testing, not Play Store distribution.
- Play upload candidate uses the new clean-background mascot launcher icon.
- Store screenshots were cleaned from real-device captures by removing Android system bars.
