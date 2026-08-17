package org.shineaac.app

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HardwareActivationKeyTest {
    @Test
    fun volumeKeysRemainAvailableToAndroid() {
        assertNull(hardwareActivationSource(KeyEvent.KEYCODE_VOLUME_UP))
        assertNull(hardwareActivationSource(KeyEvent.KEYCODE_VOLUME_DOWN))
    }

    @Test
    fun shutterAndExternalSwitchKeysStillActivate() {
        assertEquals("android-hardware-camera", hardwareActivationSource(KeyEvent.KEYCODE_CAMERA))
        assertEquals("android-media-headset", hardwareActivationSource(KeyEvent.KEYCODE_HEADSETHOOK))
        assertEquals("android-hardware-button-a", hardwareActivationSource(KeyEvent.KEYCODE_BUTTON_A))
        assertEquals("android-hardware-button-select", hardwareActivationSource(KeyEvent.KEYCODE_BUTTON_SELECT))
        assertEquals("android-hardware-button-start", hardwareActivationSource(KeyEvent.KEYCODE_BUTTON_START))
    }
}
