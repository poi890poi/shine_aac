package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class CameraSetupFontScaleTest {
    @Test
    fun `ordinary font scaling remains unchanged`() {
        assertEquals(1f, cameraSetupFontScale(1f), 0.001f)
        assertEquals(1.15f, cameraSetupFontScale(1.15f), 0.001f)
    }

    @Test
    fun `extreme font scaling is capped for the fixed camera setup`() {
        assertEquals(MaxCameraSetupFontScale, cameraSetupFontScale(1.3f), 0.001f)
        assertEquals(MaxCameraSetupFontScale, cameraSetupFontScale(2f), 0.001f)
    }

    @Test
    fun `invalid font scaling falls back to normal`() {
        assertEquals(1f, cameraSetupFontScale(0f), 0.001f)
        assertEquals(1f, cameraSetupFontScale(Float.NaN), 0.001f)
    }
}
