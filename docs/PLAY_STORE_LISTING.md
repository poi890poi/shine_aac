# SayToMe AAC / 我想說 Play Store Listing Draft

This draft is for Google Play internal and closed testing. The primary audience is Taiwan Traditional Chinese users, helpers, caregivers, therapists, testers, and contributors. English text is secondary.

## Product Names

- Default listing name: `SayToMe AAC`
- Taiwan zh-TW listing name: `我想說`
- Project/repository name: `SHINE AAC`
- Android package id: `org.shineaac.app`
- Current source release: `0.4.0`, Android version code `60`, target SDK `36`
- Current Play Internal testing AAB is recorded in `docs/PLAY_INTERNAL_TESTING_REPORT.md`.

## Taiwan zh-TW Listing

### App Name

我想說

### Short Description

早期開發中的繁體中文 AAC 輔助溝通工具 支援注音掃描輸入與語音輸出

### Full Description

我想說是一個早期開發中的輔助溝通 AAC 應用程式，主要面向台灣繁體中文使用情境。它的目標是協助說話困難 或無法穩定使用語音的人 用較簡單的方式表達需求 感受 想法與選擇。

這個版本的核心是單一開關掃描。使用者或協助者可以透過一個可靠訊號 例如按鍵 觸碰螢幕 或支援的硬體按鈕 逐步選擇詞語 注音符號 候選字詞與操作。現在的台灣中文設定檔支援繁體中文 注音輸入 候選建議 語音輸出 掃描速度設定 復原 清除 以及偶爾需要英文時的英文輸入入口。

這不是完成的臨床產品。這個版本適合小規模 有人陪同的測試 對象包含使用者 家人 照顧者 語言治療師 醫療與照護相關專家 測試者與軟體貢獻者。它不是醫療建議 也不能取代專業 AAC 評估 語言治療 醫療照護 或緊急溝通計畫。

目前開發重點

- 台灣繁體中文與注音輸入
- 單一開關掃描與大按鈕操作
- 常用需求 感受 照護與修正用語
- 候選字詞與可輸入性品質檢查
- 可調整掃描速度與語音回饋設定
- 可選擇列格或區塊列格掃描 並使用預設速度或進階時間微調
- 可選用長眨眼或臉頰抽動作為相機開關 影像只在裝置上處理
- 可在支援 USB Host OTG 的裝置選用相容 USB UVC 外接相機
- 原生協助者設定與獨立進階時間設定頁
- 朗讀後可顯示重播控制或放大對話內容 也可維持原本的繼續輸入方式
- 一般 高對比亮色與高對比暗色顯示預設
- 讓照顧者 協助者與專業人員更容易一起測試

測試時請保持謹慎。請觀察使用者是否理解流程 是否疲勞 是否能修正錯誤 是否能表達真實需求。測試期間請保留其他可靠的溝通方式 尤其是疼痛 同意 拒絕 不舒服 或緊急情況。

我們歡迎台灣使用者 家人 照顧者 語言治療師 AAC 相關專家 UX 設計者 測試者與軟體開發者提供回饋。

### Release Notes For Internal Testing

0.4.0:

- 新增 USB UVC 外接相機 支援長眨眼與臉頰抽動掃描 影像只在裝置處理
- 新增原生協助者設定與獨立進階時間設定頁
- 改善相機選擇 權限 重新連接 預覽 校正與偵測可靠度
- 新增 USB 相機 相機動作 進階設定與語音下載專頁
- 仍是早期開發版本 不能作為唯一或緊急溝通方式

0.2.44:

- 修正系統字體或顯示大小放大時，功能鍵提示、名稱與圖示重疊的問題
- 英文輸入區新增英文候選字詞，中英文相接不必另外選空格
- 內建介面以「復原」處理單字、字母、注音與整個候選字詞的上一步操作，不再顯示容易混淆的「刪除」鍵
- 設定、輸入測試及相機設定改用繁體中文
- 相機設定的主要操作固定顯示，次要調整可捲動
- WebView 文字大小跟隨 Android 設定，並新增最大字體與較大顯示的測試規範
- 請在回報問題的 Samsung 手機重新測試最大字體與較大顯示的組合
- 這仍是早期測試版本，請保留其他可靠的溝通方式

0.2.43:

- 37 個注音符號都固定顯示在第一層，不必再用「更多」尋找
- 功能鍵、目前選列／選格狀態與「⚙ 設定」更容易分辨
- 「復原」會回到原本候選頁；EN 會朗讀為「英文」
- 預設掃描速度放慢，既有自訂速度不變
- 匯出後會顯示實際檔名，並可直接「開啟文字檔」
- 這仍是早期測試版本，請保留其他可靠的溝通方式

0.2.41:

- 更新為 Android 16（API 36）目標版本
- 保留返回上一頁、另存 UTF-8 文字檔與正確文字紀錄功能
- 保留基本注音優先、更多分頁示範與錯誤修正功能
- 請在 Android 16 測試返回手勢、系統列、平板橫直向與畫面重建

0.2.40:

- 修正升級後文字紀錄仍列出每次注音、英文與候選字輸入的問題
- 舊紀錄會整理成每次清除文字區前的最終內容
- 候選字與復原仍更新同一行，只有重設文字區才新增一行
- 保留 Android 返回上一頁與另存 UTF-8 文字檔功能
- 請從前一個測試版本直接升級，不要先清除 app 資料

0.2.39 (superseded; do not upload code 42):

- Android 返回手勢會先回到 app 的上一頁，只在主溝通板離開 app
- 文字紀錄在編輯期間更新同一行，清除文字區後才新增一行
- 匯出文字會開啟系統「另存新檔」並建立 UTF-8 文字檔
- 保留既有設定、草稿與舊版文字紀錄
- 請重新測試注音後續符號優先順序與「更多」示範流程

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
- Current draft: bundled MediaPipe face analysis runs on the device; SHINE AAC
  receives no communication content, settings, camera frames, or face-analysis
  results. Use
  `docs/PLAY_DATA_SAFETY.md` for the exact Play form categories.
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
- Signed Play AAB: `.artifacts/releases/v0.4.0/shine-aac-v0.4.0-code60-release.aab`
