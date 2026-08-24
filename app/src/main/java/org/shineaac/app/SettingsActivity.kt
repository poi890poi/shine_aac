package org.shineaac.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.text.InputType
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.pm.PackageInfoCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.preference.EditTextPreference
import androidx.preference.ListPreference
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import org.json.JSONArray
import org.json.JSONObject
import org.shineaac.inputs.CameraSwitchCalibrationActivity
import java.util.Locale

class SettingsActivity : AppCompatActivity(),
    PreferenceFragmentCompat.OnPreferenceStartFragmentCallback {

    override fun attachBaseContext(newBase: Context) {
        val profileId = SettingsStore.stringValue(newBase, "profileId", "en-US")
        val locale = Locale.forLanguageTag(profileId)
        val configuration = Configuration(newBase.resources.configuration).apply {
            setLocale(locale)
        }
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_OK)
        setContentView(R.layout.activity_settings)

        val toolbar = findViewById<Toolbar>(R.id.settings_toolbar)
        toolbar.title = getString(R.string.settings_title)
        toolbar.setNavigationIcon(R.drawable.ic_arrow_back)
        toolbar.navigationContentDescription = getString(R.string.settings_back)
        toolbar.setNavigationOnClickListener { onBackPressedDispatcher.onBackPressed() }
        supportFragmentManager.addOnBackStackChangedListener {
            if (supportFragmentManager.backStackEntryCount == 0) {
                toolbar.title = getString(R.string.settings_title)
            }
        }

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.settings_container)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, 0, bars.right, bars.bottom)
            insets
        }

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.settings_container, MainSettingsPreferenceFragment())
                .commit()
        }
    }

    override fun onPreferenceStartFragment(
        caller: PreferenceFragmentCompat,
        preference: Preference,
    ): Boolean {
        val fragmentName = preference.fragment ?: return false
        val fragment = supportFragmentManager.fragmentFactory.instantiate(classLoader, fragmentName)
        fragment.arguments = preference.extras
        findViewById<Toolbar>(R.id.settings_toolbar).title = preference.title
        supportFragmentManager.beginTransaction()
            .replace(R.id.settings_container, fragment)
            .addToBackStack(preference.key)
            .commit()
        return true
    }

    internal fun finishWithAction(action: String) {
        setResult(
            Activity.RESULT_OK,
            Intent().putExtra(ResultActionExtra, action),
        )
        finish()
    }

    internal fun showAbout() {
        @Suppress("DEPRECATION")
        val packageInfo = packageManager.getPackageInfo(packageName, 0)
        val versionName = packageInfo.versionName.orEmpty()
        val versionCode = PackageInfoCompat.getLongVersionCode(packageInfo)
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.settings_app_info))
            .setMessage(getString(R.string.settings_about_message, versionName, versionCode))
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    internal fun confirmReset() {
        AlertDialog.Builder(this)
            .setTitle(R.string.settings_reset_question)
            .setMessage(R.string.settings_reset_message)
            .setNegativeButton(R.string.settings_cancel, null)
            .setPositiveButton(R.string.settings_reset_confirm) { _, _ ->
                finishWithAction(ActionReset)
            }
            .show()
    }

    companion object {
        const val ResultActionExtra = "org.shineaac.app.SETTINGS_ACTION"
        const val ActionInputTest = "input-test"
        const val ActionExportText = "export-text"
        const val ActionReset = "reset"
    }
}

class MainSettingsPreferenceFragment : PreferenceFragmentCompat() {
    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        preferenceManager.preferenceDataStore = SettingsPreferenceDataStore(requireContext())
        setPreferencesFromResource(R.xml.root_preferences, rootKey)

