import {
  CurrentConfigVersion,
  LanguageProfiles,
  ScanMode,
  ScanStage,
  ScanTimingPresets,
  SuggestionPageScanPassLimit,
  TileAction,
  advanceSession,
  applyScanTimingPreset,
  boardRows,
  createBoardConfig,
  createScannerState,
  createSession,
  compactTextHistorySnapshots,
  loadProfileColumnsForConfig,
  loadProfileSuggestionDictionaryForConfig,
  loadProfileSymbolsForConfig,
  loadScanIntervalForConfig,
  loadTransitionPauseForConfig,
  loadFirstCellPauseForConfig,
  parseDictionary,
  parseSymbols,
  pressSwitch,
  scanDurationForStage,
  scanRowBlocks,
  scanRowBlocksForPass,
  scanSelectableCellIndices,
  scanTimingPresetIdForConfig,
  selectableCount,
  serializeDictionary,
  serializeSymbols,
  speechLabelForTile,
  visibleBoard
} from "../../../packages/aac-core/src/index.js";
import { createDemoMode, demoTimingConfig } from "./demo-mode.js";
import { clamp, escapeHtml, numberOrDefault } from "./form-utils.js";
import { InputIntent, isCameraInput, isHardwareInput } from "./input.js";
import {
  androidSystemVoiceName,
  ContrastThemes,
  defaultUiConfig,
  loadUiConfig,
  normalizeUiConfig,
  saveUiConfig,
  syncNativeUiConfig
} from "./ui-config.js";

const storageKey = "shine-aac-web-config-v1";
const webConfigVersion = CurrentConfigVersion;
const initialProductProfileId = "zh-TW";
const app = document.querySelector("#app");
const uiStorageKey = "shine-aac-web-ui-v1";
const textHistoryStorageKey = "shine-aac-text-history-v1";
const sessionDraftStorageKey = "shine-aac-session-draft-v1";
const pendingConfigDraftStorageKey = "shine-aac-pending-config-draft-v1";
const PendingConfigDraftMaxAgeMs = 10 * 60 * 1000;
const ConfigCheckboxFieldNames = [
  "autoScanSuggestionPages",
  "deferUnsupportedZhuyinOnFirstPass",
  "rowScanVoice",
  "scanVoice",
  "activationVoice",
  "restartScanFromTop",
  "verticalGroupProgress"
];
const CameraStatusStaleMs = 2200;
const TextHistoryVersion = 3;
const TextHistoryMaxEntries = 1000;
const TextHistoryMaxChars = 220000;
const TextHistoryMaxStorageChars = 480000;
const SessionDraftVersion = 1;
const SessionDraftMaxHistoryEntries = 24;
const SessionDraftMaxMessageChars = 10000;
const FunctionTileActions = new Set([
  TileAction.Space,
  TileAction.Backspace,
  TileAction.Clear,
  TileAction.Undo,
  TileAction.Speak,
  TileAction.EnterMode,
  TileAction.ExitMode,
  TileAction.OpenCategory,
  TileAction.CloseCategory,
  TileAction.ZhuyinGroup,
  TileAction.MoreSuggestions
]);
const FunctionTileIcons = Object.freeze({
  [TileAction.Space]: "␠",
  [TileAction.Backspace]: "⌫",
  [TileAction.Clear]: "✕",
  [TileAction.Undo]: "↶",
  [TileAction.Speak]: "▶",
  [TileAction.EnterMode]: "⇄",
  [TileAction.ExitMode]: "←",
  [TileAction.OpenCategory]: "⇄",
  [TileAction.CloseCategory]: "←",
  [TileAction.ZhuyinGroup]: "⇄",
  [TileAction.MoreSuggestions]: "⋯"
});

function isZhTwUi() {
  return session.config.profileId === "zh-TW";
}

function uiText(english, traditionalChinese) {
  return isZhTwUi() ? traditionalChinese : english;
}

function applyContrastTheme(theme) {
  if (theme && theme !== "default") {
    document.documentElement.dataset.contrast = theme;
  } else {
    delete document.documentElement.dataset.contrast;
  }
}

function contrastThemeOptionsHtml(selected) {
  const labels = {
    default: uiText("Default", "預設"),
    "high-contrast": uiText("High contrast (light)", "高對比（淺色）"),
    "high-contrast-dark": uiText("High contrast (dark)", "高對比（深色）")
  };
  return ContrastThemes.map((theme) => {
    const isSelected = theme === selected ? " selected" : "";
    return `<option value="${theme}"${isSelected}>${escapeHtml(labels[theme])}</option>`;
  }).join("");
}

const initialConfig = loadConfig();
let session = createSession({ config: initialConfig, ...loadSessionDraft(initialConfig) });
let uiConfig = loadUiConfig(uiStorageKey);
applyContrastTheme(uiConfig.contrastTheme);
let highlightStartedAt = performance.now();
let highlightDeadlineAt = highlightStartedAt;
let timerId = 0;
let pendingConfigDraftFields = loadPendingConfigDraft();
let configOpen = Boolean(pendingConfigDraftFields);
let calibrationOpen = false;
let appInfoOpen = false;
let speechVoicesOpen = false;
let textExportDialogOpen = false;
let textExportPreviewUrl = "";
let speechVoiceRefreshTimerId = 0;
let speechVoiceStatusMessage = "";
const speechVoiceDownloadRequests = new Map();
const speechVoiceDownloadHelp = new Set();
let calibrationTimerId = 0;
let lastScanAnnouncementKey = "";
let reviewHoldActive = true;
let cameraHoldActive = false;
let cameraHoldProgress = 0;
let suppressNextConfigClick = false;
let renderedBoardKey = "";
let renderedMessage = "";
let renderedTiles = [];
let renderedTileGrid = [];
let renderedRows = [];
let renderedPhaseElement = null;
let renderedVoiceElement = null;
let renderedCameraStatusElement = null;
const boardSignatureCache = new WeakMap();
let tileLabelFitFrame = 0;
let observedBoardElement = null;
const tileLabelResizeObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver(() => scheduleTileLabelFit())
  : null;
let currentActiveTiles = [];
let currentProgressFills = [];
let progressTargetKey = "";
let pendingAdvanceSession = null;
let prepareAdvanceTimerId = 0;
let animationFrameId = 0;
let scanScheduleToken = 0;
let cameraStatus = { state: "off", label: "Camera off", updatedAt: 0 };
let cameraStatusTimerId = 0;
let calibrationState = createCalibrationState();
const demoMode = createDemoMode({
  getHighlightStartedAt: () => highlightStartedAt,
  getSession: () => session,
  getTimingConfig: effectiveTimingConfigForScan,
  isReviewHoldActive: () => reviewHoldActive,
  receiveInput: handleInputEvent,
  refreshScanTiming: refreshScanTimingAfterDemo,
  resetSession: resetSessionForDemo
});

globalThis.ShineAacInput = {
  receive: handleInputEvent
};

globalThis.ShineAacTextHistory = {
  exportText: exportTextHistoryText,
  record: () => recordTextHistory("manual", "manual")
};

globalThis.ShineAacTextExport = Object.freeze({
  completed: (resultJson) => showTextExportResult(parseTextExportResult(resultJson, true)),
  failed: (resultJson) => showTextExportResult(parseTextExportResult(resultJson, false))
});

globalThis.ShineAacNavigation = Object.freeze({
  back: navigateBackWithinApp,
  currentPage: currentAppPage
});

globalThis.ShineAacSpeechVoices = Object.freeze({
  refresh: () => {
    if (speechVoicesOpen) renderSpeechVoiceSettings();
  }
});

function normalizeStoredScanPassLimit(value, fallback = 2) {
  if (Number(value) === 0) return 0;
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : fallback, 1, 3);
}

function booleanOrDefault(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function loadConfig() {
  const defaults = createBoardConfig({ profileId: initialProductProfileId });
  const nativeConfig = loadNativeConfig(defaults);
  if (nativeConfig) return nativeConfig;

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!stored) return defaults;
    const storedVersion = Number(stored.configVersion) || 0;
    const storedProfileId = stored.profileId ?? defaults.profileId;
    const profileDefaults = createBoardConfig({ profileId: storedProfileId });
    return createBoardConfig({
      profileId: storedProfileId,
      columns: loadProfileColumnsForConfig(
        numberOrDefault(stored.columns, profileDefaults.columns),
        storedVersion,
        storedProfileId,
        stored.symbols ?? serializeSymbols(profileDefaults.symbols)
      ),
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
      scanMode: stored.scanMode ?? profileDefaults.scanMode,
      scanPassLimit: normalizeStoredScanPassLimit(stored.scanPassLimit, profileDefaults.scanPassLimit),
      autoScanSuggestionPages: stored.autoScanSuggestionPages === true,
      deferUnsupportedZhuyinOnFirstPass: booleanOrDefault(
        stored.deferUnsupportedZhuyinOnFirstPass,
        profileDefaults.deferUnsupportedZhuyinOnFirstPass
      ),
      suggestionDictionary: loadProfileSuggestionDictionaryForConfig(
        stored.suggestionDictionary ?? serializeDictionary(profileDefaults.suggestionDictionary),
        storedVersion,
        storedProfileId
      ),
      symbols: loadProfileSymbolsForConfig(
        stored.symbols ?? serializeSymbols(profileDefaults.symbols),
        storedVersion,
        storedProfileId
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
      columns: loadProfileColumnsForConfig(
        numberOrDefault(stored.columns, defaults.columns),
        storedVersion,
        stored.profileId
      ),
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
      ),
      scanMode: stored.scanMode ?? defaults.scanMode,
      scanPassLimit: normalizeStoredScanPassLimit(stored.scanPassLimit, defaults.scanPassLimit),
      autoScanSuggestionPages: stored.autoScanSuggestionPages === true,
      deferUnsupportedZhuyinOnFirstPass: booleanOrDefault(
        stored.deferUnsupportedZhuyinOnFirstPass,
        defaults.deferUnsupportedZhuyinOnFirstPass
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
    scanMode: config.scanMode,
    scanPassLimit: config.scanPassLimit,
    autoScanSuggestionPages: config.autoScanSuggestionPages,
    deferUnsupportedZhuyinOnFirstPass: config.deferUnsupportedZhuyinOnFirstPass,
    suggestionDictionary: serializeDictionary(config.suggestionDictionary),
    symbols: serializeSymbols(config.symbols)
  }));
}

function loadSessionDraft(config) {
  try {
    const candidates = [
      localStorage.getItem(sessionDraftStorageKey),
      globalThis.ShineAacAndroid?.getSessionDraftJson?.()
    ]
      .filter((value) => typeof value === "string" && value.length > 0)
      .map((value) => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })
      .filter((draft) => draft?.version === SessionDraftVersion && draft.profileId === config.profileId)
      .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0));
    const stored = candidates[0];
    if (!stored) return {};
    const message = sanitizeDraftText(stored.message);
    const messageHistory = Array.isArray(stored.messageHistory)
      ? stored.messageHistory
        .filter((entry) => typeof entry === "string")
        .map(sanitizeDraftText)
        .slice(-SessionDraftMaxHistoryEntries)
      : [];
    return {
      message,
      messageHistory,
      inputMode: typeof stored.inputMode === "string" ? stored.inputMode : "board",
      activeCategory: typeof stored.activeCategory === "string" ? stored.activeCategory : null,
      zhuyinBuffer: sanitizeDraftText(stored.zhuyinBuffer),
      zhuyinStage: typeof stored.zhuyinStage === "string" ? stored.zhuyinStage : "initialGroup",
      zhuyinGroup: typeof stored.zhuyinGroup === "string" ? stored.zhuyinGroup : null,
      suggestionPage: Number.isInteger(stored.suggestionPage) ? stored.suggestionPage : 0,
      suggestionPageHistory: Array.isArray(stored.suggestionPageHistory)
        ? stored.suggestionPageHistory.filter(Number.isInteger).map((page) => Math.max(0, page)).slice(-SessionDraftMaxHistoryEntries)
        : []
    };
  } catch {
    return {};
  }
}

function saveSessionDraft() {
  const value = JSON.stringify({
    version: SessionDraftVersion,
    updatedAt: Date.now(),
    profileId: session.config.profileId,
    message: sanitizeDraftText(session.message),
    messageHistory: session.messageHistory
      .map(sanitizeDraftText)
      .slice(-SessionDraftMaxHistoryEntries),
    inputMode: session.inputMode,
    activeCategory: session.activeCategory,
    zhuyinBuffer: sanitizeDraftText(session.zhuyinBuffer),
    zhuyinStage: session.zhuyinStage,
    zhuyinGroup: session.zhuyinGroup,
    suggestionPage: session.suggestionPage,
    suggestionPageHistory: session.suggestionPageHistory
      .filter(Number.isInteger)
      .slice(-SessionDraftMaxHistoryEntries)
  });
  try {
    localStorage.setItem(sessionDraftStorageKey, value);
  } catch {
    // Draft persistence is best effort; communication must continue if storage is unavailable.
  }
  try {
    globalThis.ShineAacAndroid?.saveSessionDraftJson?.(value);
  } catch {
    // Native persistence is unavailable in a normal browser.
  }
}

function clearSessionDraft() {
  try {
    localStorage.removeItem(sessionDraftStorageKey);
  } catch {
    // Storage may be unavailable.
  }
  try {
    globalThis.ShineAacAndroid?.clearSessionDraft?.();
  } catch {
    // Native persistence is unavailable in a normal browser.
  }
}

function savePendingConfigDraft(form) {
  try {
    const fields = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem(pendingConfigDraftStorageKey, JSON.stringify({
      updatedAt: Date.now(),
      fields
    }));
  } catch {
    // Draft persistence is best effort; opening camera setup must still proceed.
  }
}

function loadPendingConfigDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem(pendingConfigDraftStorageKey) ?? "null");
    if (!stored || typeof stored.fields !== "object" || stored.fields === null) return null;
    if (Date.now() - Number(stored.updatedAt ?? 0) > PendingConfigDraftMaxAgeMs) return null;
    return stored.fields;
  } catch {
    return null;
  }
}

