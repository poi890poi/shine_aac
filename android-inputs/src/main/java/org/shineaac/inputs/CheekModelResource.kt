package org.shineaac.inputs

import android.content.Context
import java.io.File
import java.io.InputStream
import java.nio.ByteBuffer
import java.security.MessageDigest

/**
 * Stable contract between the optional-resource manager and cheek detection.
 *
 * Versioned files are never overwritten in place. A detector that has already
 * mapped a model therefore keeps a valid buffer while an update is installed.
 */
object CheekModelResource {
    const val Id = "cheek-face-landmarker"
    const val BundledVersion = 1
    const val AvailableVersion = 1
    const val FileName = "face_landmarker.task"
    const val DownloadBytes = 3_758_596L
    const val Sha256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
    const val DownloadUrl =
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

    fun managedFile(context: Context, version: Int = AvailableVersion): File =
        File(context.filesDir, "managed-resources/$Id/v$version/$FileName")

    fun verifiedManagedFile(context: Context): File? =
        managedFile(context).takeIf(::isVerified)

    fun isVerified(file: File): Boolean = runCatching {
        file.isFile && file.length() == DownloadBytes &&
            file.inputStream().buffered().use(::sha256) == Sha256
    }.getOrDefault(false)

    /** Returns null to select the packaged asset fallback. */
    fun loadManagedBuffer(context: Context): ByteBuffer? {
        val file = verifiedManagedFile(context) ?: return null
        return runCatching {
            val bytes = file.readBytes()
            ByteBuffer.allocateDirect(bytes.size).apply {
                put(bytes)
                rewind()
            }
        }.getOrNull()
    }

    fun sha256(input: InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(DefaultBufferBytes)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            if (count > 0) digest.update(buffer, 0, count)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private const val DefaultBufferBytes = 64 * 1024
}
