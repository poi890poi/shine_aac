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

function labelsForRow(session, rowIndex = 0) {
  return visibleBoard(session)[rowIndex].map((candidate) => candidate.label);
}

function findTile(session, label, options = {}) {
  const { rowIndex, occurrence = 0 } = options;
  const matches = [];
  visibleBoard(session).forEach((row, candidateRowIndex) => {
    if (rowIndex !== undefined && candidateRowIndex !== rowIndex) return;
    row.forEach((candidate, cellIndex) => {
      if (candidate.label === label) matches.push({ rowIndex: candidateRowIndex, cellIndex });
    });
  });

  const index = occurrence === "last" ? matches.length - 1 : occurrence;
  const match = matches[index];
  assert.ok(match, `could not find tile ${label}`);
  return match;
}

function moveRowCursorTo(session, targetRowIndex) {
  let next = session;
  for (let step = 0; step <= visibleBoard(session).length; step += 1) {
    if (next.scannerState.stage === ScanStage.Rows && next.scannerState.rowIndex === targetRowIndex) {
      return next;
    }
    next = advanceSession(next);
  }
  throw new Error(`row cursor did not reach row ${targetRowIndex}`);
}

function selectCell(session, rowIndex, cellIndex) {
  let next = moveRowCursorTo(session, rowIndex);
  next = pressSwitch(next, 1000);
  assert.ok(
    next.scannerState.stage === ScanStage.RowSelected || next.scannerState.stage === ScanStage.FirstCell,
    `unexpected stage ${next.scannerState.stage}`
  );
  assert.deepEqual(next.lockedRow.map((candidate) => candidate.label), visibleBoard(next)[rowIndex].map((candidate) => candidate.label));

  if (next.scannerState.stage === ScanStage.RowSelected) {
    next = advanceSession(next);
  }
  assert.equal(next.scannerState.stage, ScanStage.FirstCell);

  if (cellIndex > 0) {
    next = advanceSession(next);
    assert.equal(next.scannerState.stage, ScanStage.Cells);
    for (let step = 0; step <= next.lockedRow.length; step += 1) {
      if (next.scannerState.cellIndex === cellIndex) break;
      next = advanceSession(next);
    }
  }

  assert.equal(next.scannerState.cellIndex, cellIndex);
  return pressSwitch(next, 1000);
}

function selectLabel(session, label, options = {}) {
  const position = findTile(session, label, options);
  return selectCell(session, position.rowIndex, position.cellIndex);
}

test("SPC does not create confusing duplicate spaces", () => {
  let session = createSession({ message: "I", messageHistory: [""] });

  assert.deepEqual(labelsForRow(session), ["UNDO", "SPC", "E", "T"]);
  session = selectLabel(session, "SPC", { rowIndex: 0 });
  assert.equal(session.message, "I ");
  assert.equal(session.messageHistory.at(-1), "I");

  session = selectLabel(session, "SPC");
  assert.equal(session.message, "I ");
  assert.equal(session.lastSelection.effect, "none");
});

test("DEL, SPC, CLR, and UNDO repair a message through switch selections", () => {
  let session = createSession({ message: "watch", messageHistory: ["", "w", "wa", "wat", "watc"] });

  session = selectLabel(session, "DEL");
  assert.equal(session.lastSelection.tile.label, "DEL");
  assert.equal(session.message, "watc");

  session = selectLabel(session, "SPC", { rowIndex: 0 });
  assert.equal(session.message, "watc ");

  session = selectLabel(session, "CLR");
  assert.equal(session.lastSelection.tile.label, "CLR");
  assert.equal(session.message, "");

  session = selectLabel(session, "UNDO", { rowIndex: 0 });
  assert.equal(session.message, "watc ");

  session = selectLabel(session, "UNDO", { rowIndex: 0 });
  assert.equal(session.message, "watc");
});

test("partial-word suggestion completes the current token instead of appending a duplicate word", () => {
  let session = createSession();
  for (const letter of ["M", "O", "V", "I"]) {
    session = selectLabel(session, letter, { occurrence: "last" });
  }

  assert.equal(session.message, "movi");
  assert.deepEqual(labelsForRow(session), ["UNDO", "SPC", "MOVIE", "E"]);

  session = selectLabel(session, "MOVIE", { rowIndex: 0 });
  assert.equal(session.message, "movie");
});

test("human correction sequence: wrong need word, undo, then choose the intended need", () => {
  let session = createSession();

  session = selectLabel(session, "I", { rowIndex: 0 });
  session = selectLabel(session, "SPC", { rowIndex: 0 });
  session = selectLabel(session, "WANT", { rowIndex: 0 });
  session = selectLabel(session, "SPC", { rowIndex: 0 });
  assert.deepEqual(labelsForRow(session), ["UNDO", "DRINK", "WATER", "FOOD"]);

  session = selectLabel(session, "DRINK", { rowIndex: 0 });
  assert.equal(session.message, "I want drink");

  session = selectLabel(session, "UNDO", { rowIndex: 0 });
  assert.equal(session.message, "I want ");

  session = selectLabel(session, "FOOD", { rowIndex: 0 });
  assert.equal(session.message, "I want food");
});

test("accidental row activation can be cancelled before any symbol is entered", () => {
  let session = createSession({ config: createBoardConfig({ transitionPauseMs: 850 }) });
  const yesPosition = findTile(session, "YES");

  session = moveRowCursorTo(session, yesPosition.rowIndex);
  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.RowSelected);
  assert.equal(session.message, "");

  session = pressSwitch(session, 100);
  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.scannerState.rowIndex, yesPosition.rowIndex);
  assert.equal(session.lockedRow, null);
  assert.equal(session.message, "");
});

test("drink is available as an offline suggestion and need word", () => {
  let session = createSession();

  session = selectLabel(session, "I", { rowIndex: 0 });
  session = selectLabel(session, "SPC", { rowIndex: 0 });
  session = selectLabel(session, "WANT", { rowIndex: 0 });
  session = selectLabel(session, "SPC", { rowIndex: 0 });
  assert.ok(labelsForRow(session).includes("DRINK"));

  session = selectLabel(session, "DRINK", { rowIndex: 0 });
  assert.equal(session.message, "I want drink");
});

test("question mark no longer consumes a singleton row in the default board", () => {
  const rows = visibleBoard(createSession());

  assert.equal(rows.at(-1).length, 4);
  assert.equal(rows.flat().some((candidate) => candidate.label === "?"), false);
});

test("early symbol activation compensates to the previous symbol in the selected row", () => {
  let session = createSession();
  const rowIndex = findTile(session, "WANT", { occurrence: "last" }).rowIndex;

  session = moveRowCursorTo(session, rowIndex);
  session = pressSwitch(session, 1000);
  session = advanceSession(session);
  session = advanceSession(session);
  while (session.scannerState.cellIndex !== 2) {
    session = advanceSession(session);
  }

  session = pressSwitch(session, 120);
  assert.equal(session.lastSelection.tile.label, "NEED");
  assert.equal(session.message, "need");
});

test("suggestion row fills unused slots with reachable helpers instead of empty traps", () => {
  let session = createSession({ message: "want", messageHistory: [""] });
  assert.deepEqual(labelsForRow(session), ["UNDO", "SPC", "E", "T"]);

  session = selectLabel(session, "E", { rowIndex: 0 });
  assert.equal(session.message, "wante");
  assert.equal(visibleBoard(session)[0].some((candidate) => candidate.label === ""), false);
});
