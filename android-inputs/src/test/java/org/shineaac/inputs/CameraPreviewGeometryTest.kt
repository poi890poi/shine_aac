package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraPreviewGeometryTest {
    @Test
    fun matchingAspectFillsTheWholeView() {
        val rect = CameraPreviewGeometry.contentRect(800, 600, 640, 480)
        assertRect(0f, 0f, 800f, 600f, rect)
    }

    @Test
    fun wideViewAddsSideLetterboxing() {
        val rect = CameraPreviewGeometry.contentRect(1600, 900, 640, 480)
        assertRect(200f, 0f, 1200f, 900f, rect)
    }

    @Test
    fun tallViewAddsTopAndBottomLetterboxing() {
        val rect = CameraPreviewGeometry.contentRect(900, 1600, 640, 480)
        assertRect(0f, 462.5f, 900f, 675f, rect)
    }

    @Test
    fun quarterTurnSwapsTheOrientedDimensions() {
        assertEquals(480, CameraPreviewGeometry.orientedWidth(640, 480, 90))
        assertEquals(640, CameraPreviewGeometry.orientedHeight(640, 480, 90))
        assertEquals(640, CameraPreviewGeometry.orientedWidth(640, 480, 180))
        assertEquals(480, CameraPreviewGeometry.orientedHeight(640, 480, 180))
    }

    @Test
    fun landscapePreviewKeepsItsPreviousTransform() {
        // Rotation 0 needs no turn, so the known-good landscape case must be left exactly as it was.
        assertScale(0.75f, 1f, CameraPreviewGeometry.textureScale(1600, 900, 640, 480, 0))
    }

    @Test
    fun portraitQuarterTurnKeepsTheCameraAspectRatio() {
        // Regression for the transposed overlay: with the phone upright the preview must actually be
        // rotated, not just letterboxed into a portrait box, or pitching the head moves the tracking
        // box sideways while yawing moves it vertically.
        val viewWidth = 900
        val viewHeight = 1600
        val scale = CameraPreviewGeometry.textureScale(viewWidth, viewHeight, 640, 480, 270)
        assertScale(1200f / 900f, 900f / 1600f, scale)

        // Before the rotation the drawn image must still carry the camera's own 4:3 aspect ratio.
        val preRotationWidth = viewWidth * scale.x
        val preRotationHeight = viewHeight * scale.y
        assertEquals(640f / 480f, preRotationWidth / preRotationHeight, 0.0001f)
    }

    @Test
    fun rotatedTextureLandsExactlyOnTheOverlayContentRect() {
        // The overlay maps detections onto contentRect, so the rotated preview must cover it.
        val viewWidth = 1080
        val viewHeight = 1400
        val scale = CameraPreviewGeometry.textureScale(viewWidth, viewHeight, 640, 480, 90)
        val rect = CameraPreviewGeometry.contentRect(viewWidth, viewHeight, 480, 640)
        // A quarter turn swaps the sides, so pre-rotation width becomes the drawn height.
        assertEquals(rect.height, viewWidth * scale.x, 0.01f)
        assertEquals(rect.width, viewHeight * scale.y, 0.01f)
    }

    @Test
    fun contentRectStaysInsideTheView() {
        val rect = CameraPreviewGeometry.contentRect(1080, 1400, 480, 640)
        assertTrue(rect.left >= 0f && rect.top >= 0f)
        assertTrue(rect.left + rect.width <= 1080f + 0.01f)
        assertTrue(rect.top + rect.height <= 1400f + 0.01f)
        assertEquals(480f / 640f, rect.width / rect.height, 0.0001f)
    }

    @Test
    fun unavailableDimensionsReturnIdentity() {
        assertScale(1f, 1f, CameraPreviewGeometry.textureScale(0, 600, 640, 480, 0))
        assertScale(1f, 1f, CameraPreviewGeometry.textureScale(800, 600, 0, 480, 0))
    }

    private fun assertScale(expectedX: Float, expectedY: Float, actual: CameraPreviewScale) {
        assertEquals(expectedX, actual.x, 0.0001f)
        assertEquals(expectedY, actual.y, 0.0001f)
    }

    private fun assertRect(
        expectedLeft: Float,
        expectedTop: Float,
        expectedWidth: Float,
        expectedHeight: Float,
        actual: PreviewContentRect
    ) {
        assertEquals(expectedLeft, actual.left, 0.01f)
        assertEquals(expectedTop, actual.top, 0.01f)
        assertEquals(expectedWidth, actual.width, 0.01f)
        assertEquals(expectedHeight, actual.height, 0.01f)
    }
}
