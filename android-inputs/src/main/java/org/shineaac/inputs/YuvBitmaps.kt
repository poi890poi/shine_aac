package org.shineaac.inputs

import android.graphics.Bitmap
import android.media.Image

/**
 * Camera Setup-only YUV_420_888 to Bitmap conversion.
 *
 * The continuous AAC cheek-switch runtime does not call this converter:
 * CameraX supplies RGBA_8888 to MediaImageBuilder instead. Camera Setup stays
 * on this temporary path because its Camera2 geometry has already been physically verified.
 */
internal object YuvBitmaps {
    /**
     * Converts a frame to an ARGB bitmap.
     *
     * This converter currently allocates both its pixel buffer and result bitmap.
     * If profiling justifies reuse later, optimize both allocations together.
     */
    fun toBitmap(image: Image): Bitmap {
        val width = image.width
        val height = image.height
        val pixels = IntArray(width * height)
        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]
        val yBuffer = yPlane.buffer.duplicate()
        val uBuffer = uPlane.buffer.duplicate()
        val vBuffer = vPlane.buffer.duplicate()
        var output = 0
        for (row in 0 until height) {
            val yRow = row * yPlane.rowStride
            val uvRow = (row / 2) * uPlane.rowStride
            val vRow = (row / 2) * vPlane.rowStride
            for (column in 0 until width) {
                val y = yBuffer.get(yRow + column * yPlane.pixelStride).toInt() and 0xff
                val uvColumn = (column / 2) * uPlane.pixelStride
                val u = (uBuffer.get(uvRow + uvColumn).toInt() and 0xff) - 128
                val v = (vBuffer.get(vRow + (column / 2) * vPlane.pixelStride).toInt() and 0xff) - 128
                val red = (y + 1.402 * v).toInt().coerceIn(0, 255)
                val green = (y - 0.344136 * u - 0.714136 * v).toInt().coerceIn(0, 255)
                val blue = (y + 1.772 * u).toInt().coerceIn(0, 255)
                pixels[output++] = (0xff shl 24) or (red shl 16) or (green shl 8) or blue
            }
        }
        return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
    }
}
