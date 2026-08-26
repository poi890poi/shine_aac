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
            calibrationWaitingScoreText("0.00", zhTw = false),
            calibrationWaitingScoreText("0.00", zhTw = true)
        )

        messages.forEach { message ->
            assertFalse(message.contains("Voice", ignoreCase = true))
            assertFalse(message.contains("語音"))
            assertFalse(message.contains("zh-TW", ignoreCase = true))
            assertFalse(message.contains("zho-default", ignoreCase = true))
        }
    }

    @Test
    fun `camera setup status retains relevant calibration state`() {
        assertEquals("Rest starts after the start tone", calibrationStepPendingText("Rest", false))
        assertEquals("開始提示音後進行放鬆", calibrationStepPendingText("放鬆", true))
        assertEquals("Face not detected", calibrationFaceMissingText(false))
        assertEquals("未偵測到臉部", calibrationFaceMissingText(true))
        assertEquals("Score 0.00", calibrationWaitingScoreText("0.00", false))
        assertEquals("分數 0.00", calibrationWaitingScoreText("0.00", true))
    }
}
