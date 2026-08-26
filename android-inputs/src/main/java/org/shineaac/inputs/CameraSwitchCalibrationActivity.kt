package org.shineaac.inputs

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.hardware.usb.UsbDevice
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
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.button.MaterialButtonToggleGroup
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textview.MaterialTextView
import java.util.concurrent.Executor
import com.jiangdg.usb.USBMonitor
import com.jiangdg.uvc.IFrameCallback
import com.jiangdg.uvc.UVCCamera
import java.nio.ByteBuffer
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

internal fun cheekCalibrationMoveInstruction(zhTw: Boolean): String =
    if (zhTw) {
        "設定：請自然動一下臉頰後放鬆。系統會自動找出動作樣本，不需要先成功觸發。"
    } else {
        "Setup: move your cheek naturally, then relax. Samples are found automatically; the action does not need to activate first."
    }

internal fun calibrationStepPendingText(stepLabel: String, zhTw: Boolean): String =
    if (zhTw) "開始提示音後進行$stepLabel" else "$stepLabel starts after the start tone"

internal fun calibrationFaceMissingText(zhTw: Boolean): String =
    if (zhTw) "未偵測到臉部" else "Face not detected"

internal fun calibrationFaceReadyText(zhTw: Boolean): String =
    if (zhTw) "已偵測到臉部。請依照畫面指示操作。" else "Face detected. Follow the instruction above."

internal fun savedCalibrationQualityText(qualityLabel: String?, zhTw: Boolean): String {
    val retry = qualityLabel == "Quality needs retry" || qualityLabel == "請重新設定"
    val weak = qualityLabel == "Quality weak" || qualityLabel == "品質偏低"
    return when {
        retry && zhTw -> "這次設定不夠可靠。請重新設定。"
        retry -> "This setup was not reliable enough. Run setup again."
        weak && zhTw -> "設定已儲存，但可靠度較低。如操作不穩定，請重新設定。"
        weak -> "Setup was saved with lower reliability. Run setup again if activation is inconsistent."
        zhTw -> "個人設定已完成。請測試長眨眼，確認操作正常。"
        else -> "Personal setup is ready. Test a long blink to confirm it works."
    }
}

