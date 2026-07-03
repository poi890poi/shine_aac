import {
  DefaultSuggestionDictionary,
  DefaultTiles,
  ScanStage,
  TileAction,
  advanceSession,
  createBoardConfig,
  createSession,
  loadSuggestionDictionaryForConfig,
  loadSymbolsForConfig,
  parseDictionary,
  parseSymbols,
  pressSwitch,
  scanDurationForStage,
  serializeDictionary,
  serializeSymbols,
  visibleBoard
} from "../../../packages/aac-core/src/index.js";

const storageKey = "shine-aac-web-config-v1";
const webConfigVersion = 3;
const app = document.querySelector("#app");
const uiStorageKey = "shine-aac-web-ui-v1";
const defaultUiConfig = Object.freeze({
  scanVoice: true,
  activationVoice: true,
  restartScanFromTop: true
});

let session = createSession({ config: loadConfig() });
let uiConfig = loadUiConfig();
let highlightStartedAt = performance.now();
let timerId = 0;
let animationFrameId = 0;
let configOpen = false;
let lastScanAnnouncementKey = "";

function loadConfig() {
  const defaults = createBoardConfig();
  const nativeConfig = loadNativeConfig(defaults);
  if (nativeConfig) return nativeConfig;

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!stored) return defaults;
    const storedVersion = Number(stored.configVersion) || 0;
    return createBoardConfig({
      columns: numberOrDefault(stored.columns, defaults.columns),
      scanIntervalMs: numberOrDefault(stored.scanIntervalMs, defaults.scanIntervalMs),
      transitionPauseMs: storedVersion >= 2
        ? numberOrDefault(stored.transitionPauseMs, defaults.transitionPauseMs)
        : defaults.transitionPauseMs,
      firstCellPauseMs: numberOrDefault(stored.firstCellPauseMs, defaults.firstCellPauseMs),
      inputLatencyCompensationMs: numberOrDefault(
        stored.inputLatencyCompensationMs,
        defaults.inputLatencyCompensationMs
      ),
      suggestionDictionary: loadSuggestionDictionaryForConfig(
        stored.suggestionDictionary ?? serializeDictionary(DefaultSuggestionDictionary),
        storedVersion
      ),
      symbols: loadSymbolsForConfig(stored.symbols ?? serializeSymbols(DefaultTiles), storedVersion)
    });
  } catch {
    return defaults;
  }
}

function loadUiConfig() {
  const nativeConfig = loadNativeUiConfig();
  if (nativeConfig) return nativeConfig;

  try {
    return { ...defaultUiConfig, ...JSON.parse(localStorage.getItem(uiStorageKey) ?? "null") };
  } catch {
    return defaultUiConfig;
  }
}

