package org.shineaac.inputs

import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager

enum class CameraSwitchCameraSource(val storedValue: String) {
    Camera2("camera2"),
    Uvc("uvc");

    companion object {
        fun fromStored(value: String?): CameraSwitchCameraSource? =
            entries.firstOrNull { it.storedValue == value }
    }
}

data class CameraSwitchCamera(
    val cameraId: String,
    val lensFacing: Int?,
    val source: CameraSwitchCameraSource = CameraSwitchCameraSource.Camera2
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
        preferredLensFacing: Int?,
        preferredSource: CameraSwitchCameraSource? = null
    ): CameraSwitchCamera? {
        if (cameras.isEmpty()) return null
        cameras.firstOrNull { it.cameraId == preferredCameraId }?.let { return it }
        if (preferredSource != null) {
            cameras.firstOrNull {
                it.source == preferredSource &&
                    (preferredLensFacing == null || it.lensFacing == preferredLensFacing)
            }?.let { return it }
        }
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
