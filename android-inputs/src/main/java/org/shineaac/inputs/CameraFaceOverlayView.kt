package org.shineaac.inputs

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import kotlin.math.min

/**
 * Draws face tracking and gesture-strength feedback over the camera preview.
 *
 * The view accepts normalized MediaPipe coordinates. Keeping rendering here prevents
 * camera and calibration code from owning drawing state.
 */
internal class CameraFaceOverlayView(context: Context) : View(context) {
    private val boxPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(52, 211, 153)
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }
    private val landmarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(96, 165, 250)
        style = Paint.Style.FILL
    }
    private val meterBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(180, 15, 23, 42)
        style = Paint.Style.FILL
    }
    private val meterFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(52, 211, 153)
        style = Paint.Style.FILL
    }
    private val thresholdPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    private val faceRect = RectF()
    private val meterRect = RectF()

    private var normalizedFace: NormalizedFaceBounds? = null
    private var landmarks: FloatArray? = null
    private var frameWidth = 0
    private var frameHeight = 0
    private var hasSignal = false
    private var score: Double? = null
    private var threshold = 1.0
    private var showThreshold = true

    fun clearDetection() {
        normalizedFace = null
        landmarks = null
        score = null
        hasSignal = false
        showThreshold = true
        invalidate()
    }

    fun setNormalizedDetection(
        face: NormalizedFaceBounds?,
        landmarks: FloatArray?,
        frameWidth: Int,
        frameHeight: Int,
        score: Double?,
        threshold: Double,
        hasSignal: Boolean,
        showThreshold: Boolean = true
    ) {
        normalizedFace = face
        this.landmarks = landmarks
        this.frameWidth = frameWidth
        this.frameHeight = frameHeight
        this.score = score
        this.threshold = threshold
        this.hasSignal = hasSignal
        this.showThreshold = showThreshold
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (frameWidth <= 0 || frameHeight <= 0) return

        val viewport = CameraPreviewGeometry.viewport(width, height, frameWidth, frameHeight)
        val scale = viewport.width / frameWidth
        val leftOffset = viewport.left
        val topOffset = viewport.top

        boxPaint.color = if (hasSignal) {
            Color.rgb(52, 211, 153)
        } else {
            Color.rgb(245, 158, 11)
        }

        normalizedFace?.let { box ->
            // MediaPipe coordinates are already upright and mirrored into preview space.
            faceRect.set(
                leftOffset + box.left * frameWidth * scale,
                topOffset + box.top * frameHeight * scale,
                leftOffset + box.right * frameWidth * scale,
                topOffset + box.bottom * frameHeight * scale
            )
            canvas.drawRect(faceRect, boxPaint)
        }

        landmarks?.let { points ->
            var index = 0
            while (index + 1 < points.size) {
                val x = points[index] * frameWidth
                val y = points[index + 1] * frameHeight
                canvas.drawCircle(
                    leftOffset + x * scale,
                    topOffset + y * scale,
                    LandmarkRadiusPx,
                    landmarkPaint
                )
                index += 2
            }
        }

        drawStrengthMeter(canvas)
    }

    private fun drawStrengthMeter(canvas: Canvas) {
        val meterLeft = width * 0.08f
        val meterRight = width * 0.92f
        val meterBottom = height - 18f
        val meterTop = meterBottom - 20f
        val meterWidth = meterRight - meterLeft

        meterRect.set(meterLeft, meterTop, meterRight, meterBottom)
        canvas.drawRoundRect(meterRect, MeterRadiusPx, MeterRadiusPx, meterBackgroundPaint)

        val value = (score ?: 0.0).coerceIn(0.0, MaximumMeterScore)
        if (value > 0.0) {
            meterRect.set(
                meterLeft,
                meterTop,
                meterLeft + meterWidth * value.toFloat(),
                meterBottom
            )
            canvas.drawRoundRect(meterRect, MeterRadiusPx, MeterRadiusPx, meterFillPaint)
        }

        if (showThreshold) {
            val thresholdX = meterLeft +
                meterWidth * threshold.coerceIn(0.0, MaximumMeterScore).toFloat()
            canvas.drawLine(
                thresholdX,
                meterTop - ThresholdOverhangPx,
                thresholdX,
                meterBottom + ThresholdOverhangPx,
                thresholdPaint
            )
        }
    }

    private companion object {
        const val LandmarkRadiusPx = 2.2f
        const val MeterRadiusPx = 8f
        const val ThresholdOverhangPx = 4f
        const val MaximumMeterScore = 1.0
    }
}