function clearPendingConfigDraft() {
  try {
    localStorage.removeItem(pendingConfigDraftStorageKey);
  } catch {
    // Storage may be unavailable.
  }
}

function applyPendingConfigDraftToForm(form, fields) {
  for (const name of ConfigCheckboxFieldNames) {
    if (form.elements[name]) form.elements[name].checked = fields[name] === "on";
  }
  for (const [name, value] of Object.entries(fields)) {
    if (ConfigCheckboxFieldNames.includes(name)) continue;
    const element = form.elements[name];
    if (element) element.value = value;
  }
}

function sanitizeDraftText(value) {
  return String(value ?? "").slice(0, SessionDraftMaxMessageChars);
}

function loadTextHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(textHistoryStorageKey) ?? "null");
    if (!stored || !Array.isArray(stored.entries)) return [];
    const storedVersion = Number(stored.version) || 1;
    const hasMutableLines = storedVersion >= 2;
    const entries = stored.entries
      .filter((entry) => typeof entry.text === "string" && (
        entry.text.length > 0 || (hasMutableLines && entry.closed === false)
      ))
      .map((entry) => ({
        id: String(entry.id ?? ""),
        at: String(entry.at ?? ""),
        profileId: String(entry.profileId ?? ""),
        source: String(entry.source ?? ""),
        effect: String(entry.effect ?? ""),
        text: String(entry.text),
        // Version 1 had no line state; version 2 introduced explicit reset lines.
        closed: hasMutableLines ? entry.closed !== false : true
      }));
    if (storedVersion >= TextHistoryVersion) return entries;
    return compactTextHistorySnapshots(entries, {
      currentText: session.message,
      currentProfileId: session.config.profileId
    });
  } catch {
    return [];
  }
}

function saveTextHistory(entries) {
  let pruned = pruneTextHistory(entries);
  while (pruned.length > 0) {
    try {
      localStorage.setItem(textHistoryStorageKey, JSON.stringify({
        version: TextHistoryVersion,
        entries: pruned
      }));
      return pruned;
    } catch {
      pruned = pruned.slice(Math.max(1, Math.ceil(pruned.length * 0.1)));
    }
  }
  try {
    localStorage.removeItem(textHistoryStorageKey);
  } catch {
    // Storage may be unavailable; transcript persistence is best effort.
  }
  return [];
}

function pruneTextHistory(entries) {
  let pruned = entries.slice(-TextHistoryMaxEntries);
  while (totalTextHistoryChars(pruned) > TextHistoryMaxChars && pruned.length > 1) {
    pruned = pruned.slice(1);
  }
  while (JSON.stringify({ version: TextHistoryVersion, entries: pruned }).length > TextHistoryMaxStorageChars && pruned.length > 1) {
    pruned = pruned.slice(1);
  }
  return pruned;
}

function totalTextHistoryChars(entries) {
  return entries.reduce((total, entry) => total + entry.text.length, 0);
}

function recordTextHistory(effect, source, { reset = false } = {}) {
  const text = session.message;
  const entries = loadTextHistory();
  const last = entries.at(-1);

  if (reset) {
    if (!last || last.closed) return;
    last.at = new Date().toISOString();
    last.source = String(source ?? last.source ?? "");
    last.effect = String(effect ?? last.effect ?? "");
    last.closed = true;
    saveTextHistory(entries);
    return;
  }

  if (last && !last.closed && last.profileId === session.config.profileId) {
    last.at = new Date().toISOString();
    last.source = String(source ?? last.source ?? "");
    last.effect = String(effect ?? last.effect ?? "");
    last.text = text;
    saveTextHistory(entries);
    return;
  }

  if (!text || text.trim().length === 0) return;
  if (last && !last.closed) last.closed = true;
  saveTextHistory([
    ...entries,
    {
      id: `${Date.now()}-${entries.length}`,
      at: new Date().toISOString(),
      profileId: session.config.profileId,
      source: String(source ?? ""),
      effect: String(effect ?? ""),
      text,
      closed: false
    }
  ]);
}

function closeTextHistoryLine(effect, source) {
  recordTextHistory(effect, source, { reset: true });
}

