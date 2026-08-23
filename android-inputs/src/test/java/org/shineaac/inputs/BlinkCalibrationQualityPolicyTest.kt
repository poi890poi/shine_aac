package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class BlinkCalibrationQualityPolicyTest {
    @Test
    fun oneMeasuredBlinkIsWeakRatherThanGood() {
        val result = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations = listOf(900L),
            restClosedDurations = emptyList(),
            calibratedLongBlinkHoldMs = 600L
        )

        assertEquals(BlinkCalibrationQualityPolicy.Level.Weak, result.level)
        assertEquals(1, result.validSlowBlinkCount)
    }

    @Test
    fun threeMeasuredBlinksWithCleanRestAreGood() {
        val result = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations = listOf(700L, 900L, 1100L),
            restClosedDurations = listOf(200L),
            calibratedLongBlinkHoldMs = 600L
        )

        assertEquals(BlinkCalibrationQualityPolicy.Level.Good, result.level)
    }

    @Test
    fun restFalsePositiveKeepsOtherwiseGoodTrialWeak() {
        val result = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations = listOf(700L, 900L, 1100L),
            restClosedDurations = listOf(700L),
            calibratedLongBlinkHoldMs = 600L
        )

        assertEquals(BlinkCalibrationQualityPolicy.Level.Weak, result.level)
        assertEquals(1, result.falseLongBlinkCount)
    }

    @Test
    fun noMeasuredBlinkRequestsRetry() {
        val result = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations = emptyList(),
            restClosedDurations = emptyList(),
            calibratedLongBlinkHoldMs = 600L
        )

        assertEquals(BlinkCalibrationQualityPolicy.Level.Retry, result.level)
    }
}
