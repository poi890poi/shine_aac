package org.shineaac.inputs

import java.util.Locale

data class CalibrationCueSet(
    val locale: Locale,
    val prepare: String,
    val open: String,
    val closed: String,
    val rest: String,
    val longBlink: String,
    val complete: String
)

object CalibrationCueText {
    fun forProfile(profileId: String): CalibrationCueSet {
        return when (profileId) {
            "zh-TW" -> CalibrationCueSet(
                locale = Locale.forLanguageTag("zh-TW"),
                prepare = "請看著鏡頭，保持臉部在畫面中。",
                open = "請張開眼睛，保持自然。",
                closed = "請閉上眼睛，保持不動。",
                rest = "請自然休息，可以正常眨眼。",
                longBlink = "請做幾次長眨眼。",
                complete = "校準完成。"
            )
            else -> CalibrationCueSet(
                locale = Locale.forLanguageTag("en-US"),
                prepare = "Look at the camera. Keep your face visible.",
                open = "Keep your eyes open.",
                closed = "Close your eyes and hold.",
                rest = "Rest normally. Normal blinks are okay.",
                longBlink = "Do several long blinks.",
                complete = "Calibration complete."
            )
        }
    }
}