function exportTextHistory() {
  recordTextHistory("export", "config");
  const text = exportTextHistoryText();
  const fileName = `saytome-aac-text-history-${new Date().toISOString().slice(0, 10)}.txt`;
  if (globalThis.ShineAacAndroid?.exportTextHistory) {
    try {
      globalThis.ShineAacAndroid.exportTextHistory(text, fileName);
      return;
    } catch {
      // Fall back to browser download when the native bridge is unavailable.
    }
  }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  showTextExportResult({
    success: true,
    fileName,
    canOpen: false,
    previewText: text,
    browserDownload: true
  });
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseTextExportResult(resultJson, success) {
  try {
    const parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
    return {
      success,
      fileName: String(parsed?.fileName ?? ""),
      canOpen: parsed?.canOpen === true,
      message: String(parsed?.message ?? "")
    };
  } catch {
    return { success, fileName: "", canOpen: false, message: "" };
  }
}

function showTextExportResult(result) {
  closeTextExportResult();
  const isZhTw = session.config.profileId === "zh-TW";
  const success = result?.success === true;
  const canOpenNative = success && result?.canOpen === true &&
    typeof globalThis.ShineAacAndroid?.openLastTextExport === "function";
  const canPreview = success && typeof result?.previewText === "string";
  const fileName = String(result?.fileName || (isZhTw ? "文字記錄.txt" : "text-history.txt"));

  if (canPreview) {
    textExportPreviewUrl = URL.createObjectURL(new Blob(
      [result.previewText],
      { type: "text/plain;charset=utf-8" }
    ));
  }

  const backdrop = document.createElement("div");
  backdrop.className = "config-backdrop text-export-backdrop";
  backdrop.dataset.testid = "text-export-result";
  backdrop.addEventListener("click", closeTextExportResult);

  const panel = document.createElement("section");
  panel.className = `text-export-panel ${success ? "success" : "error"}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "text-export-title");
  panel.addEventListener("click", (event) => event.stopPropagation());

  const title = success
    ? isZhTw ? "文字已匯出" : "Text exported"
    : isZhTw ? "無法匯出文字" : "Could not export text";
  const detail = success
    ? result.browserDownload
      ? isZhTw ? "檔案已下載。您也可以直接查看這次匯出的內容。" : "The file was downloaded. You can also preview the exported text now."
      : isZhTw ? "檔案已儲存。現在可以直接開啟，不必再尋找資料夾。" : "The file was saved. You can open it now without finding its folder."
    : result?.message || (isZhTw ? "文字檔沒有儲存，請返回設定後再試一次。" : "The text file was not saved. Return to settings and try again.");
  const primaryLabel = canOpenNative
    ? isZhTw ? "開啟文字檔" : "Open text file"
    : canPreview
      ? isZhTw ? "查看匯出內容" : "Preview exported text"
      : "";

  panel.innerHTML = `
    <div class="text-export-mark" aria-hidden="true">${success ? "✓" : "!"}</div>
    <h1 id="text-export-title">${escapeHtml(title)}</h1>
    <p>${escapeHtml(detail)}</p>
    ${success ? `<p class="text-export-file"><span>${isZhTw ? "檔名" : "File"}</span><strong>${escapeHtml(fileName)}</strong></p>` : ""}
    <div class="text-export-actions">
      ${primaryLabel ? `<button class="primary-button" type="button" data-action="open-export">${escapeHtml(primaryLabel)}</button>` : ""}
      <button class="secondary-button" type="button" data-action="close-export">${isZhTw ? "返回設定" : "Back to settings"}</button>
    </div>
  `;
  panel.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "close-export") closeTextExportResult();
    if (action !== "open-export") return;
    if (canOpenNative) {
      globalThis.ShineAacAndroid.openLastTextExport();
    } else if (textExportPreviewUrl) {
      window.open(textExportPreviewUrl, "_blank", "noopener,noreferrer");
    }
    closeTextExportResult();
  });

  backdrop.append(panel);
  app.append(backdrop);
  textExportDialogOpen = true;
  panel.querySelector(success && primaryLabel ? '[data-action="open-export"]' : '[data-action="close-export"]')?.focus();
}

function closeTextExportResult() {
  app.querySelector('[data-testid="text-export-result"]')?.remove();
  textExportDialogOpen = false;
  if (textExportPreviewUrl) URL.revokeObjectURL(textExportPreviewUrl);
  textExportPreviewUrl = "";
}

function exportTextHistoryText() {
  const lines = loadTextHistory()
    .map((entry) => entry.text.replace(/[\r\n]+/g, " "))
    .filter((text) => text.trim().length > 0);
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function resetClock() {
  highlightStartedAt = performance.now();
  lastScanAnnouncementKey = "";
}

function setSession(nextSession) {
  const previousStage = session.scannerState.stage;
  const previousPassIndex = session.scannerState.passIndex;
  session = nextSession;
  reviewHoldActive = false;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  render();
  resetClock();
  scheduleScan();
  announceScanTransition(previousStage, previousPassIndex);
  announceCurrentScanTarget();
}

function resetSessionForDemo() {
  closeTextHistoryLine("reset", "demo");
  clearSessionDraft();
  setSession(createSession({ config: session.config }));
}

function refreshScanTimingAfterDemo() {
  cancelScheduledScan();
  render();
  resetClock();
  scheduleScan();
  announceCurrentScanTarget();
}

function handleInputEvent(inputEvent = {}) {
  const intent = inputEvent.intent ?? InputIntent.Activate;
  if (calibrationOpen) {
    if (intent === InputIntent.Activate) recordCalibrationInput(inputEvent);
    return true;
  }
  if (isHardwareInput(inputEvent.source) && !hardwareInputEnabled()) return false;
  if (isCameraInput(inputEvent.source) && !cameraInputEnabled()) return false;
  if (intent === InputIntent.CameraStatus) return updateCameraStatus(inputEvent);
  if (intent === InputIntent.HoldStart) return startCameraHold(inputEvent);
  if (intent === InputIntent.HoldEnd) return endCameraHold(inputEvent);
  if (intent !== InputIntent.Activate) return false;
  activateSwitch(inputEvent);
  return true;
}

function activateSwitch(inputEvent = {}) {
  if (configOpen) return;
  const cameraHoldWasActive = cameraHoldActive && isCameraInput(inputEvent.source);
  const frozenCameraProgress = cameraHoldProgress;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  cancelScheduledScan();
  if (reviewHoldActive) {
    reviewHoldActive = false;
    render();
    resetClock();
    scheduleScan();
    announceCurrentScanTarget();
    return;
  }
  const elapsed = cameraHoldWasActive
    ? frozenElapsedForCurrentScan(frozenCameraProgress)
    : performance.now() - highlightStartedAt;
  const baseConfig = session.config;
  const timedSession = { ...session, config: effectiveTimingConfigForInput(inputEvent.source) };
  const nextSessionWithTiming = pressSwitch(timedSession, elapsed);
  const nextSession = { ...nextSessionWithTiming, config: baseConfig };
  const selection = nextSession.lastSelection;
  const shouldHold = shouldHoldAfterStateChange(selection);
  const enteredSuggestionPageScan = nextSession.scannerState.stage === ScanStage.SuggestionPages;
  session = !enteredSuggestionPageScan && ((uiConfig.restartScanFromTop && selection) || shouldHold)
    ? {
      ...nextSession,
      scannerState: createScannerState({ scanMode: session.config.scanMode }),
      lockedRow: null
    }
    : nextSession;
  if (selection && !["none", "speak"].includes(selection.effect)) {
    saveSessionDraft();
  }
  if (selection && ["message", "undo"].includes(selection.effect)) {
    if (selection.tile.action === TileAction.Clear) {
      closeTextHistoryLine("reset", inputEvent.source ?? "switch");
    } else {
      recordTextHistory(selection.effect, inputEvent.source ?? "switch");
    }
  }
  reviewHoldActive = shouldHold;
  render();
  resetClock();
  scheduleScan();

  if (selection?.effect === "speak") {
    speak(session.message);
  } else if (enteredSuggestionPageScan) {
    announceCurrentScanTarget();
  } else if (selection) {
    speakActivation(selection.tile);
  } else {
    announceCurrentScanTarget();
  }
}

function startCameraHold(inputEvent = {}) {
  if (configOpen || !isCameraInput(inputEvent.source)) return false;
  if (reviewHoldActive) return true;
  if (cameraHoldActive) return true;

  setCameraStatus("blink", "Blink", false);
  cameraHoldProgress = currentScanProgress();
  cameraHoldActive = true;
  cancelScheduledScan();
  render();
  setProgressFills(cameraHoldProgress, 0);
  return true;
}

function endCameraHold(inputEvent = {}) {
  if (!isCameraInput(inputEvent.source)) return false;
  if (!cameraHoldActive) return true;

  setCameraStatus("live", "Cam live", true);
  const resumeProgress = cameraHoldProgress;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  render();
  resumeScanFromProgress(resumeProgress);
  return true;
}

function advanceScan() {
  if (configOpen || cameraHoldActive) return;
  const nextSession = pendingAdvanceSession ?? advanceEffectiveSession();
  pendingAdvanceSession = null;
  setSession(nextSession);
}

function advanceEffectiveSession() {
  return advanceSession(session, demoMode.scanPassLimit(session.config.scanPassLimit));
}

function scheduleScan() {
  cancelScheduledScan();
  if (configOpen || cameraHoldActive || session.scannerState.stage === ScanStage.Stopped) return;
  if (reviewHoldActive) {
    setProgressFills(1, 0);
    return;
  }

  const duration = scanDurationForStage(session.scannerState, effectiveTimingConfigForScan());
  const token = scanScheduleToken;
  startScanClock(duration, token);
}

function resumeScanFromProgress(progress) {
  cancelScheduledScan();
  if (
    configOpen ||
    reviewHoldActive ||
    cameraHoldActive ||
    session.scannerState.stage === ScanStage.Stopped
  ) return;
  const duration = scanDurationForStage(session.scannerState, effectiveTimingConfigForScan());
  const clampedProgress = clamp(progress, 0, 0.98);
  const remainingMs = Math.max(1, duration * (1 - clampedProgress));
  const token = scanScheduleToken;
  highlightStartedAt = performance.now() - duration * clampedProgress;
  highlightDeadlineAt = highlightStartedAt + duration;
  const progressFills = setProgressFills(clampedProgress, 0);
  forceProgressLayout(progressFills);
  setProgressFills(1, remainingMs);
  timerId = window.setTimeout(advanceScan, remainingMs);
  prepareAdvanceTimerId = window.setTimeout(() => {
    if (token !== scanScheduleToken || configOpen || reviewHoldActive || cameraHoldActive) return;
    pendingAdvanceSession = advanceEffectiveSession();
  }, 0);
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
  highlightDeadlineAt = highlightStartedAt + durationMs;
  const elapsedMs = clamp(performance.now() - highlightStartedAt, 0, durationMs - 1);
  const remainingMs = Math.max(1, durationMs - elapsedMs);
  timerId = window.setTimeout(advanceScan, remainingMs);
  const progressFills = setProgressFills(elapsedMs / durationMs, 0);
  forceProgressLayout(progressFills);
  setProgressFills(1, remainingMs);
  prepareAdvanceTimerId = window.setTimeout(() => {
    if (token !== scanScheduleToken || configOpen || reviewHoldActive || cameraHoldActive) return;
    pendingAdvanceSession = advanceEffectiveSession();
  }, 0);
}

function currentScanProgress() {
  const duration = Math.max(1, highlightDeadlineAt - highlightStartedAt);
  return clamp((performance.now() - highlightStartedAt) / duration, 0, 1);
}

function frozenElapsedForCurrentScan(progress) {
  const duration = scanDurationForStage(session.scannerState, effectiveTimingConfigForScan());
  return clamp(progress, 0, 1) * duration;
}

function setProgressFills(progress, durationMs) {
  const progressFills = currentProgressFills.some((fill) => fill?.isConnected)
    ? currentProgressFills.filter((fill) => fill?.isConnected)
    : [...app.querySelectorAll(".tile.is-current .progress-fill")];
  for (const progressFill of progressFills) {
    progressFill.style.transitionDuration = `${durationMs}ms`;
    progressFill.style.transform = progressTransform(progressFill, progress);
  }
  return progressFills;
}

function progressTransform(progressFill, progress) {
  return progressFill.dataset.progressDirection === "down"
    ? `scaleY(${progress})`
    : `scaleX(${progress})`;
}

function forceProgressLayout(progressFills) {
  for (const progressFill of progressFills) {
    progressFill.getBoundingClientRect();
  }
}

function shouldHoldAfterStateChange(selection) {
  if (
    selection?.tile.action === TileAction.MoreSuggestions &&
    session.config.autoScanSuggestionPages
  ) return false;
  return Boolean(selection && !["none", "speak"].includes(selection.effect));
}

function effectiveTimingConfigForScan() {
  if (demoMode.isActive()) return demoTimingConfig(session.config);
  return session.config;
}

function effectiveTimingConfigForInput(source = "") {
  if (source === "demo-mode") return demoTimingConfig(session.config);
  return session.config;
}

function speak(text) {
  speakText(text);
}

function speakText(text, preferOfficialZhuyin = false) {
  const spoken = text.trim();
  if (!spoken) return;
  if (globalThis.ShineAacAndroid?.speak) {
    if (globalThis.ShineAacAndroid.setSpeechLocale) {
      globalThis.ShineAacAndroid.setSpeechLocale(session.config.speechLocale);
    }
    if (preferOfficialZhuyin && typeof globalThis.ShineAacAndroid.speakZhuyin === "function") {
      globalThis.ShineAacAndroid.speakZhuyin(spoken);
    } else {
      globalThis.ShineAacAndroid.speak(spoken);
    }
    return;
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = session.config.speechLocale;
  window.speechSynthesis.speak(utterance);
}

function speakFeedback(text, preferOfficialZhuyin = false) {
  const spoken = text.trim();
  if (!spoken) return;
  speakText(spoken, preferOfficialZhuyin);
}

function speakActivation(tile) {
  if (!uiConfig.activationVoice) return;
  speakFeedback(labelForSpeech(tile), isZhuyinSpeechTile(tile));
}

function updateCameraStatus(inputEvent = {}) {
  const state = String(inputEvent.state ?? detailValue(inputEvent.detail, "state") ?? "live");
  const label = isZhTwUi()
    ? cameraStatusLabel(state)
    : String(inputEvent.label ?? cameraStatusLabel(state));
  setCameraStatus(state, label, state === "live" || state === "analysis");
  return true;
}

function setCameraStatus(state, label, monitorStale) {
  cameraStatus = { state, label, updatedAt: performance.now(), monitorStale };
  updateCameraStatusPresentation();
  if (monitorStale) scheduleCameraStatusStaleCheck();
}

function scheduleCameraStatusStaleCheck() {
  window.clearTimeout(cameraStatusTimerId);
  cameraStatusTimerId = window.setTimeout(() => {
    if (!cameraInputEnabled() || !cameraStatus.monitorStale) return;
    if (performance.now() - cameraStatus.updatedAt >= CameraStatusStaleMs) {
      setCameraStatus("detectorStale", cameraStatusLabel("detectorStale"), false);
    } else {
      scheduleCameraStatusStaleCheck();
    }
  }, CameraStatusStaleMs);
}

function updateCameraStatusPresentation() {
  const element = renderedCameraStatusElement;
  if (!element) return;
  const visible = cameraInputEnabled();
  element.hidden = !visible;
  element.className = `camera-status camera-status-${cameraStatus.state}`;
  element.textContent = visible ? (isZhTwUi() ? cameraStatusLabel(cameraStatus.state) : cameraStatus.label) : "";
}

function cameraStatusLabel(state) {
  const zhTw = isZhTwUi();
  switch (state) {
    case "starting":
      return zhTw ? "相機啟動" : "Cam start";
    case "live":
      return zhTw ? "相機正常" : "Cam live";
    case "analysis":
      return zhTw ? "相機正常" : "Cam live";
    case "blink":
      return zhTw ? "偵測眨眼" : "Blink";
    case "restarting":
      return zhTw ? "重新啟動" : "Cam restart";
    case "detectorStale":
      return zhTw ? "偵測中斷" : "Detect stale";
    case "cameraStale":
      return zhTw ? "相機中斷" : "Cam stale";
    case "permissionDenied":
      return zhTw ? "需要相機權限" : "Camera permission";
    case "stale":
      return zhTw ? "偵測中斷" : "Detect stale";
    case "stopped":
    case "off":
      return zhTw ? "相機關閉" : "Camera off";
    default:
      return zhTw ? "相機狀態" : "Camera status";
  }
}

function detailValue(detail = "", key = "") {
  const prefix = `${key}=`;
  return String(detail)
    .split(/[;, ]+/)
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function announceCurrentScanTarget() {
  if (configOpen) return;
  const board = visibleBoard(session);
  const scanner = session.scannerState;
  const key = `${scanner.stage}:${scanner.blockIndex}:${scanner.rowIndex}:${scanner.cellIndex}:${scanner.passIndex}:${session.suggestionPage}`;
  if (key === lastScanAnnouncementKey) return;
  lastScanAnnouncementKey = key;

  if (scanner.stage === ScanStage.Stopped) return;

  if (scanner.stage === ScanStage.SuggestionPages) {
    if (!uiConfig.rowScanVoice) return;
    const candidates = board.slice(0, 4).flat()
      .filter((candidate) => ![TileAction.Noop, TileAction.MoreSuggestions].includes(candidate.action));
    const pageNumber = Math.max(1, Number(session.suggestionPage ?? 0) + 1);
    const labels = candidates.map(labelForSpeech).filter(Boolean);
    speakFeedback([
      uiText(`Suggestion page ${pageNumber}`, `候選第 ${pageNumber} 頁`),
      ...labels
    ].join(", "));
    return;
  }

  if (scanner.stage === ScanStage.Blocks || scanner.stage === ScanStage.BlockSelected) {
    if (!uiConfig.rowScanVoice) return;
    const blocks = scanBlocksForPresentation(scanner, board);
    const blockNumber = Math.min(blocks.length, Math.max(1, scanner.blockIndex + 1));
    speakFeedback(uiText(
      `Block ${blockNumber} of ${blocks.length}`,
      `第 ${blockNumber} 區，共 ${blocks.length} 區`
    ));
    return;
  }

  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    if (!uiConfig.rowScanVoice) return;
    const candidates = (board[scanner.rowIndex] ?? [])
      .filter((candidate) => candidate.action !== TileAction.Noop);
    const labels = candidates
      .map(labelForSpeech)
      .filter(Boolean);
    speakFeedback(
      labels.join(", "),
      candidates.length > 0 && candidates.every(isZhuyinSpeechTile)
    );
    return;
  }

  if (!uiConfig.scanVoice) return;
  const tile = board[scanner.rowIndex]?.[scanner.cellIndex];
  if (tile) speakFeedback(labelForSpeech(tile), isZhuyinSpeechTile(tile));
}

function announceScanTransition(previousStage, previousPassIndex) {
  if (!uiConfig.rowScanVoice && !uiConfig.scanVoice) return;
  const scanner = session.scannerState;
  if (scanner.stage === ScanStage.Stopped && previousStage !== ScanStage.Stopped) {
    speakFeedback(uiText("Scanning stopped. Press switch to resume.", "掃描已停止。按下開關即可繼續。"));
    return;
  }
  if (scanner.returningToRows) {
    speakFeedback(uiText("Back to rows", "返回選列"));
    return;
  }
  if (scanner.returningToBlocks) {
    speakFeedback(uiText("Back to blocks", "返回選區"));
    return;
  }
  if (scanner.passIndex > previousPassIndex) {
    speakFeedback(uiText("Scanning again", "再次掃描"));
  }
}

function labelForSpeech(tile) {
  return speechLabelForTile(tile, session.config.profileId);
}

function isZhuyinSpeechTile(tile) {
  if (!tile || session.config.profileId !== "zh-TW") return false;
  if (tile.action === TileAction.ZhuyinGroup || tile.action === TileAction.ZhuyinSymbol) {
    return true;
  }
  const label = String(tile.label ?? tile.output ?? "");
  return label.length > 0 && Array.from(label).every((character) =>
    character >= "\u3105" && character <= "\u3129"
  );
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
  phase.setAttribute("role", "status");
  phase.setAttribute("aria-live", "polite");
  phase.textContent = statusPhaseLabel(scanner);
  phase.dataset.scanPhase = statusPhaseCode(scanner);
  renderedPhaseElement = phase;

  const voice = document.createElement("div");
  voice.className = "voice";
  voice.textContent = voiceStatusLabel();
  renderedVoiceElement = voice;

  const cameraStatusElement = document.createElement("div");
  cameraStatusElement.className = "camera-status";
  cameraStatusElement.hidden = true;
  renderedCameraStatusElement = cameraStatusElement;

  const statusSecondary = document.createElement("div");
  statusSecondary.className = "status-secondary";
  statusSecondary.append(voice, cameraStatusElement);

  const configButton = document.createElement("button");
  configButton.className = "config-button";
  configButton.type = "button";
  configButton.textContent = session.config.profileId === "zh-TW" ? "⚙ 設定" : "⚙ Settings";
  configButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressNextConfigClick) {
      suppressNextConfigClick = false;
      return;
    }
    openConfig();
  });
  attachDemoLongPress(configButton);

  status.append(phase, statusSecondary, configButton);
  topPanel.append(message, status);

  const boardElement = document.createElement("section");
  boardElement.className = "board";
  if (board.length >= 18) boardElement.classList.add("dense-board");
  const boardRowWeights = board.map((row, rowIndex) =>
    isDynamicEnglishSuggestionRow(rowIndex) && row.some((candidate) =>
      session.config.suggestionWrapLabels?.[candidate.label]
    )
      ? "2fr"
      : "minmax(0, 1fr)"
  );
  if (boardRowWeights.some((weight) => weight === "2fr")) {
    boardElement.classList.add("has-wrapped-suggestion");
    boardElement.style.gridTemplateRows = boardRowWeights.join(" ");
  }
  boardElement.setAttribute("data-testid", "board");
  boardElement.style.setProperty("--row-count", String(board.length));

  board.forEach((row, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = "row";
    if (session.config.profileId === "zh-TW" && rowIndex < 4) rowElement.classList.add("suggestion-row");
    if (isDynamicEnglishSuggestionRow(rowIndex)) rowElement.classList.add("dynamic-suggestion-row");
    const visualColumns = visualColumnCountForRow(row, rowIndex);
    rowElement.dataset.visualColumns = String(visualColumns);
    rowElement.style.gridTemplateColumns = `repeat(${visualColumns}, minmax(0, 1fr))`;
    const renderedRow = [];

    row.forEach((candidate, cellIndex) => {
      const tile = document.createElement("div");
      tile.className = tileClass(candidate, false, false, false);
      if (session.config.suggestionWrapLabels?.[candidate.label]) tile.classList.add("wrapped-word");
      tile.setAttribute("data-label", candidate.label);
      tile.setAttribute("data-action", candidate.action);
      const columnSpan = Math.max(1, Number(candidate.columnSpan) || 1);
      tile.dataset.columnSpan = String(columnSpan);
      if (columnSpan > 1) tile.style.gridColumn = `span ${columnSpan}`;
      if (isFunctionTile(candidate)) {
        const functionName = session.config.profileId === "zh-TW" ? "功能鍵" : "function key";
        tile.setAttribute("data-control-label", session.config.profileId === "zh-TW" ? "功能" : "KEY");
        tile.setAttribute("data-control-icon", FunctionTileIcons[candidate.action] ?? "◆");
        tile.setAttribute("aria-label", `${functionName}：${candidate.label}`);
      }
      if (candidate.action === TileAction.Noop) {
        tile.setAttribute("role", "presentation");
        tile.setAttribute("aria-hidden", "true");
      } else {
        tile.setAttribute("role", "button");
        if (!tile.hasAttribute("aria-label")) tile.setAttribute("aria-label", candidate.label);
      }

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
    renderedRows.push(rowElement);
    boardElement.append(rowElement);
  });

  shell.append(topPanel, boardElement);
  app.append(shell);
  observeBoardForLabelFit(boardElement);
  scheduleTileLabelFit();
  renderedBoardKey = boardKey;
  renderedMessage = session.message;
  updateScanPresentation(board);
  scrollMessageToEnd(message);
  emitRenderState(board);
}

function updateScanPresentation(board) {
  const scanner = session.scannerState;
  const blockRows = activeBlockRows(scanner, board);
  const selectedBlockRows = selectedBlockContextRows(scanner, board);
  document.body.classList.toggle("scan-stopped", scanner.stage === ScanStage.Stopped);
  const nextProgressTargetKey = progressTargetKeyForScanner(scanner, reviewHoldActive);
  if (renderedPhaseElement) {
    renderedPhaseElement.textContent = statusPhaseLabel(scanner);
    renderedPhaseElement.dataset.scanPhase = statusPhaseCode(scanner);
  }
  if (renderedVoiceElement) {
    renderedVoiceElement.textContent = voiceStatusLabel();
  }
  updateCameraStatusPresentation();

  const previousActiveTiles = currentActiveTiles;
  const previousProgressFills = currentProgressFills;
  const nextActiveTiles = activeRenderedTilesForScanner(scanner);
  const nextProgressFills = nextActiveTiles.map((rendered) => rendered.progressFill);
  const progressDirection = uiConfig.verticalGroupProgress && [
    ScanStage.Blocks,
    ScanStage.BlockSelected,
    ScanStage.Rows,
    ScanStage.RowSelected
  ].includes(scanner.stage) ? "down" : "right";
  for (const progressFill of nextProgressFills) {
    progressFill.dataset.progressDirection = progressDirection;
  }
  const deferredTiles = renderedTiles.filter((rendered) => rendered.candidate.scanDeferred === true);
  const tilesToUpdate = [...new Set([...previousActiveTiles, ...nextActiveTiles, ...deferredTiles])];

  for (const [rowIndex, rowElement] of renderedRows.entries()) {
    const stoppedRows = scanner.stage === ScanStage.Stopped && session.config.scanMode === ScanMode.BlockRowColumn
      ? scanRowBlocks(board.length, (row) => selectableCount(board[row]), session.config.scanBlockCount)[0] ?? [0]
      : [0];
    const stoppedFirstTarget = scanner.stage === ScanStage.Stopped && stoppedRows.includes(rowIndex);
    const reviewBlock = reviewHoldActive && blockRows.includes(rowIndex);
    rowElement.classList.toggle(
      "review-hold-row",
      stoppedFirstTarget || reviewBlock || (
        reviewHoldActive && scanner.stage === ScanStage.Rows && scanner.rowIndex === rowIndex
      )
    );
    rowElement.classList.toggle("selected-block-row", selectedBlockRows.includes(rowIndex));
  }

  for (const rendered of tilesToUpdate) {
    const candidate = rendered.candidate;
    const deferredThisPass = candidate.scanDeferred === true && scanner.passIndex === 1;
    const activeBlock =
      (
        scanner.stage === ScanStage.Blocks ||
        scanner.stage === ScanStage.BlockSelected ||
        scanner.stage === ScanStage.SuggestionPages
      ) &&
      blockRows.includes(rendered.rowIndex);
    const activeRow =
      (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) &&
      scanner.rowIndex === rendered.rowIndex;
    const activeCell =
      (scanner.stage === ScanStage.FirstCell || scanner.stage === ScanStage.Cells) &&
      scanner.rowIndex === rendered.rowIndex &&
      scanner.cellIndex === rendered.cellIndex;
    const reviewHold = reviewHoldActive && (activeBlock || activeRow || activeCell);
    const cameraHold = cameraHoldActive && (activeBlock || activeRow || activeCell);
    const nextClassName = tileClass(candidate, activeRow, activeCell, reviewHold, cameraHold, activeBlock);
    if (rendered.element.className !== nextClassName) {
      rendered.element.className = nextClassName;
    }
    if (deferredThisPass) {
      rendered.element.setAttribute(
        "aria-description",
        uiText("Available on the second scan pass", "第二輪掃描時可選")
      );
    } else {
      rendered.element.removeAttribute("aria-description");
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
  if (scanner.stage === ScanStage.Stopped) return [];
  if (scanner.stage === ScanStage.SuggestionPages) {
    return renderedTileGrid.slice(0, 4).flat();
  }
  if (scanner.stage === ScanStage.Blocks || scanner.stage === ScanStage.BlockSelected) {
    const board = visibleBoard(session);
    return activeBlockRows(scanner, board).flatMap((rowIndex) => renderedTileGrid[rowIndex] ?? []);
  }
  const row = renderedTileGrid[scanner.rowIndex] ?? [];
  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    return row;
  }
  const renderedTile = row[scanner.cellIndex];
  return renderedTile ? [renderedTile] : [];
}

function progressTargetKeyForScanner(scanner, isReviewHold) {
  if (scanner.stage === ScanStage.Stopped) return "stopped";
  const prefix = isReviewHold ? "review" : "scan";
  if (scanner.stage === ScanStage.SuggestionPages) {
    return `${prefix}:${scanner.stage}:${session.suggestionPage}`;
  }
  if (scanner.stage === ScanStage.Blocks || scanner.stage === ScanStage.BlockSelected) {
    return `${prefix}:${scanner.stage}:${scanner.blockIndex}`;
  }
  if (scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected) {
    return `${prefix}:${scanner.stage}:${scanner.rowIndex}`;
  }
  return `${prefix}:${scanner.stage}:${scanner.rowIndex}:${scanner.cellIndex}`;
}

function activeBlockRows(scanner, board) {
  if (scanner.stage === ScanStage.SuggestionPages) {
    return board.slice(0, 4).map((_row, rowIndex) => rowIndex);
  }
  if (scanner.stage !== ScanStage.Blocks && scanner.stage !== ScanStage.BlockSelected) return [];
  const blocks = scanBlocksForPresentation(scanner, board);
  return blocks[scanner.blockIndex] ?? [];
}

function selectedBlockContextRows(scanner, board) {
  const isRowScanning = scanner.stage === ScanStage.Rows || scanner.stage === ScanStage.RowSelected;
  if (session.config.scanMode !== ScanMode.BlockRowColumn || !isRowScanning) return [];
  if (scanner.suggestionPageRowsActive) {
    return board.slice(0, 4).map((_row, rowIndex) => rowIndex);
  }
  if (Array.isArray(scanner.selectedBlockRows)) return scanner.selectedBlockRows;
  const blocks = scanBlocksForPresentation(scanner, board);
  return blocks[scanner.blockIndex] ?? [];
}

function scanBlocksForPresentation(scanner, board) {
  const selectableCellIndicesForRow = session.config.deferUnsupportedZhuyinOnFirstPass
    ? (rowIndex, passIndex) => scanSelectableCellIndices(
      board[rowIndex],
      passIndex,
      session.config.scanPassLimit
    )
    : undefined;
  return scanRowBlocksForPass(
    board.length,
    (row) => selectableCount(board[row]),
    session.config.scanBlockCount,
    scanner.passIndex,
    selectableCellIndicesForRow
  );
}

function resetProgressFills(progressFills) {
  const uniqueProgressFills = [...new Set(progressFills)].filter((fill) => fill?.isConnected);
  for (const progressFill of uniqueProgressFills) {
    progressFill.style.transitionDuration = "0ms";
    progressFill.style.transform = progressTransform(progressFill, 0);
  }
  forceProgressLayout(uniqueProgressFills);
}

function invalidateRenderedBoard() {
  renderedBoardKey = "";
  renderedMessage = "";
  renderedTiles = [];
  renderedTileGrid = [];
  renderedRows = [];
  renderedPhaseElement = null;
  renderedVoiceElement = null;
  renderedCameraStatusElement = null;
  currentActiveTiles = [];
  currentProgressFills = [];
  progressTargetKey = "";
}

function boardSignature(board) {
  const columns = session.config.columns;
  const cached = boardSignatureCache.get(board);
  if (cached?.columns === columns) return cached.signature;

  const signature = [
    columns,
    ...board.map((row) => row
      .map((candidate) => [
        candidate.label,
        candidate.output,
        candidate.action,
        candidate.replaceLength ?? "",
        candidate.columnSpan ?? 1,
        candidate.scanDeferred === true ? "deferred" : ""
      ].join("\u001f"))
      .join("\u001e"))
  ].join("\u001d");
  boardSignatureCache.set(board, { columns, signature });
  return signature;
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
      scanMode: session.config.scanMode,
      blockIndex: session.scannerState.blockIndex,
      rowIndex: session.scannerState.rowIndex,
      cellIndex: session.scannerState.cellIndex,
      rows: board.map((row) => row.map((candidate) => candidate.label))
    }));
  } catch {
    // Test-only bridge; rendering should never depend on it.
  }
}

function tileClass(candidate, activeRow, activeCell, reviewHold = false, cameraHold = false, activeBlock = false) {
  const classes = ["tile"];
  classes.push(`action-${candidate.action}`);
  if (candidate.action !== TileAction.Append) classes.push("command");
  if (isFunctionTile(candidate)) classes.push("function-key");
  if (candidate.action === TileAction.Noop) classes.push("noop");
  if (session.config.suggestionWrapLabels?.[candidate.label]) classes.push("wrapped-word");
  if (candidate.action === TileAction.CommitCandidate && candidate.replaceLength > 0) classes.push("replacement");
  if (candidate.toneFallback === true) classes.push("tone-fallback");
  if (candidate.scanDeferred === true && session.scannerState.passIndex === 1) {
    classes.push("scan-deferred");
  }
  if (activeBlock) classes.push("active-block", "is-current");
  if (activeRow) classes.push("active-row", "is-current");
  if (activeCell) classes.push("active-cell", "is-current");
  if (reviewHold) classes.push("review-hold");
  if (cameraHold) classes.push("camera-hold");
  return classes.join(" ");
}

function isFunctionTile(candidate) {
  return FunctionTileActions.has(candidate.action);
}

function isDynamicEnglishSuggestionRow(rowIndex) {
  const hasEnglishSuggestions = session.config.profileId === "en-US" ||
    (session.config.profileId === "zh-TW" && session.activeCategory === "english");
  if (!hasEnglishSuggestions) return false;
  return rowIndex >= 0 && rowIndex < 2;
}

function visualColumnCountForRow(row, rowIndex) {
  const isEmbeddedEnglishInput = session.config.profileId === "zh-TW" &&
    session.activeCategory === "english";
  if (isEmbeddedEnglishInput) return LanguageProfiles["en-US"].columns;
  if (isDynamicEnglishSuggestionRow(rowIndex)) return session.config.columns;
  if (session.config.profileId !== "zh-TW") return session.config.columns;
  return Math.max(1, row.length);
}

window.addEventListener("pagehide", saveSessionDraft);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveSessionDraft();
});

function observeBoardForLabelFit(boardElement) {
  if (observedBoardElement === boardElement) return;
  tileLabelResizeObserver?.disconnect();
  observedBoardElement = boardElement;
  tileLabelResizeObserver?.observe(boardElement);
}

function scheduleTileLabelFit() {
  window.cancelAnimationFrame(tileLabelFitFrame);
  tileLabelFitFrame = window.requestAnimationFrame(fitTileLabels);
}

function fitTileLabels() {
  tileLabelFitFrame = 0;
  if (updateDynamicSuggestionSpans()) return;

  const labels = observedBoardElement?.querySelectorAll(".tile-label") ?? [];
  for (const label of labels) label.style.fontSize = "";

  for (const label of labels) {
    const tile = label.closest(".tile");
    if (!tile || label.clientWidth <= 0 || label.clientHeight <= 0 || tile.clientHeight <= 0) continue;

    const maximumPx = Number.parseFloat(getComputedStyle(tile).fontSize);
    if (!Number.isFinite(maximumPx) || tileLabelFits(label)) continue;

    const lowerLimitPx = 10;
    let lowerPx = lowerLimitPx;
    let upperPx = maximumPx;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidatePx = (lowerPx + upperPx) / 2;
      label.style.fontSize = `${candidatePx}px`;
      if (tileLabelFits(label)) lowerPx = candidatePx;
      else upperPx = candidatePx;
    }
    label.style.fontSize = `${Math.floor(lowerPx * 10) / 10}px`;
  }
}

function updateDynamicSuggestionSpans() {
  const rowElements = [...(observedBoardElement?.querySelectorAll(".dynamic-suggestion-row") ?? [])];
  const rowElement = rowElements[0];
  if (!rowElement) return false;
  if (![ScanStage.Blocks, ScanStage.Rows].includes(session.scannerState.stage)) return null;

  const columns = Math.max(1, Number.parseInt(rowElement.dataset.visualColumns ?? "", 10) || 1);
  const rowStyle = getComputedStyle(rowElement);
  const gapPx = Number.parseFloat(rowStyle.columnGap) || 0;
  const baseColumnWidth = (rowElement.clientWidth - gapPx * (columns - 1)) / columns;
  const sampleTile = rowElement.querySelector(".tile:not(.noop)");
  if (!sampleTile || baseColumnWidth <= 0) return false;

  const unspannedConfig = createBoardConfig({
    ...session.config,
    suggestionColumnSpans: Object.create(null)
  });
  const sourceRows = boardRows(
    unspannedConfig,
    session.message,
    session.messageHistory.length > 0,
    session
  ).slice(0, rowElements.length);
  const nextSpans = Object.create(null);
  const nextWrapLabels = Object.create(null);

  for (const candidate of sourceRows.flat()) {
    if (!isDynamicWordSuggestion(candidate) || !candidate.label) continue;
    const requiredWidth = measureTileLabelWidth(candidate.label, sampleTile);
    let span = columns;
    for (let candidateSpan = 1; candidateSpan <= columns; candidateSpan += 1) {
      const availableWidth = baseColumnWidth * candidateSpan + gapPx * (candidateSpan - 1);
      if (requiredWidth <= availableWidth + 0.5) {
        span = candidateSpan;
        break;
      }
    }
    nextSpans[candidate.label] = span;
    const fullRowWidth = baseColumnWidth * columns + gapPx * (columns - 1);
    if (requiredWidth > fullRowWidth + 0.5) nextWrapLabels[candidate.label] = true;
  }

  if (
    sameSuggestionSpans(session.config.suggestionColumnSpans, nextSpans) &&
    sameSuggestionSpans(session.config.suggestionWrapLabels, nextWrapLabels)
  ) return false;
  session = {
    ...session,
    config: createBoardConfig({
      ...session.config,
      suggestionColumnSpans: nextSpans,
      suggestionWrapLabels: nextWrapLabels
    })
  };
  cancelScheduledScan();
  render();
  resetClock();
  scheduleScan();
  announceCurrentScanTarget();
  return true;
}

function measureTileLabelWidth(text, sampleTile) {
  const tileStyle = getComputedStyle(sampleTile);
  const sampleLabel = sampleTile.querySelector(".tile-label");
  const labelStyle = sampleLabel ? getComputedStyle(sampleLabel) : tileStyle;
  const probe = document.createElement("span");
  probe.className = "tile-label tile-label-measure-probe";
  probe.textContent = text;
  probe.style.fontFamily = tileStyle.fontFamily;
  probe.style.fontSize = tileStyle.fontSize;
  probe.style.fontStyle = tileStyle.fontStyle;
  probe.style.fontWeight = tileStyle.fontWeight;
  probe.style.letterSpacing = tileStyle.letterSpacing;
  probe.style.lineHeight = labelStyle.lineHeight;
  probe.style.padding = labelStyle.padding;
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width + 2;
  probe.remove();
  return width;
}

function isDynamicWordSuggestion(candidate) {
  return candidate.action === TileAction.CommitCandidate || (
    candidate.action === TileAction.Append &&
    Array.from(String(candidate.output ?? "").trim()).length > 1
  );
}

function isRenderedWordSuggestion(tile) {
  if (tile.matches(".action-commit-candidate")) return true;
  if (!tile.matches(".action-append")) return false;
  return Array.from(String(tile.dataset.label ?? "").trim()).length > 1;
}

function sameSuggestionSpans(current, next) {
  const currentEntries = Object.entries(current ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const nextEntries = Object.entries(next).sort(([left], [right]) => left.localeCompare(right));
  return currentEntries.length === nextEntries.length && currentEntries.every(
    ([label, span], index) => label === nextEntries[index][0] && Number(span) === nextEntries[index][1]
  );
}

function tileLabelFits(label) {
  if (label.scrollWidth > label.clientWidth || label.scrollHeight > label.clientHeight) return false;
  const range = document.createRange();
  range.selectNodeContents(label);
  const lineRects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
  if (lineRects.length < 2) return true;
  return lineRects.every((rect) => Math.abs(rect.top - lineRects[0].top) <= 1);
}

window.addEventListener("resize", scheduleTileLabelFit);

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

function phaseLabel(scanner) {
  const zhTw = session.config.profileId === "zh-TW";
  const passLimit = scanner.stage === ScanStage.SuggestionPages
    ? SuggestionPageScanPassLimit
    : demoMode.scanPassLimit(session.config.scanPassLimit);
  const passSuffix = passLimit === 0
    ? (zhTw ? " · 持續" : " · Continuous")
    : (zhTw
      ? ` · 第 ${Math.max(1, scanner.passIndex)} / ${passLimit} 次`
      : ` · Pass ${Math.max(1, scanner.passIndex)} / ${passLimit}`);
  switch (scanner.stage) {
    case ScanStage.SuggestionPages:
      return zhTw
        ? `掃描候選頁${passSuffix}`
        : `Scanning suggestion pages${passSuffix}`;
    case ScanStage.Blocks:
      if (scanner.returningToBlocks) {
        return zhTw ? `返回選區${passSuffix}` : `Back to blocks${passSuffix}`;
      }
      return zhTw ? `選區中${passSuffix}` : `Scanning blocks${passSuffix}`;
    case ScanStage.BlockSelected:
      return zhTw ? "選區暫停" : "Block pause";
    case ScanStage.Rows:
      if (scanner.returningToRows) {
        return zhTw ? `返回選列${passSuffix}` : `Back to rows${passSuffix}`;
      }
      return zhTw ? `選列中${passSuffix}` : `Scanning rows${passSuffix}`;
    case ScanStage.RowSelected:
      return zhTw ? "選列暫停" : "Row pause";
    case ScanStage.FirstCell:
    case ScanStage.Cells:
      return zhTw ? `選格中${passSuffix}` : `Scanning items${passSuffix}`;
    case ScanStage.Stopped:
      return zhTw ? "已停止 · 按開關" : "Stopped · Press switch";
    default:
      return "";
  }
}

function statusPhaseLabel(scanner) {
  const zhTw = session.config.profileId === "zh-TW";
  if (cameraHoldActive) return zhTw ? "眨眼確認中" : "Blink detected";
  if (reviewHoldActive) return zhTw ? "暫停確認" : "Review pause";
  return phaseLabel(scanner);
}

function statusPhaseCode(scanner) {
  if (cameraHoldActive) return "Blink";
  if (reviewHoldActive) return "Review";
  return phaseCode(scanner.stage);
}

function phaseCode(stage) {
  switch (stage) {
    case ScanStage.SuggestionPages:
      return "SuggestionPages";
    case ScanStage.Blocks:
      return "Blocks";
    case ScanStage.BlockSelected:
      return "BlockCancel";
    case ScanStage.Rows:
      return "Rows";
    case ScanStage.RowSelected:
      return "Cancel";
    case ScanStage.FirstCell:
      return "First";
    case ScanStage.Cells:
      return "Symbols";
    case ScanStage.Stopped:
      return "Stopped";
    default:
      return "";
  }
}

function voiceStatusLabel() {
  const enabled = uiConfig.rowScanVoice || uiConfig.scanVoice || uiConfig.activationVoice;
  if (session.config.profileId === "zh-TW") return enabled ? "語音：開" : "語音：關";
  return enabled ? "Voice: on" : "Voice: off";
}

function openConfig() {
  closeTextExportResult();
  configOpen = true;
  calibrationOpen = false;
  appInfoOpen = false;
  speechVoicesOpen = false;
  stopCalibrationTimer();
  reviewHoldActive = false;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  cancelScheduledScan();
  renderConfig();
}

function closeConfig({ holdFirstRow = true } = {}) {
  closeTextExportResult();
  clearPendingConfigDraft();
  applyContrastTheme(uiConfig.contrastTheme);
  configOpen = false;
  calibrationOpen = false;
  appInfoOpen = false;
  speechVoicesOpen = false;
  stopSpeechVoiceRefresh();
  stopCalibrationTimer();
  if (holdFirstRow) {
    session = {
      ...session,
      scannerState: createScannerState({ scanMode: session.config.scanMode }),
      lockedRow: null
    };
  }
  reviewHoldActive = holdFirstRow;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  render();
  resetClock();
  scheduleScan();
}

function openCalibration() {
  configOpen = true;
  calibrationOpen = true;
  appInfoOpen = false;
  reviewHoldActive = false;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  cancelScheduledScan();
  calibrationState = createCalibrationState(calibrationState.inputClass);
  renderCalibration();
}

function closeCalibration() {
  calibrationOpen = false;
  appInfoOpen = false;
  stopCalibrationTimer();
  renderConfig();
}

function openAppInfo() {
  configOpen = true;
  calibrationOpen = false;
  appInfoOpen = true;
  stopCalibrationTimer();
  cancelScheduledScan();
  renderAppInfo();
}

function closeAppInfo() {
  appInfoOpen = false;
  renderConfig();
}

function navigateBackWithinApp() {
  if (demoMode.isActive()) {
    demoMode.stop();
    return true;
  }
  if (textExportDialogOpen) {
    closeTextExportResult();
    return true;
  }
  if (calibrationOpen) {
    closeCalibration();
    return true;
  }
  if (speechVoicesOpen) {
    closeSpeechVoiceSettings();
    return true;
  }
  if (appInfoOpen) {
    closeAppInfo();
    return true;
  }
  if (configOpen) {
    closeConfig();
    return true;
  }
  return false;
}

function currentAppPage() {
  if (textExportDialogOpen) return "text-export-result";
  if (calibrationOpen) return "calibration";
  if (speechVoicesOpen) return "speech-voices";
  if (appInfoOpen) return "app-info";
  if (configOpen) return "config";
  return "board";
}

function loadAppInfo() {
  const fallback = {
    appName: "SayToMe AAC",
    versionName: "Web development build",
    versionCode: "Not applicable"
  };
  try {
    const json = globalThis.ShineAacAndroid?.getAppInfoJson?.();
    if (typeof json !== "string" || json.length === 0) return fallback;
    return { ...fallback, ...JSON.parse(json) };
  } catch {
    return fallback;
  }
}

function openExternalUrl(url) {
  if (typeof globalThis.ShineAacAndroid?.openExternalUrl === "function") {
    globalThis.ShineAacAndroid.openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderAppInfo() {
  invalidateRenderedBoard();
  app.innerHTML = "";
  const info = loadAppInfo();
  const backdrop = document.createElement("div");
  backdrop.className = "config-backdrop";
  backdrop.addEventListener("click", closeAppInfo);

  const panel = document.createElement("section");
  panel.className = "config-panel info-panel";
  panel.dataset.testid = "app-info";
  panel.addEventListener("click", (event) => event.stopPropagation());
  panel.innerHTML = `
    <header class="info-header">
      <h1>${escapeHtml(info.appName)}</h1>
      <strong>${uiText("Version", "版本")} ${escapeHtml(String(info.versionName))} (${escapeHtml(String(info.versionCode))})</strong>
      <p>${uiText("An augmentative and alternative communication app for composing and speaking messages with touch, switch, or camera input.", "使用觸控、開關或相機輸入來組合並朗讀訊息的輔助溝通程式。")}</p>
    </header>
    <section class="info-section" aria-labelledby="info-data-heading">
      <h2 id="info-data-heading">${uiText("Your data", "您的資料")}</h2>
      <dl class="info-list">
        <div><dt>${uiText("Communication data", "溝通資料")}</dt><dd>${uiText("Stored locally on this device", "只儲存在這部裝置")}</dd></div>
        <div><dt>${uiText("Text history", "文字記錄")}</dt><dd>${uiText("Saved locally; oldest entries are recycled at storage limits", "儲存在本機；空間達上限時會移除最舊記錄")}</dd></div>
        <div><dt>${uiText("Export", "匯出")}</dt><dd>${uiText("Saved only when requested; after saving, the app shows the filename and a direct open button", "只在使用者要求時儲存；完成後顯示檔名及直接開啟按鈕")}</dd></div>
        <div><dt>${uiText("Backup", "備份")}</dt><dd>${uiText("Android cloud and device-transfer backup disabled", "已停用 Android 雲端及裝置轉移備份")}</dd></div>
        <div><dt>${uiText("Camera", "相機")}</dt><dd>${uiText("Processed on device; frames are not stored by SayToMe AAC", "影像只在裝置上處理；本程式不會儲存畫面")}</dd></div>
        <div><dt>${uiText("Core communication", "基本溝通")}</dt><dd>${uiText("Works offline after installation", "安裝後可離線使用")}</dd></div>
      </dl>
    </section>
    <section class="info-section" aria-labelledby="info-project-heading">
      <h2 id="info-project-heading">${uiText("Help and information", "協助與資訊")}</h2>
      <div class="info-links">
        <button class="secondary-button" type="button" data-url="https://poi890poi.github.io/shine_aac/privacy-policy/">${uiText("Privacy policy", "隱私權政策")}</button>
        <button class="secondary-button" type="button" data-url="https://poi890poi.github.io/shine_aac/support/">${uiText("Support", "使用協助")}</button>
        <button class="secondary-button" type="button" data-url="https://github.com/poi890poi/shine_aac">${uiText("Source code", "原始碼")}</button>
      </div>
    </section>
    <div class="config-actions info-actions">
      <button class="primary-button" type="button" data-action="back">${uiText("Back", "返回")}</button>
    </div>
  `;
  panel.addEventListener("click", (event) => {
    const url = event.target?.dataset?.url;
    if (url) openExternalUrl(url);
    if (event.target?.dataset?.action === "back") closeAppInfo();
  });
  backdrop.append(panel);
  app.append(backdrop);
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
  title.textContent = uiText("Configuration", "設定");

  const form = document.createElement("form");
  const exportButtonLabel = session.config.profileId === "zh-TW" ? "匯出文字記錄" : "Export text";
  form.innerHTML = `
    <div class="config-grid">
      <label class="field wide">${uiText("Language", "語言")}
        <select name="profileId">
          ${profileOptionsHtml(session.config.profileId)}
        </select>
      </label>
      <label class="field">${uiText("Maximum symbol columns", "每列最多格數")}
        <input name="columns" type="number" min="2" max="8" step="1" value="${session.config.columns}">
      </label>
      <label class="field">${uiText("Scanning method", "掃描方式")}
        <select name="scanMode">
          ${scanModeOptionsHtml(session.config.scanMode)}
        </select>
      </label>
      <label class="field">${uiText("Scan preset", "掃描速度預設")}
        <select name="scanTimingPreset">
          ${scanTimingPresetOptionsHtml(session.config)}
        </select>
      </label>
      <label class="field">${uiText("Switch speed ms", "掃描間隔（毫秒）")}
        <input name="scanIntervalMs" type="number" min="300" max="5000" step="50" value="${session.config.scanIntervalMs}">
      </label>
      <label class="field">${uiText("Row cancel pause ms", "選列取消等待（毫秒）")}
        <input name="transitionPauseMs" type="number" min="0" max="4000" step="50" value="${session.config.transitionPauseMs}">
      </label>
      <label class="field">${uiText("First row / symbol hold ms", "第一列／第一格停留（毫秒）")}
        <input name="firstCellPauseMs" type="number" min="300" max="6000" step="50" value="${session.config.firstCellPauseMs}">
      </label>
      <label class="field">${uiText("Latency compensation ms", "輸入延遲補償（毫秒）")}
        <input name="inputLatencyCompensationMs" type="number" min="0" max="1200" step="25" value="${session.config.inputLatencyCompensationMs}">
      </label>
      <label class="field">${uiText("Scan attempts before leaving", "離開前掃描次數")}
        <select name="scanPassLimit">
          ${scanPassLimitOptionsHtml(session.config.scanPassLimit)}
        </select>
      </label>
      <label class="field check-field">
        <input name="autoScanSuggestionPages" type="checkbox" ${session.config.autoScanSuggestionPages ? "checked" : ""}>
        ${uiText("Auto-scan More pages", "自動掃描「更多」頁面")}
      </label>
      <label class="field check-field">
        <input name="deferUnsupportedZhuyinOnFirstPass" type="checkbox" ${session.config.deferUnsupportedZhuyinOnFirstPass ? "checked" : ""}>
        ${uiText("Defer unsupported Zhuyin until pass 2", "第一輪略過無有效字音的注音")}
      </label>
      <label class="field check-field">
        <input name="rowScanVoice" type="checkbox" ${uiConfig.rowScanVoice ? "checked" : ""}>
        ${uiText("Voice while row scanning", "選列時朗讀")}
      </label>
      <label class="field check-field">
        <input name="scanVoice" type="checkbox" ${uiConfig.scanVoice ? "checked" : ""}>
        ${uiText("Voice while symbol scanning", "選格時朗讀")}
      </label>
      <label class="field check-field">
        <input name="activationVoice" type="checkbox" ${uiConfig.activationVoice ? "checked" : ""}>
        ${uiText("Voice on activation", "選定後朗讀")}
      </label>
      ${speechVoiceSettingHtml(uiConfig.speechVoiceName)}
      <label class="field check-field">
        <input name="restartScanFromTop" type="checkbox" ${uiConfig.restartScanFromTop ? "checked" : ""}>
        ${uiText("Restart scan at top after input", "輸入後從第一列重新開始")}
      </label>
      <label class="field check-field">
        <input name="verticalGroupProgress" type="checkbox" ${uiConfig.verticalGroupProgress ? "checked" : ""}>
        ${uiText("Vertical block / row progress", "區塊／列使用垂直進度")}
      </label>
      <label class="field">${uiText("Switch input", "開關輸入")}
        <select name="switchInputProfile">
          ${switchInputProfileOptionsHtml(uiConfig.switchInputProfile)}
        </select>
      </label>
      <label class="field">${uiText("Display contrast", "顯示對比")}
        <select name="contrastTheme">
          ${contrastThemeOptionsHtml(uiConfig.contrastTheme)}
        </select>
      </label>
      <div class="field">
        <button class="secondary-button" type="button" data-action="camera-calibration">${uiText("Camera setup", "相機設定")}</button>
      </div>
      ${suggestionDictionaryFieldHtml(session.config)}
      <label class="field wide">${uiText("Board symbols", "版面內容")}
        <textarea name="symbols">${escapeHtml(serializeSymbols(session.config.symbols))}</textarea>
      </label>
    </div>
    <div class="config-actions">
      <button class="secondary-button" type="button" data-action="app-info">${uiText("App info", "關於本程式")}</button>
      <button class="secondary-button" type="button" data-action="reset">${uiText("Reset", "恢復預設")}</button>
      <button class="secondary-button" type="button" data-action="calibrate">${uiText("Input test", "輸入測試")}</button>
      <button class="secondary-button" type="button" data-action="export-text">${exportButtonLabel}</button>
      <button class="secondary-button" type="button" data-action="cancel">${uiText("Cancel", "取消")}</button>
      <button class="primary-button" type="submit">${uiText("Save", "儲存")}</button>
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
    form.elements.scanMode.value = profile.scanMode;
    form.elements.scanPassLimit.value = String(profile.scanPassLimit);
    form.elements.autoScanSuggestionPages.checked = profile.autoScanSuggestionPages;
    form.elements.deferUnsupportedZhuyinOnFirstPass.checked = profile.deferUnsupportedZhuyinOnFirstPass;
    form.elements.scanTimingPreset.value = "default";
    form.querySelector("[data-suggestion-dictionary-field]").hidden = profile.id === "zh-TW";
    form.elements.suggestionDictionary.value = serializeDictionary(profile.suggestionDictionary);
    form.elements.symbols.value = serializeSymbols(profile.symbols);
  });

  form.elements.contrastTheme.addEventListener("change", () => {
    applyContrastTheme(form.elements.contrastTheme.value);
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
      form.elements.scanTimingPreset.add(new Option(uiText("Custom", "自訂"), "custom"));
    }
    form.elements.scanTimingPreset.value = "custom";
  };
  timingFields.forEach((field) => field.addEventListener("input", syncTimingPresetSelection));

  form.addEventListener("click", (event) => {
    const action = event.target?.dataset?.action;
    if (action === "cancel") closeConfig();
    if (action === "app-info") openAppInfo();
    if (action === "calibrate") openCalibration();
    if (action === "camera-calibration") {
      savePendingConfigDraft(form);
      openCameraSwitchCalibration(String(form.elements.profileId.value || session.config.profileId || "en-US"));
    }
    if (action === "speech-voices") openSpeechVoiceSettings();
    if (action === "export-text") {
      exportTextHistory();
    }
    if (action === "reset") {
      const profileId = String(form.elements.profileId.value || session.config.profileId || "en-US");
      const config = createBoardConfig({ profileId });
      closeTextHistoryLine("reset", "config");
      saveConfig(config);
      uiConfig = normalizeUiConfig(defaultUiConfig);
      saveUiConfig(uiStorageKey, uiConfig);
      session = createSession({ config });
      clearSessionDraft();
      closeConfig({ holdFirstRow: true });
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
      scanMode: String(data.get("scanMode") ?? ScanMode.RowColumn),
      scanPassLimit: normalizeStoredScanPassLimit(data.get("scanPassLimit"), 2),
      autoScanSuggestionPages: data.get("autoScanSuggestionPages") === "on",
      deferUnsupportedZhuyinOnFirstPass: data.get("deferUnsupportedZhuyinOnFirstPass") === "on",
      suggestionDictionary: profile.id === "zh-TW"
        ? profile.suggestionDictionary
        : parseDictionary(String(data.get("suggestionDictionary") ?? "")),
      symbols: parseSymbols(String(data.get("symbols") ?? ""))
    });
    closeTextHistoryLine("reset", "config");
    saveConfig(config);
    uiConfig = normalizeUiConfig({
      rowScanVoice: data.get("rowScanVoice") === "on",
      scanVoice: data.get("scanVoice") === "on",
      activationVoice: data.get("activationVoice") === "on",
      speechVoiceName: String(data.get("speechVoiceName") ?? uiConfig.speechVoiceName ?? ""),
      restartScanFromTop: data.get("restartScanFromTop") === "on",
      verticalGroupProgress: data.get("verticalGroupProgress") === "on",
      switchInputProfile: String(data.get("switchInputProfile") ?? "hardware-buttons"),
      contrastTheme: String(data.get("contrastTheme") ?? uiConfig.contrastTheme)
    });
    applyContrastTheme(uiConfig.contrastTheme);
    saveUiConfig(uiStorageKey, uiConfig);
    session = createSession({ config });
    clearSessionDraft();
    closeConfig({ holdFirstRow: true });
  });

  if (pendingConfigDraftFields) {
    applyPendingConfigDraftToForm(form, pendingConfigDraftFields);
    pendingConfigDraftFields = null;
    clearPendingConfigDraft();
  }

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
    disabledBySettings: (isHardwareInput(source) && !hardwareInputEnabled()) ||
      (isCameraInput(source) && !cameraInputEnabled())
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
  title.textContent = uiText("Input Test", "輸入測試");

  const body = document.createElement("div");
  body.className = "calibration-body";
  body.innerHTML = `
    <section class="calibration-intro">
      <strong>${uiText("Communication is paused.", "溝通功能已暫停。")}</strong>
      <span>${uiText("Use the same input the person will use, then check whether each intentional action becomes one activation.", "請使用本人實際會用的輸入方式，確認每次有意操作只產生一次啟動。")}</span>
    </section>
    <div class="calibration-mode" role="group" aria-label="${uiText("Input source type", "輸入來源類型")}">
      <button class="mode-button ${calibrationState.inputClass === "reliable" ? "selected" : ""}" type="button" data-calibration-class="reliable">
        ${uiText("Button or switch", "按鍵或開關")}
      </button>
      <button class="mode-button ${calibrationState.inputClass === "unreliable" ? "selected" : ""}" type="button" data-calibration-class="unreliable">
        ${uiText("Sensor", "感測器")}
      </button>
    </div>
    ${calibrationState.inputClass === "reliable" ? reliableCalibrationHtml() : unreliableCalibrationHtml()}
    <details class="calibration-details">
      <summary>${uiText("Event details", "事件詳細資料")}</summary>
      ${calibrationStatsHtml()}
      ${calibrationEventLogHtml()}
    </details>
  `;

  body.addEventListener("click", handleCalibrationClick);

  const actions = document.createElement("div");
  actions.className = "config-actions";
  actions.innerHTML = `
    <button class="secondary-button" type="button" data-calibration-action="clear">${uiText("Clear test", "清除測試")}</button>
    <button class="primary-button" type="button" data-calibration-action="back">${uiText("Back to config", "返回設定")}</button>
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
    ? uiText("Good", "良好")
    : disabled
      ? uiText("Disabled", "未啟用")
      : duplicates > 0
        ? uiText("Needs adjustment", "需要調整")
        : uiText("Waiting", "等待輸入");
  const last = calibrationState.events.at(-1);
  const lastDetected = last && performance.now() - last.at < 1200;
  const guidance = ready
    ? uiText("This source is behaving like a reliable switch.", "這個來源的表現符合可靠開關。")
    : disabled
      ? uiText("Choose a switch input profile that includes this source.", "請選擇包含這個來源的開關輸入設定。")
      : duplicates > 0
        ? uiText("The app saw repeated activations too close together. Increase debounce in the adapter or try sensor testing.", "程式收到間隔過短的重複啟動。請增加防彈跳時間，或改用感測器測試。")
        : uiText("Press the input five times at a comfortable pace.", "請用舒適的速度操作五次。");
  return `
    <section class="calibration-section" data-testid="calibration-reliable">
      <div class="calibration-steps">
        <div class="calibration-step current">
          <span>1</span>
          <strong>${uiText("Press input", "操作輸入")}</strong>
          <small>${uiText("Use touch, the shutter key, or an external switch.", "可使用觸控、快門鍵或外接開關。")}</small>
        </div>
        <div class="calibration-step">
          <span>2</span>
          <strong>${uiText("Repeat five times", "重複五次")}</strong>
          <small>${uiText("Each press should count once.", "每次操作應只計算一次。")}</small>
        </div>
      </div>
      <div class="calibration-live ${lastDetected ? "detected" : ""}">
        <strong>${lastDetected ? uiText("Detected", "已偵測") : uiText("Waiting for input", "等待輸入")}</strong>
        <span>${escapeHtml(last ? inputSourceLabel(last.source) : uiText("No source yet", "尚無輸入來源"))}</span>
      </div>
      <div class="calibration-status ${ready ? "good" : duplicates > 0 || disabled ? "warn" : ""}">
        <strong>${status}</strong>
        <span>${uiText(`${cleanCount} / 5 clean presses`, `${cleanCount}／5 次有效操作`)}</span>
      </div>
      <div class="calibration-meter" aria-label="${uiText("Reliable input progress", "可靠輸入進度")}">
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
    ? uiText(`${restEvents} at rest`, `休息時 ${restEvents} 次`)
    : calibrationState.rest.running
      ? `${Math.ceil(restRemainingMs / 1000)}s`
      : uiText("Quiet", "安靜");
  const trialStatus = trials.index >= trials.total
    ? uiText("Done", "完成")
    : !trials.running
      ? uiText("Not started", "尚未開始")
      : trials.awaitingNext
      ? uiText("Captured", "已收到")
      : uiText(`Trial ${trials.index + 1}`, `第 ${trials.index + 1} 次`);
  const last = calibrationState.events.at(-1);
  const lastDetected = last && performance.now() - last.at < 1200;
  return `
    <section class="calibration-section" data-testid="calibration-unreliable">
      <div class="calibration-steps">
        <div class="calibration-step ${calibrationState.rest.running ? "current" : ""}">
          <span>1</span>
          <strong>${uiText("Rest watch", "休息觀察")}</strong>
          <small>${uiText("Relax without making the action. Any activation here is noise.", "放鬆且不要做指定動作；這時出現的啟動都屬於雜訊。")}</small>
        </div>
        <div class="calibration-step ${trials.running ? "current" : ""}">
          <span>2</span>
          <strong>${uiText("Action trials", "動作測試")}</strong>
          <small>${uiText("Make one deliberate action for each trial.", "每次測試只做一次有意動作。")}</small>
        </div>
      </div>
      <div class="calibration-live ${lastDetected ? "detected" : ""}">
        <strong>${lastDetected ? uiText("Detected", "已偵測") : uiText("Waiting for sensor", "等待感測器")}</strong>
        <span>${escapeHtml(last ? inputSourceLabel(last.source) : uiText("No source yet", "尚無輸入來源"))}</span>
      </div>
      <div class="calibration-cards">
        <div class="calibration-card ${restEvents === 0 ? "good" : "warn"}">
          <span>${uiText("Rest watch", "休息觀察")}</span>
          <strong>${restStatus}</strong>
        </div>
        <div class="calibration-card ${extraFires === 0 ? "good" : "warn"}">
          <span>${uiText("Trials", "動作測試")}</span>
          <strong>${capturedTrials} / ${trials.total}</strong>
        </div>
        <div class="calibration-card ${extraFires === 0 ? "" : "warn"}">
          <span>${uiText("Extra fires", "多餘啟動")}</span>
          <strong>${extraFires}</strong>
        </div>
      </div>
      <div class="calibration-actions-inline">
        <button class="secondary-button" type="button" data-calibration-action="start-rest">
          ${calibrationState.rest.running ? uiText("Restart rest", "重新觀察") : uiText("Start rest", "開始觀察")}
        </button>
        <button class="secondary-button" type="button" data-calibration-action="start-trials">${uiText("Start trials", "開始測試")}</button>
        <button class="secondary-button" type="button" data-calibration-action="missed" ${!trials.running || trials.index >= trials.total ? "disabled" : ""}>${uiText("Missed", "未偵測")}</button>
        <button class="secondary-button" type="button" data-calibration-action="next-trial" ${!trials.awaitingNext ? "disabled" : ""}>${uiText("Next trial", "下一次")}</button>
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
        <span>${uiText("Last source", "最近來源")}</span>
        <strong>${escapeHtml(last ? inputSourceLabel(last.source) : uiText("none", "無"))}</strong>
      </div>
      <div class="calibration-card">
        <span>${uiText("Main source", "主要來源")}</span>
        <strong>${escapeHtml(topSource === "none" ? uiText("none", "無") : inputSourceLabel(topSource))}</strong>
      </div>
      <div class="calibration-card">
        <span>${uiText("Total", "總數")}</span>
        <strong>${events.length}</strong>
      </div>
      <div class="calibration-card ${duplicates > 0 ? "warn" : ""}">
        <span>${uiText("Under 300ms", "少於 300 毫秒")}</span>
        <strong>${duplicates}</strong>
      </div>
      <div class="calibration-card">
        <span>${uiText("Median interval", "間隔中位數")}</span>
        <strong>${interval === null ? "-" : `${Math.round(interval)}ms`}</strong>
      </div>
      <div class="calibration-card ${last?.disabledBySettings ? "warn" : ""}">
        <span>${uiText("Hardware input", "按鍵輸入")}</span>
        <strong>${hardwareInputEnabled() ? uiText("On", "開") : uiText("Off", "關")}</strong>
      </div>
      <div class="calibration-card ${last?.disabledBySettings ? "warn" : ""}">
        <span>${uiText("Camera input", "相機輸入")}</span>
        <strong>${cameraInputEnabled() ? uiText("On", "開") : uiText("Off", "關")}</strong>
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
        <td>${escapeHtml(inputSourceLabel(event.source))}</td>
        <td>${event.deltaMs === null ? "-" : Math.round(event.deltaMs)}</td>
        <td>${event.confidence === null ? "-" : Math.round(event.confidence * 100) / 100}</td>
      </tr>
    `)
    .join("");
  return `
    <section class="calibration-log">
      <table>
        <thead>
          <tr><th>${uiText("Source", "來源")}</th><th>${uiText("Delta ms", "間隔毫秒")}</th><th>${uiText("Confidence", "可信度")}</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3">${uiText("No activations yet", "尚無啟動事件")}</td></tr>`}</tbody>
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
  if (restEvents > 0) return uiText("False activations while resting", "休息時出現誤啟動");
  if (extraFires > 0) return uiText("Multiple events from one action", "一次動作產生多個事件");
  if (capturedTrials >= calibrationState.trials.total) return uiText("Usable as a switch source", "可嘗試作為開關來源");
  return uiText("Waiting for trial activations", "等待測試動作");
}

