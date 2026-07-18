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

const MaxZhTwOptimizerSegmentLength = Math.max(
  1,
  ...ZhTwFrequencyDictionary.map((entry) => Array.from(entry.label).length)
);
const ZhTwOptimizerLabels = new Set(ZhTwFrequencyDictionary.map((entry) => entry.label));

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
  const metrics = { ...blankMetrics(), selections: 1 };

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
    zhTwDirectPhraseCommits: left.zhTwDirectPhraseCommits + right.zhTwDirectPhraseCommits,
    zhTwDecomposedPhraseFallbacks: left.zhTwDecomposedPhraseFallbacks + right.zhTwDecomposedPhraseFallbacks,
    tileActions: addActionCounts(left.tileActions, right.tileActions)
  };
}

function compareMetrics(left, right) {
  return left.switches - right.switches ||
    left.advances - right.advances ||
    left.estimatedTimeMs - right.estimatedTimeMs ||
    left.selections - right.selections;
}

function blankMetrics() {
  return {
    selections: 0,
    switches: 0,
    advances: 0,
    estimatedTimeMs: 0,
    zhTwDirectPhraseCommits: 0,
    zhTwDecomposedPhraseFallbacks: 0,
    tileActions: {}
  };
}

function addActionCounts(left = {}, right = {}) {
  const merged = { ...left };
  for (const [action, count] of Object.entries(right)) {
    merged[action] = (merged[action] ?? 0) + count;
  }
  return merged;
}

export function composeToken(session, token) {
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
    if (Array.from(label).length > 1) {
      committed.metrics.zhTwDirectPhraseCommits += 1;
    }
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

  metrics.zhTwDecomposedPhraseFallbacks += 1;
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

export function optimizeZhTwText(startSession, targetText) {
  if (startSession.config.profileId !== "zh-TW") {
    throw new Error("optimizeZhTwText only supports the zh-TW profile");
  }

  const units = Array.from(String(targetText));
  const best = new Map();
  best.set(0, { session: startSession, metrics: blankMetrics(), sequence: [] });

  for (let offset = 0; offset < units.length; offset += 1) {
    const state = best.get(offset);
    if (!state) continue;

    for (const token of zhTwOptimizerTokensAt(units, offset)) {
      try {
        const selected = composeToken(state.session, token);
        const nextOffset = offset + Array.from(token).length;
        const candidate = {
          session: selected.session,
          metrics: addMetrics(state.metrics, selected.metrics),
          sequence: [...state.sequence, token]
        };
        const existing = best.get(nextOffset);
        if (!existing || compareMetrics(candidate.metrics, existing.metrics) < 0) {
          best.set(nextOffset, candidate);
        }
      } catch {
        // An optimizer branch can fail if a source-backed label is not reachable in the current UI state.
      }
    }
  }

  const result = best.get(units.length);
  if (!result) {
    throw new Error(`No optimized zh-TW path found for ${JSON.stringify(targetText)}`);
  }
  return result;
}

function zhTwOptimizerTokensAt(units, offset) {
  if (isZhTwLatinCharacter(units[offset])) {
    let end = offset;
    while (end < units.length && isZhTwLatinCharacter(units[end])) end += 1;
    return [units.slice(offset, end).join("")];
  }

  const tokens = [];
  const maxLength = Math.min(MaxZhTwOptimizerSegmentLength, units.length - offset);
  for (let length = 1; length <= maxLength; length += 1) {
    const token = units.slice(offset, offset + length).join("");
    if (ZhTwOptimizerLabels.has(token)) tokens.push(token);
  }
  return tokens.sort((left, right) => Array.from(right).length - Array.from(left).length);
}

function isZhTwLatinCharacter(character) {
  return /^[A-Za-z ?]$/u.test(character);
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
      compareMetrics(left.metrics, right.metrics)
    )[0] ?? results[0];
}

export function benchmarkLimitFailures(benchmark, result) {
  if (result?.error) return [`unreachable: ${result.error.message}`];

  const failures = [];
  const limits = [
    ["selections", benchmark.maxSelections, result.metrics.selections, "selections"],
    ["switch activations", benchmark.maxSwitchActivations, result.metrics.switches, "activations"],
    ["scanner advances", benchmark.maxScannerAdvances, result.metrics.advances, "advances"],
    ["estimated scan time", benchmark.maxEstimatedScanTimeSeconds, result.metrics.estimatedTimeMs / 1000, "seconds"]
  ];
  for (const [label, limit, actual, unit] of limits) {
    if (!Number.isFinite(limit) || actual <= limit) continue;
    failures.push(`${label} ${formatMetric(actual)} ${unit} exceeds ${formatMetric(limit)}`);
  }
  return failures;
}

