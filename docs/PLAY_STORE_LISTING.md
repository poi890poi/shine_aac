# SayToMe AAC / 我想說 Play Store Listing Draft

This draft is for Google Play internal and closed testing. It should set expectations clearly: this is an early development AAC tool for supervised trials, not a finished clinical product.

## Product Names

- Default listing name: SayToMe AAC
- Taiwan zh-TW listing name: 我想說
- Project/repository name: SHINE AAC
- Android package id: org.shineaac.app

## English Listing

### Short Description

Early AAC tool for one-switch communication and supervised testing

### Full Description

SayToMe AAC is an early development augmentative and alternative communication app for people who have difficulty using speech and may need a simple access method.

The app focuses on one-switch scanning: a helper or user can select words, symbols, and actions using a single reliable signal such as a button press, screen tap, or supported hardware key. The current version includes English and Taiwan Mandarin zh-TW profiles, speech output, configurable scan timing, undo and repair actions, and a Taiwan Mandarin Zhuyin-based input path.

This release is intended for small supervised trials with users, families, caregivers, therapists, and contributors. It is not a finished clinical product, not medical advice, and not a substitute for professional AAC assessment, therapy, or care planning.

Current development focus:

- Taiwan Mandarin AAC input with Zhuyin and Traditional Chinese suggestions
- one-switch scanning for users with limited motor control
- simple repair actions such as undo, delete, and clear
- configurable scan timing for different access needs
- quality checks for reachable words, phrases, and communication tasks

Please use this version carefully, observe whether the interaction is comfortable and understandable, and keep another reliable communication method available during testing.

## Taiwan zh-TW Listing

### Short Description

早期開發中的 AAC 工具支援單一開關溝通與台灣中文輸入

### Full Description

我想說是一個早期開發中的輔助溝通 AAC 應用程式，目標是協助說話困難或無法穩定使用語音的人，用較簡單的方式表達需求、感受、想法與選擇。

這個版本的核心是單一開關掃描。使用者或協助者可以透過一個可靠訊號，例如按鍵、觸碰螢幕或支援的硬體按鈕，逐步選擇詞語、符號與操作。現在的版本包含英文與台灣中文 zh-TW 設定檔、語音輸出、可調整掃描速度、復原與修正操作，以及以注音和繁體中文建構的台灣中文輸入流程。

這個版本適合小規模、有人陪同的測試，對象包含使用者、家人、照顧者、語言治療師、醫療與照護相關專家、測試者與軟體貢獻者。它還不是完成的臨床產品，不是醫療建議，也不能取代專業 AAC 評估、語言治療或照護計畫。

目前開發重點：

- 支援台灣華語的注音與繁體中文建議
- 支援動作能力受限者使用單一開關掃描
- 提供復原、刪除、清除等基本修正操作
- 可依使用者狀況調整掃描時間
- 以可輸入性、詞語可達性與溝通任務做品質檢查

測試時請保持謹慎，觀察使用者是否理解、是否疲累、是否能順利修正錯誤，並保留其他可靠的溝通方式。

## Release Notes For Internal Or Closed Testing

Early development build for supervised AAC testing.

- Renamed app identity to SayToMe AAC / 我想說.
- Uses Android package id org.shineaac.app.
- Targets Android API 35.
- Adds Taiwan Mandarin zh-TW quality checks and demo coverage.
- Includes known gaps in zh-TW phrase coverage and multi-concept utterance coverage.

This build is not a finished clinical product and should not be used as the only communication method during trials.

## Screenshot Strategy

Uploaded phone screenshots are useful as human reference, especially for seeing how the app feels on a real device. They should not be the final store assets because they can drift from the current build and include status-bar details that should be controlled.

Preferred Play Store screenshots should be generated from the current app build:

1. English one-switch board before selection.
2. Taiwan zh-TW home board.
3. Taiwan zh-TW phonetic input and candidate suggestions.
4. Taiwan zh-TW demo or composed message with the latest text visible.

Automation target:

- capture from emulator or browser test runs after a clean build
- save stable 9:16 phone screenshots under `store-assets/screenshots/phone/`
- avoid notification clutter and stale timestamps
- regenerate screenshots whenever UI or demo scripts change

Current automated sources:

- `scripts/e2e-web.mjs` captures `e2e-artifacts/web-e2e-final.png`
- `scripts/e2e-switch-test.ps1` captures `e2e-artifacts/hardware-button-final.png`

Next improvement should add a dedicated Play screenshot script instead of reusing regression-test screenshots directly.

## Google Play Asset Notes

- Short description limit: 80 characters.
- App icon: 512 x 512 PNG.
- Feature graphic: 1024 x 500 JPEG or PNG without alpha.
- Screenshots: at least two are required; four high-resolution phone screenshots are recommended.
- Screenshots should show actual app UI and current app behavior.
- Official reference: https://support.google.com/googleplay/android-developer/answer/9866151
