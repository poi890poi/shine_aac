package org.shineaac.inputs

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.Canvas
import android.graphics.Color
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
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

class CameraSwitchCalibrationActivity : Activity() {
    private var previewView: CalibrationPreviewView? = null
    private var cueView: CalibrationCueView? = null
    private var statusView: TextView? = null
    private var metricsView: TextView? = null
    private var holdView: TextView? = null
    private var zoomView: TextView? = null
    private var cameraView: TextView? = null
    private var startButton: Button? = null
    private var changeCameraButton: Button? = null
    private var blinkGestureButton: Button? = null
    private var cheekGestureButton: Button? = null
    private var countdownTicking = false
    @Volatile private var cameraDevice: CameraDevice? = null
    @Volatile private var cameraOpening = false
    @Volatile private var cameraOpenGeneration = 0
    @Volatile private var session: CameraCaptureSession? = null
    private var repeatingRequestBuilder: CaptureRequest.Builder? = null
    private var activeArraySize: Rect? = null
    private var maxCameraZoomRatio = MaxSavedZoomRatio
    private var analysisRotationDegrees = 0
    private var activeAnalysisSize = Size(480, 360)
    private var mirrorFaceOverlay = true
    private var sensorOrientationDegrees = 0
    private var displayedFrame: Bitmap? = null
    private var availableCameras = emptyList<CameraSwitchCamera>()
    private var selectedCamera: CameraSwitchCamera? = null
    private var preferredCameraId: String? = null
    private var preferredLensFacing: Int? = null
    private var reader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    @Volatile private var cameraHandler: Handler? = null
    private var mainHandler: Handler? = null
    private var detector: FaceDetector? = null
    private var cheekAnalyzer: CheekFaceAnalyzer? = null
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
    @Volatile private var mlKitInFlight = false
    private var lastFrameAt = 0L
    private var lastPreviewAt = 0L
    private var decodeBuffer: Bitmap? = null
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
    private var calibratedCheekHoldMs = CameraSwitchSettings.DefaultCheekHoldMs
    private var selectedGesture = OpticalSwitchGesture.LongBlink
    private var cheekModel: CheekGestureModel? = null
    private val cheekCalibrator = CheekGestureCalibrator()
    private var activeCheekTrial = 0
    private val twitchDetector = CheekTwitchDetector()
    private var collectedTwitches = 0
    private val twitchBuffer = mutableListOf<Map<String, Double>>()
    private var twitchPeak = 0.0
    private var lastCheekScore: Double? = null
    private var cheekClassifier: BinarySwitchClassifier? = null
    private var cheekTestActivations = 0
    private var cheekPreviewActivations = 0
    private var calibratedZoomRatio = 1.6f
    private var detectionParameters = BlinkDetectionParameters()
    private var savedCalibrationRecord: CameraSwitchCalibrationRecord? = null
    private var cameraPermissionRequested = false
    @Volatile private var activityResumed = false

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
        calibratedLongBlinkHoldMs = savedSettings.longBlinkMs
        calibratedCheekHoldMs = savedSettings.cheekHoldMs
        cheekModel = savedSettings.cheekModel
        calibratedZoomRatio = savedSettings.zoomRatio
        preferredCameraId = savedSettings.cameraId
        preferredLensFacing = savedSettings.cameraLensFacing
        detectionParameters = savedSettings.detectionParameters
        savedCalibrationRecord = calibrationRecordForSelectedGesture()
        setContentView(createInsetAwareContentHost(createContentView()))
        updateSavedCalibrationUi()
        initializeOptionalServices()
    }

    private fun initializeOptionalServices() {
        detector = try {
            FaceDetection.getClient(
                FaceDetectorOptions.Builder()
                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                    .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                    .enableTracking()
                    .setMinFaceSize(0.12f)
                    .build()
            )
        } catch (error: Exception) {
            Log.w(Tag, "Face detector initialization failed", error)
            statusView?.text = tr(
                "Eye detection is unavailable on this device.",
                "此裝置目前無法使用眼睛辨識。"
            )
            null
        }
        cheekAnalyzer = try {
            CheekFaceAnalyzer(this)
        } catch (error: Exception) {
            Log.w(Tag, "Cheek detector initialization failed", error)
            null
        }
        resetCheekClassifier()
        tonePlayer = try {
            CameraSwitchTonePlayer()
        } catch (error: Exception) {
            Log.w(Tag, "Calibration tone initialization failed", error)
            null
        }
        tts = try {
            TextToSpeech(this) { status ->
                if (isDestroyed) return@TextToSpeech
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    try {
                        configureTtsVoice()
                    } catch (error: Exception) {
                        Log.w(Tag, "Calibration speech configuration failed", error)
                        ttsReady = false
                        ttsVoiceLabel = tr("Voice unavailable", "語音無法使用")
                    }
                }
            }
        } catch (error: Exception) {
            Log.w(Tag, "Calibration speech initialization failed", error)
            ttsReady = false
            ttsVoiceLabel = tr("Voice unavailable", "語音無法使用")
            null
        }
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
        cancelScheduledWork()
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
        startButton?.apply {
            text = tr("Start setup", "開始設定")
            setOnClickListener { startAutoCalibration() }
        }
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
        // The status and metric lines change on almost every frame. Their height is pinned so the
        // preview pane below them never grows or shrinks as the wording changes.
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
            setTextColor(Color.rgb(159, 173, 188))
            textSize = 13f
            setPadding(0, 0, 0, dp(4))
            minLines = 2
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        holdView = compactValueLabel()
        zoomView = compactValueLabel()
        cameraView = compactValueLabel().apply {
            text = tr("Camera: finding available cameras", "相機：正在尋找可用相機")
        }

        val previewFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
            background = roundedBackground(Color.BLACK, dp(8), Color.rgb(58, 70, 82))
        }
        previewView = CalibrationPreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        cueView = CalibrationCueView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        previewFrame.addView(previewView)
        previewFrame.addView(cueView)

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

        changeCameraButton = actionButton(tr("Next camera", "下一個相機"), primary = false) {
            setOnClickListener { changeCamera() }
        }
        blinkGestureButton = actionButton(tr("Long blink", "長眨眼"), primary = false) {
            setOnClickListener { selectGesture(OpticalSwitchGesture.LongBlink) }
        }
        cheekGestureButton = actionButton(tr("Cheek twitch", "臉頰抽動"), primary = false) {
            setOnClickListener { selectGesture(OpticalSwitchGesture.CheekTwitch) }
        }

        // Four fixed-height rows, each "label + control", so the whole screen fits without scrolling.
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
        val cameraRow = controlRow(cameraView, listOf(changeCameraButton), labelWeight = 1.4f)
        val holdRow = controlRow(
            holdView,
            listOf(
                actionButton(tr("-100", "-100"), primary = false) { setOnClickListener { adjustHoldMs(-100L) } },
                actionButton(tr("+100", "+100"), primary = false) { setOnClickListener { adjustHoldMs(100L) } }
            ),
            labelWeight = 1.4f
        )
        val zoomRow = controlRow(
            zoomView,
            listOf(
                actionButton(tr("Zoom -", "縮小"), primary = false) { setOnClickListener { adjustZoomRatio(-0.2f) } },
                actionButton(tr("Zoom +", "放大"), primary = false) { setOnClickListener { adjustZoomRatio(0.2f) } }
            ),
            labelWeight = 1.4f
        )

        val previewPane = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(statusView)
            addView(metricsView)
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
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
        // At normal text sizes the rows fit and this never scrolls. It exists only so that a very
        // large system font scale pushes the controls into a scroll instead of clipping the buttons.
        val controlsArea = ScrollView(this).apply {
            isFillViewport = false
            clipToPadding = false
            addView(
                controlsColumn,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }

        if (wideLayout) {
            root.addView(previewPane, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 3f))
            root.addView(controlsArea, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 2f))
        } else {
            // The controls take exactly the height they need and the preview absorbs the rest, so
            // nothing is ever pushed off-screen and nothing has to scroll.
            root.addView(previewPane, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            root.addView(
                controlsArea,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
        updateHoldUi()
        updateZoomUi()
        updateModeUi()
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

    private fun controlRow(label: View?, buttons: List<Button?>, labelWeight: Float): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            if (label != null) {
                addView(label, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, labelWeight))
            }
            buttons.filterNotNull().forEach { addView(it, actionButtonParams(horizontal = true)) }
        }

    private fun updateGestureSelectionUi() {
        applyGestureButtonStyle(blinkGestureButton, selectedGesture == OpticalSwitchGesture.LongBlink)
        applyGestureButtonStyle(cheekGestureButton, selectedGesture == OpticalSwitchGesture.CheekTwitch)
    }

    private fun applyGestureButtonStyle(button: Button?, selected: Boolean) {
        button ?: return
        button.setTextColor(if (selected) Color.WHITE else Color.rgb(226, 234, 242))
        button.typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        button.background = roundedBackground(
            if (selected) Color.rgb(35, 122, 110) else Color.rgb(42, 52, 64),
            dp(8),
            if (selected) Color.rgb(52, 211, 153) else Color.rgb(78, 92, 108),
            strokeWidthDp = if (selected) 2 else 1
        )
    }

    private fun updateSavedCalibrationUi() {
        savedCalibrationRecord = calibrationRecordForSelectedGesture()
        val quality = savedCalibrationRecord?.qualityDetail
        if (quality != null) {
            statusView?.text = if (selectedGesture == OpticalSwitchGesture.LongBlink) tr(
                "Ready. Long blink is calibrated; use Test blink after moving the phone.", "設定完成。移動手機後，請使用「測試眨眼」確認。"
            ) else tr(
                "Ready. Your cheek movement is calibrated. Test it whenever the phone position changes.", "設定完成。已學會您的臉頰動作。手機位置改變時請再次測試。"
            )
            metricsView?.text = localizedQualityDetail(quality)
        } else {
            statusView?.text = if (selectedGesture == OpticalSwitchGesture.LongBlink) tr(
                "Center your face, then tap Start setup.", "將臉置於中央，再按「開始設定」。"
            ) else tr(
                "Center your face. Setup will move slowly and give you time to rest between six cheek movements.", "將臉置於中央。設定會慢慢進行，六次臉頰動作之間都有休息時間。"
            )
            metricsView?.text = tr("No saved setup for this gesture yet.", "此動作尚未儲存設定。")
        }
        updateHoldUi()
    }

    private fun calibrationRecordForSelectedGesture(): CameraSwitchCalibrationRecord? =
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) CameraSwitchPreferences.readCheekCalibrationRecord(this)
        else CameraSwitchPreferences.readCalibrationRecord(this)

    private fun selectGesture(gesture: OpticalSwitchGesture) {
        if (gesture == selectedGesture) return
        calibrationRunId += 1
        cancelScheduledWork()
        currentSpeechId = null
        currentSpeechDone = null
        tts?.stop()
        phase = Phase.Idle
        captureEndsAtMs = 0L
        selectedGesture = gesture
        CameraSwitchPreferences.saveGesture(this, gesture)
        resetCheekClassifier()
        updateModeUi()
        updateSavedCalibrationUi()
        if (activityResumed && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            stopCamera()
            startCamera()
        }
    }

    private fun updateModeUi() {
        updateGestureSelectionUi()
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
        cancelScheduledWork()
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
        cheekCalibrator.reset()
        activeCheekTrial = 0
        cheekTestActivations = 0
        cheekPreviewActivations = 0
        resetCheekClassifier()
        captureEndsAtMs = 0L
        activeStepLabel = ""
        startButton?.isEnabled = false
        changeCameraButton?.isEnabled = false
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            startSelfPacedCheekCalibration(calibrationRunId)
        } else {
            runStep(0, calibrationRunId)
        }
    }

    /**
     * Self-paced cheek calibration: one relaxed phase, then free movements.
     *
     * The previous flow ran six separately timed trials, each with its own countdown. That asked the
     * user to synchronise a small facial movement to a clock and gave no sign that any single
     * movement had been accepted, so there was no way to tell a missed cue from a movement the
     * detector could not see. Enrolment interfaces that work well - Face ID, Windows Hello, voice
     * training - instead collect until they have enough, show progress, and confirm each accepted
     * sample. This does the same: relax until the resting face is learned, then move whenever you
     * like, with a tone, a flash and a counter for every movement that registers.
     */
    private fun startSelfPacedCheekCalibration(runId: Int) {
        cheekCalibrator.reset()
        twitchDetector.reset()
        twitchBuffer.clear()
        twitchPeak = 0.0
        collectedTwitches = 0
        activeCheekTrial = 0
        captureEndsAtMs = 0L
        val cue = tr(
            "First relax your face and breathe normally. There is no timer; we will tell you when to move.",
            "首先請放鬆臉部並正常呼吸。沒有計時，準備好時我們會通知您。"
        )
        activeStepLabel = tr("Relax", "放鬆")
        statusView?.text = cue
        phase = Phase.Instruction
        updateCueOverlay()
        speakThen(cue) {
            if (runId != calibrationRunId) return@speakThen
            phase = Phase.CheekRest
            activeStepLabel = tr("Relax", "放鬆")
            playStartCue()
            updateCueOverlay()
        }
    }

    private fun restProgressPercent(): Int {
        val frames = min(cheekCalibrator.neutralCount(), RestFramesNeeded)
        return (frames * 100 / max(1, RestFramesNeeded)).coerceIn(0, 100)
    }

    private fun beginTwitchPhase(runId: Int) {
        if (runId != calibrationRunId) return
        phase = Phase.Instruction
        activeStepLabel = tr("Move your cheek", "做臉頰動作")
        updateCueOverlay()
        val cue = tr(
            "Good. Now make your cheek movement whenever you are ready, and relax between each one. We need $CheekTrialCount, and each one that registers will beep.",
            "很好。準備好時就做臉頰動作，每次之間放鬆。共需 $CheekTrialCount 次，每次成功都會有提示音。"
        )
        statusView?.text = cue
        speakThen(cue) {
            if (runId != calibrationRunId) return@speakThen
            phase = Phase.CheekMovement
            playStartCue()
            updateCueOverlay()
            // Nobody should be trapped in this phase. If the movements are not registering, stop and
            // say so rather than waiting silently for a sixth one that may never come.
            mainHandler?.postDelayed({
                if (runId == calibrationRunId && phase == Phase.CheekMovement) finishCheekCalibration()
            }, TwitchPhaseTimeoutMs)
        }
    }

    /**
     * Segments one free movement out of the live score.
     *
     * Frames are buffered from well below the firing threshold so the run-up is included, and the
     * movement is only accepted once it has both peaked above the threshold and lasted long enough
     * to give the calibrator something to fit.
     */
    private fun collectFreeTwitch(values: Map<String, Double>, score: Double?, runId: Int): Boolean {
        if (score == null) return false
        if (score >= cheekExitThreshold() * 0.5) {
            twitchBuffer += values
            twitchPeak = max(twitchPeak, score)
            return false
        }
        val accepted = twitchPeak >= cheekEnterThreshold() && twitchBuffer.size >= MinimumTwitchFrames
        val tooBrief = twitchPeak >= cheekEnterThreshold() && twitchBuffer.size < MinimumTwitchFrames
        if (accepted) {
            collectedTwitches += 1
            twitchBuffer.forEach { cheekCalibrator.addActive(collectedTwitches, it) }
        }
        twitchBuffer.clear()
        twitchPeak = 0.0
        if (tooBrief) {
            mainHandler?.post {
                statusView?.text = tr(
                    "That movement was very brief. Hold it for a moment longer.",
                    "那次動作太短，請多維持一下下。"
                )
            }
        }
        if (accepted && collectedTwitches >= CheekTrialCount && runId == calibrationRunId) {
            phase = Phase.Instruction
            mainHandler?.post { finishCheekCalibration() }
        }
        return accepted
    }

    private fun cheekEnterThreshold(): Double =
        cheekModel?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold

    private fun cheekExitThreshold(): Double =
        cheekModel?.exitThreshold ?: CheekTwitchDetector.DefaultExitThreshold

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
        updateCueOverlay()
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

    private fun calibrationSteps(): List<CalibrationStep> = listOf(
        CalibrationStep(Phase.Prepare, tr("Prepare", "準備"), cueSet.prepare, 0L),
        CalibrationStep(Phase.Rest, tr("Rest", "放鬆"), cueSet.rest, 8000L),
        CalibrationStep(Phase.LongBlink, tr("Slow blink trials", "慢眨眼測試"), cueSet.longBlink, 12000L)
    )

    private fun beginCapture(step: CalibrationStep) {
        phase = step.phase
        activeCheekTrial = step.trial
        activeStepLabel = step.label
        captureEndsAtMs = System.currentTimeMillis() + step.durationMs
        updateCueOverlay()
    }

    private fun endCapture() {
        phase = Phase.Instruction
        captureEndsAtMs = 0L
        updateCueOverlay()
    }

    private fun finishAutoCalibration() {
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            finishCheekCalibration()
            return
        }
        if (longBlinkClosed) {
            longBlinkDurations.add(System.currentTimeMillis() - longBlinkClosedStartedAt)
            longBlinkClosed = false
        }
        if (restClosed) {
            restClosedDurations.add(System.currentTimeMillis() - restClosedStartedAt)
            restClosed = false
        }
        phase = Phase.Complete
        captureEndsAtMs = 0L
        updateCueOverlay()
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
        changeCameraButton?.isEnabled = true
    }

    private fun calibratedLongBlinkMs(): Long {
        val measured = longBlinkDurations.filter { it in 450L..2500L }.sorted()
        if (measured.isEmpty()) return CameraSwitchSettings.DefaultLongBlinkMs
        return clampLong((measured[measured.size / 2] * 0.7).roundToLong(), 550L, 1600L)
    }

    private fun adjustHoldMs(deltaMs: Long) {
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            calibratedCheekHoldMs = clampLong(calibratedCheekHoldMs + deltaMs, MinCheekHoldMs, MaxCheekHoldMs)
            CameraSwitchPreferences.saveCheekHold(this, calibratedCheekHoldMs)
            resetCheekClassifier()
            updateHoldUi()
            statusView?.text = tr("Cheek activation hold updated.", "已更新臉頰動作維持時間。")
            return
        }
        calibratedLongBlinkHoldMs = clampLong(calibratedLongBlinkHoldMs + deltaMs, MinLongBlinkMs, MaxLongBlinkMs)
        CameraSwitchPreferences.saveTiming(this, calibratedLongBlinkHoldMs, 900L)
        updateHoldUi()
        statusView?.text = tr("Long blink hold updated.", "已更新長眨眼時間。")
        metricsView?.text = tr("Test blink to confirm the new hold time works.", "請測試眨眼，確認新設定是否合適。")
    }

    private fun updateHoldUi() {
        holdView?.text = if (selectedGesture == OpticalSwitchGesture.LongBlink) tr(
            "Long blink hold: ${calibratedLongBlinkHoldMs} ms", "長眨眼時間：${calibratedLongBlinkHoldMs} 毫秒"
        ) else tr(
            "Cheek activation hold: ${calibratedCheekHoldMs} ms", "臉頰動作維持：${calibratedCheekHoldMs} 毫秒"
        )
    }

    private fun finishCheekCalibration() {
        phase = Phase.Complete
        captureEndsAtMs = 0L
        updateCueOverlay()
        when (val outcome = cheekCalibrator.build()) {
            is CheekCalibrationOutcome.Success -> {
                cheekModel = outcome.model
                val quality = outcome.model.quality
                val label = tr("Quality good", "品質良好")
                val detail = tr(
                    "${quality.message} ${quality.activeTrialCount} trials, ${quality.neutralFrameCount} relaxed frames. Learned ${outcome.model.summary()}.",
                    "校正品質良好。偵測到 ${quality.activeTrialCount} 次動作及 ${quality.neutralFrameCount} 個放鬆畫面。"
                )
                CameraSwitchPreferences.saveCheekCalibration(
                    this, outcome.model, calibratedCheekHoldMs, calibratedZoomRatio, label, detail
                )
                savedCalibrationRecord = CameraSwitchPreferences.readCheekCalibrationRecord(this)
                resetCheekClassifier()
                val message = tr(
                    "Setup complete. Take a rest. Your cheek movement is ready when you want to test it.",
                    "設定完成。請先休息。準備好時再測試臉頰動作。"
                )
                statusView?.text = message
                metricsView?.text = detail
                speakThen(message) {}
            }
            is CheekCalibrationOutcome.Failure -> {
                val retained = cheekModel != null
                val message = if (retained) tr(
                    "This attempt was not clear enough, so your previous cheek setup was kept. Rest and retry whenever you are ready.",
                    "這次動作不夠清楚，因此已保留先前的臉頰設定。休息後準備好再試即可。"
                ) else tr(
                    "This attempt was not clear enough. Nothing was saved. Please rest, improve the lighting, and retry when ready.",
                    "這次動作不夠清楚，未儲存設定。請先休息、改善光線，準備好再試。"
                )
                statusView?.text = message
                metricsView?.text = outcome.reason
                speakThen(message) {}
            }
        }
        startButton?.isEnabled = true
        changeCameraButton?.isEnabled = true
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

    /**
     * Rebuilds the switch classifier, falling back to the uncalibrated thresholds.
     *
     * With no saved model the cheek switch used to do nothing at all, so there was no way to try the
     * gesture before committing to a setup run. It now works out of the box and calibration tightens
     * it, which is how the long blink gesture has always behaved.
     */
    private fun resetCheekClassifier() {
        val model = cheekModel
        cheekClassifier = BinarySwitchClassifier(
            BinarySwitchClassifier.Config(
                enterThreshold = model?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold,
                exitThreshold = model?.exitThreshold ?: CheekTwitchDetector.DefaultExitThreshold,
                minimumHoldMs = calibratedCheekHoldMs
            )
        )
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
        val result = try {
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, Bundle.EMPTY, utteranceId)
        } catch (error: Exception) {
            Log.w(Tag, "Calibration speech failed", error)
            TextToSpeech.ERROR
        }
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
        if (!activityResumed || isFinishing || isDestroyed) return
        if (cameraDevice != null || cameraOpening || checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return
        val openGeneration = ++cameraOpenGeneration
        cameraOpening = true
        try {
            val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraChoice = refreshCameraSelection(manager) ?: run {
                cameraOpening = false
                statusView?.text = tr("No compatible camera is available.", "找不到相容的相機。")
                return
            }
            val cameraId = cameraChoice.cameraId
            val characteristics = manager.getCameraCharacteristics(cameraId)
            val lensFacing = characteristics.get(CameraCharacteristics.LENS_FACING)
            mirrorFaceOverlay = lensFacing == CameraCharacteristics.LENS_FACING_FRONT
            sensorOrientationDegrees = characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 0
            val sensorOrientation = sensorOrientationDegrees
            analysisRotationDegrees = CameraRotation.compensationDegrees(
                currentSurfaceRotation(),
                sensorOrientation,
                frontFacing = mirrorFaceOverlay
            )
            val streamMap = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                ?: error("Camera has no output stream configuration")
            activeAnalysisSize = chooseOutputSize(
                streamMap.getOutputSizes(android.graphics.ImageFormat.YUV_420_888),
                targetWidth = AnalysisTargetWidth,
                targetHeight = AnalysisTargetHeight
            )
            activeArraySize = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
            maxCameraZoomRatio = characteristics
                .get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM)
                ?.coerceAtLeast(1.0f)
                ?: 1.0f
            calibratedZoomRatio = calibratedZoomRatio.coerceIn(1.0f, min(maxCameraZoomRatio, MaxSavedZoomRatio))
            updateZoomUi()
            val fpsRange = targetFpsRange(manager, cameraId)

            val thread = HandlerThread("ShineCameraCalibration").also { it.start() }
            cameraThread = thread
            val handler = Handler(thread.looper)
            cameraHandler = handler
            val activeReader = ImageReader.newInstance(
                activeAnalysisSize.width,
                activeAnalysisSize.height,
                android.graphics.ImageFormat.YUV_420_888,
                2
            )
            reader = activeReader
            activeReader.setOnImageAvailableListener({ imageReader ->
                val image = try {
                    imageReader.acquireLatestImage()
                } catch (error: IllegalStateException) {
                    Log.w(Tag, "Image arrived after calibration reader closed", error)
                    null
                } ?: return@setOnImageAvailableListener
                if (!isCameraGenerationActive(openGeneration)) {
                    image.close()
                    return@setOnImageAvailableListener
                }
                analyze(image, openGeneration)
            }, handler)

            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    if (openGeneration == cameraOpenGeneration) cameraOpening = false
                    if (!isCameraGenerationActive(openGeneration)) {
                        camera.close()
                        return
                    }
                    cameraDevice = camera
                    createCameraSession(
                        camera = camera,
                        imageSurface = activeReader.surface,
                        fpsRange = fpsRange,
                        openGeneration = openGeneration
                    )
                }

                override fun onDisconnected(camera: CameraDevice) {
                    if (openGeneration == cameraOpenGeneration) cameraOpening = false
                    camera.close()
                    if (cameraDevice === camera) cameraDevice = null
                    handleCameraFailure(openGeneration, "Camera disconnected")
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    if (openGeneration == cameraOpenGeneration) cameraOpening = false
                    camera.close()
                    if (cameraDevice === camera) cameraDevice = null
                    handleCameraFailure(openGeneration, "Camera error $error")
                }
            }, handler)
        } catch (error: Exception) {
            Log.w(Tag, "Camera setup failed", error)
            if (openGeneration == cameraOpenGeneration) stopCamera()
            statusView?.text = tr(
                "Camera setup failed: ${error.javaClass.simpleName}",
                "相機設定失敗：${error.javaClass.simpleName}"
            )
        }
    }

    private fun createCameraSession(
        camera: CameraDevice,
        imageSurface: Surface,
        fpsRange: Range<Int>?,
        openGeneration: Int
    ) {
        try {
            if (!isCameraGenerationActive(openGeneration)) {
                camera.close()
                return
            }
            if (!imageSurface.isValid) {
                camera.close()
                if (cameraDevice === camera) cameraDevice = null
                handleCameraFailure(openGeneration, "Camera surface became invalid")
                return
            }
            val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                addTarget(imageSurface)
                set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
                if (fpsRange != null) {
                    set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange)
                }
                set(CaptureRequest.SCALER_CROP_REGION, zoomCropRegion())
            }
            repeatingRequestBuilder = request
            camera.createCaptureSession(listOf(imageSurface), object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(captureSession: CameraCaptureSession) {
                    if (!isCameraGenerationActive(openGeneration) || cameraDevice !== camera) {
                        captureSession.close()
                        return
                    }
                    try {
                        session = captureSession
                        captureSession.setRepeatingRequest(request.build(), null, cameraHandler)
                    } catch (error: Exception) {
                        captureSession.close()
                        if (session === captureSession) session = null
                        handleCameraFailure(openGeneration, "Starting camera preview failed", error)
                    }
                }

                override fun onConfigureFailed(captureSession: CameraCaptureSession) {
                    captureSession.close()
                    handleCameraFailure(openGeneration, "Camera session configuration failed")
                }
            }, cameraHandler)
        } catch (error: Exception) {
            handleCameraFailure(openGeneration, "Creating camera session failed", error)
        }
    }

    private fun isCameraGenerationActive(openGeneration: Int): Boolean =
        openGeneration == cameraOpenGeneration && activityResumed && !isFinishing && !isDestroyed

    private fun handleCameraFailure(openGeneration: Int, message: String, error: Exception? = null) {
        if (error == null) Log.w(Tag, message) else Log.w(Tag, message, error)
        runOnUiThread {
            if (openGeneration != cameraOpenGeneration) return@runOnUiThread
            stopCamera()
            if (!isFinishing && !isDestroyed) {
                statusView?.text = tr("Camera setup failed.", "相機設定失敗。")
            }
        }
    }

    private fun stopCamera() {
        cameraOpenGeneration += 1
        cameraOpening = false
        cameraHandler?.removeCallbacksAndMessages(null)
        repeatingRequestBuilder = null
        runCatching { session?.close() }
        session = null
        runCatching { cameraDevice?.close() }
        cameraDevice = null
        runCatching { reader?.close() }
        reader = null
        cameraThread?.quitSafely()
        cameraThread = null
        cameraHandler = null
        mlKitInFlight = false
        releaseDisplayedFrame()
    }

    private fun applyZoomToRepeatingRequest() {
        val builder = repeatingRequestBuilder ?: return
        val captureSession = session ?: return
        val handler = cameraHandler ?: return
        try {
            builder.set(CaptureRequest.SCALER_CROP_REGION, zoomCropRegion())
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
        val target = if (selectedGesture == OpticalSwitchGesture.CheekTwitch) CheekTargetCameraFps else BlinkTargetCameraFps
        val maxFps = if (selectedGesture == OpticalSwitchGesture.CheekTwitch) CheekMaxCameraFps else BlinkMaxCameraFps
        return ranges
            .filter { it.upper <= maxFps && it.upper >= MinCameraFps }
            .minWithOrNull(compareBy<Range<Int>> { kotlin.math.abs(it.upper - target) }.thenBy { it.lower })
            ?: ranges.minWithOrNull(compareBy<Range<Int>> { it.upper }.thenBy { it.lower })
    }

    /**
     * Decides what to do with one camera frame.
     *
     * Preview and detection are paced separately on purpose. Detection is expensive - a recorded
     * session measured a 127 ms median - and driving the preview from it left the picture updating
     * five to eight times a second, which reads as constant flicker. Frames are now shown at their
     * own rate and only some of them are also analysed, so the preview stays smooth while detection
     * runs as fast as it can.
     */
    private fun analyze(image: Image, analysisGeneration: Int) {
        val now = System.currentTimeMillis()
        val frameInterval = if (selectedGesture == OpticalSwitchGesture.CheekTwitch) CheekFrameIntervalMs else MlKitFrameIntervalMs
        if (!isCameraGenerationActive(analysisGeneration)) {
            image.close()
            return
        }
        val wantDetection = !mlKitInFlight && now - lastFrameAt >= frameInterval
        val wantPreview = now - lastPreviewAt >= PreviewIntervalMs
        if (!wantDetection && !wantPreview) {
            image.close()
            return
        }
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            analyzeCheek(image, analysisGeneration, now, wantDetection, wantPreview)
            return
        }
        val activeDetector = detector
        val rotationDegrees = analysisRotationDegrees
        // Decode once, turn upright and mirror, then both show and analyse those same pixels.
        val frameBitmap = try {
            orientFrame(decodeInto(image), rotationDegrees, mirrorFaceOverlay)
        } catch (error: Exception) {
            Log.w(Tag, "Decoding calibration frame failed", error)
            image.close()
            return
        }
        if (wantPreview) {
            lastPreviewAt = now
            publishPreviewFrame(frameBitmap, analysisGeneration)
        }
        if (!wantDetection || activeDetector == null) {
            image.close()
            return
        }
        mlKitInFlight = true
        lastFrameAt = now
        val imageSize = Size(frameBitmap.width, frameBitmap.height)
        val task = try {
            activeDetector.process(InputImage.fromBitmap(frameBitmap, 0))
        } catch (error: Exception) {
            Log.w(Tag, "Submitting calibration frame failed", error)
            image.close()
            if (analysisGeneration == cameraOpenGeneration) mlKitInFlight = false
            return
        }
        task
            .addOnSuccessListener { faces ->
                if (!isCameraGenerationActive(analysisGeneration)) return@addOnSuccessListener
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val signal = face?.blinkEyeSignal(detectionParameters)
                val score = signal?.closedScore
                if (signal != null) collectCalibrationSample(signal, now)
                val previewBlink = signal?.let { collectPreviewBlinkDuration(it) } ?: PreviewBlink.None
                mainHandler?.post {
                    if (!isCameraGenerationActive(analysisGeneration)) return@post
                    previewView?.setDetection(
                        face?.boundingBox?.let { normalizedRect(it, imageSize) },
                        null,
                        score != null
                    )
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
            .addOnFailureListener { error ->
                Log.w(Tag, "Calibration frame analysis failed", error)
                mainHandler?.post {
                    if (!isCameraGenerationActive(analysisGeneration)) return@post
                    metricsView?.text = tr(
                        "ML Kit model unavailable or still downloading.",
                        "辨識模型尚未提供，或仍在下載。"
                    )
                }
            }
            .addOnCompleteListener {
                runCatching { image.close() }
                if (analysisGeneration == cameraOpenGeneration) mlKitInFlight = false
            }
    }

    private fun analyzeCheek(
        image: Image,
        analysisGeneration: Int,
        now: Long,
        wantDetection: Boolean,
        wantPreview: Boolean
    ) {
        val analyzer = cheekAnalyzer
        if (analyzer == null) {
            image.close()
            mainHandler?.post { metricsView?.text = tr("Cheek detection is unavailable on this device.", "此裝置無法使用臉頰偵測。") }
            return
        }
        val runDetection = wantDetection
        if (runDetection) {
            mlKitInFlight = true
            lastFrameAt = now
        }
        try {
            val rotationDegrees = analysisRotationDegrees
            val frameBitmap = orientFrame(decodeInto(image), rotationDegrees, mirrorFaceOverlay)
            if (wantPreview) {
                lastPreviewAt = now
                publishPreviewFrame(frameBitmap, analysisGeneration)
            }
            if (!runDetection) return
            val observation = analyzer.analyzeBitmap(frameBitmap, 0, now)
            if (!isCameraGenerationActive(analysisGeneration)) return
            val values = observation?.takeIf { it.usable }?.blendshapes
            // The detector is fed once per usable frame so its resting baseline stays current, and it
            // supplies the score whenever no calibrated model exists yet.
            val detectorScore = values?.let { twitchDetector.observe(it) }
            val score = values?.let { cheekModel?.score(it) } ?: detectorScore
            lastCheekScore = score
            var accepted = false
            if (values != null) {
                when (phase) {
                    Phase.CheekRest -> {
                        cheekCalibrator.addNeutral(values)
                        if (cheekCalibrator.neutralCount() >= RestFramesNeeded && twitchDetector.ready) {
                            val runId = calibrationRunId
                            phase = Phase.Instruction
                            mainHandler?.post { beginTwitchPhase(runId) }
                        }
                    }
                    Phase.CheekMovement -> accepted = collectFreeTwitch(values, score, calibrationRunId)
                    else -> Unit
                }
            }
            val activation = accepted || processCheekScore(score, now)
            // MediaPipe already reports normalized coordinates in the rotated frame.
            val box = observation?.normalizedBounds?.let { RectF(it.left, it.top, it.right, it.bottom) }
            val landmarks = observation?.normalizedLandmarks
            mainHandler?.post {
                if (!isCameraGenerationActive(analysisGeneration)) return@post
                previewView?.setDetection(box, landmarks, observation?.usable == true)
                previewView?.setMeter(
                    score,
                    cheekEnterThreshold(),
                    activation || (score ?: 0.0) >= cheekEnterThreshold(),
                    cheekMeterLabel(score)
                )
                if (phase == Phase.CheekRest || phase == Phase.CheekMovement) updateCueOverlay()
                if (activation) {
                    playLongAcceptedCue()
                    statusView?.text = if (phase == Phase.CheekMovement) tr(
                        "Movement $collectedTwitches of $CheekTrialCount recorded.",
                        "已記錄第 $collectedTwitches 次，共 $CheekTrialCount 次。"
                    ) else tr("Cheek movement accepted.", "已接受臉頰動作。")
                }
                updateCheekMetrics(score, observation?.qualityMessage)
            }
        } catch (error: Exception) {
            Log.w(Tag, "Cheek calibration frame analysis failed", error)
            mainHandler?.post { metricsView?.text = tr("Cheek analysis paused; keep your face centered.", "臉頰分析暫停；請保持臉部置中。") }
        } finally {
            runCatching { image.close() }
            if (runDetection && analysisGeneration == cameraOpenGeneration) mlKitInFlight = false
        }
    }

    private fun cheekMeterLabel(score: Double?): String = when {
        score == null && !twitchDetector.ready -> tr("Learning your resting face", "正在學習您的放鬆表情")
        score == null -> tr("Face not detected", "未偵測到臉部")
        phase == Phase.CheekMovement -> tr(
            "Movement $collectedTwitches of $CheekTrialCount",
            "第 $collectedTwitches 次，共 $CheekTrialCount 次"
        )
        cheekModel == null -> tr("Uncalibrated - set up to improve", "未校正，設定後更準確")
        else -> tr("Move cheek to pass the line", "臉頰動作超過白線即可")
    }

    private fun processCheekScore(score: Double?, now: Long): Boolean {
        if (!shouldPreviewMonitor()) return false
        val classifier = cheekClassifier ?: return false
        var activated = false
        classifier.onScore(score, now).forEach { event ->
            if (event is BinarySwitchClassifier.Event.Activated) {
                activated = true
                cheekPreviewActivations += 1
            }
        }
        return activated
    }

    private fun updateCheekMetrics(score: Double?, qualityMessage: String?) {
        if (shouldPreviewMonitor()) {
            metricsView?.text = when {
                qualityMessage != null && score == null -> qualityMessage
                score == null && cheekModel == null -> tr("Face tracked; cheek setup is not saved yet.", "已追蹤臉部；尚未儲存臉頰設定。")
                score == null -> tr("Face not detected", "未偵測到臉部")
                else -> tr("Cheek ${"%.2f".format(score)} | accepted $cheekPreviewActivations", "臉頰 ${"%.2f".format(score)}｜接受 $cheekPreviewActivations 次")
            }
            return
        }
        if (phase != Phase.Complete) {
            val remaining = max(0L, captureEndsAtMs - System.currentTimeMillis())
            metricsView?.text = when {
                qualityMessage != null && score == null -> qualityMessage
                captureEndsAtMs > 0L -> tr(
                    "$activeStepLabel ${((remaining + 999L) / 1000L)}s left | relaxed ${cheekCalibrator.neutralCount()} | movements ${cheekCalibrator.activeTrialCount()}",
                    "$activeStepLabel 剩下 ${((remaining + 999L) / 1000L)} 秒｜放鬆 ${cheekCalibrator.neutralCount()}｜動作 ${cheekCalibrator.activeTrialCount()}"
                )
                else -> ttsVoiceLabel
            }
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

    /**
     * Every cue is emitted through here so the tone and the on-screen signal are always issued
     * together. A helper watching the screen and a user listening for the tone get the same
     * information at the same moment.
     */
    private fun playStartCue() {
        tonePlayer?.playStart()
        cueView?.flash(CalibrationCueView.Tone.Go)
    }

    private fun playShortCue() {
        tonePlayer?.playSetupShortBlink()
        cueView?.flash(CalibrationCueView.Tone.Neutral)
    }

    private fun playHoldReachedCue() {
        tonePlayer?.playHoldReached()
        cueView?.flash(CalibrationCueView.Tone.Hold)
    }

    private fun playLongAcceptedCue() {
        tonePlayer?.playLongAccepted()
        cueView?.flash(CalibrationCueView.Tone.Accepted)
    }

    /** Redraws the headline and countdown, and keeps ticking while a timed step is running. */
    private fun updateCueOverlay() {
        val overlay = cueView ?: return
        val remainingMs = if (captureEndsAtMs > 0L) max(0L, captureEndsAtMs - System.currentTimeMillis()) else 0L
        val capturing = captureEndsAtMs > 0L
        when {
            phase == Phase.CheekRest -> overlay.show(
                tr("Relax your face", "請放鬆臉部"),
                "" + (restProgressPercent()) + "%",
                CalibrationCueView.Tone.Hold
            )
            phase == Phase.CheekMovement -> overlay.show(
                tr("Move your cheek", "做臉頰動作"),
                collectedTwitches.toString() + " / " + CheekTrialCount,
                if (collectedTwitches > 0) CalibrationCueView.Tone.Go else CalibrationCueView.Tone.Hold
            )
            capturing -> overlay.show(
                activeStepLabel.ifEmpty { tr("Recording", "記錄中") },
                ((remainingMs + 999L) / 1000L).toString(),
                CalibrationCueView.Tone.Go
            )
            phase == Phase.Instruction -> overlay.show(
                activeStepLabel.ifEmpty { tr("Get ready", "請準備") },
                null,
                CalibrationCueView.Tone.Hold
            )
            else -> overlay.clear()
        }
        if (capturing && !countdownTicking) {
            countdownTicking = true
            scheduleCueTick()
        }
    }

    /** Cancels queued speech follow-ups and cue ticks together, so no tick is left orphaned. */
    private fun cancelScheduledWork() {
        mainHandler?.removeCallbacksAndMessages(null)
        countdownTicking = false
    }

    private fun scheduleCueTick() {
        mainHandler?.postDelayed({
            countdownTicking = false
            if (isFinishing || isDestroyed) return@postDelayed
            updateCueOverlay()
        }, CueTickMs)
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

    /**
     * Hands the decoded frame to the preview.
     *
     * The replaced bitmap is deliberately not recycled. Handing a bitmap to a View and freeing it on
     * the next frame is a use-after-free in disguise: the renderer still reads the previous display
     * list after onDraw returns, so recycling there drops frames and the preview flickers. The same
     * applies to the blink path, where ML Kit is still holding the frame asynchronously. Letting the
     * collector take them costs a little churn and is correct.
     */
    /**
     * Turns a sensor-oriented frame upright and mirrors it for a front camera.
     *
     * Baking the orientation in before detection is what the cheek-switch proof of concept does, and
     * it is why its mesh sits exactly on the face: the detector's normalized coordinates then refer
     * to the same pixels that get drawn, so nothing downstream has to agree about conventions.
     */
    /** Decodes into the reusable buffer, keeping it for next time. */
    private fun decodeInto(image: Image): Bitmap {
        val decoded = YuvBitmaps.toBitmap(image, decodeBuffer)
        decodeBuffer = decoded
        return decoded
    }

    private fun orientFrame(bitmap: Bitmap, rotationDegrees: Int, mirror: Boolean): Bitmap {
        // Copy even when no turn is needed: the source is the reusable decode buffer.
        if (rotationDegrees % 360 == 0 && !mirror) return bitmap.copy(Bitmap.Config.ARGB_8888, false)
        val transform = Matrix().apply {
            postRotate(rotationDegrees.toFloat())
            if (mirror) postScale(-1f, 1f)
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, transform, true)
    }

    private fun publishPreviewFrame(bitmap: Bitmap, analysisGeneration: Int) {
        mainHandler?.post {
            if (!isCameraGenerationActive(analysisGeneration)) {
                bitmap.recycle()
                return@post
            }
            displayedFrame = bitmap
            previewView?.setFrame(bitmap)
        } ?: bitmap.recycle()
    }

    private fun releaseDisplayedFrame() {
        previewView?.clear()
        displayedFrame = null
        decodeBuffer = null
    }

    private fun orientedImageSize(image: Image, rotation: Int): Size =
        if (rotation == 90 || rotation == 270) Size(image.height, image.width) else Size(image.width, image.height)

    private fun normalizedRect(box: Rect, imageSize: Size): RectF? {
        if (imageSize.width <= 0 || imageSize.height <= 0) return null
        return RectF(
            box.left.toFloat() / imageSize.width,
            box.top.toFloat() / imageSize.height,
            box.right.toFloat() / imageSize.width,
            box.bottom.toFloat() / imageSize.height
        )
    }

    private fun currentSurfaceRotation(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display?.rotation ?: Surface.ROTATION_0
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.rotation
        }

    private fun chooseOutputSize(
        sizes: Array<Size>?,
        targetWidth: Int,
        targetHeight: Int,
        preferredAspect: Double = targetWidth.toDouble() / targetHeight
    ): Size {
        require(!sizes.isNullOrEmpty()) { "Camera has no compatible output size" }
        val targetArea = targetWidth.toDouble() * targetHeight
        return sizes.minByOrNull { size ->
            val aspect = size.width.toDouble() / size.height
            val area = size.width.toDouble() * size.height
            abs(aspect - preferredAspect) * AspectRatioWeight + abs(area - targetArea) / targetArea
        } ?: error("Camera has no compatible output size")
    }

    private fun changeCamera() {
        if (!activityResumed || isFinishing || isDestroyed) return
        val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val refreshed = runCatching {
            CameraSwitchCameraSelection.availableCameras(manager)
        }.getOrElse {
            Log.w(Tag, "Refreshing camera list failed", it)
            emptyList()
        }
        if (refreshed.isEmpty()) {
            availableCameras = emptyList()
            selectedCamera = null
            updateCameraUi()
            statusView?.text = tr("No compatible camera is available.", "找不到相容的相機。")
            stopCamera()
            return
        }

        val currentIndex = refreshed.indexOfFirst { it.cameraId == selectedCamera?.cameraId }
        val nextIndex = if (currentIndex < 0) 0 else (currentIndex + 1) % refreshed.size
        val next = refreshed[nextIndex]
        stopCamera()
        availableCameras = refreshed
        selectedCamera = next
        preferredCameraId = next.cameraId
        preferredLensFacing = next.lensFacing
        CameraSwitchPreferences.saveCameraSelection(this, next.cameraId, next.lensFacing)
        updateCameraUi()
        statusView?.text = tr(
            "Camera changed. Center the face and run setup again.",
            "已切換相機。請將臉置中並重新開始設定。"
        )
        startCamera()
    }

    private fun refreshCameraSelection(manager: CameraManager): CameraSwitchCamera? {
        val refreshed = runCatching {
            CameraSwitchCameraSelection.availableCameras(manager)
        }.getOrElse {
            Log.w(Tag, "Listing cameras failed", it)
            emptyList()
        }
        availableCameras = refreshed
        val currentId = selectedCamera?.cameraId?.takeIf { id -> refreshed.any { it.cameraId == id } }
        selectedCamera = CameraSwitchCameraSelection.choose(
            cameras = refreshed,
            preferredCameraId = currentId ?: preferredCameraId,
            preferredLensFacing = preferredLensFacing
        )
        updateCameraUi()
        return selectedCamera
    }

    private fun updateCameraUi() {
        val camera = selectedCamera
        if (camera == null) {
            cameraView?.text = tr("Camera: none available", "相機：沒有可用相機")
            changeCameraButton?.text = tr("Refresh cameras", "重新整理相機")
            return
        }
        val sameFacing = availableCameras.filter { it.lensFacing == camera.lensFacing }
        val ordinal = sameFacing.indexOfFirst { it.cameraId == camera.cameraId }.coerceAtLeast(0) + 1
        val kind = when (camera.lensFacing) {
            CameraCharacteristics.LENS_FACING_FRONT -> tr("Front camera", "前置相機")
            CameraCharacteristics.LENS_FACING_BACK -> tr("Rear camera", "後置相機")
            CameraCharacteristics.LENS_FACING_EXTERNAL -> tr("USB / external camera", "USB／外接相機")
            else -> tr("Camera", "相機")
        }
        val suffix = if (sameFacing.size > 1) " $ordinal" else ""
        cameraView?.text = tr(
            "Camera: $kind$suffix (${availableCameras.size} available)",
            "相機：$kind$suffix（共 ${availableCameras.size} 個）"
        )
        changeCameraButton?.text = if (availableCameras.size > 1) {
            tr("Next camera", "下一個相機")
        } else {
            tr("Refresh cameras", "重新整理相機")
        }
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

    private fun roundedBackground(
        color: Int,
        radius: Int,
        strokeColor: Int? = null,
        strokeWidthDp: Int = 1
    ): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius.toFloat()
            if (strokeColor != null) setStroke(dp(strokeWidthDp), strokeColor)
        }

    /**
     * The visible half of every calibration cue.
     *
     * Spoken instructions and tones are useless to a user who cannot hear them, and a tone is easy
     * to miss in a noisy room, so each cue is also drawn over the preview: a coloured border, a
     * headline, and the seconds left in the current step.
     */
    private class CalibrationCueView(context: Context) : View(context) {
        enum class Tone { Neutral, Go, Hold, Accepted }

        private val density = resources.displayMetrics.density
        private val headlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
            textSize = 17f * density
        }
        private val countdownPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
            textSize = 52f * density
        }
        private val backdropPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }

        private var headline = ""
        private var caption: String? = null
        private var tone = Tone.Neutral
        private var flashUntilMs = 0L

        /** [nextCaption] is the large centred text: a countdown, a progress count, or nothing. */
        fun show(nextHeadline: String, nextCaption: String?, nextTone: Tone) {
            headline = nextHeadline
            caption = nextCaption
            tone = nextTone
            invalidate()
        }

        fun flash(nextTone: Tone) {
            tone = nextTone
            flashUntilMs = System.currentTimeMillis() + FlashMs
            invalidate()
        }

        fun clear() {
            headline = ""
            caption = null
            tone = Tone.Neutral
            flashUntilMs = 0L
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val flashing = System.currentTimeMillis() < flashUntilMs
            val accent = accentColor(tone)
            if (headline.isEmpty() && caption == null && !flashing) return

            if (flashing) {
                backdropPaint.color = withAlpha(accent, 70)
                canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backdropPaint)
            }
            if (tone != Tone.Neutral || flashing) {
                borderPaint.color = accent
                borderPaint.strokeWidth = (if (flashing) 8f else 4f) * density
                val inset = borderPaint.strokeWidth / 2f
                canvas.drawRect(inset, inset, width - inset, height - inset, borderPaint)
            }
            if (headline.isNotEmpty()) {
                val bandHeight = 40f * density
                backdropPaint.color = withAlpha(Color.BLACK, 150)
                canvas.drawRect(0f, 0f, width.toFloat(), bandHeight, backdropPaint)
                headlinePaint.color = accent
                canvas.drawText(
                    ellipsized(headline, width - 16f * density),
                    width / 2f,
                    bandHeight * 0.66f,
                    headlinePaint
                )
            }
            caption?.let { text ->
                countdownPaint.textSize = 52f * density
                val maxWidth = width - 32f * density
                if (countdownPaint.measureText(text) > maxWidth && maxWidth > 0f) {
                    countdownPaint.textSize *= maxWidth / countdownPaint.measureText(text)
                }
                val centerY = height / 2f - (countdownPaint.descent() + countdownPaint.ascent()) / 2f
                countdownPaint.color = withAlpha(Color.BLACK, 170)
                canvas.drawText(text, width / 2f + 2f * density, centerY + 2f * density, countdownPaint)
                countdownPaint.color = accent
                canvas.drawText(text, width / 2f, centerY, countdownPaint)
            }
            if (flashing) postInvalidateOnAnimation()
        }

        private fun ellipsized(text: String, maxWidth: Float): String {
            if (headlinePaint.measureText(text) <= maxWidth) return text
            var end = text.length
            while (end > 1 && headlinePaint.measureText(text.substring(0, end) + "…") > maxWidth) end -= 1
            return text.substring(0, end) + "…"
        }

        private fun accentColor(value: Tone): Int = when (value) {
            Tone.Neutral -> Color.rgb(203, 213, 225)
            Tone.Go -> Color.rgb(52, 211, 153)
            Tone.Hold -> Color.rgb(245, 158, 11)
            Tone.Accepted -> Color.rgb(125, 211, 252)
        }

        private fun withAlpha(color: Int, alpha: Int): Int =
            Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))

        private companion object {
            const val FlashMs = 600L
        }
    }

    private data class CalibrationStep(
        val phase: Phase,
        val label: String,
        val cue: String,
        val durationMs: Long,
        val trial: Int = 0
    )
    private data class CalibrationQuality(val label: String, val detail: String)
    private enum class Phase { Idle, Instruction, Prepare, Rest, LongBlink, CheekRest, CheekMovement, Complete }
    private enum class PreviewBlink { None, Short, Long }

    private companion object {
        const val ExtraProfileId = "org.shineaac.inputs.PROFILE_ID"
        const val CameraPermissionRequestCode = 2504
        const val AnalysisTargetWidth = 640
        const val AnalysisTargetHeight = 480
        const val AspectRatioWeight = 4.0
        const val MlKitFrameIntervalMs = 200L
        const val CheekFrameIntervalMs = 45L
        const val BlinkTargetCameraFps = 20
        const val CheekTargetCameraFps = 24
        const val MinCameraFps = 5
        const val BlinkMaxCameraFps = 30
        const val CheekMaxCameraFps = 30
        const val AfterSpeechPauseMs = 700L
        const val BeepLeadMs = 260L
        const val CueTickMs = 200L
        const val PreviewIntervalMs = 66L
        const val CheekTrialCount = 6
        const val RestFramesNeeded = 45
        const val MinimumTwitchFrames = 3
        const val TwitchPhaseTimeoutMs = 90000L
        const val ShortBlinkMinMs = 80L
        const val MinLongBlinkMs = 550L
        const val MaxLongBlinkMs = 1600L
        const val MinCheekHoldMs = 100L
        const val MaxCheekHoldMs = 800L
        const val LongBlinkGuardMs = 150L
        const val ShortPreviewCueCooldownMs = 250L
        const val LongPreviewCueCooldownMs = 1500L
        const val MaxSavedZoomRatio = 4.0f
        const val Tag = "ShineCameraCalibration"

        fun clampLong(value: Long, minValue: Long, maxValue: Long): Long =
            min(maxValue, max(minValue, value))
    }
}