export function createBenchmarkSnapshot(benchmark, result) {
  return {
    id: benchmark.id,
    profileId: benchmark.profileId ?? "en-US",
    source: benchmark.source,
    purpose: benchmark.purpose,
    timingTarget: benchmark.timingTarget ?? null,
    reachable: !result?.error,
    error: result?.error?.message ?? null,
    sequence: result?.sequence ?? null,
    finalMessage: result?.session?.message ?? null,
    metrics: result?.error ? null : {
      selections: result.metrics.selections,
      switches: result.metrics.switches,
      advances: result.metrics.advances,
      estimatedTimeMs: result.metrics.estimatedTimeMs,
      moreSuggestions: result.metrics.tileActions[TileAction.MoreSuggestions] ?? 0,
      tileActions: { ...result.metrics.tileActions }
    }
  };
}

export function compareBenchmarkSnapshots(baselineSnapshot, candidateSnapshot, options = {}) {
  const baselineTasks = baselineSnapshot?.tasks ?? [];
  const candidateTasks = candidateSnapshot?.tasks ?? [];
  const duplicateBaselineTaskIds = duplicateIds(baselineTasks);
  const duplicateCandidateTaskIds = duplicateIds(candidateTasks);
  const baselineById = new Map(baselineTasks.map((task) => [task.id, task]));
  const candidateById = new Map(candidateTasks.map((task) => [task.id, task]));
  const missingTaskIds = baselineTasks.filter((task) => !candidateById.has(task.id)).map((task) => task.id);
  const unexpectedTaskIds = candidateTasks.filter((task) => !baselineById.has(task.id)).map((task) => task.id);
  const unreachableTaskIds = candidateTasks.filter((task) => !task.reachable).map((task) => task.id);
  const matchedTasks = baselineTasks
    .filter((task) => candidateById.has(task.id))
    .map((baseline) => ({ baseline, candidate: candidateById.get(baseline.id) }));
  const taskDeltas = matchedTasks.map(({ baseline, candidate }) => benchmarkTaskDelta(baseline, candidate));
  const matchedBaselineTasks = matchedTasks.map(({ baseline }) => baseline);
  const matchedCandidateTasks = matchedTasks.map(({ candidate }) => candidate);
  const baselineSummary = summarizeBenchmarkSnapshots(matchedBaselineTasks);
  const candidateSummary = summarizeBenchmarkSnapshots(matchedCandidateTasks);
  const functionGroups = Object.entries(options.functionGroups ?? {}).map(([id, purposes]) => {
    const purposeSet = new Set(purposes);
    const baselineGroup = matchedBaselineTasks.filter((task) => purposeSet.has(task.purpose));
    const candidateGroup = matchedCandidateTasks.filter((task) => purposeSet.has(task.purpose));
    return {
      id,
      purposes: [...purposes],
      baseline: summarizeBenchmarkSnapshots(baselineGroup),
      candidate: summarizeBenchmarkSnapshots(candidateGroup)
    };
  });
  const gates = [
    comparisonGate(
      "schema",
      baselineSnapshot?.schemaVersion === 1 && candidateSnapshot?.schemaVersion === 1,
      `baseline=${baselineSnapshot?.schemaVersion ?? "missing"}, candidate=${candidateSnapshot?.schemaVersion ?? "missing"}`
    ),
    comparisonGate(
      "task-set",
      (options.allowTaskSetChanges === true || (missingTaskIds.length === 0 && unexpectedTaskIds.length === 0)) &&
        duplicateBaselineTaskIds.length === 0 && duplicateCandidateTaskIds.length === 0,
      `missing=${missingTaskIds.length}, unexpected=${unexpectedTaskIds.length}, duplicate baseline=${duplicateBaselineTaskIds.length}, duplicate candidate=${duplicateCandidateTaskIds.length}, changes allowed=${options.allowTaskSetChanges === true}`
    ),
    comparisonGate("reachability", unreachableTaskIds.length === 0, `unreachable=${unreachableTaskIds.length}`),
    noIncreaseGate("total-switches", baselineSummary.totals.switches, candidateSummary.totals.switches),
    noIncreaseGate("total-scan-time", baselineSummary.totals.estimatedTimeMs, candidateSummary.totals.estimatedTimeMs),
    noIncreaseGate("p90-switches", baselineSummary.p90.switches, candidateSummary.p90.switches),
    noIncreaseGate("p90-scan-time", baselineSummary.p90.estimatedTimeMs, candidateSummary.p90.estimatedTimeMs),
    comparisonGate(
      "bounded-task-paging",
      taskDeltas.every((task) => (task.metrics?.moreSuggestions ?? 0) <= 1),
      `max additional pages=${Math.max(0, ...taskDeltas.map((task) => task.metrics?.moreSuggestions ?? 0))}`
    ),
    ...functionGroups.flatMap((group) => [
      noIncreaseGate(
        `group-${group.id}-switches`,
        group.baseline.totals.switches,
        group.candidate.totals.switches
      ),
      noIncreaseGate(
        `group-${group.id}-scan-time`,
        group.baseline.totals.estimatedTimeMs,
        group.candidate.totals.estimatedTimeMs
      )
    ])
  ];
  const hasMeasuredImprovement = gates.every((gate) => gate.passed) && (
    candidateSummary.totals.switches < baselineSummary.totals.switches ||
    candidateSummary.totals.estimatedTimeMs < baselineSummary.totals.estimatedTimeMs ||
    candidateSummary.totals.moreSuggestions < baselineSummary.totals.moreSuggestions
  );

  return {
    baseline: baselineSummary,
    candidate: candidateSummary,
    missingTaskIds,
    unexpectedTaskIds,
    duplicateBaselineTaskIds,
    duplicateCandidateTaskIds,
    unreachableTaskIds,
    taskDeltas,
    functionGroups,
    gates,
    passed: gates.every((gate) => gate.passed),
    hasMeasuredImprovement
  };
}

