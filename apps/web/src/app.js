import {
  CurrentConfigVersion,
  LanguageProfiles,
  ScanStage,
  ScanTimingPresets,
  TileAction,
  advanceSession,
  applyScanTimingPreset,
  createBoardConfig,
  createSession,
  loadProfileSuggestionDictionaryForConfig,
  loadProfileSymbolsForConfig,
  loadScanIntervalForConfig,
  loadTransitionPauseForConfig,
  loadFirstCellPauseForConfig,
  parseDictionary,
  parseSymbols,
  pressSwitch,
  scanDurationForStage,
  scanTimingPresetIdForConfig,
  serializeDictionary,
  serializeSymbols,
  speechLabelForTile,
  visibleBoard
} from "../../../packages/aac-core/src/index.js";
import { createDemoMode } from "./demo-mode.js";
import { clamp, escapeHtml, numberOrDefault } from "./form-utils.js";
import { InputIntent, isCameraInput, isHardwareInput } from "./input.js";
import { defaultUiConfig, loadUiConfig, saveUiConfig, syncNativeUiConfig } from "./ui-config.js";

const storageKey = "shine-aac-web-config-v1";
const webConfigVersion = CurrentConfigVersion;
const app = document.querySelector("#app");
const uiStorageKey = "shine-aac-web-ui-v1";

let session = createSession({ config: loadConfig() });
let uiConfig = loadUiConfig(uiStorageKey);
let highlightStartedAt = performance.now();
let highlightDeadlineAt = highlightStartedAt;
let timerId = 0;
let animationFrameId = 0;
let configOpen = false;
let calibrationOpen = false;
let calibrationTimerId = 0;
let lastScanAnnouncementKey = "";
let reviewHoldActive = false;
let suppressNextConfigClick = false;
let renderedBoardKey = "";
let renderedMessage = "";
let renderedTiles = [];
let renderedTileGrid = [];
let renderedPhaseElement = null;
let renderedVoiceElement = null;
let currentActiveTiles = [];
let currentProgressFills = [];
let progressTargetKey = "";
let pendingAdvanceSession = null;
let prepareAdvanceTimerId = 0;
let scanScheduleToken = 0;
let calibrationState = createCalibrationState();
const demoMode = createDemoMode({
  getHighlightStartedAt: () => highlightStartedAt,
  getSession: () => session,
  isReviewHoldActive: () => reviewHoldActive,
  receiveInput: handleInputEvent
});

globalThis.ShineAacInput = {
  receive: handleInputEvent
};

function loadConfig() {
  const defaults = createBoardConfig();
  const nativeConfig = loadNativeConfig(defaults);
  if (nativeConfig) return nativeConfig;

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!stored) return defaults;
    const storedVersion = Number(stored.configVersion) || 0;
    const profileDefaults = createBoardConfig({ profileId: stored.profileId });
    return createBoardConfig({
      profileId: stored.profileId,
      columns: numberOrDefault(stored.columns, defaults.columns),
      scanIntervalMs: loadScanIntervalForConfig(
        numberOrDefault(stored.scanIntervalMs, defaults.scanIntervalMs),
        storedVersion
      ),
      transitionPauseMs: storedVersion >= 2
        ? loadTransitionPauseForConfig(
          numberOrDefault(stored.transitionPauseMs, defaults.transitionPauseMs),
          storedVersion
        )
        : defaults.transitionPauseMs,
      firstCellPauseMs: loadFirstCellPauseForConfig(
        numberOrDefault(stored.firstCellPauseMs, defaults.firstCellPauseMs),
        storedVersion
      ),
      inputLatencyCompensationMs: numberOrDefault(
        stored.inputLatencyCompensationMs,
        defaults.inputLatencyCompensationMs
      ),
      suggestionDictionary: loadProfileSuggestionDictionaryForConfig(
        stored.suggestionDictionary ?? serializeDictionary(profileDefaults.suggestionDictionary),
        storedVersion,
        stored.profileId
      ),
      symbols: loadProfileSymbolsForConfig(
        stored.symbols ?? serializeSymbols(profileDefaults.symbols),
        storedVersion,
        stored.profileId
      )
    });
  } catch {
    return defaults;
  }
}

function loadNativeConfig(defaults) {
  if (!globalThis.ShineAacAndroid?.getInitialConfigJson) return null;
  try {
    const raw = globalThis.ShineAacAndroid.getInitialConfigJson();
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const storedVersion = Number(stored.configVersion) || 0;
    return createBoardConfig({
      profileId: stored.profileId,
      columns: numberOrDefault(stored.columns, defaults.columns),
      scanIntervalMs: loadScanIntervalForConfig(
        numberOrDefault(stored.scanIntervalMs, defaults.scanIntervalMs),
        storedVersion
      ),
      transitionPauseMs: loadTransitionPauseForConfig(
        numberOrDefault(stored.transitionPauseMs, defaults.transitionPauseMs),
        storedVersion
      ),
      firstCellPauseMs: loadFirstCellPauseForConfig(
        numberOrDefault(stored.firstCellPauseMs, defaults.firstCellPauseMs),
        storedVersion
      ),
      inputLatencyCompensationMs: numberOrDefault(
        stored.inputLatencyCompensationMs,
        defaults.inputLatencyCompensationMs
      )
    });
  } catch {
    return null;
  }
}

function saveConfig(config) {
  localStorage.setItem(storageKey, JSON.stringify({
    configVersion: webConfigVersion,
    profileId: config.profileId,
    columns: config.columns,
    scanIntervalMs: config.scanIntervalMs,
    transitionPauseMs: config.transitionPauseMs,
    firstCellPauseMs: config.firstCellPauseMs,
    inputLatencyCompensationMs: config.inputLatencyCompensationMs,
    suggestionDictionary: serializeDictionary(config.suggestionDictionary),
    symbols: serializeSymbols(config.symbols)
  }));
}

function resetClock() {
  highlightStartedAt = performance.now();
  lastScanAnnouncementKey = "";
}

