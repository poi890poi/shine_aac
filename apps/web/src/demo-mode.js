import {
  ScanMode,
  ScanStage,
  TileAction,
  ZhTwFrequencyDictionary,
  ZhuyinInputSymbols,
  scanDurationForStage,
  scanRowBlocks,
  selectableCount,
  visibleBoard
} from "../../../packages/aac-core/src/index.js";
import { InputIntent } from "./input.js";

const demoStorageKey = "shine-aac-demo-mode";
export const DemoMaximumScanIntervalMs = 600;
export const DemoEscapeLadderPassLimit = 2;

export function demoTimingConfig(baseConfig = {}) {
  return {
    ...baseConfig,
    scanIntervalMs: Math.min(DemoMaximumScanIntervalMs, Math.max(1, Number(baseConfig.scanIntervalMs) || DemoMaximumScanIntervalMs)),
    transitionPauseMs: 0,
    firstCellPauseMs: Math.min(DemoMaximumScanIntervalMs, Math.max(1, Number(baseConfig.firstCellPauseMs) || DemoMaximumScanIntervalMs)),
    inputLatencyCompensationMs: 0
  };
}

export function longestVisibleContinuation(rows, targetText, options = {}) {
  const caseInsensitive = options.caseInsensitive === true;
  const minimumLengthExclusive = Math.max(0, Number(options.minimumLengthExclusive) || 0);
  const normalizedTarget = normalizeDemoText(targetText, caseInsensitive);
  let best = null;
  let bestLength = minimumLengthExclusive;

  for (const candidate of rows.flat()) {
    if (![TileAction.Append, TileAction.CommitCandidate].includes(candidate?.action)) continue;
    const output = String(candidate.output ?? "");
    const outputLength = Array.from(output).length;
    if (outputLength <= bestLength) continue;
    if (!normalizedTarget.startsWith(normalizeDemoText(output, caseInsensitive))) continue;
    best = candidate;
    bestLength = outputLength;
  }
  return best;
}
const wordOutputs = Object.freeze({
  I: "I",
  YOU: "you",
  WANT: "want",
  NEED: "need",
  YES: "yes",
  NO: "no",
  HELP: "help",
  PAIN: "pain",
  WATER: "water",
  FOOD: "food",
  GO: "go",
  STOP: "stop"
});
const demoScenarios = Object.freeze({
  water: Object.freeze({
    steps: Object.freeze([
      escapeLadderDemo(),
      pause(1800),
      ...sayWords(["I", "NEED", "HELP"], 5000),
      pause(6500),
      ...sayWords(["PAIN"], 5200),
      pause(6000),
      ...saySpelled("LEFT LEG PAIN", 7000),
      pause(6500),
      ...saySpelledWithCorrection([...letters("HOP"), select("UNDO"), letter("T")], 6500),
      pause(6000),
      ...sayWords(["NO", "STOP"], 5200),
      pause(7000),
      ...saySpelled("TOO LOUD", 7000),
      pause(6500),
      ...sayWords(["I", "WANT", "WATER"], 5600),
      pause(6000),
      ...wordUndoCorrection(["I", "WANT", "WATER"], ["FOOD"], 6500),
      pause(7000),
      ...saySpelled("CALL MOM", 7600),
      pause(7000),
      ...saySpelled("MUSIC", 6500),
      pause(6500),
      ...saySpelled("BED UP", 7000),
      pause(7000),
      ...sayWords(["I", "NEED", "HELP"], 6000),
      pause(6500),
      ...saySpelled("OXYGEN", 8000),
      pause(7000),
      ...saySpelled("QUIET", 7600),
      pause(6500),
      ...saySpelled("JAZZ", 7600),
      pause(6500),
      ...saySpelled("NOT NOW", 7000),
      pause(7000),
      ...saySpelled("MOVE LEFT", 7600),
      pause(6500),
      ...saySpelledWithCorrection([...letters("WATR"), select("UNDO"), letter("E"), letter("R")], 7600),
      pause(6500),
      ...sayWords(["YES"], 4600),
      pause(5200),
      ...sayWords(["NO"], 4600),
      pause(6200),
      ...saySpelled("THANK YOU", 8200),
      pause(7000),
      ...sayWords(["YOU", "HELP"], 6200),
      pause(6500),
      ...saySpelled("OK", 5200),
      pause(6200),
      ...sayWords(["I", "WANT", "WATER"], 7600)
    ])
  }),
  "zh-tw-home": Object.freeze({
    steps: Object.freeze([
      escapeLadderDemo(),
      pause(800),
      ...zhTwPodcastMessage(),
      ...zhTwClearBreak(1600),
      ...zhTwMessage([
        "冰", "紅茶",
        "少", "冰",
        "不要", "太", "甜",
        "等", "一下", "喝",
        "用", "吸管"
      ]),
      ...zhTwClearBreak(2200),
      ...zhTwMessage([
        "音量", "小",
        "從", "剛剛", "那裡"
      ]),
      ...zhTwClearBreak(2400),
      ...zhTwMessage([
        "今天", "比較", "累",
        "但是", "心情", "好",
        "想", "聽", "你", "講",
        "這樣", "很", "舒服",
        "謝謝"
      ]),
      pause(9000)
    ])
  })
});

