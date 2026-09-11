package org.shineaac.app

import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.shineaac.inputs.CheekFaceAnalyzer
import java.io.File
import java.security.MessageDigest

/** Explicit opt-in benchmark using only host-verified public manifest fixtures. */
@RunWith(AndroidJUnit4::class)
class FaceBackendBenchmarkTest {
    @Test fun licensedFrameSequence() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val args = InstrumentationRegistry.getArguments()
        assumeTrue("Select this benchmark explicitly", args.getString("class") == javaClass.name)
        val runId = requireNotNull(args.getString("benchmarkRun"))
        require(runId.matches(Regex("[a-z0-9-]+")))
        val directory = File(instrumentation.targetContext.cacheDir, "public-face-benchmark")
        val manifest = JSONObject(File(directory, "manifest.json").readText())
        assertEquals("testdata/optical-rig/sources.json", manifest.getString("sourceManifest"))
        val frames = manifest.getJSONArray("frames")
        val images = (0 until frames.length()).map { index ->
            val entry = frames.getJSONObject(index)
            val name = entry.getString("file")
            require(name.matches(Regex("frame-[0-9]+\\.png")))
            val bytes = File(directory, name).readBytes()
            val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            assertEquals(entry.getString("sha256"), hash)
            requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size))
        }
        val samples = JSONArray()
        val initStart = SystemClock.elapsedRealtimeNanos()
        val analyzer = CheekFaceAnalyzer(instrumentation.targetContext)
        val initMs = (SystemClock.elapsedRealtimeNanos() - initStart) / 1e6
        try {
            // BitmapImageBuilder/MPImage takes ownership of each submitted bitmap.
            // Keep immutable fixture images intact; copy outside timed inference.
            repeat(30) {
                val owned = images[it % images.size].copy(Bitmap.Config.ARGB_8888, false)
                analyzer.analyzeBitmapForCamera(owned, it * 100L)
            }
            images.forEachIndexed { index, bitmap ->
                assertFalse("Fixture bitmap was consumed by a previous sample", bitmap.isRecycled)
                val owned = bitmap.copy(Bitmap.Config.ARGB_8888, false)
                val start = SystemClock.elapsedRealtimeNanos()
                val result = analyzer.analyzeBitmapForCamera(owned, (index + 30L) * 100L)
                val elapsed = (SystemClock.elapsedRealtimeNanos() - start) / 1e6
                samples.put(JSONObject().put("frame", index).put("durationMs", elapsed)
                    .put("present", result != null).put("usable", result?.usable == true)
                    .put("blendshapes", JSONObject(result?.blendshapes ?: emptyMap<String, Double>())))
            }
        } finally {
            analyzer.close()
            assertTrue("Fixture ownership changed", images.none { it.isRecycled })
            images.forEach { it.recycle() }
        }
        File(directory, "$runId.json").writeText(JSONObject()
            .put("run", runId).put("requestedBackend", args.getString("requestedBackend"))
            .put("initMs", initMs).put("warmupFrames", 30)
            .put("boundary", "bitmap-to-observation, excluding image decode/camera/preprocessing")
            .put("samples", samples).toString())
        assertEquals(images.size, samples.length())
        assertTrue("No face observed", (0 until samples.length()).any { samples.getJSONObject(it).getBoolean("present") })
    }
}
