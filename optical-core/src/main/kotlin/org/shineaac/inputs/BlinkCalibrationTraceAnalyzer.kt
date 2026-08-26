package org.shineaac.inputs

/** One usable eye sample captured during a calibration phase. */
data class TimedBlinkEyeSignal(
    val timestampMs: Long,
    val signal: BlinkEyeSignal
)

/**
 * Measures closed-eye intervals after calibration has learned the user's thresholds.
 *
 * Capture cannot reliably count MediaPipe blinks against the pre-calibration defaults:
 * a valid user's closed-eye coefficient may sit below the default close threshold.
 * Keeping the timestamped trace lets setup learn thresholds first and then replay the
 * same evidence with the thresholds that will actually be used at runtime.
 */
object BlinkCalibrationTraceAnalyzer {
    fun closedDurations(
        samples: List<TimedBlinkEyeSignal>,
        parameters: BlinkDetectionParameters
    ): List<Long> {
        if (samples.isEmpty()) return emptyList()
        val config = parameters.normalized()
        val durations = mutableListOf<Long>()
        var closedStartedAtMs: Long? = null
        var previousTimestampMs: Long? = null

        samples.forEach { sample ->
            val signal = config.normalizeSignal(sample.signal)
            val previous = previousTimestampMs
            if (previous != null && sample.timestampMs - previous >= config.signalLostCancelMs) {
                closedStartedAtMs = null
            }
            previousTimestampMs = sample.timestampMs

            val startedAt = closedStartedAtMs
            if (startedAt == null) {
                if (signal.closedScore >= config.closeThreshold) {
                    closedStartedAtMs = sample.timestampMs
                }
            } else if (signal.reopenScore <= config.reopenThreshold) {
                val durationMs = sample.timestampMs - startedAt
                if (durationMs >= 0L) durations += durationMs
                closedStartedAtMs = null
            }
        }
        return durations
    }
}
