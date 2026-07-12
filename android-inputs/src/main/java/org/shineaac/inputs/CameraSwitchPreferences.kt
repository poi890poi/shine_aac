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

    fun read(context: Context, enabled: Boolean, source: String = "android-camera-long-blink"): CameraSwitchSettings {
        val prefs = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        return CameraSwitchSettings(
            enabled = enabled,
            longBlinkMs = clampLong(prefs.getLong("longBlinkMs", 800L), MinLongBlinkMs, MaxLongBlinkMs),
            cooldownMs = clampLong(prefs.getLong("cooldownMs", 900L), MinCooldownMs, MaxCooldownMs),
            source = source
        )
    }

    fun saveCalibration(
        context: Context,
        longBlinkMs: Long,
        cooldownMs: Long,
        qualityLabel: String? = null,
        qualityDetail: String? = null
    ) {
        val editor = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
            .edit()
            .putLong("longBlinkMs", clampLong(longBlinkMs, MinLongBlinkMs, MaxLongBlinkMs))
            .putLong("cooldownMs", clampLong(cooldownMs, MinCooldownMs, MaxCooldownMs))
            .putLong("calibratedAtMs", System.currentTimeMillis())
        writeString(editor, "qualityLabel", qualityLabel)
        writeString(editor, "qualityDetail", qualityDetail)
        editor.apply()
    }

    fun readCalibrationRecord(context: Context): CameraSwitchCalibrationRecord? {
        val prefs = context.getSharedPreferences(PrefsName, Context.MODE_PRIVATE)
        val calibratedAtMs = prefs.getLong("calibratedAtMs", 0L)
        if (calibratedAtMs <= 0L) return null
        return CameraSwitchCalibrationRecord(
            calibratedAtMs = calibratedAtMs,
            qualityLabel = prefs.getString("qualityLabel", null),
            qualityDetail = prefs.getString("qualityDetail", null)
        )
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
}

data class CameraSwitchCalibrationRecord(
    val calibratedAtMs: Long,
    val qualityLabel: String?,
    val qualityDetail: String?
)
