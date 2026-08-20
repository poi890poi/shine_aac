package org.shineaac.inputs

import com.google.mlkit.vision.face.Face
import kotlin.math.abs

internal fun Face.blinkEyeSignal(parameters: BlinkDetectionParameters): BlinkEyeSignal? {
    val value = parameters.normalized()
    if (abs(headEulerAngleY) > value.maxYawDegrees) return null
    if (abs(headEulerAngleZ) > value.maxRollDegrees) return null
    if (boundingBox.width() < value.minFaceWidthPx || boundingBox.height() < value.minFaceHeightPx) return null
    return BlinkEyeSignal.fromOpenProbabilities(
        left = leftEyeOpenProbability?.toDouble(),
        right = rightEyeOpenProbability?.toDouble()
    )
}
