package org.shineaac.inputs

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.sin

class CameraSwitchTonePlayer {
    @Volatile
    private var released = false

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
    }

    private fun playSequence(tones: List<Tone>) {
        Thread({
            if (released) return@Thread
            tones.forEach { tone ->
                if (released) return@Thread
                if (tone.frequencyHz <= 0) {
                    Thread.sleep(tone.durationMs.toLong())
                } else {
                    playTone(tone.frequencyHz, tone.durationMs)
                }
            }
        }, "ShineCameraSwitchTone").start()
    }

    @Suppress("DEPRECATION")
    private fun playTone(frequencyHz: Int, durationMs: Int) {
        val sampleCount = SampleRateHz * durationMs / 1000
        val buffer = ByteArray(sampleCount * 2)
        val fadeSamples = minOf(sampleCount / 4, SampleRateHz / 100)
        for (i in 0 until sampleCount) {
            val fadeIn = if (fadeSamples == 0) 1.0 else (i.toDouble() / fadeSamples).coerceAtMost(1.0)
            val fadeOut = if (fadeSamples == 0) 1.0 else ((sampleCount - i).toDouble() / fadeSamples).coerceAtMost(1.0)
            val envelope = minOf(fadeIn, fadeOut)
            val sample = (sin(2.0 * PI * frequencyHz * i / SampleRateHz) * Short.MAX_VALUE * Volume * envelope).toInt()
            buffer[i * 2] = (sample and 0xff).toByte()
            buffer[i * 2 + 1] = ((sample shr 8) and 0xff).toByte()
        }
        val track = AudioTrack(
            AudioManager.STREAM_MUSIC,
            SampleRateHz,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            buffer.size,
            AudioTrack.MODE_STATIC
        )
        try {
            track.write(buffer, 0, buffer.size)
            track.play()
            Thread.sleep(durationMs.toLong() + 40L)
        } finally {
            track.release()
        }
    }

    private data class Tone(val frequencyHz: Int, val durationMs: Int)

    private companion object {
        const val SampleRateHz = 16000
        const val Volume = 0.55
    }
}
