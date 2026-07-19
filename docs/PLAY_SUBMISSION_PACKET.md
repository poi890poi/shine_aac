# Google Play Submission Packet

This packet is the review checklist for the first Google Play internal testing submission of SayToMe AAC / 我想說. The primary audience is Taiwan Traditional Chinese users and helpers.

## Build To Upload

- Track: Internal testing first
- Package id: `org.shineaac.app`
- Current source version: `0.2.38`
- Current source version code: `41`
- Source tag: `v0.2.38`
- Signed AAB: `.artifacts/releases/v0.2.38/shine-aac-v0.2.38-code41-release.aab`
- Signed AAB SHA-256: `cdda55df0eda443fb4e8d4eda1480dcbdcb4991f598e6938830b38e872aaf7f4`
- AAB checksum file: `.artifacts/releases/v0.2.38/PLAY_AAB_SHA256SUMS.txt`
- Upload keystore location: `E:\Android\keys\saytome-upload.jks`
- Keystore properties location: `E:\Android\keys\saytome-upload.properties`

Do not upload the debug APK to Google Play. Upload the versioned signed release AAB above; version code 41 is higher than the historical code-40 artifact.

## Store Listing

- Primary locale: Traditional Chinese Taiwan / `zh-TW`
- App name: `我想說 SayToMe AAC`
- Short description: `早期開發中的繁體中文 AAC 輔助溝通工具 支援注音掃描輸入與語音輸出`
- Full description source: `docs/PLAY_STORE_LISTING.md`
- English fallback listing source: `docs/PLAY_STORE_LISTING.md`

The listing should keep the early-development warning and avoid medical-device or treatment claims.

## Release Notes

Use this for 0.2.38 Internal testing:

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

- Confirm in Play Console that version code 41 has not already been used.
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
