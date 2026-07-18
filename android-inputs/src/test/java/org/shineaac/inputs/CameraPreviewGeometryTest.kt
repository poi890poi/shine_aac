package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class CameraPreviewGeometryTest {
    @Test
    fun matchingAspectDoesNotScale() {
        assertScale(1f, 1f, CameraPreviewGeometry.aspectFitScale(800, 600, 640, 480, 0))
    }

    @Test
    fun wideViewAddsSideLetterboxing() {
        assertScale(0.75f, 1f, CameraPreviewGeometry.aspectFitScale(1600, 900, 640, 480, 0))
    }

    @Test
    fun tallViewAddsTopAndBottomLetterboxing() {
        assertScale(1f, 0.421875f, CameraPreviewGeometry.aspectFitScale(900, 1600, 640, 480, 0))
    }

    @Test
    fun quarterTurnUsesOrientedBufferDimensions() {
        assertScale(0.421875f, 1f, CameraPreviewGeometry.aspectFitScale(1600, 900, 640, 480, 90))
    }

    @Test
    fun unavailableDimensionsReturnIdentity() {
        assertScale(1f, 1f, CameraPreviewGeometry.aspectFitScale(0, 600, 640, 480, 0))
    }

    private fun assertScale(expectedX: Float, expectedY: Float, actual: CameraPreviewScale) {
        assertEquals(expectedX, actual.x, 0.0001f)
        assertEquals(expectedY, actual.y, 0.0001f)
    }
}
