package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The resting and movement magnitudes here are taken from a real recorded session on a Pixel 4a 5G:
 * mouthPressRight rested at about 0.065 and peaked between 0.347 and 0.406 across six movements,
 * with mouthDimpleRight and mouthSmileRight moving with it.
 */
class CheekTwitchDetectorTest {
    @Test
    fun scoreIsWithheldUntilTheRestingFaceIsLearned() {
        val detector = CheekTwitchDetector(warmupFrames = 10)
        repeat(9) { index ->
            assertNull("frame $index should still be warming up", detector.observe(resting(index)))
        }
        assertNull(detector.observe(resting(9)))
        assertTrue(detector.ready)
        assertNotNull(detector.observe(resting(10)))
    }

    @Test
    fun warmupProgressReportsHowFarThroughTheRestIs() {
        val detector = CheekTwitchDetector(warmupFrames = 10)
        assertEquals(0f, detector.warmupProgress, 0.001f)
        repeat(5) { detector.observe(resting(it)) }
        assertEquals(0.5f, detector.warmupProgress, 0.001f)
    }

    @Test
    fun restingFaceStaysBelowTheExitThreshold() {
        val detector = warmed()
        repeat(20) { index ->
            val score = detector.observe(resting(index + 100))
            assertNotNull(score)
            assertTrue(
                "resting score $score should stay below the exit threshold",
                score!! < CheekTwitchDetector.DefaultExitThreshold
            )
        }
    }

    @Test
    fun aRecordedSizeTwitchCrossesTheEnterThreshold() {
        val detector = warmed()
        val score = detector.observe(twitch(1.0))
        assertNotNull(score)
        assertTrue(
            "twitch score $score should cross the enter threshold",
            score!! >= CheekTwitchDetector.DefaultEnterThreshold
        )
    }

    @Test
    fun aHeldTwitchDoesNotBecomeTheNewRestingFace() {
        val detector = warmed()
        // A movement held far longer than a real twitch must keep scoring as a movement, or the
        // switch would silently disarm itself while the user is still holding it.
        var last = 0.0
        repeat(40) {
            last = detector.observe(twitch(1.0)) ?: 0.0
        }
        assertTrue(
            "held twitch decayed to $last",
            last >= CheekTwitchDetector.DefaultEnterThreshold
        )
    }

    @Test
    fun halfStrengthMovementStillRegistersAsMovement() {
        val detector = warmed()
        val score = detector.observe(twitch(0.5))
        assertNotNull(score)
        assertTrue("half strength score $score should be clearly above rest", score!! > 0.35)
    }

    @Test
    fun gazeAndBrowChannelsCannotDriveTheScore() {
        val detector = warmed()
        // These were the highest raw separability channels in the recorded session, purely from gaze
        // drift. They are not candidate features, so they must not move the score at all.
        val distracted = resting(500) + mapOf(
            "eyeLookOutLeft" to 0.9,
            "eyeLookInRight" to 0.9,
            "browOuterUpLeft" to 0.9,
            "eyeBlinkRight" to 1.0
        )
        val score = detector.observe(distracted)
        assertNotNull(score)
        assertTrue(
            "gaze and brow movement produced $score",
            score!! < CheekTwitchDetector.DefaultExitThreshold
        )
    }

    private fun warmed(): CheekTwitchDetector {
        val detector = CheekTwitchDetector(warmupFrames = 24)
        repeat(24) { detector.observe(resting(it)) }
        return detector
    }

    /** Resting face with a small deterministic jitter, so the spread estimate is not degenerate. */
    private fun resting(index: Int): Map<String, Double> {
        val jitter = if (index % 2 == 0) 0.004 else -0.004
        return CheekFeatureSpace.names.associateWith { name ->
            when (name) {
                "mouthPressRight" -> 0.065 + jitter
                "mouthPressLeft" -> 0.060 - jitter
                "mouthDimpleRight" -> 0.007 + jitter / 2
                "mouthSmileRight" -> 0.000
                else -> 0.010 + jitter / 3
            }
        }
    }

    private fun twitch(strength: Double): Map<String, Double> {
        val base = resting(0).toMutableMap()
        base["mouthPressRight"] = 0.065 + 0.341 * strength
        base["mouthDimpleRight"] = 0.007 + 0.231 * strength
        base["mouthSmileRight"] = 0.000 + 0.205 * strength
        return base
    }
}
