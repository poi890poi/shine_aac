# SHINE AAC APK Report

Generated: 2026-07-05

## Download

Current release artifact:

```text
releases/v0.2.0/shine-aac-v0.2.0-code3-debug.apk
```

After tag `v0.2.0` is pushed, the public GitHub Release download URL is:

```text
https://github.com/poi890poi/shine_aac/releases/download/v0.2.0/shine-aac-v0.2.0-code3-debug.apk
```

SHA-256:

```text
edafc88331391512b01af455cec04bb18c17d575095b42195efa1f06ab93723f
```

Intermediate Gradle output, overwritten on every build:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Do not distribute `app-debug.apk` directly. Use the versioned file under `releases/`, or the APK attached to the matching GitHub Release tag.

## What This APK Is

This APK is now a thin Android WebView shell around the Windows/browser app and the shared `packages/aac-core` logic.

The APK bundles:

- `apps/web/index.html`
- `apps/web/src/styles.css`
- a generated WebView-compatible `bundle.js` containing local web modules, the web app, and AAC core

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
- packaged WebView bundle contains the generated New Chewing `zh-TW` dictionary data and has no remaining module `import`/`export` syntax
- web E2E verified localized `zh-TW` function labels including `復原` and `更多`
- web E2E verified default suggestion-review hold pauses scanning and resumes on the next activation
- web E2E verified hidden `Config` long-press starts the extended everyday conversation demo and tap exits it
- demo mode uses scanner state to activate targets after roughly one-third to one-half of the highlight duration
- demo mode includes word selections, deeper-row alphabet spelling, `DEL`, and `UNDO` correction
- hardware-button E2E final screenshot saved at `e2e-artifacts/hardware-button-final.png`

Browser E2E also includes a Pixel 4a 5G-sized layout check:

```text
pixel-4a-5g-layout: PASS, fits 12 rows in 851px viewport without scrolling
zh-tw-pixel-4a-5g-layout: PASS, fits 12 rows in 851px viewport without scrolling
```

Versioned release packaging:

```text
.\package-release.bat -SdkDir E:\Android\Sdk
```

## Notes

This is a debug APK, so Android may warn about installing an unknown app. It is intended for user-experience testing, not release distribution.
