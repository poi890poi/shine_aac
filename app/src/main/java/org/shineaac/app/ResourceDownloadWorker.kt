package org.shineaac.app

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.shineaac.inputs.CheekModelResource
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class ResourceDownloadWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
    override fun doWork(): Result {
        if (inputData.getString(InputResourceId) != CheekModelResource.Id) {
            return Result.failure(errorData("Unknown resource"))
        }
        val destination = CheekModelResource.managedFile(applicationContext)
        if (CheekModelResource.isVerified(destination)) return Result.success()

        destination.parentFile?.mkdirs()
        val temporary = File(destination.parentFile, "${destination.name}.${id}.part")
        return try {
            downloadVerified(temporary)
            if (destination.exists() && !destination.delete()) {
                return Result.failure(errorData("Unable to replace resource"))
            }
            if (!temporary.renameTo(destination)) {
                return Result.failure(errorData("Unable to install resource"))
            }
            Result.success()
        } catch (exception: Exception) {
            Result.retry().takeIf { runAttemptCount < MaxRetryCount }
                ?: Result.failure(errorData(exception.message ?: "Download failed"))
        } finally {
            if (temporary.exists()) temporary.delete()
        }
    }

    private fun downloadVerified(destination: File) {
        val connection = URL(CheekModelResource.DownloadUrl).openConnection() as HttpURLConnection
        connection.connectTimeout = ConnectTimeoutMs
        connection.readTimeout = ReadTimeoutMs
        connection.instanceFollowRedirects = true
        connection.setRequestProperty("Accept", "application/octet-stream")
        try {
            val response = connection.responseCode
            if (response !in 200..299) error("Download returned HTTP $response")
            val announcedBytes = connection.contentLengthLong
            if (announcedBytes > MaxDownloadBytes) error("Resource is unexpectedly large")
            connection.inputStream.buffered().use { input ->
                destination.outputStream().buffered().use { output ->
                    val buffer = ByteArray(BufferBytes)
                    var written = 0L
                    while (true) {
                        if (isStopped) error("Download stopped")
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (count == 0) continue
                        written += count
                        if (written > MaxDownloadBytes) error("Resource is unexpectedly large")
                        output.write(buffer, 0, count)
                    }
                }
            }
            if (!CheekModelResource.isVerified(destination)) {
                error("Downloaded resource did not pass verification")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun errorData(message: String): Data =
        Data.Builder().putString(OutputError, message).build()

    companion object {
        const val InputResourceId = "resource-id"
        const val OutputError = "error"
        const val UniqueWorkName = "resource-download-${CheekModelResource.Id}"

        fun enqueue(context: Context): UUID {
            val request = OneTimeWorkRequestBuilder<ResourceDownloadWorker>()
                .setInputData(
                    Data.Builder().putString(InputResourceId, CheekModelResource.Id).build(),
                )
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                UniqueWorkName,
                ExistingWorkPolicy.KEEP,
                request,
            )
            return request.id
        }

        private const val BufferBytes = 64 * 1024
        private const val ConnectTimeoutMs = 15_000
        private const val ReadTimeoutMs = 30_000
        private const val MaxDownloadBytes = 16L * 1024L * 1024L
        private const val MaxRetryCount = 2
    }
}
