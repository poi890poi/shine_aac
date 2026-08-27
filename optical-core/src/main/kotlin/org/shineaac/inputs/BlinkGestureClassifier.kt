package org.shineaac.inputs

/** Source-independent long-blink state machine with bounded statistical eye-state evidence. */
class BlinkGestureClassifier(
    private val config: Config = Config()
) {
    private var state = State.Open
    private var closedStartedAtMs = NoTime
    private var signalLostStartedAtMs = NoTime
    private var openBaselineStartedAtMs = NoTime
    private var hasOpenBaseline = config.requiredOpenBeforeCloseMs <= 0
    private val eyeStateEvidence = BlinkStateEvidenceFilter()

    fun reset(assumeOpenBaseline: Boolean = false) {
        state = State.Open
        closedStartedAtMs = NoTime
        signalLostStartedAtMs = NoTime
        openBaselineStartedAtMs = NoTime
        hasOpenBaseline = assumeOpenBaseline || config.requiredOpenBeforeCloseMs <= 0
        eyeStateEvidence.reset(BlinkStateEvidenceFilter.EyeState.Open)
    }

    fun onSignal(
        closedScore: Double?,
        nowMs: Long,
        longBlinkMs: Long,
        reopenScore: Double? = closedScore
    ): List<Event> {
        return when (state) {
            State.Open -> handleOpen(closedScore, reopenScore, nowMs)
            State.ClosedHolding -> handleClosedHolding(closedScore, reopenScore, nowMs, longBlinkMs)
            State.ActivatedWaitOpen -> handleActivatedWaitOpen(closedScore, reopenScore, nowMs)
        }
    }

    private fun handleOpen(closedScore: Double?, reopenScore: Double?, nowMs: Long): List<Event> {
        if (closedScore == null) {
            eyeStateEvidence.observe(
                BlinkStateEvidenceFilter.Observation.Ambiguous,
                nowMs,
                config.minClosedStableMs
            )
            return emptyList()
        }
        val observation = observation(closedScore)
        val confidentlyOpen = reopenScore != null && reopenScore <= config.openThreshold
        if (confidentlyOpen) {
            if (openBaselineStartedAtMs == NoTime) {
                openBaselineStartedAtMs = nowMs
            }
            if (nowMs - openBaselineStartedAtMs >= config.requiredOpenBeforeCloseMs) {
                hasOpenBaseline = true
            }
        } else if (observation == BlinkStateEvidenceFilter.Observation.Closed) {
            openBaselineStartedAtMs = NoTime
        }
        if (!hasOpenBaseline) return emptyList()
        val evidence = eyeStateEvidence.observe(observation, nowMs, config.minClosedStableMs)
        if (!evidence.changed || evidence.state != BlinkStateEvidenceFilter.EyeState.Closed) return emptyList()
        state = State.ClosedHolding
        closedStartedAtMs = evidence.transitionStartedAtMs ?: nowMs
        signalLostStartedAtMs = NoTime
        return listOf(Event.HoldStarted(closedStartedAtMs))
    }

    private fun handleClosedHolding(
        closedScore: Double?,
        reopenScore: Double?,
        nowMs: Long,
        longBlinkMs: Long
    ): List<Event> {
        if (closedScore == null) {
            eyeStateEvidence.observe(
                BlinkStateEvidenceFilter.Observation.Ambiguous,
                nowMs,
                config.openStableMs
            )
            if (signalLostStartedAtMs == NoTime) signalLostStartedAtMs = nowMs
            if (nowMs - signalLostStartedAtMs >= config.signalLostCancelMs) {
                val durationMs = nowMs - closedStartedAtMs
                reset()
                return listOf(Event.HoldEnded(durationMs, EndReason.SignalLost))
            }
            return emptyList()
        }
        signalLostStartedAtMs = NoTime
        val observation = observation(closedScore)
        val evidence = eyeStateEvidence.observe(observation, nowMs, config.openStableMs)
        if (evidence.changed && evidence.state == BlinkStateEvidenceFilter.EyeState.Open) {
            val durationMs = nowMs - closedStartedAtMs
            val endReason = if (reopenScore != null && reopenScore <= config.openThreshold) {
                EndReason.Opened
            } else {
                EndReason.WeakClosure
            }
            reset(assumeOpenBaseline = true)
            return listOf(Event.HoldEnded(durationMs, endReason))
        }

        // Only a currently positive frame may complete activation. Open or
        // ambiguous evidence near the deadline is allowed to resolve first.
        if (
            observation == BlinkStateEvidenceFilter.Observation.Closed &&
            nowMs - closedStartedAtMs >= longBlinkMs
        ) {
            state = State.ActivatedWaitOpen
            signalLostStartedAtMs = NoTime
            return listOf(Event.Activated(nowMs - closedStartedAtMs))
        }
        return emptyList()
    }

    private fun handleActivatedWaitOpen(
        closedScore: Double?,
        reopenScore: Double?,
        nowMs: Long
    ): List<Event> {
        if (closedScore == null) {
            eyeStateEvidence.observe(
                BlinkStateEvidenceFilter.Observation.Ambiguous,
                nowMs,
                config.openStableMs
            )
            if (signalLostStartedAtMs == NoTime) signalLostStartedAtMs = nowMs
            if (nowMs - signalLostStartedAtMs >= config.signalLostCancelMs) {
                val durationMs = nowMs - closedStartedAtMs
                reset()
                return listOf(Event.HoldEnded(durationMs, EndReason.SignalLost))
            }
            return emptyList()
        }
        signalLostStartedAtMs = NoTime
        val evidence = eyeStateEvidence.observe(
            observation(closedScore),
            nowMs,
            config.openStableMs
        )
        if (evidence.changed && evidence.state == BlinkStateEvidenceFilter.EyeState.Open) {
            val durationMs = nowMs - closedStartedAtMs
            val endReason = if (reopenScore != null && reopenScore <= config.openThreshold) {
                EndReason.Opened
            } else {
                EndReason.WeakClosure
            }
            reset(assumeOpenBaseline = true)
            return listOf(Event.HoldEnded(durationMs, endReason))
        }
        return emptyList()
    }

    private fun observation(closedScore: Double): BlinkStateEvidenceFilter.Observation =
        if (closedScore >= config.closeThreshold) {
            BlinkStateEvidenceFilter.Observation.Closed
        } else {
            // The statistical premise is the binary result at the configured
            // single-frame threshold. Hysteresis still controls open-baseline
            // arming and the diagnostic end reason, but it is not a third
            // statistical class.
            BlinkStateEvidenceFilter.Observation.Open
        }

    data class Config(
        val closeThreshold: Double = 0.55,
        val openThreshold: Double = 0.35,
        val requiredOpenBeforeCloseMs: Long = 350L,
        val minClosedStableMs: Long = 120L,
        val openStableMs: Long = 150L,
        val signalLostCancelMs: Long = 700L
    )

    sealed class Event {
        data class HoldStarted(val startedAtMs: Long) : Event()
        data class Activated(val durationMs: Long) : Event()
        data class HoldEnded(val durationMs: Long, val reason: EndReason) : Event()
    }

    enum class EndReason {
        Opened,
        WeakClosure,
        SignalLost
    }

    private enum class State {
        Open,
        ClosedHolding,
        ActivatedWaitOpen
    }

    private companion object {
        const val NoTime = -1L
    }
}
