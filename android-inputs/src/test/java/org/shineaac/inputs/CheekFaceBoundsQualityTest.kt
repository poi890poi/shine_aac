package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CheekFaceBoundsQualityTest {
    @Test
    fun faceAtAboutSeventyPercentOfViewIsAccepted() {
        assertNull(cheekFaceBoundsQuality(0.20f, 0.15f, 0.80f, 0.85f))
    }

    @Test
    fun faceFillingViewIsRejected() {
        assertEquals(
            "Move the camera farther away; keep your face around 70% of the view",
            cheekFaceBoundsQuality(0.08f, 0.06f, 0.92f, 0.94f)
        )
    }

    @Test
    fun smallAndCroppedFacesKeepSpecificGuidance() {
        assertEquals(
            "Move the camera closer",
            cheekFaceBoundsQuality(0.40f, 0.35f, 0.58f, 0.60f)
        )
        assertEquals(
            "Center the whole face",
            cheekFaceBoundsQuality(-0.03f, 0.10f, 0.70f, 0.80f)
        )
    }
}
