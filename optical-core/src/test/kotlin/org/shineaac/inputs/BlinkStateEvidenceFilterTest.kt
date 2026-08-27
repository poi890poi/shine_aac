package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkStateEvidenceFilterTest {
    @Test
    fun defaultsDeriveThreeVotesFromNinetySevenPercentFrames() {
        val config = BlinkStateEvidenceFilter.Config()

        assertEquals(3, config.requiredVotes())
        assertEquals(0.0002579958, config.transitionErrorProbability(), 0.0000000001)
    }

    @Test
    fun oneOrTwoFalsePositiveFramesDoNotCloseOpenEyes() {
        val filter = BlinkStateEvidenceFilter()

        assertFalse(filter.observe(closed, 0, 0).changed)
        assertFalse(filter.observe(open, 67, 0).changed)
        assertFalse(filter.observe(closed, 134, 0).changed)
        assertFalse(filter.observe(open, 201, 0).changed)
        assertEquals(BlinkStateEvidenceFilter.EyeState.Open, filter.state)
    }

    @Test
    fun threeClosedVotesWithinFiveFramesConfirmClosure() {
        val filter = BlinkStateEvidenceFilter()

        filter.observe(closed, 0, 120)
        filter.observe(open, 67, 120)
        filter.observe(closed, 134, 120)
        filter.observe(open, 201, 120)
        val update = filter.observe(closed, 268, 120)

        assertTrue(update.changed)
        assertEquals(BlinkStateEvidenceFilter.EyeState.Closed, update.state)
        assertEquals(0L, update.transitionStartedAtMs)
    }

    @Test
    fun oneOrTwoFalseNegativeFramesDoNotReopenClosedEyes() {
        val filter = BlinkStateEvidenceFilter(initialState = BlinkStateEvidenceFilter.EyeState.Closed)

        filter.observe(open, 0, 0)
        filter.observe(closed, 67, 0)
        filter.observe(open, 134, 0)
        filter.observe(closed, 201, 0)

        assertEquals(BlinkStateEvidenceFilter.EyeState.Closed, filter.state)
    }

    @Test
    fun ambiguousFramesConsumeWindowWithoutVoting() {
        val filter = BlinkStateEvidenceFilter()

        filter.observe(closed, 0, 0)
        filter.observe(closed, 67, 0)
        repeat(5) { index -> filter.observe(ambiguous, 134L + index * 67L, 0) }
        val update = filter.observe(closed, 500, 0)

        assertFalse(update.changed)
        assertEquals(1, update.contraryVotes)
    }

    private companion object {
        val open = BlinkStateEvidenceFilter.Observation.Open
        val closed = BlinkStateEvidenceFilter.Observation.Closed
        val ambiguous = BlinkStateEvidenceFilter.Observation.Ambiguous
    }
}
