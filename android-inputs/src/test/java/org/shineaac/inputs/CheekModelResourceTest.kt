package org.shineaac.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class CheekModelResourceTest {
    @Test
    fun sha256_matchesKnownVector() {
        val digest = "abc".byteInputStream().use(CheekModelResource::sha256)

        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            digest,
        )
    }

    @Test
    fun verificationRejectsIncompleteDownload() {
        val file = File.createTempFile("cheek-model", ".part")
        try {
            file.writeText("incomplete")

            assertFalse(CheekModelResource.isVerified(file))
        } finally {
            file.delete()
        }
    }

    @Test
    fun bundledModelMatchesDownloadContract() {
        val bundled = listOf(
            File("src/main/assets/${CheekModelResource.FileName}"),
            File("android-inputs/src/main/assets/${CheekModelResource.FileName}"),
        ).firstOrNull(File::isFile) ?: error("Bundled cheek model was not found")

        assertTrue(CheekModelResource.isVerified(bundled))
    }
}