function setSession(nextSession) {
  session = nextSession;
  reviewHoldActive = false;
  resetClock();
  render();
  scheduleScan();
  announceCurrentScanTarget();
}

function handleInputEvent(inputEvent = {}) {
  const intent = inputEvent.intent ?? InputIntent.Activate;
  if (intent !== InputIntent.Activate) return false;
  if (calibrationOpen) {
    recordCalibrationInput(inputEvent);
    return true;
  }
  if (isHardwareInput(inputEvent.source) && !uiConfig.hardwareButtons) return false;
  if (isCameraInput(inputEvent.source) && !uiConfig.cameraSwitch) return false;
  activateSwitch();
  return true;
}

function activateSwitch() {
  if (configOpen) return;
  cancelScheduledScan();
  if (reviewHoldActive) {
    reviewHoldActive = false;
    resetClock();
    render();
    scheduleScan();
    announceCurrentScanTarget();
    return;
  }
  const elapsed = performance.now() - highlightStartedAt;
  const nextSession = pressSwitch(session, elapsed);
  const selection = nextSession.lastSelection;
  session = uiConfig.restartScanFromTop && selection
    ? { ...nextSession, scannerState: { ...nextSession.scannerState, rowIndex: 0 } }
    : nextSession;
  reviewHoldActive = shouldHoldForSuggestionReview(selection);
  resetClock();
  render();
  scheduleScan();

  if (selection?.effect === "speak") {
    speak(session.message);
  } else if (selection) {
    speakActivation(selection.tile);
  } else {
    announceCurrentScanTarget();
  }
}

function advanceScan() {
  if (configOpen) return;
  const nextSession = pendingAdvanceSession ?? advanceSession(session);
  pendingAdvanceSession = null;
  setSession(nextSession);
}

function scheduleScan() {
  cancelScheduledScan();
  if (configOpen) return;
  if (reviewHoldActive) {
    setProgressFills(1, 0);
    return;
  }

  const duration = scanDurationForStage(session.scannerState, session.config);
  const token = scanScheduleToken;
  highlightStartedAt = performance.now();
  highlightDeadlineAt = highlightStartedAt + duration;

  animationFrameId = window.requestAnimationFrame(() => {
    if (token !== scanScheduleToken || configOpen || reviewHoldActive) return;
    resetProgressFills(currentProgressFills);
    animationFrameId = window.requestAnimationFrame(() => {
      if (token !== scanScheduleToken || configOpen || reviewHoldActive) return;
      startScanClock(duration, token);
    });
  });
}

function cancelScheduledScan() {
  window.clearTimeout(timerId);
  window.clearTimeout(prepareAdvanceTimerId);
  window.cancelAnimationFrame(animationFrameId);
  timerId = 0;
  prepareAdvanceTimerId = 0;
  animationFrameId = 0;
  pendingAdvanceSession = null;
  scanScheduleToken += 1;
}

function startScanClock(duration, token) {
  const durationMs = Math.max(1, duration);
  highlightStartedAt = performance.now();
  highlightDeadlineAt = highlightStartedAt + durationMs;
  timerId = window.setTimeout(advanceScan, durationMs);
  const progressFills = setProgressFills(0, 0);
  forceProgressLayout(progressFills);
  setProgressFills(1, durationMs);
  prepareAdvanceTimerId = window.setTimeout(() => {
    if (token !== scanScheduleToken || configOpen || reviewHoldActive) return;
    pendingAdvanceSession = advanceSession(session);
  }, 0);
}

function setProgressFills(progress, durationMs) {
  const progressFills = currentProgressFills.some((fill) => fill?.isConnected)
    ? currentProgressFills.filter((fill) => fill?.isConnected)
    : [...app.querySelectorAll(".tile.is-current .progress-fill")];
  for (const progressFill of progressFills) {
    progressFill.style.transitionDuration = `${durationMs}ms`;
    progressFill.style.transform = `scaleX(${progress})`;
  }
  return progressFills;
}

function forceProgressLayout(progressFills) {
  for (const progressFill of progressFills) {
    progressFill.getBoundingClientRect();
  }
}

function shouldHoldForSuggestionReview(selection) {
  return uiConfig.holdAfterSuggestionChange &&
    selection &&
    ["message", "undo", "suggestion-page", "category"].includes(selection.effect);
}

function speak(text) {
  speakText(text);
}

function speakText(text) {
  const spoken = text.trim();
  if (!spoken) return;
  if (globalThis.ShineAacAndroid?.speak) {
    if (globalThis.ShineAacAndroid.setSpeechLocale) {
      globalThis.ShineAacAndroid.setSpeechLocale(session.config.speechLocale);
    }
    globalThis.ShineAacAndroid.speak(spoken);
    return;
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = session.config.speechLocale;
  window.speechSynthesis.speak(utterance);
}

function speakFeedback(text) {
  const spoken = text.trim();
  if (!spoken) return;
  speakText(spoken);
}

function speakActivation(tile) {
  if (!uiConfig.activationVoice) return;
  speakFeedback(labelForSpeech(tile));
}

function announceCurrentScanTarget() {
  if (configOpen) return;
  const board = visibleBoard(session);
  const scanner = session.scannerState;
  const key = `${scanner.stage}:${scanner.rowIndex}:${scanner.cellIndex}`;
  if (key === lastScanAnnouncementKey) return;
  lastScanAnnouncementKey = key;

  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    if (!uiConfig.rowScanVoice) return;
    const labels = (board[scanner.rowIndex] ?? [])
      .filter((candidate) => candidate.action !== TileAction.Noop)
      .map(labelForSpeech)
      .filter(Boolean);
    speakFeedback(labels.join(", "));
    return;
  }

  if (!uiConfig.scanVoice) return;
  const tile = board[scanner.rowIndex]?.[scanner.cellIndex];
  if (tile) speakFeedback(labelForSpeech(tile));
}

function labelForSpeech(tile) {
  return speechLabelForTile(tile, session.config.profileId);
}

