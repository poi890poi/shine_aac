import {
  ScanStage,
  TileAction,
  advanceSession,
  createBoardConfig,
  createScannerState,
  createSession,
  pressSwitch,
  visibleBoard,
  ZhTwFrequencyDictionary
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

  if (session.config.profileId === "zh-TW") {
    if (isZhTwLatinToken(token)) return composeZhTwLatinToken(session, token);
    return composeZhTwToken(session, token);
  }

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

function isZhTwLatinToken(token) {
  return /^[A-Za-z ?]+$/.test(String(token));
}

function composeZhTwLatinToken(session, token) {
  let next = session;
  let metrics = blankMetrics();

  const opened = selectVisibleTile(next, (candidate) =>
    candidate.action === TileAction.OpenCategory &&
    candidate.output === "english"
  );
  next = opened.session;
  metrics = addMetrics(metrics, opened.metrics);

  for (const character of Array.from(String(token))) {
    const selected = selectVisibleTile(next, (candidate) => {
      if (character === " ") return candidate.action === TileAction.Space && candidate.output === " ";
      return candidate.action === TileAction.Append && candidate.output === character.toLowerCase();
    });
    next = selected.session;
    metrics = addMetrics(metrics, selected.metrics);
  }

  const closed = selectVisibleTile(next, (candidate) => candidate.action === TileAction.CloseCategory);
  return {
    session: closed.session,
    metrics: addMetrics(metrics, closed.metrics)
  };
}

function composeZhTwToken(session, token) {
  const label = String(token);
  const targetEntry = bestZhTwEntry(label);
  if (!targetEntry) throw new Error(`No zh-TW dictionary entry for ${label}`);

  let next = session;
  let metrics = blankMetrics();

  for (const symbol of Array.from(targetEntry.key)) {
    const selected = selectVisibleTileAcrossSuggestionPages(next, (candidate) =>
      candidate.action === TileAction.Append &&
      candidate.output === symbol
    );
    if (!selected) {
      throw new Error(`No visible zh-TW symbol ${symbol} while composing ${label} with ${targetEntry.key}`);
    }
    next = selected.session;
    metrics = addMetrics(metrics, selected.metrics);
  }

  const committed = selectVisibleTileAcrossSuggestionPages(next, (candidate) =>
    candidate.action === TileAction.CommitCandidate &&
    candidate.label === label
  );
  if (committed) {
    return {
      session: committed.session,
      metrics: addMetrics(metrics, committed.metrics)
    };
  }

  if (Array.from(label).length <= 1) {
    throw new Error(`No visible zh-TW candidate for ${label} after ${targetEntry.key}`);
  }

  for (const _symbol of Array.from(targetEntry.key)) {
    const selected = selectVisibleTile(next, (candidate) => candidate.action === TileAction.Backspace);
    next = selected.session;
    metrics = addMetrics(metrics, selected.metrics);
  }

  for (const character of Array.from(label)) {
    const selected = composeZhTwToken(next, character);
    next = selected.session;
    metrics = addMetrics(metrics, selected.metrics);
  }

  return { session: next, metrics };
}

function selectVisibleTileAcrossSuggestionPages(session, predicate, maxPages = 3) {
  let next = session;
  let metrics = blankMetrics();

  for (let page = 0; page < maxPages; page += 1) {
    const position = selectablePositions(next).find(({ candidate }) => predicate(candidate));
    if (position) {
      const selected = selectPosition(next, position);
      return {
        session: selected.session,
        metrics: addMetrics(metrics, selected.metrics)
      };
    }

    const morePosition = selectablePositions(next)
      .find(({ candidate }) => candidate.action === TileAction.MoreSuggestions);
    if (!morePosition) return null;

    const selectedMore = selectPosition(next, morePosition);
    next = selectedMore.session;
    metrics = addMetrics(metrics, selectedMore.metrics);
  }

  return null;
}

function selectVisibleTile(session, predicate) {
  const position = selectablePositions(session).find(({ candidate }) => predicate(candidate));
  if (!position) {
    throw new Error(`No visible tile matching predicate; labels=${visibleBoard(session).flat().map((candidate) => candidate.label).join(" ")}`);
  }
  return selectPosition(session, position);
}

function bestZhTwEntry(label) {
  return ZhTwFrequencyDictionary
    .filter((entry) => entry.label === label)
    .sort((left, right) =>
      zhTwKeyPreference(label, left.key) - zhTwKeyPreference(label, right.key) ||
      left.frequencyRank - right.frequencyRank
    )[0] ?? null;
}

function zhTwKeyPreference(label, key) {
  const labelLength = Array.from(label).length;
  const keyLength = Array.from(key).length;
  if (labelLength > 1 && keyLength > labelLength) return 0;
  if (labelLength > 1) return 1;
  return keyLength;
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
