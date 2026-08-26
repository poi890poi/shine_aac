package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkCalibrationTraceAnalyzerTest {
    @Test
    fun learnedMediaPipeThresholdRecoversBlinksMissedByTheDefaultThreshold() {
        val open = BlinkEyeSignal(closedScore = 0.08, reopenScore = 0.04)
        val closed = BlinkEyeSignal(closedScore = 0.50, reopenScore = 0.48)
        val samples = buildList {
            var atMs = 0L
            repeat(3) {
                repeat(3) { add(TimedBlinkEyeSignal(atMs.also { atMs += 200L }, open)) }
                repeat(5) { add(TimedBlinkEyeSignal(atMs.also { atMs += 200L }, closed)) }
                add(TimedBlinkEyeSignal(atMs.also { atMs += 200L }, open))
            }
        }
        val rest = List(30) { open }
        val tuned = BlinkParameterAutoCalibrator.tune(
            restSignals = rest,
            slowBlinkSignals = samples.map { it.signal },
            frameIntervalsMs = List(samples.size) { 200L }
        )

        assertTrue(tuned.leftClosedBaseline > tuned.leftOpenBaseline)
        assertEquals(
            emptyList<Long>(),
            BlinkCalibrationTraceAnalyzer.closedDurations(
                samples,
                BlinkDetectionParameters()
            )
        )
        assertEquals(
            listOf(1_000L, 1_000L, 1_000L),
            BlinkCalibrationTraceAnalyzer.closedDurations(samples, tuned)
        )
    }

    @Test
    fun hysteresisKeepsAClosureThroughTheMiddleBand() {
        val parameters = BlinkDetectionParameters(
            closeThreshold = 0.48,
            reopenThreshold = 0.20
        )
        val samples = listOf(
            sample(0L, 0.05, 0.03),
            sample(200L, 0.52, 0.50),
            sample(500L, 0.35, 0.31),
            sample(900L, 0.41, 0.30),
            sample(1_200L, 0.08, 0.04)
        )

        assertEquals(
            listOf(1_000L),
            BlinkCalibrationTraceAnalyzer.closedDurations(samples, parameters)
        )
    }

    @Test
    fun aLongSignalGapCancelsAnIncompleteClosure() {
        val parameters = BlinkDetectionParameters(
            closeThreshold = 0.48,
            reopenThreshold = 0.20,
            signalLostCancelMs = 700L
        )
        val samples = listOf(
            sample(0L, 0.52, 0.50),
            sample(800L, 0.52, 0.50),
            sample(1_000L, 0.08, 0.04)
        )

        assertEquals(
            listOf(200L),
            BlinkCalibrationTraceAnalyzer.closedDurations(samples, parameters)
        )
    }

    private fun sample(
        timestampMs: Long,
        closedScore: Double,
        reopenScore: Double
    ) = TimedBlinkEyeSignal(
        timestampMs,
        BlinkEyeSignal(closedScore, reopenScore)
    )
}
