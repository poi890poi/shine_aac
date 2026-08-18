# Google Play Submission Packet

This packet is the review checklist for the current Google Play closed-testing submission of SayToMe AAC / 我想說. The primary audience is Taiwan Traditional Chinese users and helpers.

## Build To Upload

- Track: Closed testing
- Package id: `org.shineaac.app`
- Current source version: `0.3.1`
- Current source version code: `50`
- Compile and target SDK: `36`
- Source tag: `v0.3.1`
- Signed AAB in release ZIP: `binaries/shine-aac-v0.3.1-code50-release.aab`
- Signed AAB SHA-256: `7bd840836c51a86d4327666b7a6a66f2da7055ede592e324d130832c358538dd`
- AAB checksum file: `binaries/PLAY_AAB_SHA256SUMS.txt`
- Upload keystore location: `E:\Android\keys\saytome-upload.jks`
- Keystore properties location: `E:\Android\keys\saytome-upload.properties`

Do not upload an APK or any superseded bundle to Google Play. After confirming
that code 50 is unused and creating the final source tag, upload the versioned
signed code-50 AAB above.

## Store Listing

- Primary locale: Traditional Chinese Taiwan / `zh-TW`
- App name: `我想說 SayToMe AAC`
- Short description: `早期開發中的繁體中文 AAC 輔助溝通工具 支援注音掃描輸入與語音輸出`
- Full description source: `docs/PLAY_STORE_LISTING.md`
- English fallback listing source: `docs/PLAY_STORE_LISTING.md`

The listing should keep the early-development warning and avoid medical-device or treatment claims.

## Release Notes

Use this for 0.3.1 closed testing:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 可選擇原本的「列、格」或新的「區塊、列、格」單一開關掃描；兩種模式使用相同版面與候選字詞
- 區塊模式會保留紫色範圍提示，再於區塊內選列與格；只有一列或一格時會自動進入下一步
- 英文維持獨立的四欄版面；固定字母 I 回到 ETAO／INSR 的高頻字母位置，不再與單字候選重複
- 暫停與停止狀態文字縮短，避免在手機上被裁切；自動示範支援兩種掃描模式
- 這仍不是唯一或緊急溝通方式；請在實際裝置比較兩種掃描方式的速度、辨識負擔與疲勞感
```

Previous 0.3.0 notes retained for reference:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 列與項目預設各掃描兩輪，錯過目標時不會立刻離開；也可在設定選一至三輪或持續掃描
- 錯過兩輪項目會回到同一列；錯過兩輪所有列會停止掃描，再按一次只會喚醒、不會誤選
- 掃描狀態會顯示目前輪次，停止時會清楚變暗並提示按下開關繼續
- 注音第一個符號的候選排序採用保守的台灣口語語料訊號，每次最多提升兩個高實用候選
- 在意圖不明確時，少數經人工審查的敏感詞會柔性降序；完整注音輸入仍保留原本排序與詞彙
- 這仍不是唯一或緊急溝通方式；請在實際裝置確認掃描速度、語音、相機與疲勞感
```

Previous 0.2.45 notes retained for reference:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 暫停確認列改用淡青灰底色與深青色實線外框，保留位置提示但不再像掃描仍在前進
- 修正部分裝置或顯示縮放設定可能重複保留系統邊界，造成間距不一致的問題
- 系統字體大小會套用到 Android 內嵌介面；窄螢幕狀態文字不再逐字換行
- 訊息或版面改變後會先停在第一列供確認，再按一次才繼續掃描
- 示範模式加快並優先選取畫面上最長的可用候選，不會改變個人儲存的掃描速度
- 這仍不是唯一或緊急溝通方式；請在實際裝置確認可見度、疲勞感與個人掃描速度
```

Previous 0.2.44 notes retained for reference:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 修正放大系統字體或顯示大小時，功能鍵文字與圖示重疊的問題
- 繁中英文輸入區也會顯示英文候選字詞，中英文相接時不必另外選空格
- 內建介面以「復原」處理單字、字母、注音與整個候選字詞的上一步操作，不再顯示容易混淆的「刪除」鍵
- 設定、輸入測試及相機設定改用繁體中文；放大字體時按鍵仍會自動調整
- 相機設定的「開始」「測試」「完成」固定顯示；其他調整可捲動
- 請以最大字體及較大顯示設定測試；這仍不是唯一或緊急溝通方式
```

Previous 0.2.43 notes retained for reference:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 37 個注音符號都固定顯示在第一層，不必再用「更多」尋找
- 功能鍵、目前選列／選格狀態與「⚙ 設定」更容易分辨
- 「復原」會回到原本候選頁；「英文」會朗讀為「英文」
- 預設掃描速度放慢，既有自訂速度不變
- 匯出後會顯示實際檔名，並可直接「開啟文字檔」
- 這仍是早期開發版本，不能作為唯一或緊急溝通方式
```

Previous 0.2.41 notes retained for reference:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 更新為 Android 16（API 36）目標版本
- 保留返回上一頁、另存 UTF-8 文字檔與正確文字紀錄功能
- 保留基本注音優先、更多分頁示範與錯誤修正功能
- 請在 Android 16 測試返回手勢、系統列、平板橫直向與畫面重建
- 這仍是早期開發版本，不能作為唯一或緊急溝通方式
```

