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
