package com.example.shineaac

enum class ScanStage {
    Rows,
    RowSelected,
    FirstCell,
    Cells
}

data class ScannerState(
    val stage: ScanStage = ScanStage.Rows,
    val rowIndex: Int = 0,
    val cellIndex: Int = 0
) {
    fun advance(rowCount: Int, columnCountForRow: (Int) -> Int): ScannerState {
        if (rowCount <= 0) return this

        return when (stage) {
            ScanStage.Rows -> copy(
                rowIndex = nextSelectableRow(rowCount, columnCountForRow),
                cellIndex = 0
            )

            ScanStage.RowSelected -> copy(stage = ScanStage.FirstCell, cellIndex = 0)

            ScanStage.FirstCell -> {
                val columns = columnCountForRow(rowIndex).coerceAtLeast(1)
                copy(stage = ScanStage.Cells, cellIndex = if (columns == 1) 0 else 1)
            }

            ScanStage.Cells -> {
                val columns = columnCountForRow(rowIndex).coerceAtLeast(1)
                copy(cellIndex = (cellIndex + 1).floorMod(columns))
            }
        }
    }

    fun confirm(rowCount: Int, columnCountForRow: (Int) -> Int): ScannerConfirmation {
        if (rowCount <= 0) return ScannerConfirmation.NoSelection(this)

        return when (stage) {
            ScanStage.Rows -> {
                val safeRow = rowIndex.coerceIn(0, rowCount - 1)
                ScannerConfirmation.NoSelection(
                    copy(stage = ScanStage.RowSelected, rowIndex = safeRow, cellIndex = 0)
                )
            }

            ScanStage.RowSelected -> ScannerConfirmation.NoSelection(this)

            ScanStage.FirstCell -> {
                val safeRow = rowIndex.coerceIn(0, rowCount - 1)
                ScannerConfirmation.Selected(
                    rowIndex = safeRow,
                    cellIndex = 0,
                    nextState = ScannerState(stage = ScanStage.Rows, rowIndex = safeRow, cellIndex = 0)
                )
            }

            ScanStage.Cells -> {
                val safeRow = rowIndex.coerceIn(0, rowCount - 1)
                val columns = columnCountForRow(safeRow).coerceAtLeast(1)
                ScannerConfirmation.Selected(
                    rowIndex = safeRow,
                    cellIndex = cellIndex.coerceIn(0, columns - 1),
                    nextState = ScannerState(stage = ScanStage.Rows, rowIndex = safeRow, cellIndex = 0)
                )
            }
        }
    }

    fun confirmWithLatencyCompensation(
        rowCount: Int,
        columnCountForRow: (Int) -> Int,
        elapsedInHighlightMs: Long,
        compensationWindowMs: Float
    ): ScannerConfirmation {
        val compensatedState = if (elapsedInHighlightMs in 0 until compensationWindowMs.toLong()) {
            previousHighlight(rowCount, columnCountForRow)
        } else {
            this
        }

        return compensatedState.confirm(rowCount, columnCountForRow)
    }

    private fun previousHighlight(rowCount: Int, columnCountForRow: (Int) -> Int): ScannerState {
        if (rowCount <= 0) return this

        return when (stage) {
            ScanStage.Rows -> this
            ScanStage.Cells -> {
                val columns = columnCountForRow(rowIndex).coerceAtLeast(1)
                copy(cellIndex = (cellIndex - 1).floorMod(columns))
            }
            ScanStage.RowSelected,
            ScanStage.FirstCell -> this
        }
    }

    private fun nextSelectableRow(rowCount: Int, columnCountForRow: (Int) -> Int): Int {
        if (rowCount <= 0) return rowIndex

        for (offset in 1..rowCount) {
            val candidate = (rowIndex + offset).floorMod(rowCount)
            if (columnCountForRow(candidate) > 0) return candidate
        }

        return rowIndex
    }

    private fun Int.floorMod(modulus: Int): Int = ((this % modulus) + modulus) % modulus
}

sealed class ScannerConfirmation {
    data class NoSelection(val nextState: ScannerState) : ScannerConfirmation()
    data class Selected(
        val rowIndex: Int,
        val cellIndex: Int,
        val nextState: ScannerState
    ) : ScannerConfirmation()
}
