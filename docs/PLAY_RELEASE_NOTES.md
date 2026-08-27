# SayToMe AAC / 我想說 Play Store Release Notes

Current Play Console "what's new" text for v0.4.1 (code 61), in the bilingual
(`zh-TW` primary, `en-IN` fallback) format Google Play requires. Replace this whole
block on the next release; do not keep a per-version history here.

Google caps release notes at 500 Unicode characters per language (Play Console Help,
[Prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348)).
The blocks below are within that limit.

<zh-TW>

早期測試版本，主要給台灣繁體中文使用者與協助者試用。

- 長眨眼與臉頰動作改用內建 MediaPipe，在裝置上離線處理影像。
- 臉頰設定會自動找出動作樣本，不必先成功觸發六次。
- 改善長眨眼校正、短眨眼排除，以及掉幀時的穩定性與復原。
- 相機畫面引導保留完整臉部，約占畫面七成。
- 簡化相機動作用語，不再顯示內部語音引擎資訊。
- 直接安裝包依手機架構分開，減少下載大小。
- 仍不能作為唯一或緊急溝通方式。

</zh-TW>
<en-IN>

Early test release.

- Uses bundled offline MediaPipe for blink and cheek input.
- Finds cheek setup samples automatically; six prior activations are no longer required.
- Improves blink calibration, natural-blink rejection, and recovery from delayed frames.
- Keeps the whole face visible at about 70% of the camera view.
- Uses clearer wording and hides internal speech-engine details.
- Provides smaller ABI-specific APKs.
- Not for sole or emergency communication.

</en-IN>
