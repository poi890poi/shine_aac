package org.shineaac.inputs

import android.util.Log

/** Opt-in debug telemetry; never records images, landmarks or expression scores. */
internal class FaceFrameProfile(
    private val backend: String,
    private val width: Int,
    private val height: Int,
    private val frameMs: Long
) {
    private val started = System.nanoTime()
    private var previous = started
    private val stages = StringBuilder()

    fun mark(name: String) {
        val now = System.nanoTime()
        stages.append(' ').append(name).append("Us=").append((now - previous) / 1000L)
        previous = now
    }

    fun finish(usable: Boolean?) {
        mark("resultCleanup")
        Log.i("ShineFaceAnalysis", "FACE_STAGE backend=$backend frameMs=$frameMs width=$width height=$height" +
            " usable=$usable totalUs=${(previous - started) / 1000L}$stages")
    }
}
