package org.shineaac.inputs

data class CameraSwitchSettings(
    val enabled: Boolean = false,
    val longBlinkMs: Long = DefaultLongBlinkMs,
    val cooldownMs: Long = 900,
    val zoomRatio: Float = 1.6f,
    val detectionParameters: BlinkDetectionParameters = BlinkDetectionParameters(),
    val source: String = "android-camera-long-blink"
) {
    companion object {
        const val DefaultLongBlinkMs = 1200L
    }
}