function render() {
  const board = visibleBoard(session);
  const boardKey = boardSignature(board);
  const canPatch =
    renderedTiles.length > 0 &&
    renderedTiles[0].element.isConnected &&
    boardKey === renderedBoardKey &&
    session.message === renderedMessage;

  if (canPatch) {
    updateScanPresentation(board);
    emitRenderState(board);
    return;
  }

  renderFull(board, boardKey);
}

function renderFull(board, boardKey) {
  const scanner = session.scannerState;
  invalidateRenderedBoard();
  app.innerHTML = "";

  const shell = document.createElement("section");
  shell.className = "shell";
  shell.addEventListener("click", () => {
    handleInputEvent({ intent: InputIntent.Activate, source: "touch" });
  });

  const topPanel = document.createElement("header");
  topPanel.className = "top-panel";

  const message = document.createElement("div");
  message.className = "message";
  message.setAttribute("data-testid", "message");
  message.setAttribute("data-raw-message", session.message);
  appendVisibleMessage(message, session.message);
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  cursor.textContent = "|";
  message.append(cursor);

  const status = document.createElement("div");
  status.className = "status-row";

  const phase = document.createElement("div");
  phase.className = "phase";
  phase.textContent = reviewHoldActive ? "Review" : phaseLabel(scanner.stage);
  renderedPhaseElement = phase;

  const voice = document.createElement("div");
  voice.className = "voice";
  voice.textContent = uiConfig.rowScanVoice || uiConfig.scanVoice || uiConfig.activationVoice ? "Audio" : "Silent";
  renderedVoiceElement = voice;

  const configButton = document.createElement("button");
  configButton.className = "config-button";
  configButton.type = "button";
  configButton.textContent = "Config";
  configButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressNextConfigClick) {
      suppressNextConfigClick = false;
      return;
    }
    openConfig();
  });
  attachDemoLongPress(configButton);

  status.append(phase, voice, configButton);
  topPanel.append(message, status);

  const boardElement = document.createElement("section");
  boardElement.className = "board";
  if (board.length >= 18) boardElement.classList.add("dense-board");
  boardElement.setAttribute("data-testid", "board");
  boardElement.style.setProperty("--row-count", String(board.length));

  board.forEach((row, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = "row";
    rowElement.style.gridTemplateColumns = `repeat(${session.config.columns}, minmax(0, 1fr))`;
    const renderedRow = [];

    row.forEach((candidate, cellIndex) => {
      const tile = document.createElement("div");
      tile.className = tileClass(candidate, false, false, false);
      tile.setAttribute("data-label", candidate.label);
      tile.setAttribute("data-action", candidate.action);
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", candidate.label || "empty");

      const progressFill = document.createElement("div");
      progressFill.className = "progress-fill";

      const label = document.createElement("span");
      label.className = "tile-label";
      label.textContent = candidate.label;

      tile.append(progressFill, label);
      rowElement.append(tile);
      const renderedTile = { element: tile, progressFill, candidate, rowIndex, cellIndex };
      renderedTiles.push(renderedTile);
      renderedRow.push(renderedTile);
    });

    renderedTileGrid.push(renderedRow);
    boardElement.append(rowElement);
  });

  shell.append(topPanel, boardElement);
  app.append(shell);
  renderedBoardKey = boardKey;
  renderedMessage = session.message;
  updateScanPresentation(board);
  scrollMessageToEnd(message);
  emitRenderState(board);
}

function updateScanPresentation(board) {
  const scanner = session.scannerState;
  const nextProgressTargetKey = progressTargetKeyForScanner(scanner, reviewHoldActive);
  if (renderedPhaseElement) {
    renderedPhaseElement.textContent = reviewHoldActive ? "Review" : phaseLabel(scanner.stage);
  }
  if (renderedVoiceElement) {
    renderedVoiceElement.textContent = uiConfig.rowScanVoice || uiConfig.scanVoice || uiConfig.activationVoice ? "Audio" : "Silent";
  }

  const previousActiveTiles = currentActiveTiles;
  const previousProgressFills = currentProgressFills;
  const nextActiveTiles = activeRenderedTilesForScanner(scanner);
  const nextProgressFills = nextActiveTiles.map((rendered) => rendered.progressFill);
  const tilesToUpdate = [...new Set([...previousActiveTiles, ...nextActiveTiles])];

  for (const rendered of tilesToUpdate) {
    const candidate = rendered.candidate;
    const activeRow =
      (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) &&
      scanner.rowIndex === rendered.rowIndex;
    const activeCell =
      (scanner.stage === ScanStage.FirstCell || scanner.stage === ScanStage.Cells) &&
      scanner.rowIndex === rendered.rowIndex &&
      scanner.cellIndex === rendered.cellIndex;
    const reviewHold = reviewHoldActive && (activeRow || activeCell);
    const nextClassName = tileClass(candidate, activeRow, activeCell, reviewHold);
    if (rendered.element.className !== nextClassName) {
      rendered.element.className = nextClassName;
    }
  }

  if (nextProgressTargetKey !== progressTargetKey) {
    resetProgressFills([...previousProgressFills, ...nextProgressFills]);
  } else {
    for (const previousProgressFill of previousProgressFills) {
      if (!nextProgressFills.includes(previousProgressFill)) {
        resetProgressFills([previousProgressFill]);
      }
    }
  }
  currentActiveTiles = nextActiveTiles;
  currentProgressFills = nextProgressFills;
  progressTargetKey = nextProgressTargetKey;
}

function activeRenderedTilesForScanner(scanner) {
  const row = renderedTileGrid[scanner.rowIndex] ?? [];
  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    return row;
  }
  const renderedTile = row[scanner.cellIndex];
  return renderedTile ? [renderedTile] : [];
}

function progressTargetKeyForScanner(scanner, isReviewHold) {
  const prefix = isReviewHold ? "review" : "scan";
  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    return `${prefix}:${scanner.stage}:${scanner.rowIndex}`;
  }
  return `${prefix}:${scanner.stage}:${scanner.rowIndex}:${scanner.cellIndex}`;
}

