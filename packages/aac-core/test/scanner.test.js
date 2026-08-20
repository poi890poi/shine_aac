import test from "node:test";
import assert from "node:assert/strict";
import {
  ScanMode,
  ScanStage,
  advanceScanner,
  confirmScanner,
  confirmWithLatencyCompensation,
  createScannerState,
  scanAccessCost,
  scanDurationForStage,
  scanRecognitionLoad,
  scanRowBlocks,
  scanSelectableCellIndices
} from "../src/index.js";

const rowSizes = [6, 4, 5];
const columnCountForRow = (row) => rowSizes[row];

test("row scanning wraps through selectable rows", () => {
  const state = advanceScanner(createScannerState({ rowIndex: 2 }), rowSizes.length, columnCountForRow);
  assert.equal(state.stage, ScanStage.Rows);
  assert.equal(state.rowIndex, 0);
  assert.equal(state.cellIndex, 0);
});

test("confirming a row enters the transition pause", () => {
  const confirmation = confirmScanner(createScannerState({ rowIndex: 1 }), rowSizes.length, columnCountForRow);
  assert.equal(confirmation.type, "none");
  assert.equal(confirmation.nextState.stage, ScanStage.RowSelected);
  assert.equal(confirmation.nextState.rowIndex, 1);
  assert.equal(confirmation.nextState.cellIndex, 0);
});

test("transition pause advances to first cell", () => {
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.RowSelected, rowIndex: 1 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.rowIndex, 1);
  assert.equal(state.cellIndex, 0);
});

