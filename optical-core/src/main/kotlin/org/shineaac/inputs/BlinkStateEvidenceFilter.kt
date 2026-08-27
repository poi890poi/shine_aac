package org.shineaac.inputs

import java.util.ArrayDeque
import kotlin.math.pow

/**
 * Bounded binomial evidence for a binary eye state.
 *
 * The defaults are derived from a per-frame sensitivity and specificity of
 * 0.97. With a five-frame window, three contrary votes are enough to change
 * state: the probability of a wrong majority is about 0.000258 when frame
 * errors are independent. Keeping the window bounded prevents old errors from
 * accumulating indefinitely when that approximation is imperfect.
 */
internal class BlinkStateEvidenceFilter(
    private val config: Config = Config(),
    initialState: EyeState = EyeState.Open
) {
    private val observations = ArrayDeque<TimedObservation>(config.windowFrames)
    private val requiredVotes = config.requiredVotes()

    var state: EyeState = initialState
        private set

    fun reset(initialState: EyeState = EyeState.Open) {
        state = initialState
        observations.clear()
    }

    fun observe(
        observation: Observation,
        nowMs: Long,
        minimumStableMs: Long
    ): Update {
        observations.addLast(TimedObservation(observation, nowMs))
        while (observations.size > config.windowFrames) observations.removeFirst()

        val contrary = when (state) {
            EyeState.Open -> Observation.Closed
            EyeState.Closed -> Observation.Open
        }
        var contraryVotes = 0
        var firstContraryAtMs: Long? = null
        observations.forEach { item ->
            if (item.value == contrary) {
                contraryVotes += 1
                val first = firstContraryAtMs
                if (first == null || item.timestampMs < first) {
                    firstContraryAtMs = item.timestampMs
                }
            }
        }
        val transitionStartedAtMs = firstContraryAtMs
        val stableForMs = transitionStartedAtMs?.let { nowMs - it } ?: 0L
        if (
            contraryVotes >= requiredVotes &&
            stableForMs >= minimumStableMs.coerceAtLeast(0L)
        ) {
            state = when (state) {
                EyeState.Open -> EyeState.Closed
                EyeState.Closed -> EyeState.Open
            }
            return Update(
                state = state,
                changed = true,
                transitionStartedAtMs = transitionStartedAtMs,
                contraryVotes = contraryVotes,
                supportingVotes = observations.count { it.value == observationFor(state) },
                requiredVotes = requiredVotes
            )
        }

        return Update(
            state = state,
            changed = false,
            transitionStartedAtMs = transitionStartedAtMs,
            contraryVotes = contraryVotes,
            supportingVotes = observations.count { it.value == observationFor(state) },
            requiredVotes = requiredVotes
        )
    }

    private fun observationFor(state: EyeState): Observation = when (state) {
        EyeState.Open -> Observation.Open
        EyeState.Closed -> Observation.Closed
    }

    data class Config(
        val perFrameSensitivity: Double = 0.97,
        val perFrameSpecificity: Double = 0.97,
        val windowFrames: Int = 5,
        val maximumTransitionErrorProbability: Double = 0.001
    ) {
        init {
            require(perFrameSensitivity in 0.5..1.0)
            require(perFrameSpecificity in 0.5..1.0)
            require(windowFrames > 0 && windowFrames % 2 == 1)
            require(maximumTransitionErrorProbability > 0.0 && maximumTransitionErrorProbability < 0.5)
        }

        internal fun requiredVotes(): Int {
            val worstFrameError = maxOf(1.0 - perFrameSensitivity, 1.0 - perFrameSpecificity)
            val majority = windowFrames / 2 + 1
            return (majority..windowFrames).firstOrNull { votes ->
                binomialUpperTail(windowFrames, votes, worstFrameError) <=
                    maximumTransitionErrorProbability
            } ?: windowFrames
        }

        internal fun transitionErrorProbability(): Double {
            val worstFrameError = maxOf(1.0 - perFrameSensitivity, 1.0 - perFrameSpecificity)
            return binomialUpperTail(windowFrames, requiredVotes(), worstFrameError)
        }
    }

    data class Update(
        val state: EyeState,
        val changed: Boolean,
        val transitionStartedAtMs: Long?,
        val contraryVotes: Int,
        val supportingVotes: Int,
        val requiredVotes: Int
    ) {
        val hasStatisticalSupport: Boolean
            get() = supportingVotes >= requiredVotes
    }

    enum class EyeState { Open, Closed }

    enum class Observation { Open, Closed, Ambiguous }

    private data class TimedObservation(val value: Observation, val timestampMs: Long)
}

private fun binomialUpperTail(trials: Int, minimumSuccesses: Int, probability: Double): Double =
    (minimumSuccesses..trials).sumOf { successes ->
        binomialCoefficient(trials, successes) *
            probability.pow(successes) *
            (1.0 - probability).pow(trials - successes)
    }

private fun binomialCoefficient(n: Int, k: Int): Double {
    val smaller = minOf(k, n - k)
    if (smaller == 0) return 1.0
    var result = 1.0
    for (index in 1..smaller) {
        result *= (n - smaller + index).toDouble() / index.toDouble()
    }
    return result
}
