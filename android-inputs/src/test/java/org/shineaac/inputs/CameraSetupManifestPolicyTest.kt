package org.shineaac.inputs

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class CameraSetupManifestPolicyTest {
    @Test
    fun `camera setup requests portrait as a compact-device safety guard`() {
        val manifest = listOf(
            File("src/main/AndroidManifest.xml"),
            File("android-inputs/src/main/AndroidManifest.xml"),
        ).firstOrNull(File::isFile)
        assertNotNull("android-inputs source manifest was not found", manifest)

        val document = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
        }.newDocumentBuilder().parse(manifest)
        val activities = document.getElementsByTagName("activity")
        val cameraSetup = (0 until activities.length)
            .map { activities.item(it) }
            .firstOrNull {
                it.attributes
                    .getNamedItemNS(AndroidNamespace, "name")
                    ?.nodeValue == ".CameraSwitchCalibrationActivity"
            }
        assertNotNull("CameraSwitchCalibrationActivity manifest entry was not found", cameraSetup)
        assertEquals(
            "portrait",
            cameraSetup?.attributes?.getNamedItemNS(AndroidNamespace, "screenOrientation")?.nodeValue,
        )
    }

    private companion object {
        const val AndroidNamespace = "http://schemas.android.com/apk/res/android"
    }
}
