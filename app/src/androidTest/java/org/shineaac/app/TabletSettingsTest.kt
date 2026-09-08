package org.shineaac.app

import android.view.View
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.appcompat.widget.Toolbar
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TabletSettingsTest {
    @Test fun selectedSectionSurvivesActivityRecreation() {
        ActivityScenario.launch(SettingsActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val root = activity.supportFragmentManager.findFragmentByTag("categories") as MainSettingsPreferenceFragment
                val scanning = root.preferenceScreen.getPreference(1)
                assertTrue(activity.onPreferenceStartFragment(root, scanning))
                activity.supportFragmentManager.executePendingTransactions()
                assertEquals("scanning", activity.supportFragmentManager.findFragmentById(R.id.settings_container)
                    ?.arguments?.getString("settings_section"))
            }
            scenario.recreate()
            scenario.onActivity { activity ->
                assertEquals("scanning", activity.supportFragmentManager.findFragmentById(R.id.settings_container)
                    ?.arguments?.getString("settings_section"))
                assertEquals(activity.getString(R.string.settings_category_scanning), activity.findViewById<Toolbar>(R.id.settings_toolbar).title)
                assertEquals(View.VISIBLE, activity.findViewById<View>(R.id.settings_container).visibility)
            }
        }
    }
}