export function createDemoMode({
  getHighlightStartedAt,
  getSession,
  getTimingConfig,
  isReviewHoldActive,
  receiveInput,
  refreshScanTiming,
  resetSession
}) {
  let active = false;
  let stopped = false;
  let runId = 0;
  let activationCount = 0;
  let scanPassLimitOverride = null;

  function startFromEnvironment() {
    const scenarioId = scenarioIdFromEnvironment();
    if (scenarioId) start(scenarioId);
  }

  function start(scenarioId) {
    const selectedScenarioId = scenarioId ?? (getSession().config.profileId === "zh-TW" ? "zh-tw-home" : "water");
    const scenario = demoScenarios[selectedScenarioId] ?? demoScenarios.water;
    const currentRunId = ++runId;
    active = true;
    stopped = false;
    activationCount = 0;
    scanPassLimitOverride = DemoEscapeLadderPassLimit;
    resetSession();
    document.body.classList.add("demo-active");
    document.addEventListener("pointerdown", stopFromPointer, true);
    globalThis.ShineAacDemoError = "";
    globalThis.ShineAacDemoStats = Object.freeze({
      moreSelections: 0,
      continuationMoreSelections: 0,
      pagedContinuationCommits: 0,
      zhuyinCommits: 0,
      greedySuggestionSelections: 0,
      greedyCharacters: 0,
      itemEscapeReturns: 0,
      scanStops: 0,
      wakeOnlyResumes: 0,
      timing: Object.freeze(demoTimingSnapshot())
    });
    runScenario(scenario, currentRunId).catch((error) => {
      if (stopped || runId !== currentRunId) return;
      globalThis.ShineAacDemoError = error?.stack ?? String(error);
      console.error(globalThis.ShineAacDemoError);
      if (runId === currentRunId) stop();
    });
  }

  function stop() {
    if (!active) return;
    stopped = true;
    active = false;
    runId += 1;
    scanPassLimitOverride = null;
    document.body.classList.remove("demo-active");
    document.removeEventListener("pointerdown", stopFromPointer, true);
    refreshScanTiming?.();
  }

  function isActive() {
    return active;
  }

  function scanPassLimit(configuredLimit) {
    return scanPassLimitOverride ?? configuredLimit;
  }

  function stopFromPointer(event) {
    if (!active || !event.isTrusted) return;
    stop();
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async function runScenario(scenario, currentRunId) {
    await delay(300);
    for (const step of scenario.steps) {
      assertRunning(currentRunId);
      if (step.type === "pause") {
        await delay(step.ms);
      } else if (step.type === "escape-ladder") {
        await demonstrateEscapeLadder(currentRunId);
      } else if (step.type === "zh-tw-text") {
        await composeZhTwText(step, currentRunId);
      } else if (step.type === "spell-with-suggestions") {
        await spellTextWithSuggestions(step.text, currentRunId);
      } else {
        await chooseTarget(step, currentRunId);
        await resumeAfterReviewHold(currentRunId);
        await delay(260);
      }
    }
    if (runId === currentRunId) stop();
  }

  async function demonstrateEscapeLadder(currentRunId) {
    const messageBefore = getSession().message;
    if (getSession().config.scanMode === ScanMode.BlockRowColumn) {
      await waitForActivationWindow(
        () => getSession().scannerState.stage === ScanStage.Blocks,
        currentRunId,
        undefined,
        "escape-ladder block"
      );
      receiveDemoInput();
    }
    await waitForActivationWindow(
      () => getSession().scannerState.stage === ScanStage.Rows,
      currentRunId,
      undefined,
      "escape-ladder row"
    );
    receiveDemoInput();

    await waitForScannerState(
      (scanner) => scanner.stage === ScanStage.Rows && scanner.returningToRows,
      currentRunId,
      "item passes to return to rows"
    );
    recordEscapeLadderStat("itemEscapeReturns");

    await waitForScannerState(
      (scanner) => scanner.stage === ScanStage.Stopped,
      currentRunId,
      "row passes to stop scanning"
    );
    recordEscapeLadderStat("scanStops");
    await delay(2200);
    assertRunning(currentRunId);

    receiveDemoInput();
    await waitForScannerState(
      (scanner) => getSession().config.scanMode === ScanMode.BlockRowColumn
        ? scanner.stage === ScanStage.Blocks && scanner.blockIndex === 0
        : scanner.stage === ScanStage.Rows && scanner.rowIndex === 0,
      currentRunId,
      "wake-only activation"
    );
    if (getSession().message !== messageBefore || getSession().lastSelection) {
      throw new Error("Demo wake activation changed communication content");
    }
    recordEscapeLadderStat("wakeOnlyResumes");

    scanPassLimitOverride = 0;
    refreshScanTiming?.();
    await delay(900);
  }

  async function waitForScannerState(predicate, currentRunId, description) {
    const timeoutMs = Math.max(45000, demoActivationTimeoutMs());
    const startedAt = performance.now();
    while (performance.now() - startedAt < timeoutMs) {
      assertRunning(currentRunId);
      if (predicate(getSession().scannerState)) return;
      await delay(10);
    }
    const scanner = getSession().scannerState;
    throw new Error(
      `Demo mode timed out waiting for ${description}; stage=${scanner.stage}; row=${scanner.rowIndex}; cell=${scanner.cellIndex}; pass=${scanner.passIndex}`
    );
  }

  function recordEscapeLadderStat(name) {
    const previous = globalThis.ShineAacDemoStats ?? {};
    globalThis.ShineAacDemoStats = Object.freeze({
      ...previous,
      [name]: Number(previous[name] ?? 0) + 1
    });
  }

  async function chooseTarget(target, currentRunId) {
    if (getSession().config.scanMode === ScanMode.BlockRowColumn) {
      await waitForActivationWindow(() => blockReadyFor(target), currentRunId, undefined, `block ${target.label}/${target.action ?? ""}`);
      receiveDemoInput();
      await delay(120);
    }
    await waitForActivationWindow(() => rowReadyFor(target), currentRunId, undefined, `row ${target.label}/${target.action ?? ""}`);
    receiveDemoInput();
    await delay(120);
    await waitForActivationWindow(() => cellReadyFor(target), currentRunId, undefined, `cell ${target.label}/${target.action ?? ""}`);
    receiveDemoInput();
  }

  async function composeZhTwText(step, currentRunId) {
    let remainingText = String(step.text);
    while (remainingText) {
      const visibleCandidate = await chooseVisibleContinuation(remainingText, currentRunId);
      if (visibleCandidate) {
        remainingText = consumeDemoPrefix(remainingText, visibleCandidate.output);
        continue;
      }

      const target = step.targets.find((candidate) => remainingText.startsWith(candidate.label))
        ?? zhTwTarget(Array.from(remainingText)[0]);
      const committedText = await commitZhTwLabel(target, currentRunId, remainingText);
      remainingText = consumeDemoPrefix(remainingText, committedText);
    }
  }

  async function commitZhTwLabel(target, currentRunId, remainingText = target.label) {
    const continuationMoreBefore = Number(globalThis.ShineAacDemoStats?.continuationMoreSelections ?? 0);
    let enteredSymbolCount = 0;
    for (const symbol of Array.from(target.key)) {
      const visibleCandidate = await chooseVisibleContinuation(remainingText, currentRunId);
      if (visibleCandidate) {
        if (enteredSymbolCount > 0 && visibleCandidate.action === TileAction.CommitCandidate) recordZhuyinCommit();
        return visibleCandidate.output;
      }

      const symbolTarget = select(symbol, { output: symbol, action: TileAction.Append });
      const selected = await chooseTargetAcrossSuggestionPages(symbolTarget, currentRunId);
      if (!selected) {
        throw new Error(`Demo mode could not find zh-TW symbol ${symbol} while composing ${target.label} after ${target.key}`);
      }
      enteredSymbolCount += 1;
      await resumeAfterReviewHold(currentRunId);
      await delay(120);
    }

    const visibleCandidate = await chooseVisibleContinuation(remainingText, currentRunId);
    if (visibleCandidate) {
      if (visibleCandidate.action === TileAction.CommitCandidate) recordZhuyinCommit();
      return visibleCandidate.output;
    }

    if (await chooseTargetAcrossSuggestionPages(target, currentRunId)) {
      if (Number(globalThis.ShineAacDemoStats?.continuationMoreSelections ?? 0) > continuationMoreBefore) {
        recordPagedContinuationCommit();
      }
      recordZhuyinCommit();
      await resumeAfterReviewHold(currentRunId);
      await delay(260);
      return target.output;
    }

    if (Array.from(target.label).length <= 1) {
      throw new Error(`Demo mode could not find zh-TW candidate ${target.label} after ${target.key}`);
    }

    for (const _symbol of Array.from(target.key)) {
      await chooseTarget(actionTarget(TileAction.Undo), currentRunId);
      await resumeAfterReviewHold(currentRunId);
      await delay(120);
    }

    return commitZhTwLabel(zhTwTarget(Array.from(target.label)[0]), currentRunId, remainingText);
  }

  async function chooseTargetAcrossSuggestionPages(target, currentRunId, maxPages = 3) {
    for (let page = 0; page < maxPages; page += 1) {
      const board = visibleBoard(getSession()).flat();
      if (board.some((candidate) => tileMatchesTarget(candidate, target))) {
        await chooseTarget(target, currentRunId);
        return true;
      }
      if (page >= maxPages - 1) return false;
      if (!board.some((candidate) => candidate.action === TileAction.MoreSuggestions)) return false;

      await chooseTarget(actionTarget(TileAction.MoreSuggestions), currentRunId);
      recordDemoPaging(target);
      await resumeAfterReviewHold(currentRunId);
      await delay(120);
    }
    return false;
  }

  async function spellTextWithSuggestions(text, currentRunId) {
    const targetText = String(text).trim();
    let consumedLength = 0;
    let tokenStart = 0;

    while (consumedLength < targetText.length) {
      if (/\s/u.test(targetText[consumedLength])) {
        if (!/\s$/u.test(getSession().message)) {
          await chooseTarget(actionTarget(TileAction.Space), currentRunId);
          await resumeAfterReviewHold(currentRunId);
          await delay(260);
        }
        consumedLength += 1;
        tokenStart = consumedLength;
        continue;
      }

      const candidate = longestVisibleContinuation(
        visibleBoard(getSession()),
        targetText.slice(tokenStart),
        {
          caseInsensitive: true,
          minimumLengthExclusive: Array.from(targetText.slice(tokenStart, consumedLength)).length
        }
      );
      if (candidate) {
        await chooseTarget(select(candidate.label, { output: candidate.output, action: candidate.action }), currentRunId);
        recordGreedySuggestion(candidate);
        await resumeAfterReviewHold(currentRunId);
        await delay(260);
        consumedLength = tokenStart + candidate.output.length;
        while (consumedLength < targetText.length && /\s/u.test(targetText[consumedLength]) && /\s$/u.test(getSession().message)) {
          consumedLength += 1;
        }
        tokenStart = targetText.lastIndexOf(" ", Math.max(0, consumedLength - 1)) + 1;
        continue;
      }

      const character = Array.from(targetText.slice(consumedLength))[0];
      await chooseTarget(letter(character), currentRunId);
      await resumeAfterReviewHold(currentRunId);
      await delay(260);
      consumedLength += character.length;
    }
  }

  async function chooseVisibleContinuation(targetText, currentRunId) {
    const candidate = longestVisibleContinuation(visibleBoard(getSession()), targetText);
    if (!candidate) return null;
    await chooseTarget(select(candidate.label, { output: candidate.output, action: candidate.action }), currentRunId);
    recordGreedySuggestion(candidate);
    await resumeAfterReviewHold(currentRunId);
    await delay(260);
    return candidate;
  }

  function recordDemoPaging(target) {
    const previous = globalThis.ShineAacDemoStats ?? {};
    const isContinuation = target.action === TileAction.Append && ZhuyinInputSymbols.includes(target.output);
    globalThis.ShineAacDemoStats = Object.freeze({
      ...previous,
      moreSelections: Number(previous.moreSelections ?? 0) + 1,
      continuationMoreSelections: Number(previous.continuationMoreSelections ?? 0) + (isContinuation ? 1 : 0),
      pagedContinuationCommits: Number(previous.pagedContinuationCommits ?? 0),
      zhuyinCommits: Number(previous.zhuyinCommits ?? 0)
    });
  }

  function recordPagedContinuationCommit() {
    const previous = globalThis.ShineAacDemoStats ?? {};
    globalThis.ShineAacDemoStats = Object.freeze({
      ...previous,
      moreSelections: Number(previous.moreSelections ?? 0),
      continuationMoreSelections: Number(previous.continuationMoreSelections ?? 0),
      pagedContinuationCommits: Number(previous.pagedContinuationCommits ?? 0) + 1,
      zhuyinCommits: Number(previous.zhuyinCommits ?? 0)
    });
  }

  function recordZhuyinCommit() {
    const previous = globalThis.ShineAacDemoStats ?? {};
    globalThis.ShineAacDemoStats = Object.freeze({
      ...previous,
      moreSelections: Number(previous.moreSelections ?? 0),
      continuationMoreSelections: Number(previous.continuationMoreSelections ?? 0),
      pagedContinuationCommits: Number(previous.pagedContinuationCommits ?? 0),
      zhuyinCommits: Number(previous.zhuyinCommits ?? 0) + 1
    });
  }

  function recordGreedySuggestion(candidate) {
    const previous = globalThis.ShineAacDemoStats ?? {};
    globalThis.ShineAacDemoStats = Object.freeze({
      ...previous,
      greedySuggestionSelections: Number(previous.greedySuggestionSelections ?? 0) + 1,
      greedyCharacters: Number(previous.greedyCharacters ?? 0) + Array.from(String(candidate.output ?? "")).length
    });
  }

  async function resumeAfterReviewHold(currentRunId) {
    await delay(240);
    assertRunning(currentRunId);
    if (!isReviewHoldActive()) return;
    await waitForActivationWindow(() => true, currentRunId);
    receiveDemoInput();
  }

  function rowReadyFor(target) {
    const session = getSession();
    const scanner = session.scannerState;
    if (scanner.stage !== ScanStage.Rows) return false;
    const row = visibleBoard(session)[scanner.rowIndex] ?? [];
    return row.some((candidate) => tileMatchesTarget(candidate, target));
  }

  function blockReadyFor(target) {
    const session = getSession();
    const scanner = session.scannerState;
    if (scanner.stage !== ScanStage.Blocks) return false;
    const rows = visibleBoard(session);
    const blocks = scanRowBlocks(
      rows.length,
      (row) => selectableCount(rows[row]),
      session.config.scanBlockCount
    );
    return (blocks[scanner.blockIndex] ?? []).some((rowIndex) =>
      (rows[rowIndex] ?? []).some((candidate) => tileMatchesTarget(candidate, target))
    );
  }

  function cellReadyFor(target) {
    const session = getSession();
    const scanner = session.scannerState;
    if (scanner.stage !== ScanStage.FirstCell && scanner.stage !== ScanStage.Cells) return false;
    const tile = visibleBoard(session)[scanner.rowIndex]?.[scanner.cellIndex];
    return tileMatchesTarget(tile, target);
  }

  async function waitForActivationWindow(predicate, currentRunId, timeoutMs = demoActivationTimeoutMs(), description = "scanner target") {
    const startedAt = performance.now();
    while (performance.now() - startedAt < timeoutMs) {
      assertRunning(currentRunId);
      if (predicate()) {
        const signature = highlightSignature();
        while (predicate() && signature === highlightSignature()) {
          assertRunning(currentRunId);
          if (highlightProgress() >= nextActivationProgress()) return;
          await delay(8);
        }
      }
      await delay(10);
    }
    const session = getSession();
    const board = visibleBoard(session);
    throw new Error(`Demo mode timed out waiting for ${description}; stage=${session.scannerState.stage}; row=${session.scannerState.rowIndex}; cell=${session.scannerState.cellIndex}; labels=${board.flat().map((candidate) => candidate.label).join(" ")}`);
  }

  function demoActivationTimeoutMs() {
    const session = getSession();
    const board = visibleBoard(session);
    const timingConfig = getTimingConfig?.() ?? session.config;
    const blockCycleMs = session.config.scanMode === ScanMode.BlockRowColumn
      ? Math.min(5, board.length) * Math.max(1, timingConfig.scanIntervalMs)
      : 0;
    const rowCycleMs = Math.max(1, board.length) * Math.max(1, timingConfig.scanIntervalMs);
    const longestRow = Math.max(1, ...board.map((row) => row.length));
    const cellCycleMs = Math.max(1, timingConfig.firstCellPauseMs) +
      Math.max(0, longestRow - 1) * Math.max(1, timingConfig.scanIntervalMs) +
      Math.max(0, timingConfig.transitionPauseMs);
    return Math.max(45000, (blockCycleMs + rowCycleMs + cellCycleMs) * 2 + 5000);
  }

  function demoTimingSnapshot() {
    const timingConfig = getTimingConfig?.() ?? getSession().config;
    return {
      scanIntervalMs: timingConfig.scanIntervalMs,
      transitionPauseMs: timingConfig.transitionPauseMs,
      firstCellPauseMs: timingConfig.firstCellPauseMs,
      inputLatencyCompensationMs: timingConfig.inputLatencyCompensationMs
    };
  }

  function receiveDemoInput() {
    activationCount += 1;
    receiveInput({ intent: InputIntent.Activate, source: "demo-mode" });
  }

  function highlightSignature() {
    const scanner = getSession().scannerState;
    return `${scanner.stage}:${scanner.blockIndex}:${scanner.rowIndex}:${scanner.cellIndex}`;
  }

  function highlightProgress() {
    const session = getSession();
    const elapsed = Math.max(0, performance.now() - getHighlightStartedAt());
    const duration = Math.max(1, scanDurationForStage(session.scannerState, getTimingConfig?.() ?? session.config));
    return Math.min(1, elapsed / duration);
  }

  function nextActivationProgress() {
    return 0.36 + (activationCount % 5) * 0.025;
  }

  function tileMatchesTarget(tile, target) {
    if (!tile) return false;
    if (!target.anyLabel && tile.label !== target.label) return false;
    if (target.output !== undefined && tile.output !== target.output) return false;
    if (target.action !== undefined && tile.action !== target.action) return false;
    return true;
  }

  function assertRunning(currentRunId) {
    if (stopped || runId !== currentRunId) throw new Error("Demo mode stopped");
  }

  return Object.freeze({
    startFromEnvironment,
    start,
    stop,
    isActive,
    scanPassLimit
  });
}

function scenarioIdFromEnvironment() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("demo");
  const storedValue = localStorage.getItem(demoStorageKey);
  const normalized = normalizeScenarioId(queryValue ?? storedValue);
  return demoScenarios[normalized] ? normalized : null;
}

