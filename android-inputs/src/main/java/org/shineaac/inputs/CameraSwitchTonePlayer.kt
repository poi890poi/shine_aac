package org.shineaac.inputs

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.sin
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CameraSwitchTonePlayer {
    @Volatile
    private var released = false
    private val playing = AtomicBoolean(false)
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "ShineCameraSwitchTone").apply {
            isDaemon = true
        }
    }

    fun playStart() {
        playSequence(listOf(Tone(660, 140)))
    }

    fun playSetupShortBlink() {
        playSequence(listOf(Tone(1047, 55)))
    }

    fun playHoldReached() {
        playSequence(listOf(Tone(440, 300)))
    }

    fun playLongAccepted() {
        playSequence(listOf(Tone(880, 95), Tone(0, 80), Tone(1175, 140)))
    }

    fun release() {
        released = true
        executor.shutdownNow()
    }

    private fun playSequence(tones: List<Tone>) {
        if (released) return
        if (!playing.compareAndSet(false, true)) return
        executor.execute {
            try {
                if (!released) playTones(tones)
            } finally {
                playing.set(false)
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun playTones(tones: List<Tone>) {
        val totalMs = PaddingMs + tones.sumOf { it.durationMs } + PaddingMs
        val sampleCount = SampleRateHz * totalMs / 1000
        val buffer = ByteArray(sampleCount * 2)
        var cursor = SampleRateHz * PaddingMs / 1000
        tones.forEach { tone ->
            val toneSamples = SampleRateHz * tone.durationMs / 1000
            if (tone.frequencyHz > 0) {
                writeTone(buffer, cursor, toneSamples, tone.frequencyHz)
            }
            cursor += toneSamples
        }
        val minBufferSize = AudioTrack.getMinBufferSize(
            SampleRateHz,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val track = AudioTrack(
            AudioManager.STREAM_MUSIC,
            SampleRateHz,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(buffer.size, minBufferSize),
            AudioTrack.MODE_STATIC
        )
        try {
            track.write(buffer, 0, buffer.size)
            track.play()
            Thread.sleep(totalMs.toLong() + 80L)
        } finally {
            track.release()
        }
    }

    private fun writeTone(buffer: ByteArray, startSample: Int, sampleCount: Int, frequencyHz: Int) {
        val fadeSamples = minOf(sampleCount / 3, SampleRateHz * FadeMs / 1000)
        for (i in 0 until sampleCount) {
            val fadeIn = if (fadeSamples == 0) 1.0 else (i.toDouble() / fadeSamples).coerceAtMost(1.0)
            val fadeOut = if (fadeSamples == 0) 1.0 else ((sampleCount - i - 1).toDouble() / fadeSamples).coerceAtMost(1.0)
            val envelope = minOf(fadeIn, fadeOut)
            val sample = (sin(2.0 * PI * frequencyHz * i / SampleRateHz) * Short.MAX_VALUE * Volume * envelope).toInt()
            val bufferIndex = (startSample + i) * 2
            buffer[bufferIndex] = (sample and 0xff).toByte()
            buffer[bufferIndex + 1] = ((sample shr 8) and 0xff).toByte()
        }
    }

    private data class Tone(val frequencyHz: Int, val durationMs: Int)

    private companion object {
        const val SampleRateHz = 44100
        const val Volume = 0.18
        const val FadeMs = 18
        const val PaddingMs = 12
    }
}
