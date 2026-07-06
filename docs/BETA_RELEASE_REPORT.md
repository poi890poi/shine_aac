# SHINE AAC Beta Release Report

Generated: 2026-07-05

## Artifact

- APK: `releases/v0.2.2/shine-aac-v0.2.2-code5-debug.apk`
- Public download: `https://detect-format-configured-cayman.trycloudflare.com/shine-aac-v0.2.2-code5-debug.apk`
- Version: `0.2.2`
- Version code: `5`
- Size: `10907443` bytes
- SHA-256: `08257e3c95b2598e2338e1699426a34fef36808f6d223c0eb1861451f31328db`

## Verification

- PASS: `npm --prefix packages/aac-core test` (`187 / 187`)
- PASS: `.\build-test.bat`
- PASS: `.\e2e-web.bat` on isolated beta verification ports
- PASS: `.\e2e-switch-test.bat -NoBuild`
- PASS: `.\package-release.bat`

## Beta Scope

- Suitable for beta/user testing as a debug APK.
- Not a Play Store release artifact.
- Primary improvements: zh-TW phonetic access, dead-end continuation filtering, scan timing presets, and real-world quality metrics.
- Hotfix: long one-line messages now scroll horizontally and keep the latest symbols visible.

## Known Beta Gaps

- zh-TW functional phrase surface is `48` phrases against the `80-120` target range.
- Multi-concept utterance coverage is `10 / 120`.
- Median benchmark time is `13.80s`, above the urgent phrase target of `<= 10s`.
- Source-licensed natural sentence audit coverage is `0`; generated filler is not counted.