        configureList("profileId")
        configureList("scanMode")
        configureList("scanTimingPreset")
        configureList("scanPassLimit")
        configureList("speechAfterReadMode")
        configureList("switchInputProfile")
        configureList("contrastTheme")
        configureNumericEditor("columns")
        configureLargeTextEditor("suggestionDictionary", R.string.settings_dictionary_summary)
        configureLargeTextEditor("symbols", R.string.settings_symbols_summary)
        configureProfileVisibility(currentProfileId())
        configureActions()
    }

    override fun onResume() {
        super.onResume()
        findPreference<ListPreference>("scanTimingPreset")?.value =
            SettingsStore.getString(requireContext(), "scanTimingPreset", "custom") ?: "custom"
        findPreference<Preference>("speechVoiceName")?.summary = selectedVoiceSummary()
    }

    private fun configureActions() {
        findPreference<Preference>("profileId")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, nextValue ->
                val nextProfileId = nextValue?.toString() ?: "en-US"
                applyProfileContentDefaults(nextProfileId)
                configureProfileVisibility(nextProfileId == "zh-TW")
                true
            }
        findPreference<Preference>("scanTimingPreset")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, nextValue ->
                applyTimingPreset(nextValue?.toString() ?: "custom")
                true
            }

        findPreference<Preference>("cameraSetup")?.setOnPreferenceClickListener {
            startActivity(
                Intent(requireContext(), CameraSwitchCalibrationActivity::class.java)
                    .putExtra("org.shineaac.inputs.PROFILE_ID", currentProfileId()),
            )
            true
        }
        findPreference<Preference>("inputTest")?.setOnPreferenceClickListener {
            startActivity(Intent(requireContext(), InputTestActivity::class.java))
            true
        }
        findPreference<Preference>("exportText")?.setOnPreferenceClickListener {
            settingsActivity().finishWithAction(SettingsActivity.ActionExportText)
            true
        }
        findPreference<Preference>("reset")?.setOnPreferenceClickListener {
            settingsActivity().confirmReset()
            true
        }
        findPreference<Preference>("manageSpeech")?.setOnPreferenceClickListener {
            val intent = listOf(
                Intent("com.android.settings.TTS_SETTINGS"),
                Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA),
            ).firstOrNull { candidate ->
                candidate.resolveActivity(requireContext().packageManager) != null
            }
            if (intent != null) startActivity(intent)
            true
        }
    }

    private fun configureList(key: String) {
        val preference = findPreference<ListPreference>(key) ?: return
        val options = storedChoices(key).ifEmpty { fallbackChoices(key) }
        val currentValue = SettingsStore.getString(requireContext(), key, "").orEmpty()
        val completeOptions = if (currentValue.isNotBlank() && options.none { it.second == currentValue }) {
            options + (currentValue to currentValue)
        } else {
            options
        }
        preference.entries = completeOptions.map { it.first }.toTypedArray()
        preference.entryValues = completeOptions.map { it.second }.toTypedArray()
        preference.summaryProvider = ListPreference.SimpleSummaryProvider.getInstance()
    }

    private fun storedChoices(key: String): List<Pair<String, String>> {
        val rawChoices = SettingsStore.stringValue(requireContext(), SettingsStore.ChoicesKey, "{}")
        val choices = try {
            JSONObject(rawChoices).optJSONArray(key) ?: JSONArray()
        } catch (_: Exception) {
            JSONArray()
        }
        return buildList {
            for (index in 0 until choices.length()) {
                val option = choices.optJSONObject(index) ?: continue
                val value = option.optString("value")
                val label = option.optString("label", value)
                if (value.isNotBlank()) add(label to value)
            }
        }
    }

    private fun fallbackChoices(key: String): List<Pair<String, String>> = when (key) {
        "profileId" -> listOf(
            getString(R.string.settings_language_english) to "en-US",
            getString(R.string.settings_language_taiwan) to "zh-TW",
        )
        "scanTimingPreset" -> listOf(getString(R.string.settings_custom) to "custom")
        else -> emptyList()
    }

    private fun configureNumericEditor(key: String) {
        findPreference<EditTextPreference>(key)?.setOnBindEditTextListener { editText ->
            editText.inputType = InputType.TYPE_CLASS_NUMBER
            editText.selectAll()
        }
        findPreference<EditTextPreference>(key)?.summaryProvider =
            Preference.SummaryProvider<EditTextPreference> { preference ->
                preference.text?.takeIf { it.isNotBlank() } ?: getString(R.string.settings_not_set)
            }
    }

    private fun configureLargeTextEditor(key: String, summaryResource: Int) {
        val preference = findPreference<EditTextPreference>(key) ?: return
        preference.setOnBindEditTextListener { editText ->
            editText.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            editText.minLines = 10
            editText.setHorizontallyScrolling(false)
        }
        preference.summaryProvider = Preference.SummaryProvider<EditTextPreference> { editPreference ->
            val count = editPreference.text
                .orEmpty()
                .lineSequence()
                .count { it.isNotBlank() }
            getString(summaryResource, count)
        }
    }

    private fun configureProfileVisibility(profileId: String) {
        configureProfileVisibility(profileId == "zh-TW")
    }

    private fun configureProfileVisibility(isZhTw: Boolean) {
        findPreference<Preference>("deferUnsupportedZhuyinOnFirstPass")?.isVisible = isZhTw
        findPreference<Preference>("suggestionDictionary")?.isVisible = !isZhTw
    }

    private fun applyProfileContentDefaults(profileId: String) {
        val rawProfiles = SettingsStore.stringValue(
            requireContext(),
            SettingsStore.ProfileContentsKey,
            "{}",
        )
        val defaults = try {
            JSONObject(rawProfiles).optJSONObject(profileId)
        } catch (_: Exception) {
            null
        } ?: return
        val dictionary = defaults.optString("suggestionDictionary", "")
        val symbols = defaults.optString("symbols", "")
        ProfileDefaultStringKeys.forEach { key ->
            if (!defaults.has(key)) return@forEach
            val value = defaults.optString(key)
            SettingsStore.putString(requireContext(), key, value)
            when (val preference = findPreference<Preference>(key)) {
                is ListPreference -> preference.value = value
                is EditTextPreference -> preference.text = value
            }
        }
        ProfileDefaultBooleanKeys.forEach { key ->
            if (!defaults.has(key)) return@forEach
            val value = defaults.optBoolean(key)
            SettingsStore.putBoolean(requireContext(), key, value)
            findPreference<androidx.preference.SwitchPreferenceCompat>(key)?.isChecked = value
        }
        SettingsStore.putString(requireContext(), "suggestionDictionary", dictionary)
        SettingsStore.putString(requireContext(), "symbols", symbols)
        SettingsStore.putString(requireContext(), SettingsStore.SourceProfileKey, profileId)
        findPreference<EditTextPreference>("suggestionDictionary")?.text = dictionary
        findPreference<EditTextPreference>("symbols")?.text = symbols
    }

    private fun applyTimingPreset(presetId: String) {
        if (presetId == "custom") return
        val rawPresets = SettingsStore.stringValue(
            requireContext(),
            SettingsStore.TimingPresetsKey,
            "{}",
        )
        val preset = try {
            JSONObject(rawPresets).optJSONObject(presetId)
        } catch (_: Exception) {
            null
        } ?: return
        TimingPreferenceKeys.forEach { key ->
            if (preset.has(key)) {
                SettingsStore.putString(requireContext(), key, preset.optString(key))
            }
        }
    }

    private fun currentProfileId(): String =
        SettingsStore.getString(requireContext(), "profileId", "en-US") ?: "en-US"

    private fun selectedVoiceSummary(): String = when (
        val voiceName = SettingsStore.getString(requireContext(), "speechVoiceName", "").orEmpty()
    ) {
        "", BuiltInVoiceName -> getString(R.string.settings_builtin_voice)
        AndroidSystemVoiceName -> getString(R.string.settings_system_voice)
        else -> voiceName
    }

    private fun settingsActivity(): SettingsActivity = requireActivity() as SettingsActivity

    private companion object {
        const val BuiltInVoiceName = "shine-aac-moe-bopomofo"
        const val AndroidSystemVoiceName = "android-system-default"
        val ProfileDefaultStringKeys = listOf(
            "columns",
            "scanMode",
            "scanTimingPreset",
            "scanIntervalMs",
            "transitionPauseMs",
            "firstCellPauseMs",
            "inputLatencyCompensationMs",
            "scanPassLimit",
        )
        val ProfileDefaultBooleanKeys = listOf(
            "autoScanSuggestionPages",
            "deferUnsupportedZhuyinOnFirstPass",
        )
        val TimingPreferenceKeys = listOf(
            "scanIntervalMs",
            "transitionPauseMs",
            "firstCellPauseMs",
            "inputLatencyCompensationMs",
        )
    }
}

