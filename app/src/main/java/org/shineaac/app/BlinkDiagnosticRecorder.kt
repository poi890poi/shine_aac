package org.shineaac.app

import android.os.Build
import android.os.SystemClock
import org.json.JSONObject
import org.shineaac.inputs.CameraSwitchDiagnostics
import java.io.OutputStream
import java.util.ArrayDeque
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class BlinkDiagnosticRecorder : CameraSwitchDiagnostics {
    private val lock = Any()
    private val startedAtWallMs = System.currentTimeMillis()
    private val startedAtElapsedMs = SystemClock.elapsedRealtime()
    private val lines = ArrayDeque<String>()
    private val importantLines = ArrayDeque<String>()
    private val eventCounts = linkedMapOf<String, Long>()
    private var nextSequence = 1L
    private var droppedEvents = 0L

    override fun record(event: String, fields: Map<String, Any?>) {
        synchronized(lock) {
            val item = JSONObject()
                .put("sequence", nextSequence++)
                .put("elapsedMs", SystemClock.elapsedRealtime() - startedAtElapsedMs)
                .put("wallTimeMs", System.currentTimeMillis())
                .put("event", event)
            val values = JSONObject()
            fields.forEach { (key, value) -> values.put(key, value ?: JSONObject.NULL) }
            item.put("fields", values)
            incrementCount(event)
            if (event == "frameResult") {
                incrementCount("frame.state.${fields["classifierState"] ?: "unknown"}")
                incrementCount("frame.band.${fields["signalBand"] ?: "unknown"}")
                incrementCount("frame.reopenBand.${fields["reopenBand"] ?: "unknown"}")
                fields["rejection"]?.let { incrementCount("frame.rejection.$it") }
            }
            val line = item.toString()
            lines.addLast(line)
            if (event !in NoisyEvents) {
                importantLines.addLast(line)
                while (importantLines.size > MaxImportantEvents) importantLines.removeFirst()
            }
            while (lines.size > MaxEvents) {
                lines.removeFirst()
                droppedEvents += 1L
            }
        }
    }

    fun writeZip(output: OutputStream, versionName: String, versionCode: Long) {
        val eventSnapshot: List<String>
        val countSnapshot: Map<String, Long>
        val droppedSnapshot: Long
        synchronized(lock) {
            eventSnapshot = lines.toList()
            countSnapshot = eventCounts.toMap()
            droppedSnapshot = droppedEvents
        }
        val summary = buildSummary(versionName, versionCode, eventSnapshot.size, droppedSnapshot, countSnapshot)
        ZipOutputStream(output).use { zip ->
            zip.writeEntry("summary.json", summary.toString(2))
            zip.putNextEntry(ZipEntry("events.jsonl"))
            eventSnapshot.forEach { line ->
                zip.write(line.toByteArray(Charsets.UTF_8))
                zip.write('\n'.code)
            }
            zip.closeEntry()
            zip.writeEntry(
                "README.txt",
                "SHINE AAC blink diagnostics\n\n" +
                    "Reproduce the blink failure before exporting this file. " +
                    "The trace contains detector results, eye-open probabilities, classifier state, " +
                    "timings, and device/app metadata. It contains no camera images or AAC message text.\n"
            )
        }
    }

    fun buildTextReport(versionName: String, versionCode: Long): String {
        val recentSnapshot: List<String>
        val importantSnapshot: List<String>
        val countSnapshot: Map<String, Long>
        val retainedCount: Int
        val droppedSnapshot: Long
        synchronized(lock) {
            recentSnapshot = lines.toList().takeLast(RecentReportEvents)
            importantSnapshot = importantLines.toList().takeLast(RecentImportantEvents)
            countSnapshot = eventCounts.toMap()
            retainedCount = lines.size
            droppedSnapshot = droppedEvents
        }
        val summary = buildSummary(versionName, versionCode, retainedCount, droppedSnapshot, countSnapshot)
        return buildString {
            appendLine("SHINE AAC BLINK DEBUG REPORT")
            appendLine("Paste this entire report into the Codex conversation.")
            appendLine(summary.toString(2))
            appendLine("IMPORTANT EVENTS")
            importantSnapshot.forEach(::appendLine)
            appendLine("RECENT EVENTS")
            recentSnapshot.forEach(::appendLine)
            appendLine("END SHINE AAC BLINK DEBUG REPORT")
        }
    }

    private fun buildSummary(
        versionName: String,
        versionCode: Long,
        retainedCount: Int,
        droppedCount: Long,
        countsSnapshot: Map<String, Long>
    ): JSONObject {
        val counts = JSONObject()
        countsSnapshot.forEach { (event, count) -> counts.put(event, count) }
        return JSONObject()
            .put("formatVersion", 2)
            .put("privacy", "No camera images, audio, messages, or composed AAC text are included.")
            .put("startedAtWallMs", startedAtWallMs)
            .put("exportedAtWallMs", System.currentTimeMillis())
            .put("retainedEvents", retainedCount)
            .put("droppedOldestEvents", droppedCount)
            .put("eventCounts", counts)
            .put("appVersionName", versionName)
            .put("appVersionCode", versionCode)
            .put("androidSdk", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("device", Build.DEVICE)
    }

    private fun incrementCount(key: String) {
        eventCounts[key] = (eventCounts[key] ?: 0L) + 1L
    }

    private fun ZipOutputStream.writeEntry(name: String, value: String) {
        putNextEntry(ZipEntry(name))
        write(value.toByteArray(Charsets.UTF_8))
        closeEntry()
    }

    private companion object {
        const val MaxEvents = 30_000
        const val MaxImportantEvents = 200
        const val RecentReportEvents = 100
        const val RecentImportantEvents = 80
        val NoisyEvents = setOf("frameSubmitted", "frameResult", "status")
    }
}
