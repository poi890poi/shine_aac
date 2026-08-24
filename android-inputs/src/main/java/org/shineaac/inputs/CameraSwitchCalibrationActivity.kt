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
import android.util.Log
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
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import java.util.concurrent.Executor
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

class CameraSwitchCalibrationActivity : Activity() {
    private val analysisSize = Size(480, 360)
    private var textureView: TextureView? = null
    private var overlayView: FaceOverlayView? = null
    private var statusView: TextView? = null
    private var metricsView: TextView? = null
    private var gestureView: TextView? = null
    private var holdView: TextView? = null
    private var zoomView: TextView? = null
    private var cameraView: TextView? = null
    private var startButton: Button? = null
    private var changeCameraButton: Button? = null
    private var blinkGestureButton: Button? = null
    private var cheekGestureButton: Button? = null
    private var cameraDevice: CameraDevice? = null
    private var cameraOpening = false
    private var cameraOpenGeneration = 0
    private var session: CameraCaptureSession? = null
    private var repeatingRequestBuilder: CaptureRequest.Builder? = null
    private var activeArraySize: Rect? = null
    private var availableCameras = emptyList<CameraSwitchCamera>()
    private var selectedCamera: CameraSwitchCamera? = null
    private var preferredCameraId: String? = null
    private var preferredLensFacing: Int? = null
    private var maxCameraZoomRatio = MaxSavedZoomRatio
    private var analysisRotationDegrees = 0
    private var activeCameraMirrored = true
    private var reader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var mainHandler: Handler? = null
    private var detector: FaceDetector? = null
    private var cheekAnalyzer: CheekFaceAnalyzer? = null
    private var cheekDetector = CheekTwitchDetector()
    private var cheekClassifier = BinarySwitchClassifier(
        BinarySwitchClassifier.Config(
            enterThreshold = CheekTwitchDetector.DefaultEnterThreshold,
            exitThreshold = CheekTwitchDetector.DefaultExitThreshold,
            minimumHoldMs = 180L
        )
    )
    private var cheekPreviewActivations = 0
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
    private val restEyeSignals = mutableListOf<BlinkEyeSignal>()
    private val slowBlinkEyeSignals = mutableListOf<BlinkEyeSignal>()
    private val calibrationFrameIntervalsMs = mutableListOf<Long>()
    private var lastCalibrationSignalAtMs = 0L
    private var longBlinkClosed = false
    private var longBlinkClosedStartedAt = 0L
    private var calibrationHoldCuePlayed = false
    private var restClosed = false
    private var restClosedStartedAt = 0L
    private var previewLongBlinkClosed = false
    private var previewLongBlinkClosedStartedAt = 0L
    private var previewHoldCuePlayed = false
    private var previewShortBlinkCount = 0
    private var previewLongBlinkCount = 0
    private var previewLastShortDurationMs = 0L
    private var previewLastDetectedDurationMs = 0L
    private var previewLastShortCueAtMs = 0L
    private var previewLastLongCueAtMs = 0L
    private var calibratedLongBlinkHoldMs = CameraSwitchSettings.DefaultLongBlinkMs
    private var selectedGesture = OpticalSwitchGesture.LongBlink
    private var cheekHoldMs = CameraSwitchSettings.DefaultCheekHoldMs
    private var cheekModel: CheekGestureModel? = null
    private val cheekCalibrator = CheekGestureCalibrator()
    private var cheekCalibrationStage = CheekCalibrationStage.Idle
    private var cheekCalibrationTrial = 0
    private var cheekCalibrationBuffer = mutableListOf<Map<String, Double>>()
    private var cheekCalibrationPeak = 0.0
    private var calibratedZoomRatio = 1.6f
    private var detectionParameters = BlinkDetectionParameters()
    private var savedCalibrationRecord: CameraSwitchCalibrationRecord? = null
    private var cameraPermissionRequested = false
    @Volatile private var activityResumed = false

    override fun attachBaseContext(newBase: Context) {
        val configuration = Configuration(newBase.resources.configuration).apply {
            fontScale = cameraSetupFontScale(fontScale)
        }
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        mainHandler = Handler(mainLooper)
        val profileId = intent.getStringExtra(ExtraProfileId) ?: "en-US"
        cueSet = CalibrationCueText.forProfile(profileId)
        zhTwUi = profileId == "zh-TW"
        ttsVoiceLabel = tr("Voice pending", "語音準備中")
        val savedSettings = CameraSwitchPreferences.read(this, enabled = false)
        selectedGesture = savedSettings.gesture
        cheekHoldMs = savedSettings.cheekHoldMs
        cheekModel = savedSettings.cheekModel
        calibratedLongBlinkHoldMs = savedSettings.longBlinkMs
        calibratedZoomRatio = savedSettings.zoomRatio
        preferredCameraId = savedSettings.cameraId
        preferredLensFacing = savedSettings.cameraLensFacing
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
        cheekAnalyzer = runCatching { CheekFaceAnalyzer(this) }.getOrNull()
        resetCheekClassifier()
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
        activityResumed = true
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
        activityResumed = false
        stopCamera()
        super.onPause()
    }

    override fun onDestroy() {
        detector?.close()
        detector = null
        cheekAnalyzer?.close()
        cheekAnalyzer = null
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
    }

