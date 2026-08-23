package org.shineaac.inputs

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import kotlin.math.max
import kotlin.math.min

/**
 * Draws the analysed camera frame together with the tracking marks found in it.
 *
 * The bitmap handed here has already been turned upright and mirrored, and the detector was given
 * that same bitmap, so the landmark coordinates are normalized against exactly these pixels. Drawing
 * therefore needs no rotation and no mirroring at all: one aspect-fit rectangle places the picture
 * and the marks together. This follows the cheek-switch proof of concept, where baking the
 * orientation into the frame before detection is what makes the mesh sit perfectly on the face.
 */
internal class CalibrationPreviewView(context: Context) : View(context) {
    private val framePaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val boxPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }
    private val markPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val meterBackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.argb(190, 15, 23, 42)
    }
    private val meterFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val meterMarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.WHITE
    }
    private val meterTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        typeface = android.graphics.Typeface.DEFAULT_BOLD
    }
    private val density = resources.displayMetrics.density
    private val frameMatrix = Matrix()

    private var frame: Bitmap? = null
    private var bounds: RectF? = null
    private var landmarks: FloatArray? = null
    private var tracking = false
    private var score: Double? = null
    private var enterThreshold = 0.62
    private var active = false
    private var meterLabel = ""

    /** [bitmap] must already be upright and mirrored, exactly as handed to the detector. */
    fun setFrame(bitmap: Bitmap?) {
        frame = bitmap
        invalidate()
    }

    /** [nextBounds] and [nextLandmarks] are normalized to 0..1 in the rotated analysis frame. */
    fun setDetection(nextBounds: RectF?, nextLandmarks: FloatArray?, nextTracking: Boolean) {
        bounds = nextBounds
        landmarks = nextLandmarks
        tracking = nextTracking
        invalidate()
    }

    /**
     * Shows the live movement strength against the threshold that will fire the switch.
     *
     * A helper positioning the phone otherwise has no way to tell a movement that nearly worked from
     * one that was nowhere near, which is the difference between adjusting the angle and giving up.
     */
    fun setMeter(nextScore: Double?, threshold: Double, nextActive: Boolean, label: String) {
        score = nextScore
        enterThreshold = threshold
        active = nextActive
        meterLabel = label
        invalidate()
    }

    fun clear() {
        frame = null
        bounds = null
        landmarks = null
        score = null
        tracking = false
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val bitmap = frame?.takeIf { !it.isRecycled } ?: return
        val content = CameraPreviewGeometry.contentRect(width, height, bitmap.width, bitmap.height)
        if (content.width <= 0f || content.height <= 0f) return

        frameMatrix.setScale(content.width / bitmap.width, content.height / bitmap.height)
        frameMatrix.postTranslate(content.left, content.top)
        canvas.drawBitmap(bitmap, frameMatrix, framePaint)

        // Detections are normalized against these very pixels, so they use the same rectangle.
        val box = bounds ?: return
        val color = if (tracking) Color.rgb(52, 211, 153) else Color.rgb(245, 158, 11)
        boxPaint.color = color
        markPaint.color = color
        canvas.drawRect(
            content.left + box.left * content.width,
            content.top + box.top * content.height,
            content.left + box.right * content.width,
            content.top + box.bottom * content.height,
            boxPaint
        )
        val points = landmarks
        if (points != null) {
            val radius = max(1.5f, min(content.width, content.height) / 260f)
            var index = 0
            while (index + 1 < points.size) {
                canvas.drawCircle(
                    content.left + points[index] * content.width,
                    content.top + points[index + 1] * content.height,
                    radius,
                    markPaint
                )
                index += 2
            }
        }
        drawMeter(canvas)
    }

    /** Movement strength against the firing threshold, drawn along the bottom of the preview. */
    private fun drawMeter(canvas: Canvas) {
        val current = score ?: return
        val left = 12f * density
        val right = width - 12f * density
        if (right <= left) return
        val height = 18f * density
        val bottom = this.height - 12f * density
        val top = bottom - height
        val radius = height / 2f

        canvas.drawRoundRect(left, top, right, bottom, radius, radius, meterBackPaint)
        val fraction = current.coerceIn(0.0, 1.0).toFloat()
        if (fraction > 0.01f) {
            meterFillPaint.color = if (active) Color.rgb(52, 211, 153) else Color.rgb(45, 212, 191)
            canvas.drawRoundRect(left, top, left + (right - left) * fraction, bottom, radius, radius, meterFillPaint)
        }
        val markX = left + (right - left) * enterThreshold.coerceIn(0.0, 1.0).toFloat()
        meterMarkPaint.strokeWidth = 3f * density
        canvas.drawLine(markX, top - 4f * density, markX, bottom + 4f * density, meterMarkPaint)

        if (meterLabel.isNotEmpty()) {
            meterTextPaint.textSize = 13f * density
            canvas.drawText(meterLabel, left, top - 7f * density, meterTextPaint)
        }
    }
}
