import test from "node:test";
import assert from "node:assert/strict";
import {
  ScanStage,
  advanceSession,
  createBoardConfig,
  createSession,
  pressSwitch,
  visibleBoard
} from "../src/index.js";

function selectSuggestionCell(session, cellIndex) {
  let next = pressSwitch(session, 1000);
  if (next.scannerState.stage === ScanStage.RowSelected) {
    next = advanceSession(next);
  }
  assert.equal(next.scannerState.stage, ScanStage.FirstCell);
  if (cellIndex > 0) {
    next = advanceSession(next);
    assert.equal(next.scannerState.stage, ScanStage.Cells);
    while (next.scannerState.cellIndex !== cellIndex) {
      next = advanceSession(next);
    }
  }
  return pressSwitch(next, 1000);
}

test("complete phrase can be entered through one-switch session transitions", () => {
  let session = createSession();

  assert.deepEqual(visibleBoard(session)[0].map((candidate) => candidate.label), ["THE", "TO", "OF", "AND"]);
  session = selectSuggestionCell(session, 0);
  assert.equal(session.message, "the ");

  assert.deepEqual(visibleBoard(session)[0].map((candidate) => candidate.label), ["UNDO", "THE", "TO", "OF"]);
  session = selectSuggestionCell(session, 2);
  assert.equal(session.message, "the to ");
});

test("locked suggestion row does not change while selecting a cell", () => {
  let session = createSession({ message: "I ", messageHistory: [""] });
  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.FirstCell);
  assert.deepEqual(session.lockedRow.map((candidate) => candidate.label), ["UNDO", "THE", "TO", "OF"]);

  const changedElsewhere = {
    ...session,
    message: "I want ",
    messageHistory: [...session.messageHistory, "I"]
  };
  assert.deepEqual(visibleBoard(changedElsewhere)[0].map((candidate) => candidate.label), ["UNDO", "THE", "TO", "OF"]);
});

test("zero transition pause skips row-selected escape state", () => {
  const session = pressSwitch(createSession(), 1000);

  assert.equal(session.scannerState.stage, ScanStage.FirstCell);
  assert.deepEqual(session.lockedRow.map((candidate) => candidate.label), ["THE", "TO", "OF", "AND"]);
});

test("positive transition pause keeps the row-selected escape state available when configured", () => {
  const session = pressSwitch(createSession({ config: createBoardConfig({ transitionPauseMs: 850 }) }), 1000);

  assert.equal(session.scannerState.stage, ScanStage.RowSelected);
  assert.deepEqual(session.lockedRow.map((candidate) => candidate.label), ["THE", "TO", "OF", "AND"]);
});

test("undo repairs the previous message state with one selection", () => {
  let session = createSession({ message: "I want", messageHistory: ["", "I", "I "] });
  session = selectSuggestionCell(session, 0);
  assert.equal(session.lastSelection.tile.label, "UNDO");
  assert.equal(session.message, "I ");
});