    private fun restoreCameraPermissionActions() {
        updateGestureUi()
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
            text = tr("Optical switch setup", "光學開關設定")
            setTextColor(Color.WHITE)
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        statusView = TextView(this).apply {
            text = tr("Center your face, then tap Start setup.", "將臉置於中央，再按「開始設定」。")
            setTextColor(Color.rgb(220, 227, 235))
            textSize = 15f
            setPadding(0, dp(4), 0, dp(2))
            minLines = 2
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        metricsView = TextView(this).apply {
            text = tr("Waiting for camera", "等待相機")
            setTextColor(Color.rgb(226, 234, 242))
            textSize = 13f
            setPadding(dp(6), dp(3), dp(6), dp(3))
            background = roundedBackground(Color.argb(190, 15, 23, 42), dp(6))
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        holdView = compactValueLabel()
        zoomView = compactValueLabel()
        cameraView = compactValueLabel().apply {
            text = tr("Finding cameras…", "正在搜尋相機…")
        }

        val previewFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
            background = roundedBackground(Color.BLACK, dp(8), Color.rgb(58, 70, 82))
            contentDescription = tr("Camera preview", "相機預覽")
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
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
                override fun onSurfaceTextureDestroyed(surface: android.graphics.SurfaceTexture): Boolean {
                    stopCamera()
                    return true
                }
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
        previewFrame.addView(
            metricsView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP
            ).apply {
                setMargins(dp(6), dp(6), dp(6), 0)
            }
        )

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(if (wideLayout) dp(12) else 0, dp(2), 0, 0)
        }
        startButton = actionButton(tr("Start setup", "開始"), primary = true) {
            setOnClickListener { startAutoCalibration() }
        }
        val closeButton = actionButton(tr("Done", "完成"), primary = false) {
            setOnClickListener { finish() }
        }
        actions.addView(startButton, actionButtonParams(horizontal = true))
        actions.addView(closeButton, actionButtonParams(horizontal = true))

        blinkGestureButton = actionButton(tr("Long blink", "長眨眼"), primary = false) {
            setOnClickListener { selectGesture(OpticalSwitchGesture.LongBlink) }
        }
        cheekGestureButton = actionButton(tr("Cheek twitch", "臉頰抽動"), primary = false) {
            setOnClickListener { selectGesture(OpticalSwitchGesture.CheekTwitch) }
        }
        changeCameraButton = actionButton(tr("Next camera", "下一個相機"), primary = false) {
            setOnClickListener { changeCamera() }
        }

        val gestureRow = controlRow(
            label = TextView(this).apply {
                text = tr("Gesture", "動作")
                setTextColor(Color.rgb(226, 234, 242))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER_VERTICAL
            },
            buttons = listOf(blinkGestureButton, cheekGestureButton),
            labelWeight = 0.8f
        )
        val cameraRow = controlRow(
            cameraView,
            listOf(changeCameraButton),
            labelWeight = 1.4f
        )
        val holdRow = controlRow(
            holdView,
            listOf(
                actionButton(tr("-100", "-100"), primary = false) {
                    setOnClickListener { adjustHoldMs(-100L) }
                },
                actionButton(tr("+100", "+100"), primary = false) {
                    setOnClickListener { adjustHoldMs(100L) }
                }
            ),
            labelWeight = 1.4f
        )
        val zoomRow = controlRow(
            zoomView,
            listOf(
                actionButton(tr("Zoom -", "縮小"), primary = false) {
                    setOnClickListener { adjustZoomRatio(-0.2f) }
                },
                actionButton(tr("Zoom +", "放大"), primary = false) {
                    setOnClickListener { adjustZoomRatio(0.2f) }
                }
            ),
            labelWeight = 1.4f
        )
        val previewPane = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(statusView)
            addView(previewFrame)
        }
        val controlsColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(if (wideLayout) dp(12) else 0, dp(4), 0, 0)
            addView(gestureRow)
            addView(cameraRow)
            addView(holdRow)
            addView(zoomRow)
            addView(
                actions,
                LinearLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
        val controlsArea = ScrollView(this).apply {
            isFillViewport = false
            clipToPadding = false
            addView(
                controlsColumn,
                FrameLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }

        if (wideLayout) {
            root.addView(previewPane, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 3f))
            root.addView(controlsArea, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 2f))
        } else {
            root.addView(previewPane, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            root.addView(
                controlsArea,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
        updateGestureUi()
        updateHoldUi()
        updateZoomUi()
        return root
    }

    private fun compactValueLabel(): TextView = TextView(this).apply {
        setTextColor(Color.rgb(226, 234, 242))
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER_VERTICAL
        maxLines = 2
        ellipsize = android.text.TextUtils.TruncateAt.END
    }

    private fun controlRow(
        label: View?,
        buttons: List<Button?>,
        labelWeight: Float
    ): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        val buttonLayouts = buttons.filterNotNull().map { button ->
            button to compactControlButtonParams(button)
        }
        if (label != null) {
            addView(
                label,
                LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    labelWeight
                )
            )
        }
        buttonLayouts.forEach { (button, params) ->
            addView(button, params)
        }
    }

