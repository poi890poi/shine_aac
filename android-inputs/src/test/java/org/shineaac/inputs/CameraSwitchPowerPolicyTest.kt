package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class CameraSwitchPowerPolicyTest {
    @Test
    fun idleModeReducesAnalysisForEveryCameraGesture() {
        assertEquals(100L, cameraAnalysisIntervalMs(OpticalSwitchGesture.LongBlink, false))
        assertEquals(66L, cameraAnalysisIntervalMs(OpticalSwitchGesture.CheekTwitch, false))
        assertEquals(200L, cameraAnalysisIntervalMs(OpticalSwitchGesture.LongBlink, true))
        assertEquals(200L, cameraAnalysisIntervalMs(OpticalSwitchGesture.CheekTwitch, true))
    }
}
