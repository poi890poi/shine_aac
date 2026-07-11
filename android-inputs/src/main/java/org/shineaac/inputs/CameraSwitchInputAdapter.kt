package org.shineaac.inputs

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PointF
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.FaceDetector
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class CameraSwitchInputAdapter(
    private val context: Context,
    private val settingsProvider: () -> CameraSwitchSettings,
    private val sink: InputSink
) : InputAdapter {
    private var cameraDevice: CameraDevice? = null
    private var session: CameraCaptureSession? = null
    private var reader: ImageReader? = null
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private val analysisSize = Size(320, 240)
    private var lastRoi: TrackedRoi? = null
    private var openBaseline: EyeFeatures? = null
    private var closedBaseline: EyeFeatures? = null
    private var closedStartedAt = 0L
    private var closed = false
    private var lastActivationAt = 0L

    @SuppressLint("MissingPermission")
    override fun start() {
        stop()
        val settings = settingsProvider()
        if (!settings.enabled) return
        openBaseline = settings.openBaseline
        closedBaseline = settings.closedBaseline

        thread = HandlerThread("ShineCameraSwitch").also { it.start() }
        handler = Handler(thread!!.looper)
        reader = ImageReader.newInstance(
            analysisSize.width,
            analysisSize.height,
            android.graphics.ImageFormat.YUV_420_888,
            2
        ).apply {
            setOnImageAvailableListener({ imageReader ->
                imageReader.acquireLatestImage()?.use { analyze(it) }
            }, handler)
        }

        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } ?: return

        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                cameraDevice = camera
                createSession(camera)
            }

            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                cameraDevice = null
            }

            override fun onError(camera: CameraDevice, error: Int) {
                camera.close()
                cameraDevice = null
            }
        }, handler)
    }

    override fun stop() {
        session?.close()
        session = null
        cameraDevice?.close()
        cameraDevice = null
        reader?.close()
        reader = null
        thread?.quitSafely()
        thread = null
        handler = null
        closed = false
        closedStartedAt = 0L
    }

    private fun createSession(camera: CameraDevice) {
        val imageSurface = reader?.surface ?: return
        val texture = SurfaceTexture(0).apply {
            setDefaultBufferSize(analysisSize.width, analysisSize.height)
        }
        val previewSurface = Surface(texture)
        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
            addTarget(previewSurface)
            addTarget(imageSurface)
            set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
        }
        camera.createCaptureSession(listOf(previewSurface, imageSurface), object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(captureSession: CameraCaptureSession) {
                session = captureSession
                captureSession.setRepeatingRequest(request.build(), null, handler)
            }

            override fun onConfigureFailed(captureSession: CameraCaptureSession) = Unit
        }, handler)
    }

    private fun analyze(image: Image) {
        val settings = settingsProvider()
        if (!settings.enabled) return
        val frame = RawFrame.from(image)
        val features = readFeatures(frame) ?: return

        if (openBaseline == null) {
            openBaseline = features
            return
        }
        val score = sampledClosedScore(features)
        val now = System.currentTimeMillis()
        val threshold = 0.55
        if (!closed && score >= threshold) {
            closed = true
            closedStartedAt = now
            if (closedBaseline == null) closedBaseline = features
        } else if (closed && score < 0.35) {
            val duration = now - closedStartedAt
            closed = false
            if (duration >= settings.longBlinkMs && now - lastActivationAt >= settings.cooldownMs) {
                lastActivationAt = now
                sink.onInput(InputEvent(intent = "activate", source = settings.source, detail = "longBlinkMs=$duration"))
            }
        }
    }

    private fun readFeatures(rawFrame: RawFrame): EyeFeatures? {
        val rotations = mutableListOf<Int>()
        lastRoi?.rotation?.let { rotations.add(it) }
        rotations.addAll(listOf(0, 90, 270, 180))
        for (rotation in rotations.distinct()) {
            val frame = rawFrame.oriented(rotation)
            val face = detectFace(frame) ?: continue
            val roi = eyeBandForFace(frame, face, rotation)
            lastRoi = roi
            return featuresFromRoi(frame, roi.x, roi.y, roi.w, roi.h)
        }
        val last = lastRoi ?: return null
        val frame = rawFrame.oriented(last.rotation)
        return featuresFromRoi(frame, last.x, last.y, last.w, last.h)
    }

    private fun sampledClosedScore(features: EyeFeatures): Double {
        val open = openBaseline ?: return 0.0
        val closedSample = closedBaseline ?: return normalizedDrop(features.contrast + features.edge, open.contrast + open.edge)
        val distOpen = featureDistance(features, open)
        val distClosed = featureDistance(features, closedSample)
        val denominator = distOpen + distClosed
        if (denominator <= 0.000001) return 0.0
        return clamp(distOpen / denominator, 0.0, 1.0)
    }

    private fun detectFace(frame: OrientedFrame): FaceDetector.Face? {
        val width = if (frame.width % 2 == 0) frame.width else frame.width - 1
        if (width <= 0 || frame.height <= 0) return null
        val pixels = IntArray(width * frame.height)
        var target = 0
        for (y in 0 until frame.height) {
            val row = y * frame.width
            for (x in 0 until width) {
                val value = frame.luma[row + x].toInt() and 0xff
                pixels[target++] = Color.rgb(value, value, value)
            }
        }
        val bitmap = Bitmap.createBitmap(width, frame.height, Bitmap.Config.RGB_565)
        bitmap.setPixels(pixels, 0, width, 0, 0, width, frame.height)
        val faces = arrayOfNulls<FaceDetector.Face>(1)
        FaceDetector(width, frame.height, 1).findFaces(bitmap, faces)
        bitmap.recycle()
        return faces[0]
    }

    private fun eyeBandForFace(frame: OrientedFrame, face: FaceDetector.Face, rotation: Int): TrackedRoi {
        val midpoint = PointF()
        face.getMidPoint(midpoint)
        val eyesDistance = max(18f, face.eyesDistance())
        val roiW = clampInt((eyesDistance * 2.1f).toInt(), 20, frame.width)
        val roiH = clampInt((eyesDistance * 0.65f).toInt(), 12, frame.height)
        val x = clampInt((midpoint.x - roiW / 2f).toInt(), 0, frame.width - roiW)
        val y = clampInt((midpoint.y - roiH * 0.55f).toInt(), 0, frame.height - roiH)
        return TrackedRoi(rotation, x, y, roiW, roiH)
    }

    private data class TrackedRoi(val rotation: Int, val x: Int, val y: Int, val w: Int, val h: Int)
    private data class OrientedFrame(val width: Int, val height: Int, val luma: ByteArray)
    private data class RawFrame(val width: Int, val height: Int, val luma: ByteArray) {
        fun oriented(rotation: Int): OrientedFrame = when (rotation) {
            90 -> {
                val out = ByteArray(width * height)
                var target = 0
                for (x in 0 until width) for (y in height - 1 downTo 0) out[target++] = luma[y * width + x]
                OrientedFrame(height, width, out)
            }
            180 -> OrientedFrame(width, height, ByteArray(width * height).also { out ->
                var target = 0
                for (index in luma.indices.reversed()) out[target++] = luma[index]
            })
            270 -> {
                val out = ByteArray(width * height)
                var target = 0
                for (x in width - 1 downTo 0) for (y in 0 until height) out[target++] = luma[y * width + x]
                OrientedFrame(height, width, out)
            }
            else -> OrientedFrame(width, height, luma)
        }

        companion object {
            fun from(image: Image): RawFrame {
                val plane = image.planes[0]
                val buffer = plane.buffer
                val out = ByteArray(image.width * image.height)
                var target = 0
                for (y in 0 until image.height) {
                    for (x in 0 until image.width) {
                        out[target++] = buffer.get(y * plane.rowStride + x * plane.pixelStride)
                    }
                }
                return RawFrame(image.width, image.height, out)
            }
        }
    }

    private companion object {
        fun featuresFromRoi(frame: OrientedFrame, x0: Int, y0: Int, roiW: Int, roiH: Int): EyeFeatures {
            val x1 = min(frame.width, x0 + roiW)
            val y1 = min(frame.height, y0 + roiH)
            var sum = 0.0
            var sumSquares = 0.0
            var edge = 0.0
            var count = 0
            var previous = -1
            for (y in y0 until y1) {
                val row = y * frame.width
                for (x in x0 until x1) {
                    val raw = frame.luma[row + x].toInt() and 0xff
                    val value = raw / 255.0
                    sum += value
                    sumSquares += value * value
                    if (previous >= 0) edge += abs(value - previous / 255.0)
                    previous = raw
                    count += 1
                }
            }
            val mean = if (count > 0) sum / count else 0.0
            val variance = if (count > 0) max(0.0, sumSquares / count - mean * mean) else 0.0
            return EyeFeatures(mean, sqrt(variance), if (count > 0) edge / count else 0.0)
        }

        fun featureDistance(a: EyeFeatures, b: EyeFeatures): Double {
            val mean = (a.mean - b.mean) * 3.0
            val contrast = (a.contrast - b.contrast) * 6.0
            val edge = (a.edge - b.edge) * 10.0
            return sqrt(mean * mean + contrast * contrast + edge * edge)
        }

        fun normalizedDrop(value: Double, openValue: Double): Double {
            if (openValue <= 0.0001) return 0.0
            return clamp((openValue - value) / openValue, 0.0, 1.0)
        }

        fun clamp(value: Double, minValue: Double, maxValue: Double): Double =
            min(maxValue, max(minValue, value))

        fun clampInt(value: Int, minValue: Int, maxValue: Int): Int =
            min(maxValue, max(minValue, value))
    }
}
