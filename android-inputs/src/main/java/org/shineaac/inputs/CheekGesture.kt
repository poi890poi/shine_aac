package org.shineaac.inputs

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

object CheekFeatureSpace {
    val names = listOf(
        "cheekPuff", "cheekSquintLeft", "cheekSquintRight",
        "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight",
        "mouthLeft", "mouthRight", "mouthPressLeft", "mouthPressRight",
        "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight",
        "mouthUpperUpLeft", "mouthUpperUpRight", "noseSneerLeft", "noseSneerRight"
    )
}

data class CheekGestureModel(
    val featureNames: List<String>,
    val baselines: List<Double>,
    val scales: List<Double>,
    val weights: List<Double>,
    val neutralReference: Double,
    val activeReference: Double,
    val enterThreshold: Double,
    val exitThreshold: Double,
    val inferredSide: CheekSide,
    val quality: CheekCalibrationQuality
) {
    init {
        require(featureNames.isNotEmpty())
        require(featureNames.size == baselines.size && featureNames.size == scales.size)
        require(featureNames.size == weights.size && scales.all { it > 0.0 })
        require(activeReference > neutralReference)
    }

    fun score(values: Map<String, Double>): Double {
        val raw = featureNames.indices.sumOf { index ->
            val value = values[featureNames[index]] ?: baselines[index]
            weights[index] * ((value - baselines[index]) / scales[index])
        }
        return ((raw - neutralReference) / (activeReference - neutralReference)).coerceIn(-0.25, 1.5)
    }

    fun summary(): String = featureNames.indices
        .sortedByDescending { abs(weights[it]) }
        .take(3)
        .joinToString { index -> "${featureNames[index]}${if (weights[index] >= 0.0) "↑" else "↓"}" }
}

enum class CheekSide { Left, Right, BothOrCenter }

data class CheekCalibrationQuality(
    val accepted: Boolean,
    val separation: Double,
    val trialDetectionRate: Double,
    val neutralFalsePositiveRate: Double,
    val neutralFrameCount: Int,
    val activeTrialCount: Int,
    val message: String
)

sealed class CheekCalibrationOutcome {
    data class Success(val model: CheekGestureModel) : CheekCalibrationOutcome()
    data class Failure(val reason: String, val diagnosticModel: CheekGestureModel? = null) : CheekCalibrationOutcome()
}

internal data class CheekCalibrationAttempt(
    val capturedFrameCount: Int,
    val positiveFrameCount: Int,
    val clusterSeparation: Double,
    val outcome: CheekCalibrationOutcome?
)

private data class IndexedCheekCalibrationFrame(
    val index: Int,
    val values: Map<String, Double>,
    val score: Double
)

/**
 * Discovers personalized positive samples from an unlabeled live capture.
 *
 * The relaxed phase supplies a per-feature median and robust spread. Every later frame is measured
 * against that baseline without consulting [CheekTwitchDetector]'s runtime threshold. Two-means
 * clustering then separates rest-like frames from movement-like frames, and only temporally coherent
 * high-cluster runs are used to fit the personalized model. A clear movement can therefore calibrate
 * even when it could not activate the uncalibrated runtime detector first.
 */
