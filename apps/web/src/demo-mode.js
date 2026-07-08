import { ScanStage, TileAction, ZhTwFrequencyDictionary, scanDurationForStage, visibleBoard } from "../../../packages/aac-core/src/index.js";
import { InputIntent } from "./input.js";

const demoStorageKey = "shine-aac-demo-mode";
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
      pause(5000),
      ...sayWords(["I", "NEED", "HELP"], 5000),
      pause(6500),
      ...sayWords(["PAIN"], 5200),
      pause(6000),
      ...saySpelled("LEFT LEG PAIN", 7000),
      pause(6500),
      ...saySpelledWithCorrection([...letters("HOP"), select("DEL"), letter("T")], 6500),
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
      ...saySpelledWithCorrection([...letters("WATR"), select("DEL"), letter("E"), letter("R")], 7600),
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
      pause(1800),
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

export function createDemoMode({ getHighlightStartedAt, getSession, isReviewHoldActive, receiveInput }) {
  let active = false;
  let stopped = false;
  let runId = 0;
  let activationCount = 0;

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
    document.body.classList.add("demo-active");
    document.addEventListener("pointerdown", stopFromPointer, true);
    globalThis.ShineAacDemoError = "";
    runScenario(scenario, currentRunId).catch((error) => {
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
    document.body.classList.remove("demo-active");
    document.removeEventListener("pointerdown", stopFromPointer, true);
  }

  function isActive() {
    return active;
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
      } else if (step.type === "zh-tw-commit") {
        await commitZhTwLabel(step, currentRunId);
      } else {
        await chooseTarget(step, currentRunId);
        await resumeAfterReviewHold(currentRunId);
        await delay(260);
      }
    }
    if (runId === currentRunId) stop();
  }

  async function chooseTarget(target, currentRunId) {
    await waitForActivationWindow(() => rowReadyFor(target), currentRunId, undefined, `row ${target.label}/${target.action ?? ""}`);
    receiveDemoInput();
    await delay(120);
    await waitForActivationWindow(() => cellReadyFor(target), currentRunId, undefined, `cell ${target.label}/${target.action ?? ""}`);
    receiveDemoInput();
  }

  async function commitZhTwLabel(target, currentRunId) {
    for (const symbol of Array.from(target.key)) {
      await chooseTarget(select(symbol, { action: TileAction.Append }), currentRunId);
      await resumeAfterReviewHold(currentRunId);
      await delay(120);
    }

    for (let page = 0; page < 3; page += 1) {
      if (visibleBoard(getSession()).flat().some((candidate) => tileMatchesTarget(candidate, target))) {
        await chooseTarget(target, currentRunId);
        await resumeAfterReviewHold(currentRunId);
        await delay(260);
        return;
      }
      if (!visibleBoard(getSession()).flat().some((candidate) => candidate.action === TileAction.MoreSuggestions)) break;
      await chooseTarget(actionTarget(TileAction.MoreSuggestions), currentRunId);
      await resumeAfterReviewHold(currentRunId);
      await delay(120);
    }

    if (Array.from(target.label).length <= 1) {
      throw new Error(`Demo mode could not find zh-TW candidate ${target.label} after ${target.key}`);
    }

    for (const _symbol of Array.from(target.key)) {
      await chooseTarget(actionTarget(TileAction.Backspace), currentRunId);
      await resumeAfterReviewHold(currentRunId);
      await delay(120);
    }

    for (const character of Array.from(target.label)) {
      await commitZhTwLabel(zhTwTarget(character), currentRunId);
    }
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

  function cellReadyFor(target) {
    const session = getSession();
    const scanner = session.scannerState;
    if (scanner.stage !== ScanStage.FirstCell && scanner.stage !== ScanStage.Cells) return false;
    const tile = visibleBoard(session)[scanner.rowIndex]?.[scanner.cellIndex];
    return tileMatchesTarget(tile, target);
  }

  async function waitForActivationWindow(predicate, currentRunId, timeoutMs = 45000, description = "scanner target") {
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

  function receiveDemoInput() {
    activationCount += 1;
    receiveInput({ intent: InputIntent.Activate, source: "demo-mode" });
  }

  function highlightSignature() {
    const scanner = getSession().scannerState;
    return `${scanner.stage}:${scanner.rowIndex}:${scanner.cellIndex}`;
  }

  function highlightProgress() {
    const session = getSession();
    const elapsed = Math.max(0, performance.now() - getHighlightStartedAt());
    const duration = Math.max(1, scanDurationForStage(session.scannerState, session.config));
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
    isActive
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
  return labels.map(zhTwTarget);
}

function zhTwPodcastMessage() {
  return [
    ...zhTwMessage(["\u807d"]),
    zhTwSpace(),
    ...zhTwSpellText("podcast"),
    zhTwSpace(),
    ...zhTwMessage(["\u65b0", "\u8cc7\u6599", "\u593e"])
  ];
}

function zhTwSpellText(text) {
  return Array.from(text).map((character) => {
    if (character === " ") return zhTwSpace();
    return letter(character);
  });
}

function zhTwSpace() {
  return select("\u7a7a\u683c", { output: " ", action: TileAction.Space });
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
  return saySpelledWithCorrection(spellText(text), waitMs);
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

function spellText(text) {
  return Array.from(text).map((character) => {
    if (character === " ") return select("SPC", { output: " " });
    return letter(character);
  });
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

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
