package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkDetectionParametersTest {
    @Test
    fun cameraSwitchDefaultsToTwelveHundredMillisecondLongBlink() {
        assertEquals(1200L, CameraSwitchSettings().longBlinkMs)
        assertEquals(1200L, CameraSwitchSettings.DefaultLongBlinkMs)
    }

    @Test
    fun asymmetricEyeProbabilitiesUseAverageForCloseAndMoreOpenEyeForReopen() {
        val signal = BlinkEyeSignal.fromOpenProbabilities(0.99, 0.47)!!

        assertEquals(0.27, signal.closedScore, 0.0001)
        assertEquals(0.01, signal.reopenScore, 0.0001)
    }

    @Test
    fun autoCalibrationTunesThresholdsAndFrameBasedStabilityTogether() {
        val rest = List(30) { BlinkEyeSignal(closedScore = 0.18, reopenScore = 0.08) }
        val slowBlink = List(18) { BlinkEyeSignal(closedScore = 0.18, reopenScore = 0.08) } +
            List(12) { BlinkEyeSignal(closedScore = 0.85, reopenScore = 0.78) }

        val tuned = BlinkParameterAutoCalibrator.tune(
            restSignals = rest,
            slowBlinkSignals = slowBlink,
            frameIntervalsMs = List(30) { 200L }
        )

        assertEquals(0.5485, tuned.closeThreshold, 0.0001)
        assertEquals(0.13, tuned.reopenThreshold, 0.0001)
        assertEquals(400L, tuned.requiredOpenBeforeCloseMs)
        assertEquals(130L, tuned.minClosedStableMs)
        assertEquals(130L, tuned.reopenStableMs)
        assertEquals(700L, tuned.signalLostCancelMs)
        assertEquals(tuned.closeThreshold, tuned.classifierConfig().closeThreshold, 0.0)
        assertEquals(tuned.reopenThreshold, tuned.classifierConfig().openThreshold, 0.0)
    }

    @Test
    fun weakCalibrationKeepsSafeThresholdsButStillMatchesCameraCadence() {
        val fallback = BlinkDetectionParameters(closeThreshold = 0.61, reopenThreshold = 0.24)

        val tuned = BlinkParameterAutoCalibrator.tune(
            restSignals = List(5) { BlinkEyeSignal(0.2, 0.1) },
            slowBlinkSignals = List(5) { BlinkEyeSignal(0.3, 0.2) },
            frameIntervalsMs = List(10) { 250L },
            fallback = fallback
        )

        assertEquals(0.61, tuned.closeThreshold, 0.0)
        assertEquals(0.24, tuned.reopenThreshold, 0.0)
        assertEquals(500L, tuned.requiredOpenBeforeCloseMs)
        assertEquals(163L, tuned.reopenStableMs)
    }

    @Test
    fun invalidStoredValuesAreClampedWithHysteresisGap() {
        val normalized = BlinkDetectionParameters(
            closeThreshold = 0.2,
            reopenThreshold = 0.8,
            reopenStableMs = 10L
        ).normalized()

        assertEquals(0.40, normalized.closeThreshold, 0.0)
        assertTrue(normalized.reopenThreshold <= normalized.closeThreshold - 0.08)
        assertEquals(80L, normalized.reopenStableMs)
    }
}
