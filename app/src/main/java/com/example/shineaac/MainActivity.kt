package com.example.shineaac

import android.annotation.SuppressLint
import android.content.Context
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
import org.json.JSONObject
import java.util.Locale

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    @Volatile private var hardwareButtonsEnabled = true

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
        webView?.destroy()
        webView = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
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

    private fun sendInputIntent(source: String, keyCode: Int) {
        val script = """
            window.ShineAacInput &&
            window.ShineAacInput.receive({intent:"activate",source:"$source",keyCode:$keyCode});
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
            runOnUiThread {
                tts?.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "shine-aac-message")
            }
        }

        @JavascriptInterface
        fun setSpeechLocale(languageTag: String) {
            if (!ttsReady || languageTag.isBlank()) return
            val locale = Locale.forLanguageTag(languageTag)
            runOnUiThread {
                tts?.setLanguage(locale)
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
                .put("columns", prefs.getInt("columns", 4))
                .put("profileId", prefs.getString("profileId", "en-US"))
                .put("scanIntervalMs", prefs.getFloat("scanIntervalMs", 900f).toDouble())
                .put("transitionPauseMs", prefs.getFloat("transitionPauseMs", 0f).toDouble())
                .put("firstCellPauseMs", prefs.getFloat("firstCellPauseMs", 900f).toDouble())
                .put("inputLatencyCompensationMs", prefs.getFloat("inputLatencyCompensationMs", 250f).toDouble())
                .toString()
        }

        @JavascriptInterface
        fun getInitialUiConfigJson(): String {
            val prefs = getSharedPreferences("shine_aac_config", Context.MODE_PRIVATE)
            if (!prefs.getBoolean("e2eEnabled", false)) return ""

            return JSONObject()
                .put("scanVoice", prefs.getBoolean("scanVoice", true))
                .put("activationVoice", prefs.getBoolean("activationVoice", true))
                .put("restartScanFromTop", prefs.getBoolean("restartScanFromTop", true))
                .put("hardwareButtons", prefs.getBoolean("hardwareButtons", true))
                .toString()
        }

        @JavascriptInterface
        fun setUiConfigJson(uiConfigJson: String) {
            hardwareButtonsEnabled = try {
                JSONObject(uiConfigJson).optBoolean("hardwareButtons", true)
            } catch (_: Exception) {
                true
            }
        }

        @JavascriptInterface
        fun onRender(stateJson: String) {
            if (isE2E()) {
                Log.i("ShineAacE2E", "SHINE_AAC_E2E_STATE $stateJson")
            }
        }
    }
}
