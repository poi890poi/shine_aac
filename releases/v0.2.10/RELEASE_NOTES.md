# SHINE AAC v0.2.10

Android version code: 13

## Build

- Debug APK: `shine-aac-v0.2.10-code13-debug.apk`
- SHA-256: `52f0fe2a68f93478ccbcbf033f60ec374dce3c97f5eb3086f70a909b91f90735`

## Verification

- `npm run test:web:e2e`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Fixes progress indicator timing when row scanning transitions into the first column.
- Prevents the first column from inheriting the row highlight progress fill.
- Adds a web E2E regression for first-column and later-column progress restart behavior.
- Debug APK for user testing, not Play Store distribution.
