package org.shineaac.inputs

import android.content.Context
import android.graphics.Bitmap
import android.media.Image
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import java.nio.ByteBuffer

class CheekFaceAnalyzer(context: Context) : AutoCloseable {
    private val landmarker = FaceLandmarker.createFromOptions(
        context.applicationContext,
        FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setDelegate(Delegate.CPU).setModelAssetPath(ModelAsset).build())
            .setRunningMode(RunningMode.VIDEO)
            .setNumFaces(1)
            .setMinFaceDetectionConfidence(0.55f)
            .setMinFacePresenceConfidence(0.55f)
            .setMinTrackingConfidence(0.55f)
            .setOutputFaceBlendshapes(true)
            .build()
    )
    private var lastTimestampMs = -1L

    @Synchronized
    fun analyze(image: Image, rotationDegrees: Int, timestampMs: Long): CheekFaceObservation? {
        val bitmap = yuv420ToBitmap(image)
        val mpImage = BitmapImageBuilder(bitmap).build()
        return try {
            analyzeMpImage(mpImage, rotationDegrees, timestampMs)
        } finally {
            mpImage.close()
            bitmap.recycle()
        }
    }

    @Synchronized
    fun analyzeRgba(width: Int, height: Int, buffer: ByteBuffer, rotationDegrees: Int, timestampMs: Long): CheekFaceObservation? {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.copyPixelsFromBuffer(buffer.duplicate().apply { rewind() })
        val mpImage = BitmapImageBuilder(bitmap).build()
        return try {
            analyzeMpImage(mpImage, rotationDegrees, timestampMs)
        } finally {
            mpImage.close()
            bitmap.recycle()
        }
    }

    private fun analyzeMpImage(mpImage: MPImage, rotationDegrees: Int, timestampMs: Long): CheekFaceObservation? {
        val safeTimestamp = timestampMs.coerceAtLeast(lastTimestampMs + 1L)
        lastTimestampMs = safeTimestamp
        val options = ImageProcessingOptions.builder().setRotationDegrees(rotationDegrees).build()
        val result = landmarker.detectForVideo(mpImage, options, safeTimestamp)
        val points = result.faceLandmarks().firstOrNull() ?: return null
        val blendshapes = result.faceBlendshapes().orElse(emptyList()).firstOrNull()
            ?.associate { it.categoryName() to it.score().toDouble() }.orEmpty()
        val xs = points.map { it.x() }; val ys = points.map { it.y() }
        val quality = faceQuality(points.map { it.x() to it.y() })
        return CheekFaceObservation(
            blendshapes = blendshapes,
            qualityMessage = quality.second,
            usable = quality.first,
            normalizedBounds = NormalizedFaceBounds(xs.min(), ys.min(), xs.max(), ys.max())
        )
    }

    private fun yuv420ToBitmap(image: Image): Bitmap {
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
            for (column in 0 until width) {
                val y = yBuffer.get(yRow + column * yPlane.pixelStride).toInt() and 0xff
                val uvColumn = (column / 2) * uPlane.pixelStride
                val u = (uBuffer.get(uvRow + uvColumn).toInt() and 0xff) - 128
                val v = (vBuffer.get((row / 2) * vPlane.rowStride + (column / 2) * vPlane.pixelStride).toInt() and 0xff) - 128
                val red = (y + 1.402 * v).toInt().coerceIn(0, 255)
                val green = (y - 0.344136 * u - 0.714136 * v).toInt().coerceIn(0, 255)
                val blue = (y + 1.772 * u).toInt().coerceIn(0, 255)
                pixels[output++] = (0xff shl 24) or (red shl 16) or (green shl 8) or blue
            }
        }
        return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
    }

    private fun faceQuality(points: List<Pair<Float, Float>>): Pair<Boolean, String> {
        if (points.size < 468) return false to "Face landmarks unavailable"
        val minX = points.minOf { it.first }; val maxX = points.maxOf { it.first }
        val minY = points.minOf { it.second }; val maxY = points.maxOf { it.second }
        if (maxX - minX < 0.22f || maxY - minY < 0.28f) return false to "Move the camera closer"
        if (minX < -0.02f || maxX > 1.02f || minY < -0.02f || maxY > 1.02f) return false to "Center the whole face"
        val eyeA = points[33]; val eyeB = points[263]
        val roll = abs(atan2((eyeB.second - eyeA.second).toDouble(), (eyeB.first - eyeA.first).toDouble()) * 180.0 / PI)
        if (roll > 20.0) return false to "Keep the head more upright"
        val span = abs(eyeB.first - eyeA.first).coerceAtLeast(0.001f)
        val ratio = abs(points[1].first - eyeA.first) / span
        if (ratio !in 0.22f..0.78f) return false to "Face the camera more directly"
        return true to "Face tracking good"
    }

    override fun close() = landmarker.close()
    private companion object { const val ModelAsset = "face_landmarker.task" }
}

data class CheekFaceObservation(
    val blendshapes: Map<String, Double>,
    val qualityMessage: String,
    val usable: Boolean,
    val normalizedBounds: NormalizedFaceBounds
)

data class NormalizedFaceBounds(val left: Float, val top: Float, val right: Float, val bottom: Float)
