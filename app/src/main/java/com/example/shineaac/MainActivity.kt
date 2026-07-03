package com.example.shineaac

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
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

    override fun onDestroy() {
        webView?.destroy()
        webView = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
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
                .put("scanIntervalMs", prefs.getFloat("scanIntervalMs", 900f).toDouble())
                .put("transitionPauseMs", prefs.getFloat("transitionPauseMs", 0f).toDouble())
                .put("firstCellPauseMs", prefs.getFloat("firstCellPauseMs", 900f).toDouble())
                .put("inputLatencyCompensationMs", prefs.getFloat("inputLatencyCompensationMs", 250f).toDouble())
                .toString()
        }

        @JavascriptInterface
        fun onRender(stateJson: String) {
            if (isE2E()) {
                Log.i("ShineAacE2E", "SHINE_AAC_E2E_STATE $stateJson")
            }
        }
    }
}
