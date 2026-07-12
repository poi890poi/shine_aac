package org.shineaac.inputs

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions

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
    private var detector: FaceDetector? = null
    private val analysisSize = Size(320, 240)
    private var mlKitInFlight = false
    private var lastFrameAt = 0L
    private var closedStartedAt = 0L
    private var closed = false
    private var lastActivationAt = 0L

    @SuppressLint("MissingPermission")
    override fun start() {
        stop()
        val settings = settingsProvider()
        if (!settings.enabled) return

        detector = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                .enableTracking()
                .setMinFaceSize(0.12f)
                .build()
        )

        thread = HandlerThread("ShineCameraSwitch").also { it.start() }
        handler = Handler(thread!!.looper)
        reader = ImageReader.newInstance(
            analysisSize.width,
            analysisSize.height,
            android.graphics.ImageFormat.YUV_420_888,
            2
        ).apply {
            setOnImageAvailableListener({ imageReader ->
                val image = imageReader.acquireLatestImage() ?: return@setOnImageAvailableListener
                analyze(image)
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
        detector?.close()
        detector = null
        thread?.quitSafely()
        thread = null
        handler = null
        mlKitInFlight = false
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
        if (!settings.enabled) {
            image.close()
            return
        }
        val now = System.currentTimeMillis()
        if (mlKitInFlight || now - lastFrameAt < MlKitFrameIntervalMs) {
            image.close()
            return
        }
        val activeDetector = detector
        if (activeDetector == null) {
            image.close()
            return
        }

        mlKitInFlight = true
        lastFrameAt = now
        activeDetector.process(InputImage.fromMediaImage(image, MlKitRotation))
            .addOnSuccessListener { faces ->
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val score = face?.closedScore()
                if (score != null) {
                    updateBlinkState(score, settings)
                }
            }
            .addOnCompleteListener {
                image.close()
                mlKitInFlight = false
            }
    }

    private fun updateBlinkState(score: Double, settings: CameraSwitchSettings) {
        val now = System.currentTimeMillis()
        if (!closed && score >= CloseScore) {
            closed = true
            closedStartedAt = now
            return
        }
        if (closed && score <= OpenScore) {
            val duration = now - closedStartedAt
            closed = false
            if (duration >= settings.longBlinkMs && now - lastActivationAt >= settings.cooldownMs) {
                lastActivationAt = now
                sink.onInput(InputEvent(intent = "activate", source = settings.source, detail = "longBlinkMs=$duration"))
            }
        }
    }

    private fun Face.closedScore(): Double? {
        val values = listOfNotNull(leftEyeOpenProbability, rightEyeOpenProbability).map { it.toDouble() }
        if (values.isEmpty()) return null
        return (1.0 - values.average()).coerceIn(0.0, 1.0)
    }

    private companion object {
        const val MlKitRotation = 270
        const val MlKitFrameIntervalMs = 90L
        const val CloseScore = 0.55
        const val OpenScore = 0.35
    }
}
