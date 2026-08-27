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

    fun shouldAnalyze(timestampMs: Long, intervalMs: Long): Boolean {
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
            return true
        }

        lastTimestampMs = timestampMs
        if (interval == 0L) return true
        if (timestampMs < nextDueMs) return false

        val elapsedPeriods = (timestampMs - nextDueMs) / interval
        nextDueMs += (elapsedPeriods + 1L) * interval
        return true
    }

    fun reset() {
        lastTimestampMs = null
        nextDueMs = 0L
        activeIntervalMs = 0L
    }
}

internal fun cameraFrameTimestampMs(
    timestampNs: Long,
    fallbackElapsedRealtimeMs: Long
): Long = if (timestampNs > 0L) timestampNs / 1_000_000L else fallbackElapsedRealtimeMs
