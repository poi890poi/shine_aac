package org.shineaac.inputs

import android.graphics.Bitmap
import android.media.Image

/**
 * Converts camera YUV_420_888 frames to bitmaps.
 *
 * The calibration screen draws the very frame it analysed, so the pixels on screen and the detector's
 * coordinates come from one image and cannot disagree about rotation or mirroring.
 */
internal object YuvBitmaps {
    /**
     * Converts a frame, writing into [reuse] when it is the right size.
     *
     * The preview now runs at its own rate rather than the detector's, so this happens often enough
     * that allocating a fresh buffer every frame would be a needless megabyte of churn. Only the
     * caller's oriented output is handed to a View; this buffer never is, so it is safe to reuse.
     */
    fun toBitmap(image: Image, reuse: Bitmap? = null): Bitmap {
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
        val target = reuse?.takeIf { !it.isRecycled && it.isMutable && it.width == width && it.height == height }
        if (target != null) {
            target.setPixels(pixels, 0, width, 0, 0, width, height)
            return target
        }
        return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
    }
}