class SpeechVoicePreferenceFragment : PreferenceFragmentCompat() {
    private var textToSpeech: TextToSpeech? = null
    private var speechReady = false

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        preferenceManager.preferenceDataStore = SettingsPreferenceDataStore(requireContext())
        setPreferencesFromResource(R.xml.speech_voice_preferences, rootKey)
        populateVoiceList(emptyList())

        findPreference<Preference>("previewSpeechVoice")?.setOnPreferenceClickListener {
            previewSelectedVoice()
            true
        }
        findPreference<Preference>("manageSpeech")?.setOnPreferenceClickListener {
            openSpeechManagement()
            true
        }

        textToSpeech = TextToSpeech(requireContext().applicationContext) { status ->
            speechReady = status == TextToSpeech.SUCCESS
            if (!speechReady || !isAdded) return@TextToSpeech
            populateVoiceList(
                textToSpeech?.voices
                    .orEmpty()
                    .filter { it.name.isNotBlank() }
                    .sortedWith(compareBy({ it.locale.getDisplayName(Locale.getDefault()) }, { it.name })),
            )
        }
    }

    override fun onDestroy() {
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        super.onDestroy()
    }

    private fun populateVoiceList(voices: List<android.speech.tts.Voice>) {
        val preference = findPreference<ListPreference>("speechVoiceName") ?: return
        val currentValue = SettingsStore.getString(requireContext(), "speechVoiceName", "").orEmpty()
        val labels = mutableListOf(
            getString(R.string.settings_builtin_voice),
            getString(R.string.settings_system_voice),
        )
        val values = mutableListOf(BuiltInVoiceName, AndroidSystemVoiceName)
        voices.forEach { voice ->
            if (voice.name in values) return@forEach
            val networkSuffix = if (voice.isNetworkConnectionRequired) {
                getString(R.string.settings_network_voice_suffix)
            } else {
                ""
            }
            labels += "${voice.locale.getDisplayName(Locale.getDefault())} — ${voice.name}$networkSuffix"
            values += voice.name
        }
        if (currentValue.isNotBlank() && currentValue !in values) {
            labels += currentValue + getString(R.string.settings_current_voice_suffix)
            values += currentValue
        }
        preference.entries = labels.toTypedArray()
        preference.entryValues = values.toTypedArray()
        preference.summaryProvider = ListPreference.SimpleSummaryProvider.getInstance()
    }

    private fun previewSelectedVoice() {
        val voiceName = SettingsStore.getString(requireContext(), "speechVoiceName", "").orEmpty()
        if (voiceName.isBlank() || voiceName == BuiltInVoiceName) {
            AlertDialog.Builder(requireContext())
                .setTitle(R.string.settings_preview_voice)
                .setMessage(R.string.settings_builtin_preview_unavailable)
                .setPositiveButton(android.R.string.ok, null)
                .show()
            return
        }
        val engine = textToSpeech
        if (!speechReady || engine == null) {
            AlertDialog.Builder(requireContext())
                .setMessage(R.string.settings_voice_not_ready)
                .setPositiveButton(android.R.string.ok, null)
                .show()
            return
        }

        if (voiceName == AndroidSystemVoiceName) {
            engine.voice = engine.defaultVoice
        } else {
            engine.voices.firstOrNull { it.name == voiceName }?.let { engine.voice = it }
        }
        val profileId = SettingsStore.stringValue(requireContext(), "profileId", "en-US")
        val previewText = if (profileId == "zh-TW") {
            getString(R.string.settings_voice_preview_text_zh)
        } else {
            getString(R.string.settings_voice_preview_text)
        }
        engine.speak(previewText, TextToSpeech.QUEUE_FLUSH, null, "shine-settings-preview")
    }

    private fun openSpeechManagement() {
        val intent = listOf(
            Intent("com.android.settings.TTS_SETTINGS"),
            Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA),
        ).firstOrNull { candidate ->
            candidate.resolveActivity(requireContext().packageManager) != null
        }
        if (intent != null) startActivity(intent)
    }

    private companion object {
        const val BuiltInVoiceName = "shine-aac-moe-bopomofo"
        const val AndroidSystemVoiceName = "android-system-default"
    }
}

