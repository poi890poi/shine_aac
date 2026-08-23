package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BinarySwitchClassifierTest {
    private val config = BinarySwitchClassifier.Config(
        0.65,
        0.32,
        minimumHoldMs = 180,
        requiredNeutralMs = 300
    )

    @Test
    fun activatesImmediatelyWhenHoldThresholdIsReachedThenRearms() {
        val classifier = BinarySwitchClassifier(config)

        classifier.onScore(0.1, 0)
        classifier.onScore(0.1, 350)

        assertTrue(classifier.onScore(0.8, 400).isEmpty())

        val activation = classifier.onScore(0.8, 590)
        assertEquals(
            1,
            activation.count { it is BinarySwitchClassifier.Event.HoldStarted }
        )
        assertEquals(
            1,
            activation.count { it is BinarySwitchClassifier.Event.Activated }
        )

        assertTrue(classifier.onScore(0.9, 700).isEmpty())
        assertTrue(
            classifier.onScore(0.1, 800).single()
                is BinarySwitchClassifier.Event.HoldEnded
        )

        classifier.onScore(0.8, 900)

        val secondActivation = classifier.onScore(0.8, 1100)
        assertEquals(
            1,
            secondActivation.count { it is BinarySwitchClassifier.Event.HoldStarted }
        )
        assertEquals(
            1,
            secondActivation.count { it is BinarySwitchClassifier.Event.Activated }
        )
    }

    @Test
    fun shortMotionDoesNotActivate() {
        val classifier = BinarySwitchClassifier(config)

        classifier.onScore(0.1, 0)
        classifier.onScore(0.1, 350)
        classifier.onScore(0.9, 400)

        assertTrue(classifier.onScore(0.1, 500).isEmpty())
    }
}
