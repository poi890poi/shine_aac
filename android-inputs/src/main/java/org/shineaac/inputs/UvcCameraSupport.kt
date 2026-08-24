package org.shineaac.inputs

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.hardware.camera2.CameraCharacteristics
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import com.jiangdg.uvc.UVCCamera
import kotlin.math.abs

internal object UvcCameraDiscovery {
    fun availableCameras(context: Context): List<CameraSwitchCamera> {
        val manager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
            ?: return emptyList()
        return manager.deviceList.values
            .filter(::isUvcDevice)
            .map { device ->
                CameraSwitchCamera(
                    cameraId = cameraId(device),
                    lensFacing = CameraCharacteristics.LENS_FACING_EXTERNAL,
                    source = CameraSwitchCameraSource.Uvc
                )
            }
            .sortedBy { it.cameraId }
    }

    fun findDevice(context: Context, cameraId: String?): UsbDevice? {
        val manager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
            ?: return null
        val devices = manager.deviceList.values.filter(::isUvcDevice)
        return devices.firstOrNull { cameraId(it) == cameraId }
            ?: devices.sortedBy(::cameraId).firstOrNull()
    }

    fun isUvcDevice(device: UsbDevice): Boolean = isVideoClass(
        device.deviceClass,
        List(device.interfaceCount) { index ->
            device.getInterface(index).interfaceClass
        }
    )

    fun cameraId(device: UsbDevice): String =
        "uvc:${device.vendorId}:${device.productId}:${device.deviceName}"

    internal fun isVideoClass(
        deviceClass: Int,
        interfaceClasses: List<Int>
    ): Boolean = deviceClass == UsbConstants.USB_CLASS_VIDEO ||
        UsbConstants.USB_CLASS_VIDEO in interfaceClasses
}

internal data class UvcFrameSize(
    val width: Int,
    val height: Int,
    val frameFormat: Int
)

internal object UvcFrameSizeSelector {
    fun candidates(camera: UVCCamera): List<UvcFrameSize> {
        val sizes = camera.getSupportedSize(-1, camera.supportedSize)
            .mapNotNull { size ->
                val format = when (size.type) {
                    6 -> UVCCamera.FRAME_FORMAT_MJPEG
                    4 -> UVCCamera.FRAME_FORMAT_YUYV
                    else -> null
                } ?: return@mapNotNull null
                UvcFrameSize(size.width, size.height, format)
            }
            .distinct()
        return rank(sizes)
    }

    internal fun rank(sizes: List<UvcFrameSize>): List<UvcFrameSize> =
        sizes.sortedWith(
            compareBy<UvcFrameSize> {
                if (it.width == PreferredWidth && it.height == PreferredHeight) 0 else 1
            }.thenBy {
                if (it.frameFormat == UVCCamera.FRAME_FORMAT_MJPEG) 0 else 1
            }.thenBy {
                abs(it.width.toDouble() / it.height.coerceAtLeast(1) - PreferredAspect)
            }.thenBy {
                abs(it.width * it.height - PreferredWidth * PreferredHeight)
            }
        )

    private const val PreferredWidth = 640
    private const val PreferredHeight = 480
    private const val PreferredAspect = 4.0 / 3.0
}

/** Converts a UVC NV21 callback frame into an upright, optionally zoomed bitmap. */
internal object Nv21Bitmaps {
    fun toBitmap(
        bytes: ByteArray,
        width: Int,
        height: Int,
        zoomRatio: Float = 1f,
        rotationDegrees: Int = 0,
        mirrorHorizontally: Boolean = false
    ): Bitmap {
        require(bytes.size >= width * height * 3 / 2) { "Incomplete NV21 frame" }
        val pixels = IntArray(width * height)
        var output = 0
        for (row in 0 until height) {
            val yRow = row * width
            val uvRow = width * height + (row / 2) * width
            for (column in 0 until width) {
                val y = (bytes[yRow + column].toInt() and 0xff).coerceAtLeast(16) - 16
                val uv = uvRow + (column and -2)
                val v = (bytes[uv].toInt() and 0xff) - 128
                val u = (bytes[uv + 1].toInt() and 0xff) - 128
                val y1192 = 1192 * y
                val red = (y1192 + 1634 * v).coerceIn(0, 262143)
                val green = (y1192 - 833 * v - 400 * u).coerceIn(0, 262143)
                val blue = (y1192 + 2066 * u).coerceIn(0, 262143)
                pixels[output++] = -0x1000000 or
                    ((red shl 6) and 0xff0000) or
                    ((green shr 2) and 0xff00) or
                    ((blue shr 10) and 0xff)
            }
        }
        val decoded = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
        val zoom = zoomRatio.coerceAtLeast(1f)
        val cropWidth = (width / zoom).toInt().coerceIn(1, width)
        val cropHeight = (height / zoom).toInt().coerceIn(1, height)
        val cropped = if (cropWidth == width && cropHeight == height) {
            decoded
        } else {
            Bitmap.createBitmap(
                decoded,
                (width - cropWidth) / 2,
                (height - cropHeight) / 2,
                cropWidth,
                cropHeight
            ).also { decoded.recycle() }
        }
        val normalizedRotation = ((rotationDegrees % 360) + 360) % 360
        if (normalizedRotation == 0 && !mirrorHorizontally &&
            cropped.width == width && cropped.height == height
        ) return cropped
        val transform = Matrix().apply {
            if (cropped.width != width || cropped.height != height) {
                postScale(
                    width.toFloat() / cropped.width,
                    height.toFloat() / cropped.height
                )
            }
            if (normalizedRotation != 0) postRotate(normalizedRotation.toFloat())
            if (mirrorHorizontally) postScale(-1f, 1f)
        }
        return Bitmap.createBitmap(
            cropped,
            0,
            0,
            cropped.width,
            cropped.height,
            transform,
            true
        ).also { if (it !== cropped) cropped.recycle() }
    }
}
