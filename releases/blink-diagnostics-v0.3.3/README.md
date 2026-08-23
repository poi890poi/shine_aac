# SHINE AAC Blink Diagnostics v0.3.3

APK-only diagnostic build for investigating camera long-blink input on physical Android devices. It installs alongside the normal SHINE AAC app as **SHINE AAC Blink Diagnostics**.

## Device test

1. Install `shine-aac-v0.3.3-blink-diagnostics.apk`. Android may ask you to allow installation from the browser or file manager.
2. Open **SHINE AAC Blink Diagnostics** and select **Camera long blink** under Settings > Switch input.
3. Allow camera access and run Camera setup if needed.
4. Return to the board and use long blinks until detection stops or behaves incorrectly. Continue for another 10–20 seconds.
5. Open Settings and tap **Export blink debug** / **匯出眨眼除錯資料**.
6. Save the ZIP and attach that ZIP to the Codex conversation for analysis.

The live camera badge has extra states in this build: **Wait open**, **Eye signal mid**, **No eye signal**, and **Detect error**.

## Privacy

The exported ZIP contains detector timing, face/eye availability, numeric eye-open probabilities, face size/pose, classifier state/events, and device/app metadata. It does **not** contain camera images, audio, AAC messages, or composed text.

## Integrity

APK SHA-256: `EBC66AB0F7654A2513FF52445E89B90E8CDA393D0F9AA7EF9F1ACD4F0E6AC57D`

ZIP SHA-256: `04393470C297D385143804165D9DFACDF573BC8B4C75E6CCAAD0F47E54B013CE`