internal fun buildCheekCalibrationFromUnlabeledSamples(
    neutralFrames: List<Map<String, Double>>,
    capturedFrames: List<Map<String, Double>>
): CheekCalibrationAttempt {
    if (neutralFrames.size < MinimumUnlabeledNeutralFrames ||
        capturedFrames.size < MinimumUnlabeledCapturedFrames
    ) {
        return CheekCalibrationAttempt(capturedFrames.size, 0, 0.0, null)
    }

    val featureStats = CheekFeatureSpace.names.map { name ->
        val values = neutralFrames.map { it[name] ?: 0.0 }
        val baseline = CheekGestureCalibrator.percentile(values, 0.50)
        val scale = max(
            UnlabeledMinimumScale,
            CheekGestureCalibrator.percentile(values.map { abs(it - baseline) }, 0.50) * UnlabeledMadToSigma
        )
        Triple(name, baseline, scale)
    }
    fun deviationScore(frame: Map<String, Double>): Double {
        val deviations = featureStats.map { (name, baseline, scale) ->
            abs((frame[name] ?: baseline) - baseline) / scale
        }.sortedDescending()
        return deviations.take(UnlabeledCombinedFeatureCount).average()
    }

    val neutralScores = neutralFrames.map(::deviationScore)
    val captured = capturedFrames.mapIndexed { index, values ->
        IndexedCheekCalibrationFrame(index, values, deviationScore(values))
    }
    val allScores = neutralScores + captured.map { it.score }
    var lowCenter = allScores.minOrNull() ?: 0.0
    var highCenter = allScores.maxOrNull() ?: 0.0
    repeat(UnlabeledClusterIterations) {
        val low = allScores.filter { abs(it - lowCenter) <= abs(it - highCenter) }
        val high = allScores.filter { abs(it - lowCenter) > abs(it - highCenter) }
        if (low.isEmpty() || high.isEmpty()) {
            return CheekCalibrationAttempt(capturedFrames.size, 0, 0.0, null)
        }
        lowCenter = low.average()
        highCenter = high.average()
    }

    val separation = highCenter - lowCenter
    val neutralCeiling = CheekGestureCalibrator.percentile(neutralScores, 0.99)
    if (separation < MinimumUnlabeledClusterSeparation ||
        highCenter < max(MinimumUnlabeledActiveCenter, neutralCeiling + MinimumUnlabeledNeutralMargin)
    ) {
        return CheekCalibrationAttempt(capturedFrames.size, 0, separation, null)
    }

    val boundary = max((lowCenter + highCenter) / 2.0, neutralCeiling + UnlabeledBoundaryMargin)
    val highFrames = captured.filter { it.score > boundary }
    val runs = mutableListOf<MutableList<IndexedCheekCalibrationFrame>>()
    highFrames.forEach { frame ->
        val current = runs.lastOrNull()
        if (current == null || frame.index - current.last().index > MaximumUnlabeledFrameGap) {
            runs += mutableListOf(frame)
        } else {
            current += frame
        }
    }
    val positiveRuns = runs
        .filter { it.size >= MinimumUnlabeledFramesPerRun }
        .map { run -> run.sortedByDescending { it.score }.take(MaximumUnlabeledFramesPerRun) }
    val positiveFrameCount = positiveRuns.sumOf { it.size }
    if (positiveFrameCount < MinimumUnlabeledPositiveFrames) {
        return CheekCalibrationAttempt(capturedFrames.size, positiveFrameCount, separation, null)
    }

    val calibrator = CheekGestureCalibrator()
    neutralFrames.forEach(calibrator::addNeutral)
    positiveRuns.forEachIndexed { trial, frames ->
        frames.forEach { calibrator.addActive(trial, it.values) }
    }
    return CheekCalibrationAttempt(
        capturedFrameCount = capturedFrames.size,
        positiveFrameCount = positiveFrameCount,
        clusterSeparation = separation,
        outcome = calibrator.build()
    )
}

private const val MinimumUnlabeledNeutralFrames = 30
private const val MinimumUnlabeledCapturedFrames = 10
private const val MinimumUnlabeledPositiveFrames = 5
private const val MinimumUnlabeledFramesPerRun = 3
private const val MaximumUnlabeledFramesPerRun = 12
private const val MaximumUnlabeledFrameGap = 2
private const val UnlabeledCombinedFeatureCount = 3
private const val UnlabeledClusterIterations = 12
private const val UnlabeledMinimumScale = 0.015
private const val UnlabeledMadToSigma = 1.4826
private const val MinimumUnlabeledClusterSeparation = 1.0
private const val MinimumUnlabeledActiveCenter = 3.0
private const val MinimumUnlabeledNeutralMargin = 1.0
private const val UnlabeledBoundaryMargin = 0.5

class CheekGestureCalibrator(private val candidateFeatures: List<String> = CheekFeatureSpace.names) {
    private val neutralFrames = mutableListOf<Map<String, Double>>()
    private val activeTrials = linkedMapOf<Int, MutableList<Map<String, Double>>>()

    fun reset() { neutralFrames.clear(); activeTrials.clear() }
    fun addNeutral(values: Map<String, Double>) { neutralFrames += values }
    fun addActive(trial: Int, values: Map<String, Double>) { activeTrials.getOrPut(trial) { mutableListOf() } += values }
    fun neutralCount() = neutralFrames.size
    fun activeTrialCount() = activeTrials.count { it.value.size >= MinimumFramesPerTrial }

