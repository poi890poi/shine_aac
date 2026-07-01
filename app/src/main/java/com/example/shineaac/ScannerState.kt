package com.example.shineaac

enum class ScanStage {
    Rows,
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
                rowIndex = (rowIndex + 1).floorMod(rowCount),
                cellIndex = 0
            )

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
                    copy(stage = ScanStage.Cells, rowIndex = safeRow, cellIndex = 0)
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