test("activation during transition pause cancels the locked row", () => {
  const confirmation = confirmScanner(
    createScannerState({ stage: ScanStage.RowSelected, rowIndex: 1 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(confirmation.type, "none");
  assert.equal(confirmation.nextState.stage, ScanStage.Rows);
  assert.equal(confirmation.nextState.rowIndex, 1);
  assert.equal(confirmation.nextState.cellIndex, 0);
});

test("first cell can be selected during its hold", () => {
  const confirmation = confirmScanner(
    createScannerState({ stage: ScanStage.FirstCell, rowIndex: 1 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.rowIndex, 1);
  assert.equal(confirmation.cellIndex, 0);
});

test("first cell advances to the second cell when available", () => {
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.FirstCell, rowIndex: 1 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(state.stage, ScanStage.Cells);
  assert.equal(state.rowIndex, 1);
  assert.equal(state.cellIndex, 1);
});

test("first empty cell pass repeats the selected row visibly", () => {
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.Cells, rowIndex: 1, cellIndex: 3 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.rowIndex, 1);
  assert.equal(state.cellIndex, 0);
  assert.equal(state.passIndex, 2);
});

test("confirming a singleton row selects its only item without a cell phase", () => {
  const sizes = [4, 1, 3];
  const confirmation = confirmScanner(
    createScannerState({ rowIndex: 1 }),
    sizes.length,
    (row) => sizes[row]
  );

  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.rowIndex, 1);
  assert.equal(confirmation.cellIndex, 0);
  assert.equal(confirmation.nextState.stage, ScanStage.Rows);
});

test("block mode singleton rows return directly to block scanning", () => {
  const sizes = [4, 1, 3];
  const confirmation = confirmScanner(
    createScannerState({
      scanMode: ScanMode.BlockRowColumn,
      stage: ScanStage.Rows,
      blockIndex: 1,
      rowIndex: 1
    }),
    sizes.length,
    (row) => sizes[row],
    ScanMode.BlockRowColumn
  );

  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.rowIndex, 1);
  assert.equal(confirmation.cellIndex, 0);
  assert.equal(confirmation.nextState.stage, ScanStage.Blocks);
});

test("confirming a one-row block automatically activates its row", () => {
  const sizes = [4, 3, 2];
  const confirmation = confirmScanner(
    createScannerState({
      scanMode: ScanMode.BlockRowColumn,
      stage: ScanStage.Blocks,
      blockIndex: 1
    }),
    sizes.length,
    (row) => sizes[row],
    ScanMode.BlockRowColumn
  );

  assert.equal(confirmation.type, "none");
  assert.equal(confirmation.nextState.stage, ScanStage.RowSelected);
  assert.equal(confirmation.nextState.blockIndex, 1);
  assert.equal(confirmation.nextState.rowIndex, 1);
});

test("the first row after block entry uses the first-target hold", () => {
  const firstRow = advanceScanner(
    createScannerState({
      scanMode: ScanMode.BlockRowColumn,
      stage: ScanStage.BlockSelected,
      blockIndex: 0
    }),
    rowSizes.length,
    columnCountForRow,
    2,
    ScanMode.BlockRowColumn,
    2
  );
  const timing = { scanIntervalMs: 1800, firstCellPauseMs: 2400, transitionPauseMs: 0 };

  assert.equal(firstRow.stage, ScanStage.Rows);
  assert.equal(firstRow.rowIndex, 0);
  assert.equal(firstRow.firstRowInBlock, true);
  assert.equal(scanDurationForStage(firstRow, timing), 2400);

  const secondRow = advanceScanner(
    firstRow,
    rowSizes.length,
    columnCountForRow,
    2,
    ScanMode.BlockRowColumn,
    2
  );
  assert.equal(secondRow.rowIndex, 1);
  assert.equal(secondRow.firstRowInBlock, false);
  assert.equal(scanDurationForStage(secondRow, timing), 1800);
});

test("one-row, one-item blocks cascade directly to item selection", () => {
  const sizes = [4, 1, 2];
  const confirmation = confirmScanner(
    createScannerState({
      scanMode: ScanMode.BlockRowColumn,
      stage: ScanStage.Blocks,
      blockIndex: 1
    }),
    sizes.length,
    (row) => sizes[row],
    ScanMode.BlockRowColumn
  );

  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.rowIndex, 1);
  assert.equal(confirmation.cellIndex, 0);
  assert.equal(confirmation.nextState.stage, ScanStage.Blocks);
});

test("second empty cell pass returns to the same row", () => {
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.Cells, rowIndex: 1, cellIndex: 3, passIndex: 2 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(state.stage, ScanStage.Rows);
  assert.equal(state.rowIndex, 1);
  assert.equal(state.passIndex, 1);
  assert.equal(state.cycleStartRowIndex, 1);
  assert.equal(state.returningToRows, true);
});

test("second empty row pass stops scanning", () => {
  const state = advanceScanner(
    createScannerState({ rowIndex: 2, cycleStartRowIndex: 0, passIndex: 2 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(state.stage, ScanStage.Stopped);
  assert.equal(state.rowIndex, 0);
});

test("activation while stopped resumes without selecting", () => {
  const confirmation = confirmScanner(
    createScannerState({ stage: ScanStage.Stopped, rowIndex: 2, passIndex: 2 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(confirmation.type, "none");
  assert.deepEqual(confirmation.nextState, createScannerState());
});

test("unlimited attempts preserve continuous cell scanning", () => {
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.Cells, rowIndex: 1, cellIndex: 3 }),
    rowSizes.length,
    columnCountForRow,
    0
  );
  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.passIndex, 1);
});

test("early row activation is not remapped to a previous row", () => {
  const confirmation = confirmWithLatencyCompensation(
    createScannerState({ stage: ScanStage.Rows, rowIndex: 2 }),
    rowSizes.length,
    columnCountForRow,
    120,
    250
  );
  assert.equal(confirmation.type, "none");
  assert.equal(confirmation.nextState.stage, ScanStage.RowSelected);
  assert.equal(confirmation.nextState.rowIndex, 2);
});

test("early cell activation selects the previous cell", () => {
  const confirmation = confirmWithLatencyCompensation(
    createScannerState({ stage: ScanStage.Cells, rowIndex: 1, cellIndex: 2 }),
    rowSizes.length,
    columnCountForRow,
    120,
    250
  );
  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.rowIndex, 1);
  assert.equal(confirmation.cellIndex, 1);
});

test("filtered scan positions keep stable visual cell indices and restore every cell on pass two", () => {
  const sizes = [5];
  const indicesForPass = (_rowIndex, passIndex) => passIndex === 1 ? [0, 2, 4] : [0, 1, 2, 3, 4];
  let state = advanceScanner(
    createScannerState({ stage: ScanStage.RowSelected }),
    1,
    (row) => sizes[row],
    2,
    ScanMode.RowColumn,
    4,
    indicesForPass
  );
  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.cellIndex, 0);

  state = advanceScanner(state, 1, (row) => sizes[row], 2, ScanMode.RowColumn, 4, indicesForPass);
  assert.equal(state.cellIndex, 2);
  state = advanceScanner(state, 1, (row) => sizes[row], 2, ScanMode.RowColumn, 4, indicesForPass);
  assert.equal(state.cellIndex, 4);
  state = advanceScanner(state, 1, (row) => sizes[row], 2, ScanMode.RowColumn, 4, indicesForPass);

  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.passIndex, 2);
  assert.equal(state.cellIndex, 0);
  state = advanceScanner(state, 1, (row) => sizes[row], 2, ScanMode.RowColumn, 4, indicesForPass);
  assert.equal(state.cellIndex, 1);
});

test("latency compensation follows the previous filtered visual cell", () => {
  const indicesForPass = () => [0, 2, 4];
  const confirmation = confirmWithLatencyCompensation(
    createScannerState({ stage: ScanStage.Cells, rowIndex: 0, cellIndex: 4 }),
    1,
    () => 5,
    100,
    250,
    ScanMode.RowColumn,
    4,
    indicesForPass
  );

  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.cellIndex, 2);
});

