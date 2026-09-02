package org.shineaac.app

import java.util.Locale
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpeechVoiceLocalePolicyTest {
    @Test
    fun `voice selection includes Chinese and English locales`() {
        assertTrue(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("zh-TW")))
        assertTrue(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("zh-CN")))
        assertTrue(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("en-US")))
        assertTrue(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("en-GB")))
    }

    @Test
    fun `voice selection excludes unrelated locales`() {
        assertFalse(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("fr-FR")))
        assertFalse(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("ja-JP")))
        assertFalse(isSupportedSpeechVoiceLocale(Locale.forLanguageTag("ko-KR")))
        assertFalse(isSupportedSpeechVoiceLocale(Locale.ROOT))
    }
}
