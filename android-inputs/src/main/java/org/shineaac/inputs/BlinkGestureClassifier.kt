package org.shineaac.inputs

class BlinkGestureClassifier(
    private val config: Config = Config()
) {
    private var state = State.Open
    private var closingStartedAtMs = NoTime
    private var closedStartedAtMs = NoTime
    private var openCandidateStartedAtMs = NoTime
    private var signalLostStartedAtMs = NoTime

    fun reset() {
        state = State.Open
        closingStartedAtMs = NoTime
        closedStartedAtMs = NoTime
        openCandidateStartedAtMs = NoTime
        signalLostStartedAtMs = NoTime
    }

    fun onSignal(closedScore: Double?, nowMs: Long, longBlinkMs: Long): List<Event> {
        return when (state) {
            State.Open -> handleOpen(closedScore, nowMs)
            State.ClosedHolding -> handleClosedHolding(closedScore, nowMs, longBlinkMs)
            State.ActivatedWaitOpen -> handleActivatedWaitOpen(closedScore, nowMs)
        }
    }

    private fun handleOpen(closedScore: Double?, nowMs: Long): List<Event> {
        if (closedScore == null || closedScore < config.closeThreshold) {
            closingStartedAtMs = NoTime
            return emptyList()
        }
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

    private fun handleClosedHolding(closedScore: Double?, nowMs: Long, longBlinkMs: Long): List<Event> {
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

        if (closedScore <= config.openThreshold) {
            if (openCandidateStartedAtMs == NoTime) openCandidateStartedAtMs = nowMs
            if (nowMs - openCandidateStartedAtMs >= config.openStableMs) {
                val durationMs = nowMs - closedStartedAtMs
                reset()
                return listOf(Event.HoldEnded(durationMs, EndReason.Opened))
            }
            return emptyList()
        }
        openCandidateStartedAtMs = NoTime

        if (closedScore >= config.closeThreshold && nowMs - closedStartedAtMs >= longBlinkMs) {
            state = State.ActivatedWaitOpen
            openCandidateStartedAtMs = NoTime
            signalLostStartedAtMs = NoTime
            return listOf(Event.Activated(nowMs - closedStartedAtMs))
        }
        return emptyList()
    }

    private fun handleActivatedWaitOpen(closedScore: Double?, nowMs: Long): List<Event> {
        if (closedScore == null) {
            openCandidateStartedAtMs = NoTime
            return emptyList()
        }
        if (closedScore > config.openThreshold) {
            openCandidateStartedAtMs = NoTime
            return emptyList()
        }
        if (openCandidateStartedAtMs == NoTime) {
            openCandidateStartedAtMs = nowMs
        }
        if (nowMs - openCandidateStartedAtMs >= config.openStableMs) {
            reset()
        }
        return emptyList()
    }

    data class Config(
        val closeThreshold: Double = 0.78,
        val openThreshold: Double = 0.28,
        val minClosedStableMs: Long = 120L,
        val openStableMs: Long = 220L,
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