function normalizeScenarioId(value) {
  if (!value) return "";
  if (value === "1" || value === "true") return "water";
  return String(value).toLowerCase();
}

function zhTwMessage(labels) {
  return [Object.freeze({
    type: "zh-tw-text",
    text: labels.join(""),
    targets: Object.freeze(labels.map(zhTwTarget))
  })];
}

function zhTwPodcastMessage() {
  return [
    ...zhTwMessage(["\u807d"]),
    ...zhTwEnglishText("podcast"),
    ...zhTwMessage(["\u65b0", "\u8cc7\u6599", "\u593e"])
  ];
}

function zhTwEnglishText(text) {
  return [
    select("\u82f1\u6587", { output: "english", action: TileAction.OpenCategory }),
    spellWithSuggestions(text),
    select("\u6ce8\u97f3", { action: TileAction.CloseCategory })
  ];
}

function zhTwClearBreak(waitMs) {
  return [
    pause(waitMs),
    actionTarget(TileAction.Clear),
    pause(800)
  ];
}

function zhTwTarget(label) {
  const entry = bestZhTwEntryForDemo(label);
  if (!entry) throw new Error(`Missing zh-TW demo label ${label}`);
  return Object.freeze({
    type: "zh-tw-commit",
    label,
    output: label,
    action: TileAction.CommitCandidate,
    key: entry.key
  });
}

