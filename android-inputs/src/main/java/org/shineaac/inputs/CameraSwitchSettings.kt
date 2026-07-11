package org.shineaac.inputs

data class CameraSwitchSettings(
    val enabled: Boolean = false,
    val longBlinkMs: Long = 800,
    val cooldownMs: Long = 900,
    val source: String = "android-camera-long-blink",
    val mirrorOverlayX: Boolean = true,
    val openBaseline: EyeFeatures? = null,
    val closedBaseline: EyeFeatures? = null
)

data class EyeFeatures(
    val mean: Double,
    val contrast: Double,
    val edge: Double
)