function resetProgressFills(progressFills) {
  const uniqueProgressFills = [...new Set(progressFills)].filter((fill) => fill?.isConnected);
  for (const progressFill of uniqueProgressFills) {
    progressFill.style.transitionDuration = "0ms";
    progressFill.style.transform = "scaleX(0)";
  }
  forceProgressLayout(uniqueProgressFills);
}

function invalidateRenderedBoard() {
  renderedBoardKey = "";
  renderedMessage = "";
  renderedTiles = [];
  renderedTileGrid = [];
  renderedPhaseElement = null;
  renderedVoiceElement = null;
  currentActiveTiles = [];
  currentProgressFills = [];
  progressTargetKey = "";
}

function boardSignature(board) {
  return [
    session.config.columns,
    ...board.map((row) => row
      .map((candidate) => [
        candidate.label,
        candidate.output,
        candidate.action,
        candidate.replaceLength ?? ""
      ].join("\u001f"))
      .join("\u001e"))
  ].join("\u001d");
}

function scrollMessageToEnd(messageElement) {
  messageElement.scrollLeft = messageElement.scrollWidth;
}

function emitRenderState(board) {
  if (!globalThis.ShineAacAndroid?.onRender || !globalThis.ShineAacAndroid?.isE2E?.()) return;
  try {
    globalThis.ShineAacAndroid.onRender(JSON.stringify({
      message: session.message,
      stage: session.scannerState.stage,
      rowIndex: session.scannerState.rowIndex,
      cellIndex: session.scannerState.cellIndex,
      rows: board.map((row) => row.map((candidate) => candidate.label))
    }));
  } catch {
    // Test-only bridge; rendering should never depend on it.
  }
}

function tileClass(candidate, activeRow, activeCell, reviewHold = false) {
  const classes = ["tile"];
  classes.push(`action-${candidate.action}`);
  if (candidate.action !== TileAction.Append) classes.push("command");
  if (candidate.action === TileAction.Noop) classes.push("noop");
  if (candidate.action === TileAction.CommitCandidate && candidate.replaceLength > 0) classes.push("replacement");
  if (activeRow) classes.push("active-row", "is-current");
  if (activeCell) classes.push("active-cell", "is-current");
  if (reviewHold) classes.push("review-hold");
  if (candidate.label.length >= 6) classes.push("tiny");
  else if (candidate.label.length >= 4) classes.push("small");
  return classes.join(" ");
}

function appendVisibleMessage(container, value) {
  if (value.length === 0) return;
  for (const char of value) {
    if (char === " ") {
      const marker = document.createElement("span");
      marker.className = "space-marker";
      marker.textContent = "·";
      container.append(marker);
    } else {
      container.append(document.createTextNode(char));
    }
  }
}

function phaseLabel(stage) {
  switch (stage) {
    case ScanStage.Rows:
      return "Rows";
    case ScanStage.RowSelected:
      return "Cancel";
    case ScanStage.FirstCell:
      return "First";
    case ScanStage.Cells:
      return "Symbols";
    default:
      return "";
  }
}

function openConfig() {
  configOpen = true;
  calibrationOpen = false;
  stopCalibrationTimer();
  reviewHoldActive = false;
  cancelScheduledScan();
  renderConfig();
}

function closeConfig() {
  configOpen = false;
  calibrationOpen = false;
  stopCalibrationTimer();
  reviewHoldActive = false;
  render();
  resetClock();
  scheduleScan();
}

function openCalibration() {
  configOpen = true;
  calibrationOpen = true;
  reviewHoldActive = false;
  cancelScheduledScan();
  calibrationState = createCalibrationState(calibrationState.inputClass);
  renderCalibration();
}

function closeCalibration() {
  calibrationOpen = false;
  stopCalibrationTimer();
  renderConfig();
}

