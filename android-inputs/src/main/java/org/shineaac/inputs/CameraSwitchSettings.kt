package org.shineaac.inputs

data class CameraSwitchSettings(
    val enabled: Boolean = false,
    val longBlinkMs: Long = 950,
    val cooldownMs: Long = 1200,
    val source: String = "android-camera-long-blink"
)
