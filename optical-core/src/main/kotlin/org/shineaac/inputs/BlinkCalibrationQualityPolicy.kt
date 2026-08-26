package org.shineaac.inputs

import kotlin.math.roundToLong

/** Chooses a personalized hold that stays above observed natural closures. */
object BlinkHoldThresholdCalibrator {
    fun choose(
        deliberateDurationsMs: List<Long>,
        naturalDurationsMs: List<Long>,
        fallbackMs: Long
    ): Long {
        val deliberate = deliberateDurationsMs.filter { it in 450L..2500L }.sorted()
        if (deliberate.isEmpty()) return fallbackMs.coerceIn(MinHoldMs, MaxHoldMs)

        val median = deliberate[deliberate.size / 2]
        val personalizedTarget = (median * DeliberateFraction).roundToLong()
        val longestNatural = naturalDurationsMs.filter { it in 80L..2500L }.maxOrNull()
        val naturalSafetyTarget = longestNatural?.plus(NaturalSafetyMarginMs) ?: MinHoldMs

        // Never demand more than the measured deliberate median. If natural
        // behavior overlaps it, the quality policy below rejects a "good"
        // calibration instead of silently choosing an unusable hold.
        return maxOf(personalizedTarget, naturalSafetyTarget)
            .coerceAtMost(median)
            .coerceIn(MinHoldMs, MaxHoldMs)
    }

    private const val DeliberateFraction = 0.85
    private const val NaturalSafetyMarginMs = 200L
    private const val MinHoldMs = 650L
    private const val MaxHoldMs = 1600L
}

/** Pure policy for grading recorded blink-calibration evidence. */
object BlinkCalibrationQualityPolicy {
    const val MinimumGoodSlowBlinks = 3

    enum class Level {
        Good,
        Weak,
        Retry
    }

    data class Assessment(
        val level: Level,
        val validSlowBlinkCount: Int,
        val falseLongBlinkCount: Int
    )

    fun assess(
        longBlinkDurations: List<Long>,
        restClosedDurations: List<Long>,
        calibratedLongBlinkHoldMs: Long
    ): Assessment {
        val validSlowBlinks = longBlinkDurations.count {
            it in calibratedLongBlinkHoldMs..2500L
        }
        val falseLongBlinks = restClosedDurations.count {
            it >= calibratedLongBlinkHoldMs
        }
        val level = when {
            validSlowBlinks >= MinimumGoodSlowBlinks && falseLongBlinks == 0 ->
                Level.Good
            validSlowBlinks > 0 -> Level.Weak
            else -> Level.Retry
        }
        return Assessment(level, validSlowBlinks, falseLongBlinks)
    }
}