function unreliableGuidance(restEvents, capturedTrials, extraFires) {
  if (restEvents > 0) return uiText("Raise the trigger threshold, change the gesture, or improve mounting before using this source for communication.", "使用這個來源溝通前，請提高觸發門檻、改變動作，或改善固定方式。");
  if (extraFires > 0) return uiText("Add a lockout/debounce period so one intentional action cannot select twice.", "請增加鎖定或防彈跳時間，避免一次有意動作選取兩次。");
  if (capturedTrials >= calibrationState.trials.total) return uiText("This sensor can be tried as a switch source. Re-test when posture, lighting, electrode placement, or fatigue changes.", "可以嘗試把這個感測器當作開關來源；姿勢、光線、電極位置或疲勞改變時請重新測試。");
  return uiText("Run rest watch first, then start trials. Use Missed when the person tried but no activation arrived.", "先執行休息觀察，再開始動作測試。本人已嘗試但沒有收到啟動時，請按「未偵測」。");
}

function inputSourceLabel(source) {
  const value = String(source ?? "unknown");
  if (!isZhTwUi()) return value;
  if (/touch/i.test(value)) return "觸控";
  if (/keyboard|key/i.test(value)) return "鍵盤";
  if (/volume/i.test(value)) return "音量鍵";
  if (/external|switch/i.test(value)) return "外接開關";
  if (/camera.*blink|blink/i.test(value)) return "相機長眨眼";
  if (/camera/i.test(value)) return "相機";
  if (/emg/i.test(value)) return "肌電感測器";
  if (value === "unknown") return "未知";
  return value;
}

