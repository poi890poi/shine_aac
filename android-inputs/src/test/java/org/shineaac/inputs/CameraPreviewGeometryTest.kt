package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertArrayEquals
import org.junit.Test

class CameraPreviewGeometryTest {
    @Test fun landscapeRotatesTextureWithoutDistortingOrCroppingFrame() {
        assertArrayEquals(floatArrayOf(66.6667f,800f,66.6667f,0f,1133.3333f,0f,1133.3333f,800f),
            CameraPreviewGeometry.textureCorners(1200,800,640,480,0,90), .001f)
    }

    @Test fun halfTurnChangesCornersEvenWhenViewSizeDoesNotChange() {
        val normal = CameraPreviewGeometry.textureCorners(800,1200,640,480,90,0)
        val rotated = CameraPreviewGeometry.textureCorners(800,1200,640,480,270,180)
        assertArrayEquals(floatArrayOf(normal[4],normal[5],normal[6],normal[7],normal[0],normal[1],normal[2],normal[3]), rotated,.001f)
    }

    @Test fun previewAndOverlayUseTheSameUprightFitRectangle() {
        for ((width,height) in listOf(800 to 1200,1200 to 800,600 to 500)) {
            val overlay = CameraPreviewGeometry.viewport(width,height,480,640)
            val preview = CameraPreviewGeometry.textureCorners(width,height,640,480,90,0)
            assertEquals(overlay.left,preview[0],.001f)
            assertEquals(overlay.top,preview[1],.001f)
            assertEquals(overlay.width,preview[4]-preview[0],.001f)
            assertEquals(overlay.height,preview[5]-preview[1],.001f)
        }
    }

    @Test fun usbZoomRemainsCenteredAndDoesNotInheritDeviceRotation() {
        assertArrayEquals(floatArrayOf(-400f,-300f,1200f,-300f,1200f,900f,-400f,900f),
            CameraPreviewGeometry.textureCorners(800,600,640,480,0,0,2f),.001f)
    }
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
