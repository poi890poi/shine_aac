import test from "node:test";
import assert from "node:assert/strict";
import {
  ScanMode,
  ScanStage,
  advanceSession,
  createBoardConfig,
  createScannerState,
  createSession,
  pauseSession,
  pressSwitch,
  tile,
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

function selectMoreSuggestions(session) {
  const board = visibleBoard(session);
  for (const [rowIndex, row] of board.entries()) {
    const cellIndex = row.findIndex((candidate) => candidate.action === "more-suggestions");
    if (cellIndex < 0) continue;
    return pressSwitch({
      ...session,
      scannerState: createScannerState({
        scanMode: session.config.scanMode,
        stage: cellIndex === 0 ? ScanStage.FirstCell : ScanStage.Cells,
        rowIndex,
        cellIndex
      })
    }, 1000);
  }
  assert.fail("Expected a More suggestions tile");
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

test("scan-only transitions reuse the prepared logical board", () => {
  let suggestionLabelReads = 0;
  const trackedSuggestion = {
    get label() {
      suggestionLabelReads += 1;
      return "ALPHA";
    },
    output: "alpha",
    action: "append"
  };
  let session = createSession({
    config: createBoardConfig({ suggestionDictionary: [trackedSuggestion, tile("BETA", "beta")] })
  });

  visibleBoard(session);
  const readsAfterPreparation = suggestionLabelReads;
  const preparedRows = visibleBoard(session);

  const activatedSession = pressSwitch(session, 1000);
  assert.equal(suggestionLabelReads, readsAfterPreparation);
  assert.equal(visibleBoard(activatedSession), preparedRows);

  const pausedSession = {
    ...session,
    config: createBoardConfig({ ...session.config, transitionPauseMs: 850 })
  };
  const pausedActivation = pressSwitch(pausedSession, 1000);
  assert.equal(suggestionLabelReads, readsAfterPreparation);
  assert.equal(visibleBoard(pausedActivation), preparedRows);

  for (let step = 0; step < 24; step += 1) {
    session = advanceSession(session);
    visibleBoard(session);
  }
  assert.equal(suggestionLabelReads, readsAfterPreparation);

  visibleBoard({
    ...session,
    config: createBoardConfig({ ...session.config, scanIntervalMs: 300 })
  });
  assert.equal(suggestionLabelReads, readsAfterPreparation);

  const boardWithSpans = visibleBoard({
    ...session,
    config: createBoardConfig({
      ...session.config,
      suggestionColumnSpans: { ALPHA: 2 }
    })
  });
  assert.equal(boardWithSpans[0][0].columnSpan, 2);
  assert.ok(suggestionLabelReads > readsAfterPreparation);

  visibleBoard({ ...session, message: "a" });
  assert.ok(suggestionLabelReads > readsAfterPreparation);
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

for (const scanMode of [ScanMode.RowColumn, ScanMode.BlockRowColumn]) {
  test(`${scanMode} automatically activates a row with one selectable item`, () => {
    const config = createBoardConfig({
      scanMode,
      symbols: [tile("ONLY", "only")],
      transitionPauseMs: 850
    });
    const symbolRowIndex = 2;
    const blockIndex = scanMode === ScanMode.BlockRowColumn ? 2 : 0;
    const session = createSession({
      config,
      scannerState: createScannerState({
        scanMode,
        stage: ScanStage.Rows,
        blockIndex,
        rowIndex: symbolRowIndex
      })
    });

    const selected = pressSwitch(session, 1000);

    assert.equal(selected.message, "only ");
    assert.equal(selected.lastSelection.tile.label, "ONLY");
    assert.equal(
      selected.scannerState.stage,
      scanMode === ScanMode.BlockRowColumn ? ScanStage.Blocks : ScanStage.Rows
    );
    assert.equal(selected.lockedRow, null);
  });
}

test("block mode automatically activates the only row in a block", () => {
  const config = createBoardConfig({
    scanMode: ScanMode.BlockRowColumn,
    symbols: [tile("ALPHA", "alpha"), tile("BETA", "beta")],
    transitionPauseMs: 850
  });
  const session = createSession({
    config,
    scannerState: createScannerState({
      scanMode: ScanMode.BlockRowColumn,
      stage: ScanStage.Blocks,
      blockIndex: 2,
      rowIndex: 2
    })
  });

  const activated = pressSwitch(session, 1000);

  assert.equal(activated.message, "");
  assert.equal(activated.lastSelection, null);
  assert.equal(activated.scannerState.stage, ScanStage.RowSelected);
  assert.deepEqual(activated.lockedRow.map((candidate) => candidate.label), ["ALPHA", "BETA"]);
});

test("block mode cascades one-row, one-item blocks to immediate item selection", () => {
  const config = createBoardConfig({
    scanMode: ScanMode.BlockRowColumn,
    symbols: [tile("ONLY", "only")],
    transitionPauseMs: 850
  });
  const session = createSession({
    config,
    scannerState: createScannerState({
      scanMode: ScanMode.BlockRowColumn,
      stage: ScanStage.Blocks,
      blockIndex: 2,
      rowIndex: 2
    })
  });

  const selected = pressSwitch(session, 1000);

  assert.equal(selected.message, "only ");
  assert.equal(selected.lastSelection.tile.label, "ONLY");
  assert.equal(selected.scannerState.stage, ScanStage.Blocks);
  assert.equal(selected.lockedRow, null);
});

test("block session requires block, row, and cell activations", () => {
  let session = createSession({
    config: createBoardConfig({ scanMode: ScanMode.BlockRowColumn })
  });

  assert.equal(session.scannerState.stage, ScanStage.Blocks);
  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.scannerState.blockIndex, 0);
  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.FirstCell);
  session = pressSwitch(session, 1000);

  assert.equal(session.lastSelection.tile.label, "THE");
  assert.equal(session.message, "the ");
  assert.equal(session.scannerState.stage, ScanStage.Blocks);
});

test("two missed item passes return to the selected row without changing the message", () => {
  let session = pressSwitch(createSession(), 1000);
  const selectedRow = session.scannerState.rowIndex;
  const itemCount = visibleBoard(session)[selectedRow].filter((candidate) => candidate.action !== "noop").length;

  for (let step = 0; step < itemCount * 2; step += 1) {
    session = advanceSession(session);
  }

  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.scannerState.rowIndex, selectedRow);
  assert.equal(session.scannerState.returningToRows, true);
  assert.equal(session.message, "");
});

test("two missed board passes stop and the next activation only resumes", () => {
  let session = createSession();
  const rowCount = visibleBoard(session).filter((row) => row.some((candidate) => candidate.action !== "noop")).length;

  for (let step = 0; step < rowCount * 2; step += 1) {
    session = advanceSession(session);
  }

  assert.equal(session.scannerState.stage, ScanStage.Stopped);
  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.scannerState.rowIndex, 0);
  assert.equal(session.lastSelection, null);
  assert.equal(session.message, "");
});

