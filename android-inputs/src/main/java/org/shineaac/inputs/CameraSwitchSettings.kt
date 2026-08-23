package org.shineaac.inputs

data class CameraSwitchSettings(
    val enabled: Boolean = false,
    val gesture: OpticalSwitchGesture = OpticalSwitchGesture.LongBlink,
    val longBlinkMs: Long = DefaultLongBlinkMs,
    val cheekHoldMs: Long = DefaultCheekHoldMs,
    val cooldownMs: Long = 900,
    val zoomRatio: Float = 1.6f,
    val detectionParameters: BlinkDetectionParameters = BlinkDetectionParameters(),
    val cheekModel: CheekGestureModel? = null,
    val source: String = gesture.inputSource
) {
    companion object {
        const val DefaultLongBlinkMs = 1200L
        const val DefaultCheekHoldMs = 180L
    }
}

enum class OpticalSwitchGesture(val storedValue: String, val inputSource: String) {
    LongBlink("long-blink", "android-camera-long-blink"),
    CheekTwitch("cheek-twitch", "android-camera-cheek-twitch");

    companion object {
        fun fromStored(value: String?): OpticalSwitchGesture =
            entries.firstOrNull { it.storedValue == value } ?: LongBlink
    }
}