Previous 0.2.40 notes retained for reference; do not upload its code-43 AAB:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 修正升級後文字紀錄仍列出每次注音、英文與候選字輸入的問題
- 舊紀錄會整理成每次清除文字區前的最終內容
- 候選字與復原仍更新同一行，只有重設文字區才新增一行
- 保留 Android 返回上一頁與另存 UTF-8 文字檔功能
- 請從前一個測試版本直接升級，不要先清除 app 資料
- 這仍是早期開發版本，不能作為唯一或緊急溝通方式
```

Previous 0.2.39 notes retained for reference; do not upload its code-42 AAB:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- Android 返回手勢會先回到 app 的上一頁，只在主溝通板離開 app
- 文字紀錄在編輯期間更新同一行，清除文字區後才新增一行
- 匯出文字會開啟系統「另存新檔」並建立 UTF-8 文字檔
- 保留既有設定、草稿與舊版文字紀錄
- 請重新測試注音後續符號優先順序與「更多」示範流程
- 這仍是早期開發版本，不能作為唯一或緊急溝通方式
```

Previous 0.2.38 notes retained for reference:

```text
早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 未完成的注音音節會優先顯示基本後續符號
- 示範模式可透過「更多」完成較後面的注音符號與候選字詞
- 改善慢速掃描與較少欄位設定下的示範可靠性
- 點按離開示範後可正常繼續掃描與溝通
- 這仍是早期開發版本，不能作為唯一或緊急溝通方式
```

Previous draft retained for reference:

```text
早期測試版本 主要給台灣繁體中文使用者與協助者試用。

- 改善注音輸入錯誤的容忍與整組修正建議
- 多符號注音輸入加入重選 並保留已輸入的訊息文字
- 依候選數量調整候選字與後續注音配置
- 開始示範模式前會重設訊息與掃描狀態
- 這仍是早期開發版本 不能作為唯一或緊急溝通方式
```

## Store Assets

| Asset | File |
| --- | --- |
| App icon 512 x 512 | `store-assets/app-icon/saytome-aac-icon-512.png` |
| App icon 1024 x 1024 source/export | `store-assets/app-icon/saytome-aac-icon-1024.png` |
| Feature graphic 1024 x 500 | `store-assets/feature-graphic/saytome-aac-feature-graphic.png` |
| Screenshot 1 | `store-assets/screenshots/phone/01-row-scanning.png` |
| Screenshot 2 | `store-assets/screenshots/phone/02-symbol-scanning-suggestions.png` |
| Screenshot 3 | `store-assets/screenshots/phone/03-configuration-basic.png` |
| Screenshot 4 | `store-assets/screenshots/phone/04-configuration-input-options.png` |

Screenshot captions:

1. 注音列掃描與繁體中文常用語
2. 注音輸入後的候選字詞與符號掃描
3. 可調整語言 欄數與掃描速度
4. 語音回饋 開關輸入與候選字詞設定

Regenerate cleaned screenshots from tracked source captures:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\clean-store-screenshots.ps1
```

## Privacy And Data Safety

- Privacy policy source: `docs/PRIVACY_POLICY.md`
- Proposed privacy policy URL after push: `https://github.com/poi890poi/shine_aac/blob/main/docs/PRIVACY_POLICY.md`
- Data Safety worksheet: `docs/PLAY_DATA_SAFETY.md`

Recommended Data Safety summary:

- Data collected: No
- Data shared: No
- Ads: No
- Analytics: No
- Account required: No
- Internet permission: No
- Camera permission: Yes, optional local camera switch input only
- Microphone/location permissions: No
- Local-only settings, text history/export, message processing, and optional camera switch processing
- Android Text-to-Speech behavior depends on the device speech engine

If Play Console rejects the GitHub privacy policy URL, publish the same privacy policy content through GitHub Pages or another stable public page.

## App Access Reviewer Note

```text
The app does not require an account. It opens directly to the AAC board. The Config control is visible in the app for local testing and setup. Camera switch input is optional; the main AAC board can be used without enabling camera input.
```

zh-TW version:

```text
本 app 不需要帳號。開啟後會直接進入 AAC 溝通板。設定按鈕可在 app 內直接使用。
```

## Content Rating And Target Audience

Recommended first-submission positioning:

- Category: utility / communication / accessibility
- Target audience: adults/general users for supervised testing
- Not child-directed for the first Play testing release
- No ads, purchases, gambling, violence, sexual content, user-generated online sharing, or location sharing

Important: the app may be useful for children with proper supervision, but selecting children as a Play target audience creates additional Families Policy obligations. Do that only when intentionally prepared.

## Health And Safety Wording

Use this wording in Play fields or reviewer notes if needed:

```text
我想說 SayToMe AAC 是早期開發中的溝通輔助工具。它不是醫療建議 不是完成的臨床產品 也不能取代專業 AAC 評估 語言治療 醫療照護 或緊急溝通計畫。
```

English:

```text
SayToMe AAC / 我想說 is an early development communication support tool. It is not medical advice, not a finished clinical product, and not a substitute for professional AAC assessment, speech-language therapy, medical care, or emergency communication planning.
```

## Verification To Refresh Before Upload

- Confirm in Play Console that version code 50 has not already been used.
- Rerun the full pre-release verification gate.
- Rebuild the signed Play AAB with `.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties`.
- Record final version, Git commit, Git tag, AAB SHA-256, and release notes before upload.

Known caveat:

- Use the Internal testing rollout for real-device UX verification, especially scan timing, speech output, text history/export, and optional camera switch setup. Complete that review before promotion to a broader track.

## Owner-Side Tasks In Play Console

These require the Play Console account owner:

1. Open the created Play Console app entry.
2. Add primary `zh-TW` store listing.
3. Upload signed AAB to Internal testing.
4. Upload icon, feature graphic, and screenshots.
5. Paste descriptions and release notes.
6. Complete Data Safety and App Content forms using `docs/PLAY_DATA_SAFETY.md`.
7. Add privacy policy URL.
8. Add internal testers.
9. Submit internal testing release for review.