function suggestionDictionaryFieldHtml(config) {
  return `
      <label class="field wide" data-suggestion-dictionary-field${config.profileId === "zh-TW" ? " hidden" : ""}>${uiText("Suggestion dictionary", "候選字詞庫")}
        <textarea name="suggestionDictionary">${escapeHtml(serializeDictionary(config.suggestionDictionary))}</textarea>
      </label>
  `;
}

function profileOptionsHtml(selectedProfileId) {
  return Object.values(LanguageProfiles)
    .map((profile) => {
      const selected = profile.id === selectedProfileId ? " selected" : "";
      const displayName = isZhTwUi() && profile.id === "en-US" ? "英文" : profile.displayName;
      return `<option value="${escapeHtml(profile.id)}"${selected}>${escapeHtml(displayName)}</option>`;
    })
    .join("");
}

function scanTimingPresetOptionsHtml(config) {
  const selectedPresetId = scanTimingPresetIdForConfig(config);
  const presetOptions = Object.values(ScanTimingPresets)
    .map((preset) => {
      const selected = preset.id === selectedPresetId ? " selected" : "";
      const zhTwLabels = {
        default: "一般開關",
        slower: "較慢開關",
        cameraLongBlink: "相機長眨眼",
        firstCellSupport: "第一列／格加長",
        cancelable: "可取消選列"
      };
      const label = isZhTwUi() ? zhTwLabels[preset.id] ?? preset.label : preset.label;
      return `<option value="${escapeHtml(preset.id)}"${selected}>${escapeHtml(label)}</option>`;
    });
  if (selectedPresetId === "custom") {
    presetOptions.push(`<option value="custom" selected>${uiText("Custom", "自訂")}</option>`);
  }
  return presetOptions.join("");
}

