import test from "node:test";
import assert from "node:assert/strict";
import {
  ScanStage,
  advanceScanner,
  confirmScanner,
  confirmWithLatencyCompensation,
  createScannerState
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

test("cell scanning wraps inside the selected row", () => {
  const state = advanceScanner(
    createScannerState({ stage: ScanStage.Cells, rowIndex: 1, cellIndex: 3 }),
    rowSizes.length,
    columnCountForRow
  );
  assert.equal(state.stage, ScanStage.Cells);
  assert.equal(state.rowIndex, 1);
  assert.equal(state.cellIndex, 0);
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

test("row scanning skips empty rows", () => {
  const sizes = [0, 4, 4];
  const state = advanceScanner(createScannerState({ rowIndex: 2 }), sizes.length, (row) => sizes[row]);
  assert.equal(state.rowIndex, 1);
});
