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
    fun asymmetricOpenEyesRearmAfterStatisticalConfirmationWithoutSecondBaselineDelay() {
        val classifier = BlinkGestureClassifier()

        classifier.onSignal(0.1, 0, LongBlinkMs, 0.01)
        classifier.onSignal(0.1, 400, LongBlinkMs, 0.01)
        classifier.onSignal(0.9, 500, LongBlinkMs, 0.9)
        classifier.onSignal(0.9, 700, LongBlinkMs, 0.9)
        classifier.onSignal(0.9, 900, LongBlinkMs, 0.9)
        val activation = classifier.onSignal(0.9, 1400, LongBlinkMs, 0.9)
        assertEquals(1, activation.filterIsInstance<BlinkGestureClassifier.Event.Activated>().size)

        classifier.onSignal(0.393, 1600, LongBlinkMs, 0.266)
        classifier.onSignal(0.271, 1782, LongBlinkMs, 0.007)
        classifier.onSignal(0.271, 1850, LongBlinkMs, 0.007)

        assertTrue(classifier.onSignal(0.9, 1900, LongBlinkMs, 0.9).isEmpty())
        assertTrue(classifier.onSignal(0.9, 2060, LongBlinkMs, 0.9).isEmpty())
        val next = classifier.onSignal(0.9, 2220, LongBlinkMs, 0.9)
        assertEquals(1, next.filterIsInstance<BlinkGestureClassifier.Event.HoldStarted>().size)
    }

    @Test
    fun ambiguousFrameBetweenOpenFramesDoesNotRestartRearmTimer() {
        val classifier = BlinkGestureClassifier()

        classifier.onSignal(0.1, 0, LongBlinkMs)
        classifier.onSignal(0.1, 400, LongBlinkMs)
        classifier.onSignal(0.9, 500, LongBlinkMs)
        classifier.onSignal(0.9, 700, LongBlinkMs)
        classifier.onSignal(0.9, 900, LongBlinkMs)
        classifier.onSignal(0.9, 1400, LongBlinkMs)

        classifier.onSignal(0.3, 1600, LongBlinkMs, 0.2)
        classifier.onSignal(0.45, 1700, LongBlinkMs, 0.45)
        classifier.onSignal(0.3, 1800, LongBlinkMs, 0.2)
        classifier.onSignal(0.3, 1880, LongBlinkMs, 0.2)

        assertTrue(classifier.onSignal(0.9, 1960, LongBlinkMs).isEmpty())
        assertTrue(classifier.onSignal(0.9, 2120, LongBlinkMs).isEmpty())
        val next = classifier.onSignal(0.9, 2280, LongBlinkMs)
        assertEquals(1, next.filterIsInstance<BlinkGestureClassifier.Event.HoldStarted>().size)
    }

    @Test
    fun oneFalseOpenFrameDoesNotEndHold() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.1, 900, LongBlinkMs)
        events += classifier.onSignal(0.9, 960, LongBlinkMs)
        events += classifier.onSignal(0.9, 1340, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun twoFalseOpenFramesWithinFiveDoNotEndHold() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.1, 900, LongBlinkMs)
        events += classifier.onSignal(0.1, 1020, LongBlinkMs)
        events += classifier.onSignal(0.9, 1140, LongBlinkMs)
        events += classifier.onSignal(0.9, 1340, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun fifteenFpsLongHoldSurvivesDistributedFalseNegatives() {
        val classifier = BlinkGestureClassifier()
        val events = mutableListOf<BlinkGestureClassifier.Event>()
        events += armOpen(classifier, 0)

        repeat(20) { frame ->
            val falseNegative = frame == 5 || frame == 11 || frame == 16
            val score = if (falseNegative) 0.1 else 0.9
            events += classifier.onSignal(score, 500L + frame * 67L, 1200L, score)
        }

        assertEquals(1, events.filterIsInstance<BlinkGestureClassifier.Event.HoldStarted>().size)
        assertEquals(1, events.filterIsInstance<BlinkGestureClassifier.Event.Activated>().size)
        assertTrue(events.none { it is BlinkGestureClassifier.Event.HoldEnded })
    }

    @Test
    fun repeatedFalsePositiveBurstsAtFifteenFpsNeverActivateOpenEyes() {
        val classifier = BlinkGestureClassifier()
        val events = mutableListOf<BlinkGestureClassifier.Event>()
        events += armOpen(classifier, 0)

        repeat(450) { frame ->
            val positionInBurst = frame % 90
            val falsePositive = positionInBurst in 0..2
            val score = if (falsePositive) 0.9 else 0.1
            events += classifier.onSignal(score, 500L + frame * 67L, 1200L, score)
        }

        assertTrue(events.any { it is BlinkGestureClassifier.Event.HoldStarted })
        assertTrue(events.any { it is BlinkGestureClassifier.Event.HoldEnded })
        assertTrue(events.none { it is BlinkGestureClassifier.Event.Activated })
    }

    @Test
    fun oneClosedSpikeDoesNotStartHold() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.1, 560, LongBlinkMs)
        events += classifier.onSignal(0.1, 620, LongBlinkMs)
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
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.1, 860, LongBlinkMs)
        events += classifier.onSignal(0.1, 980, LongBlinkMs)
        events += classifier.onSignal(0.1, 1100, LongBlinkMs)

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
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.9, 1350, LongBlinkMs)
        events += classifier.onSignal(0.9, 1800, LongBlinkMs)
        events += classifier.onSignal(0.1, 1900, LongBlinkMs)
        events += classifier.onSignal(0.1, 2020, LongBlinkMs)
        events += classifier.onSignal(0.1, 2150, LongBlinkMs)
        events += armOpen(classifier, 2160)
        events += classifier.onSignal(0.9, 2660, LongBlinkMs)
        events += classifier.onSignal(0.9, 2800, LongBlinkMs)
        events += classifier.onSignal(0.9, 2940, LongBlinkMs)
        events += classifier.onSignal(0.9, 3510, LongBlinkMs)

        assertEquals(2, events.filterIsInstance<BlinkGestureClassifier.Event.Activated>().size)
    }

    @Test
    fun activatedHoldEmitsHoldEndAfterReopenWithinCommonScanStep() {
        val classifier = BlinkGestureClassifier()
        val events = mutableListOf<BlinkGestureClassifier.Event>()
        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, 800L)
        events += classifier.onSignal(0.9, 600, 800L)
        events += classifier.onSignal(0.9, 700, 800L)
        events += classifier.onSignal(0.9, 1300, 800L)

        val reopenedAtMs = 1700L
        events += classifier.onSignal(0.1, reopenedAtMs, 800L)
        events += classifier.onSignal(0.1, reopenedAtMs + 67L, 800L)
        events += classifier.onSignal(0.1, reopenedAtMs + 134L, 800L)
        events += classifier.onSignal(0.1, reopenedAtMs + 201L, 800L)

        assertEquals(
            listOf("HoldStarted", "Activated", "HoldEnded"),
            events.map { it.nameForTest() }
        )
        assertEquals(
            BlinkGestureClassifier.EndReason.Opened,
            events.filterIsInstance<BlinkGestureClassifier.Event.HoldEnded>().single().reason
        )
        assertTrue(201L < MinimumConfiguredScanIntervalMs)
    }

    @Test
    fun activatedHoldRecoversFromContinuousSignalLossBeforeHoldToAdvanceDelay() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()
        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.9, 1340, LongBlinkMs)
        events += classifier.onSignal(null, 1400, LongBlinkMs)
        events += classifier.onSignal(null, 2100, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated", "HoldEnded"),
            events.map { it.nameForTest() }
        )
        assertEquals(
            BlinkGestureClassifier.EndReason.SignalLost,
            events.filterIsInstance<BlinkGestureClassifier.Event.HoldEnded>().single().reason
        )
        assertTrue(config.signalLostCancelMs < HoldToAdvanceDelayMs)
    }

    @Test
    fun briefSignalLossDoesNotBreakLongBlink() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(null, 800, LongBlinkMs)
        events += classifier.onSignal(null, 1100, LongBlinkMs)
        events += classifier.onSignal(0.9, 1350, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun briefHysteresisBandDoesNotBreakConfirmedClosedHold() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.45, 1000, LongBlinkMs)
        events += classifier.onSignal(0.9, 1100, LongBlinkMs)
        events += classifier.onSignal(0.9, 1450, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "Activated"),
            events.map { it.nameForTest() }
        )
    }

    @Test
    fun sustainedBelowThresholdFramesEndHoldWithoutActivation() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.45, 1000, LongBlinkMs)
        events += classifier.onSignal(0.45, 1230, LongBlinkMs)
        events += classifier.onSignal(0.45, 1500, LongBlinkMs)

        assertEquals(listOf("HoldStarted", "HoldEnded"), events.map { it.nameForTest() })
        assertEquals(
            BlinkGestureClassifier.EndReason.WeakClosure,
            events.filterIsInstance<BlinkGestureClassifier.Event.HoldEnded>().single().reason
        )
    }

    @Test
    fun openEvidenceAtDeadlineResolvesBeforeActivation() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
        events += classifier.onSignal(0.1, 1260, LongBlinkMs)
        events += classifier.onSignal(0.1, 1400, LongBlinkMs)
        events += classifier.onSignal(0.1, 1580, LongBlinkMs)

        assertEquals(
            listOf("HoldStarted", "HoldEnded"),
            events.map { it.nameForTest() }
        )
        assertTrue(events.none { it is BlinkGestureClassifier.Event.Activated })
    }

    @Test
    fun longSignalLossCancelsHoldWithoutActivation() {
        val classifier = BlinkGestureClassifier(config)
        val events = mutableListOf<BlinkGestureClassifier.Event>()

        events += armOpen(classifier, 0)
        events += classifier.onSignal(0.9, 500, LongBlinkMs)
        events += classifier.onSignal(0.9, 640, LongBlinkMs)
        events += classifier.onSignal(0.9, 780, LongBlinkMs)
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

    private companion object {
        const val LongBlinkMs = 800L
        const val MinimumConfiguredScanIntervalMs = 300L
        const val HoldToAdvanceDelayMs = 1000L
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
