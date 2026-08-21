package org.shineaac.inputs

import android.hardware.camera2.CameraCharacteristics
import org.junit.Assert.assertEquals
import org.junit.Test

class CameraSwitchCameraSelectionTest {
    private val front = CameraSwitchCamera("front-0", CameraCharacteristics.LENS_FACING_FRONT)
    private val rear = CameraSwitchCamera("rear-0", CameraCharacteristics.LENS_FACING_BACK)
    private val external = CameraSwitchCamera("usb-0", CameraCharacteristics.LENS_FACING_EXTERNAL)

    @Test
    fun exactSavedCameraWins() {
        val selected = CameraSwitchCameraSelection.choose(
            cameras = listOf(front, external, rear),
            preferredCameraId = external.cameraId,
            preferredLensFacing = CameraCharacteristics.LENS_FACING_EXTERNAL
        )

        assertEquals(external, selected)
    }

    @Test
    fun reconnectCanUseAnotherCameraWithTheSavedFacing() {
        val replacement = CameraSwitchCamera("usb-1", CameraCharacteristics.LENS_FACING_EXTERNAL)
        val selected = CameraSwitchCameraSelection.choose(
            cameras = listOf(front, replacement, rear),
            preferredCameraId = "disconnected-usb",
            preferredLensFacing = CameraCharacteristics.LENS_FACING_EXTERNAL
        )

        assertEquals(replacement, selected)
    }

    @Test
    fun frontCameraRemainsTheDefault() {
        val selected = CameraSwitchCameraSelection.choose(
            cameras = listOf(rear, external, front),
            preferredCameraId = null,
            preferredLensFacing = null
        )

        assertEquals(front, selected)
    }

    @Test
    fun externalCameraIsTheFallbackWhenThereIsNoFrontCamera() {
        val selected = CameraSwitchCameraSelection.choose(
            cameras = listOf(rear, external),
            preferredCameraId = null,
            preferredLensFacing = null
        )

        assertEquals(external, selected)
    }
}
