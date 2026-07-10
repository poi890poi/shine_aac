# SHINE AAC v0.2.2

Android version code: 5

## Build

- Debug APK: `shine-aac-v0.2.2-code5-debug.apk`
- SHA-256: `dad76c2f1f120457610669aff7f40c72466c130f0ebfcae307706959496421a2`

## Verification

- `npm test`
- `.\e2e-web.bat` with isolated ports
- `.\build-test.bat -SdkDir E:\Android\Sdk`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Debug APK for user testing, not Play Store distribution.
- Includes zh-TW phonetic access improvements, dead-end continuation filtering, and source-backed benchmark reports.
- Includes frequency-ordered English spelling tiles in the zh-TW board, plus `空格`, so users can enter English without switching profiles.
- Includes an updated zh-TW demo that shows mixed Chinese and English input early with `聽 podcast 新資料夾`.
- Includes scan timing presets and benchmarked real-world quality metrics for symbols, glyphs, phrases, utterances, time, actions, and activations.
- Fixes long message display so the latest symbols remain visible through horizontal scrolling.
- Known beta gap: zh-TW functional phrase and multi-concept utterance coverage are not complete.
- Public download is the versioned APK in this folder, not `app-debug.apk`.
