# SayToMe AAC / 我想說 Privacy Policy

Effective date: 2026-08-25

SayToMe AAC / 我想說 is an early development augmentative and alternative communication app from the SHINE AAC project. It is intended for supervised testing with users, families, caregivers, therapists, clinicians, testers, and software contributors.

SayToMe AAC / 我想說 是 SHINE AAC 專案的早期輔助溝通 AAC 測試應用程式。它主要面向有人陪同的小規模測試，包含使用者 家人 照顧者 語言治療師 醫療與照護相關專家 測試者與軟體貢獻者。

This app is not a finished clinical product, not medical advice, and not a substitute for professional AAC assessment, language therapy, medical care, or emergency communication planning.

本 app 不是完成的臨床產品 不是醫療建議 也不能取代專業 AAC 評估 語言治療 醫療照護 或緊急溝通計畫。

## Summary

- The app does not require an account.
- The app does not contain ads.
- The app does not include analytics or advertising tracking.
- The app does not use a SHINE AAC server.
- The app does not collect, sell, or share personal data with us.
- Communication content and settings are processed on the device.
- Optional camera switch input is processed on the device and is not sent to us.
- Optional model updates download a fixed public file over HTTPS; messages,
  settings, and camera frames are not included in that request.

## 摘要

- 不需要帳號。
- 沒有廣告。
- 沒有分析或廣告追蹤。
- 不使用 SHINE AAC 伺服器。
- 不會向我們收集 出售 或分享個人資料。
- 溝通內容與設定會在裝置本機處理。
- 選用模型更新會透過 HTTPS 下載固定的公開檔案；請求中不包含溝通訊息、設定或相機畫面。

## Information Processed On The Device

The app may process the following information locally on the device so that the communication interface can work:

- selected symbols, words, and phrases
- the current message being composed
- locally saved text-history entries for previously composed messages
- app settings such as language profile, scan timing, voice settings, and input settings
- optional camera switch input signals when camera switch is enabled
- local test configuration when a test build is being verified

This information is used for app functionality only. It is not transmitted to SHINE AAC servers.

## Camera Switch Input

The app may request camera permission if a user or helper enables optional camera switch input, such as blink-based activation for scanning. Camera processing is used for local input detection only.

The app does not upload camera frames to SHINE AAC, does not save photos, does not record video, and does not use camera data for ads, analytics, or remote logging.

## On-device Face Analysis

The app uses a bundled MediaPipe model for blink and cheek detection. Face
analysis runs on the device. Camera images and face-analysis results are not
sent to SHINE AAC or Google.

## 裝置本機臉部分析

本 app 使用內建的 MediaPipe 模型辨識眨眼與臉頰動作。臉部分析在裝置本機
執行，相機影像與分析結果不會傳送給 SHINE AAC 或 Google。

## Optional Resource Downloads

If a user chooses an offered model update, the app downloads a fixed public
model file over HTTPS from Google Cloud Storage. SHINE AAC verifies its expected
size and SHA-256 digest before installation. The app does not attach
communication messages, app settings, camera frames, account information,
advertising identifiers, analytics, or diagnostic logs to this request.

As with ordinary internet requests, the hosting and network providers may
process network-layer metadata under their own terms. The included offline
fallback remains available without making this download.

## 選用資源下載

使用者選擇可用的模型更新時，app 會透過 HTTPS 從 Google Cloud Storage
下載固定的公開模型檔，並在安裝前驗證預期大小與 SHA-256。請求不會附帶
溝通訊息、app 設定、相機畫面、帳號資訊、廣告識別碼、分析或診斷紀錄。

一般網路請求仍可能由託管與網路服務提供者依其條款處理網路層中繼資料。
不下載更新時，app 仍可使用內建的離線備援版本。

## 裝置本機處理的資訊

為了讓溝通介面正常運作，本 app 可能在裝置本機處理下列資訊：

- 使用者選擇的符號 詞語與短語
- 正在組合中的訊息
- 語言設定 掃描速度 語音設定 輸入設定等 app 設定
- 測試版本驗證時使用的本機測試設定

這些資訊只用於 app 功能，不會傳送到 SHINE AAC 伺服器。

## Speech Output

The app can use Android Text-to-Speech to speak selected messages aloud. Text-to-Speech behavior depends on the speech engine installed on the device. Some device speech engines may process speech locally, while others may use services from the device vendor or speech engine provider.

Users and helpers should review the privacy settings and terms for the Text-to-Speech engine installed on their device.

## 語音輸出

本 app 可以使用 Android 文字轉語音功能朗讀選取的訊息。文字轉語音的實際處理方式取決於裝置上安裝的語音引擎。有些語音引擎可能在本機處理，有些可能使用裝置廠商或語音引擎供應商的服務。

使用者與協助者應確認自己裝置上文字轉語音引擎的隱私設定與服務條款。

## Data Storage

Configuration and text history are stored locally on the device using app storage. Text history can be exported from the app by the user or helper. If the local text history grows too large, the app removes the oldest saved message entries first so newer communication remains available.

Clearing app data or uninstalling the app may delete local settings and local text history.

The app disables Android cloud backup for app data and does not provide account sync or server-side recovery. On some Android 12 or later devices, the device manufacturer may still support direct device-to-device transfer despite the app's backup setting.

## 資料儲存

設定會儲存在裝置本機的 app 儲存空間。清除 app 資料或解除安裝可能會刪除本機設定。

本 app 會停用 Android app 資料的雲端備份，也不提供帳號同步或伺服器端復原。在部分 Android 12 以上裝置中，裝置製造商仍可能提供不經雲端的裝置間直接轉移功能。

## Data Sharing

SHINE AAC does not receive or share personal data from this app.

If a user or helper manually shares screenshots, feedback, bug reports, emails, videos, or other materials with the project team, that shared material may contain personal or health-related information. Please avoid sending sensitive information unless it is necessary for the testing purpose and you have permission from the people involved.

## 資料分享

SHINE AAC 不會從本 app 接收或分享個人資料。

如果使用者或協助者主動分享截圖 回饋 錯誤回報 電子郵件 影片或其他資料給專案團隊，這些主動分享的資料可能包含個人或健康相關資訊。除非測試目的確實需要 且已取得相關人員同意，請避免傳送敏感資訊。

## Children And Supervised Use

This early development version should be used with appropriate supervision. If the app is tested with a child or another person who cannot independently consent, a parent, guardian, caregiver, clinician, or responsible adult should decide whether testing is appropriate.

## 兒童與陪同使用

這個早期開發版本應在適當陪同下使用。如果測試對象是兒童 或無法獨立同意的人，應由父母 監護人 照顧者 臨床專業人員 或負責任的成人判斷是否適合測試。

## Safety And Emergency Use

Do not rely on this app as the only communication method. During testing, keep another reliable communication method available, especially for urgent health, pain, consent, distress, or emergency situations.

## 安全與緊急情況

不要把本 app 當作唯一溝通方式。測試期間請保留其他可靠溝通方式，尤其是健康急迫需求 疼痛 同意 拒絕 不舒服 或緊急情況。

## Changes To This Policy

This policy may be updated as the app changes. Material changes should be reflected in the project repository and Play Store listing before broader release.

## 政策變更

本政策可能會隨 app 變更而更新。重大變更應在擴大發布前反映於專案 repository 與 Play Store listing。

## Contact

For questions about this privacy policy or the SHINE AAC project, use the project repository:

https://github.com/poi890poi/shine_aac