function loadNativeUiConfig() {
  if (!globalThis.ShineAacAndroid?.getInitialUiConfigJson) return null;
  try {
    const raw = globalThis.ShineAacAndroid.getInitialUiConfigJson();
    if (!raw) return null;
    return { ...defaultUiConfig, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

function saveUiConfig(config) {
  localStorage.setItem(uiStorageKey, JSON.stringify(config));
}

function loadNativeConfig(defaults) {
  if (!globalThis.ShineAacAndroid?.getInitialConfigJson) return null;
  try {
    const raw = globalThis.ShineAacAndroid.getInitialConfigJson();
    if (!raw) return null;
    const stored = JSON.parse(raw);
    return createBoardConfig({
      columns: numberOrDefault(stored.columns, defaults.columns),
      scanIntervalMs: numberOrDefault(stored.scanIntervalMs, defaults.scanIntervalMs),
      transitionPauseMs: numberOrDefault(stored.transitionPauseMs, defaults.transitionPauseMs),
      firstCellPauseMs: numberOrDefault(stored.firstCellPauseMs, defaults.firstCellPauseMs),
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
  resetClock();
  render();
  scheduleScan();
  announceCurrentScanTarget();
}

function activateSwitch() {
  if (configOpen) return;
  const elapsed = performance.now() - highlightStartedAt;
  const nextSession = pressSwitch(session, elapsed);
  const selection = nextSession.lastSelection;
  session = uiConfig.restartScanFromTop && selection
    ? { ...nextSession, scannerState: { ...nextSession.scannerState, rowIndex: 0 } }
    : nextSession;
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
  setSession(advanceSession(session));
}

function scheduleScan() {
  window.clearTimeout(timerId);
  window.cancelAnimationFrame(animationFrameId);
  if (configOpen) return;

  const duration = scanDurationForStage(session.scannerState, session.config);
  timerId = window.setTimeout(advanceScan, duration);
  updateProgress();
}

function updateProgress() {
  const duration = scanDurationForStage(session.scannerState, session.config);
  const elapsed = Math.max(0, performance.now() - highlightStartedAt);
  const progress = Math.min(1, elapsed / Math.max(1, duration));
  const progressFill = app.querySelector(".tile.is-current .progress-fill");
  if (progressFill) progressFill.style.width = `${progress * 100}%`;
  animationFrameId = window.requestAnimationFrame(updateProgress);
}

function speak(text) {
  speakText(text);
}

function speakText(text) {
  if (globalThis.ShineAacAndroid?.speak) {
    globalThis.ShineAacAndroid.speak(text.trim());
    return;
  }
  if (!("speechSynthesis" in window)) return;
  const spoken = text.trim();
  if (!spoken) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
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
  if (!uiConfig.scanVoice || configOpen) return;
  const board = visibleBoard(session);
  const scanner = session.scannerState;
  const key = `${scanner.stage}:${scanner.rowIndex}:${scanner.cellIndex}`;
  if (key === lastScanAnnouncementKey) return;
  lastScanAnnouncementKey = key;

  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    const labels = (board[scanner.rowIndex] ?? [])
      .filter((candidate) => candidate.action !== TileAction.Noop)
      .map(labelForSpeech)
      .filter(Boolean);
    speakFeedback(labels.join(", "));
    return;
  }

  const tile = board[scanner.rowIndex]?.[scanner.cellIndex];
  if (tile) speakFeedback(labelForSpeech(tile));
}

function labelForSpeech(tile) {
  if (tile.action === TileAction.Space) return "space";
  if (tile.action === TileAction.Backspace) return "delete";
  if (tile.action === TileAction.Clear) return "clear";
  if (tile.action === TileAction.Undo) return "undo";
  if (tile.action === TileAction.Speak) return "speak";
  return tile.output.trim() || tile.label;
}

function render() {
  const board = visibleBoard(session);
  const scanner = session.scannerState;
  app.innerHTML = "";

  const shell = document.createElement("section");
  shell.className = "shell";
  shell.addEventListener("click", activateSwitch);

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
  phase.textContent = phaseLabel(scanner.stage);

  const voice = document.createElement("div");
  voice.className = "voice";
  voice.textContent = uiConfig.scanVoice || uiConfig.activationVoice ? "Audio" : "Silent";

  const configButton = document.createElement("button");
  configButton.className = "config-button";
  configButton.type = "button";
  configButton.textContent = "Config";
  configButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openConfig();
  });

  status.append(phase, voice, configButton);
  topPanel.append(message, status);

  const boardElement = document.createElement("section");
  boardElement.className = "board";
  boardElement.setAttribute("data-testid", "board");
  boardElement.style.setProperty("--row-count", String(board.length));

  board.forEach((row, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = "row";
    rowElement.style.gridTemplateColumns = `repeat(${session.config.columns}, minmax(0, 1fr))`;

    row.forEach((candidate, cellIndex) => {
      const activeRow =
        (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) &&
        scanner.rowIndex === rowIndex;
      const activeCell =
        (scanner.stage === ScanStage.FirstCell || scanner.stage === ScanStage.Cells) &&
        scanner.rowIndex === rowIndex &&
        scanner.cellIndex === cellIndex;

      const tile = document.createElement("div");
      tile.className = tileClass(candidate, activeRow, activeCell);
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
    });

    boardElement.append(rowElement);
  });

  shell.append(topPanel, boardElement);
  app.append(shell);
  emitRenderState(board);
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

function tileClass(candidate, activeRow, activeCell) {
  const classes = ["tile"];
  classes.push(`action-${candidate.action}`);
  if (candidate.action !== TileAction.Append) classes.push("command");
  if (candidate.action === TileAction.Noop) classes.push("noop");
  if (activeRow) classes.push("active-row", "is-current");
  if (activeCell) classes.push("active-cell", "is-current");
  if (candidate.label.length >= 7) classes.push("tiny");
  else if (candidate.label.length >= 5) classes.push("small");
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
  window.clearTimeout(timerId);
  window.cancelAnimationFrame(animationFrameId);
  renderConfig();
}

function closeConfig() {
  configOpen = false;
  render();
  resetClock();
  scheduleScan();
}

function renderConfig() {
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
      <label class="field">Columns
        <input name="columns" type="number" min="2" max="8" step="1" value="${session.config.columns}">
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
        <input name="scanVoice" type="checkbox" ${uiConfig.scanVoice ? "checked" : ""}>
        Voice while scanning
      </label>
      <label class="field check-field">
        <input name="activationVoice" type="checkbox" ${uiConfig.activationVoice ? "checked" : ""}>
        Voice on activation
      </label>
      <label class="field check-field">
        <input name="restartScanFromTop" type="checkbox" ${uiConfig.restartScanFromTop ? "checked" : ""}>
        Restart scan at top after input
      </label>
      <label class="field wide">Suggestion dictionary
        <textarea name="suggestionDictionary">${escapeHtml(serializeDictionary(session.config.suggestionDictionary))}</textarea>
      </label>
      <label class="field wide">Board symbols
        <textarea name="symbols">${escapeHtml(serializeSymbols(session.config.symbols))}</textarea>
      </label>
    </div>
    <div class="config-actions">
      <button class="secondary-button" type="button" data-action="reset">Reset</button>
      <button class="secondary-button" type="button" data-action="cancel">Cancel</button>
      <button class="primary-button" type="submit">Save</button>
    </div>
  `;

  form.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "cancel") closeConfig();
    if (action === "reset") {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(uiStorageKey);
      session = createSession({ config: createBoardConfig() });
      uiConfig = defaultUiConfig;
      closeConfig();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const config = createBoardConfig({
      columns: clamp(Number(data.get("columns")), 2, 8),
      scanIntervalMs: clamp(Number(data.get("scanIntervalMs")), 300, 5000),
      transitionPauseMs: clamp(Number(data.get("transitionPauseMs")), 0, 4000),
      firstCellPauseMs: clamp(Number(data.get("firstCellPauseMs")), 300, 6000),
      inputLatencyCompensationMs: clamp(Number(data.get("inputLatencyCompensationMs")), 0, 1200),
      suggestionDictionary: parseDictionary(String(data.get("suggestionDictionary") ?? "")),
      symbols: parseSymbols(String(data.get("symbols") ?? ""))
    });
    saveConfig(config);
    uiConfig = {
      scanVoice: data.get("scanVoice") === "on",
      activationVoice: data.get("activationVoice") === "on",
      restartScanFromTop: data.get("restartScanFromTop") === "on"
    };
    saveUiConfig(uiConfig);
    session = createSession({ config });
    closeConfig();
  });

  panel.append(title, form);
  backdrop.append(panel);
  app.append(backdrop);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

document.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  const tagName = document.activeElement?.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "BUTTON") return;
  event.preventDefault();
  activateSwitch();
});

render();
scheduleScan();
announceCurrentScanTarget();
