package org.shineaac.inputs

import android.view.Surface

internal object CameraRotation {
    fun compensationDegrees(
        surfaceRotation: Int,
        sensorOrientationDegrees: Int,
        frontFacing: Boolean
    ): Int {
        val deviceRotationDegrees = when (surfaceRotation) {
            Surface.ROTATION_90 -> 90
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 270
            else -> 0
        }
        return if (frontFacing) {
            (sensorOrientationDegrees + deviceRotationDegrees) % 360
        } else {
            (sensorOrientationDegrees - deviceRotationDegrees + 360) % 360
        }
    }
}
