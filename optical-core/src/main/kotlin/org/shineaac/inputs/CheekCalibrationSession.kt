package org.shineaac.inputs

/**
 * Source-independent state machine for automatic cheek calibration.
 *
 * Camera backends feed blendshape samples into this class. It owns sample
 * collection and clustering cadence, while the Android setup screen owns only
 * presentation and persistence.
 */
class CheekCalibrationSession(
    private val requiredNeutralFrames: Int = DefaultRequiredNeutralFrames,
    private val maximumCaptureFrames: Int = DefaultMaximumCaptureFrames,
    private val evaluationIntervalFrames: Int = DefaultEvaluationIntervalFrames
) {
    private var stage = Stage.Idle
    private val neutralFrames = mutableListOf<Map<String, Double>>()
    private val capturedFrames = mutableListOf<Map<String, Double>>()
    private var capturedFramesSeen = 0

    val active: Boolean get() = stage != Stage.Idle

    fun start() {
        stage = Stage.Rest
        neutralFrames.clear()
        capturedFrames.clear()
        capturedFramesSeen = 0
    }

    fun reset() {
        stage = Stage.Idle
        neutralFrames.clear()
        capturedFrames.clear()
        capturedFramesSeen = 0
    }

    fun complete() {
        stage = Stage.Idle
        capturedFrames.clear()
    }

    fun observe(values: Map<String, Double>, detectorReady: Boolean): CheekCalibrationUpdate {
        return when (stage) {
            Stage.Idle -> CheekCalibrationUpdate.Inactive
            Stage.Rest -> observeRest(values, detectorReady)
            Stage.Move -> observeMovement(values)
        }
    }

    private fun observeRest(
        values: Map<String, Double>,
        detectorReady: Boolean
    ): CheekCalibrationUpdate.RestProgress {
        neutralFrames += values.toMap()
        val readyForMovement = neutralFrames.size >= requiredNeutralFrames && detectorReady
        if (readyForMovement) {
            stage = Stage.Move
            capturedFrames.clear()
            capturedFramesSeen = 0
        }
        return CheekCalibrationUpdate.RestProgress(
            collectedFrames = neutralFrames.size,
            requiredFrames = requiredNeutralFrames,
            readyForMovement = readyForMovement
        )
    }

    private fun observeMovement(values: Map<String, Double>): CheekCalibrationUpdate {
        capturedFrames += values.toMap()
        capturedFramesSeen += 1
        while (capturedFrames.size > maximumCaptureFrames) {
            capturedFrames.removeAt(0)
        }
        if (capturedFramesSeen % evaluationIntervalFrames != 0) {
            return CheekCalibrationUpdate.CapturePending
        }
        return CheekCalibrationUpdate.Evaluated(
            buildCheekCalibrationFromUnlabeledSamples(
                neutralFrames = neutralFrames,
                capturedFrames = capturedFrames
            )
        )
    }

    private enum class Stage { Idle, Rest, Move }

    private companion object {
        const val DefaultRequiredNeutralFrames = 36
        const val DefaultMaximumCaptureFrames = 180
        const val DefaultEvaluationIntervalFrames = 3
    }
}

sealed class CheekCalibrationUpdate {
    data object Inactive : CheekCalibrationUpdate()

    data class RestProgress(
        val collectedFrames: Int,
        val requiredFrames: Int,
        val readyForMovement: Boolean
    ) : CheekCalibrationUpdate()

    data object CapturePending : CheekCalibrationUpdate()

    data class Evaluated(val attempt: CheekCalibrationAttempt) : CheekCalibrationUpdate()
}
