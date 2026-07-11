# SHINE AAC v0.2.11

Android version code: 14

## Build

- Debug APK: `shine-aac-v0.2.11-code14-debug.apk`
- SHA-256: `4e22db44770070b2a93c4babb1b4ae6a82714c6d23944ccd62399cf8a4ff794a`

## Verification

- `npm run test:web:e2e`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Introduces an overlapped scan pipeline for more consistent visual-control timing.
- Precomputes the next scan state during the current interval instead of at transition time.
- Starts the scan timer only after the active highlight/progress reset has crossed a paint boundary.
- Updates only previous and next active tiles during scan-only transitions instead of walking the full board.
- Strengthens web E2E timing checks for row, first-column, and later-column progress restart behavior.
- Debug APK for user testing, not Play Store distribution.
