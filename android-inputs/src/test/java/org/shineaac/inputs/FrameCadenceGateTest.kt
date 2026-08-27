package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FrameCadenceGateTest {
    @Test
    fun phaseLockedGateKeepsTenFpsFromFifteenFpsCamera() {
        val gate = FrameCadenceGate()
        val cameraTimestamps = (0L..14L).map { frame -> frame * 1_000L / 15L }

        val accepted = cameraTimestamps.filter { gate.shouldAnalyze(it, 100L) }

        assertEquals(
            listOf(0L, 133L, 200L, 333L, 400L, 533L, 600L, 733L, 800L, 933L),
            accepted
        )
    }

    @Test
    fun ordinaryFifteenFpsDeliveryDoesNotInventMissingAnalysisSlots() {
        val gate = FrameCadenceGate()
        val cameraTimestamps = (0L..14L).map { frame -> frame * 1_000L / 15L }

        val decisions = cameraTimestamps.map { gate.decision(it, 100L) }

        assertTrue(decisions.filter { it.shouldAnalyze }.all { it.missedAnalysisSlots == 0 })
    }

    @Test
    fun delayedFrameReportsMissedPhaseLockedAnalysisSlots() {
        val gate = FrameCadenceGate()
        assertTrue(gate.decision(0L, 100L).shouldAnalyze)

        val delayed = gate.decision(600L, 100L)

        assertTrue(delayed.shouldAnalyze)
        assertEquals(5, delayed.missedAnalysisSlots)
        assertEquals(100L, delayed.firstMissedAtMs)
        assertEquals(600L, delayed.observedAtMs)
        assertEquals(
            listOf(100L, 200L, 300L, 400L, 500L),
            missingObservationTimestamps(delayed)
        )
    }

    @Test
    fun longGapKeepsFirstAndRecentUnknownTimestamps() {
        val gate = FrameCadenceGate()
        gate.decision(0L, 100L)

        val delayed = gate.decision(1_000L, 100L)

        assertEquals(9, delayed.missedAnalysisSlots)
        assertEquals(
            listOf(100L, 600L, 700L, 800L, 900L),
            missingObservationTimestamps(delayed)
        )
        assertTrue(resumedAfterSignalLossTimeout(delayed, 700L))
    }

    @Test
    fun shortGapDoesNotTriggerSignalLossAtResume() {
        val gate = FrameCadenceGate()
        gate.decision(0L, 100L)

        val delayed = gate.decision(600L, 100L)

        assertFalse(resumedAfterSignalLossTimeout(delayed, 700L))
    }

    @Test
    fun idleGateKeepsFiveFpsFromFifteenFpsCamera() {
        val gate = FrameCadenceGate()
        val cameraTimestamps = (0L..14L).map { frame -> frame * 1_000L / 15L }

        val accepted = cameraTimestamps.filter { gate.shouldAnalyze(it, 200L) }

        assertEquals(listOf(0L, 200L, 400L, 600L, 800L), accepted)
    }

    @Test
    fun cameraTimestampRestartResetsDeadline() {
        val gate = FrameCadenceGate()
        assertTrue(gate.shouldAnalyze(1_000L, 100L))
        assertFalse(gate.shouldAnalyze(1_050L, 100L))

        assertTrue(gate.shouldAnalyze(20L, 100L))
        assertFalse(gate.shouldAnalyze(70L, 100L))
    }

    @Test
    fun intervalChangeStartsNewCadenceImmediately() {
        val gate = FrameCadenceGate()
        assertTrue(gate.shouldAnalyze(0L, 100L))
        assertFalse(gate.shouldAnalyze(67L, 100L))

        assertTrue(gate.shouldAnalyze(68L, 200L))
        assertFalse(gate.shouldAnalyze(200L, 200L))
    }

    @Test
    fun zeroIntervalAcceptsEveryFrame() {
        val gate = FrameCadenceGate()
        assertTrue(gate.shouldAnalyze(1L, 0L))
        assertTrue(gate.shouldAnalyze(1L, 0L))
        assertTrue(gate.shouldAnalyze(2L, 0L))
    }

    @Test
    fun cameraTimestampUsesMonotonicFallbackOnlyWhenMissing() {
        assertEquals(1_234L, cameraFrameTimestampMs(1_234_999_999L, 88L))
        assertEquals(88L, cameraFrameTimestampMs(0L, 88L))
        assertEquals(88L, cameraFrameTimestampMs(-1L, 88L))
    }
}
