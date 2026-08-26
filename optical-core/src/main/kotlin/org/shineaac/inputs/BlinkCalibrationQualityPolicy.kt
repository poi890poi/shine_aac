package org.shineaac.inputs

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
        val validSlowBlinks = longBlinkDurations.count { it in 450L..2500L }
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
