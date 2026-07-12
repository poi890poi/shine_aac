package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkGestureClassifierTest {
    private val config = BlinkGestureClassifier.Config(
        closeThreshold = 0.78,
        openThreshold = 0.28,
        minClosedStableMs = 120,
        openStableMs = 220,
        signalLostCancelMs = 700
    )

    @Test
    fun oneOpenFrameDoesNotBreakLongBlink() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.9, 140, LongBlinkMs)
        events += classifier.onSignal(0.1, 300, LongBlinkMs)
        events += classifier.onSignal(0.9, 360, LongBlinkMs)
        events += classifier.onSignal(0.9, 840, LongBlinkMs)

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

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.1, 60, LongBlinkMs)
        events += classifier.onSignal(0.1, 300, LongBlinkMs)

        assertTrue(events.isEmpty())
    }

    @Test
    fun shortBlinkEndsWithoutActivationAfterStableOpen() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.9, 140, LongBlinkMs)
        events += classifier.onSignal(0.1, 260, LongBlinkMs)
        events += classifier.onSignal(0.1, 500, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "HoldEnded"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun activationDoesNotRepeatBeforeStableOpen() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.9, 140, LongBlinkMs)
        events += classifier.onSignal(0.9, 850, LongBlinkMs)
        events += classifier.onSignal(0.9, 1300, LongBlinkMs)
        events += classifier.onSignal(0.1, 1400, LongBlinkMs)
        events += classifier.onSignal(0.1, 1650, LongBlinkMs)
        events += classifier.onSignal(0.9, 1800, LongBlinkMs)
        events += classifier.onSignal(0.9, 1940, LongBlinkMs)
        events += classifier.onSignal(0.9, 2650, LongBlinkMs)

        assertEquals(2, events.filterIsInstance<BlinkGestureClassifier.Event.Activated>().size)
    }

    @Test
    fun briefSignalLossDoesNotBreakLongBlink() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.9, 140, LongBlinkMs)
        events += classifier.onSignal(null, 300, LongBlinkMs)
        events += classifier.onSignal(null, 600, LongBlinkMs)
        events += classifier.onSignal(0.9, 850, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun longSignalLossCancelsHoldWithoutActivation() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += classifier.onSignal(0.9, 0, LongBlinkMs)
        events += classifier.onSignal(0.9, 140, LongBlinkMs)
        events += classifier.onSignal(null, 300, LongBlinkMs)
        events += classifier.onSignal(null, 1050, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "HoldEnded"),
            events.map { it.nameForTest() }
        )
        val end = events.filterIsInstance<BlinkGestureClassifier.Event.HoldEnded>().single()
        assertEquals(BlinkGestureClassifier.EndReason.SignalLost, end.reason)
    }

    private companion object {
        const val LongBlinkMs = 800L
    }
}

private fun BlinkGestureClassifier.Event.nameForTest(): String =
    when (this) {
        is BlinkGestureClassifier.Event.HoldStarted -> "HoldStarted"
        is BlinkGestureClassifier.Event.Activated -> "Activated"
        is BlinkGestureClassifier.Event.HoldEnded -> "HoldEnded"
    }
