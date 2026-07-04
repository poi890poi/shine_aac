# SHINE AAC APK Report

Generated: 2026-07-04

## Download

Debug APK:

```text
https://juvenile-sport-pregnant-immigration.trycloudflare.com/app-debug.apk
```

Local file:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Size:

```text
8769145 bytes
```

## What This APK Is

This APK is now a thin Android WebView shell around the Windows/browser app and the shared `packages/aac-core` logic.

The APK bundles:

- `apps/web/index.html`
- `apps/web/src/styles.css`
- a generated WebView-compatible `bundle.js` containing the web app and AAC core

The Android shell provides:

- local WebView loading from APK assets
- JavaScript enabled
- browser local storage
- native Android Text-to-Speech bridge for `SAY`
- native Android Text-to-Speech bridge for scan and activation feedback
- Android hardware button input bridge for volume/media/camera-style keys

## Verified

Passed:

```powershell
npm run test:core
npm run test:web:e2e
.\build-test.bat -SdkDir E:\Android\Sdk
.\run-apk.bat -NoBuild -SdkDir E:\Android\Sdk
.\e2e-switch-test.bat -NoBuild -SdkDir E:\Android\Sdk
```

Emulator smoke check:

- APK installed successfully
- APK launched successfully
- WebView rendered the AAC board
- full board fits on the emulator display without scrolling
- action targets have distinct function styling, and the message area shows a visible cursor
- spaces are visible in the message area as dot markers
- logcat no longer shows the previous `file:///android_asset` ES module CORS error
- latest screenshot saved at `e2e-artifacts/shine-audio-spacing-fit.png`
- hardware-button E2E entered `I want water ` through packaged APK key events
- hardware-button E2E verified packaged `zh-TW` dictionary-backed Zhuyin symbols `ㄅ`, `ㄧ`, `ㄩ`, and `更多`
- web E2E verified localized `zh-TW` function labels including `復原` and `更多`
- web E2E verified optional suggestion-review hold pauses scanning and resumes on the next activation
- hardware-button E2E final screenshot saved at `e2e-artifacts/hardware-button-final.png`

Browser E2E also includes a Pixel 4a 5G-sized layout check:

```text
pixel-4a-5g-layout: PASS, fits 12 rows in 851px viewport without scrolling
zh-tw-pixel-4a-5g-layout: PASS, fits 12 rows in 851px viewport without scrolling
```

Public download check:

```text
HTTP 200
Local shared APK size: 8769145 bytes
```

## Notes

This is a debug APK, so Android may warn about installing an unknown app. It is intended for user-experience testing, not release distribution.
