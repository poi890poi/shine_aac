package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class BlinkCalibrationQualityPolicyTest {
    @Test
    fun holdThresholdBalancesDeliberateAndNaturalDurations() {
        val threshold = BlinkHoldThresholdCalibrator.choose(
            deliberateDurationsMs = listOf(900L, 1000L, 1100L, 1200L, 1300L),
            naturalDurationsMs = listOf(220L, 300L, 620L),
            fallbackMs = 1200L
        )

        assertEquals(935L, threshold)
    }

    @Test
    fun naturalBlinkSafetyCanRaiseThePersonalizedThreshold() {
        val threshold = BlinkHoldThresholdCalibrator.choose(
            deliberateDurationsMs = listOf(1000L, 1100L, 1200L),
            naturalDurationsMs = listOf(280L, 780L),
            fallbackMs = 1200L
        )

        assertEquals(980L, threshold)
    }

    @Test
    fun overlappingNaturalAndDeliberateDurationsCannotProduceGoodQuality() {
        val deliberate = listOf(800L, 900L, 1000L)
        val natural = listOf(950L)
        val threshold = BlinkHoldThresholdCalibrator.choose(
            deliberateDurationsMs = deliberate,
            naturalDurationsMs = natural,
            fallbackMs = 1200L
        )
        val result = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations = deliberate,
            restClosedDurations = natural,
            calibratedLongBlinkHoldMs = threshold
        )

        assertEquals(900L, threshold)
        assertEquals(BlinkCalibrationQualityPolicy.Level.Weak, result.level)
        assertEquals(1, result.falseLongBlinkCount)
    }

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

    @Test
    fun slowBlinkBelowChosenHoldDoesNotCountAsValid() {
        val result = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations = listOf(550L, 580L, 900L),
            restClosedDurations = emptyList(),
            calibratedLongBlinkHoldMs = 700L
        )

        assertEquals(BlinkCalibrationQualityPolicy.Level.Weak, result.level)
        assertEquals(1, result.validSlowBlinkCount)
    }
}
