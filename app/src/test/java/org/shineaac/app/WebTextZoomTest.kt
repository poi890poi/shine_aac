package org.shineaac.app

import org.junit.Assert.assertEquals
import org.junit.Test

class WebTextZoomTest {
    @Test
    fun followsTheSystemFontPreference() {
        assertEquals(85, webTextZoomPercent(0.85f))
        assertEquals(100, webTextZoomPercent(1f))
        assertEquals(130, webTextZoomPercent(1.3f))
        assertEquals(200, webTextZoomPercent(2f))
    }

    @Test
    fun staysWithinTheSupportedAccessibilityRange() {
        assertEquals(50, webTextZoomPercent(0.2f))
        assertEquals(200, webTextZoomPercent(3f))
    }
}
