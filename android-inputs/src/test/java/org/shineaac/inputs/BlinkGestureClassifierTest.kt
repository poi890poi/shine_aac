package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkGestureClassifierTest {
    private val config = BlinkGestureClassifier.Config(
        closeThreshold = 0.78,
        openThreshold = 0.28,
        requiredOpenBeforeCloseMs = 350,
        minClosedStableMs = 120,
        openStableMs = 220,
        signalLostCancelMs = 700
    )

    @Test
    fun defaultThresholdsMatchCameraCalibration() {
        val classifier = BlinkGestureClassifier()

        assertEquals("Open", classifier.diagnosticSnapshot(0.35).signalBand)
        assertEquals("Ambiguous", classifier.diagnosticSnapshot(0.45).signalBand)
        assertEquals("Closed", classifier.diagnosticSnapshot(0.55).signalBand)
    }

    @Test
    fun asymmetricOpenEyesRearmInTwoFramesWithoutSecondBaselineDelay() {
        val classifier = BlinkGestureClassifier()

        classifier.onSignal(0.1, 0, LongBlinkMs, 0.01)
        classifier.onSignal(0.1, 400, LongBlinkMs, 0.01)
        classifier.onSignal(0.9, 500, LongBlinkMs, 0.9)
        classifier.onSignal(0.9, 700, LongBlinkMs, 0.9)
        val activation = classifier.onSignal(0.9, 1400, LongBlinkMs, 0.9)
        assertEquals(1, activation.filterIsInstance<BlinkGestureClassifier.Event.Activated>().size)

        // Mirrors the device trace: the average is ambiguous because one eye is
        // underestimated, while the more-open eye is a clear reopen signal.
        classifier.onSignal(0.393, 1600, LongBlinkMs, 0.266)
        classifier.onSignal(0.271, 1782, LongBlinkMs, 0.007)

        val rearmed = classifier.diagnosticSnapshot(0.271, 0.007)
        assertEquals("Open", rearmed.state)
        assertTrue(rearmed.hasOpenBaseline)

        assertTrue(classifier.onSignal(0.9, 1900, LongBlinkMs, 0.9).isEmpty())
        val next = classifier.onSignal(0.9, 2060, LongBlinkMs, 0.9)
        assertEquals(1, next.filterIsInstance<BlinkGestureClassifier.Event.HoldStarted>().size)
    }

    @Test
    fun ambiguousFrameBetweenOpenFramesDoesNotRestartRearmTimer() {
        val classifier = BlinkGestureClassifier()

        classifier.onSignal(0.1, 0, LongBlinkMs)
        classifier.onSignal(0.1, 400, LongBlinkMs)
        classifier.onSignal(0.9, 500, LongBlinkMs)
        classifier.onSignal(0.9, 700, LongBlinkMs)
        classifier.onSignal(0.9, 1400, LongBlinkMs)

        classifier.onSignal(0.3, 1600, LongBlinkMs, 0.2)
        classifier.onSignal(0.45, 1700, LongBlinkMs, 0.45)
        classifier.onSignal(0.3, 1800, LongBlinkMs, 0.2)

        assertEquals("Open", classifier.diagnosticSnapshot(0.3, 0.2).state)
        assertTrue(classifier.diagnosticSnapshot(0.3, 0.2).hasOpenBaseline)
    }

    @Test
    fun oneOpenFrameDoesNotBreakLongBlink() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.1, 800, LongBlinkMs)
        events += classifier.onSignal(0.9, 860, LongBlinkMs)
        events += classifier.onSignal(0.9, 1340, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
        val activation = events.filterIsInstance<BlinkGestureClassifier.Event.Activated>().single()
        assertTrue(activation.durationMs >= LongBlinkMs)
    }

    @Test
    fun oneClosedSpikeDoesNotStartHold() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.1, 560, LongBlinkMs)
        events += classifier.onSignal(0.1, 800, LongBlinkMs)

        assertTrue(events.isEmpty())
    }

    @Test
    fun shortBlinkEndsWithoutActivationAfterStableOpen() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.1, 760, LongBlinkMs)
        events += classifier.onSignal(0.1, 1000, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "HoldEnded"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun activationDoesNotRepeatBeforeStableOpen() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 1350, LongBlinkMs)
        events += classifier.onSignal(0.9, 1800, LongBlinkMs)
        events += classifier.onSignal(0.1, 1900, LongBlinkMs)
        events += classifier.onSignal(0.1, 2150, LongBlinkMs)
        events += armOpen(classifier, 2160)
        events += classifier.onSignal(0.9, 2660, LongBlinkMs)
        events += classifier.onSignal(0.9, 2800, LongBlinkMs)
        events += classifier.onSignal(0.9, 3510, LongBlinkMs)

        assertEquals(2, events.filterIsInstance<BlinkGestureClassifier.Event.Activated>().size)
    }

    @Test
    fun briefSignalLossDoesNotBreakLongBlink() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(null, 800, LongBlinkMs)
        events += classifier.onSignal(null, 1100, LongBlinkMs)
        events += classifier.onSignal(0.9, 1350, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun longSignalLossCancelsHoldWithoutActivation() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(null, 800, LongBlinkMs)
        events += classifier.onSignal(null, 1550, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "HoldEnded"),
            events.map { it.nameForTest() }
        )
        val end = events.filterIsInstance<BlinkGestureClassifier.Event.HoldEnded>().single()
        assertEquals(BlinkGestureClassifier.EndReason.SignalLost, end.reason)
    }

    @Test
    fun closedSignalBeforeStableOpenDoesNotActivate() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.9, 200, LongBlinkMs)
        events += classifier.onSignal(0.9, 900, LongBlinkMs)

        assertTrue(events.isEmpty())
    }

    @Test
    fun ambiguousSignalAfterActivationLeavesClassifierWaitingForOpen() {
        val classifier = BlinkGestureClassifier(config)

        armOpen(classifier, 0)
        classifier.onSignal(0.9, 500, LongBlinkMs)
        classifier.onSignal(0.9, 640, LongBlinkMs)
        classifier.onSignal(0.9, 1350, LongBlinkMs)

        for (now in 1550L..9550L step 200L) {
            assertTrue(classifier.onSignal(0.5, now, LongBlinkMs).isEmpty())
        }

        val snapshot = classifier.diagnosticSnapshot(0.5)
        assertEquals("ActivatedWaitOpen", snapshot.state)
        assertEquals("Ambiguous", snapshot.signalBand)
    }

    @Test
    fun missingSignalAfterActivationAlsoLeavesClassifierWaitingForOpen() {
        val classifier = BlinkGestureClassifier(config)

        armOpen(classifier, 0)
        classifier.onSignal(0.9, 500, LongBlinkMs)
        classifier.onSignal(0.9, 640, LongBlinkMs)
        classifier.onSignal(0.9, 1350, LongBlinkMs)

        classifier.onSignal(null, 2200, LongBlinkMs)
        classifier.onSignal(null, 5200, LongBlinkMs)

        val snapshot = classifier.diagnosticSnapshot(null)
        assertEquals("ActivatedWaitOpen", snapshot.state)
        assertEquals("Missing", snapshot.signalBand)
    }

    private companion object {
        const val LongBlinkMs = 800L
    }
}

private fun armOpen(classifier: BlinkGestureClassifier, startMs: Long): List<BlinkGestureClassifier.Event> =
    classifier.onSignal(0.1, startMs, 800L) +
        classifier.onSignal(0.1, startMs + 400L, 800L)

private fun BlinkGestureClassifier.Event.nameForTest(): String =
    when (this) {
        is BlinkGestureClassifier.Event.HoldStarted -> "HoldStarted"
        is BlinkGestureClassifier.Event.Activated -> "Activated"
        is BlinkGestureClassifier.Event.HoldEnded -> "HoldEnded"
    }
