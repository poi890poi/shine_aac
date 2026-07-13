# Google Play Data Safety Draft

This worksheet is for Play Console setup for `org.shineaac.app` / SayToMe AAC / 我想說.

Reviewed app state on 2026-07-10:

- Android manifest declares no `uses-permission` entries.
- No `INTERNET`, `CAMERA`, `RECORD_AUDIO`, location, contacts, storage, advertising ID, or account permissions are declared.
- No ads SDK is present.
- No analytics SDK is present.
- No account login is present.
- App content and configuration are handled locally in WebView/app storage.
- Android Text-to-Speech may be invoked through the platform speech engine selected on the device.

Google Play guidance reference:

- Data Safety overview: https://support.google.com/googleplay/android-developer/answer/10787469
- App review preparation: https://support.google.com/googleplay/android-developer/answer/9859455

## Recommended Data Safety Answers

### Data Collection And Sharing

| Play Console Question | Draft Answer | Rationale |
| --- | --- | --- |
| Does your app collect or share any of the required user data types? | No | The app does not transmit user data off device to SHINE AAC or third-party SDKs. |
| Is all user data collected by your app encrypted in transit? | Not applicable | No user data is collected/transmitted by the app. |
| Does your app provide a way for users to request that their data is deleted? | Not applicable / No account data collected | Local app data can be cleared by Android settings or uninstalling. No server-side user data exists for SHINE AAC to delete. |
| Is your app committed to follow the Google Play Families Policy? | No, unless you intentionally target children | The first Taiwan trial should be supervised testing, not a child-directed Play listing. |
| Has your app been independently validated against a global security standard? | No | No MASA or other independent security review has been performed. |

## Data Types

Recommended declaration: no collected/shared data types.

Important note: The app processes messages, symbols, settings, and speech text locally. Google's Data Safety definition of collection focuses on transmitting user data off device. Local-only processing does not need to be declared as collected, but it should be described in the privacy policy for transparency.

## App Content Forms

### Privacy Policy

Use `docs/PRIVACY_POLICY.md` as the privacy policy source. Proposed public URL after push:

```text
https://github.com/poi890poi/shine_aac/blob/main/docs/PRIVACY_POLICY.md
```

If Play Console rejects a GitHub repository page as a privacy policy URL, publish the same content through GitHub Pages or another stable public web page.

### Ads

Draft answer: No, the app does not contain ads.

### App Access

Draft answer: All functionality is available without login or special credentials.

Suggested reviewer note:

```text
The app does not require an account. It opens directly to the AAC board. The Config control is visible in the app for local testing and setup.
```

Suggested zh-TW reviewer note:

```text
本 app 不需要帳號。開啟後會直接進入 AAC 溝通板。設定按鈕可在 app 內直接使用。
```

### Content Rating

Likely category: utility / communication / accessibility.

Expected answers:

- no violence
- no sexual content
- no profanity as app-provided content
- no gambling
- no user-generated online sharing
- no location sharing
- no purchases

### Target Audience

Recommended: adults / general users, not child-directed for the first Play testing release unless you intentionally build the Families-policy path.

The app may be useful to children with appropriate supervision, but declaring children as a target audience creates additional policy obligations. For the first Taiwan trial, treat this as supervised testing with invited users and helpers.

### Health / Medical Positioning

Do not present as a medical device or treatment.

Recommended wording:

```text
SayToMe AAC / 我想說 is an early development communication support tool. It is not medical advice, not a finished clinical product, and not a substitute for professional AAC assessment, speech-language therapy, medical care, or emergency communication planning.
```

Recommended zh-TW wording:

```text
我想說 SayToMe AAC 是早期開發中的溝通輔助工具。它不是醫療建議 不是完成的臨床產品 也不能取代專業 AAC 評估 語言治療 醫療照護 或緊急溝通計畫。
```

## Verification Checklist Before Submitting The Form

- Re-run `rg -n "uses-permission|android.permission|INTERNET|RECORD_AUDIO|CAMERA|ACCESS_|AD_ID" app/src/main app/build.gradle.kts gradle/libs.versions.toml`.
- Confirm no network, ads, analytics, crash reporting, or third-party SDKs were added.
- Confirm privacy policy URL is public.
- Confirm Play listing and release notes keep the early-development warning.
- If any feedback form, email integration, analytics, cloud sync, crash reporting, or remote logging is added later, revisit this worksheet before upload.
