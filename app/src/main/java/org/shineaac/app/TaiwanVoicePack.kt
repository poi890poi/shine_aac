package org.shineaac.app

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject

internal class TaiwanVoicePack(
    context: Context,
    private val manifestPath: String,
) {
    private val applicationContext = context.applicationContext
    private val packRoot = manifestPath.substringBeforeLast('/')
    private val mainHandler = Handler(Looper.getMainLooper())
    private val entries: Map<String, VoiceClip>
    private val segmentationKeys: List<String>
    private var activePlayer: MediaPlayer? = null
    private var playbackGeneration = 0L

    val available: Boolean
        get() = entries.isNotEmpty()

    val previewText: String

    init {
        val manifest = try {
            applicationContext.assets.open(manifestPath).bufferedReader(Charsets.UTF_8).use {
                JSONObject(it.readText())
            }
        } catch (error: Exception) {
            Log.e(LogTag, "Could not load the built-in Taiwan voice pack", error)
            JSONObject()
        }
        previewText = manifest.optString("previewText", DefaultPreviewText)
        val loadedEntries = linkedMapOf<String, VoiceClip>()
        val manifestEntries = manifest.optJSONArray("entries")
        if (manifestEntries != null) {
            for (index in 0 until manifestEntries.length()) {
                val item = manifestEntries.optJSONObject(index) ?: continue
                val text = normalizedText(item.optString("text"))
                val audio = item.optString("audio")
                if (text.isBlank() || audio.isBlank()) continue
                loadedEntries[text] = VoiceClip(
                    text = text,
                    zhuyin = item.optString("zhuyin"),
                    assetPath = "$packRoot/$audio",
                )
            }
        }
        entries = loadedEntries
        segmentationKeys = entries.keys
            .filterNot { it == normalizedText(previewText) }
            .sortedWith(compareByDescending<String> { it.length }.thenBy { it })
    }

    fun play(text: String): Boolean {
        val clips = clipsFor(text) ?: return false
        if (clips.isEmpty()) return false
        stop()
        val generation = playbackGeneration
        mainHandler.post { playNext(clips, 0, generation) }
        return true
    }

    fun playPreview(): Boolean = play(previewText)

    fun stop() {
        playbackGeneration += 1
        mainHandler.removeCallbacksAndMessages(null)
        releaseActivePlayer()
    }

    fun close() = stop()

    internal fun clipTextsFor(text: String): List<String>? =
        clipsFor(text)?.map { it.text }

    private fun clipsFor(rawText: String): List<VoiceClip>? {
        val text = normalizedText(rawText)
        if (text.isBlank()) return null
        entries[text]?.let { return listOf(it) }

        val clips = mutableListOf<VoiceClip>()
        var index = 0
        while (index < text.length) {
            val character = text[index]
            if (character.isWhitespace() || character in IgnoredPunctuation) {
                index += 1
                continue
            }
            val key = segmentationKeys.firstOrNull { candidate ->
                text.startsWith(candidate, index)
            } ?: return null
            clips += entries.getValue(key)
            index += key.length
        }
        return clips
    }

    private fun playNext(clips: List<VoiceClip>, index: Int, generation: Long) {
        if (generation != playbackGeneration || index >= clips.size) {
            releaseActivePlayer()
            return
        }

        val player = MediaPlayer()
        activePlayer = player
        try {
            applicationContext.assets.openFd(clips[index].assetPath).use { descriptor ->
                player.setDataSource(
                    descriptor.fileDescriptor,
                    descriptor.startOffset,
                    descriptor.length,
                )
            }
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            player.setOnCompletionListener {
                it.release()
                if (activePlayer === it) activePlayer = null
                mainHandler.postDelayed(
                    { playNext(clips, index + 1, generation) },
                    InterClipPauseMs,
                )
            }
            player.setOnErrorListener { failedPlayer, _, _ ->
                failedPlayer.release()
                if (activePlayer === failedPlayer) activePlayer = null
                true
            }
            player.prepare()
            player.start()
        } catch (error: Exception) {
            player.release()
            if (activePlayer === player) activePlayer = null
            Log.e(LogTag, "Could not play ${clips[index].assetPath}", error)
        }
    }

    private fun releaseActivePlayer() {
        activePlayer?.run {
            try {
                stop()
            } catch (_: IllegalStateException) {
                // A player that has not reached the prepared state cannot be stopped.
            }
            release()
        }
        activePlayer = null
    }

    private fun normalizedText(value: String): String =
        value.trim()
            .replace('，', ',')
            .replace('。', '.')
            .replace('？', '?')
            .replace('！', '!')

    private data class VoiceClip(
        val text: String,
        val zhuyin: String,
        val assetPath: String,
    )

    private companion object {
        const val DefaultPreviewText = "你好，我想喝水。重選。"
        const val InterClipPauseMs = 45L
        const val LogTag = "ShineAacVoicePack"
        val IgnoredPunctuation = setOf(',', '.', '?', '!', '…', '、', ';', ':', '；', '：')
    }
}
