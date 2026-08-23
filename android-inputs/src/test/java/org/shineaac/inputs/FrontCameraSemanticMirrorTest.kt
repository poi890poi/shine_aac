package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class FrontCameraSemanticMirrorTest {
    @Test
    fun swapsLeftAndRightSuffixes() {
        assertEquals(
            "mouthPressRight",
            frontCameraMirroredBlendshapeName("mouthPressLeft")
        )
        assertEquals(
            "mouthPressLeft",
            frontCameraMirroredBlendshapeName("mouthPressRight")
        )
        assertEquals(
            "cheekSquintRight",
            frontCameraMirroredBlendshapeName("cheekSquintLeft")
        )
        assertEquals(
            "noseSneerLeft",
            frontCameraMirroredBlendshapeName("noseSneerRight")
        )
    }

    @Test
    fun preservesNonSideSpecificBlendshapes() {
        assertEquals("cheekPuff", frontCameraMirroredBlendshapeName("cheekPuff"))
        assertEquals("_neutral", frontCameraMirroredBlendshapeName("_neutral"))
        assertEquals("jawOpen", frontCameraMirroredBlendshapeName("jawOpen"))
    }
}
