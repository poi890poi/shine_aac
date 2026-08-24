package org.shineaac.inputs

class BlinkGestureClassifier(
    private val config: Config = Config()
) {
    private var state = State.Open
    private var closingStartedAtMs = NoTime
    private var closedStartedAtMs = NoTime
    private var openCandidateStartedAtMs = NoTime
    private var signalLostStartedAtMs = NoTime
    private var openBaselineStartedAtMs = NoTime
    private var hasOpenBaseline = config.requiredOpenBeforeCloseMs <= 0

    fun reset(assumeOpenBaseline: Boolean = false) {
        state = State.Open
        closingStartedAtMs = NoTime
        closedStartedAtMs = NoTime
        openCandidateStartedAtMs = NoTime
        signalLostStartedAtMs = NoTime
        openBaselineStartedAtMs = NoTime
        hasOpenBaseline = assumeOpenBaseline || config.requiredOpenBeforeCloseMs <= 0
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
            closingStartedAtMs = NoTime
            return emptyList()
        }
        if (reopenScore != null && reopenScore <= config.openThreshold) {
            closingStartedAtMs = NoTime
            if (openBaselineStartedAtMs == NoTime) {
                openBaselineStartedAtMs = nowMs
            }
            if (nowMs - openBaselineStartedAtMs >= config.requiredOpenBeforeCloseMs) {
                hasOpenBaseline = true
            }
            return emptyList()
        }
        if (closedScore < config.closeThreshold) {
            closingStartedAtMs = NoTime
            return emptyList()
        }
        openBaselineStartedAtMs = NoTime
        if (!hasOpenBaseline) return emptyList()
        if (closingStartedAtMs == NoTime) {
            closingStartedAtMs = nowMs
        }
        if (nowMs - closingStartedAtMs < config.minClosedStableMs) {
            return emptyList()
        }
        state = State.ClosedHolding
        closedStartedAtMs = closingStartedAtMs
        openCandidateStartedAtMs = NoTime
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
            if (signalLostStartedAtMs == NoTime) signalLostStartedAtMs = nowMs
            if (nowMs - signalLostStartedAtMs >= config.signalLostCancelMs) {
                val durationMs = nowMs - closedStartedAtMs
                reset()
                return listOf(Event.HoldEnded(durationMs, EndReason.SignalLost))
            }
            return emptyList()
        }
        signalLostStartedAtMs = NoTime

        if (reopenScore != null && reopenScore <= config.openThreshold) {
            val durationMs = nowMs - closedStartedAtMs
            reset(assumeOpenBaseline = true)
            return listOf(Event.HoldEnded(durationMs, EndReason.Opened))
        }
        if (closedScore >= config.closeThreshold) {
            openCandidateStartedAtMs = NoTime
        }
        // After a stable close has started, the band between the reopen and
        // close thresholds retains the closed state. Requiring every later
        // sample to cross the close threshold again defeats hysteresis and can
        // suppress an otherwise valid long blink indefinitely.
        if (nowMs - closedStartedAtMs >= longBlinkMs) {
            state = State.ActivatedWaitOpen
            signalLostStartedAtMs = NoTime
            return listOf(Event.Activated(nowMs - closedStartedAtMs))
        }
        return emptyList()
    }

    private fun handleActivatedWaitOpen(closedScore: Double?, reopenScore: Double?, nowMs: Long): List<Event> {
        if (closedScore == null) {
            openCandidateStartedAtMs = NoTime
            return emptyList()
        }
        if (closedScore >= config.closeThreshold) {
            openCandidateStartedAtMs = NoTime
            return emptyList()
        }
        if (reopenScore == null || reopenScore > config.openThreshold) return emptyList()
        if (openCandidateStartedAtMs == NoTime) {
            openCandidateStartedAtMs = nowMs
        }
        if (nowMs - openCandidateStartedAtMs >= config.openStableMs) {
            reset(assumeOpenBaseline = true)
        }
        return emptyList()
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
