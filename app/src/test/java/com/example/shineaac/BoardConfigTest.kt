package com.example.shineaac

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BoardConfigTest {
    @Test
    fun defaultTilesIncludeFullAlphabet() {
        val labels = DefaultTiles.map { it.label }.toSet()

        ('A'..'Z').forEach { letter ->
            assertTrue("Missing $letter", labels.contains(letter.toString()))
        }
    }

    @Test
    fun defaultLettersStartWithCommonEnglishFrequencyOrder() {
        val spellingStart = DefaultTiles.indexOfFirst { it.action == TileAction.Space } + 1
        val letters = DefaultTiles.drop(spellingStart)
            .filter { it.action == TileAction.Append && it.label.length == 1 && it.label.first().isLetter() }
            .map { it.label }

        assertEquals(listOf("E", "T", "A", "O", "I", "N", "S", "R"), letters.take(8))
    }

    @Test
    fun legacyAlphabetDefaultMigratesToFrequencyOrder() {
        val symbols = loadSymbolsForConfig(
            storedSymbols = serializeSymbols(LegacyAlphabetDefaultTiles),
            storedVersion = 1
        )
        val spellingStart = symbols.indexOfFirst { it.action == TileAction.Space } + 1
        val letters = symbols.drop(spellingStart)
            .filter { it.action == TileAction.Append && it.label.length == 1 && it.label.first().isLetter() }
            .map { it.label }

        assertEquals(listOf("E", "T", "A", "O", "I", "N", "S", "R"), letters.take(8))
    }

    @Test
    fun currentVersionCustomAlphabetOrderDoesNotMigrate() {
        val symbols = loadSymbolsForConfig(
            storedSymbols = serializeSymbols(LegacyAlphabetDefaultTiles),
            storedVersion = CurrentConfigVersion
        )
        val spellingStart = symbols.indexOfFirst { it.action == TileAction.Space } + 1
        val letters = symbols.drop(spellingStart)
            .filter { it.action == TileAction.Append && it.label.length == 1 && it.label.first().isLetter() }
            .map { it.label }

        assertEquals(listOf("A", "B", "C", "D", "E", "F", "G", "H"), letters.take(8))
    }

    @Test
    fun previousFrequencyDefaultMigratesToCurrentFrequencyOrder() {
        val symbols = loadSymbolsForConfig(
            storedSymbols = serializeSymbols(LegacyFrequencyDefaultTilesV3),
            storedVersion = 3
        )
        val spellingStart = symbols.indexOfFirst { it.action == TileAction.Space } + 1
        val letters = symbols.drop(spellingStart)
            .filter { it.action == TileAction.Append && it.label.length == 1 && it.label.first().isLetter() }
            .map { it.label }

        assertEquals(listOf("E", "T", "A", "O", "I", "N", "S", "R"), letters.take(8))
    }

    @Test
    fun parserSupportsCustomWordsAndActions() {
        val symbols = parseSymbols(
            """
            WATCH=watch
            SPC=<space>
            DEL=<delete>
            SAY=<speak>
            CLR=<clear>
            """.trimIndent()
        )

        assertEquals(5, symbols.size)
        assertEquals(CommunicationTile("WATCH", "watch"), symbols[0])
        assertEquals(TileAction.Space, symbols[1].action)
        assertEquals(TileAction.Backspace, symbols[2].action)
        assertEquals(TileAction.Speak, symbols[3].action)
        assertEquals(TileAction.Clear, symbols[4].action)
    }

    @Test
    fun configChunksSymbolsByColumnCount() {
        val rows = BoardConfig(
            columns = 3,
            symbols = listOf(
                CommunicationTile("A"),
                CommunicationTile("B"),
                CommunicationTile("C"),
                CommunicationTile("D")
            )
        ).rows()

        assertEquals(2, rows.size)
        assertEquals(listOf("A", "B", "C"), rows[0].map { it.label })
        assertEquals(listOf("D"), rows[1].map { it.label })
    }
}
