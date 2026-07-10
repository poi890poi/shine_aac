# SHINE AAC v0.2.3

Android version code: 6

Early-development debug APK for Taiwan zh-TW UX testing. This is not a Play Store production artifact.

## Build

- Debug APK: `shine-aac-v0.2.3-code6-debug.apk`
- SHA-256: `1b1f8945bb15479c41a8ffe6105935ea1fcf694821d3fdec88aa98b2626ed2f4`

## Changes

- Adds deterministic multilingual `zh-TW` benchmarks for occasional English inside Taiwan Mandarin use.
- Documents the testing plan so core, virtual benchmark, browser, APK, and UX checks stay separate.
- Packages the current prerelease APK as version `0.2.3` / code `6`.

## Verification

- PASS: `npm test` (`199 / 199`)
- PASS: `node scripts/report-communication-benchmarks.mjs` (`103 / 103` benchmark tasks)
- PASS: `npm run test:web:e2e`
- PASS: `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Debug APK for user testing, not Play Store distribution.
- Known benchmark gaps remain: multi-concept utterance coverage, average switch activations, and average estimated scan time.
