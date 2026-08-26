package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CheekCalibrationSessionTest {
    @Test
    fun restCollectionMovesToUnlabeledCaptureWithoutAnActivation() {
        val session = CheekCalibrationSession(requiredNeutralFrames = 3)
        session.start()

        session.observe(sample(0.10), detectorReady = false)
        session.observe(sample(0.10), detectorReady = true)
        val ready = session.observe(sample(0.10), detectorReady = true)

        assertTrue(session.active)
        assertTrue(ready is CheekCalibrationUpdate.RestProgress)
        assertTrue((ready as CheekCalibrationUpdate.RestProgress).readyForMovement)
        assertEquals(3, ready.collectedFrames)
    }

    @Test
    fun captureIsEvaluatedOnlyAtTheConfiguredCadence() {
        val session = CheekCalibrationSession(
            requiredNeutralFrames = 1,
            evaluationIntervalFrames = 3
        )
        session.start()
        session.observe(sample(0.10), detectorReady = true)

        assertTrue(session.observe(sample(0.20), true) is CheekCalibrationUpdate.CapturePending)
        assertTrue(session.observe(sample(0.21), true) is CheekCalibrationUpdate.CapturePending)
        assertTrue(session.observe(sample(0.22), true) is CheekCalibrationUpdate.Evaluated)
    }

    @Test
    fun resetAndCompleteMakeFurtherSamplesInactive() {
        val session = CheekCalibrationSession(requiredNeutralFrames = 1)
        session.start()
        session.reset()
        assertFalse(session.active)
        assertTrue(session.observe(sample(0.10), true) is CheekCalibrationUpdate.Inactive)

        session.start()
        session.complete()
        assertFalse(session.active)
        assertTrue(session.observe(sample(0.10), true) is CheekCalibrationUpdate.Inactive)
    }

    private fun sample(value: Double) = mapOf(
        "cheekSquintLeft" to value,
        "mouthDimpleLeft" to value
    )
}
