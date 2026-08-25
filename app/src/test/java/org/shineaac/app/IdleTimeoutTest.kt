package org.shineaac.app

import org.junit.Assert.assertEquals
import org.junit.Test

class IdleTimeoutTest {
    @Test
    fun acceptsOnlySupportedTimeouts() {
        assertEquals(0, normalizedIdleTimeoutMinutes(null))
        assertEquals(0, normalizedIdleTimeoutMinutes(0))
        assertEquals(1, normalizedIdleTimeoutMinutes(1))
        assertEquals(5, normalizedIdleTimeoutMinutes("5"))
        assertEquals(15, normalizedIdleTimeoutMinutes(15.0))
        assertEquals(30, normalizedIdleTimeoutMinutes("30"))
    }

    @Test
    fun fallsBackToOffForInvalidValues() {
        assertEquals(0, normalizedIdleTimeoutMinutes(-1))
        assertEquals(0, normalizedIdleTimeoutMinutes(2))
        assertEquals(0, normalizedIdleTimeoutMinutes(60))
        assertEquals(0, normalizedIdleTimeoutMinutes("later"))
    }
}
