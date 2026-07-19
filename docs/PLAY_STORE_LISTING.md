# SayToMe AAC / 我想說 Play Store Listing Draft

This draft is for Google Play internal and closed testing. The primary audience is Taiwan Traditional Chinese users, helpers, caregivers, therapists, testers, and contributors. English text is secondary.

## Product Names

- Default listing name: `SayToMe AAC`
- Taiwan zh-TW listing name: `我想說 SayToMe AAC`
- Project/repository name: `SHINE AAC`
- Android package id: `org.shineaac.app`
- Current source candidate: `v0.2.38`, Android version code `41`
- Current Play Internal testing AAB is recorded in `docs/PLAY_INTERNAL_TESTING_REPORT.md`.

## Taiwan zh-TW Listing

### App Name

我想說 SayToMe AAC

### Short Description

早期開發中的繁體中文 AAC 輔助溝通工具 支援注音掃描輸入與語音輸出

### Full Description

我想說 SayToMe AAC 是一個早期開發中的輔助溝通 AAC 應用程式，主要面向台灣繁體中文使用情境。它的目標是協助說話困難 或無法穩定使用語音的人 用較簡單的方式表達需求 感受 想法與選擇。

這個版本的核心是單一開關掃描。使用者或協助者可以透過一個可靠訊號 例如按鍵 觸碰螢幕 或支援的硬體按鈕 逐步選擇詞語 注音符號 候選字詞與操作。現在的台灣中文設定檔支援繁體中文 注音輸入 候選建議 語音輸出 掃描速度設定 復原 刪除 清除 以及偶爾需要英文時的 EN 輸入入口。

這不是完成的臨床產品。這個版本適合小規模 有人陪同的測試 對象包含使用者 家人 照顧者 語言治療師 醫療與照護相關專家 測試者與軟體貢獻者。它不是醫療建議 也不能取代專業 AAC 評估 語言治療 醫療照護 或緊急溝通計畫。

目前開發重點

- 台灣繁體中文與注音輸入
- 單一開關掃描與大按鈕操作
- 常用需求 感受 照護與修正用語
- 候選字詞與可輸入性品質檢查
- 可調整掃描速度與語音回饋設定
- 讓照顧者 協助者與專業人員更容易一起測試

測試時請保持謹慎。請觀察使用者是否理解流程 是否疲勞 是否能修正錯誤 是否能表達真實需求。測試期間請保留其他可靠的溝通方式 尤其是疼痛 同意 拒絕 不舒服 或緊急情況。

我們歡迎台灣使用者 家人 照顧者 語言治療師 AAC 相關專家 UX 設計者 測試者與軟體開發者提供回饋。

### Release Notes For Internal Testing

0.2.38:

- 未完成的注音音節會優先顯示基本後續符號
- 示範模式可透過「更多」完成較後面的注音符號與候選字詞
- 改善慢速掃描與較少欄位設定下的示範可靠性
- 點按離開示範後可正常繼續掃描與溝通

早期測試版本 主要給台灣繁體中文使用者與協助者試用。

- 改善注音輸入錯誤的容忍與整組修正建議
- 多符號注音輸入加入重選 並保留已輸入的訊息文字
- 依候選數量調整候選字與後續注音配置
- 開始示範模式前會重設訊息與掃描狀態
- 這仍是早期開發版本 不能作為唯一或緊急溝通方式

### Screenshot Captions

1. 注音列掃描與繁體中文常用語
2. 注音輸入後的候選字詞與符號掃描
3. 可調整語言 欄數與掃描速度
4. 語音回饋 開關輸入與候選字詞設定

## English Listing

### App Name

SayToMe AAC

### Short Description

Early AAC tool for switch scanning and Taiwan Mandarin testing

### Full Description

SayToMe AAC is an early development augmentative and alternative communication app for people who have difficulty using speech and may need a simple access method.

The current focus is Taiwan Traditional Chinese AAC. The zh-TW profile supports Zhuyin input, Traditional Chinese suggestions, speech output, configurable scan timing, repair actions, and an EN entry point for occasional English words without switching away from the Taiwan Chinese profile.

This release is intended for small supervised trials with users, families, caregivers, therapists, testers, and contributors. It is not a finished clinical product, not medical advice, and not a substitute for professional AAC assessment, speech-language therapy, medical care, or emergency communication planning.

Please keep another reliable communication method available during testing, especially for urgent needs, pain, consent, refusal, distress, or emergency situations.

## Privacy And Data Safety

- Privacy policy draft: `docs/PRIVACY_POLICY.md`
- Data Safety worksheet: `docs/PLAY_DATA_SAFETY.md`
- Current declaration: the app does not collect or share user data with SHINE AAC.
- The app processes messages and settings locally on the device.
- Text history is stored locally and can be exported by the user or helper.
- Optional camera switch input uses camera permission for local switch/blink detection only.
- Android Text-to-Speech behavior may depend on the speech engine installed on the device.

## Google Play Asset Notes

- App icon: `store-assets/app-icon/saytome-aac-icon-512.png`
- Feature graphic: `store-assets/feature-graphic/saytome-aac-feature-graphic.png`
- Phone screenshots: `store-assets/screenshots/phone/*.png`
- Screenshot source captures: `store-assets/screenshots/source/*.jpg`
- Screenshot cleanup script: `scripts/clean-store-screenshots.ps1`
- Signed Play AAB: `.artifacts/releases/v0.2.38/shine-aac-v0.2.38-code41-release.aab`