test("first-cell confirmation selects the mapped visual cell rather than physical column zero", () => {
  const confirmation = confirmScanner(
    createScannerState({ stage: ScanStage.FirstCell, rowIndex: 0, cellIndex: 2 }),
    1,
    () => 5,
    ScanMode.RowColumn,
    4,
    () => [2, 4]
  );

  assert.equal(confirmation.type, "selected");
  assert.equal(confirmation.cellIndex, 2);
});

test("continuous filtered scanning opens the full projection on its second cycle", () => {
  const indicesForPass = (_rowIndex, passIndex) => passIndex === 1 ? [1] : [0, 1, 2];
  let state = createScannerState({ stage: ScanStage.FirstCell, cellIndex: 1 });
  state = advanceScanner(state, 1, () => 3, 0, ScanMode.RowColumn, 4, indicesForPass);

  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.passIndex, 2);
  assert.equal(state.cellIndex, 0);
});

test("one-pass scan projections fail open instead of hiding deferred cells", () => {
  const row = [
    { action: "append", scanDeferred: true },
    { action: "append" },
    { action: "append", scanDeferred: true }
  ];

  assert.deepEqual(scanSelectableCellIndices(row, 1, 2), [1]);
  assert.deepEqual(scanSelectableCellIndices(row, 2, 2), [0, 1, 2]);
  assert.deepEqual(scanSelectableCellIndices(row, 1, 1), [0, 1, 2]);
});

test("first-pass row scanning skips rows whose targets are all deferred", () => {
  const indicesForPass = (rowIndex, passIndex) => {
    if (passIndex > 1) return [0];
    return rowIndex === 1 ? [] : [0];
  };
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.Rows, rowIndex: 0 }),
    3,
    () => 1,
    2,
    ScanMode.RowColumn,
    4,
    indicesForPass
  );

  assert.equal(state.rowIndex, 2);
  assert.equal(state.passIndex, 1);
});

test("a row available only on pass two keeps its full cell projection after confirmation", () => {
  const indicesForPass = (_rowIndex, passIndex) => passIndex === 1 ? [] : [0, 2];
  const confirmation = confirmScanner(
    createScannerState({ stage: ScanStage.Rows, rowIndex: 0, passIndex: 2 }),
    1,
    () => 3,
    ScanMode.RowColumn,
    4,
    indicesForPass
  );

  assert.equal(confirmation.nextState.stage, ScanStage.RowSelected);
  assert.equal(confirmation.nextState.passIndex, 2);
  const firstCell = advanceScanner(
    confirmation.nextState,
    1,
    () => 3,
    2,
    ScanMode.RowColumn,
    4,
    indicesForPass
  );
  assert.equal(firstCell.stage, ScanStage.FirstCell);
  assert.equal(firstCell.passIndex, 2);
  assert.equal(firstCell.cellIndex, 0);
});

test("block scanning ignores a block with no first-pass targets", () => {
  const indicesForPass = (rowIndex, passIndex) => {
    if (passIndex > 1) return [0];
    return rowIndex >= 2 && rowIndex <= 3 ? [] : [0];
  };
  const state = advanceScanner(
    createScannerState({ scanMode: ScanMode.BlockRowColumn, stage: ScanStage.Blocks, blockIndex: 0 }),
    6,
    () => 1,
    2,
    ScanMode.BlockRowColumn,
    3,
    indicesForPass
  );

  assert.equal(state.blockIndex, 2);
  assert.equal(state.passIndex, 1);
});

test("row scanning skips empty rows", () => {
  const sizes = [0, 4, 4];
  const state = advanceScanner(createScannerState({ rowIndex: 2 }), sizes.length, (row) => sizes[row]);
  assert.equal(state.rowIndex, 1);
});

test("default block mode creates the 4-3-3-3 groups used by 13-row boards", () => {
  const sizes = Array.from({ length: 13 }, () => 4);

  assert.deepEqual(scanRowBlocks(sizes.length, (row) => sizes[row]), [
    [0, 1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12]
  ]);
});

