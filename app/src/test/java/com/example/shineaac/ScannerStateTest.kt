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
    fun confirmingRowMovesIntoTransitionPauseAtFirstCell() {
        val confirmation = ScannerState(rowIndex = 1).confirm(rowSizes.size) { rowSizes[it] }

        assertTrue(confirmation is ScannerConfirmation.NoSelection)
        val next = (confirmation as ScannerConfirmation.NoSelection).nextState
        assertEquals(ScanStage.RowSelected, next.stage)
        assertEquals(1, next.rowIndex)
        assertEquals(0, next.cellIndex)
    }

    @Test
    fun advancingTransitionPauseStartsCellScanningAtFirstCell() {
        val state = ScannerState(
            stage = ScanStage.RowSelected,
            rowIndex = 1,
            cellIndex = 0
        ).advance(rowSizes.size) { rowSizes[it] }

        assertEquals(ScanStage.FirstCell, state.stage)
        assertEquals(1, state.rowIndex)
        assertEquals(0, state.cellIndex)
    }

    @Test
    fun confirmingDuringTransitionPauseDoesNotSelectFirstCell() {
        val confirmation = ScannerState(
            stage = ScanStage.RowSelected,
            rowIndex = 1,
            cellIndex = 0
        ).confirm(rowSizes.size) { rowSizes[it] }

        assertTrue(confirmation is ScannerConfirmation.NoSelection)
        val next = (confirmation as ScannerConfirmation.NoSelection).nextState
        assertEquals(ScanStage.RowSelected, next.stage)
        assertEquals(1, next.rowIndex)
        assertEquals(0, next.cellIndex)
    }

    @Test
    fun firstCellCanBeSelectedDuringExtendedHold() {
        val confirmation = ScannerState(
            stage = ScanStage.FirstCell,
            rowIndex = 1,
            cellIndex = 0
        ).confirm(rowSizes.size) { rowSizes[it] }

        assertTrue(confirmation is ScannerConfirmation.Selected)
        val selected = confirmation as ScannerConfirmation.Selected
        assertEquals(1, selected.rowIndex)
        assertEquals(0, selected.cellIndex)
    }

    @Test
    fun advancingFirstCellMovesToSecondCellWhenAvailable() {
        val state = ScannerState(
            stage = ScanStage.FirstCell,
            rowIndex = 1,
            cellIndex = 0
        ).advance(rowSizes.size) { rowSizes[it] }

        assertEquals(ScanStage.Cells, state.stage)
        assertEquals(1, state.rowIndex)
        assertEquals(1, state.cellIndex)
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

    @Test
    fun earlyRowActivationSelectsPreviousRowForLatencyCompensation() {
        val confirmation = ScannerState(
            stage = ScanStage.Rows,
            rowIndex = 2
        ).confirmWithLatencyCompensation(
            rowCount = rowSizes.size,
            columnCountForRow = { rowSizes[it] },
            elapsedInHighlightMs = 120,
            compensationWindowMs = 250f
        )

        assertTrue(confirmation is ScannerConfirmation.NoSelection)
        val next = (confirmation as ScannerConfirmation.NoSelection).nextState
        assertEquals(ScanStage.RowSelected, next.stage)
        assertEquals(1, next.rowIndex)
    }

    @Test
    fun earlyCellActivationSelectsPreviousCellForLatencyCompensation() {
        val confirmation = ScannerState(
            stage = ScanStage.Cells,
            rowIndex = 1,
            cellIndex = 2
        ).confirmWithLatencyCompensation(
            rowCount = rowSizes.size,
            columnCountForRow = { rowSizes[it] },
            elapsedInHighlightMs = 120,
            compensationWindowMs = 250f
        )

        assertTrue(confirmation is ScannerConfirmation.Selected)
        val selected = confirmation as ScannerConfirmation.Selected
        assertEquals(1, selected.rowIndex)
        assertEquals(1, selected.cellIndex)
    }

    @Test
    fun lateCellActivationUsesCurrentCell() {
        val confirmation = ScannerState(
            stage = ScanStage.Cells,
            rowIndex = 1,
            cellIndex = 2
        ).confirmWithLatencyCompensation(
            rowCount = rowSizes.size,
            columnCountForRow = { rowSizes[it] },
            elapsedInHighlightMs = 400,
            compensationWindowMs = 250f
        )

        assertTrue(confirmation is ScannerConfirmation.Selected)
        val selected = confirmation as ScannerConfirmation.Selected
        assertEquals(1, selected.rowIndex)
        assertEquals(2, selected.cellIndex)
    }
}
