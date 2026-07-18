package org.shineaac.inputs

data class CameraPreviewScale(val x: Float, val y: Float)

object CameraPreviewGeometry {
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
