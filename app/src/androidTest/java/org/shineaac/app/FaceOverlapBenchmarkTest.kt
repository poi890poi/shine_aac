package org.shineaac.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.Process
import android.os.Trace
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.shineaac.inputs.CheekModelResource
import org.shineaac.inputs.BlinkGestureClassifier
import org.shineaac.inputs.BlinkEyeSignal
import java.io.File
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.ArrayDeque
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.locks.LockSupport

/** Test-only, bounded cross-frame overlap. Never changes the app's camera/input path. */
@RunWith(AndroidJUnit4::class)
class FaceOverlapBenchmarkTest {
    private data class Input(val index: Int, val width: Int, val height: Int, val pixels: ByteBuffer)
    private data class Captured(val input: Input, val captureNs: Long, val arrivalNs: Long)
    private val owned = AtomicInteger()
    private val peakOwned = AtomicInteger()
    private val preparations = AtomicInteger()
    private val upright = Matrix().apply { postRotate(90f); postScale(-1f, 1f) }
    private inner class Prepared(val capture: Captured, val bitmap: Bitmap, val beginNs: Long, val endNs: Long) : AutoCloseable {
        private val closed = AtomicBoolean()
        init { val count = owned.incrementAndGet(); peakOwned.updateAndGet { maxOf(it, count) } }
        override fun close() { if (closed.compareAndSet(false, true)) { if (!bitmap.isRecycled) bitmap.recycle(); owned.decrementAndGet() } }
    }
    private data class Result(val prepared: Prepared, val backend: String, val beginNs: Long, val endNs: Long,
        val completedNs: Long, val points: FloatArray, val scores: Map<String, Double>, val error: Throwable? = null,
        var deliveredNs: Long = 0, var accepted: Boolean = false, var emitted: List<String> = emptyList())

    private fun prepare(captured: Captured): Prepared {
        val begin = System.nanoTime()
        Trace.beginSection("FaceOverlap.prepare")
        val raw = captured.input
        val decoded = Bitmap.createBitmap(raw.width, raw.height, Bitmap.Config.ARGB_8888)
        try {
            decoded.copyPixelsFromBuffer(raw.pixels.duplicate().apply { rewind() })
            val result = Bitmap.createBitmap(decoded, 0, 0, raw.width, raw.height, upright, true)
            preparations.incrementAndGet()
            return Prepared(captured, result, begin, System.nanoTime())
        } finally { decoded.recycle(); Trace.endSection() }
    }