function bestZhTwEntryForDemo(label) {
  return ZhTwFrequencyDictionary
    .filter((entry) => entry.label === label)
    .sort((left, right) =>
      demoKeyPreference(label, left.key) - demoKeyPreference(label, right.key) ||
      left.frequencyRank - right.frequencyRank
    )[0];
}

function demoKeyPreference(label, key) {
  const labelLength = Array.from(label).length;
  const keyLength = Array.from(key).length;
  if (labelLength > 1 && keyLength > labelLength) return 0;
  if (labelLength > 1) return 1;
  return keyLength;
}

function sayWords(labels, waitMs) {
  return [
    ...labels.map(word),
    pause(waitMs),
    select("SAY"),
    pause(1800),
    select("CLR"),
    pause(2200)
  ];
}

function wordUndoCorrection(labels, replacementLabels, waitMs) {
  return [
    ...labels.map(word),
    pause(2800),
    select("UNDO"),
    pause(1800),
    ...replacementLabels.map(word),
    pause(waitMs),
    select("SAY"),
    pause(1800),
    select("CLR"),
    pause(2200)
  ];
}

function saySpelled(text, waitMs) {
  return [
    spellWithSuggestions(text),
    pause(waitMs),
    select("SAY"),
    pause(1800),
    select("CLR"),
    pause(2200)
  ];
}

