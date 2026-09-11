package org.shineaac.app

import android.graphics.BitmapFactory
import android.os.SystemClock
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
import java.io.File
import java.security.MessageDigest

/** Diagnostic ablation only: without expression scores this cannot drive SHINE. */
@RunWith(AndroidJUnit4::class)
class FaceSubgraphBenchmarkTest {
    @Test fun measureExpressionModelCost() {
        assumeTrue("Select this benchmark explicitly",
            InstrumentationRegistry.getArguments().getString("class") == javaClass.name)
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val directory = File(context.cacheDir, "public-face-benchmark")
        val manifest = JSONObject(File(directory, "manifest.json").readText())
        assertEquals("testdata/optical-rig/sources.json", manifest.getString("sourceManifest"))
        val frames = manifest.getJSONArray("frames")
        val images = (0 until frames.length()).map { index ->
            val entry = frames.getJSONObject(index)
            val name = entry.getString("file")
            require(name.matches(Regex("frame-[0-9]+\\.png")))
            val bytes = File(directory, name).readBytes()
            assertEquals(entry.getString("sha256"), MessageDigest.getInstance("SHA-256")
                .digest(bytes).joinToString("") { "%02x".format(it) })
            BitmapImageBuilder(requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size))).build()
        }
        val output = JSONArray()
        try {
            for (delegate in listOf(Delegate.CPU, Delegate.GPU)) {
                for (expressions in listOf(true, false, false, true)) {
                    val buffer = CheekModelResource.loadManagedBuffer(context)
                    val options = BaseOptions.builder().setDelegate(delegate).apply {
                        if (buffer != null) setModelAssetBuffer(buffer)
                        else setModelAssetPath(CheekModelResource.FileName)
                    }.build()
                    // Creation, synchronous VIDEO inference and close all run
                    // on this one instrumentation thread for each task.
                    val task = FaceLandmarker.createFromOptions(context,
                        FaceLandmarker.FaceLandmarkerOptions.builder().setBaseOptions(options)
                            .setRunningMode(RunningMode.VIDEO).setNumFaces(1)
                            .setMinFaceDetectionConfidence(.55f).setMinFacePresenceConfidence(.55f)
                            .setMinTrackingConfidence(.55f).setOutputFaceBlendshapes(expressions).build())
                    val samples = JSONArray()
                    var present = 0
                    try {
                        repeat(30) { task.detectForVideo(images[it % images.size], it * 100L) }
                        images.forEachIndexed { index, image ->
                            val start = SystemClock.elapsedRealtimeNanos()
                            val result = task.detectForVideo(image, (index + 30L) * 100)
                            samples.put((SystemClock.elapsedRealtimeNanos() - start) / 1e6)
                            if (result.faceLandmarks().isNotEmpty()) present++
                        }
                    } finally { task.close() }
                    output.put(JSONObject().put("backend", delegate.name).put("expressions", expressions)
                        .put("present", present).put("warmupFrames", 30).put("durationMs", samples))
                }
            }
        } finally { images.forEach { it.close() } }
        File(directory, "subgraph-ablation.json").writeText(output.toString())
        assertEquals(8, output.length())
    }
}