test("lifecycle pause stops scanning and the next activation only resumes", () => {
  const active = {
    ...createSession({ message: "I need " }),
    scannerState: createScannerState({
      stage: ScanStage.Cells,
      rowIndex: 1,
      cellIndex: 2,
      passIndex: 2
    }),
    lastSelection: { effect: "message" }
  };

  const paused = pauseSession(active);

  assert.equal(paused.scannerState.stage, ScanStage.Stopped);
  assert.equal(paused.message, "I need ");
  assert.equal(paused.lockedRow, null);
  assert.equal(paused.lastSelection, null);

  const resumed = pressSwitch(paused, 0);
  assert.equal(resumed.scannerState.stage, ScanStage.Rows);
  assert.equal(resumed.scannerState.rowIndex, 0);
  assert.equal(resumed.message, "I need ");
  assert.equal(resumed.lastSelection, null);
});

test("lifecycle pause preserves the current suggestion page for resume", () => {
  const active = {
    ...createSession({
      config: createBoardConfig({ profileId: "zh-TW", autoScanSuggestionPages: true })
    }),
    suggestionPage: 2,
    scannerState: createScannerState({ stage: ScanStage.SuggestionPages })
  };

  const paused = pauseSession(active);
  assert.equal(paused.scannerState.stage, ScanStage.Stopped);
  assert.equal(paused.scannerState.stoppedFromSuggestionPages, true);

  const resumed = pressSwitch(paused, 0);
  assert.equal(resumed.scannerState.stage, ScanStage.Rows);
  assert.equal(resumed.suggestionPage, 2);
  assert.equal(resumed.lastSelection, null);
});

test("a temporary pass limit can drive a demo without changing saved session configuration", () => {
  let session = createSession({ config: createBoardConfig({ scanPassLimit: 0 }) });
  const rowCount = visibleBoard(session).filter((row) => row.some((candidate) => candidate.action !== "noop")).length;

  for (let step = 0; step < rowCount * 2; step += 1) {
    session = advanceSession(session, 2);
  }

  assert.equal(session.scannerState.stage, ScanStage.Stopped);
  assert.equal(session.config.scanPassLimit, 0);
});

test("More keeps ordinary navigation when automatic page scanning is disabled", () => {
  const session = selectMoreSuggestions(createSession({
    config: createBoardConfig({ profileId: "zh-TW" })
  }));

  assert.equal(session.config.autoScanSuggestionPages, false);
  assert.equal(session.suggestionPage, 1);
  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.lastSelection.tile.action, "more-suggestions");
});

