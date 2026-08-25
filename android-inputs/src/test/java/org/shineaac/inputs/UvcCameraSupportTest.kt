package org.shineaac.inputs

import android.hardware.usb.UsbConstants
import com.jiangdg.uvc.UVCCamera
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UvcCameraSupportTest {
    @Test
    fun videoInterfaceIdentifiesCompositeUvcDevice() {
        assertTrue(
            UvcCameraDiscovery.isVideoClass(
                UsbConstants.USB_CLASS_PER_INTERFACE,
                listOf(UsbConstants.USB_CLASS_AUDIO, UsbConstants.USB_CLASS_VIDEO)
            )
        )
        assertTrue(
            UvcCameraDiscovery.isVideoClass(
                UsbConstants.USB_CLASS_VIDEO,
                emptyList()
            )
        )
        assertFalse(
            UvcCameraDiscovery.isVideoClass(
                UsbConstants.USB_CLASS_PER_INTERFACE,
                listOf(UsbConstants.USB_CLASS_AUDIO, UsbConstants.USB_CLASS_HID)
            )
        )
    }

    @Test
    fun commonMjpegVgaModeIsPreferred() {
        val ranked = UvcFrameSizeSelector.rank(
            listOf(
                UvcFrameSize(1280, 720, UVCCamera.FRAME_FORMAT_MJPEG),
                UvcFrameSize(640, 480, UVCCamera.FRAME_FORMAT_YUYV),
                UvcFrameSize(640, 480, UVCCamera.FRAME_FORMAT_MJPEG)
            )
        )

        assertEquals(
            UvcFrameSize(640, 480, UVCCamera.FRAME_FORMAT_MJPEG),
            ranked.first()
        )
    }

    @Test
    fun cheekCalibrationInstructionExplainsAutomaticSampleDiscovery() {
        assertEquals(
            "校正：請自然抽動臉頰後放鬆。系統會自動從影像找出動作樣本，不需要先成功觸發。",
            cheekCalibrationMoveInstruction(zhTw = true)
        )
        assertEquals(
            "Calibration: move your cheek naturally, then relax. Samples are found automatically; the twitch does not need to activate first.",
            cheekCalibrationMoveInstruction(zhTw = false)
        )
    }
}