    private inner class Worker(val delegate: Delegate) : AutoCloseable {
        val executor = Executors.newSingleThreadExecutor { Thread(it, "Overlap-${delegate.name}") }
        private val buffer = CheekModelResource.loadManagedBuffer(InstrumentationRegistry.getInstrumentation().targetContext)
        private val task = try { executor.submit(Callable {
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            FaceLandmarker.createFromOptions(context, FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setDelegate(delegate).apply {
                    if (buffer != null) setModelAssetBuffer(buffer) else setModelAssetPath(CheekModelResource.FileName)
                }.build()).setRunningMode(RunningMode.VIDEO).setNumFaces(1)
                .setMinFaceDetectionConfidence(.55f).setMinFacePresenceConfidence(.55f)
                .setMinTrackingConfidence(.55f).setOutputFaceBlendshapes(true).build())
        }).get() } catch (error: Throwable) { executor.shutdown(); throw error }
        fun infer(prepared: Prepared, timestampMs: Long): Result {
            val begin = System.nanoTime()
            Trace.beginSection("FaceOverlap.infer.${delegate.name}")
            var end = begin
            var points = floatArrayOf()
            var scores = emptyMap<String, Double>()
            var failure: Throwable? = null
            try {
                val image = BitmapImageBuilder(prepared.bitmap).build()
                try {
                    val result = task.detectForVideo(image, timestampMs)
                    end = System.nanoTime()
                    val landmarks = result.faceLandmarks().firstOrNull().orEmpty()
                    points = FloatArray(landmarks.size * 3)
                    landmarks.forEachIndexed { i, point -> points[i*3] = point.x(); points[i*3+1] = point.y(); points[i*3+2] = point.z() }
                    scores = result.faceBlendshapes().orElse(emptyList()).firstOrNull().orEmpty()
                        .associate { it.categoryName() to it.score().toDouble() }
                } finally { image.close() }
            } catch (error: Throwable) { failure = error }
            finally { prepared.close(); Trace.endSection() }
            return Result(prepared, delegate.name, begin, end, System.nanoTime(), points, scores, failure)
        }
        override fun close() { try { executor.submit { task.close() }.get() } finally { executor.shutdown() } }
    }

    @Test fun boundedOverlap() {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue("Select this benchmark explicitly", args.getString("class") == javaClass.name)
        val mode = requireNotNull(args.getString("overlapMode"))
        require(mode in listOf("serial", "prepared", "dual"))
        val periodMs = requireNotNull(args.getString("periodMs")).toLong()
        require(periodMs in listOf(0L, 33L, 66L, 100L))
        val frameWidth = (args.getString("frameWidth") ?: "480").toInt()
        require(frameWidth in listOf(320, 480))
        val paired = args.getString("pairedModels") == "true"
        require(mode != "dual" || paired)
        val runId = requireNotNull(args.getString("benchmarkRun"))
        require(runId.matches(Regex("[a-z0-9-]+")))
        val directory = File(InstrumentationRegistry.getInstrumentation().targetContext.cacheDir, "public-face-benchmark")
        val manifest = JSONObject(File(directory, "manifest.json").readText())
        assertEquals("testdata/optical-rig/sources.json", manifest.getString("sourceManifest"))
        val inverse = Matrix().also { assertTrue(upright.invert(it)) }
        val frames = manifest.getJSONArray("frames")
        val inputs = (0 until frames.length()).map { index ->
            val entry = frames.getJSONObject(index)
            val name = entry.getString("file")
            require(name.matches(Regex("frame-[0-9]+\\.png")))
            val bytes = File(directory, name).readBytes()
            assertEquals(entry.getString("sha256"), MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) })
            val decodedFixture = requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size))
            val fixture = if (decodedFixture.width == frameWidth) decodedFixture else
                Bitmap.createScaledBitmap(decodedFixture, frameWidth, decodedFixture.height * frameWidth / decodedFixture.width, true)
            if (fixture !== decodedFixture) decodedFixture.recycle()
            val raw = Bitmap.createBitmap(fixture, 0, 0, fixture.width, fixture.height, inverse, true)
            val pixels = ByteBuffer.allocateDirect(raw.byteCount)
            raw.copyPixelsToBuffer(pixels); pixels.rewind()
            val input = Input(index, raw.width, raw.height, pixels.asReadOnlyBuffer())
            val check = prepare(Captured(input, 0, 0))
            assertEquals(fixture.width, check.bitmap.width)
            assertEquals(fixture.height, check.bitmap.height)
            val expectedPixels = IntArray(fixture.width * fixture.height)
            val actualPixels = IntArray(check.bitmap.width * check.bitmap.height)
            fixture.getPixels(expectedPixels, 0, fixture.width, 0, 0, fixture.width, fixture.height)
            check.bitmap.getPixels(actualPixels, 0, check.bitmap.width, 0, 0, check.bitmap.width, check.bitmap.height)
            if (index == 0) {
                File(directory, "pixel-verification.json").writeText(JSONObject()
                    .put("sameAs", fixture.sameAs(check.bitmap)).put("exactArgb", expectedPixels.contentEquals(actualPixels))
                    .put("fixtureAlpha", fixture.hasAlpha()).put("outputAlpha", check.bitmap.hasAlpha())
                    .put("fixtureConfig", fixture.config.toString()).put("outputConfig", check.bitmap.config.toString()).toString())
            }
            try { assertArrayEquals("Camera transform changed ARGB pixels", expectedPixels, actualPixels) }
            finally { check.close(); raw.recycle(); fixture.recycle() }
            input
        }
        val workers = mutableListOf<Worker>()
        try {
            workers += Worker(Delegate.GPU)
            if (paired) workers += Worker(Delegate.CPU)
            workers.forEach { worker ->
                repeat(30) { i ->
                    val prepared = prepare(Captured(inputs[i % inputs.size], 0, 0))
                    val result = worker.executor.submit(Callable { worker.infer(prepared, i * 100L) }).get()
                    result.error?.let { throw it }
                }
            }
            preparations.set(0); peakOwned.set(0)
            val lock = Object()
            var raw: Captured? = null
            var ready: Prepared? = null
            var preparing = false
            var sourceDone = false
            var stopped = false
            var failure: Throwable? = null
            var droppedRaw = 0
            var droppedReady = 0
            val free = workers.associateWith { true }.toMutableMap()
            val completions = ArrayDeque<Pair<Worker, Result>>()
            val results = mutableListOf<Result>()
            var acceptedIndex = -1
            val classifier = BlinkGestureClassifier()
            val startNs = System.nanoTime()
            val cpuStartMs = Process.getElapsedCpuTime()
            fun fail(error: Throwable) = synchronized(lock) { if (!stopped) failure = error; lock.notifyAll() }
            val producer = Thread({
                try {
                    inputs.forEach { input ->
                        val due = startNs + input.index * periodMs * 1_000_000L
                        if (periodMs > 0) {
                            while (System.nanoTime() < due) {
                                if (Thread.currentThread().isInterrupted) throw InterruptedException()
                                LockSupport.parkNanos(due - System.nanoTime())
                            }
                        }
                        synchronized(lock) {
                            // Saturated mode preserves the entire sequence; paced mode is latest-only.
                            while (periodMs == 0L && raw != null && !stopped) lock.wait()
                            if (stopped) return@Thread
                            val now = System.nanoTime()
                            if (raw != null) droppedRaw++
                            raw = Captured(input, if (periodMs == 0L) now else due, now)
                            lock.notifyAll()
                        }
                    }
                } catch (error: Throwable) { fail(error) }
                finally { synchronized(lock) { sourceDone = true; lock.notifyAll() } }
            }, "Overlap-source")
            val preparer = if (mode == "prepared") Thread({
                try {
                    while (true) {
                        val captured = synchronized(lock) {
                            while (!stopped && (raw == null || (periodMs == 0L && ready != null))) {
                                if (sourceDone && raw == null) return@Thread
                                lock.wait()
                            }
                            if (stopped) return@Thread
                            preparing = true
                            raw.also { raw = null; lock.notifyAll() }!!
                        }
                        val next = prepare(captured)
                        synchronized(lock) {
                            preparing = false
                            if (stopped) next.close() else {
                                ready?.let { droppedReady++; it.close() }
                                ready = next
                            }
                            lock.notifyAll()
                        }
                    }
                } catch (error: Throwable) { fail(error) }
                finally { synchronized(lock) { preparing = false; lock.notifyAll() } }
            }, "Overlap-prepare") else null
            var endNs: Long
            var cpuEndMs: Long
            try {
                producer.start(); preparer?.start()
                while (true) {
                    var finished = false
                    var selected: Worker? = null
                    var captured: Captured? = null
                    var prepared: Prepared? = null
                    synchronized(lock) {
                        failure?.let { throw it }
                        // Completion order is preserved; stale outputs cannot rewind the consumer.
                        while (completions.isNotEmpty()) {
                            val (worker, result) = completions.removeFirst()
                            free[worker] = true
                            result.error?.let { throw it }
                            result.deliveredNs = System.nanoTime()
                            result.accepted = result.prepared.capture.input.index > acceptedIndex
                            if (result.accepted) {
                                if (periodMs > 0) {
                                    for (missing in (acceptedIndex + 1) until result.prepared.capture.input.index) {
                                        classifier.onSignal(null, missing * periodMs, 1000L, null)
                                    }
                                    val signal = if (result.points.isNotEmpty()) BlinkEyeSignal.fromClosedProbabilities(
                                        result.scores["eyeBlinkLeft"], result.scores["eyeBlinkRight"]) else null
                                    result.emitted = classifier.onSignal(signal?.closedScore,
                                        (result.prepared.capture.captureNs - startNs) / 1_000_000L,
                                        1000L, signal?.reopenScore).map { it.javaClass.simpleName }
                                }
                                acceptedIndex = result.prepared.capture.input.index
                            }
                            results += result
                        }
                        val eligible = if (mode == "dual") workers else workers.take(1)
                        selected = eligible.firstOrNull { free[it] == true }
                        if (selected != null) {
                            if (mode == "prepared") { prepared = ready; ready = null }
                            else { captured = raw; raw = null }
                            if (prepared != null || captured != null) { free[selected!!] = false; lock.notifyAll() }
                            else selected = null
                        }
                        if (selected == null) {
                            if (sourceDone && raw == null && ready == null && !preparing && free.values.all { it }) finished = true
                            else lock.wait()
                        }
                    }
                    if (finished) break
                    val worker = selected ?: continue
                    val frame = prepared ?: prepare(captured!!)
                    worker.executor.execute {
                        val timestampMs = if (periodMs == 0L) (frame.capture.input.index + 30L) * 100L else
                            3000L + (frame.capture.captureNs - startNs) / 1_000_000L
                        val result = worker.infer(frame, timestampMs)
                        synchronized(lock) { completions.add(worker to result); lock.notifyAll() }
                    }
                }
                endNs = System.nanoTime(); cpuEndMs = Process.getElapsedCpuTime()
            } finally {
                synchronized(lock) { stopped = true; lock.notifyAll() }
                producer.interrupt(); preparer?.interrupt()
                producer.join(); preparer?.join()
                // Queue a barrier behind accepted native calls before freeing prepared buffers.
                workers.forEach { it.executor.submit { }.get() }
                ready?.close()
            }
            assertEquals("Owned image leak", 0, owned.get())
            assertTrue("Unbounded prepared images", peakOwned.get() <= 3)
            assertEquals(inputs.size, results.size + droppedRaw + droppedReady)
            assertTrue(results.isNotEmpty())
            if (periodMs == 0L) { assertEquals(inputs.size, results.size); assertEquals(0, droppedRaw + droppedReady) }
            val output = JSONObject().put("run", runId).put("mode", mode).put("pairedModels", paired)
                .put("frameWidth", frameWidth).put("frameHeight", frameWidth * 3 / 4)
                .put("periodMs", periodMs).put("inputFrames", inputs.size).put("preparations", preparations.get())
                .put("droppedRaw", droppedRaw).put("droppedPrepared", droppedReady).put("peakOwnedImages", peakOwned.get())
                .put("elapsedMs", (endNs-startNs)/1e6).put("processCpuMs", cpuEndMs-cpuStartMs)
                .put("warmupPerWorker", 30).put("nativeTimestampPolicy", "capture-time when paced; source-time when saturated")
                .put("classifier", "default BlinkGestureClassifier; 1000ms hold; missing-frame nulls; no user calibration or UI").put("source", "public manifest; camera-equivalent copy/rotation preserves every pixel")
                .put("samples", JSONArray().apply { results.forEach { row ->
                    fun ms(ns: Long) = (ns-startNs)/1e6
                    put(JSONObject().put("frame", row.prepared.capture.input.index).put("backend", row.backend)
                        .put("captureMs", ms(row.prepared.capture.captureNs)).put("arrivalMs", ms(row.prepared.capture.arrivalNs))
                        .put("prepareBeginMs", ms(row.prepared.beginNs)).put("prepareEndMs", ms(row.prepared.endNs))
                        .put("inferenceBeginMs", ms(row.beginNs)).put("inferenceEndMs", ms(row.endNs))
                        .put("completedMs", ms(row.completedNs)).put("deliveredMs", ms(row.deliveredNs))
                        .put("accepted", row.accepted).put("present", row.points.isNotEmpty()).put("events", JSONArray(row.emitted))
                        .put("scores", JSONObject(row.scores)).put("landmarks", JSONArray(row.points.toList())))
                } })
            if (manifest.has("expectedActivations")) output.put("stimulusCases", manifest.getJSONArray("cases"))
            File(directory, "$runId.json").writeText(output.toString())
            if (manifest.has("expectedActivations")) {
                assertEquals("Unexpected classifier activation count", manifest.getInt("expectedActivations"),
                    results.sumOf { row -> row.emitted.count { it == "Activated" } })
                val cases = manifest.getJSONArray("cases")
                for (index in 0 until cases.length()) {
                    val case = cases.getJSONObject(index)
                    val observed = results.count { row ->
                        val captureMs = (row.prepared.capture.captureNs-startNs)/1e6
                        "Activated" in row.emitted && captureMs >= case.getDouble("startMs") && captureMs < case.getDouble("endMs")
                    }
                    assertEquals(case.getString("id"), case.getInt("expectedActivations"), observed)
                }
            }
        } finally { workers.asReversed().forEach { it.close() } }
    }
}
