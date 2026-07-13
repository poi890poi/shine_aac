# Google Play Submission Packet

This packet is the review checklist for the first Google Play internal testing submission of SayToMe AAC / 我想說. The primary audience is Taiwan Traditional Chinese users and helpers.

## Build To Upload

- Track: Internal testing first
- Package id: `org.shineaac.app`
- Version: `0.2.5`
- Version code: `8`
- Git commit: `012ff66`
- Git tag: `v0.2.5`
- Signed AAB: `app/build/outputs/bundle/release/app-release.aab`
- Signed AAB SHA-256: `5071038dcff000cb77cdfeea21435688bfe190c05f1c42d80de6ed0479799a52`
- Upload keystore location: `E:\Android\keys\saytome-upload.jks`
- Keystore properties location: `E:\Android\keys\saytome-upload.properties`

Do not upload the debug APK to Google Play. Use the signed AAB above.

## Store Listing

- Primary locale: Traditional Chinese Taiwan / `zh-TW`
- App name: `我想說 SayToMe AAC`
- Short description: `早期開發中的繁體中文 AAC 輔助溝通工具 支援注音掃描輸入與語音輸出`
- Full description source: `docs/PLAY_STORE_LISTING.md`
- English fallback listing source: `docs/PLAY_STORE_LISTING.md`

The listing should keep the early-development warning and avoid medical-device or treatment claims.

## Release Notes

Use this for internal testing:

```text
早期測試版本 主要給台灣繁體中文使用者與協助者試用。

- 新增乾淨背景的我想說吉祥物圖示
- 準備 Google Play 內部測試用 AAB
- 加入繁體中文 注音掃描 候選建議與設定畫面的商店截圖
- 保留 zh-TW 使用中偶爾輸入英文的 EN 入口
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
- Camera/microphone/location permissions: No
- Local-only settings and message processing
- Android Text-to-Speech behavior depends on the device speech engine

If Play Console rejects the GitHub privacy policy URL, publish the same privacy policy content through GitHub Pages or another stable public page.

## App Access Reviewer Note

```text
The app does not require an account. It opens directly to the AAC board. The Config control is visible in the app for local testing and setup.
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

## Verification Already Done

- `npm run test:core` PASS: 199 tests on v0.2.4 prerelease path
- `npm run test:web:e2e` PASS on v0.2.4 prerelease path
- Real-device user check: v0.2.4 APK accepted by project owner
- `.\package-release.bat -SdkDir E:\Android\Sdk` PASS for v0.2.5
- `.\build-play-aab.bat -SdkDir E:\Android\Sdk -KeystoreProperties E:\Android\keys\saytome-upload.properties` PASS for v0.2.5

Known caveat:

- Local emulator APK smoke was blocked by emulator/system WebView ANRs, not by a confirmed app crash. Real-device UX verification is the deciding check for this internal testing submission.

## Owner-Side Tasks In Play Console

These require the Play Console account owner:

1. Create app or open existing app entry.
2. Add primary `zh-TW` store listing.
3. Upload signed AAB to Internal testing.
4. Upload icon, feature graphic, and screenshots.
5. Paste descriptions and release notes.
6. Complete Data Safety and App Content forms using `docs/PLAY_DATA_SAFETY.md`.
7. Add privacy policy URL.
8. Add internal testers.
9. Submit internal testing release for review.
