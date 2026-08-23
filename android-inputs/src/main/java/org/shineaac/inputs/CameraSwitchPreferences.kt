package org.shineaac.inputs

import android.content.Context
import kotlin.math.max
import kotlin.math.min

object CameraSwitchPreferences {
    private const val PrefsName = "shine_aac_camera_switch"
    private const val MinLongBlinkMs = 550L
    private const val MaxLongBlinkMs = 1600L
    private const val MinCooldownMs = 300L
    private const val MaxCooldownMs = 2500L
    private const val MinCheekHoldMs = 100L
    private const val MaxCheekHoldMs = 800L
    private const val DefaultZoomRatio = 1.6f
    private const val MinZoomRatio = 1.0f
    private const val MaxZoomRatio = 4.0f

    fun read(context: Context, enabled: Boolean, source: String = "android-camera-long-blink"): CameraSwitchSettings {
        val prefs = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        val gesture = OpticalSwitchGesture.fromStored(prefs.getString("gesture", null))
        return CameraSwitchSettings(
            enabled = enabled,
            gesture = gesture,
            longBlinkMs = clampLong(prefs.getLong("longBlinkMs", 800L), MinLongBlinkMs, MaxLongBlinkMs),
            cheekHoldMs = clampLong(prefs.getLong("cheekHoldMs", 180L), MinCheekHoldMs, MaxCheekHoldMs),
            cooldownMs = clampLong(prefs.getLong("cooldownMs", 900L), MinCooldownMs, MaxCooldownMs),
            zoomRatio = clampFloat(prefs.getFloat("zoomRatio", DefaultZoomRatio), MinZoomRatio, MaxZoomRatio),
            detectionParameters = readDetectionParameters(prefs),
            source = if (prefs.contains("gesture")) gesture.inputSource else source
        )
    }

    fun saveGesture(context: Context, gesture: OpticalSwitchGesture) {
        context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            .edit()
            .putString("gesture", gesture.storedValue)
            .apply()
    }

    fun saveCheekHold(context: Context, cheekHoldMs: Long) {
        context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            .edit()
            .putLong("cheekHoldMs", clampLong(cheekHoldMs, MinCheekHoldMs, MaxCheekHoldMs))
            .apply()
    }

    fun saveCalibration(
        context: Context,
        longBlinkMs: Long,
        cooldownMs: Long,
        zoomRatio: Float = DefaultZoomRatio,
        detectionParameters: BlinkDetectionParameters = BlinkDetectionParameters(),
        qualityLabel: String? = null,
        qualityDetail: String? = null
    ) {
        val editor = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            .edit()
            .putLong("longBlinkMs", clampLong(longBlinkMs, MinLongBlinkMs, MaxLongBlinkMs))
            .putLong("cooldownMs", clampLong(cooldownMs, MinCooldownMs, MaxCooldownMs))
            .putFloat("zoomRatio", clampFloat(zoomRatio, MinZoomRatio, MaxZoomRatio))
            .putLong("calibratedAtMs", System.currentTimeMillis())
        writeDetectionParameters(editor, detectionParameters.normalized())
        writeString(editor, "qualityLabel", qualityLabel)
        writeString(editor, "qualityDetail", qualityDetail)
        editor.apply()
    }

    fun saveTiming(context: Context, longBlinkMs: Long, cooldownMs: Long) {
        context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            .edit()
            .putLong("longBlinkMs", clampLong(longBlinkMs, MinLongBlinkMs, MaxLongBlinkMs))
            .putLong("cooldownMs", clampLong(cooldownMs, MinCooldownMs, MaxCooldownMs))
            .apply()
    }

    fun saveZoom(context: Context, zoomRatio: Float) {
        context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            .edit()
            .putFloat("zoomRatio", clampFloat(zoomRatio, MinZoomRatio, MaxZoomRatio))
            .apply()
    }

    fun readCalibrationRecord(context: Context): CameraSwitchCalibrationRecord? {
        val prefs = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        val calibratedAtMs = prefs.getLong("calibratedAtMs", 0L)
        if (calibratedAtMs <= 0L) return null
        return CameraSwitchCalibrationRecord(
            calibratedAtMs = calibratedAtMs,
            qualityLabel = prefs.getString("qualityLabel", null),
            qualityDetail = prefs.getString("qualityDetail", null),
            zoomRatio = clampFloat(prefs.getFloat("zoomRatio", DefaultZoomRatio), MinZoomRatio, MaxZoomRatio)
        )
    }

    private fun readDetectionParameters(prefs: android.content.SharedPreferences): BlinkDetectionParameters =
        BlinkDetectionParameters(
            closeThreshold = prefs.getFloat("blinkCloseThreshold", 0.55f).toDouble(),
            reopenThreshold = prefs.getFloat("blinkReopenThreshold", 0.35f).toDouble(),
            requiredOpenBeforeCloseMs = prefs.getLong("blinkRequiredOpenMs", 350L),
            minClosedStableMs = prefs.getLong("blinkMinClosedMs", 120L),
            reopenStableMs = prefs.getLong("blinkReopenStableMs", 150L),
            signalLostCancelMs = prefs.getLong("blinkSignalLostMs", 700L),
            maxYawDegrees = prefs.getFloat("blinkMaxYaw", 25f),
            maxRollDegrees = prefs.getFloat("blinkMaxRoll", 25f),
            minFaceWidthPx = prefs.getInt("blinkMinFaceWidth", 40),
            minFaceHeightPx = prefs.getInt("blinkMinFaceHeight", 48)
        ).normalized()

    private fun writeDetectionParameters(
        editor: android.content.SharedPreferences.Editor,
        value: BlinkDetectionParameters
    ) {
        editor
            .putFloat("blinkCloseThreshold", value.closeThreshold.toFloat())
            .putFloat("blinkReopenThreshold", value.reopenThreshold.toFloat())
            .putLong("blinkRequiredOpenMs", value.requiredOpenBeforeCloseMs)
            .putLong("blinkMinClosedMs", value.minClosedStableMs)
            .putLong("blinkReopenStableMs", value.reopenStableMs)
            .putLong("blinkSignalLostMs", value.signalLostCancelMs)
            .putFloat("blinkMaxYaw", value.maxYawDegrees)
            .putFloat("blinkMaxRoll", value.maxRollDegrees)
            .putInt("blinkMinFaceWidth", value.minFaceWidthPx)
            .putInt("blinkMinFaceHeight", value.minFaceHeightPx)
    }

    private fun writeString(
        editor: android.content.SharedPreferences.Editor,
        key: String,
        value: String?
    ) {
        if (value.isNullOrBlank()) {
            editor.remove(key)
        } else {
            editor.putString(key, value)
        }
    }

    private fun clampLong(value: Long, minValue: Long, maxValue: Long): Long =
        min(maxValue, max(minValue, value))

    private fun clampFloat(value: Float, minValue: Float, maxValue: Float): Float =
        min(maxValue, max(minValue, value))
}

data class CameraSwitchCalibrationRecord(
    val calibratedAtMs: Long,
    val qualityLabel: String?,
    val qualityDetail: String?,
    val zoomRatio: Float
)