function renderConfig() {
  invalidateRenderedBoard();
  app.innerHTML = "";

  const backdrop = document.createElement("div");
  backdrop.className = "config-backdrop";
  backdrop.addEventListener("click", closeConfig);

  const panel = document.createElement("section");
  panel.className = "config-panel";
  panel.addEventListener("click", (event) => event.stopPropagation());

  const title = document.createElement("h1");
  title.textContent = "Configuration";

  const form = document.createElement("form");
  form.innerHTML = `
    <div class="config-grid">
      <label class="field wide">Language
        <select name="profileId">
          ${profileOptionsHtml(session.config.profileId)}
        </select>
      </label>
      <label class="field">Columns
        <input name="columns" type="number" min="2" max="8" step="1" value="${session.config.columns}">
      </label>
      <label class="field">Scan preset
        <select name="scanTimingPreset">
          ${scanTimingPresetOptionsHtml(session.config)}
        </select>
      </label>
      <label class="field">Switch speed ms
        <input name="scanIntervalMs" type="number" min="300" max="5000" step="50" value="${session.config.scanIntervalMs}">
      </label>
      <label class="field">Row cancel pause ms
        <input name="transitionPauseMs" type="number" min="0" max="4000" step="50" value="${session.config.transitionPauseMs}">
      </label>
      <label class="field">First symbol hold ms
        <input name="firstCellPauseMs" type="number" min="300" max="6000" step="50" value="${session.config.firstCellPauseMs}">
      </label>
      <label class="field">Latency compensation ms
        <input name="inputLatencyCompensationMs" type="number" min="0" max="1200" step="25" value="${session.config.inputLatencyCompensationMs}">
      </label>
      <label class="field check-field">
        <input name="rowScanVoice" type="checkbox" ${uiConfig.rowScanVoice ? "checked" : ""}>
        Voice while row scanning
      </label>
      <label class="field check-field">
        <input name="scanVoice" type="checkbox" ${uiConfig.scanVoice ? "checked" : ""}>
        Voice while symbol scanning
      </label>
      <label class="field check-field">
        <input name="activationVoice" type="checkbox" ${uiConfig.activationVoice ? "checked" : ""}>
        Voice on activation
      </label>
      <label class="field check-field">
        <input name="restartScanFromTop" type="checkbox" ${uiConfig.restartScanFromTop ? "checked" : ""}>
        Restart scan at top after input
      </label>
      <label class="field check-field">
        <input name="hardwareButtons" type="checkbox" ${uiConfig.hardwareButtons ? "checked" : ""}>
        Phone/external buttons activate switch
      </label>
      <label class="field check-field">
        <input name="cameraSwitch" type="checkbox" ${uiConfig.cameraSwitch ? "checked" : ""}>
        Camera long blink activates switch
      </label>
      <label class="field check-field">
        <input name="holdAfterSuggestionChange" type="checkbox" ${uiConfig.holdAfterSuggestionChange ? "checked" : ""}>
        Hold after suggestion changes
      </label>
      ${suggestionDictionaryFieldHtml(session.config)}
      <label class="field wide">Board symbols
        <textarea name="symbols">${escapeHtml(serializeSymbols(session.config.symbols))}</textarea>
      </label>
    </div>
    <div class="config-actions">
      <button class="secondary-button" type="button" data-action="reset">Reset</button>
      <button class="secondary-button" type="button" data-action="calibrate">Input test</button>
      <button class="secondary-button" type="button" data-action="cancel">Cancel</button>
      <button class="primary-button" type="submit">Save</button>
    </div>
  `;

  const profileSelect = form.elements.profileId;
  profileSelect.addEventListener("change", () => {
    const profile = LanguageProfiles[profileSelect.value] ?? LanguageProfiles["en-US"];
    form.elements.columns.value = String(profile.columns);
    form.elements.scanIntervalMs.value = String(profile.scanIntervalMs);
    form.elements.transitionPauseMs.value = String(profile.transitionPauseMs);
    form.elements.firstCellPauseMs.value = String(profile.firstCellPauseMs);
    form.elements.inputLatencyCompensationMs.value = String(profile.inputLatencyCompensationMs);
    form.elements.scanTimingPreset.value = "default";
    form.querySelector("[data-suggestion-dictionary-field]").hidden = profile.id === "zh-TW";
    form.elements.suggestionDictionary.value = serializeDictionary(profile.suggestionDictionary);
    form.elements.symbols.value = serializeSymbols(profile.symbols);
  });

  form.elements.scanTimingPreset.addEventListener("change", () => {
    const presetId = form.elements.scanTimingPreset.value;
    if (presetId === "custom") return;
    const presetConfig = applyScanTimingPreset(session.config, presetId);
    form.elements.scanIntervalMs.value = String(presetConfig.scanIntervalMs);
    form.elements.transitionPauseMs.value = String(presetConfig.transitionPauseMs);
    form.elements.firstCellPauseMs.value = String(presetConfig.firstCellPauseMs);
    form.elements.inputLatencyCompensationMs.value = String(presetConfig.inputLatencyCompensationMs);
  });

  const timingFields = [
    form.elements.scanIntervalMs,
    form.elements.transitionPauseMs,
    form.elements.firstCellPauseMs,
    form.elements.inputLatencyCompensationMs
  ];
  const syncTimingPresetSelection = () => {
    const currentTiming = createBoardConfig({
      ...session.config,
      scanIntervalMs: clamp(Number(form.elements.scanIntervalMs.value), 300, 5000),
      transitionPauseMs: clamp(Number(form.elements.transitionPauseMs.value), 0, 4000),
      firstCellPauseMs: clamp(Number(form.elements.firstCellPauseMs.value), 300, 6000),
      inputLatencyCompensationMs: clamp(Number(form.elements.inputLatencyCompensationMs.value), 0, 1200)
    });
    const presetId = scanTimingPresetIdForConfig(currentTiming);
    if (presetId !== "custom") {
      form.elements.scanTimingPreset.value = presetId;
      return;
    }
    if (!Array.from(form.elements.scanTimingPreset.options).some((option) => option.value === "custom")) {
      form.elements.scanTimingPreset.add(new Option("Custom", "custom"));
    }
    form.elements.scanTimingPreset.value = "custom";
  };
  timingFields.forEach((field) => field.addEventListener("input", syncTimingPresetSelection));

  form.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "cancel") closeConfig();
    if (action === "calibrate") openCalibration();
    if (action === "reset") {
      const profileId = String(form.elements.profileId.value || session.config.profileId || "en-US");
      const config = createBoardConfig({ profileId });
      saveConfig(config);
      uiConfig = defaultUiConfig;
      saveUiConfig(uiStorageKey, uiConfig);
      session = createSession({ config });
      closeConfig();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const profileId = String(data.get("profileId") ?? "en-US");
    const profile = LanguageProfiles[profileId] ?? LanguageProfiles["en-US"];
    const config = createBoardConfig({
      profileId,
      columns: clamp(Number(data.get("columns")), 2, 8),
      scanIntervalMs: clamp(Number(data.get("scanIntervalMs")), 300, 5000),
      transitionPauseMs: clamp(Number(data.get("transitionPauseMs")), 0, 4000),
      firstCellPauseMs: clamp(Number(data.get("firstCellPauseMs")), 300, 6000),
      inputLatencyCompensationMs: clamp(Number(data.get("inputLatencyCompensationMs")), 0, 1200),
      suggestionDictionary: profile.id === "zh-TW"
        ? profile.suggestionDictionary
        : parseDictionary(String(data.get("suggestionDictionary") ?? "")),
      symbols: parseSymbols(String(data.get("symbols") ?? ""))
    });
    saveConfig(config);
    uiConfig = {
      rowScanVoice: data.get("rowScanVoice") === "on",
      scanVoice: data.get("scanVoice") === "on",
      activationVoice: data.get("activationVoice") === "on",
      restartScanFromTop: data.get("restartScanFromTop") === "on",
      hardwareButtons: data.get("hardwareButtons") === "on",
      cameraSwitch: data.get("cameraSwitch") === "on",
      holdAfterSuggestionChange: data.get("holdAfterSuggestionChange") === "on"
    };
    saveUiConfig(uiStorageKey, uiConfig);
    session = createSession({ config });
    closeConfig();
  });

  panel.append(title, form);
  backdrop.append(panel);
  app.append(backdrop);
}

