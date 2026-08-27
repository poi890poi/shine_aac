package org.shineaac.app

import org.junit.Assert.assertEquals
import org.junit.Test

class IdleTimeoutTest {
    @Test
    fun acceptsOnlySupportedTimeouts() {
        assertEquals(5, normalizedIdleTimeoutMinutes(null))
        assertEquals(0, normalizedIdleTimeoutMinutes(0))
        assertEquals(1, normalizedIdleTimeoutMinutes(1))
        assertEquals(5, normalizedIdleTimeoutMinutes("5"))
        assertEquals(15, normalizedIdleTimeoutMinutes(15.0))
        assertEquals(30, normalizedIdleTimeoutMinutes("30"))
    }

    @Test
    fun fallsBackToDefaultForInvalidValues() {
        assertEquals(5, normalizedIdleTimeoutMinutes(-1))
        assertEquals(5, normalizedIdleTimeoutMinutes(2))
        assertEquals(5, normalizedIdleTimeoutMinutes(60))
        assertEquals(5, normalizedIdleTimeoutMinutes("later"))
    }
}