function saySpelledWithCorrection(spellingSteps, waitMs) {
  return [
    ...spellingSteps,
    pause(waitMs),
    select("SAY"),
    pause(1800),
    select("CLR"),
    pause(2200)
  ];
}

function spellWithSuggestions(text) {
  return Object.freeze({ type: "spell-with-suggestions", text: String(text) });
}

function word(label) {
  return select(label, { output: wordOutputs[label] ?? label.toLowerCase() });
}

function letters(text) {
  return Array.from(text).filter((character) => character !== " ").map(letter);
}

function letter(character) {
  return select(character.toUpperCase(), { output: character.toLowerCase() });
}

function select(label, options = {}) {
  return Object.freeze({ type: "select", label, ...options });
}

function actionTarget(action) {
  return Object.freeze({ type: "select", label: "", action, anyLabel: true });
}

function pause(ms) {
  return Object.freeze({ type: "pause", ms });
}

function escapeLadderDemo() {
  return Object.freeze({ type: "escape-ladder" });
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeDemoText(value, caseInsensitive) {
  const text = String(value ?? "");
  return caseInsensitive ? text.toLocaleLowerCase("en-US") : text;
}

function consumeDemoPrefix(targetText, output) {
  const text = String(targetText);
  const prefix = String(output);
  if (!prefix || !text.startsWith(prefix)) {
    throw new Error(`Demo candidate ${JSON.stringify(prefix)} does not match remaining text ${JSON.stringify(text)}`);
  }
  return text.slice(prefix.length);
}
