package org.shineaac.inputs

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.Image
import android.media.ImageReader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Range
import android.util.Size
import android.view.Gravity
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

class CameraSwitchCalibrationActivity : Activity() {
    private val analysisSize = Size(480, 360)
    private var textureView: TextureView? = null
    private var overlayView: FaceOverlayView? = null
    private var statusView: TextView? = null
    private var metricsView: TextView? = null
    private var holdView: TextView? = null
    private var zoomView: TextView? = null
    private var startButton: Button? = null
    private var testButton: Button? = null
    private var cameraDevice: CameraDevice? = null
    private var cameraOpening = false
    private var cameraOpenGeneration = 0
    private var session: CameraCaptureSession? = null
    private var repeatingRequestBuilder: CaptureRequest.Builder? = null
    private var activeArraySize: Rect? = null
    private var maxCameraZoomRatio = MaxSavedZoomRatio
    private var analysisRotationDegrees = 0
    private var reader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var mainHandler: Handler? = null
    private var detector: FaceDetector? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var tonePlayer: CameraSwitchTonePlayer? = null
    private var currentSpeechId: String? = null
    private var currentSpeechDone: (() -> Unit)? = null
    private var cueSet = CalibrationCueText.forProfile("en-US")
    private var zhTwUi = false
    private var phase = Phase.Idle
    private var captureEndsAtMs = 0L
    private var activeStepLabel = ""
    private var ttsVoiceLabel = "Voice pending"
    private var calibrationRunId = 0
    private var mlKitInFlight = false
    private var lastFrameAt = 0L
    private val longBlinkDurations = mutableListOf<Long>()
    private val restClosedDurations = mutableListOf<Long>()
    private val testLongBlinkDurations = mutableListOf<Long>()
    private val restEyeSignals = mutableListOf<BlinkEyeSignal>()
    private val slowBlinkEyeSignals = mutableListOf<BlinkEyeSignal>()
    private val calibrationFrameIntervalsMs = mutableListOf<Long>()
    private var lastCalibrationSignalAtMs = 0L
    private var longBlinkClosed = false
    private var longBlinkClosedStartedAt = 0L
    private var calibrationHoldCuePlayed = false
    private var restClosed = false
    private var restClosedStartedAt = 0L
    private var testLongBlinkClosed = false
    private var testLongBlinkClosedStartedAt = 0L
    private var testHoldCuePlayed = false
    private var previewLongBlinkClosed = false
    private var previewLongBlinkClosedStartedAt = 0L
    private var previewHoldCuePlayed = false
    private var previewShortBlinkCount = 0
    private var previewLongBlinkCount = 0
    private var previewLastShortDurationMs = 0L
    private var previewLastDetectedDurationMs = 0L
    private var previewLastShortCueAtMs = 0L
    private var previewLastLongCueAtMs = 0L
    private var calibratedLongBlinkHoldMs = 800L
    private var calibratedZoomRatio = 1.6f
    private var detectionParameters = BlinkDetectionParameters()
    private var savedCalibrationRecord: CameraSwitchCalibrationRecord? = null
    private var cameraPermissionRequested = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        mainHandler = Handler(mainLooper)
        val profileId = intent.getStringExtra(ExtraProfileId) ?: "en-US"
        cueSet = CalibrationCueText.forProfile(profileId)
        zhTwUi = profileId == "zh-TW"
        ttsVoiceLabel = tr("Voice pending", "語音準備中")
        val savedSettings = CameraSwitchPreferences.read(this, enabled = false)
        calibratedLongBlinkHoldMs = savedSettings.longBlinkMs
        calibratedZoomRatio = savedSettings.zoomRatio
        detectionParameters = savedSettings.detectionParameters
        savedCalibrationRecord = CameraSwitchPreferences.readCalibrationRecord(this)
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
        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) configureTtsVoice()
        }
        setContentView(createInsetAwareContentHost(createContentView()))
        updateSavedCalibrationUi()
    }

    private fun createInsetAwareContentHost(content: View): FrameLayout {
        return FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(19, 24, 31))
            addView(
                content,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            setOnApplyWindowInsetsListener { view, insets ->
                val padding = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val systemInsets = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                    intArrayOf(systemInsets.left, systemInsets.top, systemInsets.right, systemInsets.bottom)
                } else {
                    @Suppress("DEPRECATION")
                    intArrayOf(
                        insets.systemWindowInsetLeft,
                        insets.systemWindowInsetTop,
                        insets.systemWindowInsetRight,
                        insets.systemWindowInsetBottom
                    )
                }
                view.setPadding(padding[0], padding[1], padding[2], padding[3])
                insets
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            restoreCameraPermissionActions()
            startCamera()
        } else if (!cameraPermissionRequested) {
            cameraPermissionRequested = true
            requestPermissions(arrayOf(Manifest.permission.CAMERA), CameraPermissionRequestCode)
        } else {
            showCameraPermissionRecovery()
        }
    }

    override fun onPause() {
        stopCamera()
        super.onPause()
    }

    override fun onDestroy() {
        detector?.close()
        detector = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        ttsReady = false
        currentSpeechId = null
        currentSpeechDone = null
        tonePlayer?.release()
        tonePlayer = null
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
            restoreCameraPermissionActions()
            startCamera()
        } else {
            showCameraPermissionRecovery()
        }
    }

    private fun showCameraPermissionRecovery() {
        statusView?.text = tr(
            "Camera permission is required. Open Android settings to allow it.",
            "需要相機權限。請開啟 Android 設定並允許相機。"
        )
        startButton?.apply {
            text = tr("Open app settings", "開啟設定")
            isEnabled = true
            setOnClickListener { openAppSettings() }
        }
        testButton?.isEnabled = false
    }

    private fun restoreCameraPermissionActions() {
        startButton?.apply {
            text = tr("Start setup", "開始")
            setOnClickListener { startAutoCalibration() }
        }
        testButton?.isEnabled = true
    }

    private fun openAppSettings() {
        startActivity(
            Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
        )
    }

    private fun createContentView(): View {
        val wideLayout = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE &&
            resources.configuration.screenWidthDp >= 600
        val root = LinearLayout(this).apply {
            orientation = if (wideLayout) LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(19, 24, 31))
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }

        val title = TextView(this).apply {
            text = tr("Camera setup", "相機設定")
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 2
        }
        statusView = TextView(this).apply {
            text = tr("Center your face, then tap Start setup.", "將臉置於中央，再按「開始設定」。")
            setTextColor(Color.rgb(220, 227, 235))
            textSize = 16f
            setPadding(0, dp(8), 0, dp(8))
            maxLines = 3
        }
        metricsView = TextView(this).apply {
            text = tr("Waiting for camera", "等待相機")
            setTextColor(Color.rgb(159, 173, 188))
            textSize = 14f
            setPadding(0, 0, 0, dp(8))
            maxLines = 2
        }
        holdView = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(12), 0, dp(4))
        }
        zoomView = TextView(this).apply {
            setTextColor(Color.rgb(226, 234, 242))
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(4), 0, dp(4))
        }
        val feedbackView = TextView(this).apply {
            text = tr("Green: eyes. Amber: face.", "綠框：眼睛。黃框：臉部。")
            setTextColor(Color.rgb(183, 196, 210))
            textSize = 14f
            setPadding(0, 0, 0, dp(10))
        }

        val previewFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
            background = roundedBackground(Color.BLACK, dp(8), Color.rgb(58, 70, 82))
        }
        textureView = TextureView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                override fun onSurfaceTextureAvailable(surface: android.graphics.SurfaceTexture, width: Int, height: Int) {
                    updatePreviewTransform(width, height)
                    startCamera()
                }
                override fun onSurfaceTextureSizeChanged(surface: android.graphics.SurfaceTexture, width: Int, height: Int) {
                    updatePreviewTransform(width, height)
                }
                override fun onSurfaceTextureDestroyed(surface: android.graphics.SurfaceTexture): Boolean = true
                override fun onSurfaceTextureUpdated(surface: android.graphics.SurfaceTexture) = Unit
            }
        }
        overlayView = FaceOverlayView(this).apply {
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
            setPadding(if (wideLayout) dp(12) else 0, dp(4), 0, 0)
        }
        startButton = actionButton(tr("Start setup", "開始"), primary = true) {
            setOnClickListener { startAutoCalibration() }
        }
        testButton = actionButton(tr("Test blink", "測試"), primary = false) {
            setOnClickListener { startLongBlinkTest() }
        }
        val closeButton = actionButton(tr("Done", "完成"), primary = false) {
            setOnClickListener { finish() }
        }
        actions.addView(startButton, actionButtonParams(horizontal = true))
        actions.addView(testButton, actionButtonParams(horizontal = true))
        actions.addView(closeButton, actionButtonParams(horizontal = true))

        val holdActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(8))
        }
        holdActions.addView(actionButton(tr("-100 ms", "-100 毫秒"), primary = false) {
            setOnClickListener { adjustHoldMs(-100L) }
        }, actionButtonParams(horizontal = true))
        holdActions.addView(actionButton(tr("+100 ms", "+100 毫秒"), primary = false) {
            setOnClickListener { adjustHoldMs(100L) }
        }, actionButtonParams(horizontal = true))

        val zoomActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(8))
        }
        zoomActions.addView(actionButton(tr("Zoom -", "縮小"), primary = false) {
            setOnClickListener { adjustZoomRatio(-0.2f) }
        }, actionButtonParams(horizontal = true))
        zoomActions.addView(actionButton(tr("Zoom +", "放大"), primary = false) {
            setOnClickListener { adjustZoomRatio(0.2f) }
        }, actionButtonParams(horizontal = true))

        val previewPane = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(statusView)
            addView(metricsView)
            addView(previewFrame)
        }
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(if (wideLayout) dp(12) else 0, dp(8), 0, dp(8))
            addView(holdView)
            addView(holdActions)
            addView(zoomView)
            addView(zoomActions)
            addView(feedbackView)
        }
        val controlsScroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            isVerticalScrollBarEnabled = true
            isScrollbarFadingEnabled = false
            addView(
                controls,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
        val controlsArea = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(
                controlsScroll,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    0,
                    1f
                )
            )
            addView(
                actions,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }

        if (wideLayout) {
            root.addView(previewPane, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 3f))
            root.addView(controlsArea, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 2f))
        } else {
            root.addView(previewPane, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 3f))
            root.addView(controlsArea, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 2f))
        }
        updateHoldUi()
        updateZoomUi()
        return root
    }

    private fun updateSavedCalibrationUi() {
        val quality = savedCalibrationRecord?.qualityDetail
        if (quality != null) {
            statusView?.text = tr(
                "Ready. Long blink is calibrated; use Test blink after moving the phone.",
                "設定完成。移動手機後，請使用「測試眨眼」確認。"
            )
            metricsView?.text = localizedQualityDetail(quality)
        } else {
            statusView?.text = tr("Center your face, then tap Start setup.", "將臉置於中央，再按「開始設定」。")
            metricsView?.text = tr("No saved setup yet.", "尚未儲存設定。")
        }
        testButton?.isEnabled = true
        updateHoldUi()
    }

    private fun configureTtsVoice() {
        val engine = tts ?: return
        engine.setSpeechRate(if (cueSet.locale.language == "zh") 0.82f else 0.88f)
        val exactVoice = engine.voices
            ?.filterNot { it.isNetworkConnectionRequired }
            ?.firstOrNull { it.locale.toLanguageTag().equals(cueSet.locale.toLanguageTag(), ignoreCase = true) }
        if (exactVoice != null) {
            engine.setVoice(exactVoice)
            ttsVoiceLabel = tr("Voice ${exactVoice.locale.toLanguageTag()}", "語音 ${exactVoice.locale.toLanguageTag()}")
        } else {
            val result = engine.setLanguage(cueSet.locale)
            if ((result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) &&
                cueSet.locale.language == "zh"
            ) {
                engine.setLanguage(Locale.TRADITIONAL_CHINESE)
                ttsVoiceLabel = tr(
                    "Voice ${engine.voice?.locale?.toLanguageTag() ?: Locale.TRADITIONAL_CHINESE.toLanguageTag()}",
                    "語音 ${engine.voice?.locale?.toLanguageTag() ?: Locale.TRADITIONAL_CHINESE.toLanguageTag()}"
                )
            } else {
                val actualTag = engine.voice?.locale?.toLanguageTag() ?: cueSet.locale.toLanguageTag()
                ttsVoiceLabel = if (cueSet.locale.toLanguageTag() == "zh-TW" && actualTag != "zh-TW") {
                    "語音 $actualTag；找不到台灣語音"
                } else {
                    tr("Voice $actualTag", "語音 $actualTag")
                }
            }
        }
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) = finishSpeech(utteranceId)
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = finishSpeech(utteranceId)
            override fun onError(utteranceId: String?, errorCode: Int) = finishSpeech(utteranceId)
        })
        runOnUiThread { metricsView?.text = ttsVoiceLabel }
    }

    private fun startAutoCalibration() {
        calibrationRunId += 1
        mainHandler?.removeCallbacksAndMessages(null)
        currentSpeechId = null
        currentSpeechDone = null
        longBlinkDurations.clear()
        restClosedDurations.clear()
        testLongBlinkDurations.clear()
        restEyeSignals.clear()
        slowBlinkEyeSignals.clear()
        calibrationFrameIntervalsMs.clear()
        lastCalibrationSignalAtMs = 0L
        longBlinkClosed = false
        calibrationHoldCuePlayed = false
        restClosed = false
        testLongBlinkClosed = false
        testHoldCuePlayed = false
        previewLongBlinkClosed = false
        previewHoldCuePlayed = false
        previewShortBlinkCount = 0
        previewLongBlinkCount = 0
        previewLastShortDurationMs = 0L
        previewLastDetectedDurationMs = 0L
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
        metricsView?.text = tr(
            "$ttsVoiceLabel | ${step.label} starts after the start tone",
            "$ttsVoiceLabel｜開始提示音後進行${step.label}"
        )
        speakThen(step.cue) {
            if (runId != calibrationRunId) return@speakThen
            if (step.durationMs <= 0L) {
                mainHandler?.postDelayed({ runStep(index + 1, runId) }, AfterSpeechPauseMs)
                return@speakThen
            }
            mainHandler?.postDelayed({
                if (runId == calibrationRunId) {
                    playStartCue()
                    statusView?.text = tr(
                        "${step.label}: capturing for ${step.durationMs / 1000} seconds",
                        "${step.label}：記錄 ${step.durationMs / 1000} 秒"
                    )
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
            CalibrationStep(Phase.Prepare, tr("Prepare", "準備"), cueSet.prepare, 0L),
            CalibrationStep(Phase.Rest, tr("Rest", "放鬆"), cueSet.rest, 8000L),
            CalibrationStep(Phase.LongBlink, tr("Slow blink trials", "慢眨眼測試"), cueSet.longBlink, 12000L)
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
        calibratedLongBlinkHoldMs = calibratedLongBlinkMs()
        detectionParameters = BlinkParameterAutoCalibrator.tune(
            restSignals = restEyeSignals,
            slowBlinkSignals = slowBlinkEyeSignals,
            frameIntervalsMs = calibrationFrameIntervalsMs,
            fallback = detectionParameters
        )
        val quality = calibrationQuality()
        CameraSwitchPreferences.saveCalibration(
            context = this,
            longBlinkMs = calibratedLongBlinkHoldMs,
            cooldownMs = 900L,
            zoomRatio = calibratedZoomRatio,
            detectionParameters = detectionParameters,
            qualityLabel = quality.label,
            qualityDetail = quality.detail
        )
        savedCalibrationRecord = CameraSwitchPreferences.readCalibrationRecord(this)
        updateHoldUi()
        val message = tr(
            "${cueSet.complete} ${quality.label}. Long blink hold ${calibratedLongBlinkHoldMs}ms; camera thresholds updated.",
            "${cueSet.complete} ${quality.label}。長眨眼需維持 ${calibratedLongBlinkHoldMs} 毫秒；相機門檻已更新。"
        )
        statusView?.text = message
        metricsView?.text = quality.detail
        speakThen(message) {}
        startButton?.isEnabled = true
        testButton?.isEnabled = true
    }

    private fun calibratedLongBlinkMs(): Long {
        val measured = longBlinkDurations.filter { it in 450L..2500L }.sorted()
        if (measured.isEmpty()) return 800L
        return clampLong((measured[measured.size / 2] * 0.7).roundToLong(), 550L, 1600L)
    }

    private fun adjustHoldMs(deltaMs: Long) {
        calibratedLongBlinkHoldMs = clampLong(calibratedLongBlinkHoldMs + deltaMs, MinLongBlinkMs, MaxLongBlinkMs)
        CameraSwitchPreferences.saveTiming(this, calibratedLongBlinkHoldMs, 900L)
        updateHoldUi()
        statusView?.text = tr("Long blink hold updated.", "已更新長眨眼時間。")
        metricsView?.text = tr("Test blink to confirm the new hold time works.", "請測試眨眼，確認新設定是否合適。")
    }

    private fun updateHoldUi() {
        holdView?.text = tr(
            "Long blink hold: ${calibratedLongBlinkHoldMs} ms",
            "長眨眼時間：${calibratedLongBlinkHoldMs} 毫秒"
        )
    }

    private fun adjustZoomRatio(delta: Float) {
        val maxZoom = max(1.0f, maxCameraZoomRatio)
        calibratedZoomRatio = (calibratedZoomRatio + delta).coerceIn(1.0f, min(maxZoom, MaxSavedZoomRatio))
        CameraSwitchPreferences.saveZoom(this, calibratedZoomRatio)
        applyZoomToRepeatingRequest()
        updateZoomUi()
        statusView?.text = tr("Camera zoom updated.", "已更新相機縮放。")
        metricsView?.text = tr(
            "Keep the face centered; green box means ML Kit can read the eyes.",
            "臉部保持置中；綠框表示系統能辨識眼睛。"
        )
    }

    private fun updateZoomUi() {
        zoomView?.text = tr(
            "Camera zoom: ${"%.1f".format(calibratedZoomRatio)}x",
            "相機縮放：${"%.1f".format(calibratedZoomRatio)} 倍"
        )
    }

    private fun calibrationQuality(): CalibrationQuality {
        val slowBlinkOk = longBlinkDurations.any { it in 450L..2500L }
        val falseLongBlinks = restClosedDurations.count { it >= calibratedLongBlinkHoldMs }
        val restOk = falseLongBlinks == 0
        val label = when {
            slowBlinkOk && restOk -> tr("Quality good", "品質良好")
            slowBlinkOk -> tr("Quality weak", "品質偏低")
            else -> tr("Quality needs retry", "請重新設定")
        }
        val detail = buildString {
            append(label)
            append(tr(" | slow blinks ", "｜慢眨眼 ")).append(longBlinkDurations.size)
            append(tr(", rest false ", "，放鬆時誤判 ")).append(falseLongBlinks)
            append(tr(", hold ", "，維持 ")).append(calibratedLongBlinkHoldMs).append(tr("ms", " 毫秒"))
            append(tr(", zoom ", "，縮放 ")).append("%.1f".format(calibratedZoomRatio)).append(tr("x", " 倍"))
            append(tr(", close ", "，閉眼門檻 ")).append("%.2f".format(detectionParameters.closeThreshold))
            append(tr(", reopen ", "，張眼門檻 ")).append("%.2f".format(detectionParameters.reopenThreshold))
            append(tr(", stability ", "，穩定時間 ")).append(detectionParameters.reopenStableMs).append(tr("ms", " 毫秒"))
            if (!slowBlinkOk) append(tr(" | no measured slow blink; default hold used", "｜未測得慢眨眼，使用預設時間"))
        }
        return CalibrationQuality(label, detail)
    }

    private fun startLongBlinkTest() {
        calibrationRunId += 1
        mainHandler?.removeCallbacksAndMessages(null)
        currentSpeechId = null
        currentSpeechDone = null
        testLongBlinkDurations.clear()
        testLongBlinkClosed = false
        testLongBlinkClosedStartedAt = 0L
        testHoldCuePlayed = false
        phase = Phase.Instruction
        activeStepLabel = tr("Long blink test", "長眨眼測試")
        captureEndsAtMs = 0L
        startButton?.isEnabled = false
        testButton?.isEnabled = false
        val runId = calibrationRunId
        val holdSeconds = max(1L, (calibratedLongBlinkHoldMs + 999L) / 1000L)
        val cue = tr(
            "After the start tone, close your eyes until you hear the low tone, then open. The test runs for 10 seconds.",
            "聽到開始提示音後閉眼，直到聽到低音再睜眼。測試時間為十秒。"
        )
        statusView?.text = cue
        metricsView?.text = tr(
            "Long blink test starts after the start tone | hold about $holdSeconds seconds",
            "開始提示音後測試長眨眼｜閉眼約 $holdSeconds 秒"
        )
        speakThen(cue) {
            mainHandler?.postDelayed({
                if (runId == calibrationRunId) {
                    playStartCue()
                    mainHandler?.postDelayed({
                        if (runId == calibrationRunId) {
                            phase = Phase.TestLongBlink
                            captureEndsAtMs = System.currentTimeMillis() + LongBlinkTestMs
                            statusView?.text = tr(
                                "Testing long blink for ${LongBlinkTestMs / 1000} seconds",
                                "測試長眨眼 ${LongBlinkTestMs / 1000} 秒"
                            )
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
        val result = if (passed) tr("Long blink test passed", "長眨眼測試通過") else tr("Long blink test failed", "長眨眼測試未通過")
        statusView?.text = result
        metricsView?.text = tr(
            "$result | detected ${testLongBlinkDurations.size}, longest ${best}ms, required ${calibratedLongBlinkHoldMs}ms",
            "$result｜偵測 ${testLongBlinkDurations.size} 次，最長 ${best} 毫秒，需要 ${calibratedLongBlinkHoldMs} 毫秒"
        )
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
        if (result == TextToSpeech.ERROR) finishSpeech(utteranceId)
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
        if (cameraDevice != null || cameraOpening || checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return
        val texture = textureView?.surfaceTexture ?: return
        texture.setDefaultBufferSize(PreviewBufferWidth, PreviewBufferHeight)
        val openGeneration = ++cameraOpenGeneration
        cameraOpening = true
        cameraThread = HandlerThread("ShineCameraCalibration").also { it.start() }
        cameraHandler = Handler(cameraThread!!.looper)
        reader = ImageReader.newInstance(
            analysisSize.width,
            analysisSize.height,
            android.graphics.ImageFormat.YUV_420_888,
            2
        ).apply {
            setOnImageAvailableListener({ imageReader ->
                val image = imageReader.acquireLatestImage() ?: return@setOnImageAvailableListener
                analyze(image)
            }, cameraHandler)
        }

        val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        } ?: run {
            cameraOpening = false
            stopCamera()
            runOnUiThread { statusView?.text = tr("Front camera unavailable.", "找不到前置相機。") }
            return
        }
        val characteristics = manager.getCameraCharacteristics(cameraId)
        val sensorOrientation = characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 0
        analysisRotationDegrees = CameraRotation.compensationDegrees(
            currentSurfaceRotation(),
            sensorOrientation,
            frontFacing = true
        )
        updatePreviewTransform(textureView?.width ?: 0, textureView?.height ?: 0)
        activeArraySize = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
        maxCameraZoomRatio = characteristics
            .get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM)
            ?.coerceAtLeast(1.0f)
            ?: 1.0f
        calibratedZoomRatio = calibratedZoomRatio.coerceIn(1.0f, min(maxCameraZoomRatio, MaxSavedZoomRatio))
        updateZoomUi()
        val fpsRange = targetFpsRange(manager, cameraId)
        try {
            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraOpening = false
                    if (openGeneration != cameraOpenGeneration) {
                        camera.close()
                        return
                    }
                    cameraDevice = camera
                    createCameraSession(camera, Surface(texture), reader?.surface ?: return, fpsRange)
                }

                override fun onDisconnected(camera: CameraDevice) {
                    cameraOpening = false
                    camera.close()
                    cameraDevice = null
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    cameraOpening = false
                    camera.close()
                    cameraDevice = null
                    runOnUiThread { statusView?.text = tr("Camera error $error", "相機錯誤 $error") }
                }
            }, cameraHandler)
        } catch (error: Exception) {
            cameraOpening = false
            stopCamera()
            runOnUiThread {
                statusView?.text = tr(
                    "Camera setup failed: ${error.javaClass.simpleName}",
                    "相機設定失敗：${error.javaClass.simpleName}"
                )
            }
        }
    }

    private fun createCameraSession(camera: CameraDevice, previewSurface: Surface, imageSurface: Surface, fpsRange: Range<Int>?) {
        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
            addTarget(previewSurface)
            addTarget(imageSurface)
            set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
            if (fpsRange != null) {
                set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange)
            }
            set(CaptureRequest.SCALER_CROP_REGION, zoomCropRegion())
        }
        repeatingRequestBuilder = request
        camera.createCaptureSession(listOf(previewSurface, imageSurface), object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(captureSession: CameraCaptureSession) {
                if (cameraDevice == null) {
                    captureSession.close()
                    return
                }
                session = captureSession
                captureSession.setRepeatingRequest(request.build(), null, cameraHandler)
            }

            override fun onConfigureFailed(captureSession: CameraCaptureSession) {
                runOnUiThread { statusView?.text = tr("Camera setup failed.", "相機設定失敗。") }
            }
        }, cameraHandler)
    }

    private fun stopCamera() {
        cameraOpenGeneration += 1
        cameraOpening = false
        cameraHandler?.removeCallbacksAndMessages(null)
        repeatingRequestBuilder = null
        session?.close()
        session = null
        cameraDevice?.close()
        cameraDevice = null
        reader?.close()
        reader = null
        cameraThread?.quitSafely()
        cameraThread = null
        cameraHandler = null
        mlKitInFlight = false
    }

    private fun applyZoomToRepeatingRequest() {
        val builder = repeatingRequestBuilder ?: return
        val captureSession = session ?: return
        val handler = cameraHandler ?: return
        builder.set(CaptureRequest.SCALER_CROP_REGION, zoomCropRegion())
        try {
            captureSession.setRepeatingRequest(builder.build(), null, handler)
        } catch (_: Exception) {
            runOnUiThread { statusView?.text = tr("Camera zoom could not be applied.", "無法套用相機縮放。") }
        }
    }

    private fun zoomCropRegion(): Rect? {
        val activeArray = activeArraySize ?: return null
        val zoom = calibratedZoomRatio.coerceIn(1.0f, min(maxCameraZoomRatio, MaxSavedZoomRatio))
        if (zoom <= 1.01f) return activeArray
        val cropWidth = (activeArray.width() / zoom).toInt()
        val cropHeight = (activeArray.height() / zoom).toInt()
        val left = activeArray.left + (activeArray.width() - cropWidth) / 2
        val top = activeArray.top + (activeArray.height() - cropHeight) / 2
        return Rect(left, top, left + cropWidth, top + cropHeight)
    }

    private fun targetFpsRange(manager: CameraManager, cameraId: String): Range<Int>? {
        val ranges = manager.getCameraCharacteristics(cameraId)
            .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            ?: return null
        return ranges
            .filter { it.upper <= MaxCameraFps && it.upper >= MinCameraFps }
            .minWithOrNull(compareBy<Range<Int>> { kotlin.math.abs(it.upper - TargetCameraFps) }.thenBy { it.lower })
            ?: ranges.minWithOrNull(compareBy<Range<Int>> { it.upper }.thenBy { it.lower })
    }

    private fun analyze(image: Image) {
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
        val rotationDegrees = analysisRotationDegrees
        val imageSize = orientedImageSize(image, rotationDegrees)
        activeDetector.process(InputImage.fromMediaImage(image, rotationDegrees))
            .addOnSuccessListener { faces ->
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val signal = face?.blinkEyeSignal(detectionParameters)
                val score = signal?.closedScore
                if (signal != null) collectCalibrationSample(signal, now)
                val previewBlink = signal?.let { collectPreviewBlinkDuration(it) } ?: PreviewBlink.None
                mainHandler?.post {
                    overlayView?.setFace(face?.boundingBox, imageSize.width, imageSize.height, score != null)
                    when (previewBlink) {
                        PreviewBlink.Short -> {
                            playShortCue()
                            statusView?.text = tr("Short blink detected.", "偵測到短眨眼。")
                        }
                        PreviewBlink.Long -> {
                            playLongAcceptedCue()
                            statusView?.text = tr("Long blink accepted. Current position works.", "長眨眼已接受。目前位置合適。")
                        }
                        PreviewBlink.None -> Unit
                    }
                    updateMetrics(score)
                }
            }
            .addOnFailureListener {
                mainHandler?.post {
                    metricsView?.text = tr(
                        "ML Kit model unavailable or still downloading.",
                        "辨識模型尚未提供，或仍在下載。"
                    )
                }
            }
            .addOnCompleteListener {
                image.close()
                mlKitInFlight = false
            }
    }

    private fun updateMetrics(score: Double?) {
        if (shouldPreviewMonitor()) {
            metricsView?.text = if (score == null) {
                tr("Face not detected", "未偵測到臉部")
            } else {
                tr(
                    "Eyes ${"%.2f".format(score)} | short $previewShortBlinkCount | long $previewLongBlinkCount",
                    "眼睛 ${"%.2f".format(score)}｜短眨眼 $previewShortBlinkCount｜長眨眼 $previewLongBlinkCount"
                )
            }
            return
        }
        if (phase != Phase.Complete) {
            val remainingMs = max(0L, captureEndsAtMs - System.currentTimeMillis())
            metricsView?.text = if (score == null) {
                tr("$ttsVoiceLabel | Face not detected", "$ttsVoiceLabel｜未偵測到臉部")
            } else if (captureEndsAtMs > 0L) {
                tr(
                    "$activeStepLabel ${((remainingMs + 999L) / 1000L)}s left | score ${"%.2f".format(score)} | long blinks ${longBlinkDurations.size}",
                    "$activeStepLabel 剩下 ${((remainingMs + 999L) / 1000L)} 秒｜分數 ${"%.2f".format(score)}｜長眨眼 ${longBlinkDurations.size}"
                )
            } else {
                tr(
                    "$ttsVoiceLabel | score ${"%.2f".format(score)}",
                    "$ttsVoiceLabel｜分數 ${"%.2f".format(score)}"
                )
            }
        }
    }

    private fun shouldPreviewMonitor(): Boolean =
        (phase == Phase.Idle || phase == Phase.Complete) && currentSpeechId == null

    private fun playStartCue() {
        tonePlayer?.playStart()
    }

    private fun playShortCue() {
        tonePlayer?.playSetupShortBlink()
    }

    private fun playHoldReachedCue() {
        tonePlayer?.playHoldReached()
    }

    private fun playLongAcceptedCue() {
        tonePlayer?.playLongAccepted()
    }

    private fun collectCalibrationSample(signal: BlinkEyeSignal, now: Long) {
        if (phase == Phase.Rest || phase == Phase.LongBlink) {
            if (lastCalibrationSignalAtMs > 0L) {
                calibrationFrameIntervalsMs.add(now - lastCalibrationSignalAtMs)
            }
            lastCalibrationSignalAtMs = now
        }
        when (phase) {
            Phase.Rest -> {
                restEyeSignals.add(signal)
                collectRestClosedDuration(signal)
            }
            Phase.LongBlink -> {
                slowBlinkEyeSignals.add(signal)
                collectLongBlinkDuration(signal)
            }
            Phase.TestLongBlink -> collectTestLongBlinkDuration(signal)
            else -> Unit
        }
    }

    private fun collectLongBlinkDuration(signal: BlinkEyeSignal) {
        val now = System.currentTimeMillis()
        if (!longBlinkClosed && signal.closedScore >= detectionParameters.closeThreshold) {
            longBlinkClosed = true
            longBlinkClosedStartedAt = now
            calibrationHoldCuePlayed = false
        } else if (longBlinkClosed && !calibrationHoldCuePlayed && now - longBlinkClosedStartedAt >= calibratedLongBlinkHoldMs) {
            calibrationHoldCuePlayed = true
            playHoldReachedCue()
        } else if (longBlinkClosed && signal.reopenScore <= detectionParameters.reopenThreshold) {
            longBlinkDurations.add(now - longBlinkClosedStartedAt)
            longBlinkClosed = false
            calibrationHoldCuePlayed = false
        }
    }

    private fun collectRestClosedDuration(signal: BlinkEyeSignal) {
        val now = System.currentTimeMillis()
        if (!restClosed && signal.closedScore >= detectionParameters.closeThreshold) {
            restClosed = true
            restClosedStartedAt = now
        } else if (restClosed && signal.reopenScore <= detectionParameters.reopenThreshold) {
            restClosedDurations.add(now - restClosedStartedAt)
            restClosed = false
        }
    }

    private fun collectTestLongBlinkDuration(signal: BlinkEyeSignal) {
        val now = System.currentTimeMillis()
        if (!testLongBlinkClosed && signal.closedScore >= detectionParameters.closeThreshold) {
            testLongBlinkClosed = true
            testLongBlinkClosedStartedAt = now
            testHoldCuePlayed = false
        } else if (testLongBlinkClosed && !testHoldCuePlayed && now - testLongBlinkClosedStartedAt >= calibratedLongBlinkHoldMs) {
            testHoldCuePlayed = true
            playHoldReachedCue()
        } else if (testLongBlinkClosed && signal.reopenScore <= detectionParameters.reopenThreshold) {
            testLongBlinkDurations.add(now - testLongBlinkClosedStartedAt)
            testLongBlinkClosed = false
            testHoldCuePlayed = false
        }
    }

    private fun collectPreviewBlinkDuration(signal: BlinkEyeSignal): PreviewBlink {
        if (!shouldPreviewMonitor()) {
            previewLongBlinkClosed = false
            previewLongBlinkClosedStartedAt = 0L
            previewHoldCuePlayed = false
            return PreviewBlink.None
        }
        val now = System.currentTimeMillis()
        if (!previewLongBlinkClosed && signal.closedScore >= detectionParameters.closeThreshold) {
            previewLongBlinkClosed = true
            previewLongBlinkClosedStartedAt = now
            previewHoldCuePlayed = false
            return PreviewBlink.None
        }
        if (previewLongBlinkClosed && !previewHoldCuePlayed && now - previewLongBlinkClosedStartedAt >= calibratedLongBlinkHoldMs) {
            previewHoldCuePlayed = true
            playHoldReachedCue()
        }
        if (previewLongBlinkClosed && signal.reopenScore <= detectionParameters.reopenThreshold) {
            val duration = now - previewLongBlinkClosedStartedAt
            previewLongBlinkClosed = false
            previewHoldCuePlayed = false
            val shortMaxMs = max(ShortBlinkMinMs, calibratedLongBlinkHoldMs - LongBlinkGuardMs)
            if (duration >= calibratedLongBlinkHoldMs && now - previewLastLongCueAtMs >= LongPreviewCueCooldownMs) {
                previewLastLongCueAtMs = now
                previewLastDetectedDurationMs = duration
                previewLongBlinkCount += 1
                return PreviewBlink.Long
            }
            if (duration in ShortBlinkMinMs until shortMaxMs && now - previewLastShortCueAtMs >= ShortPreviewCueCooldownMs) {
                previewLastShortCueAtMs = now
                previewLastShortDurationMs = duration
                previewShortBlinkCount += 1
                return PreviewBlink.Short
            }
        }
        return PreviewBlink.None
    }

    private fun orientedImageSize(image: Image, rotation: Int): Size =
        if (rotation == 90 || rotation == 270) Size(image.height, image.width) else Size(image.width, image.height)

    private fun currentSurfaceRotation(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.rotation
        }

    private fun updatePreviewTransform(width: Int, height: Int) {
        val texture = textureView ?: return
        val scale = CameraPreviewGeometry.aspectFitScale(
            viewWidth = width,
            viewHeight = height,
            bufferWidth = PreviewBufferWidth,
            bufferHeight = PreviewBufferHeight,
            rotationDegrees = analysisRotationDegrees
        )
        texture.setTransform(
            Matrix().apply {
                setScale(scale.x, scale.y, width / 2f, height / 2f)
            }
        )
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToLong().toInt()

    private fun tr(english: String, traditionalChinese: String): String =
        if (zhTwUi) traditionalChinese else english

    private fun localizedQualityDetail(detail: String): String {
        if (!zhTwUi) return detail
        return detail
            .replace("Quality good", "品質良好")
            .replace("Quality weak", "品質偏低")
            .replace("Quality needs retry", "請重新設定")
            .replace(" | slow blinks ", "｜慢眨眼 ")
            .replace(", rest false ", "，放鬆時誤判 ")
            .replace(", hold ", "，維持 ")
            .replace(", zoom ", "，縮放 ")
            .replace(" | no measured slow blink; default hold used", "｜未測得慢眨眼，使用預設時間")
            .replace("ms", " 毫秒")
            .replace("x", " 倍")
    }

    private fun actionButton(text: String, primary: Boolean, configure: Button.() -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        minHeight = dp(44)
        minWidth = 0
        textSize = 14f
        maxLines = 2
        setPadding(dp(8), 0, dp(8), 0)
        setTextColor(if (primary) Color.WHITE else Color.rgb(226, 234, 242))
        background = roundedBackground(
            if (primary) Color.rgb(35, 122, 110) else Color.rgb(42, 52, 64),
            dp(8),
            if (primary) Color.rgb(52, 211, 153) else Color.rgb(78, 92, 108)
        )
        configure()
    }

    private fun actionButtonParams(horizontal: Boolean) = LinearLayout.LayoutParams(
        if (horizontal) 0 else LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        if (horizontal) 1f else 0f
    ).apply {
        setMargins(dp(4), dp(4), dp(4), dp(4))
    }

    private fun roundedBackground(color: Int, radius: Int, strokeColor: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius.toFloat()
            if (strokeColor != null) setStroke(dp(1), strokeColor)
        }

    private class FaceOverlayView(context: Context) : View(context) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(52, 211, 153)
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        private var face: Rect? = null
        private var frameWidth = 0
        private var frameHeight = 0
        private var hasEyeSignal = false

        fun setFace(nextFace: Rect?, width: Int, height: Int, nextHasEyeSignal: Boolean) {
            face = nextFace
            frameWidth = width
            frameHeight = height
            hasEyeSignal = nextHasEyeSignal
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val box = face ?: return
            if (frameWidth <= 0 || frameHeight <= 0) return
            val scale = min(width / frameWidth.toFloat(), height / frameHeight.toFloat())
            val drawnWidth = frameWidth * scale
            val drawnHeight = frameHeight * scale
            val leftOffset = (width - drawnWidth) / 2f
            val topOffset = (height - drawnHeight) / 2f
            paint.color = if (hasEyeSignal) Color.rgb(52, 211, 153) else Color.rgb(245, 158, 11)
            val mirroredLeft = frameWidth - box.right
            val mirroredRight = frameWidth - box.left
            val rect = RectF(
                leftOffset + mirroredLeft * scale,
                topOffset + box.top * scale,
                leftOffset + mirroredRight * scale,
                topOffset + box.bottom * scale
            )
            canvas.drawRect(rect, paint)
        }
    }

    private data class CalibrationStep(val phase: Phase, val label: String, val cue: String, val durationMs: Long)
    private data class CalibrationQuality(val label: String, val detail: String)
    private enum class Phase { Idle, Instruction, Prepare, Rest, LongBlink, TestLongBlink, Complete }
    private enum class PreviewBlink { None, Short, Long }

    private companion object {
        const val ExtraProfileId = "org.shineaac.inputs.PROFILE_ID"
        const val CameraPermissionRequestCode = 2504
        const val PreviewBufferWidth = 640
        const val PreviewBufferHeight = 480
        const val MlKitFrameIntervalMs = 200L
        const val TargetCameraFps = 10
        const val MinCameraFps = 5
        const val MaxCameraFps = 15
        const val AfterSpeechPauseMs = 700L
        const val BeepLeadMs = 260L
        const val LongBlinkTestMs = 10000L
        const val ShortBlinkMinMs = 80L
        const val MinLongBlinkMs = 550L
        const val MaxLongBlinkMs = 1600L
        const val LongBlinkGuardMs = 150L
        const val ShortPreviewCueCooldownMs = 250L
        const val LongPreviewCueCooldownMs = 1500L
        const val MaxSavedZoomRatio = 4.0f

        fun clampLong(value: Long, minValue: Long, maxValue: Long): Long =
            min(maxValue, max(minValue, value))
    }
}
