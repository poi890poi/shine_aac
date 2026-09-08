package org.shineaac.app

import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.shineaac.inputs.CameraSwitchCalibrationActivity
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CameraWindowTest {
    private fun texture(view: View): TextureView? = when (view) {
        is TextureView -> view
        is ViewGroup -> (0 until view.childCount).firstNotNullOfOrNull { texture(view.getChildAt(it)) }
        else -> null
    }

    @Test fun rotatingSetupRetainsThePreviewAndItsActivityOwner() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val intent = Intent(context, CameraSwitchCalibrationActivity::class.java)
        ActivityScenario.launch<CameraSwitchCalibrationActivity>(intent).use { scenario ->
            var original: CameraSwitchCalibrationActivity? = null
            var preview: TextureView? = null
            scenario.onActivity { activity ->
                original = activity
                preview = texture(activity.window.decorView)
                assertNotNull(preview)
            }
            for ((request, orientation) in listOf(
                ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE to Configuration.ORIENTATION_LANDSCAPE,
                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT to Configuration.ORIENTATION_PORTRAIT)) {
                scenario.onActivity { it.requestedOrientation = request }
                var matches = false
                var bounds = ""
                for (attempt in 0 until 80) {
                    Thread.sleep(100)
                    scenario.onActivity {
                        val decor = it.window.decorView
                        bounds = "${decor.width}x${decor.height}"
                        matches = if (orientation == Configuration.ORIENTATION_LANDSCAPE)
                            decor.width > decor.height else decor.height > decor.width
                    }
                    if (matches) break
                }
                assertTrue("requested orientation $orientation was applied to window $bounds", matches)
                scenario.onActivity { activity ->
                    assertSame("rotation must retain calibration owner and samples", original, activity)
                    assertSame("rotation must retain preview surface view", preview, texture(activity.window.decorView))
                    assertTrue(preview!!.width > 0 && preview!!.height > 0)
                }
            }
        }
    }
}
