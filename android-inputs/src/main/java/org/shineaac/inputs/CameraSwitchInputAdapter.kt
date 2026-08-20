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
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.Locale

class CameraSwitchInputAdapter(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val settingsProvider: () -> CameraSwitchSettings,
    private val sink: InputSink,
    private val diagnostics: CameraSwitchDiagnostics? = null
) : InputAdapter {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val mainExecutor = Executor { command -> mainHandler.post(command) }
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var analysisExecutor: ExecutorService? = null
    private var detector: FaceDetector? = null
    private var tonePlayer: CameraSwitchTonePlayer? = null
    private val analysisSize = Size(480, 360)
    @Volatile private var mlKitInFlight = false
    @Volatile private var activeFrameId = NoFrame
    @Volatile private var activeImageProxy: ImageProxy? = null
    private var frameSequence = 0L
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
    private var running = false
    @Volatile private var diagnosticFrameStatus = "analysis"
    @Volatile private var diagnosticFrameDetail = ""

    @SuppressLint("MissingPermission")
    override fun start() {
        stop()
        generation += 1
        val startGeneration = generation
        val settings = settingsProvider()
        if (!settings.enabled) return
        trace("adapterStart") {
            mapOf(
                "generation" to startGeneration,
                "longBlinkMs" to settings.longBlinkMs,
                "cooldownMs" to settings.cooldownMs,
                "zoomRatio" to settings.zoomRatio
            )
        }
        activeSource = settings.source
        running = true
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
        trace("adapterStop") { mapOf("generation" to generation, "running" to running) }
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
        activeFrameId = NoFrame
        mlKitInFlight = false
        activeImageProxy?.let(::safeClose)
        activeImageProxy = null
        detector?.close()
        detector = null
        if (holdEventActive) {
            sendHoldEnd(activeSource, "stop")
        }
        sendStatus("stopped", force = true)
        tonePlayer?.release()
        tonePlayer = null
        analysisExecutor?.shutdownNow()
        analysisExecutor = null
        lastImageReceivedAt = 0L
        lastAnalysisCompletedAt = 0L
        lastStatusSentAt = 0L
        blinkClassifier.reset()
        holdEventActive = false
        diagnosticFrameStatus = "analysis"
        diagnosticFrameDetail = ""
    }

    @SuppressLint("MissingPermission")
    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun bindAnalysisUseCase(provider: ProcessCameraProvider, bindGeneration: Int) {
        val executor = analysisExecutor ?: return
        try {
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
            targetFpsRange()?.let { range ->
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
                CameraSelector.DEFAULT_FRONT_CAMERA,
                analysis
            )
            applyZoom(camera, settingsProvider().zoomRatio)
            trace("cameraBound") { mapOf("generation" to bindGeneration, "analysisSize" to "${analysisSize.width}x${analysisSize.height}") }
            sendStatus("active", force = true)
        } catch (error: Exception) {
            Log.w(Tag, "CameraX bind failed", error)
            imageAnalysis?.clearAnalyzer()
            imageAnalysis = null
            sendStatus("cameraStale", force = true)
            trace("cameraBindFailure") { mapOf("error" to error.javaClass.name, "message" to error.message) }
        }
    }

    private fun applyZoom(camera: androidx.camera.core.Camera, requestedZoomRatio: Float) {
        val zoomState = camera.cameraInfo.zoomState.value
        val minZoom = zoomState?.minZoomRatio ?: 1.0f
        val maxZoom = zoomState?.maxZoomRatio ?: requestedZoomRatio
        val zoom = requestedZoomRatio.coerceIn(minZoom, maxZoom)
        camera.cameraControl.setZoomRatio(zoom)
    }

    private fun targetFpsRange(): Range<Int>? {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } ?: return null
        val ranges = manager.getCameraCharacteristics(cameraId)
            .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?: return null
        return ranges
            .filter { it.upper <= MaxCameraFps && it.upper >= MinCameraFps }
            .minWithOrNull(compareBy<Range<Int>> { kotlin.math.abs(it.upper - TargetCameraFps) }.thenBy { it.lower })
            ?: ranges.minWithOrNull(compareBy<Range<Int>> { it.upper }.thenBy { it.lower })
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun analyze(imageProxy: ImageProxy, imageGeneration: Int) {
        if (imageGeneration != generation) {
            imageProxy.close()
            return
        }
        lastImageReceivedAt = System.currentTimeMillis()
        val settings = settingsProvider()
        if (!settings.enabled) {
            imageProxy.close()
            return
        }
        val now = System.currentTimeMillis()
        if (mlKitInFlight || now - lastFrameAt < MlKitFrameIntervalMs) {
            imageProxy.close()
            return
        }
        val activeDetector = detector
        if (activeDetector == null) {
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
        activeImageProxy = imageProxy
        lastFrameAt = now
        val analysisGeneration = generation
        val submittedAtElapsedMs = SystemClock.elapsedRealtime()
        trace("frameSubmitted") { mapOf("frameId" to frameId, "generation" to analysisGeneration) }
        mainHandler.postDelayed({
            if (analysisGeneration == generation && activeFrameId == frameId && mlKitInFlight) {
                Log.w(Tag, "ML Kit frame timeout; marking detector stale")
                activeFrameId = NoFrame
                mlKitInFlight = false
                lastAnalysisCompletedAt = System.currentTimeMillis()
                blinkClassifier.reset()
                sendHoldEnd(activeSource, "reason=detectorTimeout")
                sendStatus("detectorStale", force = true)
                trace("frameTimeout") { mapOf("frameId" to frameId, "timeoutMs" to MlKitTimeoutMs) }
                safeClose(imageProxy)
                if (activeImageProxy === imageProxy) activeImageProxy = null
            }
        }, MlKitTimeoutMs)
        activeDetector.process(InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees))
            .addOnSuccessListener(mainExecutor) { faces ->
                if (analysisGeneration != generation || activeFrameId != frameId) return@addOnSuccessListener
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val signal = face?.eyeSignal() ?: EyeSignal(rejection = "noFace")
                updateBlinkState(signal.score, signal.reopenScore, settings)
                val snapshot = blinkClassifier.diagnosticSnapshot(signal.score, signal.reopenScore)
                diagnosticFrameStatus = when {
                    signal.rejection != null -> "signalMissing"
                    snapshot.state == "ActivatedWaitOpen" -> "waitingOpen"
                    snapshot.state == "ClosedHolding" -> "blink"
                    snapshot.reopenBand == "Open" -> "analysis"
                    snapshot.signalBand == "Ambiguous" -> "signalAmbiguous"
                    else -> "analysis"
                }
                diagnosticFrameDetail = listOfNotNull(
                    signal.score?.let { "score=${String.format(Locale.US, "%.3f", it)}" },
                    signal.reopenScore?.let { "reopen=${String.format(Locale.US, "%.3f", it)}" },
                    "band=${snapshot.signalBand}",
                    "classifier=${snapshot.state}",
                    signal.rejection?.let { "rejection=$it" }
                ).joinToString(";")
                trace("frameResult") {
                    mapOf(
                        "frameId" to frameId,
                        "latencyMs" to (SystemClock.elapsedRealtime() - submittedAtElapsedMs),
                        "faceCount" to faces.size,
                        "leftEyeOpen" to signal.leftEyeOpen,
                        "rightEyeOpen" to signal.rightEyeOpen,
                        "closedScore" to signal.score,
                        "reopenScore" to signal.reopenScore,
                        "rejection" to signal.rejection,
                        "yaw" to signal.yaw,
                        "roll" to signal.roll,
                        "faceWidth" to signal.faceWidth,
                        "faceHeight" to signal.faceHeight,
                        "faceLeft" to signal.faceLeft,
                        "faceTop" to signal.faceTop,
                        "trackingId" to signal.trackingId,
                        "classifierState" to snapshot.state,
                        "signalBand" to snapshot.signalBand,
                        "reopenBand" to snapshot.reopenBand,
                        "hasOpenBaseline" to snapshot.hasOpenBaseline,
                        "closingForMs" to snapshot.closingForMs,
                        "closedForMs" to snapshot.closedForMs,
                        "openCandidateForMs" to snapshot.openCandidateForMs,
                        "signalLostForMs" to snapshot.signalLostForMs
                    )
                }
            }
            .addOnFailureListener(mainExecutor) { error ->
                Log.w(Tag, "ML Kit analysis failed", error)
                diagnosticFrameStatus = "analysisFailure"
                diagnosticFrameDetail = "error=${error.javaClass.simpleName}"
                trace("frameFailure") {
                    mapOf(
                        "frameId" to frameId,
                        "latencyMs" to (SystemClock.elapsedRealtime() - submittedAtElapsedMs),
                        "error" to error.javaClass.name,
                        "message" to error.message
                    )
                }
            }
            .addOnCompleteListener(mainExecutor) {
                if (analysisGeneration == generation && activeFrameId == frameId) {
                    lastAnalysisCompletedAt = System.currentTimeMillis()
                    mlKitInFlight = false
                    activeFrameId = NoFrame
                    sendStatus(diagnosticFrameStatus, extraDetail = diagnosticFrameDetail)
                }
                safeClose(imageProxy)
                if (activeImageProxy === imageProxy) activeImageProxy = null
            }
    }

    private fun updateBlinkState(score: Double?, reopenScore: Double?, settings: CameraSwitchSettings) {
        val now = System.currentTimeMillis()
        for (event in blinkClassifier.onSignal(score, now, settings.longBlinkMs, reopenScore)) {
            trace("classifierEvent") {
                mapOf(
                    "event" to event.javaClass.simpleName,
                    "score" to score,
                    "detail" to when (event) {
                        is BlinkGestureClassifier.Event.HoldStarted -> "startedAtMs=${event.startedAtMs}"
                        is BlinkGestureClassifier.Event.Activated -> "durationMs=${event.durationMs}"
                        is BlinkGestureClassifier.Event.HoldEnded -> "durationMs=${event.durationMs};reason=${event.reason.name}"
                    }
                )
            }
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
                        trace("activationDelivered") { mapOf("durationMs" to event.durationMs) }
                    } else {
                        trace("activationSuppressed") { mapOf("reason" to "cooldown", "sinceLastMs" to (now - lastActivationAt)) }
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
        if (watchdogScheduled) return
        watchdogScheduled = true
        mainHandler.postDelayed(::runWatchdog, WatchdogIntervalMs)
    }

    private fun runWatchdog() {
        watchdogScheduled = false
        if (!running || !settingsProvider().enabled) return
        val now = System.currentTimeMillis()
        val noImagesForMs = now - lastImageReceivedAt
        val noCompletedAnalysisForMs = now - lastAnalysisCompletedAt
        when {
            noImagesForMs >= FrameStallMs -> sendStatus("cameraStale", force = true)
            noCompletedAnalysisForMs >= AnalysisStallMs -> sendStatus("detectorStale", force = true)
            else -> scheduleWatchdog()
        }
        if (running && settingsProvider().enabled) scheduleWatchdog()
    }

    private fun sendStatus(state: String, force: Boolean = false, extraDetail: String = "") {
        val now = System.currentTimeMillis()
        if (!force && now - lastStatusSentAt < StatusIntervalMs) return
        lastStatusSentAt = now
        sink.onInput(
            InputEvent(
                intent = "cameraStatus",
                source = activeSource,
                detail = "state=$state" + extraDetail.takeIf { it.isNotBlank() }?.let { ";$it" }.orEmpty()
            )
        )
        trace("status") { mapOf("state" to state, "force" to force) }
    }

    private fun safeClose(imageProxy: ImageProxy) {
        try {
            imageProxy.close()
        } catch (_: Exception) {
            // Late ML Kit completions can race with timeout cleanup.
        }
    }

    private fun Face.eyeSignal(): EyeSignal {
        val left = leftEyeOpenProbability?.toDouble()
        val right = rightEyeOpenProbability?.toDouble()
        val rejection = when {
            left == null -> "leftEyeUnavailable"
            right == null -> "rightEyeUnavailable"
            kotlin.math.abs(headEulerAngleY) > MaxYawDegrees -> "yawOutOfRange"
            kotlin.math.abs(headEulerAngleZ) > MaxRollDegrees -> "rollOutOfRange"
            boundingBox.width() < MinFaceWidthPx || boundingBox.height() < MinFaceHeightPx -> "faceTooSmall"
            else -> null
        }
        val score = if (rejection == null && left != null && right != null) {
            (1.0 - ((left + right) / 2.0)).coerceIn(0.0, 1.0)
        } else {
            null
        }
        val reopenScore = if (rejection == null && left != null && right != null) {
            (1.0 - maxOf(left, right)).coerceIn(0.0, 1.0)
        } else {
            null
        }
        return EyeSignal(
            leftEyeOpen = left,
            rightEyeOpen = right,
            score = score,
            reopenScore = reopenScore,
            rejection = rejection,
            yaw = headEulerAngleY,
            roll = headEulerAngleZ,
            faceWidth = boundingBox.width(),
            faceHeight = boundingBox.height(),
            faceLeft = boundingBox.left,
            faceTop = boundingBox.top,
            trackingId = trackingId
        )
    }

    private fun trace(event: String, fields: () -> Map<String, Any?>) {
        diagnostics?.record(event, fields())
    }

    private data class EyeSignal(
        val leftEyeOpen: Double? = null,
        val rightEyeOpen: Double? = null,
        val score: Double? = null,
        val reopenScore: Double? = null,
        val rejection: String? = null,
        val yaw: Float? = null,
        val roll: Float? = null,
        val faceWidth: Int? = null,
        val faceHeight: Int? = null,
        val faceLeft: Int? = null,
        val faceTop: Int? = null,
        val trackingId: Int? = null
    )

    private companion object {
        const val NoFrame = -1L
        const val MlKitFrameIntervalMs = 200L
        const val TargetCameraFps = 10
        const val MinCameraFps = 5
        const val MaxCameraFps = 15
        const val MlKitTimeoutMs = 2500L
        const val WatchdogIntervalMs = 1000L
        const val FrameStallMs = 3500L
        const val AnalysisStallMs = 3500L
        const val StatusIntervalMs = 650L
        const val MaxYawDegrees = 25f
        const val MaxRollDegrees = 25f
        const val MinFaceWidthPx = 40
        const val MinFaceHeightPx = 48
        const val Tag = "ShineCameraSwitch"
    }
}
