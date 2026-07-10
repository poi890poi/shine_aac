# SHINE AAC v0.2.2

Android version code: 5

## Build

- Debug APK: `shine-aac-v0.2.2-code5-debug.apk`
- SHA-256: `3e24770f18a4105ec2d42451e8fa690e74f742ccb284d8824fcf623d28cab50f`

## Verification

- `npm test`
- `.\e2e-web.bat` with isolated ports
- `.\build-test.bat -SdkDir E:\Android\Sdk`
- `.\package-release.bat -SdkDir E:\Android\Sdk`

## Notes

- Debug APK for user testing, not Play Store distribution.
- Includes zh-TW phonetic access improvements, dead-end continuation filtering, and source-backed benchmark reports.
- Keeps the zh-TW first-level board focused on Chinese input and adds `EN` as the English entry point.
- Opens frequency-ordered English spelling tiles behind `EN`; `注` returns to zh-TW/Zhuyin while `返回` keeps its normal return behavior.
- Includes an updated zh-TW demo that shows mixed Chinese and English input early with `聽 podcast 新資料夾`.
- Includes scan timing presets and benchmarked real-world quality metrics for symbols, glyphs, phrases, utterances, time, actions, and activations.
- Fixes long message display so the latest symbols remain visible through horizontal scrolling.
- Known beta gap: zh-TW functional phrase and multi-concept utterance coverage are not complete.
- Public download is the versioned APK in this folder, not `app-debug.apk`.
