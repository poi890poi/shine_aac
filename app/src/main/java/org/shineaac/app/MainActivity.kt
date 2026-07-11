package org.shineaac.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import org.shineaac.inputs.CameraSwitchInputAdapter
import org.shineaac.inputs.CameraSwitchSettings
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
    private var cameraSwitchInput: CameraSwitchInputAdapter? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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
        setContentView(shineWebView)

        cameraSwitchInput = CameraSwitchInputAdapter(
            context = this,
            settingsProvider = {
                CameraSwitchSettings(enabled = cameraSwitchEnabled)
            },
            sink = InputSink { event ->
                sendInputIntent(event.source, null)
            }
        )
    }

    override fun onBackPressed() {
        val view = webView
        if (view?.canGoBack() == true) {
            view.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (!isHardwareActivationKey(event.keyCode)) {
            return super.dispatchKeyEvent(event)
        }

        if (!hardwareButtonsEnabled) {
            return super.dispatchKeyEvent(event)
        }

        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            sendInputIntent(sourceForKey(event.keyCode), event.keyCode)
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

    private fun sendInputIntent(source: String, keyCode: Int?) {
        val script = """
            window.ShineAacInput &&
            window.ShineAacInput.receive({intent:"activate",source:"$source"${keyCode?.let { ",keyCode:$it" } ?: ""}});
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
            hardwareButtonsEnabled = config.optBoolean("hardwareButtons", true)
            val nextCameraSwitchEnabled = config.optBoolean("cameraSwitch", false)
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
        fun onRender(stateJson: String) {
            if (isE2E()) {
                Log.i("ShineAacE2E", "SHINE_AAC_E2E_STATE $stateJson")
            }
        }
    }

    private companion object {
        const val CameraPermissionRequestCode = 2403
    }
}