function createCalibrationState(inputClass = "reliable") {
  return {
    inputClass,
    events: [],
    lastEventAt: 0,
    rest: {
      running: false,
      startedAt: 0,
      durationMs: 10000,
      events: []
    },
    trials: {
      running: false,
      total: 5,
      index: 0,
      awaitingNext: false,
      results: []
    }
  };
}

function recordCalibrationInput(inputEvent) {
  const now = performance.now();
  const source = String(inputEvent.source ?? "unknown");
  const previous = calibrationState.lastEventAt;
  const event = {
    at: now,
    source,
    key: inputEvent.key,
    keyCode: inputEvent.keyCode,
    confidence: Number.isFinite(Number(inputEvent.confidence)) ? Number(inputEvent.confidence) : null,
    deltaMs: previous > 0 ? now - previous : null,
    disabledBySettings: (isHardwareInput(source) && !uiConfig.hardwareButtons) ||
      (isCameraInput(source) && !uiConfig.cameraSwitch)
  };

  calibrationState.lastEventAt = now;
  calibrationState.events = [...calibrationState.events, event].slice(-80);

  if (calibrationState.inputClass === "unreliable" && calibrationState.rest.running) {
    calibrationState.rest.events = [...calibrationState.rest.events, event].slice(-80);
  }

  if (
    calibrationState.inputClass === "unreliable" &&
    calibrationState.trials.running &&
    calibrationState.trials.index < calibrationState.trials.total
  ) {
    const trialIndex = calibrationState.trials.index;
    const results = calibrationState.trials.results.slice();
    const current = results[trialIndex] ? results[trialIndex].slice() : [];
    current.push(event);
    results[trialIndex] = current;
    calibrationState.trials = {
      ...calibrationState.trials,
      awaitingNext: true,
      results
    };
  }

  renderCalibration();
}

function renderCalibration() {
  invalidateRenderedBoard();
  app.innerHTML = "";

  const backdrop = document.createElement("div");
  backdrop.className = "config-backdrop";

  const panel = document.createElement("section");
  panel.className = "config-panel calibration-panel";

  const title = document.createElement("h1");
  title.textContent = "Input Test";

  const body = document.createElement("div");
  body.className = "calibration-body";
  body.innerHTML = `
    <section class="calibration-intro">
      <strong>Communication is paused.</strong>
      <span>Use the same input the person will use, then check whether each intentional action becomes one activation.</span>
    </section>
    <div class="calibration-mode" role="group" aria-label="Input source type">
      <button class="mode-button ${calibrationState.inputClass === "reliable" ? "selected" : ""}" type="button" data-calibration-class="reliable">
        Button or switch
      </button>
      <button class="mode-button ${calibrationState.inputClass === "unreliable" ? "selected" : ""}" type="button" data-calibration-class="unreliable">
        Sensor
      </button>
    </div>
    ${calibrationState.inputClass === "reliable" ? reliableCalibrationHtml() : unreliableCalibrationHtml()}
    <details class="calibration-details">
      <summary>Event details</summary>
      ${calibrationStatsHtml()}
      ${calibrationEventLogHtml()}
    </details>
  `;

  body.addEventListener("click", handleCalibrationClick);

  const actions = document.createElement("div");
  actions.className = "config-actions";
  actions.innerHTML = `
    <button class="secondary-button" type="button" data-calibration-action="clear">Clear test</button>
    <button class="primary-button" type="button" data-calibration-action="back">Back to config</button>
  `;
  actions.addEventListener("click", handleCalibrationClick);

  panel.append(title, body, actions);
  backdrop.append(panel);
  app.append(backdrop);
}

function reliableCalibrationHtml() {
  const total = calibrationState.events.length;
  const duplicates = duplicateCalibrationEvents(calibrationState.events).length;
  const disabled = calibrationState.events.some((event) => event.disabledBySettings);
  const cleanCount = Math.max(0, Math.min(5, total - duplicates));
  const ready = total >= 5 && duplicates === 0 && !disabled;
  const status = ready
    ? "Good"
    : disabled
      ? "Disabled"
      : duplicates > 0
        ? "Needs adjustment"
        : "Waiting";
  const last = calibrationState.events.at(-1);
  const lastDetected = last && performance.now() - last.at < 1200;
  const guidance = ready
    ? "This source is behaving like a reliable switch."
    : disabled
      ? "Turn on phone/external buttons in Configuration or use a different source."
      : duplicates > 0
        ? "The app saw repeated activations too close together. Increase debounce in the adapter or try sensor testing."
        : "Press the input five times at a comfortable pace.";
  return `
    <section class="calibration-section" data-testid="calibration-reliable">
      <div class="calibration-steps">
        <div class="calibration-step current">
          <span>1</span>
          <strong>Press input</strong>
          <small>Use touch, a key, volume button, or external switch.</small>
        </div>
        <div class="calibration-step">
          <span>2</span>
          <strong>Repeat five times</strong>
          <small>Each press should count once.</small>
        </div>
      </div>
      <div class="calibration-live ${lastDetected ? "detected" : ""}">
        <strong>${lastDetected ? "Detected" : "Waiting for input"}</strong>
        <span>${escapeHtml(last?.source ?? "No source yet")}</span>
      </div>
      <div class="calibration-status ${ready ? "good" : duplicates > 0 || disabled ? "warn" : ""}">
        <strong>${status}</strong>
        <span>${cleanCount} / 5 clean presses</span>
      </div>
      <div class="calibration-meter" aria-label="Reliable input progress">
        <div style="width: ${Math.min(100, (cleanCount / 5) * 100)}%"></div>
      </div>
      <p class="calibration-guidance">${guidance}</p>
    </section>
  `;
}

