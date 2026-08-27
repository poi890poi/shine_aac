package org.shineaac.inputs

/**
 * Selects frames against a stable timeline instead of delaying the next
 * deadline from whichever camera frame happened to be accepted last.
 *
 * This avoids cadence aliasing such as a 15 fps camera becoming 7.5 fps when
 * analysis requests 10 fps. Timestamps must use the same monotonic clock.
 */
internal class FrameCadenceGate {
    private var lastTimestampMs: Long? = null
    private var nextDueMs = 0L
    private var activeIntervalMs = 0L

    fun decision(timestampMs: Long, intervalMs: Long): Decision {
        val interval = intervalMs.coerceAtLeast(0L)
        val previousTimestamp = lastTimestampMs
        if (
            previousTimestamp == null ||
            timestampMs < previousTimestamp ||
            interval != activeIntervalMs
        ) {
            lastTimestampMs = timestampMs
            activeIntervalMs = interval
            nextDueMs = timestampMs + interval
            return Decision(
                shouldAnalyze = true,
                observedAtMs = timestampMs,
                intervalMs = interval
            )
        }

        lastTimestampMs = timestampMs
        if (interval == 0L) {
            return Decision(
                shouldAnalyze = true,
                observedAtMs = timestampMs,
                intervalMs = interval
            )
        }
        if (timestampMs < nextDueMs) {
            return Decision(
                shouldAnalyze = false,
                observedAtMs = timestampMs,
                intervalMs = interval
            )
        }

        val firstMissedAtMs = nextDueMs
        val elapsedPeriods = (timestampMs - nextDueMs) / interval
        nextDueMs += (elapsedPeriods + 1L) * interval
        return Decision(
            shouldAnalyze = true,
            missedAnalysisSlots = elapsedPeriods.coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
            firstMissedAtMs = firstMissedAtMs.takeIf { elapsedPeriods > 0L },
            observedAtMs = timestampMs,
            intervalMs = interval
        )
    }

    fun shouldAnalyze(timestampMs: Long, intervalMs: Long): Boolean =
        decision(timestampMs, intervalMs).shouldAnalyze

    fun reset() {
        lastTimestampMs = null
        nextDueMs = 0L
        activeIntervalMs = 0L
    }

    data class Decision(
        val shouldAnalyze: Boolean,
        val missedAnalysisSlots: Int = 0,
        val firstMissedAtMs: Long? = null,
        val observedAtMs: Long,
        val intervalMs: Long
    )
}

/**
 * Returns bounded zero-evidence timestamps for missed scheduled analyses.
 *
 * Keep the first missing slot so a long gap retains its true signal-loss
 * duration, then keep the most recent slots so stale votes leave the bounded
 * evidence window. Deliberately skipped camera frames never reach this path;
 * only missed phase-locked analysis deadlines do.
 */
internal fun missingObservationTimestamps(
    decision: FrameCadenceGate.Decision,
    maximumPoints: Int = 5
): List<Long> {
    val count = decision.missedAnalysisSlots
    val first = decision.firstMissedAtMs
    val interval = decision.intervalMs
    if (count <= 0 || first == null || interval <= 0L || maximumPoints <= 0) return emptyList()
    if (count <= maximumPoints) {
        return (0 until count).map { index -> first + index * interval }
    }
    val recentStart = count - (maximumPoints - 1)
    return buildList(maximumPoints) {
        add(first)
        for (index in recentStart until count) add(first + index * interval)
    }
}

internal fun resumedAfterSignalLossTimeout(
    decision: FrameCadenceGate.Decision,
    signalLostCancelMs: Long
): Boolean {
    val first = decision.firstMissedAtMs ?: return false
    return decision.observedAtMs - first >= signalLostCancelMs.coerceAtLeast(0L)
}

internal fun cameraFrameTimestampMs(
    timestampNs: Long,
    fallbackElapsedRealtimeMs: Long
): Long = if (timestampNs > 0L) timestampNs / 1_000_000L else fallbackElapsedRealtimeMs
