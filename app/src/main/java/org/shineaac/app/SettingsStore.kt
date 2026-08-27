package org.shineaac.app

import android.content.Context
import android.content.SharedPreferences
import androidx.preference.PreferenceDataStore
import org.json.JSONObject

internal object SettingsStore {
    const val PreferencesName = "shine_aac_config"
    const val ChoicesKey = "nativeSettingsChoices"
    const val SourceProfileKey = "nativeSettingsSourceProfile"
    const val ProfileContentsKey = "nativeSettingsProfileContents"
    const val TimingPresetsKey = "nativeSettingsTimingPresets"

    private val integerKeys = setOf("configVersion", "columns", "scanPassLimit")
    private val floatKeys = setOf(
        "scanIntervalMs",
        "transitionPauseMs",
        "firstCellPauseMs",
        "inputLatencyCompensationMs",
    )

    fun preferences(context: Context): SharedPreferences =
        context.getSharedPreferences(PreferencesName, Context.MODE_PRIVATE)

    fun importFromWeb(context: Context, configJson: String, uiConfigJson: String) {
        val config = parseObject(configJson)
        val uiConfig = parseObject(uiConfigJson)
        val editor = preferences(context).edit()

        putInt(editor, config, "configVersion", 28)
        putString(editor, config, "profileId", "en-US")
        editor.putString(SourceProfileKey, config.optString("profileId", "en-US"))
        putInt(editor, config, "columns", 4)
        putString(editor, config, "scanMode", "row-column")
        putString(editor, config, "scanTimingPreset", "custom")
        putFloat(editor, config, "scanIntervalMs", 1800f)
        putFloat(editor, config, "transitionPauseMs", 0f)
        putFloat(editor, config, "firstCellPauseMs", 1800f)
        putFloat(editor, config, "inputLatencyCompensationMs", 250f)
        putInt(editor, config, "scanPassLimit", 2)
        putBoolean(editor, config, "autoScanSuggestionPages", false)
        putBoolean(editor, config, "deferUnsupportedZhuyinOnFirstPass", false)
        putString(editor, config, "suggestionDictionary", "")
        putString(editor, config, "symbols", "")
        config.optJSONObject("choices")?.let { editor.putString(ChoicesKey, it.toString()) }
        config.optJSONObject("profileContents")?.let {
            editor.putString(ProfileContentsKey, it.toString().take(MaxStoredTextChars))
        }
        config.optJSONObject("timingPresets")?.let {
            editor.putString(TimingPresetsKey, it.toString().take(MaxStoredTextChars))
        }

        putBoolean(editor, uiConfig, "rowScanVoice", false)
        putBoolean(editor, uiConfig, "scanVoice", true)
        putBoolean(editor, uiConfig, "activationVoice", true)
        putString(editor, uiConfig, "speechVoiceName", "")
        putString(editor, uiConfig, "speechAfterReadMode", "replay")
        putBoolean(editor, uiConfig, "restartScanFromTop", true)
        putBoolean(editor, uiConfig, "verticalGroupProgress", false)
        putBoolean(editor, uiConfig, "holdToAdvance", false)
        putString(editor, uiConfig, "idleTimeoutMinutes", "5")
        putString(editor, uiConfig, "switchInputProfile", "hardware-buttons")
        putString(editor, uiConfig, "contrastTheme", "system")
        editor.apply()
    }

    fun configJson(context: Context): String {
        val prefs = preferences(context)
        return JSONObject()
            .put("configVersion", intValue(prefs, "configVersion", 28))
            .put("profileId", stringValue(prefs, "profileId", "en-US"))
            .put("sourceProfileId", stringValue(prefs, SourceProfileKey, "en-US"))
            .put("columns", intValue(prefs, "columns", 4))
            .put("scanMode", stringValue(prefs, "scanMode", "row-column"))
            .put("scanTimingPreset", stringValue(prefs, "scanTimingPreset", "custom"))
            .put("scanIntervalMs", floatValue(prefs, "scanIntervalMs", 1800f).toDouble())
            .put("transitionPauseMs", floatValue(prefs, "transitionPauseMs", 0f).toDouble())
            .put("firstCellPauseMs", floatValue(prefs, "firstCellPauseMs", 1800f).toDouble())
            .put(
                "inputLatencyCompensationMs",
                floatValue(prefs, "inputLatencyCompensationMs", 250f).toDouble(),
            )
            .put("scanPassLimit", intValue(prefs, "scanPassLimit", 2))
            .put("autoScanSuggestionPages", booleanValue(prefs, "autoScanSuggestionPages", false))
            .put(
                "deferUnsupportedZhuyinOnFirstPass",
                booleanValue(prefs, "deferUnsupportedZhuyinOnFirstPass", false),
            )
            .put("suggestionDictionary", stringValue(prefs, "suggestionDictionary", ""))
            .put("symbols", stringValue(prefs, "symbols", ""))
            .toString()
    }

