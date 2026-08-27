package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraSwitchPowerPolicyTest {
    @Test
    fun idleModeReducesAnalysisForEveryCameraGesture() {
        assertEquals(100L, cameraAnalysisIntervalMs(OpticalSwitchGesture.LongBlink, false))
        assertEquals(66L, cameraAnalysisIntervalMs(OpticalSwitchGesture.CheekTwitch, false))
        assertEquals(200L, cameraAnalysisIntervalMs(OpticalSwitchGesture.LongBlink, true))
        assertEquals(200L, cameraAnalysisIntervalMs(OpticalSwitchGesture.CheekTwitch, true))
    }

    @Test
    fun stalledHoldIsReleasedWithinCommonScanningCadence() {
        assertFalse(shouldReleaseStalledHold(true, 699L, 100L, 700L))
        assertTrue(shouldReleaseStalledHold(true, 100L, 700L, 700L))
        assertFalse(shouldReleaseStalledHold(false, 10_000L, 10_000L, 700L))

        val worstDefaultRecoveryMs = 700L + WatchdogIntervalMs
        val worstCalibratedRecoveryMs = 1_500L + WatchdogIntervalMs
        assertTrue(worstDefaultRecoveryMs < DefaultScanIntervalMs)
        assertTrue(worstCalibratedRecoveryMs < CameraLongBlinkScanIntervalMs)
    }

    private companion object {
        // Mirrors the shipped web scanner timing contract.
        const val WatchdogIntervalMs = 1_000L
        const val DefaultScanIntervalMs = 1_800L
        const val CameraLongBlinkScanIntervalMs = 2_600L
    }
}