class AppInfoPreferenceFragment : PreferenceFragmentCompat() {
    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        setPreferencesFromResource(R.xml.app_info_preferences, rootKey)
        @Suppress("DEPRECATION")
        val packageInfo = requireContext().packageManager.getPackageInfo(requireContext().packageName, 0)
        val versionName = packageInfo.versionName.orEmpty()
        val versionCode = PackageInfoCompat.getLongVersionCode(packageInfo)
        findPreference<Preference>("appVersion")?.summary =
            getString(R.string.settings_about_message, versionName, versionCode)
        bindUrl("sourceCode", SourceCodeUrl)
        bindUrl("privacyPolicy", PrivacyPolicyUrl)
        bindUrl("support", SupportUrl)
    }

    private fun bindUrl(key: String, url: String) {
        findPreference<Preference>(key)?.setOnPreferenceClickListener {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            true
        }
    }

    private companion object {
        const val SourceCodeUrl = "https://github.com/poi890poi/shine_aac"
        const val PrivacyPolicyUrl = "https://poi890poi.github.io/shine_aac/privacy-policy/"
        const val SupportUrl = "https://poi890poi.github.io/shine_aac/support/"
    }
}

class AdvancedTimingPreferenceFragment : PreferenceFragmentCompat() {
    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        preferenceManager.preferenceDataStore = SettingsPreferenceDataStore(requireContext())
        setPreferencesFromResource(R.xml.advanced_timing_preferences, rootKey)
        TimingKeys.forEach { key ->
            val preference = findPreference<EditTextPreference>(key) ?: return@forEach
            preference.setOnBindEditTextListener { editText ->
                editText.inputType = InputType.TYPE_CLASS_NUMBER
                editText.selectAll()
            }
            preference.onPreferenceChangeListener = Preference.OnPreferenceChangeListener { _, _ ->
                SettingsStore.putString(requireContext(), "scanTimingPreset", "custom")
                true
            }
        }
    }

    private companion object {
        val TimingKeys = listOf(
            "scanIntervalMs",
            "transitionPauseMs",
            "firstCellPauseMs",
            "inputLatencyCompensationMs",
        )
    }
}