function scanPassLimitOptionsHtml(selectedLimit) {
  return [
    [1, uiText("1 attempt", "1 次")],
    [2, uiText("2 attempts (recommended)", "2 次（建議）")],
    [3, uiText("3 attempts", "3 次")],
    [0, uiText("Never leave automatically", "永不自動離開")]
  ]
    .map(([value, label]) => {
      const selected = Number(selectedLimit) === value ? " selected" : "";
      return `<option value="${value}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function scanModeOptionsHtml(selectedMode) {
  return [
    [ScanMode.RowColumn, uiText("Rows, then columns", "先列後格")],
    [ScanMode.BlockRowColumn, uiText("Blocks, then rows and columns", "區塊、列、格")]
  ]
    .map(([value, label]) => {
      const selected = value === selectedMode ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function switchInputProfileOptionsHtml(selectedProfile) {
  const options = [
    ["hardware-buttons", uiText("Buttons — keep volume control", "按鍵—保留音量控制")],
    ["volume-buttons", uiText("Buttons — volume activates", "按鍵—音量鍵啟動")],
    ["camera-long-blink", uiText("Camera long blink", "相機長眨眼")],
    ["hardware-and-camera", uiText("Buttons + camera", "按鍵＋相機")],
    ["off", uiText("Off", "關閉")]
  ];
  return options
    .map(([value, label]) => {
      const selected = value === selectedProfile ? " selected" : "";
      return `<option value="${value}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function speechVoiceSettingHtml(selectedVoiceName) {
  const state = loadAndroidSpeechVoices();
  if (!state) return "";

  return `
      <input name="speechVoiceName" type="hidden" value="${escapeHtml(selectedVoiceName)}">
      <button class="settings-row wide" type="button" data-action="speech-voices">
        <span class="settings-row-copy">
          <strong>台灣語音</strong>
          <small data-speech-voice-summary>${escapeHtml(speechVoiceSummary(state, selectedVoiceName))}</small>
        </span>
        <span class="settings-row-arrow" aria-hidden="true">›</span>
      </button>
  `;
}

function loadAndroidSpeechVoices() {
  if (typeof globalThis.ShineAacAndroid?.getSpeechVoicesJson !== "function") return null;
  try {
    return JSON.parse(globalThis.ShineAacAndroid.getSpeechVoicesJson());
  } catch {
    return { ready: false, voices: [], error: true };
  }
}

function speechVoiceSummary(state, selectedVoiceName) {
  if (!state?.ready) return state?.error ? "語音服務無法使用" : "語音服務啟動中";
  if (selectedVoiceName === androidSystemVoiceName) return "裝置預設 · zh-TW";
  const voices = Array.isArray(state.voices) ? state.voices : [];
  const index = voices.findIndex((voice) => voice.name === selectedVoiceName);
  if (index < 0) return "先前選擇的語音目前無法使用";
  const voice = voices[index];
  const status = voice.builtIn
    ? "內建"
    : voice.downloadRequired ? "尚未下載" : voice.networkRequired ? "需網路" : "已下載";
  return `${speechVoiceDisplayName(state, voice)} · ${status}`;
}

function speechVoiceExplicitTraits(voice) {
  const features = Array.isArray(voice?.features) ? voice.features : [];
  let gender = "";
  let style = "";
  for (const feature of features) {
    const value = String(feature ?? "").trim();
    const genderMatch = value.match(/(?:^|[./_-])gender[=:._/-](female|male|neutral)(?:$|[./_-])/i);
    if (genderMatch) {
      gender = { female: "女性", male: "男性", neutral: "中性" }[genderMatch[1].toLowerCase()] ?? "";
    }
    const styleMatch = value.match(/(?:^|[./_-])style[=:]([^,;|]{1,32})$/i);
    if (styleMatch) style = styleMatch[1].trim();
  }
  return [gender, style].filter(Boolean);
}

function speechVoiceProviderId(voice) {
  return String(voice?.name ?? "").trim();
}

function isTaiwanLanguageDataVoice(voice) {
  return /^zh[-_]tw[-_]language$/i.test(speechVoiceProviderId(voice));
}

function googleTaiwanVoiceMetadata(state, voice) {
  if (String(state?.enginePackage ?? "") !== "com.google.android.tts") return null;
  const providerId = speechVoiceProviderId(voice);
  if (/^zh-tw-language$/i.test(providerId)) {
    return { displayName: "台灣中文語音資料", gender: "", providerName: "Google" };
  }
  const match = providerId.match(/^cmn-tw-x-(ct[cde])-(?:local|network)$/i);
  if (!match) return null;
  const variant = match[1].replace(/\s/g, "").toLowerCase();
  return {
    ctc: { displayName: "語音 I", gender: "女性", providerName: "Google" },
    ctd: { displayName: "語音 II", gender: "男性", providerName: "Google" },
    cte: { displayName: "語音 III", gender: "男性", providerName: "Google" }
  }[variant] ?? null;
}

function speechVoiceDisplayName(state, voice) {
  const suppliedName = String(voice?.displayName ?? "").trim();
  if (suppliedName) return suppliedName;
  const catalog = googleTaiwanVoiceMetadata(state, voice);
  if (catalog) return catalog.displayName;
  const providerId = speechVoiceProviderId(voice);
  if (!providerId) return "未命名語音";
  const variant = providerId
    .replace(/^(?:cmn|zh)[-_]tw[-_]/i, "")
    .replace(/^x[-_]/i, "")
    .replace(/[-_](?:local|network)$/i, "")
    .replace(/^voice[-_]/i, "");
  return variant ? variant.replace(/[-_]+/g, " ").toUpperCase() : providerId;
}

function speechVoiceDetail(state, voice) {
  const catalog = googleTaiwanVoiceMetadata(state, voice);
  const traits = speechVoiceExplicitTraits(voice);
  if (catalog?.gender && !traits.some((trait) => trait === catalog.gender)) traits.unshift(catalog.gender);
  const availability = voice?.downloadRequired
    ? "尚未安裝"
    : voice?.networkRequired ? "需網路" : voice?.builtIn ? "內建" : "已下載";
  const quality = Number(voice?.quality) >= 400 ? "高品質" : "";
  const traitText = traits.length > 0 ? traits.join(" · ") : "性別／風格未提供";
  const providerId = speechVoiceProviderId(voice);
  const provider = String(voice?.providerName ?? "").trim() ||
    catalog?.providerName ||
    (providerId ? `ID: ${providerId}` : "");
  const extraDetail = String(voice?.extraDetail ?? "").trim();
  return [traitText, availability, quality, provider, extraDetail].filter(Boolean).join(" · ");
}

function openSpeechVoiceSettings() {
  speechVoicesOpen = true;
  speechVoiceStatusMessage = "";
  renderSpeechVoiceSettings();
}

function closeSpeechVoiceSettings() {
  speechVoicesOpen = false;
  stopSpeechVoiceRefresh();
  document.querySelector("[data-testid='speech-voice-page']")?.remove();
  updateSpeechVoiceSettingSummary();
}

function stopSpeechVoiceRefresh() {
  window.clearTimeout(speechVoiceRefreshTimerId);
  speechVoiceRefreshTimerId = 0;
}

function scheduleSpeechVoiceRefresh() {
  stopSpeechVoiceRefresh();
  if (!speechVoicesOpen) return;
  speechVoiceRefreshTimerId = window.setTimeout(refreshSpeechVoiceDownloadStatus, 1500);
}

function refreshSpeechVoiceDownloadStatus() {
  if (!speechVoicesOpen) return;
  const state = loadAndroidSpeechVoices() ?? { ready: false, voices: [] };
  const voices = Array.isArray(state.voices) ? state.voices : [];
  if (speechVoiceDownloadRequests.size === 0) {
    renderSpeechVoiceSettings();
    return;
  }
  const completed = voices.find((voice) =>
    speechVoiceDownloadRequests.has(String(voice.name ?? "")) && !voice.downloadRequired
  );
  if (completed) {
    const name = String(completed.name ?? "");
    speechVoiceDownloadRequests.delete(name);
    speechVoiceDownloadHelp.delete(name);
    speechVoiceStatusMessage = "語音下載完成，可以選取並試聽。";
    renderSpeechVoiceSettings();
    return;
  }

  let helpChanged = false;
  const now = Date.now();
  for (const [name, startedAt] of speechVoiceDownloadRequests) {
    if (now - startedAt >= 6000 && !speechVoiceDownloadHelp.has(name)) {
      speechVoiceDownloadHelp.add(name);
      helpChanged = true;
    }
  }
  if (helpChanged) {
    speechVoiceStatusMessage = "下載尚未開始。請開啟語音引擎的下載畫面完成安裝。";
    renderSpeechVoiceSettings();
    return;
  }
  scheduleSpeechVoiceRefresh();
}

function selectedSpeechVoiceName() {
  const form = document.querySelector(".config-panel form");
  return String(form?.elements?.speechVoiceName?.value ?? uiConfig.speechVoiceName ?? "");
}

function updateSpeechVoiceSettingSummary() {
  const summary = document.querySelector("[data-speech-voice-summary]");
  if (!summary) return;
  summary.textContent = speechVoiceSummary(loadAndroidSpeechVoices(), selectedSpeechVoiceName());
}

function commitSpeechVoiceSelection(voiceName) {
  const form = document.querySelector(".config-panel form");
  if (form?.elements?.speechVoiceName) form.elements.speechVoiceName.value = voiceName;
  uiConfig = normalizeUiConfig({ ...uiConfig, speechVoiceName: voiceName });
  saveUiConfig(uiStorageKey, uiConfig);
}

function renderSpeechVoiceSettings() {
  if (!speechVoicesOpen) return;
  stopSpeechVoiceRefresh();
  const previousPanel = document.querySelector("[data-testid='speech-voice-page'] .speech-voice-panel");
  const previousScrollTop = previousPanel?.scrollTop ?? 0;
  document.querySelector("[data-testid='speech-voice-page']")?.remove();

  const state = loadAndroidSpeechVoices() ?? { ready: false, voices: [], browserUnavailable: true };
  const voices = Array.isArray(state.voices) ? state.voices : [];
  const selectedVoiceName = selectedSpeechVoiceName();
  const selectedVoice = voices.find((voice) => voice.name === selectedVoiceName);
  const effectiveSelectedVoiceName =
    selectedVoiceName === androidSystemVoiceName ||
    (selectedVoice && !selectedVoice.downloadRequired)
    ? selectedVoiceName
    : "";
  const completed = voices.find((voice) =>
    speechVoiceDownloadRequests.has(String(voice.name ?? "")) && !voice.downloadRequired
  );
  if (completed) {
    const name = String(completed.name ?? "");
    speechVoiceDownloadRequests.delete(name);
    speechVoiceDownloadHelp.delete(name);
    speechVoiceStatusMessage = "語音下載完成，可以選取並試聽。";
  }

  const backdrop = document.createElement("div");
  backdrop.className = "config-backdrop speech-voice-backdrop";
  backdrop.dataset.testid = "speech-voice-page";
  backdrop.addEventListener("click", closeSpeechVoiceSettings);

  const panel = document.createElement("section");
  panel.className = "config-panel speech-voice-panel";
  panel.setAttribute("aria-labelledby", "speech-voice-title");
  panel.addEventListener("click", (event) => event.stopPropagation());

  const engineLabel = String(state.engineLabel || state.enginePackage || "Android TTS");
  const installedVoices = voices.filter((voice) =>
    !voice.downloadRequired && !voice.networkRequired && !isTaiwanLanguageDataVoice(voice)
  );
  const onlineVoices = voices.filter((voice) =>
    !voice.downloadRequired && voice.networkRequired && !isTaiwanLanguageDataVoice(voice)
  );
  const additionalVoices = voices.filter((voice) =>
    !voice.downloadRequired && isTaiwanLanguageDataVoice(voice)
  );
  const downloadableVoices = voices.filter((voice) => voice.downloadRequired);
  const defaultAvailable = state.systemLanguageAvailable !== false;
  const loadingMessage = state.browserUnavailable
    ? "此功能只在 Android App 中提供。"
    : state.error ? "無法讀取 Android 語音服務。" : "正在啟動 Android 語音服務…";
  const unavailableMessage = selectedVoiceName && effectiveSelectedVoiceName === ""
    ? "先前選取的語音目前無法使用，暫時使用裝置預設。"
    : "";

  panel.innerHTML = `
    <header class="speech-voice-app-bar">
      <button class="speech-voice-icon-button" type="button" data-speech-action="back" aria-label="返回設定">
        <span aria-hidden="true">‹</span>
      </button>
      <h1 id="speech-voice-title">台灣語音</h1>
    </header>
    <p class="speech-voice-intro">點選語音即可套用；按播放鍵試聽。</p>
    <button class="speech-engine-row" type="button" data-speech-action="manage" aria-labelledby="speech-engine-heading speech-engine-name">
      <span class="speech-engine-copy">
        <small id="speech-engine-heading">語音引擎</small>
        <strong id="speech-engine-name">${escapeHtml(engineLabel)}</strong>
      </span>
      <span class="settings-row-arrow" aria-hidden="true">›</span>
    </button>
    ${speechVoiceStatusMessage || unavailableMessage ? `<p class="speech-voice-status" role="status">${escapeHtml(speechVoiceStatusMessage || unavailableMessage)}</p>` : ""}
    ${!state.ready ? `<p class="speech-voice-empty" role="status">${escapeHtml(loadingMessage)}</p>` : `
      ${defaultAvailable ? `
      <section class="speech-voice-section" aria-labelledby="default-voice-heading">
        <h2 id="default-voice-heading">預設</h2>
        <div class="speech-voice-list">
          ${speechVoiceRowHtml(null, effectiveSelectedVoiceName, state)}
        </div>
      </section>
      ` : ""}
      ${installedVoices.length > 0 ? `
        <section class="speech-voice-section" aria-labelledby="installed-voices-heading">
          <h2 id="installed-voices-heading">可用 (${installedVoices.length})</h2>
          <div class="speech-voice-list">
            ${installedVoices.map((voice) => speechVoiceRowHtml(voice, effectiveSelectedVoiceName, state)).join("")}
          </div>
        </section>
      ` : ""}
      ${onlineVoices.length > 0 ? `
        <section class="speech-voice-section" aria-labelledby="online-voices-heading">
          <h2 id="online-voices-heading">線上語音 (${onlineVoices.length})</h2>
          <div class="speech-voice-list">
            ${onlineVoices.map((voice) => speechVoiceRowHtml(voice, effectiveSelectedVoiceName, state)).join("")}
          </div>
        </section>
      ` : ""}
      ${additionalVoices.length > 0 ? `
        <section class="speech-voice-section" aria-labelledby="additional-voices-heading">
          <h2 id="additional-voices-heading">其他語音資料</h2>
          <div class="speech-voice-list">
            ${additionalVoices.map((voice) => speechVoiceRowHtml(voice, effectiveSelectedVoiceName, state)).join("")}
          </div>
        </section>
      ` : ""}
      ${!defaultAvailable && installedVoices.length === 0 && onlineVoices.length === 0 ? '<p class="speech-voice-empty">目前的語音引擎沒有可用的 zh-TW 語音。</p>' : ""}
      ${downloadableVoices.length > 0 ? `
        <section class="speech-voice-section" aria-labelledby="downloadable-voices-heading">
          <h2 id="downloadable-voices-heading">可下載 (${downloadableVoices.length})</h2>
          <div class="speech-voice-list">
            ${downloadableVoices.map((voice) => speechVoiceRowHtml(voice, effectiveSelectedVoiceName, state)).join("")}
          </div>
          <p class="speech-voice-note">下載由目前的 Android 語音引擎處理。完成後此頁會自動更新。</p>
          ${speechVoiceDownloadHelp.size > 0 ? '<button class="secondary-button speech-download-settings" type="button" data-speech-action="manage-downloads">開啟語音下載設定</button>' : ""}
        </section>
      ` : ""}
      ${voices.some((voice) => voice.name === "shine-aac-moe-bopomofo") ? `
        <p class="speech-voice-note">教育部人聲注音：2017 © 教育部，國語注音符號手冊－開放部件，CC BY 4.0。</p>
      ` : ""}
    `}
  `;

  panel.addEventListener("change", (event) => {
    if (event.target?.name !== "speech-voice-choice") return;
    commitSpeechVoiceSelection(String(event.target.value ?? ""));
    speechVoiceStatusMessage = "已選取語音。";
    renderSpeechVoiceSettings();
  });
  panel.addEventListener("click", (event) => {
    const actionTarget = event.target?.closest?.("[data-speech-action]");
    const action = actionTarget?.dataset?.speechAction;
    const voiceName = String(actionTarget?.dataset?.voiceName ?? "");
    if (action === "back") closeSpeechVoiceSettings();
    if (action === "preview") {
      previewAndroidSpeechVoice(voiceName);
      speechVoiceStatusMessage = "正在試聽。";
      renderSpeechVoiceSettings();
    }
    if (action === "download") {
      speechVoiceDownloadRequests.set(voiceName, Date.now());
      speechVoiceDownloadHelp.delete(voiceName);
      downloadAndroidSpeechVoice(voiceName);
      speechVoiceStatusMessage = "已要求下載。此頁會保留位置並自動更新狀態。";
      renderSpeechVoiceSettings();
    }
    if (action === "manage") {
      speechVoiceStatusMessage = "返回 App 後會重新檢查語音。";
      openAndroidSpeechSettings();
    }
    if (action === "manage-downloads") {
      speechVoiceStatusMessage = "返回 App 後會重新檢查下載狀態。";
      installAndroidSpeechData();
    }
  });

  backdrop.append(panel);
  app.append(backdrop);
  panel.scrollTop = previousScrollTop;
  if (!state.ready || speechVoiceDownloadRequests.size > 0) scheduleSpeechVoiceRefresh();
}

function speechVoiceRowHtml(voice, selectedVoiceName, state) {
  const isDefault = voice == null;
  const name = isDefault ? androidSystemVoiceName : String(voice.name ?? "");
  const displayName = isDefault ? "裝置預設" : speechVoiceDisplayName(state, voice);
  const downloadRequired = voice?.downloadRequired === true;
  const requested = speechVoiceDownloadRequests.has(name);
  const detail = isDefault
    ? "由語音引擎決定"
    : speechVoiceDetail(state, voice);
  const checked = name === selectedVoiceName ? " checked" : "";
  const selectedClass = name === selectedVoiceName ? " selected" : "";

  return `
    <div class="speech-voice-row${selectedClass}" data-voice-name="${escapeHtml(name)}">
      ${downloadRequired ? `
        <span class="speech-voice-download-copy">
          <span class="speech-radio-placeholder" aria-hidden="true"></span>
          <span class="speech-voice-copy">
            <strong>${escapeHtml(displayName)}</strong>
            <small>${escapeHtml(detail)}</small>
          </span>
        </span>
      ` : `
        <label class="speech-voice-choice">
          <input type="radio" name="speech-voice-choice" value="${escapeHtml(name)}"${checked}>
          <span class="speech-voice-copy">
            <strong>${escapeHtml(displayName)}</strong>
            <small>${escapeHtml(detail)}</small>
          </span>
        </label>
      `}
      <div class="speech-voice-row-actions">
        ${downloadRequired
          ? `<button class="speech-voice-icon-button" type="button" data-speech-action="download" data-voice-name="${escapeHtml(name)}" aria-label="下載 ${escapeHtml(displayName)}"${requested ? " disabled" : ""}>${requested ? '<span class="speech-progress-mark" aria-hidden="true">…</span>' : downloadIconSvg()}</button>`
          : `<button class="speech-voice-icon-button" type="button" data-speech-action="preview" data-voice-name="${escapeHtml(name)}" aria-label="試聽 ${escapeHtml(displayName)}">${playIconSvg()}</button>`}
      </div>
    </div>
  `;
}

function playIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
}

function downloadIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 19v2h14v-2H5z"></path></svg>';
}

