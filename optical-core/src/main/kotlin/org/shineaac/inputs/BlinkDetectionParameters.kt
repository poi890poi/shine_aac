package org.shineaac.inputs

import kotlin.math.roundToLong

/** Tunable, normalized parameters shared by setup and runtime blink detection. */
data class BlinkDetectionParameters(
    val closeThreshold: Double = 0.55,
    val reopenThreshold: Double = 0.35,
    val requiredOpenBeforeCloseMs: Long = 350L,
    val minClosedStableMs: Long = 120L,
    val reopenStableMs: Long = 150L,
    val signalLostCancelMs: Long = 700L,
    val maxYawDegrees: Float = 25f,
    val maxRollDegrees: Float = 25f,
    val minFaceWidthPx: Int = 40,
    val minFaceHeightPx: Int = 48
) {
    fun normalized(): BlinkDetectionParameters {
        val close = closeThreshold.coerceIn(MinCloseThreshold, MaxCloseThreshold)
        val reopen = reopenThreshold.coerceIn(MinReopenThreshold, minOf(MaxReopenThreshold, close - MinThresholdGap))
        return copy(
            closeThreshold = close,
            reopenThreshold = reopen,
            requiredOpenBeforeCloseMs = requiredOpenBeforeCloseMs.coerceIn(250L, 800L),
            minClosedStableMs = minClosedStableMs.coerceIn(80L, 300L),
            reopenStableMs = reopenStableMs.coerceIn(80L, 300L),
            signalLostCancelMs = signalLostCancelMs.coerceIn(500L, 1500L),
            maxYawDegrees = maxYawDegrees.coerceIn(10f, 45f),
            maxRollDegrees = maxRollDegrees.coerceIn(10f, 45f),
            minFaceWidthPx = minFaceWidthPx.coerceIn(24, 160),
            minFaceHeightPx = minFaceHeightPx.coerceIn(24, 180)
        )
    }

    fun classifierConfig(): BlinkGestureClassifier.Config {
        val value = normalized()
        return BlinkGestureClassifier.Config(
            closeThreshold = value.closeThreshold,
            openThreshold = value.reopenThreshold,
            requiredOpenBeforeCloseMs = value.requiredOpenBeforeCloseMs,
            minClosedStableMs = value.minClosedStableMs,
            openStableMs = value.reopenStableMs,
            signalLostCancelMs = value.signalLostCancelMs
        )
    }

    companion object {
        const val MinCloseThreshold = 0.40
        const val MaxCloseThreshold = 0.82
        const val MinReopenThreshold = 0.12
        const val MaxReopenThreshold = 0.50
        const val MinThresholdGap = 0.08
    }
}

data class BlinkEyeSignal(
    val closedScore: Double,
    val reopenScore: Double
) {
    companion object {
        fun fromOpenProbabilities(left: Double?, right: Double?): BlinkEyeSignal? {
            if (left == null || right == null) return null
            val safeLeft = left.coerceIn(0.0, 1.0)
            val safeRight = right.coerceIn(0.0, 1.0)
            return BlinkEyeSignal(
                closedScore = (1.0 - ((safeLeft + safeRight) / 2.0)).coerceIn(0.0, 1.0),
                reopenScore = (1.0 - maxOf(safeLeft, safeRight)).coerceIn(0.0, 1.0)
            )
        }

        fun fromClosedProbabilities(left: Double?, right: Double?): BlinkEyeSignal? {
            if (left == null || right == null) return null
            val safeLeft = left.coerceIn(0.0, 1.0)
            val safeRight = right.coerceIn(0.0, 1.0)
            return BlinkEyeSignal(
                closedScore = ((safeLeft + safeRight) / 2.0).coerceIn(0.0, 1.0),
                reopenScore = minOf(safeLeft, safeRight).coerceIn(0.0, 1.0)
            )
        }
    }
}

object BlinkParameterAutoCalibrator {
    fun tune(
        restSignals: List<BlinkEyeSignal>,
        slowBlinkSignals: List<BlinkEyeSignal>,
        frameIntervalsMs: List<Long>,
        fallback: BlinkDetectionParameters = BlinkDetectionParameters()
    ): BlinkDetectionParameters {
        val base = fallback.normalized()
        val intervals = frameIntervalsMs.filter { it in 40L..600L }.sorted()
        val frameMs = percentileLong(intervals, 0.5) ?: 200L
        val timing = base.copy(
            requiredOpenBeforeCloseMs = (frameMs * 2.0).roundToLong().coerceIn(300L, 600L),
            minClosedStableMs = (frameMs * 0.65).roundToLong().coerceIn(100L, 220L),
            reopenStableMs = (frameMs * 0.65).roundToLong().coerceIn(100L, 180L),
            signalLostCancelMs = (frameMs * 3.5).roundToLong().coerceIn(600L, 1200L)
        )
        if (restSignals.size < MinSamplesPerPhase || slowBlinkSignals.size < MinSamplesPerPhase) {
            return timing.normalized()
        }

        val restingClosed = percentile(restSignals.map { it.closedScore }.sorted(), 0.50) ?: return timing.normalized()
        val intentionalClosed = percentile(slowBlinkSignals.map { it.closedScore }.sorted(), 0.75) ?: return timing.normalized()
        val separation = intentionalClosed - restingClosed
        if (separation < MinUsefulSeparation) return timing.normalized()

        val restingReopen = percentile(restSignals.map { it.reopenScore }.sorted(), 0.85) ?: base.reopenThreshold
        val close = (restingClosed + separation * 0.55)
            .coerceIn(BlinkDetectionParameters.MinCloseThreshold, BlinkDetectionParameters.MaxCloseThreshold)
        val reopen = (restingReopen + 0.05)
            .coerceIn(
                BlinkDetectionParameters.MinReopenThreshold,
                minOf(BlinkDetectionParameters.MaxReopenThreshold, close - BlinkDetectionParameters.MinThresholdGap)
            )
        return timing.copy(closeThreshold = close, reopenThreshold = reopen).normalized()
    }

    private fun percentile(values: List<Double>, fraction: Double): Double? {
        if (values.isEmpty()) return null
        val index = ((values.lastIndex) * fraction).roundToLong().toInt().coerceIn(0, values.lastIndex)
        return values[index]
    }

    private fun percentileLong(values: List<Long>, fraction: Double): Long? {
        if (values.isEmpty()) return null
        val index = ((values.lastIndex) * fraction).roundToLong().toInt().coerceIn(0, values.lastIndex)
        return values[index]
    }

    private const val MinSamplesPerPhase = 12
    private const val MinUsefulSeparation = 0.14
}
