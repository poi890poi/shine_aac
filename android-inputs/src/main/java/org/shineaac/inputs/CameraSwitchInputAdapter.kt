package org.shineaac.inputs

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.usb.UsbDevice
import android.media.ImageReader
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Range
import android.util.Size
import android.view.Surface
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2CameraControl
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.CaptureRequestOptions
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.lifecycle.LifecycleOwner
import com.jiangdg.usb.USBMonitor
import com.jiangdg.uvc.IFrameCallback
import com.jiangdg.uvc.UVCCamera
import java.nio.ByteBuffer
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
    private var activeCamera: Camera? = null
    private var activeCameraId: String? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var usbMonitor: USBMonitor? = null
    private var uvcCamera: UVCCamera? = null
    private var uvcDrainReader: ImageReader? = null
    private var uvcPreviewSurface: Surface? = null
    private var selectedUvcCameraId: String? = null
    private var activeUvcDeviceName: String? = null
    @Volatile private var uvcFrameQueued = false
    @Volatile private var uvcFrameWidth = 0
    @Volatile private var uvcFrameHeight = 0
    private var analysisExecutor: ExecutorService? = null
    private var faceAnalyzer: CheekFaceAnalyzer? = null
    private var cheekDetector = CheekTwitchDetector()
    private var cheekClassifier = BinarySwitchClassifier(
        BinarySwitchClassifier.Config(
            enterThreshold = CheekTwitchDetector.DefaultEnterThreshold,
            exitThreshold = CheekTwitchDetector.DefaultExitThreshold
        )
    )
    private var tonePlayer: CameraSwitchTonePlayer? = null
    private val analysisSize = Size(480, 360)
    private var lastFrameAt = 0L
    private var lastImageReceivedAt = 0L
    private var lastAnalysisCompletedAt = 0L
    private var lastStatusSentAt = 0L
    private var facePerfFrames = 0
    private var facePerfTotalNs = 0L
    private var facePerfMaxNs = 0L
    private var lastReportedScore: Double? = null
    private var activeEnterThreshold = CheekTwitchDetector.DefaultEnterThreshold
    private var blinkClassifier = BlinkGestureClassifier()
    private var activeDetectionParameters = BlinkDetectionParameters()
    private var holdEventActive = false
    private var lastActivationAt = 0L
    private var activeSource = "android-camera-long-blink"
    private var activeCameraMirrored = true
    private var generation = 0
    private var watchdogScheduled = false
    private var running = false
    @Volatile private var powerSavingIdle = false

    fun setPowerSavingIdle(enabled: Boolean) {
        if (powerSavingIdle == enabled) return
        powerSavingIdle = enabled
        mainHandler.post {
            if (!running) return@post
            applyTargetCameraFps()
            sendStatus(if (enabled) "powerSaving" else "active", force = true)
        }
    }

    @SuppressLint("MissingPermission")
    override fun start() {
        stop()
        generation += 1
        val startGeneration = generation
        val settings = settingsProvider()
        if (!settings.enabled) return
        activeDetectionParameters = settings.detectionParameters.normalized()
        blinkClassifier = BlinkGestureClassifier(activeDetectionParameters.classifierConfig())

        cheekDetector = CheekTwitchDetector()
        val cheekModel = settings.cheekModel
        cheekClassifier = BinarySwitchClassifier(
            BinarySwitchClassifier.Config(
                enterThreshold = cheekModel?.enterThreshold
                    ?: CheekTwitchDetector.DefaultEnterThreshold,
                exitThreshold = cheekModel?.exitThreshold
                    ?: CheekTwitchDetector.DefaultExitThreshold,
                minimumHoldMs = settings.cheekHoldMs
            )
        )

        activeSource = settings.source
        running = true
        lastImageReceivedAt = System.currentTimeMillis()
        lastAnalysisCompletedAt = lastImageReceivedAt
        sendStatus("starting", force = true)

        faceAnalyzer = runCatching { CheekFaceAnalyzer(context) }
            .onFailure { error ->
                Log.e(Tag, "MediaPipe face detector initialization failed", error)
            }
            .getOrNull()
        if (faceAnalyzer == null) {
            running = false
            sendStatus("detectorUnavailable", force = true)
            return
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
        activeCamera = null
        activeCameraId = null
        cameraProvider = null
        stopUvcCamera()
        faceAnalyzer?.close()
        faceAnalyzer = null
        if (holdEventActive) {
            sendHoldEnd(activeSource, "stop")
        }
        sendStatus("stopped", force = true)
        tonePlayer?.release()
        tonePlayer = null
        analysisExecutor?.shutdownNow()
        analysisExecutor = null
        uvcFrameQueued = false
        lastImageReceivedAt = 0L
        lastAnalysisCompletedAt = 0L
        lastStatusSentAt = 0L
        facePerfFrames = 0
        facePerfTotalNs = 0L
        facePerfMaxNs = 0L
        blinkClassifier.reset()
        cheekDetector.reset()
        cheekClassifier.reset()
        holdEventActive = false
    }

    @SuppressLint("MissingPermission")
    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun bindAnalysisUseCase(
        provider: ProcessCameraProvider,
        bindGeneration: Int
    ) {
        val executor = analysisExecutor ?: return
        try {
            val selectedCamera = selectedCamera(provider) ?: run {
                sendStatus("cameraUnavailable", force = true)
                return
            }
            if (selectedCamera.source == CameraSwitchCameraSource.Uvc) {
                startUvcCamera(selectedCamera, bindGeneration)
                return
            }
            activeCameraMirrored =
                selectedCamera.lensFacing ==
                    CameraCharacteristics.LENS_FACING_FRONT
            val builder = ImageAnalysis.Builder()
            builder.setOutputImageFormat(
                ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888
            )
            builder
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
                .setBackpressureStrategy(
                    ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST
                )
            targetFpsRange(selectedCamera.cameraId, requestedCameraFps())?.let { range ->
                Camera2Interop.Extender(builder).setCaptureRequestOption(
                    CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
                    range
                )
            }
            val analysis = builder.build().also { useCase ->
                useCase.setAnalyzer(executor) { imageProxy ->
                    analyze(imageProxy, bindGeneration)
                }
            }
            imageAnalysis = analysis
            val camera = provider.bindToLifecycle(
                lifecycleOwner,
                checkNotNull(selectedCamera.selector),
                analysis
            )
            activeCamera = camera
            activeCameraId = selectedCamera.cameraId
            applyZoom(camera, settingsProvider().zoomRatio)
            Log.i(
                Tag,
                "OPTICAL_CAMERA runtimeId=${selectedCamera.cameraId} " +
                    "facing=${cameraFacingLogName(selectedCamera.lensFacing)} " +
                    "selector=saved-or-default"
            )
            sendStatus("active", force = true)
        } catch (error: Exception) {
            Log.w(Tag, "CameraX bind failed", error)
            imageAnalysis?.clearAnalyzer()
            imageAnalysis = null
            sendStatus("cameraStale", force = true)
        }
    }

    private fun startUvcCamera(
        selectedCamera: SelectedCamera,
        bindGeneration: Int
    ) {
        selectedUvcCameraId = selectedCamera.cameraId
        activeCameraMirrored = false
        val monitor = USBMonitor.getInstance(context.applicationContext).apply {
            setOnDeviceConnectListener(object : USBMonitor.OnDeviceConnectListener {
                override fun onAttach(device: UsbDevice) {
                    if (bindGeneration != generation || !running ||
                        !UvcCameraDiscovery.isUvcDevice(device) || uvcCamera != null
                    ) return
                    selectedUvcCameraId = UvcCameraDiscovery.cameraId(device)
                    usbMonitor?.requestPermission(device)
                }

                override fun onConnect(
                    device: UsbDevice,
                    ctrlBlock: USBMonitor.UsbControlBlock,
                    createNew: Boolean
                ) {
                    if (bindGeneration != generation || !running ||
                        !UvcCameraDiscovery.isUvcDevice(device)
                    ) return
                    openUvcCamera(device, ctrlBlock, bindGeneration)
                }

                override fun onDisconnect(
                    device: UsbDevice,
                    ctrlBlock: USBMonitor.UsbControlBlock
                ) {
                    if (device.deviceName != activeUvcDeviceName) return
                    closeUvcStream()
                    if (bindGeneration == generation && running) {
                        sendStatus("cameraStale", force = true)
                    }
                }

                override fun onDetach(device: UsbDevice) = Unit

                override fun onCancel(device: UsbDevice) {
                    if (bindGeneration == generation && running) {
                        sendStatus("usbPermissionDenied", force = true)
                    }
                }
            })
        }
        usbMonitor = monitor
        try {
            monitor.register()
            val device = UvcCameraDiscovery.findDevice(
                context,
                selectedUvcCameraId
            )
            if (device == null) {
                sendStatus("cameraUnavailable", force = true)
            } else if (monitor.requestPermission(device)) {
                sendStatus("usbPermissionDenied", force = true)
            } else {
                sendStatus("usbPermission", force = true)
            }
        } catch (error: Exception) {
            Log.w(Tag, "UVC monitor failed", error)
            sendStatus("cameraStale", force = true)
        }
        scheduleWatchdog()
    }

    private fun openUvcCamera(
        device: UsbDevice,
        ctrlBlock: USBMonitor.UsbControlBlock,
        openGeneration: Int
    ) {
        if (openGeneration != generation || !running) return
        closeUvcStream()
        val camera = UVCCamera()
        try {
            camera.open(ctrlBlock)
            val selectedSize = configureUvcPreview(camera)
            val drainReader = ImageReader.newInstance(
                selectedSize.width,
                selectedSize.height,
                PixelFormat.RGBA_8888,
                2
            ).apply {
                setOnImageAvailableListener({ reader ->
                    reader.acquireLatestImage()?.close()
                }, mainHandler)
            }
            val surface = drainReader.surface
            uvcFrameWidth = selectedSize.width
            uvcFrameHeight = selectedSize.height
            uvcDrainReader = drainReader
            uvcPreviewSurface = surface
            activeUvcDeviceName = device.deviceName
            camera.setPreviewDisplay(surface)
            camera.setFrameCallback(
                IFrameCallback { frame ->
                    queueUvcFrame(frame, openGeneration)
                },
                UVCCamera.PIXEL_FORMAT_NV21
            )
            camera.startPreview()
            uvcCamera = camera
            lastImageReceivedAt = System.currentTimeMillis()
            lastAnalysisCompletedAt = lastImageReceivedAt
            Log.i(
                Tag,
                "OPTICAL_CAMERA runtimeId=${UvcCameraDiscovery.cameraId(device)} " +
                    "facing=external selector=usb-uvc " +
                    "size=${selectedSize.width}x${selectedSize.height}"
            )
            sendStatus("active", force = true)
        } catch (error: Exception) {
            Log.w(Tag, "UVC open failed", error)
            runCatching { camera.destroy() }
            closeUvcStream()
            sendStatus("cameraStale", force = true)
        }
    }

    private fun configureUvcPreview(camera: UVCCamera): UvcFrameSize {
        val candidates = UvcFrameSizeSelector.candidates(camera).ifEmpty {
            listOf(
                UvcFrameSize(640, 480, UVCCamera.FRAME_FORMAT_MJPEG),
                UvcFrameSize(640, 480, UVCCamera.FRAME_FORMAT_YUYV)
            )
        }
        var lastError: IllegalArgumentException? = null
        for (candidate in candidates) {
            try {
                camera.setPreviewSize(
                    candidate.width,
                    candidate.height,
                    candidate.frameFormat
                )
                return candidate
            } catch (error: IllegalArgumentException) {
                lastError = error
            }
        }
        throw lastError ?: IllegalArgumentException("No UVC preview size")
    }

    private fun queueUvcFrame(frame: ByteBuffer, frameGeneration: Int) {
        if (frameGeneration != generation || !running) return
        lastImageReceivedAt = System.currentTimeMillis()
        if (uvcFrameQueued) return
        val width = uvcFrameWidth
        val height = uvcFrameHeight
        val expectedBytes = width * height * 3 / 2
        if (width <= 0 || height <= 0 || frame.remaining() < expectedBytes) return
        uvcFrameQueued = true
        val bytes = ByteArray(expectedBytes)
        frame.duplicate().apply { rewind() }.get(bytes)
        try {
            analysisExecutor?.execute {
                analyzeUvcFrame(bytes, width, height, frameGeneration)
            } ?: run { uvcFrameQueued = false }
        } catch (_: RuntimeException) {
            uvcFrameQueued = false
        }
    }

    private fun analyzeUvcFrame(
        bytes: ByteArray,
        width: Int,
        height: Int,
        frameGeneration: Int
    ) {
        if (frameGeneration != generation || !running) {
            uvcFrameQueued = false
            return
        }
        val settings = settingsProvider()
        val now = System.currentTimeMillis()
        val interval = cameraAnalysisIntervalMs(settings.gesture, powerSavingIdle)
        if (!settings.enabled || now - lastFrameAt < interval) {
            uvcFrameQueued = false
            return
        }
        val bitmap = try {
            Nv21Bitmaps.toBitmap(
                bytes,
                width,
                height,
                zoomRatio = settings.zoomRatio
            )
        } catch (error: Exception) {
            Log.w(Tag, "UVC frame conversion failed", error)
            uvcFrameQueued = false
            return
        }
        lastFrameAt = now
        val startedNs = SystemClock.elapsedRealtimeNanos()
        try {
            val observation = faceAnalyzer?.analyzeBitmapForCamera(bitmap, now)
            if (frameGeneration == generation && running) {
                if (settings.gesture == OpticalSwitchGesture.CheekTwitch) {
                    val score = scoreCheekObservation(observation, settings)
                    updateCheekState(score, settings)
                } else {
                    val signal = observation?.blinkEyeSignal()
                    updateBlinkState(signal?.closedScore, signal?.reopenScore, settings)
                }
            }
        } catch (error: Exception) {
            Log.w(Tag, "UVC MediaPipe analysis failed", error)
            if (frameGeneration == generation) {
                if (settings.gesture == OpticalSwitchGesture.CheekTwitch) {
                    updateCheekState(null, settings)
                } else {
                    updateBlinkState(null, null, settings)
                }
            }
        } finally {
            bitmap.recycle()
            recordFacePerformance(SystemClock.elapsedRealtimeNanos() - startedNs)
            if (frameGeneration == generation) {
                lastAnalysisCompletedAt = System.currentTimeMillis()
                sendStatus("analysis")
            }
            uvcFrameQueued = false
        }
    }

    private fun closeUvcStream() {
        val camera = uvcCamera
        uvcCamera = null
        activeUvcDeviceName = null
        uvcFrameQueued = false
        runCatching { camera?.setFrameCallback(null, 0) }
        runCatching { camera?.destroy() }
        uvcPreviewSurface?.release()
        uvcPreviewSurface = null
        uvcDrainReader?.close()
        uvcDrainReader = null
        uvcFrameWidth = 0
        uvcFrameHeight = 0
    }

    private fun stopUvcCamera() {
        closeUvcStream()
        selectedUvcCameraId = null
        val monitor = usbMonitor
        usbMonitor = null
        runCatching { monitor?.destroy() }
    }

    private fun applyZoom(camera: androidx.camera.core.Camera, requestedZoomRatio: Float) {
        val zoomState = camera.cameraInfo.zoomState.value
        val minZoom = zoomState?.minZoomRatio ?: 1.0f
        val maxZoom = zoomState?.maxZoomRatio ?: requestedZoomRatio
        val zoom = requestedZoomRatio.coerceIn(minZoom, maxZoom)
        camera.cameraControl.setZoomRatio(zoom)
    }

    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun selectedCamera(
        provider: ProcessCameraProvider
    ): SelectedCamera? {
        val manager =
            context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraXIds = provider.availableCameraInfos.mapNotNull { cameraInfo ->
            runCatching {
                Camera2CameraInfo.from(cameraInfo).cameraId
            }.getOrNull()
        }.toSet()
        val compatibleCameras =
            CameraSwitchCameraSelection.availableCameras(manager).filter {
                it.cameraId in cameraXIds
            }
        val allCameras = compatibleCameras +
            UvcCameraDiscovery.availableCameras(context)
        val defaultFrontId = runCatching {
            CameraSelector.DEFAULT_FRONT_CAMERA
                .filter(provider.availableCameraInfos)
                .firstOrNull()
                ?.let { Camera2CameraInfo.from(it).cameraId }
        }.getOrNull()
        val settings = settingsProvider()
        val selected = CameraSwitchCameraSelection.choose(
            cameras = allCameras,
            preferredCameraId = settings.cameraId ?: defaultFrontId,
            preferredLensFacing = settings.cameraLensFacing
                ?: CameraCharacteristics.LENS_FACING_FRONT,
            preferredSource = settings.cameraSource
        ) ?: return null
        if (selected.source == CameraSwitchCameraSource.Uvc) {
            return SelectedCamera(
                selected.cameraId,
                selected.lensFacing,
                selected.source,
                null
            )
        }
        val selector = CameraSelector.Builder()
            .addCameraFilter { cameraInfos ->
                cameraInfos.filter { cameraInfo ->
                    runCatching {
                        Camera2CameraInfo.from(cameraInfo).cameraId ==
                            selected.cameraId
                    }.getOrDefault(false)
                }
            }
            .build()
        return SelectedCamera(
            selected.cameraId,
            selected.lensFacing,
            selected.source,
            selector
        )
    }

    private fun targetFpsRange(cameraId: String, targetFps: Int): Range<Int>? {
        val manager =
            context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val ranges = manager.getCameraCharacteristics(cameraId)
            .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?: return null
        return ranges
            .filter {
                it.upper <= MaxCameraFps &&
                    it.upper >= MinCameraFps
            }
            .minWithOrNull(
                compareBy<Range<Int>> {
                    kotlin.math.abs(it.upper - targetFps)
                }.thenBy { it.lower }
            )
            ?: ranges.minWithOrNull(
                compareBy<Range<Int>> { it.upper }.thenBy { it.lower }
            )
    }

    private fun requestedCameraFps(): Int =
        if (powerSavingIdle) IdleTargetCameraFps else TargetCameraFps

    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun applyTargetCameraFps() {
        val camera = activeCamera ?: return
        val cameraId = activeCameraId ?: return
        val range = targetFpsRange(cameraId, requestedCameraFps()) ?: return
        try {
            Camera2CameraControl.from(camera.cameraControl).setCaptureRequestOptions(
                CaptureRequestOptions.Builder()
                    .setCaptureRequestOption(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, range)
                    .build()
            )
        } catch (error: Exception) {
            Log.w(Tag, "Unable to adjust camera FPS for idle state", error)
        }
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
        val detectorIntervalMs = cameraAnalysisIntervalMs(settings.gesture, powerSavingIdle)
        if (now - lastFrameAt < detectorIntervalMs) {
            imageProxy.close()
            return
        }

        val analyzer = faceAnalyzer
        val mediaImage = imageProxy.image
        if (analyzer == null || mediaImage == null) {
            imageProxy.close()
            return
        }

        lastFrameAt = now
        val analysisStartedNs = SystemClock.elapsedRealtimeNanos()

        try {
            val observation = analyzer.analyzeRgbaForRuntime(
                mediaImage,
                imageProxy.imageInfo.rotationDegrees,
                now,
                mirrorCameraOutput = activeCameraMirrored
            )
            if (imageGeneration != generation || !running) return

            if (settings.gesture == OpticalSwitchGesture.CheekTwitch) {
                updateCheekState(scoreCheekObservation(observation, settings), settings)
            } else {
                val signal = observation?.blinkEyeSignal()
                updateBlinkState(signal?.closedScore, signal?.reopenScore, settings)
            }
        } catch (error: Exception) {
            Log.w(Tag, "MediaPipe analysis failed", error)
            if (imageGeneration == generation) {
                if (settings.gesture == OpticalSwitchGesture.CheekTwitch) {
                    updateCheekState(null, settings)
                } else {
                    updateBlinkState(null, null, settings)
                }
            }
        } finally {
            recordFacePerformance(
                SystemClock.elapsedRealtimeNanos() - analysisStartedNs
            )
            if (imageGeneration == generation) {
                lastAnalysisCompletedAt = System.currentTimeMillis()
                sendStatus("analysis")
            }
            safeClose(imageProxy)
        }
    }

    private fun recordFacePerformance(durationNs: Long) {
        if (durationNs <= 0L) return
        facePerfFrames += 1
        facePerfTotalNs += durationNs
        facePerfMaxNs = maxOf(facePerfMaxNs, durationNs)
        if (facePerfFrames < FacePerfLogFrames) return

        val averageUs = (facePerfTotalNs / facePerfFrames) / 1_000L
        val maxUs = facePerfMaxNs / 1_000L
        Log.i(
            Tag,
            "FACE_PERF path=mediapipe frames=$facePerfFrames " +
                "avgUs=$averageUs maxUs=$maxUs size=${analysisSize.width}x${analysisSize.height}"
        )
        facePerfFrames = 0
        facePerfTotalNs = 0L
        facePerfMaxNs = 0L
    }

    /** Keeps CameraX and direct-UVC cheek scoring in the same model space. */
    private fun scoreCheekObservation(
        observation: CheekFaceObservation?,
        settings: CameraSwitchSettings
    ): Double? {
        if (observation?.usable != true) return null
        return settings.cheekModel?.score(observation.blendshapes)
            ?: cheekDetector.observe(observation.blendshapes)
    }

    private fun updateCheekState(score: Double?, settings: CameraSwitchSettings) {
        lastReportedScore = score
        activeEnterThreshold = settings.cheekModel?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold
        val now = System.currentTimeMillis()
        for (event in cheekClassifier.onScore(score, now)) {
            when (event) {
                is BinarySwitchClassifier.Event.HoldStarted ->
                    onHoldStarted(settings, "cheekMotion")
                is BinarySwitchClassifier.Event.Activated ->
                    onActivated(settings, now, "cheekTwitchMs=${event.heldMs}")
                is BinarySwitchClassifier.Event.HoldEnded ->
                    onHoldEnded(settings, "reason=${event.reason.name}")
            }
        }
    }

    private fun updateBlinkState(score: Double?, reopenScore: Double?, settings: CameraSwitchSettings) {
        lastReportedScore = score
        activeEnterThreshold = activeDetectionParameters.closeThreshold
        val now = System.currentTimeMillis()
        for (event in blinkClassifier.onSignal(score, now, settings.longBlinkMs, reopenScore)) {
            when (event) {
                is BlinkGestureClassifier.Event.HoldStarted ->
                    onHoldStarted(settings, "eyesClosed")
                is BlinkGestureClassifier.Event.Activated ->
                    onActivated(settings, now, "longBlinkMs=${event.durationMs}")
                is BlinkGestureClassifier.Event.HoldEnded ->
                    onHoldEnded(settings, "closedMs=${event.durationMs};reason=${event.reason.name}")
            }
        }
    }

    private fun onHoldStarted(settings: CameraSwitchSettings, detail: String) {
        sendHoldStart(settings.source, detail)
    }

    private fun onActivated(settings: CameraSwitchSettings, now: Long, detail: String) {
        playHoldReachedCue()
        if (now - lastActivationAt < settings.cooldownMs) return
        lastActivationAt = now
        // Keep the physical hold latched until the classifier reports a real
        // reopen/relax event. The board may use that bounded pressed interval
        // to advance through the first target of the next hierarchy level.
        // It still receives exactly one detector activation per gesture.
        sink.onInput(InputEvent(intent = "activate", source = settings.source, detail = detail))
    }

    private fun onHoldEnded(settings: CameraSwitchSettings, detail: String) {
        sendHoldEnd(settings.source, detail)
    }

    private fun sendHoldStart(source: String, detail: String) {
        if (holdEventActive) return
        holdEventActive = true
        sink.onInput(InputEvent(intent = "holdStart", source = source, detail = detail))
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

    private fun sendStatus(state: String, force: Boolean = false) {
        val now = System.currentTimeMillis()
        val intervalMs = if (powerSavingIdle) IdleStatusIntervalMs else StatusIntervalMs
        if (!force && now - lastStatusSentAt < intervalMs) return
        lastStatusSentAt = now
        val reportedState = if (powerSavingIdle && state in setOf("active", "analysis")) {
            "powerSaving"
        } else {
            state
        }
        sink.onInput(
            InputEvent(
                intent = "cameraStatus",
                source = activeSource,
                detail = buildString {
                    append("state=").append(reportedState)
                    lastReportedScore?.let { append(";score=").append("%.4f".format(it)) }
                    append(";threshold=").append("%.4f".format(activeEnterThreshold))
                }
            )
        )
    }

    private fun safeClose(imageProxy: ImageProxy) {
        try {
            imageProxy.close()
        } catch (_: Exception) {
            // Camera teardown may race with a frame completing on the analysis thread.
        }
    }

    private fun cameraFacingLogName(lensFacing: Int?): String =
        when (lensFacing) {
            CameraCharacteristics.LENS_FACING_FRONT -> "front"
            CameraCharacteristics.LENS_FACING_BACK -> "rear"
            CameraCharacteristics.LENS_FACING_EXTERNAL -> "external"
            else -> "unknown"
        }

    private data class SelectedCamera(
        val cameraId: String,
        val lensFacing: Int?,
        val source: CameraSwitchCameraSource,
        val selector: CameraSelector?
    )
    private companion object {
        // Active input keeps the physically verified cadence. Opt-in idle
        // halves capture and analysis work but keeps the camera available for
        // a wake-only gesture.
        const val TargetCameraFps = 10
        const val IdleTargetCameraFps = 5
        const val MinCameraFps = 5
        const val MaxCameraFps = 15
        const val WatchdogIntervalMs = 1000L
        const val FrameStallMs = 3500L
        const val AnalysisStallMs = 3500L
        const val StatusIntervalMs = 650L
        const val IdleStatusIntervalMs = 2000L
        const val FacePerfLogFrames = 50
        const val Tag = "ShineCameraSwitch"
    }
}

internal fun cameraAnalysisIntervalMs(
    gesture: OpticalSwitchGesture,
    powerSavingIdle: Boolean,
): Long = when {
    powerSavingIdle -> 200L
    gesture == OpticalSwitchGesture.LongBlink -> 100L
    else -> 66L
}
