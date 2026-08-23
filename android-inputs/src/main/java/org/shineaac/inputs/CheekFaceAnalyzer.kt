package org.shineaac.inputs

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
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
        val decoded = YuvBitmaps.toBitmap(image)
        val oriented = orientFrontCamera(decoded, rotationDegrees)
        return try {
            // MediaPipe now sees exactly the orientation/mirroring used by the front-camera preview.
            // Its normalized landmark coordinates therefore need no downstream rotation or mirror.
            analyzeBitmap(oriented, 0, timestampMs)
        } finally {
            if (oriented !== decoded) oriented.recycle()
            decoded.recycle()
        }
    }

    private fun orientFrontCamera(bitmap: Bitmap, rotationDegrees: Int): Bitmap {
        val normalizedRotation = ((rotationDegrees % 360) + 360) % 360
        val transform = Matrix().apply {
            if (normalizedRotation != 0) {
                postRotate(normalizedRotation.toFloat())
            }
            // Front-camera preview convention: mirror horizontally after making the image upright.
            postScale(-1f, 1f)
        }
        return Bitmap.createBitmap(
            bitmap,
            0,
            0,
            bitmap.width,
            bitmap.height,
            transform,
            true
        )
    }

    /**
     * Analyses a bitmap the caller keeps ownership of, so the calibration screen can display the very
     * frame it analysed instead of a separate preview stream.
     */
    @Synchronized
    fun analyzeBitmap(bitmap: Bitmap, rotationDegrees: Int, timestampMs: Long): CheekFaceObservation? {
        val mpImage = BitmapImageBuilder(bitmap).build()
        return try {
            analyzeMpImage(mpImage, rotationDegrees, timestampMs)
        } finally {
            mpImage.close()
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
        // One flat x,y array instead of a list of pairs: this runs on every analysed frame.
        val landmarks = FloatArray(points.size * 2)
        var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE
        points.forEachIndexed { index, point ->
            val x = point.x(); val y = point.y()
            landmarks[index * 2] = x
            landmarks[index * 2 + 1] = y
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        }
        val quality = faceQuality(landmarks, minX, minY, maxX, maxY)
        return CheekFaceObservation(
            blendshapes = blendshapes,
            qualityMessage = quality.second,
            usable = quality.first,
            normalizedBounds = NormalizedFaceBounds(minX, minY, maxX, maxY),
            normalizedLandmarks = landmarks
        )
    }

    private fun faceQuality(
        landmarks: FloatArray,
        minX: Float,
        minY: Float,
        maxX: Float,
        maxY: Float
    ): Pair<Boolean, String> {
        if (landmarks.size < 468 * 2) return false to "Face landmarks unavailable"
        if (maxX - minX < 0.22f || maxY - minY < 0.28f) return false to "Move the camera closer"
        if (minX < -0.02f || maxX > 1.02f || minY < -0.02f || maxY > 1.02f) return false to "Center the whole face"
        val eyeAx = landmarks[33 * 2]; val eyeAy = landmarks[33 * 2 + 1]
        val eyeBx = landmarks[263 * 2]; val eyeBy = landmarks[263 * 2 + 1]
        val roll = abs(atan2((eyeBy - eyeAy).toDouble(), (eyeBx - eyeAx).toDouble()) * 180.0 / PI)
        if (roll > 20.0) return false to "Keep the head more upright"
        val span = abs(eyeBx - eyeAx).coerceAtLeast(0.001f)
        val ratio = abs(landmarks[1 * 2] - eyeAx) / span
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
    val normalizedBounds: NormalizedFaceBounds,
    /** Flat `x, y` pairs in normalized image space, used to draw tracking marks on the preview. */
    val normalizedLandmarks: FloatArray = FloatArray(0)
)

data class NormalizedFaceBounds(val left: Float, val top: Float, val right: Float, val bottom: Float)
