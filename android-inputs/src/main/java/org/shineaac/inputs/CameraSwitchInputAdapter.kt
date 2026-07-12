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
import android.util.Log
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
    private var tonePlayer: CameraSwitchTonePlayer? = null
    private val analysisSize = Size(320, 240)
    private var mlKitInFlight = false
    private var lastFrameAt = 0L
    private var lastImageReceivedAt = 0L
    private var lastAnalysisCompletedAt = 0L
    private var lastStatusSentAt = 0L
    private val blinkClassifier = BlinkGestureClassifier()
    private var holdEventActive = false
    private var lastActivationAt = 0L
    private var activeSource = "android-camera-long-blink"
    private var generation = 0
    private var watchdogScheduled = false

    @SuppressLint("MissingPermission")
    override fun start() {
        stop()
        generation += 1
        val startGeneration = generation
        val settings = settingsProvider()
        if (!settings.enabled) return
        activeSource = settings.source
        lastImageReceivedAt = System.currentTimeMillis()
        lastAnalysisCompletedAt = lastImageReceivedAt
        sendStatus("starting", force = true)

        detector = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                .enableTracking()
                .setMinFaceSize(0.12f)
                .build()
        )
        tonePlayer = CameraSwitchTonePlayer()

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
                analyze(image, startGeneration)
            }, handler)
        }

        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } ?: return

        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                if (startGeneration != generation) {
                    camera.close()
                    return
                }
                cameraDevice = camera
                createSession(camera)
            }

            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                cameraDevice = null
            }

            override fun onError(camera: CameraDevice, error: Int) {
                Log.w(Tag, "camera error $error")
                camera.close()
                cameraDevice = null
                sendStatus("stale", force = true)
            }
        }, handler)
        scheduleWatchdog()
    }

    override fun stop() {
        generation += 1
        watchdogScheduled = false
        handler?.removeCallbacksAndMessages(null)
        session?.close()
        session = null
        cameraDevice?.close()
        cameraDevice = null
        reader?.close()
        reader = null
        detector?.close()
        detector = null
        if (holdEventActive) {
            sendHoldEnd(activeSource, "stop")
        }
        sendStatus("stopped", force = true)
        tonePlayer?.release()
        tonePlayer = null
        thread?.quitSafely()
        thread = null
        handler = null
        mlKitInFlight = false
        lastImageReceivedAt = 0L
        lastAnalysisCompletedAt = 0L
        lastStatusSentAt = 0L
        blinkClassifier.reset()
        holdEventActive = false
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

    private fun analyze(image: Image, imageGeneration: Int) {
        if (imageGeneration != generation) {
            safeClose(image)
            return
        }
        lastImageReceivedAt = System.currentTimeMillis()
        val settings = settingsProvider()
        if (!settings.enabled) {
            safeClose(image)
            return
        }
        val now = System.currentTimeMillis()
        if (mlKitInFlight || now - lastFrameAt < MlKitFrameIntervalMs) {
            safeClose(image)
            return
        }
        val activeDetector = detector
        if (activeDetector == null) {
            safeClose(image)
            return
        }

        mlKitInFlight = true
        lastFrameAt = now
        val analysisGeneration = generation
        handler?.postDelayed({
            if (analysisGeneration == generation && mlKitInFlight) {
                Log.w(Tag, "ML Kit frame timeout; marking detector stale")
                sendStatus("stale", force = true)
            }
        }, MlKitTimeoutMs)
        activeDetector.process(InputImage.fromMediaImage(image, MlKitRotation))
            .addOnSuccessListener { faces ->
                if (analysisGeneration != generation) return@addOnSuccessListener
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val score = face?.closedScore()
                updateBlinkState(score, settings)
            }
            .addOnFailureListener { error ->
                Log.w(Tag, "ML Kit analysis failed", error)
            }
            .addOnCompleteListener {
                if (analysisGeneration == generation) {
                    lastAnalysisCompletedAt = System.currentTimeMillis()
                    mlKitInFlight = false
                    sendStatus("analysis")
                }
                safeClose(image)
            }
    }

    private fun updateBlinkState(score: Double?, settings: CameraSwitchSettings) {
        val now = System.currentTimeMillis()
        for (event in blinkClassifier.onSignal(score, now, settings.longBlinkMs)) {
            when (event) {
                is BlinkGestureClassifier.Event.HoldStarted -> {
                    sendHoldStart(settings.source)
                }
                is BlinkGestureClassifier.Event.Activated -> {
                    playHoldReachedCue()
                    if (now - lastActivationAt >= settings.cooldownMs) {
                        lastActivationAt = now
                        holdEventActive = false
                        sink.onInput(InputEvent(intent = "activate", source = settings.source, detail = "longBlinkMs=${event.durationMs}"))
                    }
                }
                is BlinkGestureClassifier.Event.HoldEnded -> {
                    sendHoldEnd(settings.source, "closedMs=${event.durationMs};reason=${event.reason.name}")
                }
            }
        }
    }

    private fun sendHoldStart(source: String) {
        if (holdEventActive) return
        holdEventActive = true
        sink.onInput(InputEvent(intent = "holdStart", source = source, detail = "eyesClosed"))
    }

    private fun sendHoldEnd(source: String, detail: String) {
        if (!holdEventActive) return
        holdEventActive = false
        sink.onInput(InputEvent(intent = "holdEnd", source = source, detail = detail))
    }

    private fun playHoldReachedCue() {
        tonePlayer?.playHoldReached()
    }

    private fun scheduleWatchdog() {
        val activeHandler = handler ?: return
        if (watchdogScheduled) return
        watchdogScheduled = true
        activeHandler.postDelayed(::runWatchdog, WatchdogIntervalMs)
    }

    private fun runWatchdog() {
        watchdogScheduled = false
        if (!settingsProvider().enabled || cameraDevice == null) return
        val now = System.currentTimeMillis()
        val noImagesForMs = now - lastImageReceivedAt
        val noCompletedAnalysisForMs = now - lastAnalysisCompletedAt
        when {
            noImagesForMs >= FrameStallMs -> sendStatus("stale", force = true)
            noCompletedAnalysisForMs >= AnalysisStallMs -> sendStatus("stale", force = true)
            else -> scheduleWatchdog()
        }
        if (settingsProvider().enabled && cameraDevice != null) scheduleWatchdog()
    }

    private fun safeClose(image: Image) {
        try {
            image.close()
        } catch (_: Exception) {
            // Image may already be closed by a timeout path.
        }
    }

    private fun sendStatus(state: String, force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - lastStatusSentAt < StatusIntervalMs) return
        lastStatusSentAt = now
        sink.onInput(
            InputEvent(
                intent = "cameraStatus",
                source = activeSource,
                detail = "state=$state"
            )
        )
    }

    private fun Face.closedScore(): Double? {
        val values = listOfNotNull(leftEyeOpenProbability, rightEyeOpenProbability).map { it.toDouble() }
        if (values.isEmpty()) return null
        return (1.0 - values.average()).coerceIn(0.0, 1.0)
    }

    private companion object {
        const val MlKitRotation = 270
        const val MlKitFrameIntervalMs = 120L
        const val MlKitTimeoutMs = 2500L
        const val WatchdogIntervalMs = 1000L
        const val FrameStallMs = 3500L
        const val AnalysisStallMs = 3500L
        const val StatusIntervalMs = 650L
        const val Tag = "ShineCameraSwitch"
    }
}
