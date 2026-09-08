package org.shineaac.inputs

data class CameraPreviewScale(val x: Float, val y: Float)
data class CameraPreviewViewport(val left: Float, val top: Float, val width: Float, val height: Float)

object CameraPreviewGeometry {
    /** Upright normalized coordinates share this fit rectangle with the overlay. */
    fun viewport(viewWidth: Int, viewHeight: Int, frameWidth: Int, frameHeight: Int, zoom: Float = 1f): CameraPreviewViewport {
        if (viewWidth <= 0 || viewHeight <= 0 || frameWidth <= 0 || frameHeight <= 0)
            return CameraPreviewViewport(0f, 0f, 0f, 0f)
        val scale = minOf(viewWidth.toFloat() / frameWidth, viewHeight.toFloat() / frameHeight) * zoom
        val width = frameWidth * scale
        val height = frameHeight * scale
        return CameraPreviewViewport((viewWidth-width)/2f, (viewHeight-height)/2f, width, height)
    }

    /** TextureView already handles sensor orientation and front-camera mirroring.
     * Rotate its normalized corners only for display rotation, then aspect-fit.
     * Android reference: https://developer.android.com/codelabs/android-camera2-preview
     */
    fun textureCorners(viewWidth: Int, viewHeight: Int, bufferWidth: Int, bufferHeight: Int,
        analysisRotation: Int, displayRotation: Int, zoom: Float = 1f): FloatArray {
        val swapped = analysisRotation % 180 != 0
        val rect = viewport(viewWidth, viewHeight, if (swapped) bufferHeight else bufferWidth,
            if (swapped) bufferWidth else bufferHeight, zoom)
        val corners = arrayOf(0f to 0f, 1f to 0f, 1f to 1f, 0f to 1f)
        val turn = ((displayRotation / 90) % 4 + 4) % 4
        return corners.flatMap { (x, y) ->
            val point = when (turn) {
                1 -> y to 1f-x
                2 -> 1f-x to 1f-y
                3 -> 1f-y to x
                else -> x to y
            }
            listOf(rect.left + point.first * rect.width, rect.top + point.second * rect.height)
        }.toFloatArray()
    }
    fun aspectFitScale(
        viewWidth: Int,
        viewHeight: Int,
        bufferWidth: Int,
        bufferHeight: Int,
        rotationDegrees: Int
    ): CameraPreviewScale {
        if (viewWidth <= 0 || viewHeight <= 0 || bufferWidth <= 0 || bufferHeight <= 0) {
            return CameraPreviewScale(1f, 1f)
        }

        val rotated = rotationDegrees == 90 || rotationDegrees == 270
        val orientedWidth = if (rotated) bufferHeight else bufferWidth
        val orientedHeight = if (rotated) bufferWidth else bufferHeight
        val viewAspect = viewWidth.toFloat() / viewHeight
        val bufferAspect = orientedWidth.toFloat() / orientedHeight

        return if (viewAspect > bufferAspect) {
            CameraPreviewScale(bufferAspect / viewAspect, 1f)
        } else {
            CameraPreviewScale(1f, viewAspect / bufferAspect)
        }
    }
}
