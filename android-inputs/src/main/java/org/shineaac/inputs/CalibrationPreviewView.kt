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
    private val frameMatrix = Matrix()

    private var frame: Bitmap? = null
    private var bounds: RectF? = null
    private var landmarks: FloatArray? = null
    private var tracking = false

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

    fun clear() {
        frame = null
        bounds = null
        landmarks = null
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
        val points = landmarks ?: return
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
}
