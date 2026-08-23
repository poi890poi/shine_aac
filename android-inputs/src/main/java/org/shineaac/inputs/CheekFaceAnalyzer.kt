package org.shineaac.inputs

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.media.Image
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.framework.image.MediaImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2

/**
 * One-thread-at-a-time Face Landmarker wrapper.
 *
 * Each instance is confined to one camera analysis thread by its owner:
 * CameraSwitchCalibrationActivity's camera HandlerThread or
 * CameraSwitchInputAdapter's single-thread analysisExecutor. It is intentionally
 * not synchronized; callers must preserve that confinement.
 */
class CheekFaceAnalyzer(context: Context) : AutoCloseable {
    private val landmarker = FaceLandmarker.createFromOptions(
        context.applicationContext,
        FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(
                BaseOptions.builder()
                    // Deliberate compatibility baseline. MediaPipe's Android
                    // sample notes that GPU delegates must be created/used on
                    // the same thread. Benchmark GPU separately on the physical
                    // device matrix before changing the accessibility default.
                    .setDelegate(Delegate.CPU)
                    .setModelAssetPath(ModelAsset)
                    .build()
            )
            .setRunningMode(RunningMode.VIDEO)
            .setNumFaces(1)
            .setMinFaceDetectionConfidence(0.55f)
            .setMinFacePresenceConfidence(0.55f)
            .setMinTrackingConfidence(0.55f)
            .setOutputFaceBlendshapes(true)
            .build()
    )

    private var lastTimestampMs = -1L

    /**
     * Setup/calibration path.
     *
     * CameraSwitchCalibrationActivity uses a Camera2 YUV_420_888 ImageReader.
     * Preserve the device-verified front-camera rotate+mirror preprocessing;
     * rear/external cameras use the same path without the selfie mirror.
     * This path is temporary; it is not used by the continuous AAC switch.
     */
    fun analyzeYuvForSetup(
        image: Image,
        rotationDegrees: Int,
        timestampMs: Long,
        mirrorCameraOutput: Boolean = true
    ): CheekFaceObservation? {
        val decoded = YuvBitmaps.toBitmap(image)
        val oriented = orientCamera(
            decoded, rotationDegrees, mirrorCameraOutput
        )
        return try {
            val mpImage = BitmapImageBuilder(oriented).build()
            try {
                analyzeMpImage(
                    mpImage = mpImage,
                    rotationDegrees = 0,
                    timestampMs = timestampMs,
                    mirrorFrontCameraOutput = false
                )
            } finally {
                mpImage.close()
            }
        } finally {
            if (oriented !== decoded) oriented.recycle()
            decoded.recycle()
        }
    }

    /**
     * Continuous runtime path.
     *
     * CameraSwitchInputAdapter configures CameraX ImageAnalysis for RGBA_8888.
     * MediaImageBuilder wraps the android.media.Image directly; SHINE performs
     * no per-pixel Kotlin YUV conversion and allocates no full-frame Bitmap here.
     *
     * Rotation is delegated to MediaPipe. The historical detector contract is a
     * mirrored front-camera image, so for front lenses the small result is mirrored instead:
     * normalized landmark x is flipped and Left/Right blendshape names are
     * swapped. That keeps personalized models learned by the setup path in the
     * same feature-key space.
     */
    fun analyzeRgbaForRuntime(
        image: Image,
        rotationDegrees: Int,
        timestampMs: Long,
        mirrorCameraOutput: Boolean = true
    ): CheekFaceObservation? {
        val mpImage = MediaImageBuilder(image).build()
        return try {
            analyzeMpImage(
                mpImage = mpImage,
                rotationDegrees = rotationDegrees,
                timestampMs = timestampMs,
                mirrorFrontCameraOutput = mirrorCameraOutput
            )
        } finally {
            mpImage.close()
        }
    }

    private fun orientCamera(
        bitmap: Bitmap,
        rotationDegrees: Int,
        mirrorCameraOutput: Boolean
    ): Bitmap {
        val normalizedRotation = ((rotationDegrees % 360) + 360) % 360
        val transform = Matrix().apply {
            if (normalizedRotation != 0) {
                postRotate(normalizedRotation.toFloat())
            }
            if (mirrorCameraOutput) {
                postScale(-1f, 1f)
            }
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

    private fun analyzeMpImage(
        mpImage: MPImage,
        rotationDegrees: Int,
        timestampMs: Long,
        mirrorFrontCameraOutput: Boolean
    ): CheekFaceObservation? {
        val safeTimestamp = timestampMs.coerceAtLeast(lastTimestampMs + 1L)
        lastTimestampMs = safeTimestamp
        val options = ImageProcessingOptions.builder()
            .setRotationDegrees(rotationDegrees)
            .build()
        val result = landmarker.detectForVideo(mpImage, options, safeTimestamp)
        val points = result.faceLandmarks().firstOrNull() ?: return null

        val rawBlendshapes = result.faceBlendshapes()
            .orElse(emptyList())
            .firstOrNull()
            ?.associate { it.categoryName() to it.score().toDouble() }
            .orEmpty()
        val blendshapes = if (mirrorFrontCameraOutput) {
            rawBlendshapes.entries.associate { (name, score) ->
                frontCameraMirroredBlendshapeName(name) to score
            }
        } else {
            rawBlendshapes
        }

        val landmarks = FloatArray(points.size * 2)
        var minX = Float.MAX_VALUE
        var minY = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE
        var maxY = -Float.MAX_VALUE
        points.forEachIndexed { index, point ->
            val x = if (mirrorFrontCameraOutput) 1f - point.x() else point.x()
            val y = point.y()
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
        if (maxX - minX < 0.22f || maxY - minY < 0.28f) {
            return false to "Move the camera closer"
        }
        if (minX < -0.02f || maxX > 1.02f || minY < -0.02f || maxY > 1.02f) {
            return false to "Center the whole face"
        }
        val eyeAx = landmarks[33 * 2]
        val eyeAy = landmarks[33 * 2 + 1]
        val eyeBx = landmarks[263 * 2]
        val eyeBy = landmarks[263 * 2 + 1]
        val roll = abs(
            atan2(
                (eyeBy - eyeAy).toDouble(),
                (eyeBx - eyeAx).toDouble()
            ) * 180.0 / PI
        )
        if (roll > 20.0) return false to "Keep the head more upright"
        val span = abs(eyeBx - eyeAx).coerceAtLeast(0.001f)
        val ratio = abs(landmarks[1 * 2] - eyeAx) / span
        if (ratio !in 0.22f..0.78f) return false to "Face the camera more directly"
        return true to "Face tracking good"
    }

    override fun close() = landmarker.close()

    private companion object {
        const val ModelAsset = "face_landmarker.task"
    }
}

internal fun frontCameraMirroredBlendshapeName(name: String): String = when {
    name.endsWith("Left") -> name.removeSuffix("Left") + "Right"
    name.endsWith("Right") -> name.removeSuffix("Right") + "Left"
    else -> name
}

data class CheekFaceObservation(
    val blendshapes: Map<String, Double>,
    val qualityMessage: String,
    val usable: Boolean,
    val normalizedBounds: NormalizedFaceBounds,
    /** Flat x,y pairs in mirrored normalized preview space. */
    val normalizedLandmarks: FloatArray = FloatArray(0)
)

data class NormalizedFaceBounds(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float
)
