package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkDetectionParametersTest {
    @Test
    fun asymmetricEyeProbabilitiesUseAverageForCloseAndMoreOpenEyeForReopen() {
        val signal = BlinkEyeSignal.fromOpenProbabilities(0.99, 0.47)!!

        assertEquals(0.27, signal.closedScore, 0.0001)
        assertEquals(0.01, signal.reopenScore, 0.0001)
        assertEquals(0.01, signal.leftClosedScore, 0.0001)
        assertEquals(0.53, signal.rightClosedScore, 0.0001)
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

        assertEquals(0.55, tuned.closeThreshold, 0.0001)
        assertEquals(0.12, tuned.reopenThreshold, 0.0001)
        assertEquals(0.18, tuned.leftOpenBaseline, 0.0001)
        assertEquals(0.85, tuned.leftClosedBaseline, 0.0001)
        assertEquals(0.18, tuned.rightOpenBaseline, 0.0001)
        assertEquals(0.85, tuned.rightClosedBaseline, 0.0001)
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

    @Test
    fun perEyeBaselinesNormalizeAsymmetricRawScoresBeforeAggregation() {
        val parameters = BlinkDetectionParameters(
            leftOpenBaseline = 0.20,
            leftClosedBaseline = 0.80,
            rightOpenBaseline = 0.10,
            rightClosedBaseline = 0.50
        )
        val raw = BlinkEyeSignal.fromClosedProbabilities(left = 0.50, right = 0.30)!!

        val normalized = parameters.normalizeSignal(raw)

        assertEquals(0.50, normalized.leftClosedScore, 0.0001)
        assertEquals(0.50, normalized.rightClosedScore, 0.0001)
        assertEquals(0.50, normalized.closedScore, 0.0001)
        assertEquals(0.50, normalized.reopenScore, 0.0001)
    }

    @Test
    fun autoCalibrationLearnsDifferentBaselinesForEachEye() {
        val open = BlinkEyeSignal.fromClosedProbabilities(0.20, 0.10)!!
        val closed = BlinkEyeSignal.fromClosedProbabilities(0.80, 0.50)!!
        val tuned = BlinkParameterAutoCalibrator.tune(
            restSignals = List(30) { open },
            slowBlinkSignals = List(18) { open } + List(12) { closed },
            frameIntervalsMs = List(30) { 100L }
        )

        assertEquals(0.20, tuned.leftOpenBaseline, 0.0001)
        assertEquals(0.80, tuned.leftClosedBaseline, 0.0001)
        assertEquals(0.10, tuned.rightOpenBaseline, 0.0001)
        assertEquals(0.50, tuned.rightClosedBaseline, 0.0001)
        val normalizedClosed = tuned.normalizeSignal(closed)
        assertEquals(1.0, normalizedClosed.leftClosedScore, 0.0001)
        assertEquals(1.0, normalizedClosed.rightClosedScore, 0.0001)
    }
}
