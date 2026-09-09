package org.shineaac.app

import android.content.pm.ActivityInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class BoardOrientationTest {
    @Test fun compactScreensArePortraitOnly() {
        for (width in listOf(320, 360, 599)) {
            assertEquals(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, boardScreenOrientation(width))
        }
    }

    @Test fun tabletBoundaryAllowsLandscape() {
        for (width in listOf(600, 840, 1200)) {
            assertEquals(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED, boardScreenOrientation(width))
        }
    }
}