function previewAndroidSpeechVoice(voiceName) {
  if (typeof globalThis.ShineAacAndroid?.previewSpeechVoice !== "function") return;
  try {
    globalThis.ShineAacAndroid.previewSpeechVoice(voiceName);
  } catch {
    // Native preview is best effort.
  }
}

function downloadAndroidSpeechVoice(voiceName) {
  if (typeof globalThis.ShineAacAndroid?.downloadSpeechVoice !== "function") return;
  try {
    globalThis.ShineAacAndroid.downloadSpeechVoice(voiceName);
  } catch {
    // Voice downloads are owned by the active Android TTS engine.
  }
}

function installAndroidSpeechData() {
  if (typeof globalThis.ShineAacAndroid?.installSpeechData !== "function") return;
  try {
    globalThis.ShineAacAndroid.installSpeechData();
  } catch {
    // The active TTS engine might not provide a voice-data management screen.
  }
}

function openAndroidSpeechSettings() {
  if (typeof globalThis.ShineAacAndroid?.openSpeechSettings === "function") {
    try {
      globalThis.ShineAacAndroid.openSpeechSettings();
      return;
    } catch {
      // Fall through to the older bridge action.
    }
  }
  installAndroidSpeechData();
}

function hardwareInputEnabled(config = uiConfig) {
  return config.switchInputProfile === "hardware-buttons" ||
    config.switchInputProfile === "volume-buttons" ||
    config.switchInputProfile === "hardware-and-camera";
}

function cameraInputEnabled(config = uiConfig) {
  return config.switchInputProfile === "camera-long-blink" ||
    config.switchInputProfile === "hardware-and-camera";
}

function openCameraSwitchCalibration(profileId) {
  if (!globalThis.ShineAacAndroid?.openCameraSwitchCalibration) return;
  try {
    globalThis.ShineAacAndroid.openCameraSwitchCalibration(profileId);
  } catch {
    // Browser builds do not provide native camera calibration.
  }
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

if (configOpen) {
  renderConfig();
} else {
  render();
}
resetClock();
scheduleScan();
syncNativeUiConfig(uiConfig);
announceCurrentScanTarget();
demoMode.startFromEnvironment();
