import {
  ScanStage,
  TileAction,
  advanceSession,
  createBoardConfig,
  createScannerState,
  createSession,
  pressSwitch,
  visibleBoard
} from "../src/index.js";

export function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value) {
  return normalizeText(value);
}

function selectablePositions(session) {
  const rows = visibleBoard(session);
  const positions = [];
  rows.forEach((row, rowIndex) => {
    row.forEach((candidate, cellIndex) => {
      if (candidate.action === TileAction.Noop) return;
      positions.push({ candidate, rowIndex, cellIndex });
    });
  });
  return positions;
}

function candidateMatchesToken(candidate, token) {
  const normalized = normalizeToken(token);
  if (candidate.action === TileAction.Undo) return normalized === "undo";
  return normalizeToken(candidate.output) === normalized || normalizeToken(candidate.label) === normalized;
}

function scanCost(session, rowIndex, cellIndex) {
  const rows = visibleBoard(session);
  const rowCursor = session.scannerState.stage === ScanStage.Rows ? session.scannerState.rowIndex : 0;
  const rowAdvances = (rowIndex - rowCursor + rows.length) % rows.length;
  const cellAdvances = cellIndex === 0 ? 0 : cellIndex;
  return rowAdvances + cellAdvances + 2;
}

function scanAdvanceMs(session) {
  switch (session.scannerState.stage) {
    case ScanStage.RowSelected:
      return session.config.transitionPauseMs;
    case ScanStage.FirstCell:
      return session.config.firstCellPauseMs;
    case ScanStage.Rows:
    case ScanStage.Cells:
    default:
      return session.config.scanIntervalMs;
  }
}

function bestPositionForToken(session, token) {
  return selectablePositions(session)
    .filter(({ candidate }) => candidateMatchesToken(candidate, token))
    .sort((left, right) =>
      scanCost(session, left.rowIndex, left.cellIndex) -
      scanCost(session, right.rowIndex, right.cellIndex)
    )[0] ?? null;
}

function selectPosition(session, position) {
  let next = session.scannerState.stage === ScanStage.Rows
    ? session
    : { ...session, scannerState: createScannerState({ rowIndex: 0 }), lockedRow: null };
  const metrics = { selections: 1, switches: 0, advances: 0, estimatedTimeMs: 0, tileActions: {} };

  for (let step = 0; step <= visibleBoard(next).length; step += 1) {
    if (next.scannerState.stage === ScanStage.Rows && next.scannerState.rowIndex === position.rowIndex) break;
    metrics.estimatedTimeMs += scanAdvanceMs(next);
    next = advanceSession(next);
    metrics.advances += 1;
  }

  next = pressSwitch(next, 1000);
  metrics.switches += 1;
  if (next.scannerState.stage === ScanStage.RowSelected) {
    metrics.estimatedTimeMs += scanAdvanceMs(next);
    next = advanceSession(next);
    metrics.advances += 1;
  }

  if (position.cellIndex > 0) {
    metrics.estimatedTimeMs += scanAdvanceMs(next);
    next = advanceSession(next);
    metrics.advances += 1;
    for (let step = 0; step <= next.lockedRow.length; step += 1) {
      if (next.scannerState.cellIndex === position.cellIndex) break;
      metrics.estimatedTimeMs += scanAdvanceMs(next);
      next = advanceSession(next);
      metrics.advances += 1;
    }
  }

  next = pressSwitch(next, 1000);
  metrics.switches += 1;
  const selectedAction = next.lastSelection?.tile?.action;
  if (selectedAction) {
    metrics.tileActions[selectedAction] = (metrics.tileActions[selectedAction] ?? 0) + 1;
  }
  return {
    session: {
      ...next,
      scannerState: createScannerState({ rowIndex: 0 }),
      lockedRow: null
    },
    metrics
  };
}

function addMetrics(left, right) {
  return {
    selections: left.selections + right.selections,
    switches: left.switches + right.switches,
    advances: left.advances + right.advances,
    estimatedTimeMs: left.estimatedTimeMs + right.estimatedTimeMs,
    tileActions: addActionCounts(left.tileActions, right.tileActions)
  };
}

function blankMetrics() {
  return { selections: 0, switches: 0, advances: 0, estimatedTimeMs: 0, tileActions: {} };
}

function addActionCounts(left = {}, right = {}) {
  const merged = { ...left };
  for (const [action, count] of Object.entries(right)) {
    merged[action] = (merged[action] ?? 0) + count;
  }
  return merged;
}

function composeToken(session, token) {
  const direct = bestPositionForToken(session, token);
  if (direct) return selectPosition(session, direct);

  const normalized = normalizeToken(token);
  if (!/^[a-z]+$/.test(normalized)) {
    throw new Error(`No visible tile or spelling fallback for ${token}`);
  }

  let next = session;
  let metrics = blankMetrics();
  for (const character of normalized) {
    const completion = bestPositionForToken(next, token);
    if (completion) {
      const selected = selectPosition(next, completion);
      return { session: selected.session, metrics: addMetrics(metrics, selected.metrics) };
    }

    const letter = bestPositionForToken(next, character);
    if (!letter) throw new Error(`No visible spelling tile for ${character} while composing ${token}`);
    const selected = selectPosition(next, letter);
    next = selected.session;
    metrics = addMetrics(metrics, selected.metrics);
  }

  const completion = bestPositionForToken(next, token);
  if (completion) {
    const selected = selectPosition(next, completion);
    return { session: selected.session, metrics: addMetrics(metrics, selected.metrics) };
  }

  return { session: next, metrics };
}

export function composeSequence(startSession, tokens) {
  let session = startSession;
  let metrics = blankMetrics();
  for (const token of tokens) {
    const selected = composeToken(session, token);
    session = selected.session;
    metrics = addMetrics(metrics, selected.metrics);
  }
  return { session, metrics };
}

export function evaluateBenchmark(benchmark) {
  const startSession = createSession({
    config: createBoardConfig({ profileId: benchmark.profileId ?? "en-US" })
  });
  const setup = composeSequence(startSession, benchmark.setupTokenSequence ?? []);
  const results = benchmark.acceptableTokenSequences.map((sequence) => {
    try {
      return { sequence, ...composeSequence(setup.session, sequence) };
    } catch (error) {
      return { sequence, error };
    }
  });
  return results
    .filter((result) => !result.error)
    .sort((left, right) =>
      left.metrics.selections - right.metrics.selections ||
      left.metrics.advances - right.metrics.advances
    )[0] ?? results[0];
}
