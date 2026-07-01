package com.example.shineaac

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScannerStateTest {
    private val rowSizes = listOf(6, 4, 5)

    @Test
    fun rowScanningWrapsThroughRows() {
        val state = ScannerState(rowIndex = 2).advance(rowSizes.size) { rowSizes[it] }

        assertEquals(ScanStage.Rows, state.stage)
        assertEquals(0, state.rowIndex)
        assertEquals(0, state.cellIndex)
    }

    @Test
    fun confirmingRowMovesIntoCellsAtFirstCell() {
        val confirmation = ScannerState(rowIndex = 1).confirm(rowSizes.size) { rowSizes[it] }

        assertTrue(confirmation is ScannerConfirmation.NoSelection)
        val next = (confirmation as ScannerConfirmation.NoSelection).nextState
        assertEquals(ScanStage.Cells, next.stage)
        assertEquals(1, next.rowIndex)
        assertEquals(0, next.cellIndex)
    }

    @Test
    fun cellScanningUsesSelectedRowSize() {
        val state = ScannerState(
            stage = ScanStage.Cells,
            rowIndex = 1,
            cellIndex = 3
        ).advance(rowSizes.size) { rowSizes[it] }

        assertEquals(ScanStage.Cells, state.stage)
        assertEquals(1, state.rowIndex)
        assertEquals(0, state.cellIndex)
    }

    @Test
    fun confirmingCellReturnsSelectionAndResetsToRows() {
        val confirmation = ScannerState(
            stage = ScanStage.Cells,
            rowIndex = 2,
            cellIndex = 4
        ).confirm(rowSizes.size) { rowSizes[it] }

        assertTrue(confirmation is ScannerConfirmation.Selected)
        val selected = confirmation as ScannerConfirmation.Selected
        assertEquals(2, selected.rowIndex)
        assertEquals(4, selected.cellIndex)
        assertEquals(ScannerState(stage = ScanStage.Rows, rowIndex = 2, cellIndex = 0), selected.nextState)
    }
}