    fun build(): CheekCalibrationOutcome {
        val trials = activeTrials.values.filter { it.size >= MinimumFramesPerTrial }
        val activeFrameCount = trials.sumOf { it.size }
        if (neutralFrames.size < MinimumNeutralFrames || trials.size < MinimumTrials ||
            activeFrameCount < MinimumActiveFrames
        ) {
            return CheekCalibrationOutcome.Failure("Not enough clear face samples (${neutralFrames.size} relaxed frames, $activeFrameCount movement frames).")
        }
        val stats = candidateFeatures.map { name ->
            val neutral = neutralFrames.map { it[name] ?: 0.0 }
            val baseline = percentile(neutral, 0.50)
            val scale = max(MinimumScale, percentile(neutral.map { abs(it - baseline) }, 0.50) * MadToSigma)
            val lows = trials.map { percentile(it.map { frame -> frame[name] ?: 0.0 }, 0.15) }
            val highs = trials.map { percentile(it.map { frame -> frame[name] ?: 0.0 }, 0.85) }
            val upward = percentile(highs.map { (it - baseline) / scale }, 0.50)
            val downward = percentile(lows.map { (baseline - it) / scale }, 0.50)
            val direction = if (upward >= downward) 1.0 else -1.0
            val effect = max(upward, downward)
            val consistency = if (direction > 0) highs.count { (it - baseline) / scale >= MinimumTrialEffect }
            else lows.count { (baseline - it) / scale >= MinimumTrialEffect }
            FeatureStats(name, baseline, scale, direction, effect, consistency.toDouble() / trials.size)
        }
        val selected = stats.filter { it.effect >= MinimumFeatureEffect && it.consistency >= MinimumConsistency }
            .sortedByDescending { it.effect * it.consistency }.take(MaxSelectedFeatures)
        if (selected.isEmpty()) return CheekCalibrationOutcome.Failure(
            "The cheek movement was not consistently different from the relaxed face. Try stronger lighting and repeat the same movement."
        )
        val rawWeights = selected.map { it.direction * it.effect.coerceAtMost(MaxFeatureWeight) }
        val norm = sqrt(rawWeights.sumOf { it * it }).coerceAtLeast(0.001)
        val weights = rawWeights.map { it / norm }
        fun project(frame: Map<String, Double>) = selected.indices.sumOf { index ->
            val stat = selected[index]
            weights[index] * (((frame[stat.name] ?: stat.baseline) - stat.baseline) / stat.scale)
        }
        val neutralScores = neutralFrames.map(::project)
        val trialPeaks = trials.map { percentile(it.map(::project), 0.85) }
        val neutralReference = percentile(neutralScores, 0.95)
        val activeReference = percentile(trialPeaks, 0.50)
        val separation = percentile(trialPeaks, 0.20) - percentile(neutralScores, 0.99)
        if (activeReference - neutralReference < MinimumReferenceRange) return CheekCalibrationOutcome.Failure(
            "The learned signal overlaps normal resting movement. Hold the phone steadier or use a clearer cheek movement."
        )
        val range = activeReference - neutralReference
        val threshold = (percentile(neutralScores, 0.99) + percentile(trialPeaks, 0.20)) / 2.0
        val enter = ((threshold - neutralReference) / range).coerceIn(0.40, 0.82)
        val exit = (enter * 0.52).coerceIn(0.20, 0.42)
        val falseRate = neutralScores.count { (it - neutralReference) / range >= enter }.toDouble() / neutralScores.size
        val detectionRate = trialPeaks.count { (it - neutralReference) / range >= enter }.toDouble() / trialPeaks.size
        val accepted = separation >= MinimumSeparation && detectionRate >= MinimumDetectionRate && falseRate <= MaximumFalsePositiveRate
        val model = CheekGestureModel(
            selected.map { it.name }, selected.map { it.baseline }, selected.map { it.scale }, weights,
            neutralReference, activeReference, enter, exit, inferSide(selected, weights),
            CheekCalibrationQuality(
                accepted, separation, detectionRate, falseRate, neutralFrames.size, trials.size,
                if (accepted) "Good separation; ${"%.0f".format(detectionRate * 100)}% of practice movements detected."
                else "Calibration was not reliable enough (${"%.0f".format(detectionRate * 100)}% trial detection, ${"%.1f".format(falseRate * 100)}% resting false frames)."
            )
        )
        return if (accepted) CheekCalibrationOutcome.Success(model) else CheekCalibrationOutcome.Failure(model.quality.message, model)
    }