    private fun updateSavedCalibrationUi() {
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            val record = CameraSwitchPreferences.readCheekCalibrationRecord(this)
            if (record != null && cheekModel != null) {
                statusView?.text = tr(
                    "Ready. Your cheek movement is calibrated; calibration is optional to repeat.",
                    "設定完成。已學會您的臉頰動作；可選擇重新校正。"
                )
                metricsView?.text = record.qualityDetail ?: tr(
                    "Saved personalized cheek model.",
                    "已儲存個人化臉頰模型。"
                )
            } else {
                statusView?.text = tr(
                    "Cheek twitch works without calibration. Optional calibration can improve reliability.",
                    "臉頰抽動不校正也能使用；選用校正可提升可靠度。"
                )
                metricsView?.text = tr(
                    "Relax briefly for the default detector, or tap Calibrate (optional).",
                    "先短暫放鬆即可使用預設偵測；也可按「校正（選用）」。"
                )
            }
            updateGestureUi()
            updateHoldUi()
            return
        }
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
        updateGestureUi()
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
        if (selectedGesture != OpticalSwitchGesture.LongBlink) return
        calibrationRunId += 1
        mainHandler?.removeCallbacksAndMessages(null)
        currentSpeechId = null
        currentSpeechDone = null
        longBlinkDurations.clear()
        restClosedDurations.clear()
        restEyeSignals.clear()
        slowBlinkEyeSignals.clear()
        calibrationFrameIntervalsMs.clear()
        lastCalibrationSignalAtMs = 0L
        longBlinkClosed = false
        calibrationHoldCuePlayed = false
        restClosed = false
        previewLongBlinkClosed = false
        previewHoldCuePlayed = false
        previewShortBlinkCount = 0
        previewLongBlinkCount = 0
        previewLastShortDurationMs = 0L
        previewLastDetectedDurationMs = 0L
        captureEndsAtMs = 0L
        activeStepLabel = ""
        startButton?.isEnabled = false
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
    }

    private fun calibratedLongBlinkMs(): Long {
        val measured = longBlinkDurations.filter { it in 450L..2500L }.sorted()
        if (measured.isEmpty()) return CameraSwitchSettings.DefaultLongBlinkMs
        return clampLong((measured[measured.size / 2] * 0.7).roundToLong(), 550L, 1600L)
    }

    private fun selectGesture(gesture: OpticalSwitchGesture) {
        if (selectedGesture == gesture) return

        when (selectedGesture) {
            OpticalSwitchGesture.LongBlink -> cancelLongBlinkCalibration()
            OpticalSwitchGesture.CheekTwitch -> resetCheekCalibrationProgress()
        }

        selectedGesture = gesture
        CameraSwitchPreferences.saveGesture(this, gesture)
        overlayView?.clearDetection()

        if (gesture == OpticalSwitchGesture.CheekTwitch) {
            cheekDetector.reset()
            cheekPreviewActivations = 0
            resetCheekClassifier()
        }

        updateGestureUi()
        updateSavedCalibrationUi()
    }

    private fun cancelLongBlinkCalibration() {
        // Calibration callbacks capture calibrationRunId. Invalidating only
        // that run is safer than clearing unrelated main-handler callbacks.
        calibrationRunId += 1
        tts?.stop()
        currentSpeechId = null
        currentSpeechDone = null
        phase = Phase.Idle
        captureEndsAtMs = 0L
        activeStepLabel = ""

        longBlinkDurations.clear()
        restClosedDurations.clear()
        restEyeSignals.clear()
        slowBlinkEyeSignals.clear()
        calibrationFrameIntervalsMs.clear()
        lastCalibrationSignalAtMs = 0L

        longBlinkClosed = false
        longBlinkClosedStartedAt = 0L
        calibrationHoldCuePlayed = false
        restClosed = false
        restClosedStartedAt = 0L
        previewLongBlinkClosed = false
        previewLongBlinkClosedStartedAt = 0L
        previewHoldCuePlayed = false
        startButton?.isEnabled = true
    }

    private fun resetCheekCalibrationProgress() {
        cheekCalibrationStage = CheekCalibrationStage.Idle
        cheekCalibrationTrial = 0
        cheekCalibrationBuffer.clear()
        cheekCalibrationPeak = 0.0
        cheekCalibrator.reset()
        cheekDetector.reset()
        cheekPreviewActivations = 0
        resetCheekClassifier()
        startButton?.isEnabled = true
    }

    private fun updateGestureUi() {
        gestureView?.text = when (selectedGesture) {
            OpticalSwitchGesture.LongBlink -> tr("Input: Long blink", "輸入方式：長眨眼")
            OpticalSwitchGesture.CheekTwitch -> tr("Input: Cheek twitch", "輸入方式：臉頰抽動")
        }
        applyGestureButtonStyle(blinkGestureButton, selectedGesture == OpticalSwitchGesture.LongBlink)
        applyGestureButtonStyle(cheekGestureButton, selectedGesture == OpticalSwitchGesture.CheekTwitch)
        startButton?.apply {
            isEnabled = true
            if (selectedGesture == OpticalSwitchGesture.LongBlink) {
                text = tr("Start setup", "開始設定")
                setOnClickListener { startAutoCalibration() }
            } else {
                text = tr("Start setup", "開始設定")
                setOnClickListener { startCheekCalibration() }
            }
        }
    }

    private fun applyGestureButtonStyle(button: Button?, selected: Boolean) {
        button ?: return
        button.setTextColor(if (selected) Color.WHITE else Color.rgb(226, 234, 242))
        button.typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        button.background = roundedBackground(
            if (selected) Color.rgb(35, 122, 110) else Color.rgb(42, 52, 64),
            dp(8),
            if (selected) Color.rgb(52, 211, 153) else Color.rgb(78, 92, 108)
        )
    }

    private fun startCheekCalibration() {
        cheekCalibrator.reset()
        cheekDetector.reset()
        cheekCalibrationStage = CheekCalibrationStage.Rest
        cheekCalibrationTrial = 0
        cheekCalibrationBuffer.clear()
        cheekCalibrationPeak = 0.0
        cheekPreviewActivations = 0
        statusView?.text = tr(
            "Calibration: relax your face. We will continue automatically when enough resting frames are collected.",
            "校正：請放鬆臉部。收集足夠的放鬆影像後會自動繼續。"
        )
        metricsView?.text = tr("Relaxed frames 0 / 36", "放鬆影像 0 / 36")
        startButton?.isEnabled = false
    }

    private fun processCheekCalibration(values: Map<String, Double>, liveScore: Double?): Boolean {
        when (cheekCalibrationStage) {
            CheekCalibrationStage.Idle -> return false
            CheekCalibrationStage.Rest -> {
                cheekCalibrator.addNeutral(values)
                val count = cheekCalibrator.neutralCount()
                if (count >= 36 && cheekDetector.ready) {
                    cheekCalibrationStage = CheekCalibrationStage.Move
                    cheekCalibrationBuffer.clear()
                    cheekCalibrationPeak = 0.0
                    statusView?.text = tr(
                        "Now make six cheek twitches whenever you are ready; relax between each one.",
                        "現在請自行做六次臉頰抽動；每次之間放鬆。"
                    )
                }
                metricsView?.text = tr("Relaxed frames $count / 36", "放鬆影像 $count / 36")
                return false
            }
            CheekCalibrationStage.Move -> {
                val score = liveScore ?: return false
                if (score >= CheekTwitchDetector.DefaultExitThreshold * 0.5) {
                    cheekCalibrationBuffer.add(values)
                    cheekCalibrationPeak = max(cheekCalibrationPeak, score)
                    return false
                }
                val accepted = cheekCalibrationPeak >= CheekTwitchDetector.DefaultEnterThreshold && cheekCalibrationBuffer.size >= 3
                if (accepted) {
                    cheekCalibrationTrial += 1
                    cheekCalibrationBuffer.forEach { cheekCalibrator.addActive(cheekCalibrationTrial, it) }
                    playLongAcceptedCue()
                }
                cheekCalibrationBuffer.clear()
                cheekCalibrationPeak = 0.0
                metricsView?.text = tr("Accepted movements $cheekCalibrationTrial / 6", "已接受動作 $cheekCalibrationTrial / 6")
                if (cheekCalibrationTrial >= 6) finishCheekCalibration()
                return accepted
            }
        }
    }

    private fun finishCheekCalibration() {
        when (val outcome = cheekCalibrator.build()) {
            is CheekCalibrationOutcome.Success -> {
                cheekModel = outcome.model
                val quality = outcome.model.quality
                CameraSwitchPreferences.saveCheekCalibration(
                    context = this, model = outcome.model, cheekHoldMs = cheekHoldMs,
                    zoomRatio = calibratedZoomRatio, qualityLabel = tr("Quality good", "品質良好"),
                    qualityDetail = quality.message
                )
                cheekCalibrationStage = CheekCalibrationStage.Idle
                resetCheekClassifier()
                startButton?.isEnabled = true
                statusView?.text = tr("Cheek calibration saved.", "臉頰校正已儲存。")
                metricsView?.text = tr("${quality.message} Learned ${outcome.model.summary()}.", "${quality.message} 已學習 ${outcome.model.summary()}。")
            }
            is CheekCalibrationOutcome.Failure -> {
                cheekCalibrationStage = CheekCalibrationStage.Idle
                startButton?.isEnabled = true
                statusView?.text = tr(
                    "Calibration was not reliable enough; the default detector remains usable.",
                    "校正可靠度不足；仍可繼續使用預設偵測。"
                )
                metricsView?.text = outcome.reason
            }
        }
    }

    private fun adjustHoldMs(deltaMs: Long) {
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            cheekHoldMs = clampLong(
                cheekHoldMs + deltaMs,
                MinCheekHoldMs,
                MaxCheekHoldMs
            )
            CameraSwitchPreferences.saveCheekHold(this, cheekHoldMs)
            resetCheekClassifier()
            statusView?.text = tr(
                "Cheek hold updated.",
                "已更新臉頰抽動維持時間。"
            )
        } else {
            calibratedLongBlinkHoldMs = clampLong(
                calibratedLongBlinkHoldMs + deltaMs,
                MinLongBlinkMs,
                MaxLongBlinkMs
            )
            CameraSwitchPreferences.saveTiming(
                this,
                calibratedLongBlinkHoldMs,
                900L
            )
            statusView?.text = tr(
                "Long blink hold updated.",
                "已更新長眨眼時間。"
            )
            metricsView?.text = tr(
                "Test blink to confirm the new hold time works.",
                "請測試眨眼，確認新設定是否合適。"
            )
        }

        updateHoldUi()
    }

    private fun updateHoldUi() {
        holdView?.text = when (selectedGesture) {
            OpticalSwitchGesture.LongBlink ->
                compactDurationLabel(
                    tr("Long blink", "長眨眼"),
                    calibratedLongBlinkHoldMs,
                    tr("ms", "毫秒")
                )
            OpticalSwitchGesture.CheekTwitch ->
                compactDurationLabel(
                    tr("Cheek hold", "臉頰維持"),
                    cheekHoldMs,
                    tr("ms", "毫秒")
                )
        }
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
        zoomView?.text = compactZoomLabel(
            tr("Zoom", "縮放"), calibratedZoomRatio
        )
    }

    private fun calibrationQuality(): CalibrationQuality {
        val assessment = BlinkCalibrationQualityPolicy.assess(
            longBlinkDurations,
            restClosedDurations,
            calibratedLongBlinkHoldMs
        )
        val label = when (assessment.level) {
            BlinkCalibrationQualityPolicy.Level.Good -> tr("Quality good", "品質良好")
            BlinkCalibrationQualityPolicy.Level.Weak -> tr("Quality weak", "品質偏低")
            BlinkCalibrationQualityPolicy.Level.Retry -> tr("Quality needs retry", "請重新設定")
        }
        val detail = buildString {
            append(label)
            append(tr(" | slow blinks ", "｜慢眨眼 ")).append(assessment.validSlowBlinkCount)
            append(tr(", rest false ", "，放鬆時誤判 ")).append(assessment.falseLongBlinkCount)
            append(tr(", hold ", "，維持 ")).append(calibratedLongBlinkHoldMs).append(tr("ms", " 毫秒"))
            append(tr(", zoom ", "，縮放 ")).append("%.1f".format(calibratedZoomRatio)).append(tr("x", " 倍"))
            append(tr(", close ", "，閉眼門檻 ")).append("%.2f".format(detectionParameters.closeThreshold))
            append(tr(", reopen ", "，張眼門檻 ")).append("%.2f".format(detectionParameters.reopenThreshold))
            append(tr(", stability ", "，穩定時間 ")).append(detectionParameters.reopenStableMs).append(tr("ms", " 毫秒"))
            if (assessment.validSlowBlinkCount == 0) {
                append(tr(" | no measured slow blink; default hold used", "｜未測得慢眨眼，使用預設時間"))
            } else if (assessment.validSlowBlinkCount < BlinkCalibrationQualityPolicy.MinimumGoodSlowBlinks) {
                append(tr(" | repeat setup for a more reliable calibration", "｜建議重新設定以提升可靠度"))
            }
        }
        return CalibrationQuality(label, detail)
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
    @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
    private fun startCamera() {
        if (!activityResumed) return
        if (
            cameraDevice != null ||
            cameraOpening ||
            checkSelfPermission(Manifest.permission.CAMERA) !=
                PackageManager.PERMISSION_GRANTED
        ) return

        val texture = textureView?.surfaceTexture ?: return
        texture.setDefaultBufferSize(PreviewBufferWidth, PreviewBufferHeight)
        val openGeneration = ++cameraOpenGeneration
        cameraOpening = true
        cameraThread =
            HandlerThread("ShineCameraCalibration").also { it.start() }
        cameraHandler = Handler(cameraThread!!.looper)
        reader = ImageReader.newInstance(
            analysisSize.width,
            analysisSize.height,
            android.graphics.ImageFormat.YUV_420_888,
            2
        ).apply {
            setOnImageAvailableListener({ imageReader ->
                val image = imageReader.acquireLatestImage()
                    ?: return@setOnImageAvailableListener
                analyze(image)
            }, cameraHandler)
        }

        val manager =
            getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            if (
                !activityResumed ||
                openGeneration != cameraOpenGeneration
            ) {
                return@addListener
            }

            val cameraId = runCatching {
                val provider = providerFuture.get()
                val cameraXIds =
                    provider.availableCameraInfos.mapNotNull { cameraInfo ->
                        runCatching {
                            Camera2CameraInfo.from(cameraInfo).cameraId
                        }.getOrNull()
                    }.toSet()
                val defaultFrontId =
                    CameraSelector.DEFAULT_FRONT_CAMERA
                        .filter(provider.availableCameraInfos)
                        .firstOrNull()
                        ?.let { Camera2CameraInfo.from(it).cameraId }

                val refreshed =
                    CameraSwitchCameraSelection.availableCameras(manager)
                        .filter { it.cameraId in cameraXIds }
                availableCameras = refreshed
                selectedCamera = CameraSwitchCameraSelection.choose(
                    cameras = refreshed,
                    preferredCameraId =
                        selectedCamera?.cameraId
                            ?: preferredCameraId
                            ?: defaultFrontId,
                    preferredLensFacing =
                        preferredLensFacing
                            ?: CameraCharacteristics.LENS_FACING_FRONT
                )
                updateCameraUi()
                selectedCamera?.cameraId
            }.getOrNull()

            if (cameraId == null) {
                cameraOpening = false
                stopCamera()
                statusView?.text = tr(
                    "Compatible camera unavailable.",
                    "找不到相容的相機。"
                )
                return@addListener
            }

            val lensFacing = selectedCamera?.lensFacing
            preferredCameraId = cameraId
            preferredLensFacing = lensFacing
            CameraSwitchPreferences.saveCameraSelection(
                this,
                cameraId,
                lensFacing
            )
            Log.i(
                CameraSetupLogTag,
                "OPTICAL_CAMERA setupId=$cameraId " +
                    "facing=${cameraFacingLogName(lensFacing)} selector=saved-or-default"
            )

            val characteristics =
                manager.getCameraCharacteristics(cameraId)
            val sensorOrientation =
                characteristics.get(
                    CameraCharacteristics.SENSOR_ORIENTATION
                ) ?: 0
            activeCameraMirrored =
                lensFacing == CameraCharacteristics.LENS_FACING_FRONT
            analysisRotationDegrees =
                CameraRotation.compensationDegrees(
                    currentSurfaceRotation(),
                    sensorOrientation,
                    frontFacing = activeCameraMirrored
                )
            updatePreviewTransform(
                textureView?.width ?: 0,
                textureView?.height ?: 0
            )
            activeArraySize =
                characteristics.get(
                    CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE
                )
            maxCameraZoomRatio =
                characteristics.get(
                    CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM
                )?.coerceAtLeast(1.0f) ?: 1.0f
            calibratedZoomRatio = calibratedZoomRatio.coerceIn(
                1.0f,
                min(maxCameraZoomRatio, MaxSavedZoomRatio)
            )
            updateZoomUi()
            val fpsRange = targetFpsRange(manager, cameraId)

            try {
                manager.openCamera(
                    cameraId,
                    object : CameraDevice.StateCallback() {
                        override fun onOpened(camera: CameraDevice) {
                            cameraOpening = false
                            if (
                                openGeneration != cameraOpenGeneration
                            ) {
                                camera.close()
                                return
                            }
                            cameraDevice = camera
                            val analysisSurface = reader?.surface
                            if (analysisSurface == null) {
                                camera.close()
                                return
                            }
                            createCameraSession(
                                camera,
                                Surface(texture),
                                analysisSurface,
                                fpsRange
                            )
                        }

                        override fun onDisconnected(
                            camera: CameraDevice
                        ) {
                            cameraOpening = false
                            camera.close()
                            cameraDevice = null
                        }

                        override fun onError(
                            camera: CameraDevice,
                            error: Int
                        ) {
                            cameraOpening = false
                            camera.close()
                            cameraDevice = null
                            statusView?.text = tr(
                                "Camera error $error",
                                "相機錯誤 $error"
                            )
                        }
                    },
                    cameraHandler
                )
            } catch (error: Exception) {
                cameraOpening = false
                stopCamera()
                statusView?.text = tr(
                    "Camera setup failed: " +
                        error.javaClass.simpleName,
                    "相機設定失敗：" +
                        error.javaClass.simpleName
                )
            }
        }, Executor { command -> runOnUiThread(command) })
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
        val detectorIntervalMs = when (selectedGesture) {
            OpticalSwitchGesture.LongBlink -> MlKitFrameIntervalMs
            OpticalSwitchGesture.CheekTwitch -> CheekFrameIntervalMs
        }
        if (mlKitInFlight || now - lastFrameAt < detectorIntervalMs) {
            image.close()
            return
        }

        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            analyzeCheek(image, now)
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
                    overlayView?.setPixelDetection(
                        face = face?.boundingBox,
                        frameWidth = imageSize.width,
                        frameHeight = imageSize.height,
                        score = score,
                        threshold = detectionParameters.closeThreshold,
                        hasSignal = score != null,
                        mirrorHorizontally = activeCameraMirrored
                    )
                    when (previewBlink) {
                        PreviewBlink.Short -> {
                            playShortCue()
                            statusView?.text = tr("Short blink detected.", "偵測到短眨眼。")
                        }
                        PreviewBlink.Long -> {
                            playLongAcceptedCue()
                            statusView?.text = tr(
                                "Long blink accepted. Current position works.",
                                "長眨眼已接受。目前位置合適。"
                            )
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

    private fun analyzeCheek(image: Image, now: Long) {
        val analyzer = cheekAnalyzer
        if (analyzer == null) {
            image.close()
            mainHandler?.post {
                metricsView?.text = tr(
                    "Cheek detector unavailable on this device.",
                    "此裝置無法使用臉頰偵測器。"
                )
            }
            return
        }

        mlKitInFlight = true
        lastFrameAt = now
        val rotationDegrees = analysisRotationDegrees
        val imageSize = orientedImageSize(image, rotationDegrees)

        try {
            val observation = analyzer.analyzeYuvForSetup(
                image,
                rotationDegrees,
                now,
                mirrorCameraOutput = activeCameraMirrored
            )
            val values = observation?.takeIf { it.usable }?.blendshapes
            val defaultScore = values?.let { cheekDetector.observe(it) }
            val score = values?.let { cheekModel?.score(it) } ?: defaultScore
            val calibrationAccepted = values?.let { processCheekCalibration(it, defaultScore) } ?: false

            var activated = calibrationAccepted
            cheekClassifier.onScore(score, now).forEach { event ->
                if (event is BinarySwitchClassifier.Event.Activated) {
                    activated = true
                    cheekPreviewActivations += 1
                }
            }

            val warmupPercent = (cheekDetector.warmupProgress * 100f).toInt()
            val threshold = cheekModel?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold

            mainHandler?.post {
                overlayView?.setNormalizedDetection(
                    face = observation?.normalizedBounds,
                    landmarks = observation?.normalizedLandmarks,
                    frameWidth = imageSize.width,
                    frameHeight = imageSize.height,
                    score = score,
                    threshold = threshold,
                    hasSignal = observation?.usable == true
                )

                if (activated) {
                    playLongAcceptedCue()
                    statusView?.text = tr(
                        "Cheek twitch accepted. Current position works.",
                        "臉頰抽動已接受。目前位置合適。"
                    )
                }

                metricsView?.text = when {
                    observation == null ->
                        tr("Face not detected", "未偵測到臉部")
                    !observation.usable ->
                        if (zhTwUi) tr("Adjust face position", "請調整臉部位置")
                        else observation.qualityMessage
                    !cheekDetector.ready ->
                        tr(
                            "Learning resting face $warmupPercent%",
                            "正在學習放鬆表情 $warmupPercent%"
                        )
                    score == null ->
                        tr("Learning resting face", "正在學習放鬆表情")
                    else ->
                        tr(
                            "Cheek ${"%.2f".format(score)} / ${"%.2f".format(threshold)} | accepted $cheekPreviewActivations",
                            "臉頰 ${"%.2f".format(score)} / ${"%.2f".format(threshold)}｜已接受 $cheekPreviewActivations"
                        )
                }
            }
        } catch (_: Exception) {
            cheekClassifier.onScore(null, now)
            mainHandler?.post {
                metricsView?.text = tr(
                    "Cheek analysis paused; keep your face centered.",
                    "臉頰分析暫停；請保持臉部置中。"
                )
            }
        } finally {
            image.close()
            mlKitInFlight = false
        }
    }

    private fun resetCheekClassifier() {
        cheekClassifier = BinarySwitchClassifier(
            BinarySwitchClassifier.Config(
                enterThreshold = cheekModel?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold,
                exitThreshold = cheekModel?.exitThreshold ?: CheekTwitchDetector.DefaultExitThreshold,
                minimumHoldMs = cheekHoldMs
            )
        )
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

    private fun changeCamera() {
        if (!activityResumed || isFinishing || isDestroyed) return
        val cameras = availableCameras
        if (cameras.isEmpty()) {
            stopCamera()
            startCamera()
            return
        }
        val currentIndex = cameras.indexOfFirst {
            it.cameraId == selectedCamera?.cameraId
        }
        val nextIndex =
            if (currentIndex < 0) 0
            else (currentIndex + 1) % cameras.size
        val next = cameras[nextIndex]
        preferredCameraId = next.cameraId
        preferredLensFacing = next.lensFacing
        selectedCamera = next
        CameraSwitchPreferences.saveCameraSelection(
            this,
            next.cameraId,
            next.lensFacing
        )
        updateCameraUi()
        statusView?.text = tr(
            "Camera changed. Center your face and test again.",
            "已切換相機。請將臉置中並重新測試。"
        )
        stopCamera()
        startCamera()
    }

    private fun updateCameraUi() {
        val camera = selectedCamera
        if (camera == null) {
            cameraView?.text = tr(
                "No camera available",
                "沒有可用相機"
            )
            changeCameraButton?.text = tr(
                "Refresh cameras",
                "重新整理相機"
            )
            return
        }
        val ordinal = availableCameras.indexOfFirst {
            it.cameraId == camera.cameraId
        }.coerceAtLeast(0) + 1
        val kind = when (camera.lensFacing) {
            CameraCharacteristics.LENS_FACING_FRONT ->
                tr("Front camera", "前置相機")
            CameraCharacteristics.LENS_FACING_BACK ->
                tr("Rear camera", "後置相機")
            CameraCharacteristics.LENS_FACING_EXTERNAL ->
                tr("USB / external camera", "USB／外接相機")
            else -> tr("Camera", "相機")
        }
        cameraView?.text = compactCameraPositionLabel(
            kind, ordinal, availableCameras.size
        )
        changeCameraButton?.text =
            if (availableCameras.size > 1) {
                tr("Next camera", "下一個相機")
            } else {
                tr("Refresh cameras", "重新整理相機")
            }
    }

    private fun cameraFacingLogName(lensFacing: Int?): String =
        when (lensFacing) {
            CameraCharacteristics.LENS_FACING_FRONT -> "front"
            CameraCharacteristics.LENS_FACING_BACK -> "rear"
            CameraCharacteristics.LENS_FACING_EXTERNAL -> "external"
            else -> "unknown"
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
        minHeight = dp(48)
        minWidth = dp(48)
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

    private fun compactControlButtonParams(button: Button) = LinearLayout.LayoutParams(
        compactControlWidthPx(
            textWidthPx = button.paint.measureText(button.text.toString()),
            horizontalPaddingPx = button.paddingLeft + button.paddingRight,
            minimumTargetPx = dp(48)
        ),
        LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply {
        setMargins(dp(4), dp(2), dp(4), dp(2))
    }

    private fun roundedBackground(color: Int, radius: Int, strokeColor: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius.toFloat()
            if (strokeColor != null) setStroke(dp(1), strokeColor)
        }

    private class FaceOverlayView(context: Context) : View(context) {
        private val boxPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(52, 211, 153)
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }
        private val landmarkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(96, 165, 250)
            style = Paint.Style.FILL
        }
        private val meterBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(180, 15, 23, 42)
            style = Paint.Style.FILL
        }
        private val meterFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(52, 211, 153)
            style = Paint.Style.FILL
        }
        private val thresholdPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }

        private var pixelFace: Rect? = null
        private var normalizedFace: NormalizedFaceBounds? = null
        private var landmarks: FloatArray? = null
        private var frameWidth = 0
        private var frameHeight = 0
        private var hasSignal = false
        private var score: Double? = null
        private var threshold = 1.0
        private var mirrorPixelFace = true

        fun clearDetection() {
            pixelFace = null
            normalizedFace = null
            landmarks = null
            score = null
            hasSignal = false
            mirrorPixelFace = true
            invalidate()
        }

        fun setPixelDetection(
            face: Rect?,
            frameWidth: Int,
            frameHeight: Int,
            score: Double?,
            threshold: Double,
            hasSignal: Boolean,
            mirrorHorizontally: Boolean
        ) {
            pixelFace = face
            normalizedFace = null
            landmarks = null
            this.frameWidth = frameWidth
            this.frameHeight = frameHeight
            this.score = score
            this.threshold = threshold
            this.hasSignal = hasSignal
            mirrorPixelFace = mirrorHorizontally
            invalidate()
        }

        fun setNormalizedDetection(
            face: NormalizedFaceBounds?,
            landmarks: FloatArray?,
            frameWidth: Int,
            frameHeight: Int,
            score: Double?,
            threshold: Double,
            hasSignal: Boolean
        ) {
            pixelFace = null
            normalizedFace = face
            this.landmarks = landmarks
            this.frameWidth = frameWidth
            this.frameHeight = frameHeight
            this.score = score
            this.threshold = threshold
            this.hasSignal = hasSignal
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            if (frameWidth <= 0 || frameHeight <= 0) return

            val scale = min(width / frameWidth.toFloat(), height / frameHeight.toFloat())
            val drawnWidth = frameWidth * scale
            val drawnHeight = frameHeight * scale
            val leftOffset = (width - drawnWidth) / 2f
            val topOffset = (height - drawnHeight) / 2f

            boxPaint.color =
                if (hasSignal) Color.rgb(52, 211, 153) else Color.rgb(245, 158, 11)

            pixelFace?.let { box ->
                val displayLeft =
                    if (mirrorPixelFace) frameWidth - box.right else box.left
                val displayRight =
                    if (mirrorPixelFace) frameWidth - box.left else box.right
                canvas.drawRect(
                    RectF(
                        leftOffset + displayLeft * scale,
                        topOffset + box.top * scale,
                        leftOffset + displayRight * scale,
                        topOffset + box.bottom * scale
                    ),
                    boxPaint
                )
            }

            normalizedFace?.let { box ->
                // Cheek detector coordinates are already upright + mirrored into preview space.
                val left = box.left * frameWidth
                val right = box.right * frameWidth
                canvas.drawRect(
                    RectF(
                        leftOffset + left * scale,
                        topOffset + box.top * frameHeight * scale,
                        leftOffset + right * scale,
                        topOffset + box.bottom * frameHeight * scale
                    ),
                    boxPaint
                )
            }

            landmarks?.let { points ->
                var index = 0
                while (index + 1 < points.size) {
                    // No second mirror: MediaPipe analysed the already-mirrored front-camera bitmap.
                    val x = points[index] * frameWidth
                    val y = points[index + 1] * frameHeight
                    canvas.drawCircle(
                        leftOffset + x * scale,
                        topOffset + y * scale,
                        2.2f,
                        landmarkPaint
                    )
                    index += 2
                }
            }

            drawStrengthMeter(canvas)
        }

        private fun drawStrengthMeter(canvas: Canvas) {
            val meterLeft = width * 0.08f
            val meterRight = width * 0.92f
            val meterBottom = height - 18f
            val meterTop = meterBottom - 20f
            val meterWidth = meterRight - meterLeft
            val maxScore = 1.0

            canvas.drawRoundRect(
                RectF(meterLeft, meterTop, meterRight, meterBottom),
                8f,
                8f,
                meterBackgroundPaint
            )

            val value = (score ?: 0.0).coerceIn(0.0, maxScore) / maxScore
            if (value > 0.0) {
                canvas.drawRoundRect(
                    RectF(
                        meterLeft,
                        meterTop,
                        meterLeft + meterWidth * value.toFloat(),
                        meterBottom
                    ),
                    8f,
                    8f,
                    meterFillPaint
                )
            }

            val thresholdX = meterLeft +
                meterWidth * (threshold.coerceIn(0.0, maxScore) / maxScore).toFloat()
            canvas.drawLine(thresholdX, meterTop - 4f, thresholdX, meterBottom + 4f, thresholdPaint)
        }
    }

    private data class CalibrationStep(val phase: Phase, val label: String, val cue: String, val durationMs: Long)
    private data class CalibrationQuality(val label: String, val detail: String)
    private enum class CheekCalibrationStage { Idle, Rest, Move }
    private enum class Phase { Idle, Instruction, Prepare, Rest, LongBlink, Complete }
    private enum class PreviewBlink { None, Short, Long }

    private companion object {
        const val CameraSetupLogTag = "ShineCameraSetup"
        const val ExtraProfileId = "org.shineaac.inputs.PROFILE_ID"
        const val CameraPermissionRequestCode = 2504
        const val PreviewBufferWidth = 640
        const val PreviewBufferHeight = 480
        const val MlKitFrameIntervalMs = 200L
        const val CheekFrameIntervalMs = 66L
        const val TargetCameraFps = 10
        const val MinCameraFps = 5
        const val MaxCameraFps = 15
        const val AfterSpeechPauseMs = 700L
        const val BeepLeadMs = 260L
        const val ShortBlinkMinMs = 80L
        const val MinLongBlinkMs = 550L
        const val MaxLongBlinkMs = 1600L
        const val MinCheekHoldMs = 100L
        const val MaxCheekHoldMs = 800L
        const val LongBlinkGuardMs = 150L
        const val ShortPreviewCueCooldownMs = 250L
        const val LongPreviewCueCooldownMs = 1500L
        const val MaxSavedZoomRatio = 4.0f

        fun clampLong(value: Long, minValue: Long, maxValue: Long): Long =
            min(maxValue, max(minValue, value))
    }
}

internal const val MaxCameraSetupFontScale = 1.2f

internal fun compactControlWidthPx(
    textWidthPx: Float,
    horizontalPaddingPx: Int,
    minimumTargetPx: Int
): Int = max(
    minimumTargetPx,
    ceil(textWidthPx).toInt() + horizontalPaddingPx
)

internal fun compactDurationLabel(action: String, durationMs: Long, unit: String): String =
    "$action $durationMs $unit"

internal fun compactZoomLabel(label: String, ratio: Float): String =
    "$label ${String.format(Locale.US, "%.1f", ratio)}×"

internal fun compactCameraPositionLabel(kind: String, ordinal: Int, total: Int): String =
    "$kind $ordinal/$total"

internal fun cameraSetupFontScale(systemFontScale: Float): Float =
    if (systemFontScale.isFinite() && systemFontScale > 0f) {
        systemFontScale.coerceAtMost(MaxCameraSetupFontScale)
    } else {
        1f
    }
