package org.shineaac.app

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.view.KeyEvent
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.util.Locale

class InputTestActivity : AppCompatActivity() {
    private var activationCount = 0
    private lateinit var countView: TextView
    private lateinit var lastEventView: TextView

    override fun attachBaseContext(newBase: Context) {
        val profileId = SettingsStore.stringValue(newBase, "profileId", "en-US")
        val configuration = Configuration(newBase.resources.configuration).apply {
            setLocale(Locale.forLanguageTag(profileId))
        }
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_input_test)
        activationCount = savedInstanceState?.getInt(StateActivationCount) ?: 0

        findViewById<Toolbar>(R.id.input_test_toolbar).apply {
            title = getString(R.string.settings_input_test)
            setNavigationIcon(R.drawable.ic_arrow_back)
            navigationContentDescription = getString(R.string.settings_back)
            setNavigationOnClickListener { onBackPressedDispatcher.onBackPressed() }
        }
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.input_test_count)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, view.paddingTop, bars.right, view.paddingBottom)
            insets
        }

        countView = findViewById(R.id.input_test_count)
        lastEventView = findViewById(R.id.input_test_last_event)
        findViewById<Button>(R.id.input_test_touch_button).setOnClickListener {
            recordActivation(getString(R.string.settings_input_key_touch))
        }
        findViewById<Button>(R.id.input_test_reset_button).setOnClickListener {
            activationCount = 0
            renderCount(null)
        }
        renderCount(null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putInt(StateActivationCount, activationCount)
        super.onSaveInstanceState(outState)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            acceptedKeyLabel(event.keyCode)?.let { label ->
                recordActivation(label)
                return true
            }
        }
        if (event.action == KeyEvent.ACTION_UP && acceptedKeyLabel(event.keyCode) != null) {
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun acceptedKeyLabel(keyCode: Int): String? = when (keyCode) {
        KeyEvent.KEYCODE_ENTER,
        KeyEvent.KEYCODE_NUMPAD_ENTER,
        KeyEvent.KEYCODE_DPAD_CENTER -> getString(R.string.settings_input_key_enter)
        KeyEvent.KEYCODE_SPACE -> getString(R.string.settings_input_key_space)
        KeyEvent.KEYCODE_VOLUME_UP -> getString(R.string.settings_input_key_volume_up)
        KeyEvent.KEYCODE_VOLUME_DOWN -> getString(R.string.settings_input_key_volume_down)
        KeyEvent.KEYCODE_BUTTON_A,
        KeyEvent.KEYCODE_BUTTON_B,
        KeyEvent.KEYCODE_BUTTON_1,
        KeyEvent.KEYCODE_BUTTON_2,
        KeyEvent.KEYCODE_HEADSETHOOK -> getString(R.string.settings_input_key_external)
        else -> null
    }

    private fun recordActivation(label: String) {
        activationCount += 1
        renderCount(label)
    }

    private fun renderCount(lastEvent: String?) {
        countView.text = getString(R.string.settings_input_test_count, activationCount)
        lastEventView.text = if (lastEvent == null) {
            getString(R.string.settings_input_test_waiting)
        } else {
            getString(R.string.settings_input_test_last_event, lastEvent)
        }
    }

    private companion object {
        const val StateActivationCount = "activationCount"
    }
}
