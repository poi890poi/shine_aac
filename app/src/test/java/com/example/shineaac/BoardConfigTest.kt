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
            UNDO=<undo>
            SAY=<speak>
            CLR=<clear>
            """.trimIndent()
        )

        assertEquals(6, symbols.size)
        assertEquals(CommunicationTile("WATCH", "watch"), symbols[0])
        assertEquals(TileAction.Space, symbols[1].action)
        assertEquals(TileAction.Backspace, symbols[2].action)
        assertEquals(TileAction.Undo, symbols[3].action)
        assertEquals(TileAction.Speak, symbols[4].action)
        assertEquals(TileAction.Clear, symbols[5].action)
    }

    @Test
    fun configChunksSymbolsByColumnCount() {
        val rows = BoardConfig(
            columns = 3,
            suggestionDictionary = emptyList(),
            symbols = listOf(
                CommunicationTile("A"),
                CommunicationTile("B"),
                CommunicationTile("C"),
                CommunicationTile("D")
            )
        ).rows()

        val symbolRows = rows.drop(1)
        assertEquals(2, symbolRows.size)
        assertEquals(listOf("A", "B", "C"), symbolRows[0].map { it.label })
        assertEquals(listOf("D"), symbolRows[1].map { it.label })
    }

    @Test
    fun suggestionsCompleteCurrentPartialWord() {
        val suggestions = suggestTiles(
            message = "wa",
            dictionary = DefaultSuggestionDictionary,
            maxSuggestions = 4
        ).map { it.label }

        assertTrue(suggestions.contains("WANT"))
        assertTrue(suggestions.contains("WATER"))
        assertTrue(suggestions.contains("WATCH"))
    }

    @Test
    fun suggestionsPreferActionsAfterPronoun() {
        val suggestions = suggestTiles(
            message = "I ",
            dictionary = DefaultSuggestionDictionary,
            maxSuggestions = 4
        ).map { it.label }

        assertTrue(suggestions.contains("WANT"))
        assertTrue(suggestions.contains("NEED"))
    }

    @Test
    fun boardAddsSpecialSuggestionRowBeforeStaticRows() {
        val rows = BoardConfig(columns = 4).rows("I ")

        assertEquals(4, rows.first().size)
        assertTrue(rows.first().map { it.label }.contains("WANT"))
        assertTrue(rows.drop(1).flatten().map { it.label }.contains("SPC"))
    }

    @Test
    fun suggestionRowKeepsStableWidthWithSpaceAndLetterFallbacks() {
        val row = suggestionRow(
            message = "want",
            dictionary = DefaultSuggestionDictionary,
            columns = 4
        )

        assertEquals(4, row.size)
        assertEquals(listOf("SPC", "E", "T", ""), row.map { it.label })
    }

    @Test
    fun exactCurrentWordIsNotSuggestedAgain() {
        val suggestions = suggestTiles(
            message = "want",
            dictionary = DefaultSuggestionDictionary,
            maxSuggestions = 3
        )

        assertTrue(suggestions.none { it.label == "WANT" })
    }

    @Test
    fun suggestionsPreferNeedsAfterWantBoundary() {
        val suggestions = suggestTiles(
            message = "want ",
            dictionary = DefaultSuggestionDictionary,
            maxSuggestions = 3
        ).map { it.label }

        assertEquals(3, suggestions.size)
        assertTrue(suggestions.contains("WATER"))
        assertTrue(suggestions.contains("FOOD"))
    }

    @Test
    fun suggestionRowCanOfferUndoWithoutChangingWidth() {
        val row = suggestionRow(
            message = "wa",
            dictionary = DefaultSuggestionDictionary,
            columns = 4,
            canUndo = true
        )

        assertEquals(4, row.size)
        assertEquals("UNDO", row[0].label)
        assertEquals(TileAction.Undo, row[0].action)
        assertTrue(row.map { it.label }.contains("SPC"))
    }

    @Test
    fun boardSuggestionRowCanSuggestSpaceAndFallbackLetters() {
        val row = BoardConfig(columns = 4).rows("want").first()

        assertEquals(listOf("SPC", "E", "T", ""), row.map { it.label })
    }
}
