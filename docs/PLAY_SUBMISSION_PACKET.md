# Google Play submission packet — 0.4.0

This is the owner checklist for the Google Play Internal or Closed testing
submission of version 0.4.0. The Taiwan listing uses the localized name
`我想說`; English listings use `SayToMe AAC`.

## Build to upload

- Track: Internal testing first; promote to Closed testing only after review.
- Package id: `org.shineaac.app`
- Version name: `0.4.0`
- Version code: `60`
- Compile and target SDK: `36`
- Upload artifact: `shine-aac-v0.4.0-code60-release.aab`
- Checksum: recorded in `PLAY_AAB_SHA256SUMS.txt` after the final build.
- Upload key: the existing private SayToMe upload key; never commit its
  keystore or properties file.

Only the signed AAB belongs in Google Play. The versioned debug APK is for
direct device installation and must not be uploaded to Play.

Before upload, the Play Console owner must confirm that version code 60 has
not already been used. Google Play does not permit reusing a version code,
even when the earlier bundle was only a draft or test release.

## Store identity

| Field | Taiwan (`zh-TW`) | English |
| --- | --- | --- |
| App name | `我想說` | `SayToMe AAC` |
| Listing source | `docs/PLAY_STORE_LISTING.md` | `docs/PLAY_STORE_LISTING.md` |
| Release notes | `docs/PLAY_RELEASE_NOTES.md` | `docs/PLAY_RELEASE_NOTES.md` |

Keep the early-development and emergency-communication warnings. Do not make
medical-device, treatment, diagnosis, or outcome claims.

## User documentation

- Quick start and routine settings: `docs/index.html`
- Camera action setup: `docs/camera-switch/index.html`
- USB UVC connection, permission, compatibility, and troubleshooting:
  `docs/uvc-camera/index.html`
- Advanced scanning, timing, speech, input, contrast, and content settings:
  `docs/advanced-settings/index.html`
- Support: `docs/support/index.html`
- Privacy policy: `docs/privacy-policy/index.html`

Direct USB UVC support is part of 0.4.0. It still requires compatibility and
physical calibration testing for each Android device, adapter/hub, and webcam
combination; do not describe every UVC device as guaranteed compatible.

## Store assets

| Asset | File |
| --- | --- |
| App icon 512 × 512 | `store-assets/app-icon/saytome-aac-icon-512.png` |
| App icon 1024 × 1024 source/export | `store-assets/app-icon/saytome-aac-icon-1024.png` |
| Feature graphic 1024 × 500 | `store-assets/feature-graphic/saytome-aac-feature-graphic.png` |
| Screenshot 1 | `store-assets/screenshots/phone/01-row-scanning.png` |
| Screenshot 2 | `store-assets/screenshots/phone/02-symbol-scanning-suggestions.png` |
| Screenshot 3 | `store-assets/screenshots/phone/03-configuration-basic.png` |
| Screenshot 4 | `store-assets/screenshots/phone/04-configuration-input-options.png` |

Review screenshots against the exact 0.4.0 build before upload. Do not use a
screenshot that shows a stale app name, broken dark
theme, undersized camera preview, or superseded settings layout.

## Privacy and app access

Use `docs/PLAY_DATA_SAFETY.md` as the Data Safety worksheet.

- No account or sign-in.
- No ads, SHINE analytics, or SHINE/SayToMe server.
- Internet access supports verified, user-initiated optional-resource downloads.
  Bundled MediaPipe face analysis runs entirely on the device.
- Settings, message drafts, and text history stay on the device.
- Text is exported only when the helper requests it.
- Optional camera frames are processed locally and are not stored or uploaded.
- Android Text-to-Speech behavior depends on the installed speech engine.

Reviewer note:

```text
The app does not require an account. It opens directly to the AAC board. The
Settings control is visible in the app for local setup and testing. Camera
gesture input is optional; the board can be used without camera permission.
```

## Required owner actions

1. Confirm version code 60 is unused in Play Console.
2. Verify the final AAB filename, SHA-256, version metadata, and upload-key
   signing identity against the generated release report.
3. Upload only the versioned code-60 AAB to Internal testing.
4. Add the `zh-TW` and English listings with the correct localized names.
5. Paste the matching 0.4.0 release notes for each locale.
6. Upload reviewed icon, feature graphic, and current screenshots.
7. Complete Data Safety, App Access, Content Rating, and Target Audience forms.
8. Add the stable privacy-policy and support URLs.
9. Add testers, submit the Internal testing release, and review Play's pre-launch
   report before promotion.

## Release gate

The package is ready for upload only when the generated 0.4.0 Play report says
all automated gates passed, the signed AAB verification passed, no unresolved
P0/P1 release findings remain, and the owner confirms code 60 is unused.
