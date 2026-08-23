package org.shineaac.inputs

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Range
import android.util.Size
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraSwitchInputAdapter(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val settingsProvider: () -> CameraSwitchSettings,
    private val sink: InputSink
) : InputAdapter {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val mainExecutor = Executor { command -> mainHandler.post(command) }
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var analysisExecutor: ExecutorService? = null
    private var detector: FaceDetector? = null
    private var cheekAnalyzer: CheekFaceAnalyzer? = null
    private var tonePlayer: CameraSwitchTonePlayer? = null
    private val analysisSize = Size(480, 360)
    @Volatile private var mlKitInFlight = false
    @Volatile private var activeFrameId = NoFrame
    private var frameSequence = 0L
    private var lastFrameAt = 0L
    private var lastImageReceivedAt = 0L
    private var lastAnalysisCompletedAt = 0L
    private var lastStatusSentAt = 0L
    private var lastScoreSentAt = 0L
    private var lastReportedScore: Double? = null
    private var blinkClassifier = BlinkGestureClassifier()
    private var cheekClassifier: BinarySwitchClassifier? = null
    private val twitchDetector = CheekTwitchDetector()
    private var activeEnterThreshold = CheekTwitchDetector.DefaultEnterThreshold
    private var activeDetectionParameters = BlinkDetectionParameters()
    @Volatile private var activeSettings = CameraSwitchSettings()
    private var holdEventActive = false
    private var lastActivationAt = 0L
    private var activeSource = "android-camera-long-blink"
    private var generation = 0
    private var watchdogScheduled = false
    private var running = false

    @SuppressLint("MissingPermission")
    override fun start() {
        stop()
        generation += 1
        val startGeneration = generation
        val settings = settingsProvider()
        if (!settings.enabled) return
        activeSettings = settings
        activeDetectionParameters = settings.detectionParameters.normalized()
        blinkClassifier = BlinkGestureClassifier(activeDetectionParameters.classifierConfig())
        activeSource = settings.source
        running = true
        lastImageReceivedAt = nowMs()
        lastAnalysisCompletedAt = lastImageReceivedAt
        sendStatus("starting", force = true)

        if (settings.gesture == OpticalSwitchGesture.CheekTwitch) {
            // No saved model is no longer a refusal. The detector compares the face against its own
            // recent resting state, so the switch works immediately and calibration sharpens it.
            val model = settings.cheekModel
            twitchDetector.reset()
            cheekAnalyzer = try { CheekFaceAnalyzer(context) } catch (error: Exception) {
                Log.w(Tag, "Cheek detector initialization failed", error)
                sendStatus("detectorUnavailable", force = true)
                running = false
                return
            }
            cheekClassifier = BinarySwitchClassifier(
                BinarySwitchClassifier.Config(
                    enterThreshold = model?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold,
                    exitThreshold = model?.exitThreshold ?: CheekTwitchDetector.DefaultExitThreshold,
                    minimumHoldMs = settings.cheekHoldMs
                )
            )
            activeEnterThreshold = model?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold
            if (model == null) sendStatus("uncalibrated", force = true)
        } else {
            detector = FaceDetection.getClient(
                FaceDetectorOptions.Builder()
                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                    .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                    .enableTracking()
                    .setMinFaceSize(0.12f)
                    .build()
            )
        }
        tonePlayer = CameraSwitchTonePlayer()
        analysisExecutor = Executors.newSingleThreadExecutor { runnable ->
            Thread(runnable, "ShineCameraSwitchAnalysis").apply {
                isDaemon = true
            }
        }

        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener({
            val provider = try {
                providerFuture.get()
            } catch (error: Exception) {
                Log.w(Tag, "CameraX provider failed", error)
                sendStatus("cameraStale", force = true)
                return@addListener
            }
            if (startGeneration != generation || !running) return@addListener
            cameraProvider = provider
            bindAnalysisUseCase(provider, startGeneration)
        }, mainExecutor)
        scheduleWatchdog()
    }

    override fun stop() {
        generation += 1
        running = false
        watchdogScheduled = false
        imageAnalysis?.clearAnalyzer()
        imageAnalysis?.let { analysis ->
            try {
                cameraProvider?.unbind(analysis)
            } catch (error: Exception) {
                Log.w(Tag, "CameraX unbind failed", error)
            }
        }
        imageAnalysis = null
        cameraProvider = null
        detector?.close()
        detector = null
        cheekAnalyzer?.close()
        cheekAnalyzer = null
        cheekClassifier = null
        twitchDetector.reset()
        if (holdEventActive) {
            sendHoldEnd(activeSource, "stop")
        }
        sendStatus("stopped", force = true)
        tonePlayer?.release()
        tonePlayer = null
        analysisExecutor?.shutdownNow()
        analysisExecutor = null
        mlKitInFlight = false
        activeFrameId = NoFrame
        lastImageReceivedAt = 0L
        lastAnalysisCompletedAt = 0L
        lastStatusSentAt = 0L
        activeSettings = CameraSwitchSettings()
        blinkClassifier.reset()
        holdEventActive = false
    }

    @SuppressLint("MissingPermission")
    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun bindAnalysisUseCase(provider: ProcessCameraProvider, bindGeneration: Int) {
        val executor = analysisExecutor ?: return
        try {
            val selectedCamera = selectedCamera(provider) ?: run {
                sendStatus("cameraUnavailable", force = true)
                return
            }
            val builder = ImageAnalysis.Builder()
                .setResolutionSelector(
                    ResolutionSelector.Builder()
                        .setResolutionStrategy(
                            ResolutionStrategy(
                                analysisSize,
                                ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER
                            )
                        )
                        .build()
                )
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            if (activeSettings.gesture == OpticalSwitchGesture.CheekTwitch) {
                builder.setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
            }
            targetFpsRange(selectedCamera.cameraId)?.let { range ->
                Camera2Interop.Extender(builder)
                    .setCaptureRequestOption(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, range)
            }
            val analysis = builder
                .build()
                .also { useCase ->
                    useCase.setAnalyzer(executor) { imageProxy ->
                        analyze(imageProxy, bindGeneration)
                    }
                }
            imageAnalysis = analysis
            val camera = provider.bindToLifecycle(
                lifecycleOwner,
                selectedCamera.selector,
                analysis
            )
            applyZoom(camera, activeSettings.zoomRatio)
            sendStatus("active", force = true)
        } catch (error: Exception) {
            Log.w(Tag, "CameraX bind failed", error)
            imageAnalysis?.clearAnalyzer()
            imageAnalysis = null
            sendStatus("cameraStale", force = true)
        }
    }

    private fun applyZoom(camera: androidx.camera.core.Camera, requestedZoomRatio: Float) {
        val zoomState = camera.cameraInfo.zoomState.value
        val minZoom = zoomState?.minZoomRatio ?: 1.0f
        val maxZoom = zoomState?.maxZoomRatio ?: requestedZoomRatio
        val zoom = requestedZoomRatio.coerceIn(minZoom, maxZoom)
        camera.cameraControl.setZoomRatio(zoom)
    }

    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun selectedCamera(provider: ProcessCameraProvider): SelectedCamera? {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraXIds = provider.availableCameraInfos.mapNotNull { cameraInfo ->
            runCatching { Camera2CameraInfo.from(cameraInfo).cameraId }.getOrNull()
        }.toSet()
        val cameras = CameraSwitchCameraSelection.availableCameras(manager)
            .filter { it.cameraId in cameraXIds }
        val selected = CameraSwitchCameraSelection.choose(
            cameras = cameras,
            preferredCameraId = activeSettings.cameraId,
            preferredLensFacing = activeSettings.cameraLensFacing
        ) ?: return null
        val selector = CameraSelector.Builder()
            .addCameraFilter { cameraInfos ->
                cameraInfos.filter { cameraInfo ->
                    runCatching {
                        Camera2CameraInfo.from(cameraInfo).cameraId == selected.cameraId
                    }.getOrDefault(false)
                }
            }
            .build()
        return SelectedCamera(selected.cameraId, selector)
    }

    private fun targetFpsRange(cameraId: String): Range<Int>? {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val ranges = manager.getCameraCharacteristics(cameraId)
            .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?: return null
        val target = if (activeSettings.gesture == OpticalSwitchGesture.CheekTwitch) CheekTargetCameraFps else BlinkTargetCameraFps
        val maxFps = if (activeSettings.gesture == OpticalSwitchGesture.CheekTwitch) CheekMaxCameraFps else BlinkMaxCameraFps
        return ranges
            .filter { it.upper <= maxFps && it.upper >= MinCameraFps }
            .minWithOrNull(compareBy<Range<Int>> { kotlin.math.abs(it.upper - target) }.thenBy { it.lower })
            ?: ranges.minWithOrNull(compareBy<Range<Int>> { it.upper }.thenBy { it.lower })
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun analyze(imageProxy: ImageProxy, imageGeneration: Int) {
        if (imageGeneration != generation) {
            imageProxy.close()
            return
        }
        lastImageReceivedAt = nowMs()
        val settings = activeSettings
        if (!settings.enabled) {
            imageProxy.close()
            return
        }
        if (settings.gesture == OpticalSwitchGesture.CheekTwitch) {
            analyzeCheek(imageProxy, imageGeneration, settings)
            return
        }
        val now = nowMs()
        if (mlKitInFlight || now - lastFrameAt < MlKitFrameIntervalMs) {
            imageProxy.close()
            return
        }
        val activeDetector = detector
        val callbackExecutor = analysisExecutor
        if (activeDetector == null) {
            imageProxy.close()
            return
        }
        if (callbackExecutor == null) {
            imageProxy.close()
            return
        }
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        mlKitInFlight = true
        val frameId = ++frameSequence
        activeFrameId = frameId
        lastFrameAt = now
        val analysisGeneration = generation
        mainHandler.postDelayed({
            if (analysisGeneration == generation && activeFrameId == frameId && mlKitInFlight) {
                Log.w(Tag, "ML Kit frame timeout; marking detector stale")
                activeFrameId = NoFrame
                mlKitInFlight = false
                lastAnalysisCompletedAt = nowMs()
                blinkClassifier.reset()
                sendHoldEnd(activeSource, "reason=detectorTimeout")
                sendStatus("detectorStale", force = true)
                safeClose(imageProxy)
            }
        }, MlKitTimeoutMs)
        activeDetector.process(InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees))
            .addOnSuccessListener(callbackExecutor) { faces ->
                if (analysisGeneration != generation || activeFrameId != frameId) return@addOnSuccessListener
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val signal = face?.blinkEyeSignal(activeDetectionParameters)
                activeEnterThreshold = activeDetectionParameters.closeThreshold
                lastReportedScore = signal?.closedScore
                updateBlinkState(signal?.closedScore, signal?.reopenScore, settings)
            }
            .addOnFailureListener(callbackExecutor) { error ->
                Log.w(Tag, "ML Kit analysis failed", error)
            }
            .addOnCompleteListener(callbackExecutor) {
                if (analysisGeneration == generation && activeFrameId == frameId) {
                    lastAnalysisCompletedAt = nowMs()
                    mlKitInFlight = false
                    activeFrameId = NoFrame
                    reportScore(lastReportedScore, "analysis")
                }
                safeClose(imageProxy)
            }
    }

    private fun updateBlinkState(score: Double?, reopenScore: Double?, settings: CameraSwitchSettings) {
        val now = nowMs()
        for (event in blinkClassifier.onSignal(score, now, settings.longBlinkMs, reopenScore)) {
            when (event) {
                is BlinkGestureClassifier.Event.HoldStarted -> onHoldStarted(settings)
                is BlinkGestureClassifier.Event.Activated ->
                    onActivated(settings, now, "longBlinkMs=${event.durationMs}")
                is BlinkGestureClassifier.Event.HoldEnded ->
                    onHoldEnded(settings, "closedMs=${event.durationMs};reason=${event.reason.name}")
            }
        }
    }

    /**
     * The single activation path, shared by every optical gesture.
     *
     * Blink and cheek each used to carry their own copy of this - the same hold, cooldown and reset
     * sequence written twice - which meant the cheek gesture was running untested logic that the
     * blink gesture had already proven on real hardware. The gesture backends now only decide *when*
     * a hold starts, activates or ends; what happens next is one implementation.
     */
    private fun onHoldStarted(settings: CameraSwitchSettings) {
        sendHoldStart(settings.source)
    }

    private fun onActivated(settings: CameraSwitchSettings, now: Long, detail: String) {
        playHoldReachedCue()
        if (now - lastActivationAt < settings.cooldownMs) return
        lastActivationAt = now
        holdEventActive = false
        sink.onInput(InputEvent(intent = "activate", source = settings.source, detail = detail))
    }

    private fun onHoldEnded(settings: CameraSwitchSettings, detail: String) {
        sendHoldEnd(settings.source, detail)
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
        if (watchdogScheduled) return
        watchdogScheduled = true
        mainHandler.postDelayed(::runWatchdog, WatchdogIntervalMs)
    }

    private fun runWatchdog() {
        watchdogScheduled = false
        if (!running || !activeSettings.enabled) return
        val now = nowMs()
        val noImagesForMs = now - lastImageReceivedAt
        val noCompletedAnalysisForMs = now - lastAnalysisCompletedAt
        when {
            noImagesForMs >= FrameStallMs -> sendStatus("cameraStale", force = true)
            noCompletedAnalysisForMs >= AnalysisStallMs -> sendStatus("detectorStale", force = true)
            else -> scheduleWatchdog()
        }
        if (running && activeSettings.enabled) scheduleWatchdog()
    }

    private fun sendStatus(state: String, force: Boolean = false) {
        val now = nowMs()
        if (!force && now - lastStatusSentAt < StatusIntervalMs) return
        lastStatusSentAt = now
        sink.onInput(
            InputEvent(
                intent = "cameraStatus",
                source = activeSource,
                detail = "state=$state" + scoreDetail()
            )
        )
    }

    /**
     * Publishes how close the current face is to firing the switch.
     *
     * Without this the board gives no clue why nothing is happening: a user cannot tell a movement
     * that nearly worked from a camera that is not seeing them at all. It rides on the existing
     * status event so the board needs no new element for it.
     */
    private fun reportScore(score: Double?, state: String) {
        val now = nowMs()
        lastReportedScore = score
        if (now - lastScoreSentAt < ScoreIntervalMs) return
        lastScoreSentAt = now
        lastStatusSentAt = now
        sink.onInput(
            InputEvent(
                intent = "cameraStatus",
                source = activeSource,
                detail = "state=$state" + scoreDetail()
            )
        )
    }

    private fun scoreDetail(): String {
        val score = lastReportedScore ?: return ""
        val threshold = activeEnterThreshold
        return ";score=" + String.format("%.3f", score.coerceIn(0.0, 1.5)) +
            ";threshold=" + String.format("%.3f", threshold)
    }

    private fun safeClose(imageProxy: ImageProxy) {
        try {
            imageProxy.close()
        } catch (_: Exception) {
            // Late ML Kit completions can race with timeout cleanup.
        }
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun analyzeCheek(imageProxy: ImageProxy, imageGeneration: Int, settings: CameraSwitchSettings) {
        val now = nowMs()
        if (now - lastFrameAt < CheekFrameIntervalMs) {
            imageProxy.close()
            return
        }
        val analyzer = cheekAnalyzer
        if (analyzer == null) {
            imageProxy.close()
            return
        }
        val model = settings.cheekModel
        lastFrameAt = now
        try {
            val observation = analyzer.analyzeRgba(
                imageProxy.width,
                imageProxy.height,
                imageProxy.planes[0].buffer,
                imageProxy.imageInfo.rotationDegrees,
                now
            )
            val values = observation?.takeIf { it.usable }?.blendshapes
            // Feed the detector every usable frame so its resting baseline tracks the current face,
            // and use its score whenever no calibrated model is stored.
            val fallback = values?.let { twitchDetector.observe(it) }
            val score = values?.let { frame -> model?.score(frame) } ?: fallback
            updateCheekState(score, settings, now)
            lastAnalysisCompletedAt = nowMs()
            reportScore(score, "analysis")
        } catch (error: Exception) {
            Log.w(Tag, "Cheek analysis failed", error)
            cheekClassifier?.onScore(null, now)
        } finally {
            if (imageGeneration == generation) lastAnalysisCompletedAt = nowMs()
            safeClose(imageProxy)
        }
    }

    private fun updateCheekState(score: Double?, settings: CameraSwitchSettings, now: Long) {
        val classifier = cheekClassifier ?: return
        for (event in classifier.onScore(score, now)) {
            when (event) {
                BinarySwitchClassifier.Event.HoldStarted -> onHoldStarted(settings)
                is BinarySwitchClassifier.Event.Activated ->
                    onActivated(settings, now, "cheekTwitchMs=${event.heldMs}")
                is BinarySwitchClassifier.Event.HoldEnded ->
                    onHoldEnded(settings, "reason=${event.reason.name}")
            }
        }
    }

    private fun nowMs(): Long = SystemClock.elapsedRealtime()

    private companion object {
        const val NoFrame = -1L
        const val MlKitFrameIntervalMs = 100L
        const val BlinkTargetCameraFps = 10
        const val CheekTargetCameraFps = 24
        const val MinCameraFps = 5
        const val BlinkMaxCameraFps = 15
        const val CheekMaxCameraFps = 30
        const val CheekFrameIntervalMs = 40L
        const val MlKitTimeoutMs = 2500L
        const val WatchdogIntervalMs = 1000L
        const val FrameStallMs = 3500L
        const val AnalysisStallMs = 3500L
        const val StatusIntervalMs = 650L
        const val ScoreIntervalMs = 180L
        const val Tag = "ShineCameraSwitch"
    }

    private data class SelectedCamera(val cameraId: String, val selector: CameraSelector)
}
