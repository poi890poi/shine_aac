package org.shineaac.app

import org.junit.Assert.assertEquals
import org.junit.Test

class BoardColumnsTest {
    @Test
    fun migratesUnsupportedSmallBoardsToFourColumns() {
        assertEquals(4, normalizedBoardColumns(null))
        assertEquals(4, normalizedBoardColumns(1))
        assertEquals(4, normalizedBoardColumns(2))
    }

    @Test
    fun preservesSupportedColumnsAndCapsTheMaximum() {
        assertEquals(3, normalizedBoardColumns(3))
        assertEquals(4, normalizedBoardColumns(4))
        assertEquals(8, normalizedBoardColumns(8))
        assertEquals(8, normalizedBoardColumns(9))
    }
}