test("six-column English can use three 4-3-3 row blocks", () => {
  const sizes = Array.from({ length: 10 }, () => 6);
  assert.deepEqual(scanRowBlocks(sizes.length, (row) => sizes[row], 3), [
    [0, 1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ]);
});

test("block mode scans block then row then cell", () => {
  const mode = ScanMode.BlockRowColumn;
  const sizes = Array.from({ length: 14 }, () => 4);
  const count = (row) => sizes[row];
  let state = createScannerState({ scanMode: mode });

  assert.equal(state.stage, ScanStage.Blocks);
  state = advanceScanner(state, sizes.length, count, 2, mode);
  assert.equal(state.blockIndex, 1);
  assert.equal(state.rowIndex, 4);

  let confirmation = confirmScanner(state, sizes.length, count, mode);
  assert.equal(confirmation.nextState.stage, ScanStage.BlockSelected);
  state = advanceScanner(confirmation.nextState, sizes.length, count, 2, mode);
  assert.equal(state.stage, ScanStage.Rows);
  assert.equal(state.rowIndex, 4);

  state = advanceScanner(state, sizes.length, count, 2, mode);
  assert.equal(state.rowIndex, 5);
  confirmation = confirmScanner(state, sizes.length, count, mode);
  state = advanceScanner(confirmation.nextState, sizes.length, count, 2, mode);
  assert.equal(state.stage, ScanStage.FirstCell);
  assert.equal(state.rowIndex, 5);

  state = advanceScanner(state, sizes.length, count, 2, mode);
  assert.equal(state.stage, ScanStage.Cells);
  assert.equal(state.cellIndex, 1);
});

test("block-mode misses unwind cells to rows, rows to blocks, then stop", () => {
  const mode = ScanMode.BlockRowColumn;
  const sizes = Array.from({ length: 14 }, () => 4);
  const count = (row) => sizes[row];

  let state = advanceScanner(
    createScannerState({
      scanMode: mode,
      stage: ScanStage.Cells,
      blockIndex: 1,
      rowIndex: 7,
      cellIndex: 3,
      passIndex: 2
    }),
    sizes.length,
    count,
    2,
    mode
  );
  assert.equal(state.stage, ScanStage.Rows);
  assert.equal(state.blockIndex, 1);
  assert.equal(state.rowIndex, 7);

  state = advanceScanner(
    createScannerState({
      scanMode: mode,
      stage: ScanStage.Rows,
      blockIndex: 2,
      rowIndex: 10,
      cycleStartRowIndex: 8,
      passIndex: 2
    }),
    sizes.length,
    count,
    2,
    mode
  );
  assert.equal(state.stage, ScanStage.Blocks);
  assert.equal(state.blockIndex, 2);
  assert.equal(state.returningToBlocks, true);

  state = advanceScanner(
    createScannerState({
      scanMode: mode,
      stage: ScanStage.Blocks,
      blockIndex: 3,
      cycleStartBlockIndex: 0,
      passIndex: 2
    }),
    sizes.length,
    count,
    2,
    mode
  );
  assert.equal(state.stage, ScanStage.Stopped);
  assert.equal(state.blockIndex, 0);
});

test("recognition-load proxy exposes the default block tradeoff", () => {
  const sizes = Array.from({ length: 14 }, () => 4);
  const count = (row) => sizes[row];

  assert.deepEqual(scanRecognitionLoad(sizes.length, count, ScanMode.RowColumn), {
    mode: ScanMode.RowColumn,
    decisionLevels: 2,
    topLevelChoices: 14,
    maximumRowsHighlighted: 1,
    maximumItemsHighlighted: 4
  });
  assert.deepEqual(scanRecognitionLoad(sizes.length, count, ScanMode.BlockRowColumn), {
    mode: ScanMode.BlockRowColumn,
    decisionLevels: 3,
    topLevelChoices: 4,
    maximumRowsHighlighted: 4,
    maximumItemsHighlighted: 16
  });
});

test("block-mode access-cost benchmark reduces average row search advances", () => {
  const sizes = Array.from({ length: 14 }, () => 4);
  const count = (row) => sizes[row];
  const averageAdvances = (mode) => sizes.reduce(
    (total, _size, rowIndex) => total + scanAccessCost(
      sizes.length,
      count,
      rowIndex,
      0,
      mode
    ).scannerAdvances,
    0
  ) / sizes.length;

  assert.equal(averageAdvances(ScanMode.RowColumn), 6.5);
  assert.equal(averageAdvances(ScanMode.BlockRowColumn), 37 / 14);
  assert.ok(averageAdvances(ScanMode.BlockRowColumn) < averageAdvances(ScanMode.RowColumn));
  assert.equal(scanAccessCost(14, count, 13, 3, ScanMode.BlockRowColumn).switchActivations, 3);
});

test("access-cost metrics omit the redundant cell activation for singleton rows", () => {
  const sizes = [4, 1, 3];
  const count = (row) => sizes[row];

  assert.equal(scanAccessCost(3, count, 1, 0, ScanMode.RowColumn).switchActivations, 1);
  assert.equal(scanAccessCost(3, count, 1, 0, ScanMode.BlockRowColumn).switchActivations, 1);
  assert.equal(scanAccessCost(3, count, 2, 0, ScanMode.BlockRowColumn).switchActivations, 2);
});
