package org.shineaac.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
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
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.shineaac.inputs.CameraSwitchCalibrationActivity
import org.shineaac.inputs.CameraSwitchInputAdapter
import org.shineaac.inputs.CameraSwitchPreferences
import org.shineaac.inputs.InputEvent
import org.shineaac.inputs.InputSink
import org.json.JSONObject
import org.json.JSONArray
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private lateinit var moeBopomofoVoicePack: TaiwanVoicePack
    private val ttsExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    @Volatile private var preferredSpeechVoiceName = MoeBopomofoVoiceName
    @Volatile private var hardwareButtonsEnabled = true
    @Volatile private var cameraSwitchEnabled = false
    @Volatile private var switchInputProfile = SwitchInputHardware
    private var webBackNavigationPending = false
    private var cameraSwitchInput: CameraSwitchInputAdapter? = null
    private var pendingTextHistoryExport: String? = null
    private var pendingTextHistoryExportFileName: String? = null
    private var lastTextHistoryExportUri: Uri? = null
    private val textHistoryDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri ->
        val exportText = pendingTextHistoryExport
        val suggestedFileName = pendingTextHistoryExportFileName ?: "saytome-aac-text-history.txt"
        pendingTextHistoryExport = null
        pendingTextHistoryExportFileName = null
        if (uri == null || exportText == null) return@registerForActivityResult

        try {
            val outputStream = contentResolver.openOutputStream(uri, "wt")
                ?: error("The selected document could not be opened for writing")
            outputStream.use { output ->
                output.writer(Charsets.UTF_8).use { writer ->
                    writer.write(exportText)
                }
            }
            lastTextHistoryExportUri = uri
            notifyTextExportResult(
                success = true,
                fileName = textExportDisplayName(uri, suggestedFileName),
                canOpen = true,
            )
        } catch (error: Exception) {
            Log.e("ShineAacExport", "Could not save text history", error)
            notifyTextExportResult(
                success = false,
                fileName = suggestedFileName,
                canOpen = false,
                message = "文字檔沒有儲存，請返回設定後再試一次。",
            )
        }
    }
    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted && cameraSwitchEnabled) {
            cameraSwitchInput?.start()
        } else if (!granted) {
            sendCameraPermissionDenied()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyOrientationPolicy()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        moeBopomofoVoicePack = TaiwanVoicePack(
            this,
            "voice-packs/moe-bopomofo/manifest.json",
        )

        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.getDefault()
            }
            notifySpeechVoicesChanged()
        }

        val shineWebView = WebView(this).apply {
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.textZoom = webTextZoomPercent(resources.configuration.fontScale)
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            addJavascriptInterface(AndroidSpeechBridge(), "ShineAacAndroid")
            loadUrl("file:///android_asset/www/apps/web/index.html")
        }

        webView = shineWebView
        setContentView(createInsetAwareWebViewHost(shineWebView))
        installBackNavigation()

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
                // The native host owns system-bar and cutout clearance. Consuming the
                // insets prevents WebView from exposing the same space to CSS safe-area
                // variables and applying it a second time on some vendor WebViews.
                WindowInsetsCompat.CONSUMED
            }
            ViewCompat.requestApplyInsets(this)
        }
    }

    private fun installBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val view = webView ?: return
                if (webBackNavigationPending) return

                webBackNavigationPending = true
                view.evaluateJavascript(
                    "Boolean(globalThis.ShineAacNavigation?.back?.())"
                ) { handledResult ->
                    webBackNavigationPending = false
                    if (handledResult == "true") return@evaluateJavascript
                    if (view.canGoBack()) {
                        view.goBack()
                        return@evaluateJavascript
                    }

                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        notifySpeechVoicesChanged()
        if (cameraSwitchEnabled && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            cameraSwitchInput?.start()
        }
    }

    private fun notifySpeechVoicesChanged() {
        webView?.post {
            webView?.evaluateJavascript("globalThis.ShineAacSpeechVoices?.refresh?.()", null)
        }
    }

    private fun textExportDisplayName(uri: Uri, fallback: String): String = try {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) cursor.getString(nameIndex) else null
        }?.takeIf { it.isNotBlank() } ?: fallback
    } catch (_: Exception) {
        fallback
    }

    private fun notifyTextExportResult(
        success: Boolean,
        fileName: String,
        canOpen: Boolean,
        message: String = "",
    ) {
        val payload = JSONObject()
            .put("fileName", fileName)
            .put("canOpen", canOpen)
            .put("message", message)
            .toString()
        val callback = if (success) "completed" else "failed"
        val javascript = "globalThis.ShineAacTextExport?.$callback?.(${JSONObject.quote(payload)})"
        webView?.post {
            webView?.evaluateJavascript(javascript, null)
        }
    }

    override fun onPause() {
        cameraSwitchInput?.stop()
        super.onPause()
    }

    @SuppressLint("RestrictedApi")
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val source = hardwareActivationSource(event.keyCode)
        if (source == null) {
            return super.dispatchKeyEvent(event)
        }

        if (!hardwareButtonsEnabled) {
            return super.dispatchKeyEvent(event)
        }

        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            sendInputEvent(
                InputEvent(
                    intent = "activate",
                    source = source,
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
        moeBopomofoVoicePack.close()
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

    private fun sendInputEvent(event: InputEvent, keyCode: Int? = null) {
        val payload = JSONObject()
            .put("intent", event.intent)
            .put("source", event.source)
        if (event.detail.isNotBlank()) payload.put("detail", event.detail)
        if (keyCode != null) payload.put("keyCode", keyCode)
        if (getSharedPreferences("shine_aac_config", Context.MODE_PRIVATE)
                .getBoolean("e2eEnabled", false)
        ) {
            Log.i(E2ELogTag, "SHINE_AAC_E2E_INPUT $payload")
        }
        val script = """
            window.ShineAacInput &&
            window.ShineAacInput.receive($payload);
        """.trimIndent()
        runOnUiThread {
            webView?.evaluateJavascript(script, null)
        }
    }

    private fun sendCameraPermissionDenied() {
        sendInputEvent(
            InputEvent(
                intent = "cameraStatus",
                source = "android-camera-long-blink",
                detail = "state=permissionDenied"
            )
        )
    }

    inner class AndroidSpeechBridge {
        @JavascriptInterface
        fun speak(text: String) {
            val spoken = text.trim()
            if (spoken.isEmpty()) return
            if (preferredSpeechVoiceName == MoeBopomofoVoiceName) {
                if (moeBopomofoVoicePack.play(spoken)) {
                    Log.i("ShineAacVoicePack", "Using official Bopomofo playback route")
                    ttsExecutor.execute { tts?.stop() }
                    return
                }
            }
            moeBopomofoVoicePack.stop()
            if (!ttsReady) return
            ttsExecutor.execute {
                tts?.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "shine-aac-message")
            }
        }

        @JavascriptInterface
        fun speakZhuyin(text: String) {
            val spoken = text.trim()
            if (spoken.isEmpty()) return
            if (preferredSpeechVoiceName == MoeBopomofoVoiceName) {
                if (moeBopomofoVoicePack.play(spoken)) {
                    Log.i("ShineAacVoicePack", "Using official Bopomofo playback route")
                    ttsExecutor.execute { tts?.stop() }
                    return
                }
            }
            speak(spoken)
        }

        @JavascriptInterface
        fun setSpeechLocale(languageTag: String) {
            if (!ttsReady || languageTag.isBlank()) return
            val locale = Locale.forLanguageTag(languageTag)
            ttsExecutor.execute {
                val engine = tts ?: return@execute
                val preferredVoice = if (isTaiwanMandarin(locale)) {
                    engine.voices.orEmpty().firstOrNull {
                        it.name == preferredSpeechVoiceName && isTaiwanMandarin(it.locale)
                    }
                } else {
                    null
                }
                if (preferredVoice != null) {
                    engine.voice = preferredVoice
                    return@execute
                }

                val result = engine.setLanguage(locale)
                if ((result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) &&
                    locale.language == "zh"
                ) {
                    engine.setLanguage(Locale.TRADITIONAL_CHINESE)
                }
            }
        }

        @JavascriptInterface
        fun getSpeechVoicesJson(): String {
            val engine = tts
            if (!moeBopomofoVoicePack.available &&
                (!ttsReady || engine == null)
            ) {
                return JSONObject().put("ready", false).put("voices", JSONArray()).toString()
            }

            val voices = if (ttsReady && engine != null) try {
                engine.voices.orEmpty()
                    .filter { isTaiwanMandarin(it.locale) }
                    .sortedBy { it.name }
            } catch (_: Exception) {
                emptyList()
            } else {
                emptyList()
            }
            val items = JSONArray()
            if (moeBopomofoVoicePack.available) {
                items.put(
                    JSONObject()
                        .put("name", MoeBopomofoVoiceName)
                        .put("displayName", "教育部人聲注音")
                        .put("providerName", "教育部＋裝置語音")
                        .put("extraDetail", "注音符號用教育部 · 其他文字用裝置語音")
                        .put("license", "CC BY 4.0")
                        .put("builtIn", true)
                        .put("networkRequired", false)
                        .put("downloadRequired", false)
                        .put("quality", 400)
                        .put("latency", 100)
                        .put("features", JSONArray(listOf("style=官方人聲")))
                )
            }
            voices.forEach { voice ->
                items.put(
                    JSONObject()
                        .put("name", voice.name)
                        .put("networkRequired", voice.isNetworkConnectionRequired)
                        .put(
                            "downloadRequired",
                            voice.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
                        )
                        .put("quality", voice.quality)
                        .put("latency", voice.latency)
                        .put("features", JSONArray(voice.features.orEmpty().sorted()))
                )
            }
            val systemLanguageAvailable =
                engine != null &&
                    ttsReady &&
                    engine.isLanguageAvailable(Locale.forLanguageTag("zh-TW")) >= TextToSpeech.LANG_AVAILABLE
            return JSONObject()
                .put("ready", true)
                .put(
                    "languageAvailable",
                    moeBopomofoVoicePack.available ||
                        systemLanguageAvailable
                )
                .put("systemLanguageAvailable", systemLanguageAvailable)
                .put("enginePackage", engine?.defaultEngine.orEmpty())
                .put(
                    "engineLabel",
                    engine?.engines?.firstOrNull { it.name == engine.defaultEngine }?.label
                        ?: engine?.defaultEngine
                        ?: "Android TTS"
                )
                .put(
                    "selectedVoiceName",
                    preferredSpeechVoiceName.ifBlank {
                        if (moeBopomofoVoicePack.available) MoeBopomofoVoiceName else AndroidSystemVoiceName
                    }
                )
                .put("voices", items)
                .toString()
        }

        @JavascriptInterface
        fun previewSpeechVoice(voiceName: String) {
            if (voiceName == MoeBopomofoVoiceName) {
                ttsExecutor.execute { tts?.stop() }
                moeBopomofoVoicePack.playPreview()
                return
            }
            if (!ttsReady) return
            moeBopomofoVoicePack.stop()
            ttsExecutor.execute {
                val engine = tts ?: return@execute
                val locale = Locale.forLanguageTag("zh-TW")
                val selected = if (voiceName.isBlank() || voiceName == AndroidSystemVoiceName) {
                    null
                } else {
                    engine.voices.orEmpty().firstOrNull {
                        it.name == voiceName && isTaiwanMandarin(it.locale)
                    } ?: return@execute
                }
                val previousVoice = engine.voice
                val selectionResult = if (selected != null) {
                    engine.setVoice(selected)
                } else {
                    engine.setLanguage(locale)
                }
                // setVoice() returns SUCCESS (0), while setLanguage() can return
                // LANG_AVAILABLE, LANG_COUNTRY_AVAILABLE, or
                // LANG_COUNTRY_VAR_AVAILABLE (all non-negative success results).
                if (selectionResult >= TextToSpeech.LANG_AVAILABLE) {
                    engine.speak(SpeechPreviewText, TextToSpeech.QUEUE_FLUSH, null, "shine-aac-voice-preview")
                }
                if (previousVoice != null) engine.voice = previousVoice
            }
        }

        @JavascriptInterface
        fun downloadSpeechVoice(voiceName: String) {
            if (voiceName == MoeBopomofoVoiceName) return
            if (voiceName.isBlank()) {
                installSpeechData()
                return
            }
            if (!ttsReady) return
            ttsExecutor.execute {
                val engine = tts ?: return@execute
                val selected = engine.voices.orEmpty().firstOrNull {
                    it.name == voiceName && isTaiwanMandarin(it.locale)
                } ?: return@execute

                // Android asks the active TTS engine to fetch missing voice data when
                // a voice carrying KEY_FEATURE_NOT_INSTALLED is selected.
                engine.setVoice(selected)
                // Do not immediately restore the previous voice: that can cancel the
                // engine's asynchronous download trigger. Normal AAC speech calls
                // setSpeechLocale first, which reapplies the user's saved voice.
            }
        }

        @JavascriptInterface
        fun installSpeechData() {
            runOnUiThread {
                val engineInstallIntent = Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).apply {
                    tts?.defaultEngine?.takeIf { it.isNotBlank() }?.let(::setPackage)
                }
                val intent = listOf(
                    engineInstallIntent,
                    Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA),
                    Intent("com.android.settings.TTS_SETTINGS")
                ).firstOrNull { it.resolveActivity(packageManager) != null }
                if (intent != null) startActivity(intent)
            }
        }

        @JavascriptInterface
        fun openSpeechSettings() {
            runOnUiThread {
                val intent = listOf(
                    Intent("com.android.settings.TTS_SETTINGS"),
                    Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)
                ).firstOrNull { it.resolveActivity(packageManager) != null }
                if (intent != null) startActivity(intent)
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
                .put("columns", prefs.getInt("columns", 6))
                .put("profileId", prefs.getString("profileId", "en-US"))
                .put("scanIntervalMs", prefs.getFloat("scanIntervalMs", DefaultScanIntervalMs).toDouble())
                .put("transitionPauseMs", prefs.getFloat("transitionPauseMs", DefaultTransitionPauseMs).toDouble())
                .put("firstCellPauseMs", prefs.getFloat("firstCellPauseMs", DefaultFirstCellPauseMs).toDouble())
                .put("inputLatencyCompensationMs", prefs.getFloat("inputLatencyCompensationMs", 250f).toDouble())
                .put("scanPassLimit", prefs.getInt("scanPassLimit", DefaultScanPassLimit))
                .toString()
        }

        @JavascriptInterface
        fun getInitialUiConfigJson(): String {
            val prefs = getSharedPreferences("shine_aac_config", Context.MODE_PRIVATE)
            if (!prefs.getBoolean("e2eEnabled", false)) return ""

            return JSONObject()
                .put("uiConfigVersion", 1)
                .put("rowScanVoice", prefs.getBoolean("rowScanVoice", false))
                .put("scanVoice", prefs.getBoolean("scanVoice", true))
                .put("activationVoice", prefs.getBoolean("activationVoice", true))
                .put(
                    "speechVoiceName",
                    normalizedSpeechVoiceName(prefs.getString("speechVoiceName", "")),
                )
                .put("restartScanFromTop", prefs.getBoolean("restartScanFromTop", true))
                .put("switchInputProfile", prefs.getString("switchInputProfile", SwitchInputHardware))
                .put("hardwareButtons", prefs.getBoolean("hardwareButtons", true))
                .put("cameraSwitch", prefs.getBoolean("cameraSwitch", false))
                .toString()
        }

        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun getAppInfoJson(): String {
            val packageInfo = packageManager.getPackageInfo(packageName, 0)
            return JSONObject()
                .put("appName", getString(R.string.app_name))
                .put("versionName", packageInfo.versionName.orEmpty())
                .put("versionCode", packageInfo.versionCode)
                .toString()
        }

        @JavascriptInterface
        fun getSessionDraftJson(): String =
            getSharedPreferences(SessionDraftPreferences, Context.MODE_PRIVATE)
                .getString(SessionDraftKey, "")
                .orEmpty()

        @JavascriptInterface
        fun saveSessionDraftJson(value: String): Boolean {
            if (value.length > MaxSessionDraftJsonChars) return false
            return getSharedPreferences(SessionDraftPreferences, Context.MODE_PRIVATE)
                .edit()
                .putString(SessionDraftKey, value)
                .commit()
        }

        @JavascriptInterface
        fun clearSessionDraft() {
            getSharedPreferences(SessionDraftPreferences, Context.MODE_PRIVATE)
                .edit()
                .remove(SessionDraftKey)
                .commit()
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            val uri = try {
                Uri.parse(url)
            } catch (_: Exception) {
                return
            }
            if (uri.scheme != "https" || uri.host !in ExternalLinkHosts) return
            runOnUiThread {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
        }

        @JavascriptInterface
        fun setUiConfigJson(uiConfigJson: String) {
            val config = try {
                JSONObject(uiConfigJson)
            } catch (_: Exception) {
                JSONObject()
            }
            val nextInputProfile = normalizedInputProfile(config)
            preferredSpeechVoiceName = normalizedSpeechVoiceName(
                config.optString("speechVoiceName", "").take(200),
            )
            runOnUiThread {
                switchInputProfile = nextInputProfile
                hardwareButtonsEnabled = hardwareEnabledForProfile(switchInputProfile)
                val nextCameraSwitchEnabled = cameraEnabledForProfile(switchInputProfile)
                if (nextCameraSwitchEnabled != cameraSwitchEnabled) {
                    cameraSwitchEnabled = nextCameraSwitchEnabled
                    if (cameraSwitchEnabled) {
                        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            cameraSwitchInput?.start()
                        } else {
                            sendCameraPermissionDenied()
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    } else {
                        cameraSwitchInput?.stop()
                    }
                }
            }
        }

        @JavascriptInterface
        fun openCameraSwitchCalibration(profileId: String) {
            runOnUiThread {
                val intent = Intent(this@MainActivity, CameraSwitchCalibrationActivity::class.java)
                    .putExtra(CameraCalibrationProfileExtra, profileId)
                startActivity(intent)
            }
        }

        @JavascriptInterface
        fun exportTextHistory(text: String, suggestedFileName: String) {
            val exportText = text.take(MaxTextHistoryExportChars)
            val fileName = suggestedFileName
                .replace(Regex("[^A-Za-z0-9._-]"), "-")
                .take(120)
                .let { if (it.endsWith(".txt", ignoreCase = true)) it else "$it.txt" }
            runOnUiThread {
                pendingTextHistoryExport = exportText
                pendingTextHistoryExportFileName = fileName
                textHistoryDocumentLauncher.launch(fileName)
            }
        }

        @JavascriptInterface
        fun openLastTextExport() {
            runOnUiThread {
                val uri = lastTextHistoryExportUri ?: return@runOnUiThread
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "text/plain")
                    clipData = ClipData.newRawUri("exported text", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    startActivity(intent)
                } catch (error: ActivityNotFoundException) {
                    Log.w("ShineAacExport", "No app can open the exported text file", error)
                    notifyTextExportResult(
                        success = false,
                        fileName = textExportDisplayName(uri, "saytome-aac-text-history.txt"),
                        canOpen = false,
                        message = "找不到可開啟文字檔的應用程式。檔案仍然已儲存。",
                    )
                }
            }
        }

        @JavascriptInterface
        fun onRender(stateJson: String) {
            if (isE2E()) {
                Log.i(E2ELogTag, "SHINE_AAC_E2E_STATE $stateJson")
            }
        }
    }

    private companion object {
        const val CameraCalibrationProfileExtra = "org.shineaac.inputs.PROFILE_ID"
        const val CurrentConfigVersion = 26
        const val DefaultScanIntervalMs = 1800f
        const val DefaultTransitionPauseMs = 0f
        const val DefaultFirstCellPauseMs = DefaultScanIntervalMs
        const val DefaultScanPassLimit = 2
        const val MaxTextHistoryExportChars = 500_000
        const val MaxSessionDraftJsonChars = 100_000
        const val SessionDraftPreferences = "shine_aac_session_draft"
        const val SessionDraftKey = "current"
        const val MoeBopomofoVoiceName = "shine-aac-moe-bopomofo"
        const val AndroidSystemVoiceName = "android-system-default"
        const val SpeechPreviewText = "你好，我想喝水。"
        const val E2ELogTag = "ShineAacE2E"
        const val TabletSmallestWidthDp = 600
        const val SwitchInputOff = "off"
        const val SwitchInputHardware = "hardware-buttons"
        const val SwitchInputCameraLongBlink = "camera-long-blink"
        const val SwitchInputHardwareAndCamera = "hardware-and-camera"
        val ExternalLinkHosts = setOf("github.com", "poi890poi.github.io")

        fun isTaiwanMandarin(locale: Locale): Boolean =
            (locale.language.equals("zh", ignoreCase = true) ||
                locale.language.equals("cmn", ignoreCase = true)) &&
                locale.country.equals("TW", ignoreCase = true)

        fun normalizedSpeechVoiceName(value: String?): String =
            value.orEmpty().ifBlank { MoeBopomofoVoiceName }

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

internal fun webTextZoomPercent(fontScale: Float): Int =
    (fontScale * 100f).roundToInt().coerceIn(50, 200)

internal fun hardwareActivationSource(keyCode: Int): String? = when (keyCode) {
    KeyEvent.KEYCODE_CAMERA -> "android-hardware-camera"
    KeyEvent.KEYCODE_HEADSETHOOK -> "android-media-headset"
    KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "android-media-play-pause"
    KeyEvent.KEYCODE_MEDIA_PLAY -> "android-media-play"
    KeyEvent.KEYCODE_MEDIA_PAUSE -> "android-media-pause"
    KeyEvent.KEYCODE_BUTTON_A -> "android-hardware-button-a"
    KeyEvent.KEYCODE_BUTTON_SELECT -> "android-hardware-button-select"
    KeyEvent.KEYCODE_BUTTON_START -> "android-hardware-button-start"
    else -> null
}
