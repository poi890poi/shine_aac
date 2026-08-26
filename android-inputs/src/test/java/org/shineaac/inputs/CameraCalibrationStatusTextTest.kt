package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class CameraCalibrationStatusTextTest {
    @Test
    fun `camera setup status explains the next action without exposing TTS voice details`() {
        val messages = listOf(
            calibrationStepPendingText("Rest", zhTw = false),
            calibrationStepPendingText("放鬆", zhTw = true),
            calibrationFaceMissingText(zhTw = false),
            calibrationFaceMissingText(zhTw = true),
            calibrationFaceReadyText(zhTw = false),
            calibrationFaceReadyText(zhTw = true),
            savedCalibrationQualityText("Quality good", zhTw = false),
            savedCalibrationQualityText("品質良好", zhTw = true)
        )

        messages.forEach { message ->
            assertFalse(message.contains("Voice", ignoreCase = true))
            assertFalse(message.contains("語音"))
            assertFalse(message.contains("zh-TW", ignoreCase = true))
            assertFalse(message.contains("zho-default", ignoreCase = true))
            assertFalse(message.contains("score", ignoreCase = true))
            assertFalse(message.contains("分數"))
            assertFalse(message.contains("threshold", ignoreCase = true))
            assertFalse(message.contains("門檻"))
        }
    }

    @Test
    fun `camera setup status retains relevant calibration state`() {
        assertEquals("Rest starts after the start tone", calibrationStepPendingText("Rest", false))
        assertEquals("開始提示音後進行放鬆", calibrationStepPendingText("放鬆", true))
        assertEquals("Face not detected", calibrationFaceMissingText(false))
        assertEquals("未偵測到臉部", calibrationFaceMissingText(true))
        assertEquals("Face detected. Follow the instruction above.", calibrationFaceReadyText(false))
        assertEquals("已偵測到臉部。請依照畫面指示操作。", calibrationFaceReadyText(true))
        assertEquals(
            "This setup was not reliable enough. Run setup again.",
            savedCalibrationQualityText("Quality needs retry", false)
        )
        assertEquals(
            "這次設定不夠可靠。請重新設定。",
            savedCalibrationQualityText("請重新設定", true)
        )
    }
}
