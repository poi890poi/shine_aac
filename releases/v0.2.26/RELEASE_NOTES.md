# SHINE AAC v0.2.26

Android version code: 29

## Build

- Debug APK: `shine-aac-v0.2.26-code29-debug.apk`
- SHA-256: `197498defe52fcf1778d283e77f37ca4a6b066d49d8025ed7b5ea732f413a0e9`
- ZIP fallback: `shine-aac-v0.2.26-code29-debug.zip`

## Verification

- `npm run test:web:e2e`
- `.\build-test.bat`

## Notes

- AAC long blink now activates immediately when the calibrated hold threshold is reached; eye-open only re-arms the detector.
- Added a camera heartbeat indicator in AAC: `Cam live`, `Blink`, `Cam restart`, or `Cam stale`.
- Added runtime watchdog recovery for stalled camera frames or stalled ML Kit analysis.
- Reduced camera long-blink input latency compensation now that scanning freezes on eye-close.
- Kept short-blink audio setup-only; AAC runtime still uses long blink only.
- Debug APK for user testing, not Play Store distribution.
