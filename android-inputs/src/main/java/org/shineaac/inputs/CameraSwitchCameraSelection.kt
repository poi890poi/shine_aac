package org.shineaac.inputs

import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager

data class CameraSwitchCamera(
    val cameraId: String,
    val lensFacing: Int?
)

object CameraSwitchCameraSelection {
    fun availableCameras(manager: CameraManager): List<CameraSwitchCamera> =
        manager.cameraIdList.mapNotNull { cameraId ->
            runCatching {
                val characteristics = manager.getCameraCharacteristics(cameraId)
                val streamMap = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                    ?: return@runCatching null
                val yuvSizes = streamMap.getOutputSizes(ImageFormat.YUV_420_888)
                val previewSizes = streamMap.getOutputSizes(SurfaceTexture::class.java)
                if (yuvSizes.isNullOrEmpty() || previewSizes.isNullOrEmpty()) {
                    return@runCatching null
                }
                CameraSwitchCamera(
                    cameraId = cameraId,
                    lensFacing = characteristics.get(CameraCharacteristics.LENS_FACING)
                )
            }.getOrNull()
        }.sortedWith(compareBy<CameraSwitchCamera>({ facingRank(it.lensFacing) }, { it.cameraId }))

    fun choose(
        cameras: List<CameraSwitchCamera>,
        preferredCameraId: String?,
        preferredLensFacing: Int?
    ): CameraSwitchCamera? {
        if (cameras.isEmpty()) return null
        cameras.firstOrNull { it.cameraId == preferredCameraId }?.let { return it }
        if (preferredLensFacing != null) {
            cameras.firstOrNull { it.lensFacing == preferredLensFacing }?.let { return it }
        }
        return cameras.firstOrNull {
            it.lensFacing == CameraCharacteristics.LENS_FACING_FRONT
        } ?: cameras.firstOrNull {
            it.lensFacing == CameraCharacteristics.LENS_FACING_EXTERNAL
        } ?: cameras.firstOrNull {
            it.lensFacing == CameraCharacteristics.LENS_FACING_BACK
        } ?: cameras.first()
    }

    private fun facingRank(lensFacing: Int?): Int = when (lensFacing) {
        CameraCharacteristics.LENS_FACING_FRONT -> 0
        CameraCharacteristics.LENS_FACING_EXTERNAL -> 1
        CameraCharacteristics.LENS_FACING_BACK -> 2
        else -> 3
    }
}