function unreliableCalibrationHtml() {
  const restRemainingMs = restRemaining();
  const restEvents = calibrationState.rest.events.length;
  const trials = calibrationState.trials;
  const capturedTrials = trials.results.filter((events) => events?.length > 0).length;
  const extraFires = trials.results.reduce((count, events) => count + Math.max(0, (events?.length ?? 0) - 1), 0);
  const restStatus = restEvents > 0
    ? `${restEvents} at rest`
    : calibrationState.rest.running
      ? `${Math.ceil(restRemainingMs / 1000)}s`
      : "Quiet";
  const trialStatus = trials.index >= trials.total
    ? "Done"
    : !trials.running
      ? "Not started"
      : trials.awaitingNext
      ? "Captured"
      : `Trial ${trials.index + 1}`;
  const last = calibrationState.events.at(-1);
  const lastDetected = last && performance.now() - last.at < 1200;
  return `
    <section class="calibration-section" data-testid="calibration-unreliable">
      <div class="calibration-steps">
        <div class="calibration-step ${calibrationState.rest.running ? "current" : ""}">
          <span>1</span>
          <strong>Rest watch</strong>
          <small>Relax without making the action. Any activation here is noise.</small>
        </div>
        <div class="calibration-step ${trials.running ? "current" : ""}">
          <span>2</span>
          <strong>Action trials</strong>
          <small>Make one deliberate action for each trial.</small>
        </div>
      </div>
      <div class="calibration-live ${lastDetected ? "detected" : ""}">
        <strong>${lastDetected ? "Detected" : "Waiting for sensor"}</strong>
        <span>${escapeHtml(last?.source ?? "No source yet")}</span>
      </div>
      <div class="calibration-cards">
        <div class="calibration-card ${restEvents === 0 ? "good" : "warn"}">
          <span>Rest watch</span>
          <strong>${restStatus}</strong>
        </div>
        <div class="calibration-card ${extraFires === 0 ? "good" : "warn"}">
          <span>Trials</span>
          <strong>${capturedTrials} / ${trials.total}</strong>
        </div>
        <div class="calibration-card ${extraFires === 0 ? "" : "warn"}">
          <span>Extra fires</span>
          <strong>${extraFires}</strong>
        </div>
      </div>
      <div class="calibration-actions-inline">
        <button class="secondary-button" type="button" data-calibration-action="start-rest">
          ${calibrationState.rest.running ? "Restart rest" : "Start rest"}
        </button>
        <button class="secondary-button" type="button" data-calibration-action="start-trials">Start trials</button>
        <button class="secondary-button" type="button" data-calibration-action="missed" ${!trials.running || trials.index >= trials.total ? "disabled" : ""}>Missed</button>
        <button class="secondary-button" type="button" data-calibration-action="next-trial" ${!trials.awaitingNext ? "disabled" : ""}>Next trial</button>
      </div>
      <div class="calibration-status ${restEvents === 0 && extraFires === 0 && capturedTrials >= trials.total ? "good" : restEvents > 0 || extraFires > 0 ? "warn" : ""}">
        <strong>${trialStatus}</strong>
        <span>${unreliableRecommendation(restEvents, capturedTrials, extraFires)}</span>
      </div>
      <p class="calibration-guidance">${unreliableGuidance(restEvents, capturedTrials, extraFires)}</p>
    </section>
  `;
}

