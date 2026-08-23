# SHINE AAC Blink Diagnostics v0.3.3 R2

Replacement APK-only diagnostic build based on physical-device feedback.

## Changes from R1

- Runtime blink thresholds now match Camera setup (`closed >= 0.55`, `open <= 0.35`).
- Camera status reports the numeric closed-eye score and no longer treats invalid signals as green/healthy.
- Camera shutdown safely closes an in-flight image and delivers ML Kit callbacks on the main executor.
- ZIP export streams on a background thread instead of assembling the full trace on the UI thread.
- **Copy blink debug** copies a compact report to Android's clipboard, so it can be pasted directly into Codex without attaching a file.

## Test and report

1. Install the R2 APK over R1. If Android refuses the update, uninstall **SHINE AAC Blink Diagnostics** first, then install R2.
2. Reproduce the blink problem and continue for 10 seconds.
3. Open Settings and tap **Copy blink debug** / **複製眨眼除錯資料**.
4. Return to Codex, long-press in the message box, choose Paste, and send the complete report.

The report contains no camera images, audio, AAC messages, or composed text.

APK SHA-256: `F7C0DF215F34D5CF34A92A210858788229EED5401B4285041DDD1DF7DDF1977E`

ZIP SHA-256: `801EADB5707A64E2A99D1C144B0EDA736E1D2673849804B6A54F1AD8E83B7722`
