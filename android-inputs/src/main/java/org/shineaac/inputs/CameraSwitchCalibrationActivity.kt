package org.shineaac.inputs

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.AudioManager
import android.media.FaceDetector
import android.media.Image
import android.media.ImageReader
import android.media.ToneGenerator
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Size
import android.view.Gravity
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.math.sqrt

class CameraSwitchCalibrationActivity : Activity() {
    private val analysisSize = Size(320, 240)
    private var textureView: TextureView? = null
    private var overlayView: EyeOverlayView? = null
    private var statusView: TextView? = null
    private var metricsView: TextView? = null
    private var mirrorButton: Button? = null
    private var startButton: Button? = null
    private var testButton: Button? = null
    private var cameraDevice: CameraDevice? = null
    private var session: CameraCaptureSession? = null
    private var reader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var mainHandler: Handler? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var toneGenerator: ToneGenerator? = null
    private var currentSpeechId: String? = null
    private var currentSpeechDone: (() -> Unit)? = null
    private var cueSet = CalibrationCueText.forProfile("en-US")
    private var mirrorOverlayX = true
    private var phase = Phase.Idle
    private var captureEndsAtMs = 0L
    private var activeStepLabel = ""
    private var ttsVoiceLabel = "Voice pending"
    private var calibrationRunId = 0
    private val openSamples = mutableListOf<EyeFeatures>()
    private val closedSamples = mutableListOf<EyeFeatures>()
    private val longBlinkDurations = mutableListOf<Long>()
    private val restClosedDurations = mutableListOf<Long>()
    private val testLongBlinkDurations = mutableListOf<Long>()
    private var longBlinkClosed = false
    private var longBlinkClosedStartedAt = 0L
    private var restClosed = false
    private var restClosedStartedAt = 0L
    private var testLongBlinkClosed = false
    private var testLongBlinkClosedStartedAt = 0L
    private var previewLongBlinkClosed = false
    private var previewLongBlinkClosedStartedAt = 0L
    private var previewLongBlinkCount = 0
    private var previewLastDetectedDurationMs = 0L
    private var previewLastCueAtMs = 0L
    private var calibratedLongBlinkHoldMs = 800L
    private var savedCalibrationRecord: CameraSwitchCalibrationRecord? = null
    private var lastRoi: TrackedRoi? = null
    private var openBaseline: EyeFeatures? = null
    private var closedBaseline: EyeFeatures? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mainHandler = Handler(mainLooper)
        cueSet = CalibrationCueText.forProfile(intent.getStringExtra(ExtraProfileId) ?: "en-US")
        val savedSettings = CameraSwitchPreferences.read(this, enabled = false)
        mirrorOverlayX = savedSettings.mirrorOverlayX
        calibratedLongBlinkHoldMs = savedSettings.longBlinkMs
        openBaseline = savedSettings.openBaseline
        closedBaseline = savedSettings.closedBaseline
        savedCalibrationRecord = CameraSwitchPreferences.readCalibrationRecord(this)
        toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 85)
        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                configureTtsVoice()
            }
        }
        setContentView(createContentView())
        updateSavedCalibrationUi()
    }

    override fun onResume() {
        super.onResume()
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), CameraPermissionRequestCode)
        }
    }

    override fun onPause() {
        stopCamera()
        super.onPause()
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
        currentSpeechId = null
        currentSpeechDone = null
        toneGenerator?.release()
        toneGenerator = null
        mainHandler?.removeCallbacksAndMessages(null)
        mainHandler = null
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CameraPermissionRequestCode &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            statusView?.text = "Camera permission is required."
        }
    }

    private fun createContentView(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(19, 24, 31))
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }

        val title = TextView(this).apply {
            text = "Camera Switch Calibration"
            setTextColor(Color.WHITE)
            textSize = 22f
        }
        statusView = TextView(this).apply {
            text = "Position face in the preview."
            setTextColor(Color.rgb(220, 227, 235))
            textSize = 16f
            setPadding(0, dp(8), 0, dp(8))
        }
        metricsView = TextView(this).apply {
            text = "Waiting for camera"
            setTextColor(Color.rgb(159, 173, 188))
            textSize = 14f
            setPadding(0, 0, 0, dp(12))
        }

        val previewFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
            setBackgroundColor(Color.BLACK)
        }
        textureView = TextureView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                    startCamera()
                }
                override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) = Unit
                override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean = true
                override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
            }
        }
        overlayView = EyeOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        previewFrame.addView(textureView)
        previewFrame.addView(overlayView)

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        startButton = Button(this).apply {
            text = "Auto Calibration"
            setOnClickListener { startAutoCalibration() }
        }
        testButton = Button(this).apply {
            text = "Test Long Blink"
            isEnabled = false
            setOnClickListener { startLongBlinkTest() }
        }
        mirrorButton = Button(this).apply {
            setOnClickListener {
                mirrorOverlayX = !mirrorOverlayX
                CameraSwitchPreferences.saveMirrorOverlayX(this@CameraSwitchCalibrationActivity, mirrorOverlayX)
                updateMirrorButton()
                overlayView?.invalidate()
            }
        }
        val closeButton = Button(this).apply {
            text = "Done"
            setOnClickListener { finish() }
        }
        actions.addView(startButton)
        actions.addView(testButton)
        actions.addView(mirrorButton)
        actions.addView(closeButton)
        updateMirrorButton()

        root.addView(title)
        root.addView(statusView)
        root.addView(metricsView)
        root.addView(previewFrame)
        root.addView(actions)
        return root
    }

    private fun updateMirrorButton() {
        mirrorButton?.text = if (mirrorOverlayX) "Box X Flipped" else "Box X Normal"
    }

    private fun updateSavedCalibrationUi() {
        if (openBaseline != null && closedBaseline != null) {
            val quality = savedCalibrationRecord?.qualityDetail ?: "Previous quality unavailable"
            statusView?.text = "Saved calibration loaded. Preview is listening for long blink."
            metricsView?.text = "$quality | current position: blink to test"
            testButton?.isEnabled = true
        } else {
            statusView?.text = "Position face in the preview."
            metricsView?.text = "No saved calibration. Run auto calibration first."
            testButton?.isEnabled = false
        }
    }

    private fun configureTtsVoice() {
        val engine = tts ?: return
        engine.setSpeechRate(if (cueSet.locale.language == "zh") 0.82f else 0.88f)
        val exactVoice = engine.voices
            ?.filterNot { it.isNetworkConnectionRequired }
            ?.firstOrNull { it.locale.toLanguageTag().equals(cueSet.locale.toLanguageTag(), ignoreCase = true) }
        if (exactVoice != null) {
            engine.setVoice(exactVoice)
            ttsVoiceLabel = "Voice ${exactVoice.locale.toLanguageTag()}"
        } else {
            val result = engine.setLanguage(cueSet.locale)
            if ((result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) &&
                cueSet.locale.language == "zh"
            ) {
                engine.setLanguage(Locale.TRADITIONAL_CHINESE)
                ttsVoiceLabel = "Voice ${engine.voice?.locale?.toLanguageTag() ?: Locale.TRADITIONAL_CHINESE.toLanguageTag()}"
            } else {
                val actualTag = engine.voice?.locale?.toLanguageTag() ?: cueSet.locale.toLanguageTag()
                ttsVoiceLabel = if (cueSet.locale.toLanguageTag() == "zh-TW" && actualTag != "zh-TW") {
                    "Voice $actualTag; Taiwan voice unavailable"
                } else {
                    "Voice $actualTag"
                }
            }
        }
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit

            override fun onDone(utteranceId: String?) {
                finishSpeech(utteranceId)
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                finishSpeech(utteranceId)
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                finishSpeech(utteranceId)
            }
        })
        runOnUiThread { metricsView?.text = ttsVoiceLabel }
    }

    private fun startAutoCalibration() {
        calibrationRunId += 1
        mainHandler?.removeCallbacksAndMessages(null)
        currentSpeechId = null
        currentSpeechDone = null
        openSamples.clear()
        closedSamples.clear()
        longBlinkDurations.clear()
        restClosedDurations.clear()
        testLongBlinkDurations.clear()
        longBlinkClosed = false
        longBlinkClosedStartedAt = 0L
        restClosed = false
        restClosedStartedAt = 0L
        testLongBlinkClosed = false
        testLongBlinkClosedStartedAt = 0L
        previewLongBlinkClosed = false
        previewLongBlinkClosedStartedAt = 0L
        previewLongBlinkCount = 0
        previewLastDetectedDurationMs = 0L
        openBaseline = null
        closedBaseline = null
        captureEndsAtMs = 0L
        activeStepLabel = ""
        startButton?.isEnabled = false
        testButton?.isEnabled = false
        runStep(0, calibrationRunId)
    }

    private fun runStep(index: Int, runId: Int) {
        if (runId != calibrationRunId) return
        val steps = calibrationSteps()
        if (index >= steps.size) {
            finishAutoCalibration()
            return
        }
        val step = steps[index]
        phase = Phase.Instruction
        activeStepLabel = step.label
        captureEndsAtMs = 0L
        statusView?.text = step.cue
        metricsView?.text = "$ttsVoiceLabel | ${step.label} starts after the beep"
        speakThen(step.cue) {
            if (runId != calibrationRunId) return@speakThen
            if (step.durationMs <= 0L) {
                mainHandler?.postDelayed({ runStep(index + 1, runId) }, AfterSpeechPauseMs)
                return@speakThen
            }
            mainHandler?.postDelayed({
                if (runId == calibrationRunId) {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 180)
                    statusView?.text = "${step.label}: capturing for ${step.durationMs / 1000} seconds"
                    mainHandler?.postDelayed({
                        if (runId == calibrationRunId) {
                            beginCapture(step)
                            mainHandler?.postDelayed({
                                if (runId == calibrationRunId) {
                                    endCapture()
                                    runStep(index + 1, runId)
                                }
                            }, step.durationMs)
                        }
                    }, BeepLeadMs)
                }
            }, AfterSpeechPauseMs)
        }
    }

    private fun calibrationSteps(): List<CalibrationStep> =
        listOf(
            CalibrationStep(Phase.Prepare, "Prepare", cueSet.prepare, 0L),
            CalibrationStep(Phase.Open, "Open eyes", cueSet.open, 5000L),
            CalibrationStep(Phase.Closed, "Closed eyes", cueSet.closed, 4000L),
            CalibrationStep(Phase.Rest, "Rest", cueSet.rest, 8000L),
            CalibrationStep(Phase.LongBlink, "Slow blink trials", cueSet.longBlink, 12000L)
        )

    private fun beginCapture(step: CalibrationStep) {
        phase = step.phase
        activeStepLabel = step.label
        captureEndsAtMs = System.currentTimeMillis() + step.durationMs
    }

    private fun endCapture() {
        phase = Phase.Instruction
        captureEndsAtMs = 0L
    }

    private fun finishAutoCalibration() {
        if (longBlinkClosed) {
            longBlinkDurations.add(System.currentTimeMillis() - longBlinkClosedStartedAt)
            longBlinkClosed = false
        }
        if (restClosed) {
            restClosedDurations.add(System.currentTimeMillis() - restClosedStartedAt)
            restClosed = false
        }
        phase = Phase.Complete
        openBaseline = average(openSamples)
        closedBaseline = average(closedSamples)
        calibratedLongBlinkHoldMs = calibratedLongBlinkMs()
        val quality = calibrationQuality()
        CameraSwitchPreferences.saveCalibration(
            context = this,
            longBlinkMs = calibratedLongBlinkHoldMs,
            cooldownMs = 900L,
            mirrorOverlayX = mirrorOverlayX,
            openBaseline = openBaseline,
            closedBaseline = closedBaseline,
            qualityLabel = quality.label,
            qualityDetail = quality.detail
        )
        savedCalibrationRecord = CameraSwitchPreferences.readCalibrationRecord(this)
        val message = "${cueSet.complete} ${quality.label}. Switch hold ${calibratedLongBlinkHoldMs}ms."
        statusView?.text = message
        metricsView?.text = quality.detail
        speakThen(message) {}
        startButton?.isEnabled = true
        testButton?.isEnabled = openBaseline != null && closedBaseline != null
    }

    private fun calibratedLongBlinkMs(): Long {
        val measured = longBlinkDurations
            .filter { it in 450L..2500L }
            .sorted()
        if (measured.isEmpty()) return 800L
        return clampLong((measured[measured.size / 2] * 0.7).roundToLong(), 550L, 1600L)
    }

    private fun calibrationQuality(): CalibrationQuality {
        val openOk = openSamples.size >= 12
        val closedOk = closedSamples.size >= 8
        val slowBlinkOk = longBlinkDurations.any { it in 450L..2500L }
        val falseLongBlinks = restClosedDurations.count { it >= calibratedLongBlinkHoldMs }
        val restOk = falseLongBlinks == 0
        val label = when {
            openOk && closedOk && slowBlinkOk && restOk -> "Quality good"
            openOk && closedOk && restOk -> "Quality weak"
            else -> "Quality needs retry"
        }
        val detail = buildString {
            append(label)
            append(" | open ").append(openSamples.size)
            append(", closed ").append(closedSamples.size)
            append(", slow blinks ").append(longBlinkDurations.size)
            append(", rest false ").append(falseLongBlinks)
            append(", hold ").append(calibratedLongBlinkHoldMs).append("ms")
            if (!slowBlinkOk) append(" | no measured slow blink; default hold used")
        }
        return CalibrationQuality(label, detail)
    }

    private fun startLongBlinkTest() {
        if (openBaseline == null || closedBaseline == null) {
            statusView?.text = "Run auto calibration first."
            return
        }
        calibrationRunId += 1
        mainHandler?.removeCallbacksAndMessages(null)
        currentSpeechId = null
        currentSpeechDone = null
        testLongBlinkDurations.clear()
        testLongBlinkClosed = false
        testLongBlinkClosedStartedAt = 0L
        phase = Phase.Instruction
        activeStepLabel = "Long blink test"
        captureEndsAtMs = 0L
        startButton?.isEnabled = false
        testButton?.isEnabled = false
        val runId = calibrationRunId
        val holdSeconds = max(1L, (calibratedLongBlinkHoldMs + 999L) / 1000L)
        val cue = "After the beep, close your eyes for at least $holdSeconds seconds, then open. The test runs for 10 seconds."
        statusView?.text = cue
        metricsView?.text = "Long blink test starts after the beep | hold ${calibratedLongBlinkHoldMs}ms"
        speakThen(cue) {
            if (runId != calibrationRunId) return@speakThen
            mainHandler?.postDelayed({
                if (runId == calibrationRunId) {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 180)
                    mainHandler?.postDelayed({
                        if (runId == calibrationRunId) {
                            phase = Phase.TestLongBlink
                            activeStepLabel = "Long blink test"
                            captureEndsAtMs = System.currentTimeMillis() + LongBlinkTestMs
                            statusView?.text = "Testing long blink for ${LongBlinkTestMs / 1000} seconds"
                            mainHandler?.postDelayed({ finishLongBlinkTest(runId) }, LongBlinkTestMs)
                        }
                    }, BeepLeadMs)
                }
            }, AfterSpeechPauseMs)
        }
    }

    private fun finishLongBlinkTest(runId: Int) {
        if (runId != calibrationRunId) return
        if (testLongBlinkClosed) {
            testLongBlinkDurations.add(System.currentTimeMillis() - testLongBlinkClosedStartedAt)
            testLongBlinkClosed = false
        }
        phase = Phase.Complete
        captureEndsAtMs = 0L
        val passed = testLongBlinkDurations.any { it >= calibratedLongBlinkHoldMs }
        val best = testLongBlinkDurations.maxOrNull() ?: 0L
        val result = if (passed) "Long blink test passed" else "Long blink test failed"
        statusView?.text = result
        metricsView?.text = "$result | detected ${testLongBlinkDurations.size}, longest ${best}ms, required ${calibratedLongBlinkHoldMs}ms"
        speakThen(result) {}
        startButton?.isEnabled = true
        testButton?.isEnabled = true
    }

    private fun speakThen(text: String, onDone: () -> Unit) {
        val engine = tts
        if (!ttsReady || engine == null) {
            mainHandler?.postDelayed(onDone, 1000L)
            return
        }
        val utteranceId = "camera-switch-calibration-${System.currentTimeMillis()}"
        currentSpeechId = utteranceId
        currentSpeechDone = onDone
        val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle.EMPTY, utteranceId)
        if (result == TextToSpeech.ERROR) {
            finishSpeech(utteranceId)
        }
    }

    private fun finishSpeech(utteranceId: String?) {
        mainHandler?.post {
            if (utteranceId != currentSpeechId) return@post
            val callback = currentSpeechDone
            currentSpeechId = null
            currentSpeechDone = null
            callback?.invoke()
        }
    }

    @SuppressLint("MissingPermission")
    private fun startCamera() {
        if (cameraDevice != null || checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return
        val texture = textureView?.surfaceTexture ?: return
        texture.setDefaultBufferSize(640, 480)
        cameraThread = HandlerThread("ShineCameraCalibration").also { it.start() }
        cameraHandler = Handler(cameraThread!!.looper)
        reader = ImageReader.newInstance(
            analysisSize.width,
            analysisSize.height,
            android.graphics.ImageFormat.YUV_420_888,
            2
        ).apply {
            setOnImageAvailableListener({ imageReader ->
                imageReader.acquireLatestImage()?.use { analyze(it) }
            }, cameraHandler)
        }

        val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } ?: return
        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                cameraDevice = camera
                createCameraSession(camera, Surface(texture), reader?.surface ?: return)
            }

            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                cameraDevice = null
            }

            override fun onError(camera: CameraDevice, error: Int) {
                camera.close()
                cameraDevice = null
                runOnUiThread { statusView?.text = "Camera error $error" }
            }
        }, cameraHandler)
    }

    private fun createCameraSession(camera: CameraDevice, previewSurface: Surface, imageSurface: Surface) {
        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
            addTarget(previewSurface)
            addTarget(imageSurface)
            set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
        }
        camera.createCaptureSession(listOf(previewSurface, imageSurface), object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(captureSession: CameraCaptureSession) {
                session = captureSession
                captureSession.setRepeatingRequest(request.build(), null, cameraHandler)
            }

            override fun onConfigureFailed(captureSession: CameraCaptureSession) {
                runOnUiThread { statusView?.text = "Camera setup failed." }
            }
        }, cameraHandler)
    }

    private fun stopCamera() {
        session?.close()
        session = null
        cameraDevice?.close()
        cameraDevice = null
        reader?.close()
        reader = null
        cameraThread?.quitSafely()
        cameraThread = null
        cameraHandler = null
    }

    private fun analyze(image: Image) {
        val frame = RawFrame.from(image).oriented(270)
        val face = detectFace(frame)
        val roi = if (face == null) null else eyeBandForFace(frame, face)
        val features = roi?.let { featuresFromRoi(frame, it.x, it.y, it.w, it.h) }
        if (roi != null) lastRoi = roi
        if (features != null) collectCalibrationSample(features)
        val score = features?.let { closedScore(it) }
        val previewDetected = features?.let { collectPreviewLongBlinkDuration(it) } ?: false
        mainHandler?.post {
            overlayView?.setRoi(roi, frame.width, frame.height, mirrorOverlayX)
            if (previewDetected) {
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, PreviewCueMs)
                statusView?.text = "Preview long blink detected. Current position works."
            }
            if (shouldPreviewMonitor()) {
                metricsView?.text = if (score == null) {
                    "${previousQualityText()} | current position: face not detected"
                } else {
                    "${previousQualityText()} | current position score ${"%.2f".format(score)} | preview detections $previewLongBlinkCount | last ${previewLastDetectedDurationMs}ms | hold ${calibratedLongBlinkHoldMs}ms"
                }
            } else if (phase != Phase.Complete) {
                val remainingMs = max(0L, captureEndsAtMs - System.currentTimeMillis())
                metricsView?.text = if (score == null) {
                    "$ttsVoiceLabel | Face not detected"
                } else if (captureEndsAtMs > 0L) {
                    "$activeStepLabel ${((remainingMs + 999L) / 1000L)}s left | Score ${"%.2f".format(score)} | open ${openSamples.size} | closed ${closedSamples.size} | slow ${longBlinkDurations.size} | test ${testLongBlinkDurations.size}"
                } else {
                    "$ttsVoiceLabel | Waiting | Score ${"%.2f".format(score)} | open ${openSamples.size} | closed ${closedSamples.size} | slow ${longBlinkDurations.size} | test ${testLongBlinkDurations.size}"
                }
            }
        }
    }

    private fun shouldPreviewMonitor(): Boolean =
        (phase == Phase.Idle || phase == Phase.Complete) &&
            openBaseline != null &&
            closedBaseline != null &&
            currentSpeechId == null

    private fun previousQualityText(): String =
        savedCalibrationRecord?.qualityDetail ?: "Previous quality unavailable"

    private fun collectCalibrationSample(features: EyeFeatures) {
        when (phase) {
            Phase.Open -> openSamples.add(features)
            Phase.Closed -> closedSamples.add(features)
            Phase.Rest -> collectRestClosedDuration(features)
            Phase.LongBlink -> collectLongBlinkDuration(features)
            Phase.TestLongBlink -> collectTestLongBlinkDuration(features)
            else -> Unit
        }
    }

    private fun collectLongBlinkDuration(features: EyeFeatures) {
        val score = closedScore(features) ?: return
        val now = System.currentTimeMillis()
        if (!longBlinkClosed && score >= 0.55) {
            longBlinkClosed = true
            longBlinkClosedStartedAt = now
        } else if (longBlinkClosed && score < 0.35) {
            longBlinkDurations.add(now - longBlinkClosedStartedAt)
            longBlinkClosed = false
        }
    }

    private fun collectRestClosedDuration(features: EyeFeatures) {
        val score = closedScore(features) ?: return
        val now = System.currentTimeMillis()
        if (!restClosed && score >= 0.55) {
            restClosed = true
            restClosedStartedAt = now
        } else if (restClosed && score < 0.35) {
            restClosedDurations.add(now - restClosedStartedAt)
            restClosed = false
        }
    }

    private fun collectTestLongBlinkDuration(features: EyeFeatures) {
        val score = closedScore(features) ?: return
        val now = System.currentTimeMillis()
        if (!testLongBlinkClosed && score >= 0.55) {
            testLongBlinkClosed = true
            testLongBlinkClosedStartedAt = now
        } else if (testLongBlinkClosed && score < 0.35) {
            testLongBlinkDurations.add(now - testLongBlinkClosedStartedAt)
            testLongBlinkClosed = false
        }
    }

    private fun collectPreviewLongBlinkDuration(features: EyeFeatures): Boolean {
        if (!shouldPreviewMonitor()) {
            previewLongBlinkClosed = false
            previewLongBlinkClosedStartedAt = 0L
            return false
        }
        val score = closedScore(features) ?: return false
        val now = System.currentTimeMillis()
        if (!previewLongBlinkClosed && score >= 0.55) {
            previewLongBlinkClosed = true
            previewLongBlinkClosedStartedAt = now
            return false
        }
        if (previewLongBlinkClosed && score < 0.35) {
            val duration = now - previewLongBlinkClosedStartedAt
            previewLongBlinkClosed = false
            if (duration >= calibratedLongBlinkHoldMs && now - previewLastCueAtMs >= PreviewCueCooldownMs) {
                previewLastCueAtMs = now
                previewLastDetectedDurationMs = duration
                previewLongBlinkCount += 1
                return true
            }
        }
        return false
    }

    private fun closedScore(features: EyeFeatures): Double? {
        val open = openBaseline ?: average(openSamples) ?: return null
        val closed = closedBaseline ?: average(closedSamples) ?: return null
        val distOpen = featureDistance(features, open)
        val distClosed = featureDistance(features, closed)
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

    private fun eyeBandForFace(frame: OrientedFrame, face: FaceDetector.Face): TrackedRoi {
        val midpoint = PointF()
        face.getMidPoint(midpoint)
        val eyesDistance = max(18f, face.eyesDistance())
        val roiW = clampInt((eyesDistance * 2.1f).toInt(), 20, frame.width)
        val roiH = clampInt((eyesDistance * 0.65f).toInt(), 12, frame.height)
        val x = clampInt((midpoint.x - roiW / 2f).toInt(), 0, frame.width - roiW)
        val y = clampInt((midpoint.y - roiH * 0.55f).toInt(), 0, frame.height - roiH)
        return TrackedRoi(x, y, roiW, roiH)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToLong().toInt()

    private class EyeOverlayView(context: Context) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(52, 211, 153)
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        private var roi: TrackedRoi? = null
        private var frameWidth = 0
        private var frameHeight = 0
        private var mirrorX = true

        fun setRoi(nextRoi: TrackedRoi?, width: Int, height: Int, mirrorOverlayX: Boolean) {
            roi = nextRoi
            frameWidth = width
            frameHeight = height
            mirrorX = mirrorOverlayX
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val box = roi ?: return
            if (frameWidth <= 0 || frameHeight <= 0) return
            val scale = min(width / frameWidth.toFloat(), height / frameHeight.toFloat())
            val drawnWidth = frameWidth * scale
            val drawnHeight = frameHeight * scale
            val leftOffset = (width - drawnWidth) / 2f
            val topOffset = (height - drawnHeight) / 2f
            val sourceX = if (mirrorX) frameWidth - box.x - box.w else box.x
            val rect = RectF(
                leftOffset + sourceX * scale,
                topOffset + box.y * scale,
                leftOffset + (sourceX + box.w) * scale,
                topOffset + (box.y + box.h) * scale
            )
            canvas.drawRect(rect, paint)
        }
    }

    private data class CalibrationStep(val phase: Phase, val label: String, val cue: String, val durationMs: Long)
    private data class CalibrationQuality(val label: String, val detail: String)
    private enum class Phase { Idle, Instruction, Prepare, Open, Closed, Rest, LongBlink, TestLongBlink, Complete }
    private data class TrackedRoi(val x: Int, val y: Int, val w: Int, val h: Int)
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
        const val ExtraProfileId = "org.shineaac.inputs.PROFILE_ID"
        const val CameraPermissionRequestCode = 2504
        const val AfterSpeechPauseMs = 700L
        const val BeepLeadMs = 260L
        const val LongBlinkTestMs = 10000L
        const val PreviewCueMs = 110
        const val PreviewCueCooldownMs = 1500L

        fun average(samples: List<EyeFeatures>): EyeFeatures? {
            if (samples.isEmpty()) return null
            return EyeFeatures(
                mean = samples.sumOf { it.mean } / samples.size,
                contrast = samples.sumOf { it.contrast } / samples.size,
                edge = samples.sumOf { it.edge } / samples.size
            )
        }

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

        fun clamp(value: Double, minValue: Double, maxValue: Double): Double =
            min(maxValue, max(minValue, value))

        fun clampInt(value: Int, minValue: Int, maxValue: Int): Int =
            min(maxValue, max(minValue, value))

        fun clampLong(value: Long, minValue: Long, maxValue: Long): Long =
            min(maxValue, max(minValue, value))
    }
}