function calibrationStatsHtml() {
  const events = calibrationState.events;
  const last = events.at(-1);
  const duplicates = duplicateCalibrationEvents(events).length;
  const sourceCounts = events.reduce((counts, event) => {
    counts.set(event.source, (counts.get(event.source) ?? 0) + 1);
    return counts;
  }, new Map());
  const topSource = [...sourceCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "none";
  const interval = medianInterval(events);
  return `
    <section class="calibration-grid" data-testid="calibration-stats">
      <div class="calibration-card">
        <span>Last source</span>
        <strong>${escapeHtml(last?.source ?? "none")}</strong>
      </div>
      <div class="calibration-card">
        <span>Main source</span>
        <strong>${escapeHtml(topSource)}</strong>
      </div>
      <div class="calibration-card">
        <span>Total</span>
        <strong>${events.length}</strong>
      </div>
      <div class="calibration-card ${duplicates > 0 ? "warn" : ""}">
        <span>Under 300ms</span>
        <strong>${duplicates}</strong>
      </div>
      <div class="calibration-card">
        <span>Median interval</span>
        <strong>${interval === null ? "-" : `${Math.round(interval)}ms`}</strong>
      </div>
      <div class="calibration-card ${last?.disabledBySettings ? "warn" : ""}">
        <span>Hardware setting</span>
        <strong>${uiConfig.hardwareButtons ? "On" : "Off"}</strong>
      </div>
      <div class="calibration-card ${last?.disabledBySettings ? "warn" : ""}">
        <span>Camera setting</span>
        <strong>${uiConfig.cameraSwitch ? "On" : "Off"}</strong>
      </div>
    </section>
  `;
}

function calibrationEventLogHtml() {
  const rows = calibrationState.events
    .slice(-8)
    .reverse()
    .map((event) => `
      <tr>
        <td>${escapeHtml(event.source)}</td>
        <td>${event.deltaMs === null ? "-" : Math.round(event.deltaMs)}</td>
        <td>${event.confidence === null ? "-" : Math.round(event.confidence * 100) / 100}</td>
      </tr>
    `)
    .join("");
  return `
    <section class="calibration-log">
      <table>
        <thead>
          <tr><th>Source</th><th>Delta ms</th><th>Confidence</th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan=\"3\">No activations yet</td></tr>"}</tbody>
      </table>
    </section>
  `;
}

function handleCalibrationClick(event) {
  const inputClass = event.target?.dataset?.calibrationClass;
  if (inputClass) {
    calibrationState = createCalibrationState(inputClass);
    startCalibrationTimer();
    renderCalibration();
    return;
  }

  const action = event.target?.dataset?.calibrationAction;
  if (!action) return;
  if (action === "back") {
    closeCalibration();
    return;
  }
  if (action === "clear") {
    calibrationState = createCalibrationState(calibrationState.inputClass);
    startCalibrationTimer();
    renderCalibration();
    return;
  }
  if (action === "start-rest") {
    calibrationState = {
      ...calibrationState,
      rest: { ...calibrationState.rest, running: true, startedAt: performance.now(), events: [] }
    };
    startCalibrationTimer();
    renderCalibration();
    return;
  }
  if (action === "start-trials") {
    calibrationState = {
      ...calibrationState,
      rest: { ...calibrationState.rest, running: false },
      trials: { running: true, total: 5, index: 0, awaitingNext: false, results: [] }
    };
    renderCalibration();
    return;
  }
  if (action === "missed") {
    const trials = calibrationState.trials;
    if (trials.index >= trials.total) return;
    const results = trials.results.slice();
    results[trials.index] = results[trials.index] ?? [];
    calibrationState = {
      ...calibrationState,
      trials: { ...trials, index: trials.index + 1, awaitingNext: false, results }
    };
    renderCalibration();
    return;
  }
  if (action === "next-trial") {
    const trials = calibrationState.trials;
    calibrationState = {
      ...calibrationState,
      trials: { ...trials, index: Math.min(trials.total, trials.index + 1), awaitingNext: false }
    };
    renderCalibration();
  }
}

function duplicateCalibrationEvents(events) {
  return events.filter((event) => event.deltaMs !== null && event.deltaMs < 300);
}

function medianInterval(events) {
  const intervals = events
    .map((event) => event.deltaMs)
    .filter((value) => value !== null && value >= 300)
    .sort((left, right) => left - right);
  if (intervals.length === 0) return null;
  return intervals[Math.floor(intervals.length / 2)];
}

function restRemaining() {
  if (!calibrationState.rest.running) return 0;
  return Math.max(0, calibrationState.rest.durationMs - (performance.now() - calibrationState.rest.startedAt));
}

function startCalibrationTimer() {
  stopCalibrationTimer();
  calibrationTimerId = window.setInterval(() => {
    if (!calibrationOpen) return;
    if (calibrationState.rest.running && restRemaining() <= 0) {
      calibrationState = {
        ...calibrationState,
        rest: { ...calibrationState.rest, running: false }
      };
    }
    renderCalibration();
  }, 500);
}

function stopCalibrationTimer() {
  window.clearInterval(calibrationTimerId);
  calibrationTimerId = 0;
}

function unreliableRecommendation(restEvents, capturedTrials, extraFires) {
  if (restEvents > 0) return "False activations while resting";
  if (extraFires > 0) return "Multiple events from one action";
  if (capturedTrials >= calibrationState.trials.total) return "Usable as a switch source";
  return "Waiting for trial activations";
}

function unreliableGuidance(restEvents, capturedTrials, extraFires) {
  if (restEvents > 0) return "Raise the trigger threshold, change the gesture, or improve mounting before using this source for communication.";
  if (extraFires > 0) return "Add a lockout/debounce period so one intentional action cannot select twice.";
  if (capturedTrials >= calibrationState.trials.total) return "This sensor can be tried as a switch source. Re-test when posture, lighting, electrode placement, or fatigue changes.";
  return "Run rest watch first, then start trials. Use Missed when the person tried but no activation arrived.";
}

function suggestionDictionaryFieldHtml(config) {
  return `
      <label class="field wide" data-suggestion-dictionary-field${config.profileId === "zh-TW" ? " hidden" : ""}>Suggestion dictionary
        <textarea name="suggestionDictionary">${escapeHtml(serializeDictionary(config.suggestionDictionary))}</textarea>
      </label>
  `;
}

function profileOptionsHtml(selectedProfileId) {
  return Object.values(LanguageProfiles)
    .map((profile) => {
      const selected = profile.id === selectedProfileId ? " selected" : "";
      return `<option value="${escapeHtml(profile.id)}"${selected}>${escapeHtml(profile.displayName)}</option>`;
    })
    .join("");
}

function scanTimingPresetOptionsHtml(config) {
  const selectedPresetId = scanTimingPresetIdForConfig(config);
  const presetOptions = Object.values(ScanTimingPresets)
    .map((preset) => {
      const selected = preset.id === selectedPresetId ? " selected" : "";
      return `<option value="${escapeHtml(preset.id)}"${selected}>${escapeHtml(preset.label)}</option>`;
    });
  if (selectedPresetId === "custom") {
    presetOptions.push("<option value=\"custom\" selected>Custom</option>");
  }
  return presetOptions.join("");
}

function attachDemoLongPress(element) {
  let pressTimer = 0;
  const cancelPress = () => {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
  };

  const startPress = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (pressTimer) return;
    cancelPress();
    pressTimer = window.setTimeout(() => {
      pressTimer = 0;
      suppressNextConfigClick = true;
      demoMode.start();
    }, 1800);
  };

  element.addEventListener("pointerdown", startPress);
  element.addEventListener("pointerup", cancelPress);
  element.addEventListener("pointerleave", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    cancelPress();
  });
  element.addEventListener("touchstart", startPress, { passive: true });
  element.addEventListener("touchend", cancelPress);
  element.addEventListener("mousedown", startPress);
  element.addEventListener("mouseup", cancelPress);
  element.addEventListener("mouseleave", cancelPress);
  element.addEventListener("contextmenu", (event) => event.preventDefault());
}

document.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  const tagName = document.activeElement?.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "BUTTON") return;
  event.preventDefault();
  handleInputEvent({ intent: InputIntent.Activate, source: "keyboard", key: event.key });
});

render();
scheduleScan();
syncNativeUiConfig(uiConfig);
announceCurrentScanTarget();
demoMode.startFromEnvironment();