function duplicateIds(tasks) {
  const seen = new Set();
  const duplicates = new Set();
  for (const task of tasks) {
    if (seen.has(task.id)) duplicates.add(task.id);
    seen.add(task.id);
  }
  return [...duplicates];
}

function benchmarkTaskDelta(baseline, candidate) {
  if (!baseline.metrics || !candidate.metrics) {
    return { id: baseline.id, purpose: baseline.purpose, metrics: null, classification: "unreachable" };
  }
  const metrics = {
    selections: candidate.metrics.selections - baseline.metrics.selections,
    switches: candidate.metrics.switches - baseline.metrics.switches,
    advances: candidate.metrics.advances - baseline.metrics.advances,
    estimatedTimeMs: candidate.metrics.estimatedTimeMs - baseline.metrics.estimatedTimeMs,
    moreSuggestions: candidate.metrics.moreSuggestions - baseline.metrics.moreSuggestions
  };
  const throughputDeltas = [metrics.switches, metrics.estimatedTimeMs, metrics.moreSuggestions];
  const hasImprovement = throughputDeltas.some((value) => value < 0);
  const hasRegression = throughputDeltas.some((value) => value > 0);
  const classification = hasImprovement && hasRegression
    ? "mixed"
    : hasRegression
      ? "regressed"
      : hasImprovement
        ? "improved"
        : "unchanged";
  return { id: baseline.id, purpose: baseline.purpose, metrics, classification };
}

function summarizeBenchmarkSnapshots(tasks) {
  const reachable = tasks.filter((task) => task.reachable && task.metrics);
  return {
    taskCount: tasks.length,
    reachableCount: reachable.length,
    totals: {
      selections: sumSnapshotMetric(reachable, "selections"),
      switches: sumSnapshotMetric(reachable, "switches"),
      advances: sumSnapshotMetric(reachable, "advances"),
      estimatedTimeMs: sumSnapshotMetric(reachable, "estimatedTimeMs"),
      moreSuggestions: sumSnapshotMetric(reachable, "moreSuggestions")
    },
    p90: {
      selections: percentile(reachable.map((task) => task.metrics.selections), 0.9),
      switches: percentile(reachable.map((task) => task.metrics.switches), 0.9),
      advances: percentile(reachable.map((task) => task.metrics.advances), 0.9),
      estimatedTimeMs: percentile(reachable.map((task) => task.metrics.estimatedTimeMs), 0.9),
      moreSuggestions: percentile(reachable.map((task) => task.metrics.moreSuggestions), 0.9)
    }
  };
}

function sumSnapshotMetric(tasks, key) {
  return tasks.reduce((total, task) => total + task.metrics[key], 0);
}

function percentile(values, probability) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * probability) - 1);
  return sorted[index];
}

function comparisonGate(id, passed, detail) {
  return { id, passed, detail };
}

function noIncreaseGate(id, baseline, candidate) {
  return comparisonGate(id, candidate <= baseline, `baseline=${formatMetric(baseline)}, candidate=${formatMetric(candidate)}`);
}

function formatMetric(value) {
  if (!Number.isFinite(value)) return "n/a";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
