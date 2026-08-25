# Google Play Data Safety Draft

This worksheet is for Play Console setup for `org.shineaac.app` / SayToMe AAC / 我想說.

Reviewed app state on 2026-08-25:

- Android manifest declares `android.permission.CAMERA` for the optional camera switch input.
- `android.hardware.camera` is marked `required="false"`, so camera hardware is not required to install the app.
- The merged manifest includes `INTERNET` and `ACCESS_NETWORK_STATE` for user-initiated, verified optional-resource downloads. No `RECORD_AUDIO`, location, contacts, storage, advertising ID, or account permissions are declared.
- No ads SDK is present.
- No advertising or SHINE AAC analytics SDK is present. The bundled Google ML
  Kit SDK documents encrypted diagnostics and usage-metrics collection.
- No account login is present.
- App content, exportable text history, and configuration are handled locally in WebView/app storage.
- Android cloud backup is disabled, and backup rules exclude all app-data domains. Some Android 12 or later manufacturers may still provide direct device-to-device transfer.
- Optional camera switch processing runs locally on device. The app does not upload camera frames, save photos, record video, or share camera data with SHINE AAC.
- An optional resource update downloads one fixed model file over HTTPS from Google Cloud Storage. The request does not include messages, settings, camera frames, advertising identifiers, accounts, or SHINE AAC telemetry.
- ML Kit documents collection of device/app information, a per-installation
  identifier, performance and API-configuration metrics, feature event types,
  and error codes for diagnostics and usage analytics. Google states that this
  data is encrypted in transit and is not shared with third parties.
- Android Text-to-Speech may be invoked through the platform speech engine selected on the device.

Google Play guidance reference:

- Data Safety overview: https://support.google.com/googleplay/android-developer/answer/10787469
- App review preparation: https://support.google.com/googleplay/android-developer/answer/9859455

## Recommended Data Safety Answers

### Data Collection And Sharing

| Play Console Question | Draft Answer | Rationale |
| --- | --- | --- |
| Does your app collect or share any of the required user data types? | Yes: ML Kit diagnostics/usage metrics are collected; no data is shared | Use the ML Kit disclosure below. SHINE AAC itself has no analytics backend and sends no communication content or camera frames. |
| Is all user data collected by your app encrypted in transit? | Yes, for the documented ML Kit collection | Google documents HTTPS encryption in transit. The optional model file also uses HTTPS. |
| Does your app provide a way for users to request that their data is deleted? | Not applicable / No account data collected | Local app data can be cleared by Android settings or uninstalling. No server-side user data exists for SHINE AAC to delete. |
| Is your app committed to follow the Google Play Families Policy? | No, unless you intentionally target children | The first Taiwan trial should be supervised testing, not a child-directed Play listing. |
| Has your app been independently validated against a global security standard? | No | No MASA or other independent security review has been performed. |

## Data Types

Recommended declaration: collected, not shared. At minimum review and declare
the ML Kit categories that map to **Device or other identifiers** and
**Diagnostics** (including performance, configuration, event, and error data),
for diagnostics and usage analytics. The bundled SDK initializes with the app,
so do not mark this collection optional without first proving that collection
cannot occur until a user opts into camera input.

Version 0.4.0 can also make a user-initiated HTTPS request for a fixed public model
file hosted on Google Cloud Storage. Ordinary network-layer request metadata may
be processed by the hosting provider, but SHINE AAC sends no message, setting,
camera, account, advertising-ID, analytics, or diagnostic payload. Reassess this
draft against the current host behavior and Play's current definitions before
submission; Play makes the developer responsible for the final declaration.

Primary SDK disclosure:

- https://developers.google.com/ml-kit/android-data-disclosure
- https://developers.google.com/ml-kit/terms

Important note: The app processes messages, symbols, settings, speech text, and exportable text history locally. Google's Data Safety definition of collection focuses on transmitting user data off device. Local-only processing does not need to be declared as collected, but it should be described in the privacy policy for transparency.

Optional camera switch input uses the device camera only for local switch/blink detection. Camera frames are not transmitted to SHINE AAC, are not used for ads or analytics, and are not saved as photos or videos by the app.

## Permissions Declaration

Declare camera permission if Play Console asks for sensitive permissions:

```text
The camera permission is used only for optional camera switch input, such as local blink or face-position based activation during AAC scanning. Processing happens on the device. The app does not upload camera frames, save photos, record video, run ads, analytics, or remote logging, and does not require camera hardware to use the main AAC board.
```

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
The app does not require an account. It opens directly to the AAC board. The Config control is visible in the app for local testing and setup. Camera switch input is optional; the main AAC board can be used without enabling camera input.
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
- Reconcile the Play form with the current ML Kit data-disclosure page and all
  other SDKs; confirm there are no ads, SHINE analytics, crash reporting, or
  remote logging beyond the documented SDK metrics.
- Confirm camera permission is still used only for optional local camera switch input.
- Confirm privacy policy URL is public.
- Confirm Play listing and release notes keep the early-development warning.
- If any feedback form, email integration, analytics, cloud sync, crash reporting, or remote logging is added later, revisit this worksheet before upload.
