package org.shineaac.inputs

import kotlin.math.min

data class CameraPreviewScale(val x: Float, val y: Float)

/**
 * Rectangle, in view pixels, actually covered by the camera image once it has been aspect-fitted
 * inside the preview surface.
 */
data class PreviewContentRect(val left: Float, val top: Float, val width: Float, val height: Float)

/**
 * Single source of truth for camera preview placement.
 *
 * Both the `TextureView` transform and the face overlay are derived from these functions, so the
 * drawn image and the drawn tracking marks cannot disagree.
 *
 * The camera writes the preview surface in sensor orientation, exactly as it writes the analysis
 * reader, so the preview needs the same rotation that is handed to the detector. Previously it got
 * none: the detector worked in an upright frame while the preview stayed sideways, which is why
 * pitching the head moved the tracking box sideways and yawing it moved the box vertically.
 */
object CameraPreviewGeometry {
    fun isQuarterTurn(rotationDegrees: Int): Boolean = normalizeRotation(rotationDegrees).let { it == 90 || it == 270 }

    fun orientedWidth(bufferWidth: Int, bufferHeight: Int, rotationDegrees: Int): Int =
        if (isQuarterTurn(rotationDegrees)) bufferHeight else bufferWidth

    fun orientedHeight(bufferWidth: Int, bufferHeight: Int, rotationDegrees: Int): Int =
        if (isQuarterTurn(rotationDegrees)) bufferWidth else bufferHeight

    /**
     * Where an upright image of [orientedWidth] x [orientedHeight] lands when it is centred and
     * aspect-fitted inside a [viewWidth] x [viewHeight] view.
     */
    fun contentRect(
        viewWidth: Int,
        viewHeight: Int,
        orientedWidth: Int,
        orientedHeight: Int
    ): PreviewContentRect {
        if (viewWidth <= 0 || viewHeight <= 0 || orientedWidth <= 0 || orientedHeight <= 0) {
            return PreviewContentRect(0f, 0f, maxOf(viewWidth, 0).toFloat(), maxOf(viewHeight, 0).toFloat())
        }
        val scale = min(viewWidth.toFloat() / orientedWidth, viewHeight.toFloat() / orientedHeight)
        val width = orientedWidth * scale
        val height = orientedHeight * scale
        return PreviewContentRect((viewWidth - width) / 2f, (viewHeight - height) / 2f, width, height)
    }

    /**
     * Scale to apply *before* rotating a `TextureView`.
     *
     * A `TextureView` stretches the camera buffer across its whole bounds, so the transform must
     * first shrink that stretched image to the size it needs to have before the rotation; rotating
     * by [rotationDegrees] afterwards then lands it exactly on [contentRect].
     */
    fun textureScale(
        viewWidth: Int,
        viewHeight: Int,
        bufferWidth: Int,
        bufferHeight: Int,
        rotationDegrees: Int
    ): CameraPreviewScale {
        if (viewWidth <= 0 || viewHeight <= 0 || bufferWidth <= 0 || bufferHeight <= 0) {
            return CameraPreviewScale(1f, 1f)
        }
        val rect = contentRect(
            viewWidth = viewWidth,
            viewHeight = viewHeight,
            orientedWidth = orientedWidth(bufferWidth, bufferHeight, rotationDegrees),
            orientedHeight = orientedHeight(bufferWidth, bufferHeight, rotationDegrees)
        )
        val quarterTurn = isQuarterTurn(rotationDegrees)
        val preRotationWidth = if (quarterTurn) rect.height else rect.width
        val preRotationHeight = if (quarterTurn) rect.width else rect.height
        return CameraPreviewScale(preRotationWidth / viewWidth, preRotationHeight / viewHeight)
    }

    private fun normalizeRotation(rotationDegrees: Int): Int = ((rotationDegrees % 360) + 360) % 360
}
