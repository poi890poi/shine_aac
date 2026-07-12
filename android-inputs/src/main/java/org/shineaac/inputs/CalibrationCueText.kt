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
                prepare = "請看著鏡頭。請幫忙把手機固定好，讓臉保持在畫面中。每一步會先說明，聽到提示音後才開始。",
                open = "聽到提示音後，請自然張開眼睛五秒鐘。",
                closed = "聽到提示音後，請閉上眼睛四秒鐘，保持不動。",
                rest = "聽到提示音後，請自然休息八秒鐘。可以正常眨眼。",
                longBlink = "聽到提示音後，請做五次慢慢閉眼再張開。每次都要比平常眨眼久一點。",
                complete = "校準完成。"
            )
            else -> CalibrationCueSet(
                locale = Locale.forLanguageTag("en-US"),
                prepare = "Look at the camera. The helper should mount the phone so the face stays in view. Each step starts after the start tone.",
                open = "After the start tone, keep your eyes naturally open for five seconds.",
                closed = "After the start tone, close your eyes and hold still for four seconds.",
                rest = "After the start tone, rest normally for eight seconds. Normal blinks are okay.",
                longBlink = "After the start tone, slowly close and open your eyes five times. Each one should be longer than a normal blink.",
                complete = "Calibration complete."
            )
        }
    }
}
