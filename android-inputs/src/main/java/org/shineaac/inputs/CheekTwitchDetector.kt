package org.shineaac.inputs

import kotlin.math.abs
import kotlin.math.max

/**
 * Detects a cheek twitch without any calibration, by comparing the face against its own recent
 * resting state.
 *
 * Calibration learns which features a particular person's movement uses and how far it travels, and
 * it remains the better signal. But requiring it before the switch does anything at all is a poor
 * trade: a helper cannot tell whether the camera is even working until a multi-step setup has been
 * completed, and a user cannot try the switch to find out whether the gesture suits them. Long blink
 * already ships with usable defaults; this gives the cheek gesture the same property.
 *
 * The method is deliberately simple. A rolling window of recent frames gives a per-feature resting
 * median and spread, the current frame is measured in robust standard deviations above that resting
 * level, and the strongest few features are averaged. Only the candidate features in
 * [CheekFeatureSpace] are considered, so gaze, blink and brow movement cannot drive the score.
 */
class CheekTwitchDetector(
    private val features: List<String> = CheekFeatureSpace.names,
    private val baselineWindow: Int = DefaultBaselineWindow,
    private val warmupFrames: Int = DefaultWarmupFrames
) {
    private val history = ArrayList<DoubleArray>()

    /** True once enough resting frames have been seen for the score to mean anything. */
    val ready: Boolean get() = history.size >= warmupFrames

    /** How far through the resting warm-up we are, for a progress indicator. */
    val warmupProgress: Float
        get() = if (warmupFrames <= 0) 1f else (history.size.toFloat() / warmupFrames).coerceIn(0f, 1f)

    fun reset() = history.clear()

    /** Seeds the resting baseline from frames already gathered, such as a calibration rest phase. */
    fun seedNeutral(frames: List<Map<String, Double>>) {
        frames.forEach { remember(toVector(it)) }
    }

    /**
     * Feeds one frame and returns its score, or null while still learning the resting face.
     *
     * A score of 0 is the resting face and 1 is a movement as large as the built-in expectation, so
     * it is directly comparable with the score a calibrated model produces.
     */
    fun observe(values: Map<String, Double>): Double? {
        val vector = toVector(values)
        if (!ready) {
            remember(vector)
            return null
        }
        val score = scoreOf(vector)
        // Keep the resting baseline clean: a held movement must not become the new normal.
        if (score < RestingUpdateCeiling) remember(vector)
        return score
    }

    private fun scoreOf(vector: DoubleArray): Double {
        val deviations = DoubleArray(features.size)
        for (index in features.indices) {
            val column = history.map { it[index] }
            val baseline = CheekGestureCalibrator.percentile(column, 0.50)
            val spread = max(
                MinimumScale,
                CheekGestureCalibrator.percentile(column.map { abs(it - baseline) }, 0.50) * MadToSigma
            )
            deviations[index] = (vector[index] - baseline) / spread
        }
        deviations.sort()
        // Mean of the strongest few features: one channel alone is noisy, and a real twitch moves
        // several related ones together.
        var total = 0.0
        for (offset in 1..CombinedFeatureCount) total += deviations[deviations.size - offset]
        val combined = total / CombinedFeatureCount
        return ((combined - NeutralSigma) / (ActiveSigma - NeutralSigma)).coerceIn(-0.25, 1.5)
    }

    private fun toVector(values: Map<String, Double>) =
        DoubleArray(features.size) { values[features[it]] ?: 0.0 }

    private fun remember(vector: DoubleArray) {
        history.add(vector)
        while (history.size > baselineWindow) history.removeAt(0)
    }

    companion object {
        const val DefaultBaselineWindow = 120
        const val DefaultWarmupFrames = 24

        /** Conservative defaults: an uncalibrated switch should under-fire rather than misfire. */
        const val DefaultEnterThreshold = 0.62
        const val DefaultExitThreshold = 0.30

        private const val MinimumScale = 0.015
        private const val MadToSigma = 1.4826
        private const val CombinedFeatureCount = 3
        private const val NeutralSigma = 2.5
        private const val ActiveSigma = 9.0
        private const val RestingUpdateCeiling = 0.5
    }
}
