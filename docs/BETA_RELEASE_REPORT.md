# SHINE AAC Beta Release Report

Generated: 2026-07-10

## Artifact

- APK: `releases/v0.2.3/shine-aac-v0.2.3-code6-debug.apk`
- Public download after push/tag: `https://github.com/poi890poi/shine_aac/raw/v0.2.3/releases/v0.2.3/shine-aac-v0.2.3-code6-debug.apk`
- Version: `0.2.3`
- Version code: `6`
- Size: `9847078` bytes
- SHA-256: `1b1f8945bb15479c41a8ffe6105935ea1fcf694821d3fdec88aa98b2626ed2f4`

## Verification

- PASS: `npm test` (`199 / 199`)
- PASS: `node scripts/report-communication-benchmarks.mjs` (`103 / 103` benchmark tasks)
- PASS: `npm run test:web:e2e`
- PASS: `.\package-release.bat -SdkDir E:\Android\Sdk`

## Beta Scope

- Suitable for small-scale owner/helper UX testing as an early-development debug APK.
- Not a Play Store production artifact.
- Primary improvements: documented testing plan, deterministic multilingual `zh-TW` benchmark coverage, packaged `v0.2.3` APK.
- `zh-TW` occasional English remains an AAC profile behavior: the first-level Chinese surface stays Chinese, while `EN` opens English symbols when needed.

## Known Beta Gaps

- Runtime device/emulator smoke was not rerun for this exact package in this documentation pass.
- `zh-TW` functional phrase surface is `48` phrases against the `80-120` target range.
- Multi-concept utterance coverage is `16 / 120`.
- Average switch activations are `8.16`, above the target of `<= 6`.
- Median benchmark time is `13.80s`, above the urgent phrase target of `<= 10s`.
- Average benchmark time is `27.02s`, above the target of `<= 15s`.
- Source-licensed natural sentence audit coverage is `0`; generated filler is not counted.

## UX Verification Request

When testing this APK, record:

- device model and Android version
- selected profile
- whether the early-development warning is understandable
- whether a short need, a longer thought/feeling, and occasional English can be entered
- whether `復原`, `刪`, and `清除` are understandable
- timing comfort and fatigue notes
- TTS voice/volume notes
- any clipping, confusing suggestion, or unreachable expected expression