    private fun inferSide(selected: List<FeatureStats>, weights: List<Double>): CheekSide {
        var left = 0.0; var right = 0.0
        selected.indices.forEach { index ->
            when {
                selected[index].name.endsWith("Left") -> left += abs(weights[index])
                selected[index].name.endsWith("Right") -> right += abs(weights[index])
            }
        }
        return when { left > right * 1.35 -> CheekSide.Left; right > left * 1.35 -> CheekSide.Right; else -> CheekSide.BothOrCenter }
    }

    private data class FeatureStats(val name: String, val baseline: Double, val scale: Double, val direction: Double, val effect: Double, val consistency: Double)

    companion object {
        private const val MinimumNeutralFrames = 30
        private const val MinimumTrials = 1
        private const val MinimumActiveFrames = 5
        private const val MinimumFramesPerTrial = 3
        private const val MinimumScale = 0.015
        private const val MadToSigma = 1.4826
        private const val MinimumTrialEffect = 0.55
        private const val MinimumFeatureEffect = 1.20
        private const val MinimumConsistency = 0.66
        private const val MaxFeatureWeight = 6.0
        private const val MaxSelectedFeatures = 5
        private const val MinimumReferenceRange = 0.65
        private const val MinimumSeparation = 0.20
        private const val MinimumDetectionRate = 0.80
        private const val MaximumFalsePositiveRate = 0.05

        internal fun percentile(values: List<Double>, fraction: Double): Double {
            require(values.isNotEmpty())
            val sorted = values.sorted()
            val position = fraction.coerceIn(0.0, 1.0) * (sorted.size - 1)
            val lower = position.toInt(); val upper = (lower + 1).coerceAtMost(sorted.lastIndex)
            return sorted[lower] * (1.0 - (position - lower)) + sorted[upper] * (position - lower)
        }
    }
}

class BinarySwitchClassifier(private val config: Config) {
    private var state = State.Neutral
    private var neutralSinceMs = NoTime
    private var activeSinceMs = NoTime
    private var lostSinceMs = NoTime
    private var armed = false

    fun reset(assumeNeutral: Boolean = false) {
        state = State.Neutral; neutralSinceMs = NoTime; activeSinceMs = NoTime; lostSinceMs = NoTime
        armed = assumeNeutral || config.requiredNeutralMs <= 0
    }

    fun onScore(score: Double?, nowMs: Long): List<Event> {
        if (score == null) {
            if (lostSinceMs == NoTime) lostSinceMs = nowMs
            if (nowMs - lostSinceMs < config.signalLostCancelMs) return emptyList()
            val holdActive = state == State.Latched
            reset()
            return if (holdActive) listOf(Event.HoldEnded(EndReason.SignalLost)) else emptyList()
        }
        lostSinceMs = NoTime
        return when (state) {
            State.Neutral -> {
                if (score <= config.exitThreshold) {
                    activeSinceMs = NoTime
                    if (neutralSinceMs == NoTime) neutralSinceMs = nowMs
                    if (nowMs - neutralSinceMs >= config.requiredNeutralMs) armed = true
                    emptyList()
                } else if (!armed || score < config.enterThreshold) {
                    activeSinceMs = NoTime; neutralSinceMs = NoTime; emptyList()
                } else {
                    neutralSinceMs = NoTime
                    if (activeSinceMs == NoTime) activeSinceMs = nowMs
                    if (nowMs - activeSinceMs < config.minimumHoldMs) {
                        emptyList()
                    } else {
                        state = State.Latched
                        listOf(
                            Event.HoldStarted,
                            Event.Activated(nowMs - activeSinceMs)
                        )
                    }
                }
            }
            State.Latched -> if (score <= config.exitThreshold) {
                reset(assumeNeutral = true); listOf(Event.HoldEnded(EndReason.Relaxed))
            } else emptyList()
        }
    }

    data class Config(val enterThreshold: Double, val exitThreshold: Double, val minimumHoldMs: Long = 180L, val requiredNeutralMs: Long = 300L, val signalLostCancelMs: Long = 650L)
    sealed class Event { data object HoldStarted : Event(); data class Activated(val heldMs: Long) : Event(); data class HoldEnded(val reason: EndReason) : Event() }
    enum class EndReason { Relaxed, SignalLost }
    private enum class State { Neutral, Latched }
    private companion object { const val NoTime = -1L }
}