for (const scanMode of [ScanMode.RowColumn, ScanMode.BlockRowColumn]) {
  test(`${scanMode} activation leaves the visible More page ready for row scanning`, () => {
    let session = selectMoreSuggestions(createSession({
      config: createBoardConfig({
        profileId: "zh-TW",
        scanMode,
        scanPassLimit: 0,
        autoScanSuggestionPages: true
      })
    }));

    assert.equal(session.suggestionPage, 1);
    assert.equal(session.scannerState.stage, ScanStage.SuggestionPages);
    assert.equal(session.scannerState.passIndex, 1);

    session = advanceSession(session);
    assert.equal(session.suggestionPage, 2);
    session = pressSwitch(session, 1000);

    assert.equal(session.scannerState.stage, ScanStage.Rows);
    assert.equal(session.suggestionPage, 2);
    assert.equal(session.lastSelection, null);
    if (scanMode === ScanMode.BlockRowColumn) {
      assert.equal(session.scannerState.suggestionPageRowsActive, true);
      assert.equal(session.scannerState.firstRowInBlock, true);
      const visitedRows = [session.scannerState.rowIndex];
      for (let step = 0; step < 3; step += 1) {
        session = advanceSession(session);
        visitedRows.push(session.scannerState.rowIndex);
      }
      assert.deepEqual(visitedRows, [0, 1, 2, 3]);
    } else {
      assert.equal(session.scannerState.returningToRows, true);
      assert.equal(session.scannerState.suggestionPageRowsActive, false);
    }
  });
}

test("selected suggestion-page rows return to top-level blocks only after their normal scan passes", () => {
  let session = selectMoreSuggestions(createSession({
    config: createBoardConfig({
      profileId: "zh-TW",
      scanMode: ScanMode.BlockRowColumn,
      scanPassLimit: 2,
      autoScanSuggestionPages: true
    })
  }));

  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.scannerState.suggestionPageRowsActive, true);

  for (let step = 0; step < 7; step += 1) {
    session = advanceSession(session);
    assert.equal(session.scannerState.stage, ScanStage.Rows);
    assert.equal(session.scannerState.rowIndex <= 3, true);
  }
  session = advanceSession(session);

  assert.equal(session.scannerState.stage, ScanStage.Blocks);
  assert.equal(session.scannerState.returningToBlocks, true);
  assert.equal(session.scannerState.suggestionPageRowsActive, false);
});

test("More auto-scan pauses after two complete page passes", () => {
  let session = selectMoreSuggestions(createSession({
    config: createBoardConfig({
      profileId: "zh-TW",
      scanPassLimit: 0,
      autoScanSuggestionPages: true
    })
  }));
  const visitedPages = [session.suggestionPage];

  for (let step = 0; step < 6; step += 1) {
    session = advanceSession(session);
    visitedPages.push(session.suggestionPage);
  }

  assert.deepEqual(visitedPages, [1, 2, 0, 1, 2, 0, 1]);
  assert.equal(session.scannerState.stage, ScanStage.Stopped);
  assert.equal(session.scannerState.stoppedFromSuggestionPages, true);
  assert.equal(session.scannerState.passIndex, 2);

  session = pressSwitch(session, 1000);
  assert.equal(session.scannerState.stage, ScanStage.Rows);
  assert.equal(session.suggestionPage, 1);
  assert.equal(session.lastSelection, null);
});

for (const scanMode of [ScanMode.RowColumn, ScanMode.BlockRowColumn]) {
  test(`${scanMode} defers unsupported Zhuyin cells on pass one and restores them on pass two`, () => {
    const config = createBoardConfig({
      profileId: "zh-TW",
      scanMode,
      deferUnsupportedZhuyinOnFirstPass: true
    });
    let session = createSession({ config, message: "ㄈ", messageHistory: [""] });
    const board = visibleBoard(session);
    const rowIndex = board.findIndex((row) => row.some((candidate) => candidate.label === "ㄩ"));
    const cellIndex = board[rowIndex].findIndex((candidate) => candidate.label === "ㄩ");
    session = {
      ...session,
      scannerState: createScannerState({
        scanMode,
        stage: ScanStage.RowSelected,
        blockIndex: 0,
        rowIndex
      }),
      lockedRow: board[rowIndex]
    };

    session = advanceSession(session);
    const firstPassCells = [];
    for (let step = 0; step < board[rowIndex].length + 2 && session.scannerState.passIndex === 1; step += 1) {
      firstPassCells.push(session.scannerState.cellIndex);
      session = advanceSession(session);
    }
    assert.equal(firstPassCells.includes(cellIndex), false);
    assert.equal(session.scannerState.passIndex, 2);

    for (let step = 0; step < board[rowIndex].length + 2; step += 1) {
      if (session.scannerState.cellIndex === cellIndex) break;
      session = advanceSession(session);
    }
    assert.equal(session.scannerState.cellIndex, cellIndex);
    session = pressSwitch(session, 1000);
    assert.equal(session.message, "ㄈㄩ");
  });
}

test("undo repairs the previous message state with one selection", () => {
  let session = createSession({ message: "I want", messageHistory: ["", "I", "I "] });
  session = selectSuggestionCell(session, 0);
  assert.equal(session.lastSelection.tile.label, "UNDO");
  assert.equal(session.message, "I ");
});
