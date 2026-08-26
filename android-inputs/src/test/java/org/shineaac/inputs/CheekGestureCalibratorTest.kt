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
    fun unlabeledCaptureFindsOneClearMovementWithoutRuntimeRegistration() {
        val neutral = List(48) { frame ->
            mapOf(
                "cheekSquintLeft" to (0.10 + (frame % 3) * 0.002),
                "mouthDimpleLeft" to (0.08 + (frame % 2) * 0.002)
            )
        }
        val relaxed = List(4) { mapOf("cheekSquintLeft" to 0.10, "mouthDimpleLeft" to 0.08) }
        val movement = List(6) { frame ->
            mapOf(
                "cheekSquintLeft" to (0.22 + frame * 0.004),
                "mouthDimpleLeft" to (0.18 + frame * 0.003)
            )
        }

        val attempt = buildCheekCalibrationFromUnlabeledSamples(
            neutral,
            relaxed + movement + relaxed
        )

        assertTrue(attempt.outcome is CheekCalibrationOutcome.Success)
        assertEquals(6, attempt.positiveFrameCount)
        val model = (attempt.outcome as CheekCalibrationOutcome.Success).model
        assertEquals(1, model.quality.activeTrialCount)
        assertTrue(model.score(movement.last()) >= model.enterThreshold)
    }

    @Test
    fun unlabeledCaptureRejectsRestOnlyFrames() {
        val neutral = List(48) { frame ->
            mapOf("cheekSquintLeft" to (0.10 + (frame % 4) * 0.002))
        }
        val capture = List(30) { frame ->
            mapOf("cheekSquintLeft" to (0.10 + (frame % 3) * 0.002))
        }

        val attempt = buildCheekCalibrationFromUnlabeledSamples(neutral, capture)

        assertEquals(0, attempt.positiveFrameCount)
        assertTrue(attempt.outcome == null)
    }

    @Test
    fun unlabeledCaptureLearnsAConsistentDownwardMovement() {
        val neutral = List(48) { frame ->
            mapOf(
                "mouthPressRight" to (0.42 + (frame % 3) * 0.002),
                "mouthFrownRight" to (0.38 + (frame % 2) * 0.002)
            )
        }
        val relaxed = List(5) { mapOf("mouthPressRight" to 0.42, "mouthFrownRight" to 0.38) }
        val movement = List(7) { frame ->
            mapOf(
                "mouthPressRight" to (0.24 - frame * 0.003),
                "mouthFrownRight" to (0.23 - frame * 0.002)
            )
        }

        val attempt = buildCheekCalibrationFromUnlabeledSamples(
            neutral,
            relaxed + movement + relaxed
        )

        assertTrue(attempt.outcome is CheekCalibrationOutcome.Success)
        val model = (attempt.outcome as CheekCalibrationOutcome.Success).model
        assertEquals(CheekSide.Right, model.inferredSide)
        assertTrue(model.weights.any { it < 0.0 })
    }
}
