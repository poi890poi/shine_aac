package org.shineaac.inputs

import android.view.Surface
import org.junit.Assert.assertEquals
import org.junit.Test

class CameraRotationTest {
    @Test
    fun frontCameraCombinesSensorAndDisplayRotation() {
        assertEquals(270, CameraRotation.compensationDegrees(Surface.ROTATION_0, 270, true))
        assertEquals(0, CameraRotation.compensationDegrees(Surface.ROTATION_90, 270, true))
        assertEquals(90, CameraRotation.compensationDegrees(Surface.ROTATION_180, 270, true))
        assertEquals(180, CameraRotation.compensationDegrees(Surface.ROTATION_270, 270, true))
    }

    @Test
    fun backCameraSubtractsDisplayRotationFromSensorOrientation() {
        assertEquals(90, CameraRotation.compensationDegrees(Surface.ROTATION_0, 90, false))
        assertEquals(0, CameraRotation.compensationDegrees(Surface.ROTATION_90, 90, false))
        assertEquals(270, CameraRotation.compensationDegrees(Surface.ROTATION_180, 90, false))
        assertEquals(180, CameraRotation.compensationDegrees(Surface.ROTATION_270, 90, false))
    }
}