    fun uiConfigJson(context: Context): String {
        val prefs = preferences(context)
        return JSONObject()
            .put("uiConfigVersion", 1)
            .put("rowScanVoice", booleanValue(prefs, "rowScanVoice", false))
            .put("scanVoice", booleanValue(prefs, "scanVoice", true))
            .put("activationVoice", booleanValue(prefs, "activationVoice", true))
            .put("speechVoiceName", stringValue(prefs, "speechVoiceName", ""))
            .put("speechAfterReadMode", stringValue(prefs, "speechAfterReadMode", "replay"))
            .put("restartScanFromTop", booleanValue(prefs, "restartScanFromTop", true))
            .put("verticalGroupProgress", booleanValue(prefs, "verticalGroupProgress", false))
            .put("holdToAdvance", booleanValue(prefs, "holdToAdvance", false))
            .put(
                "idleTimeoutMinutes",
                stringValue(prefs, "idleTimeoutMinutes", "5").toIntOrNull() ?: 5,
            )
            .put("switchInputProfile", stringValue(prefs, "switchInputProfile", "hardware-buttons"))
            .put("contrastTheme", stringValue(prefs, "contrastTheme", "system"))
            .toString()
    }

    fun stringValue(context: Context, key: String, defaultValue: String): String =
        stringValue(preferences(context), key, defaultValue)

    fun putString(context: Context, key: String, value: String?) {
        val editor = preferences(context).edit()
        when (key) {
            in integerKeys -> editor.putInt(key, value?.toIntOrNull() ?: 0)
            in floatKeys -> editor.putFloat(key, value?.toFloatOrNull() ?: 0f)
            else -> editor.putString(key, value.orEmpty().take(MaxStoredTextChars))
        }
        editor.apply()
    }

    fun getString(context: Context, key: String, defaultValue: String?): String? {
        val raw = preferences(context).all[key] ?: return defaultValue
        return raw.toString()
    }

    fun putBoolean(context: Context, key: String, value: Boolean) {
        preferences(context).edit().putBoolean(key, value).apply()
    }

    fun getBoolean(context: Context, key: String, defaultValue: Boolean): Boolean =
        booleanValue(preferences(context), key, defaultValue)

    private fun parseObject(value: String): JSONObject = try {
        JSONObject(value)
    } catch (_: Exception) {
        JSONObject()
    }

    private fun putString(
        editor: SharedPreferences.Editor,
        source: JSONObject,
        key: String,
        defaultValue: String,
    ) {
        editor.putString(key, source.optString(key, defaultValue).take(MaxStoredTextChars))
    }

    private fun putInt(
        editor: SharedPreferences.Editor,
        source: JSONObject,
        key: String,
        defaultValue: Int,
    ) {
        editor.putInt(key, source.optInt(key, defaultValue))
    }

    private fun putFloat(
        editor: SharedPreferences.Editor,
        source: JSONObject,
        key: String,
        defaultValue: Float,
    ) {
        editor.putFloat(key, source.optDouble(key, defaultValue.toDouble()).toFloat())
    }

    private fun putBoolean(
        editor: SharedPreferences.Editor,
        source: JSONObject,
        key: String,
        defaultValue: Boolean,
    ) {
        editor.putBoolean(key, source.optBoolean(key, defaultValue))
    }

    private fun stringValue(prefs: SharedPreferences, key: String, defaultValue: String): String =
        prefs.all[key]?.toString() ?: defaultValue

    private fun intValue(prefs: SharedPreferences, key: String, defaultValue: Int): Int =
        when (val raw = prefs.all[key]) {
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull() ?: defaultValue
            else -> defaultValue
        }

    private fun floatValue(prefs: SharedPreferences, key: String, defaultValue: Float): Float =
        when (val raw = prefs.all[key]) {
            is Number -> raw.toFloat()
            is String -> raw.toFloatOrNull() ?: defaultValue
            else -> defaultValue
        }

    private fun booleanValue(
        prefs: SharedPreferences,
        key: String,
        defaultValue: Boolean,
    ): Boolean = when (val raw = prefs.all[key]) {
        is Boolean -> raw
        is String -> raw.toBooleanStrictOrNull() ?: defaultValue
        else -> defaultValue
    }

    private const val MaxStoredTextChars = 500_000
}

internal class SettingsPreferenceDataStore(context: Context) : PreferenceDataStore() {
    private val appContext = context.applicationContext

    override fun putString(key: String, value: String?) {
        SettingsStore.putString(appContext, key, value)
    }

    override fun getString(key: String, defValue: String?): String? =
        SettingsStore.getString(appContext, key, defValue)

    override fun putBoolean(key: String, value: Boolean) {
        SettingsStore.putBoolean(appContext, key, value)
    }

    override fun getBoolean(key: String, defValue: Boolean): Boolean =
        SettingsStore.getBoolean(appContext, key, defValue)
}
