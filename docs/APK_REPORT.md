# SHINE AAC APK Report

Generated: 2026-07-03

## Download

Debug APK:

```text
https://gaps-golf-henry-escape.trycloudflare.com/app-debug.apk
```

Local file:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Size:

```text
8742851 bytes
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
- logcat no longer shows the previous `file:///android_asset` ES module CORS error
- latest screenshot saved at `e2e-artifacts/shine-mvp-fit.png`
- real-touch E2E entered `I want water` through packaged APK switch taps
- real-touch E2E final screenshot saved at `e2e-artifacts/real-touch-final.png`

Browser E2E also includes a Pixel 4a 5G-sized layout check:

```text
pixel-4a-5g-layout: PASS, fits 12 rows in 851px viewport without scrolling
```

Public download check:

```text
HTTP 200
Content-Length: 8742851
Content-Type: application/octet-stream
```

## Notes

This is a debug APK, so Android may warn about installing an unknown app. It is intended for user-experience testing, not release distribution.
