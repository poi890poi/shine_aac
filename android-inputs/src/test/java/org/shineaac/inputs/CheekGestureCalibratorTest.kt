package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CheekGestureCalibratorTest {
    @Test
    fun learnsConsistentPersonalCheekSignalAndNeverUsesBlinkFeatures() {
        val calibrator = CheekGestureCalibrator()
        repeat(80) { frame ->
            calibrator.addNeutral(mapOf(
                "cheekSquintLeft" to (0.10 + (frame % 5) * 0.002),
                "mouthDimpleLeft" to (0.08 + (frame % 3) * 0.002),
                "cheekSquintRight" to 0.09,
                "eyeBlinkLeft" to if (frame % 20 == 0) 0.95 else 0.02
            ))
        }
        repeat(6) { trial -> repeat(12) { frame ->
            calibrator.addActive(trial, mapOf(
                "cheekSquintLeft" to (0.58 + frame * 0.004),
                "mouthDimpleLeft" to (0.42 + frame * 0.003),
                "cheekSquintRight" to 0.10,
                "eyeBlinkLeft" to 0.98
            ))
        } }

        val outcome = calibrator.build()
        assertTrue(outcome is CheekCalibrationOutcome.Success)
        val model = (outcome as CheekCalibrationOutcome.Success).model
        assertEquals(CheekSide.Left, model.inferredSide)
        assertTrue("eyeBlinkLeft" !in model.featureNames)
        assertTrue(model.score(mapOf("cheekSquintLeft" to 0.62, "mouthDimpleLeft" to 0.45)) >= model.enterThreshold)
        assertTrue(model.score(mapOf("cheekSquintLeft" to 0.10, "mouthDimpleLeft" to 0.08)) <= model.exitThreshold)
    }

    @Test
    fun failsClosedWhenMovementLooksLikeRest() {
        val calibrator = CheekGestureCalibrator()
        repeat(60) { calibrator.addNeutral(mapOf("cheekSquintLeft" to 0.10)) }
        repeat(6) { trial -> repeat(8) { calibrator.addActive(trial, mapOf("cheekSquintLeft" to 0.10)) } }
        assertTrue(calibrator.build() is CheekCalibrationOutcome.Failure)
    }

    @Test
    fun registrationClustersUnknownPeriodAndKeepsStrongestFewFrames() {
        val scores = listOf(0.17, 0.19, 0.21, 0.34, 0.39, 0.46, 0.44, 0.41, 0.22, 0.18)
        val period = scores.mapIndexed { index, score ->
            ScoredCheekCalibrationFrame(mapOf("cheekSquintLeft" to index / 10.0), score)
        }
        val selected = selectCheekCalibrationPositiveFrames(period, maximumSamples = 4)

        assertEquals(listOf(0.46, 0.44, 0.41, 0.39), selected.map { it.score })
        assertTrue(selected.maxOf { it.score } < CheekTwitchDetector.DefaultEnterThreshold)
    }

    @Test
    fun registrationRejectsPeriodsWithoutASeparatedActiveCluster() {
        val period = listOf(0.18, 0.19, 0.20, 0.19, 0.21, 0.20).map {
            ScoredCheekCalibrationFrame(mapOf("cheekSquintLeft" to it), it)
        }
        assertTrue(selectCheekCalibrationPositiveFrames(period).isEmpty())
    }
}
