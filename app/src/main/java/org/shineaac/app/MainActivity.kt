package org.shineaac.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.shineaac.inputs.CameraSwitchCalibrationActivity
import org.shineaac.inputs.CameraSwitchInputAdapter
import org.shineaac.inputs.CameraSwitchPreferences
import org.shineaac.inputs.InputEvent
import org.shineaac.inputs.InputSink
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val ttsExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    @Volatile private var hardwareButtonsEnabled = true
    @Volatile private var cameraSwitchEnabled = false
    @Volatile private var switchInputProfile = SwitchInputHardware
    private var cameraSwitchInput: CameraSwitchInputAdapter? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyOrientationPolicy()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.getDefault()
            }
        }

        val shineWebView = WebView(this).apply {
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            addJavascriptInterface(AndroidSpeechBridge(), "ShineAacAndroid")
            loadUrl("file:///android_asset/www/apps/web/index.html")
        }

        webView = shineWebView
        setContentView(createInsetAwareWebViewHost(shineWebView))

        cameraSwitchInput = CameraSwitchInputAdapter(
            context = this,
            lifecycleOwner = this,
            settingsProvider = {
                CameraSwitchPreferences.read(this, enabled = cameraSwitchEnabled)
            },
            sink = InputSink { event ->
                sendInputEvent(event)
            }
        )
    }

    private fun applyOrientationPolicy() {
        requestedOrientation = if (resources.configuration.smallestScreenWidthDp < TabletSmallestWidthDp) {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } else {
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    private fun createInsetAwareWebViewHost(shineWebView: WebView): FrameLayout {
        return FrameLayout(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(246, 244, 238))
            addView(
                shineWebView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
                val systemInsets = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
                )
                view.setPadding(systemInsets.left, systemInsets.top, systemInsets.right, systemInsets.bottom)
                insets
            }
        }
    }

    override fun onBackPressed() {
        val view = webView
        if (view?.canGoBack() == true) {
            view.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        if (cameraSwitchEnabled && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            cameraSwitchInput?.start()
        }
    }

    override fun onPause() {
        cameraSwitchInput?.stop()
        super.onPause()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (!isHardwareActivationKey(event.keyCode)) {
            return super.dispatchKeyEvent(event)
        }

        if (!hardwareButtonsEnabled) {
            return super.dispatchKeyEvent(event)
        }

        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            sendInputEvent(
                InputEvent(
                    intent = "activate",
                    source = sourceForKey(event.keyCode),
                    detail = "keyCode=${event.keyCode}"
                ),
                event.keyCode
            )
        }
        return true
    }

    override fun onDestroy() {
        cameraSwitchInput?.stop()
        cameraSwitchInput = null
        webView?.destroy()
        webView = null
        val engine = tts
        tts = null
        ttsReady = false
        ttsExecutor.execute {
            engine?.stop()
            engine?.shutdown()
        }
        ttsExecutor.shutdown()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CameraPermissionRequestCode &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED &&
            cameraSwitchEnabled
        ) {
            cameraSwitchInput?.start()
        }
    }

    private fun isHardwareActivationKey(keyCode: Int): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP,
            KeyEvent.KEYCODE_VOLUME_DOWN,
            KeyEvent.KEYCODE_CAMERA,
            KeyEvent.KEYCODE_HEADSETHOOK,
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_MEDIA_PLAY,
            KeyEvent.KEYCODE_MEDIA_PAUSE,
            KeyEvent.KEYCODE_BUTTON_A,
            KeyEvent.KEYCODE_BUTTON_SELECT,
            KeyEvent.KEYCODE_BUTTON_START -> true
            else -> false
        }
    }

    private fun sourceForKey(keyCode: Int): String {
        return when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> "android-volume-up"
            KeyEvent.KEYCODE_VOLUME_DOWN -> "android-volume-down"
            KeyEvent.KEYCODE_CAMERA -> "android-hardware-camera"
            KeyEvent.KEYCODE_HEADSETHOOK -> "android-media-headset"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "android-media-play-pause"
            KeyEvent.KEYCODE_MEDIA_PLAY -> "android-media-play"
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "android-media-pause"
            KeyEvent.KEYCODE_BUTTON_A -> "android-hardware-button-a"
            KeyEvent.KEYCODE_BUTTON_SELECT -> "android-hardware-button-select"
            KeyEvent.KEYCODE_BUTTON_START -> "android-hardware-button-start"
            else -> "android-hardware-key"
        }
    }

    private fun sendInputEvent(event: InputEvent, keyCode: Int? = null) {
        val payload = JSONObject()
            .put("intent", event.intent)
            .put("source", event.source)
        if (event.detail.isNotBlank()) payload.put("detail", event.detail)
        if (keyCode != null) payload.put("keyCode", keyCode)
        val script = """
            window.ShineAacInput &&
            window.ShineAacInput.receive($payload);
        """.trimIndent()
        runOnUiThread {
            webView?.evaluateJavascript(script, null)
        }
    }

    inner class AndroidSpeechBridge {
        @JavascriptInterface
        fun speak(text: String) {
            val spoken = text.trim()
            if (spoken.isEmpty() || !ttsReady) return
            ttsExecutor.execute {
                tts?.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "shine-aac-message")
            }
        }

        @JavascriptInterface
        fun setSpeechLocale(languageTag: String) {
            if (!ttsReady || languageTag.isBlank()) return
            val locale = Locale.forLanguageTag(languageTag)
            ttsExecutor.execute {
                val result = tts?.setLanguage(locale)
                if ((result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) &&
                    locale.language == "zh"
                ) {
                    tts?.setLanguage(Locale.TRADITIONAL_CHINESE)
                }
            }
        }

        @JavascriptInterface
        fun isE2E(): Boolean {
            return getSharedPreferences("shine_aac_config", Context.MODE_PRIVATE)
                .getBoolean("e2eEnabled", false)
        }

        @JavascriptInterface
        fun getInitialConfigJson(): String {
            val prefs = getSharedPreferences("shine_aac_config", Context.MODE_PRIVATE)
            if (!prefs.getBoolean("e2eEnabled", false)) return ""

            return JSONObject()
                .put("configVersion", prefs.getInt("configVersion", CurrentConfigVersion))
                .put("columns", prefs.getInt("columns", 4))
                .put("profileId", prefs.getString("profileId", "en-US"))
                .put("scanIntervalMs", prefs.getFloat("scanIntervalMs", DefaultScanIntervalMs).toDouble())
                .put("transitionPauseMs", prefs.getFloat("transitionPauseMs", DefaultTransitionPauseMs).toDouble())
                .put("firstCellPauseMs", prefs.getFloat("firstCellPauseMs", DefaultFirstCellPauseMs).toDouble())
                .put("inputLatencyCompensationMs", prefs.getFloat("inputLatencyCompensationMs", 250f).toDouble())
                .toString()
        }

        @JavascriptInterface
        fun getInitialUiConfigJson(): String {
            val prefs = getSharedPreferences("shine_aac_config", Context.MODE_PRIVATE)
            if (!prefs.getBoolean("e2eEnabled", false)) return ""

            return JSONObject()
                .put("rowScanVoice", prefs.getBoolean("rowScanVoice", false))
                .put("scanVoice", prefs.getBoolean("scanVoice", true))
                .put("activationVoice", prefs.getBoolean("activationVoice", true))
                .put("restartScanFromTop", prefs.getBoolean("restartScanFromTop", true))
                .put("switchInputProfile", prefs.getString("switchInputProfile", SwitchInputHardware))
                .put("hardwareButtons", prefs.getBoolean("hardwareButtons", true))
                .put("cameraSwitch", prefs.getBoolean("cameraSwitch", false))
                .put("holdAfterSuggestionChange", prefs.getBoolean("holdAfterSuggestionChange", true))
                .toString()
        }

        @JavascriptInterface
        fun setUiConfigJson(uiConfigJson: String) {
            val config = try {
                JSONObject(uiConfigJson)
            } catch (_: Exception) {
                JSONObject()
            }
            switchInputProfile = normalizedInputProfile(config)
            hardwareButtonsEnabled = hardwareEnabledForProfile(switchInputProfile)
            val nextCameraSwitchEnabled = cameraEnabledForProfile(switchInputProfile)
            if (nextCameraSwitchEnabled != cameraSwitchEnabled) {
                cameraSwitchEnabled = nextCameraSwitchEnabled
                if (cameraSwitchEnabled) {
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        cameraSwitchInput?.start()
                    } else {
                        requestPermissions(arrayOf(Manifest.permission.CAMERA), CameraPermissionRequestCode)
                    }
                } else {
                    cameraSwitchInput?.stop()
                }
            }
        }

        @JavascriptInterface
        fun openCameraSwitchCalibration(profileId: String) {
            val intent = Intent(this@MainActivity, CameraSwitchCalibrationActivity::class.java)
                .putExtra(CameraCalibrationProfileExtra, profileId)
            startActivity(intent)
        }

        @JavascriptInterface
        fun onRender(stateJson: String) {
            if (isE2E()) {
                Log.i("ShineAacE2E", "SHINE_AAC_E2E_STATE $stateJson")
            }
        }
    }

    private companion object {
        const val CameraPermissionRequestCode = 2403
        const val CameraCalibrationProfileExtra = "org.shineaac.inputs.PROFILE_ID"
        const val CurrentConfigVersion = 18
        const val DefaultScanIntervalMs = 1300f
        const val DefaultTransitionPauseMs = 0f
        const val DefaultFirstCellPauseMs = 1700f
        const val TabletSmallestWidthDp = 600
        const val SwitchInputOff = "off"
        const val SwitchInputHardware = "hardware-buttons"
        const val SwitchInputCameraLongBlink = "camera-long-blink"
        const val SwitchInputHardwareAndCamera = "hardware-and-camera"

        fun normalizedInputProfile(config: JSONObject): String {
            val requested = config.optString("switchInputProfile", "")
            return when (requested) {
                SwitchInputOff,
                SwitchInputHardware,
                SwitchInputCameraLongBlink,
                SwitchInputHardwareAndCamera -> requested
                else -> {
                    val hardware = config.optBoolean("hardwareButtons", true)
                    val camera = config.optBoolean("cameraSwitch", false)
                    when {
                        hardware && camera -> SwitchInputHardwareAndCamera
                        camera -> SwitchInputCameraLongBlink
                        hardware -> SwitchInputHardware
                        else -> SwitchInputOff
                    }
                }
            }
        }

        fun hardwareEnabledForProfile(profile: String): Boolean =
            profile == SwitchInputHardware || profile == SwitchInputHardwareAndCamera

        fun cameraEnabledForProfile(profile: String): Boolean =
            profile == SwitchInputCameraLongBlink || profile == SwitchInputHardwareAndCamera
    }
}