class CameraSwitchCalibrationActivity : AppCompatActivity() {
    private val analysisSize = Size(480, 360)
    private var textureView: TextureView? = null
    private var overlayView: CameraFaceOverlayView? = null
    private var statusView: TextView? = null
    private var metricsView: TextView? = null
    private var gestureView: TextView? = null
    private var holdView: TextView? = null
    private var zoomView: TextView? = null
    private var startButton: MaterialButton? = null
    private var changeCameraButton: MaterialButton? = null
    private var blinkGestureButton: MaterialButton? = null
    private var cheekGestureButton: MaterialButton? = null
    private var gestureToggleGroup: MaterialButtonToggleGroup? = null
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
    private var preferredCameraSource: CameraSwitchCameraSource? = null
    private var usbMonitor: USBMonitor? = null
    private var uvcCamera: UVCCamera? = null
    private var uvcPreviewSurface: Surface? = null
    private var activeUvcDeviceName: String? = null
    @Volatile private var uvcFrameQueued = false
    @Volatile private var uvcFrameWidth = 0
    @Volatile private var uvcFrameHeight = 0
    private var maxCameraZoomRatio = MaxSavedZoomRatio
    private var analysisRotationDegrees = 0
    private var activeCameraMirrored = true
    private var reader: ImageReader? = null
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var mainHandler: Handler? = null
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
    private var calibrationRunId = 0
    private var analysisInFlight = false
    private var lastFrameAt = 0L
    private val longBlinkDurations = mutableListOf<Long>()
    private val restClosedDurations = mutableListOf<Long>()
    private val restEyeSignals = mutableListOf<BlinkEyeSignal>()
    private val slowBlinkEyeSignals = mutableListOf<BlinkEyeSignal>()
    private val restEyeTrace = mutableListOf<TimedBlinkEyeSignal>()
    private val slowBlinkEyeTrace = mutableListOf<TimedBlinkEyeSignal>()
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
    private val cheekCalibrationSession = CheekCalibrationSession()
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
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        mainHandler = Handler(mainLooper)
        val profileId = intent.getStringExtra(ExtraProfileId) ?: "en-US"
        cueSet = CalibrationCueText.forProfile(profileId)
        zhTwUi = profileId == "zh-TW"
        val savedSettings = CameraSwitchPreferences.read(this, enabled = false)
        selectedGesture = savedSettings.gesture
        cheekHoldMs = savedSettings.cheekHoldMs
        cheekModel = savedSettings.cheekModel
        calibratedLongBlinkHoldMs = savedSettings.longBlinkMs
        calibratedZoomRatio = savedSettings.zoomRatio
        preferredCameraId = savedSettings.cameraId
        preferredLensFacing = savedSettings.cameraLensFacing
        preferredCameraSource = savedSettings.cameraSource
        detectionParameters = savedSettings.detectionParameters
        savedCalibrationRecord = CameraSwitchPreferences.readCalibrationRecord(this)
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
        val contentLayoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        return FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(19, 24, 31))
            addView(content, contentLayoutParams)
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
                contentLayoutParams.setMargins(padding[0], padding[1], padding[2], padding[3])
                content.layoutParams = contentLayoutParams
                view.post {
                    val availableHeight = view.height - padding[1] - padding[3]
                    if (availableHeight > 0 && contentLayoutParams.height != availableHeight) {
                        contentLayoutParams.height = availableHeight
                        content.layoutParams = contentLayoutParams
                    }
                }
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
        val wideLayout = resources.configuration.screenWidthDp >= 600
        val root = LinearLayout(this).apply {
            orientation = if (wideLayout) LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(19, 24, 31))
            // AppCompat offsets this content below the status bar on target-35 devices,
            // while the weighted child can still be measured against the full decor height.
            // Reserve that inset at the far edge so bottom controls are not clipped.
            setPadding(dp(12), 0, dp(12), statusBarHeightPx())
        }

        val toolbar = MaterialToolbar(this).apply {
            title = tr("Camera actions", "相機動作")
            setTitleTextColor(Color.WHITE)
            setNavigationIcon(R.drawable.ic_camera_setup_back)
            navigationContentDescription = tr("Back", "返回")
            setNavigationOnClickListener { finish() }
            contentInsetStartWithNavigation = 0
            setContentInsetsRelative(0, 0)
            minimumHeight = dp(48)
        }
        statusView = MaterialTextView(this).apply {
            text = tr("Center your face, then tap Start setup.", "將臉置於中央，再按「開始設定」。")
            setTextColor(Color.rgb(220, 227, 235))
            textSize = 15f
            setPadding(0, dp(4), 0, dp(2))
            gravity = Gravity.CENTER_VERTICAL
            minHeight = dp(52)
            maxHeight = dp(52)
            minLines = 2
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        metricsView = MaterialTextView(this).apply {
            text = tr("Waiting for camera", "等待相機")
            setTextColor(Color.rgb(226, 234, 242))
            textSize = 13f
            setPadding(dp(6), dp(3), dp(6), dp(3))
            background = roundedBackground(Color.argb(190, 15, 23, 42), dp(6))
            maxWidth = dp(
                if (wideLayout) 360
                else (resources.configuration.screenWidthDp - 124).coerceAtLeast(168)
            )
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        holdView = compactValueLabel()
        zoomView = compactValueLabel()
        changeCameraButton = actionButton(tr("Finding…", "搜尋中…"), primary = false) {
            textSize = 13f
            icon = ContextCompat.getDrawable(this@CameraSwitchCalibrationActivity, R.drawable.ic_camera_setup_switch)
            iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
            iconPadding = dp(4)
            cornerRadius = dp(24)
            strokeWidth = 0
            backgroundTintList = ColorStateList.valueOf(Color.argb(225, 42, 52, 64))
            setOnClickListener { changeCamera() }
        }

        val previewFrame = MaterialCardView(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
            radius = dp(12).toFloat()
            strokeWidth = dp(1)
            strokeColor = Color.rgb(58, 70, 82)
            setCardBackgroundColor(Color.BLACK)
            cardElevation = 0f
            clipToOutline = true
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
        overlayView = CameraFaceOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        previewFrame.addView(textureView)
        previewFrame.addView(overlayView)
        val metricsSlot = FrameLayout(this).apply {
            addView(
                metricsView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.START or Gravity.TOP
                )
            )
        }
        val previewTopBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.TOP
            addView(
                metricsSlot,
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            )
            addView(
                changeCameraButton,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginStart = dp(4)
                }
            )
        }
        previewFrame.addView(
            previewTopBar,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP
            ).apply {
                setMargins(dp(6), dp(6), dp(6), 0)
            }
        )

        val zoomOutButton = overlayStepperButton(
            symbol = "−",
            description = tr("Zoom out", "縮小")
        ) { adjustZoomRatio(-0.2f) }
        val zoomInButton = overlayStepperButton(
            symbol = "+",
            description = tr("Zoom in", "放大")
        ) { adjustZoomRatio(0.2f) }
        val zoomControls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(2), dp(2), dp(2), dp(2))
            background = roundedBackground(Color.argb(220, 15, 23, 42), dp(28))
            addView(zoomOutButton, LinearLayout.LayoutParams(dp(48), dp(48)))
            addView(
                zoomView,
                LinearLayout.LayoutParams(dp(72), dp(48)).apply {
                    marginStart = dp(2)
                    marginEnd = dp(2)
                }
            )
            addView(zoomInButton, LinearLayout.LayoutParams(dp(48), dp(48)))
        }
        previewFrame.addView(
            zoomControls,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            ).apply {
                bottomMargin = dp(14)
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
        actions.addView(startButton, weightedActionButtonParams(weight = 2f))
        actions.addView(closeButton, weightedActionButtonParams(weight = 1f))

        blinkGestureButton = actionButton(tr("Long blink", "長眨眼"), primary = false) {
            setOnClickListener { selectGesture(OpticalSwitchGesture.LongBlink) }
        }
        cheekGestureButton = actionButton(tr("Cheek movement", "臉頰動作"), primary = false) {
            setOnClickListener { selectGesture(OpticalSwitchGesture.CheekTwitch) }
        }

        gestureToggleGroup = MaterialButtonToggleGroup(this).apply {
            orientation = LinearLayout.HORIZONTAL
            isSingleSelection = true
            isSelectionRequired = true
            addView(
                blinkGestureButton,
                LinearLayout.LayoutParams(0, dp(48), 1f)
            )
            addView(
                cheekGestureButton,
                LinearLayout.LayoutParams(0, dp(48), 1f)
            )
        }
        val holdRow = compactSettingRow(
            value = holdView,
            decreaseButton = actionButton("−", primary = false) {
                    contentDescription = tr("Shorter hold", "縮短維持時間")
                    setOnClickListener { adjustHoldMs(-100L) }
                },
            increaseButton = actionButton("+", primary = false) {
                    contentDescription = tr("Longer hold", "延長維持時間")
                    setOnClickListener { adjustHoldMs(100L) }
                }
        )
        val previewPane = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(
                toolbar,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(48)
                )
            )
            addView(
                statusView,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(52)
                )
            )
            addView(previewFrame)
        }
        val controlsColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(if (wideLayout) dp(12) else 0, 0, 0, 0)
            addView(
                gestureToggleGroup,
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(48)
                ).apply {
                    setMargins(dp(4), 0, dp(4), 0)
                }
            )
            addView(holdRow)
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
                    dp(154)
                )
            )
        }
        updateGestureUi()
        updateHoldUi()
        updateZoomUi()
        return root
    }

    private fun compactValueLabel(): TextView = MaterialTextView(this).apply {
        setTextColor(Color.rgb(226, 234, 242))
        textSize = 14f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        maxLines = 2
        ellipsize = android.text.TextUtils.TruncateAt.END
    }

    private fun compactSettingRow(
        value: TextView?,
        decreaseButton: MaterialButton,
        increaseButton: MaterialButton
    ): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = roundedBackground(Color.rgb(27, 34, 43), dp(12), Color.rgb(49, 60, 72))
        setPadding(dp(4), 0, dp(4), 0)
        value?.let {
            it.gravity = Gravity.START or Gravity.CENTER_VERTICAL
            it.maxLines = 1
            addView(
                it,
                LinearLayout.LayoutParams(
                    0,
                    dp(52),
                    1f
                )
            )
        }
        for (button in listOf(decreaseButton, increaseButton)) {
            button.textSize = 20f
            button.cornerRadius = dp(22)
            button.insetTop = 0
            button.insetBottom = 0
            addView(
                button,
                LinearLayout.LayoutParams(dp(48), dp(48)).apply {
                    marginStart = dp(4)
                }
            )
        }
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(52)
        ).apply {
            setMargins(dp(4), 0, dp(4), 0)
        }
    }

    private fun overlayStepperButton(
        symbol: String,
        description: String,
        onClick: () -> Unit
    ): MaterialButton = actionButton(symbol, primary = false) {
        contentDescription = description
        textSize = 20f
        cornerRadius = dp(24)
        insetTop = 0
        insetBottom = 0
        strokeWidth = 0
        backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
        setOnClickListener { onClick() }
    }

    private fun updateSavedCalibrationUi() {
        if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
            val record = CameraSwitchPreferences.readCheekCalibrationRecord(this)
            if (record != null && cheekModel != null) {
                statusView?.text = tr(
                    "Ready. Your cheek movement is calibrated; calibration is optional to repeat.",
                    "設定完成。已學會您的臉頰動作；可選擇重新校正。"
                )
                metricsView?.text = tr(
                    "Personal setup is ready. Test a cheek movement to confirm it works.",
                    "個人設定已完成。請測試臉頰動作，確認操作正常。"
                )
            } else {
                statusView?.text = tr(
                    "Cheek movement works without setup. Personal setup can improve reliability.",
                    "臉頰動作不設定也能使用；個人設定可提升可靠度。"
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
        val record = savedCalibrationRecord
        if (record != null) {
            statusView?.text = tr(
                "Ready. Long blink is calibrated; use Test blink after moving the phone.",
                "設定完成。移動手機後，請使用「測試眨眼」確認。"
            )
            metricsView?.text = savedCalibrationQualityText(record.qualityLabel, zhTwUi)
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
        } else {
            val result = engine.setLanguage(cueSet.locale)
            if ((result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) &&
                cueSet.locale.language == "zh"
            ) {
                engine.setLanguage(Locale.TRADITIONAL_CHINESE)
            }
        }
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) = finishSpeech(utteranceId)
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = finishSpeech(utteranceId)
            override fun onError(utteranceId: String?, errorCode: Int) = finishSpeech(utteranceId)
        })
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
        restEyeTrace.clear()
        slowBlinkEyeTrace.clear()
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
        metricsView?.text = calibrationStepPendingText(step.label, zhTwUi)
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
        phase = Phase.Complete
        detectionParameters = BlinkParameterAutoCalibrator.tune(
            restSignals = restEyeSignals,
            slowBlinkSignals = slowBlinkEyeSignals,
            frameIntervalsMs = calibrationFrameIntervalsMs,
            fallback = detectionParameters
        )
        longBlinkDurations.clear()
        longBlinkDurations += BlinkCalibrationTraceAnalyzer.closedDurations(
            slowBlinkEyeTrace,
            detectionParameters
        )
        restClosedDurations.clear()
        restClosedDurations += BlinkCalibrationTraceAnalyzer.closedDurations(
            restEyeTrace,
            detectionParameters
        )
        longBlinkClosed = false
        restClosed = false
        calibratedLongBlinkHoldMs = calibratedLongBlinkMs()
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
        Log.i(CameraSetupLogTag, "blink calibration ${quality.diagnosticDetail}")
        savedCalibrationRecord = CameraSwitchPreferences.readCalibrationRecord(this)
        updateHoldUi()
        val message = "${cueSet.complete} ${quality.detail}"
        statusView?.text = message
        metricsView?.text = quality.detail
        speakThen(message) {}
        startButton?.isEnabled = true
    }

    private fun calibratedLongBlinkMs(): Long {
        return BlinkHoldThresholdCalibrator.choose(
            deliberateDurationsMs = longBlinkDurations,
            naturalDurationsMs = restClosedDurations,
            fallbackMs = CameraSwitchSettings.DefaultLongBlinkMs
        )
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
        restEyeTrace.clear()
        slowBlinkEyeTrace.clear()
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
        cheekCalibrationSession.reset()
        cheekDetector.reset()
        cheekPreviewActivations = 0
        resetCheekClassifier()
        startButton?.isEnabled = true
    }

    private fun updateGestureUi() {
        gestureView?.text = when (selectedGesture) {
            OpticalSwitchGesture.LongBlink -> tr("Action: Long blink", "動作：長眨眼")
            OpticalSwitchGesture.CheekTwitch -> tr("Action: Cheek movement", "動作：臉頰動作")
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

    private fun applyGestureButtonStyle(button: MaterialButton?, selected: Boolean) {
        button ?: return
        button.isChecked = selected
        button.setTextColor(if (selected) Color.WHITE else Color.rgb(226, 234, 242))
        button.typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        button.backgroundTintList = ColorStateList.valueOf(
            if (selected) Color.rgb(35, 122, 110) else Color.rgb(42, 52, 64)
        )
        button.strokeColor = ColorStateList.valueOf(
            if (selected) Color.rgb(52, 211, 153) else Color.rgb(73, 87, 102)
        )
        button.strokeWidth = dp(1)
    }

    private fun startCheekCalibration() {
        cheekDetector.reset()
        cheekCalibrationSession.start()
        cheekPreviewActivations = 0
        statusView?.text = tr(
            "Calibration: relax your face. We will continue automatically when enough resting frames are collected.",
            "校正：請放鬆臉部。收集足夠的放鬆影像後會自動繼續。"
        )
        metricsView?.text = tr(
            "Stay relaxed while setup learns your resting face.",
            "請保持放鬆，系統正在記住您放鬆時的臉部狀態。"
        )
        startButton?.isEnabled = false
    }

    private fun processCheekCalibration(values: Map<String, Double>): Boolean {
        return when (val update = cheekCalibrationSession.observe(values, cheekDetector.ready)) {
            CheekCalibrationUpdate.Inactive,
            CheekCalibrationUpdate.CapturePending -> false
            is CheekCalibrationUpdate.RestProgress -> {
                if (update.readyForMovement) {
                    statusView?.text = cheekCalibrationMoveInstruction(zhTw = zhTwUi)
                }
                metricsView?.text = tr(
                    "Stay relaxed while setup learns your resting face.",
                    "請保持放鬆，系統正在記住您放鬆時的臉部狀態。"
                )
                false
            }
            is CheekCalibrationUpdate.Evaluated -> {
                val attempt = update.attempt
                val outcome = attempt.outcome
                metricsView?.text = when {
                    outcome is CheekCalibrationOutcome.Success -> tr(
                        "Movement found.",
                        "已找到臉頰動作。"
                    )
                    attempt.positiveFrameCount > 0 -> tr(
                        "Learning your movement. Move your cheek again, then relax.",
                        "正在學習您的動作。請再動一下臉頰，然後放鬆。"
                    )
                    else -> tr(
                        "Move your cheek naturally, then relax.",
                        "請自然動一下臉頰，然後放鬆。"
                    )
                }
                if (outcome is CheekCalibrationOutcome.Success) {
                    finishCheekCalibration(outcome.model)
                    true
                } else {
                    false
                }
            }
        }
    }

    private fun finishCheekCalibration(model: CheekGestureModel) {
        cheekModel = model
        CameraSwitchPreferences.saveCheekCalibration(
            context = this, model = model, cheekHoldMs = cheekHoldMs,
            zoomRatio = calibratedZoomRatio, qualityLabel = tr("Quality good", "品質良好"),
            qualityDetail = tr("Personal setup is ready.", "個人設定已完成。")
        )
        Log.i(CameraSetupLogTag, "cheek calibration quality=${model.quality.message}")
        cheekCalibrationSession.complete()
        resetCheekClassifier()
        startButton?.isEnabled = true
        playLongAcceptedCue()
        statusView?.text = tr("Cheek calibration saved automatically.", "臉頰校正已自動儲存。")
        metricsView?.text = tr(
            "Personal setup is ready.",
            "個人設定已完成。"
        )
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
                "已更新臉頰動作維持時間。"
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
                compactSecondsLabel(
                    tr("Hold", "維持"),
                    calibratedLongBlinkHoldMs,
                    tr("s", "秒")
                )
            OpticalSwitchGesture.CheekTwitch ->
                compactSecondsLabel(
                    tr("Hold", "維持"),
                    cheekHoldMs,
                    tr("s", "秒")
                )
        }
    }

    private fun adjustZoomRatio(delta: Float) {
        val maxZoom = max(1.0f, maxCameraZoomRatio)
        calibratedZoomRatio = (calibratedZoomRatio + delta).coerceIn(1.0f, min(maxZoom, MaxSavedZoomRatio))
        CameraSwitchPreferences.saveZoom(this, calibratedZoomRatio)
        applyZoomToRepeatingRequest()
        if (selectedCamera?.source == CameraSwitchCameraSource.Uvc) {
            updatePreviewTransform(
                textureView?.width ?: 0,
                textureView?.height ?: 0
            )
        }
        updateZoomUi()
        statusView?.text = tr("Camera zoom updated.", "已更新相機縮放。")
        metricsView?.text = tr(
            "Keep the face centered; green box means the face tracker can read the eyes.",
            "臉部保持置中；綠框表示系統能辨識眼睛。"
        )
    }

    private fun updateZoomUi() {
        zoomView?.text = compactZoomValueLabel(calibratedZoomRatio)
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
        val diagnosticDetail = buildString {
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
        val detail = when (assessment.level) {
            BlinkCalibrationQualityPolicy.Level.Good -> tr(
                "Setup quality is good. Test a long blink to confirm it works.",
                "設定品質良好。請測試長眨眼，確認操作正常。"
            )
            BlinkCalibrationQualityPolicy.Level.Weak -> tr(
                "Setup was saved with lower reliability. Run setup again if activation is inconsistent.",
                "設定已儲存，但可靠度較低。如操作不穩定，請重新設定。"
            )
            BlinkCalibrationQualityPolicy.Level.Retry -> tr(
                "This setup was not reliable enough. Run setup again.",
                "這次設定不夠可靠。請重新設定。"
            )
        }
        return CalibrationQuality(label, detail, diagnosticDetail)
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
            uvcCamera != null ||
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

                val camera2Cameras =
                    CameraSwitchCameraSelection.availableCameras(manager)
                        .filter { it.cameraId in cameraXIds }
                val refreshed = camera2Cameras +
                    UvcCameraDiscovery.availableCameras(this)
                availableCameras = refreshed
                selectedCamera = CameraSwitchCameraSelection.choose(
                    cameras = refreshed,
                    preferredCameraId =
                        selectedCamera?.cameraId
                            ?: preferredCameraId
                            ?: defaultFrontId,
                    preferredLensFacing =
                        preferredLensFacing
                            ?: CameraCharacteristics.LENS_FACING_FRONT,
                    preferredSource = preferredCameraSource
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
            preferredCameraSource = selectedCamera?.source
            CameraSwitchPreferences.saveCameraSelection(
                this,
                cameraId,
                lensFacing,
                selectedCamera?.source ?: CameraSwitchCameraSource.Camera2
            )
            Log.i(
                CameraSetupLogTag,
                "OPTICAL_CAMERA setupId=$cameraId " +
                    "facing=${cameraFacingLogName(lensFacing)} " +
                    "selector=${selectedCamera?.source?.storedValue ?: "camera2"}"
            )

            if (selectedCamera?.source == CameraSwitchCameraSource.Uvc) {
                activeCameraMirrored = false
                analysisRotationDegrees = 0
                maxCameraZoomRatio = MaxSavedZoomRatio
                updateZoomUi()
                updatePreviewTransform(
                    textureView?.width ?: 0,
                    textureView?.height ?: 0
                )
                startUvcCalibration(cameraId, openGeneration, texture)
                return@addListener
            }

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

    private fun startUvcCalibration(
        cameraId: String,
        openGeneration: Int,
        previewTexture: android.graphics.SurfaceTexture
    ) {
        val monitor = USBMonitor.getInstance(applicationContext).apply {
            setOnDeviceConnectListener(object : USBMonitor.OnDeviceConnectListener {
                override fun onAttach(device: UsbDevice) {
                    if (openGeneration != cameraOpenGeneration ||
                        !activityResumed || uvcCamera != null ||
                        !UvcCameraDiscovery.isUvcDevice(device)
                    ) return
                    preferredCameraId = UvcCameraDiscovery.cameraId(device)
                    usbMonitor?.requestPermission(device)
                }

                override fun onConnect(
                    device: UsbDevice,
                    ctrlBlock: USBMonitor.UsbControlBlock,
                    createNew: Boolean
                ) {
                    if (openGeneration != cameraOpenGeneration ||
                        !activityResumed || !UvcCameraDiscovery.isUvcDevice(device)
                    ) return
                    openUvcCalibration(
                        device,
                        ctrlBlock,
                        openGeneration,
                        previewTexture
                    )
                }

                override fun onDisconnect(
                    device: UsbDevice,
                    ctrlBlock: USBMonitor.UsbControlBlock
                ) {
                    if (device.deviceName != activeUvcDeviceName) return
                    closeUvcCalibrationStream()
                    runOnUiThread {
                        statusView?.text = tr(
                            "USB camera disconnected.",
                            "USB 相機已中斷連線。"
                        )
                    }
                }

                override fun onDetach(device: UsbDevice) = Unit

                override fun onCancel(device: UsbDevice) {
                    if (openGeneration != cameraOpenGeneration) return
                    cameraOpening = false
                    runOnUiThread {
                        statusView?.text = tr(
                            "USB camera permission was not granted.",
                            "未授予 USB 相機權限。"
                        )
                    }
                }
            })
        }
        usbMonitor = monitor
        try {
            monitor.register()
            val device = UvcCameraDiscovery.findDevice(this, cameraId)
            if (device == null) {
                cameraOpening = false
                statusView?.text = tr(
                    "USB camera unavailable.",
                    "找不到 USB 相機。"
                )
            } else {
                statusView?.text = tr(
                    "Waiting for USB camera permission…",
                    "正在等待 USB 相機權限…"
                )
                if (monitor.requestPermission(device)) {
                    cameraOpening = false
                    statusView?.text = tr(
                        "USB camera permission request failed.",
                        "USB 相機權限要求失敗。"
                    )
                }
            }
        } catch (error: Exception) {
            cameraOpening = false
            Log.w(CameraSetupLogTag, "UVC monitor failed", error)
            statusView?.text = tr(
                "USB camera setup failed.",
                "USB 相機設定失敗。"
            )
        }
    }

    private fun openUvcCalibration(
        device: UsbDevice,
        ctrlBlock: USBMonitor.UsbControlBlock,
        openGeneration: Int,
        previewTexture: android.graphics.SurfaceTexture
    ) {
        closeUvcCalibrationStream()
        val camera = UVCCamera()
        try {
            camera.open(ctrlBlock)
            val selectedSize = configureUvcPreview(camera)
            previewTexture.setDefaultBufferSize(
                selectedSize.width,
                selectedSize.height
            )
            val surface = Surface(previewTexture)
            uvcPreviewSurface = surface
            uvcFrameWidth = selectedSize.width
            uvcFrameHeight = selectedSize.height
            activeUvcDeviceName = device.deviceName
            camera.setPreviewDisplay(surface)
            camera.setFrameCallback(
                IFrameCallback { frame ->
                    queueUvcCalibrationFrame(frame, openGeneration)
                },
                UVCCamera.PIXEL_FORMAT_NV21
            )
            camera.startPreview()
            uvcCamera = camera
            cameraOpening = false
            runOnUiThread {
                updatePreviewTransform(
                    textureView?.width ?: 0,
                    textureView?.height ?: 0
                )
                statusView?.text = tr(
                    "USB camera connected. Center your face, then tap Start setup.",
                    "USB 相機已連線。將臉置於中央，再按「開始設定」。"
                )
            }
            Log.i(
                CameraSetupLogTag,
                "OPTICAL_CAMERA setupId=${UvcCameraDiscovery.cameraId(device)} " +
                    "facing=external selector=usb-uvc " +
                    "size=${selectedSize.width}x${selectedSize.height}"
            )
        } catch (error: Exception) {
            cameraOpening = false
            Log.w(CameraSetupLogTag, "UVC open failed", error)
            runCatching { camera.destroy() }
            closeUvcCalibrationStream()
            runOnUiThread {
                statusView?.text = tr(
                    "USB camera could not be opened.",
                    "無法開啟 USB 相機。"
                )
            }
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

    private fun queueUvcCalibrationFrame(
        frame: ByteBuffer,
        frameGeneration: Int
    ) {
        if (frameGeneration != cameraOpenGeneration ||
            !activityResumed || uvcFrameQueued
        ) return
        val width = uvcFrameWidth
        val height = uvcFrameHeight
        val expectedBytes = width * height * 3 / 2
        if (width <= 0 || height <= 0 || frame.remaining() < expectedBytes) return
        uvcFrameQueued = true
        val bytes = ByteArray(expectedBytes)
        frame.duplicate().apply { rewind() }.get(bytes)
        val handler = cameraHandler
        if (handler == null || !handler.post {
                analyzeUvcCalibrationFrame(
                    bytes,
                    width,
                    height,
                    frameGeneration
                )
            }
        ) {
            uvcFrameQueued = false
        }
    }

    private fun analyzeUvcCalibrationFrame(
        bytes: ByteArray,
        width: Int,
        height: Int,
        frameGeneration: Int
    ) {
        val now = System.currentTimeMillis()
        val interval = when (selectedGesture) {
            OpticalSwitchGesture.LongBlink -> BlinkFrameIntervalMs
            OpticalSwitchGesture.CheekTwitch -> CheekFrameIntervalMs
        }
        if (frameGeneration != cameraOpenGeneration || !activityResumed ||
            analysisInFlight || now - lastFrameAt < interval
        ) {
            uvcFrameQueued = false
            return
        }
        val bitmap = try {
            Nv21Bitmaps.toBitmap(
                bytes,
                width,
                height,
                zoomRatio = calibratedZoomRatio
            )
        } catch (error: Exception) {
            Log.w(CameraSetupLogTag, "UVC frame conversion failed", error)
            uvcFrameQueued = false
            return
        }
        analysisInFlight = true
        lastFrameAt = now
        val imageWidth = bitmap.width
        val imageHeight = bitmap.height
        val analyzer = cheekAnalyzer
        try {
            val observation = analyzer?.analyzeBitmapForCamera(bitmap, now)
            if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
                handleCheekObservation(
                    observation = observation,
                    now = now,
                    frameWidth = imageWidth,
                    frameHeight = imageHeight,
                    detailedEnglishQuality = false
                )
            } else {
                handleBlinkObservation(observation, now, imageWidth, imageHeight)
            }
        } catch (_: Exception) {
            mainHandler?.post {
                metricsView?.text = tr(
                    "Face analysis paused; keep your face centered.",
                    "臉部分析暫停；請保持臉部置中。"
                )
            }
        } finally {
            bitmap.recycle()
            analysisInFlight = false
            uvcFrameQueued = false
        }
    }

    private fun closeUvcCalibrationStream() {
        val camera = uvcCamera
        uvcCamera = null
        activeUvcDeviceName = null
        uvcFrameQueued = false
        runCatching { camera?.setFrameCallback(null, 0) }
        runCatching { camera?.destroy() }
        uvcPreviewSurface?.release()
        uvcPreviewSurface = null
        uvcFrameWidth = 0
        uvcFrameHeight = 0
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
        closeUvcCalibrationStream()
        val monitor = usbMonitor
        usbMonitor = null
        runCatching { monitor?.destroy() }
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
        analysisInFlight = false
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
            OpticalSwitchGesture.LongBlink -> BlinkFrameIntervalMs
            OpticalSwitchGesture.CheekTwitch -> CheekFrameIntervalMs
        }
        if (analysisInFlight || now - lastFrameAt < detectorIntervalMs) {
            image.close()
            return
        }

        val analyzer = cheekAnalyzer
        if (analyzer == null) {
            image.close()
            mainHandler?.post {
                metricsView?.text = tr(
                    "Face detector unavailable on this device.",
                    "此裝置無法使用臉部偵測器。"
                )
            }
            return
        }

        analysisInFlight = true
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
            if (selectedGesture == OpticalSwitchGesture.CheekTwitch) {
                handleCheekObservation(
                    observation = observation,
                    now = now,
                    frameWidth = imageSize.width,
                    frameHeight = imageSize.height,
                    detailedEnglishQuality = true
                )
            } else {
                handleBlinkObservation(observation, now, imageSize.width, imageSize.height)
            }
        } catch (_: Exception) {
            mainHandler?.post {
                metricsView?.text = tr(
                    "Face analysis paused; keep your face centered.",
                    "臉部分析暫停；請保持臉部置中。"
                )
            }
        } finally {
            image.close()
            analysisInFlight = false
        }
    }

    /** Applies identical blink calibration behavior to Camera2 and direct UVC frames. */
    private fun handleBlinkObservation(
        observation: CheekFaceObservation?,
        now: Long,
        frameWidth: Int,
        frameHeight: Int
    ) {
        val rawSignal = observation?.blinkEyeSignal()
        val signal = rawSignal?.let(detectionParameters::normalizeSignal)
        val score = signal?.closedScore
        if (rawSignal != null) collectCalibrationSample(rawSignal, now)
        val previewBlink = signal?.let(::collectPreviewBlinkDuration) ?: PreviewBlink.None

        mainHandler?.post {
            overlayView?.setNormalizedDetection(
                face = observation?.normalizedBounds,
                landmarks = null,
                frameWidth = frameWidth,
                frameHeight = frameHeight,
                score = score,
                threshold = detectionParameters.closeThreshold,
                hasSignal = score != null
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

    /** Applies identical calibration and preview behavior to Camera2 and direct UVC frames. */
    private fun handleCheekObservation(
        observation: CheekFaceObservation?,
        now: Long,
        frameWidth: Int,
        frameHeight: Int,
        detailedEnglishQuality: Boolean
    ) {
        val values = observation?.takeIf { it.usable }?.blendshapes
        val defaultScore = values?.let { cheekDetector.observe(it) }
        val score = values?.let { cheekModel?.score(it) } ?: defaultScore
        val calibrationWasActive = cheekCalibrationSession.active
        val calibrationCompleted = values?.let(::processCheekCalibration) ?: false

        var activated = calibrationCompleted
        if (!calibrationWasActive) {
            cheekClassifier.onScore(score, now).forEach { event ->
                if (event is BinarySwitchClassifier.Event.Activated) {
                    activated = true
                    cheekPreviewActivations += 1
                }
            }
        }

        val warmupPercent = (cheekDetector.warmupProgress * 100f).toInt()
        val threshold = cheekModel?.enterThreshold ?: CheekTwitchDetector.DefaultEnterThreshold
        mainHandler?.post {
            overlayView?.setNormalizedDetection(
                face = observation?.normalizedBounds,
                landmarks = observation?.normalizedLandmarks,
                frameWidth = frameWidth,
                frameHeight = frameHeight,
                score = score,
                threshold = threshold,
                hasSignal = observation?.usable == true,
                showThreshold = !calibrationWasActive
            )
            if (activated && !calibrationWasActive) {
                playLongAcceptedCue()
                statusView?.text = tr(
                    "Cheek movement accepted. Current position works.",
                    "臉頰動作已接受。目前位置合適。"
                )
            }
            if (calibrationWasActive && observation?.usable == false) {
                metricsView?.text = if (zhTwUi) {
                    "校正暫停：${observation.qualityMessage}。臉部約佔畫面 70%。"
                } else {
                    "Calibration paused: ${observation.qualityMessage}. Keep your face around 70% of the view."
                }
            } else if (!calibrationWasActive) {
                metricsView?.text = when {
                    observation == null -> tr("Face not detected", "未偵測到臉部")
                    !observation.usable && detailedEnglishQuality && !zhTwUi ->
                        observation.qualityMessage
                    !observation.usable -> tr("Adjust face position", "請調整臉部位置")
                    !cheekDetector.ready -> tr(
                        "Learning resting face $warmupPercent%",
                        "正在學習放鬆表情 $warmupPercent%"
                    )
                    score == null -> tr("Learning resting face", "正在學習放鬆表情")
                    else -> tr(
                        "Face detected. Try a cheek movement.",
                        "已偵測到臉部。請試著做臉頰動作。"
                    )
                }
            }
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
                    "Face detected. Try a long blink.",
                    "已偵測到臉部。請試著做長眨眼。"
                )
            }
            return
        }
        if (phase != Phase.Complete) {
            val remainingMs = max(0L, captureEndsAtMs - System.currentTimeMillis())
            metricsView?.text = if (score == null) {
                calibrationFaceMissingText(zhTwUi)
            } else if (captureEndsAtMs > 0L) {
                tr(
                    "$activeStepLabel: ${((remainingMs + 999L) / 1000L)}s left; ${longBlinkDurations.size} slow blinks found",
                    "$activeStepLabel：剩下 ${((remainingMs + 999L) / 1000L)} 秒；已找到 ${longBlinkDurations.size} 次慢眨眼"
                )
            } else {
                calibrationFaceReadyText(zhTwUi)
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
                restEyeTrace.add(TimedBlinkEyeSignal(now, signal))
                collectRestClosedDuration(signal)
            }
            Phase.LongBlink -> {
                slowBlinkEyeSignals.add(signal)
                slowBlinkEyeTrace.add(TimedBlinkEyeSignal(now, signal))
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
        val bufferWidth = if (selectedCamera?.source == CameraSwitchCameraSource.Uvc) {
            uvcFrameWidth.takeIf { it > 0 } ?: PreviewBufferWidth
        } else PreviewBufferWidth
        val bufferHeight = if (selectedCamera?.source == CameraSwitchCameraSource.Uvc) {
            uvcFrameHeight.takeIf { it > 0 } ?: PreviewBufferHeight
        } else PreviewBufferHeight
        val scale = CameraPreviewGeometry.aspectFitScale(
            viewWidth = width,
            viewHeight = height,
            bufferWidth = bufferWidth,
            bufferHeight = bufferHeight,
            rotationDegrees = analysisRotationDegrees
        )
        val previewZoom = if (selectedCamera?.source == CameraSwitchCameraSource.Uvc) {
            calibratedZoomRatio.coerceAtLeast(1f)
        } else 1f
        texture.setTransform(
            Matrix().apply {
                setScale(
                    scale.x * previewZoom,
                    scale.y * previewZoom,
                    width / 2f,
                    height / 2f
                )
            }
        )
    }

    private fun changeCamera() {
        if (!activityResumed || isFinishing || isDestroyed) return
        val cameras = (
            availableCameras.filter {
                it.source == CameraSwitchCameraSource.Camera2
            } + UvcCameraDiscovery.availableCameras(this)
        ).distinctBy { it.cameraId }
        availableCameras = cameras
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
        preferredCameraSource = next.source
        selectedCamera = next
        CameraSwitchPreferences.saveCameraSelection(
            this,
            next.cameraId,
            next.lensFacing,
            next.source
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
            changeCameraButton?.text = tr(
                "Refresh",
                "重新整理"
            )
            changeCameraButton?.contentDescription = tr(
                "Refresh cameras; no camera available",
                "重新整理相機；目前沒有可用相機"
            )
            return
        }
        val ordinal = availableCameras.indexOfFirst {
            it.cameraId == camera.cameraId
        }.coerceAtLeast(0) + 1
        val kind = if (camera.source == CameraSwitchCameraSource.Uvc) {
            tr("USB", "USB")
        } else when (camera.lensFacing) {
            CameraCharacteristics.LENS_FACING_FRONT ->
                tr("Front", "前置")
            CameraCharacteristics.LENS_FACING_BACK ->
                tr("Rear", "後置")
            CameraCharacteristics.LENS_FACING_EXTERNAL ->
                tr("External", "外接")
            else -> tr("Other", "其他")
        }
        changeCameraButton?.text = compactCameraPositionLabel(
            kind, ordinal, availableCameras.size
        )
        changeCameraButton?.contentDescription = if (availableCameras.size > 1) {
            tr(
                "Switch camera; current $kind camera $ordinal of ${availableCameras.size}",
                "切換相機；目前為${kind}相機，第 $ordinal 個，共 ${availableCameras.size} 個"
            )
        } else {
            tr(
                "Refresh cameras; current $kind camera",
                "重新整理相機；目前為${kind}相機"
            )
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

    private fun statusBarHeightPx(): Int {
        val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (resourceId > 0) resources.getDimensionPixelSize(resourceId) else 0
    }

    private fun tr(english: String, traditionalChinese: String): String =
        if (zhTwUi) traditionalChinese else english

    private fun actionButton(
        text: String,
        primary: Boolean,
        configure: MaterialButton.() -> Unit
    ) = MaterialButton(this).apply {
        this.text = text
        isAllCaps = false
        minHeight = dp(48)
        minWidth = dp(48)
        textSize = 14f
        maxLines = 2
        setPadding(dp(8), 0, dp(8), 0)
        insetTop = 0
        insetBottom = 0
        cornerRadius = dp(12)
        setTextColor(if (primary) Color.WHITE else Color.rgb(226, 234, 242))
        backgroundTintList = actionButtonTint(primary)
        strokeColor = ColorStateList.valueOf(
            if (primary) Color.TRANSPARENT else Color.rgb(73, 87, 102)
        )
        strokeWidth = if (primary) 0 else dp(1)
        configure()
    }

    private fun actionButtonTint(primary: Boolean): ColorStateList = ColorStateList(
        arrayOf(
            intArrayOf(-android.R.attr.state_enabled),
            intArrayOf(android.R.attr.state_pressed),
            intArrayOf()
        ),
        intArrayOf(
            Color.rgb(45, 52, 60),
            if (primary) Color.rgb(28, 104, 94) else Color.rgb(53, 65, 78),
            if (primary) Color.rgb(35, 122, 110) else Color.rgb(42, 52, 64)
        )
    )

    private fun weightedActionButtonParams(weight: Float) = LinearLayout.LayoutParams(
        0,
        dp(48),
        weight
    ).apply {
        setMargins(dp(4), dp(2), dp(4), dp(2))
    }

    private fun roundedBackground(color: Int, radius: Int, strokeColor: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radius.toFloat()
            if (strokeColor != null) setStroke(dp(1), strokeColor)
        }

    private data class CalibrationStep(val phase: Phase, val label: String, val cue: String, val durationMs: Long)
    private data class CalibrationQuality(
        val label: String,
        val detail: String,
        val diagnosticDetail: String
    )
    private enum class Phase { Idle, Instruction, Prepare, Rest, LongBlink, Complete }
    private enum class PreviewBlink { None, Short, Long }

    private companion object {
        const val CameraSetupLogTag = "ShineCameraSetup"
        const val ExtraProfileId = "org.shineaac.inputs.PROFILE_ID"
        const val CameraPermissionRequestCode = 2504
        const val PreviewBufferWidth = 640
        const val PreviewBufferHeight = 480
        const val BlinkFrameIntervalMs = 200L
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

internal fun compactSecondsLabel(action: String, durationMs: Long, unit: String): String {
    val seconds = String.format(Locale.US, "%.2f", durationMs / 1000.0)
        .trimEnd('0')
        .trimEnd('.')
    return "$action $seconds $unit"
}

internal fun compactZoomLabel(label: String, ratio: Float): String =
    "$label ${String.format(Locale.US, "%.1f", ratio)}×"

internal fun compactZoomValueLabel(ratio: Float): String =
    "${String.format(Locale.US, "%.1f", ratio)}×"

internal fun compactCameraPositionLabel(kind: String, ordinal: Int, total: Int): String =
    "$kind $ordinal/$total"

internal fun cameraSetupFontScale(systemFontScale: Float): Float =
    if (systemFontScale.isFinite() && systemFontScale > 0f) {
        systemFontScale.coerceAtMost(MaxCameraSetupFontScale)
    } else {
        1f
    }
