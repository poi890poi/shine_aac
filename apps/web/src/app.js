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
  compactTextHistorySnapshots,
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
import {
  androidSystemVoiceName,
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
const CameraStatusStaleMs = 2200;
const TextHistoryVersion = 3;
const TextHistoryMaxEntries = 1000;
const TextHistoryMaxChars = 220000;
const TextHistoryMaxStorageChars = 480000;
const SessionDraftVersion = 1;
const SessionDraftMaxHistoryEntries = 24;
const SessionDraftMaxMessageChars = 10000;

const initialConfig = loadConfig();
let session = createSession({ config: initialConfig, ...loadSessionDraft(initialConfig) });
let uiConfig = loadUiConfig(uiStorageKey);
let highlightStartedAt = performance.now();
let highlightDeadlineAt = highlightStartedAt;
let timerId = 0;
let animationFrameId = 0;
let configOpen = false;
let calibrationOpen = false;
let appInfoOpen = false;
let speechVoicesOpen = false;
let speechVoiceRefreshTimerId = 0;
let speechVoiceStatusMessage = "";
const speechVoiceDownloadRequests = new Map();
const speechVoiceDownloadHelp = new Set();
let calibrationTimerId = 0;
let lastScanAnnouncementKey = "";
let reviewHoldActive = false;
let cameraHoldActive = false;
let cameraHoldProgress = 0;
let suppressNextConfigClick = false;
let renderedBoardKey = "";
let renderedMessage = "";
let renderedTiles = [];
let renderedTileGrid = [];
let renderedPhaseElement = null;
let renderedVoiceElement = null;
let renderedCameraStatusElement = null;
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
let scanScheduleToken = 0;
let cameraStatus = { state: "off", label: "Camera off", updatedAt: 0 };
let cameraStatusTimerId = 0;
let calibrationState = createCalibrationState();
const demoMode = createDemoMode({
  getHighlightStartedAt: () => highlightStartedAt,
  getSession: () => session,
  isReviewHoldActive: () => reviewHoldActive,
  receiveInput: handleInputEvent,
  resetSession: resetSessionForDemo
});

globalThis.ShineAacInput = {
  receive: handleInputEvent
};

globalThis.ShineAacTextHistory = {
  exportText: exportTextHistoryText,
  record: () => recordTextHistory("manual", "manual")
};

globalThis.ShineAacNavigation = Object.freeze({
  back: navigateBackWithinApp,
  currentPage: currentAppPage
});

globalThis.ShineAacSpeechVoices = Object.freeze({
  refresh: () => {
    if (speechVoicesOpen) renderSpeechVoiceSettings();
  }
});

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
      suggestionPage: Number.isInteger(stored.suggestionPage) ? stored.suggestionPage : 0
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
    suggestionPage: session.suggestionPage
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  session = nextSession;
  reviewHoldActive = false;
  cameraHoldActive = false;
  cameraHoldProgress = 0;
  resetClock();
  render();
  scheduleScan();
  announceCurrentScanTarget();
}

function resetSessionForDemo() {
  closeTextHistoryLine("reset", "demo");
  clearSessionDraft();
  setSession(createSession({ config: session.config }));
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
    resetClock();
    render();
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
  session = uiConfig.restartScanFromTop && selection
    ? { ...nextSession, scannerState: { ...nextSession.scannerState, rowIndex: 0 } }
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
  const nextSession = pendingAdvanceSession ?? advanceSession(session);
  pendingAdvanceSession = null;
  setSession(nextSession);
}

function scheduleScan() {
  cancelScheduledScan();
  if (configOpen || cameraHoldActive) return;
  if (reviewHoldActive) {
    setProgressFills(1, 0);
    return;
  }

  const duration = scanDurationForStage(session.scannerState, effectiveTimingConfigForScan());
  const token = scanScheduleToken;
  highlightStartedAt = performance.now();
  highlightDeadlineAt = highlightStartedAt + duration;

  animationFrameId = window.requestAnimationFrame(() => {
    if (token !== scanScheduleToken || configOpen || reviewHoldActive || cameraHoldActive) return;
    resetProgressFills(currentProgressFills);
    animationFrameId = window.requestAnimationFrame(() => {
      if (token !== scanScheduleToken || configOpen || reviewHoldActive || cameraHoldActive) return;
      startScanClock(duration, token);
    });
  });
}

function resumeScanFromProgress(progress) {
  cancelScheduledScan();
  if (configOpen || reviewHoldActive || cameraHoldActive) return;
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
    pendingAdvanceSession = advanceSession(session);
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
  highlightStartedAt = performance.now();
  highlightDeadlineAt = highlightStartedAt + durationMs;
  timerId = window.setTimeout(advanceScan, durationMs);
  const progressFills = setProgressFills(0, 0);
  forceProgressLayout(progressFills);
  setProgressFills(1, durationMs);
  prepareAdvanceTimerId = window.setTimeout(() => {
    if (token !== scanScheduleToken || configOpen || reviewHoldActive || cameraHoldActive) return;
    pendingAdvanceSession = advanceSession(session);
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

function effectiveTimingConfigForScan() {
  return cameraInputEnabled()
    ? timingProfileConfig(session.config, ScanTimingPresets.cameraLongBlink)
    : session.config;
}

function effectiveTimingConfigForInput(source = "") {
  return isCameraInput(source)
    ? timingProfileConfig(session.config, ScanTimingPresets.cameraLongBlink)
    : session.config;
}

function timingProfileConfig(baseConfig, timingProfile) {
  return {
    ...baseConfig,
    scanIntervalMs: timingProfile.scanIntervalMs,
    transitionPauseMs: timingProfile.transitionPauseMs,
    firstCellPauseMs: timingProfile.firstCellPauseMs,
    inputLatencyCompensationMs: timingProfile.inputLatencyCompensationMs
  };
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
  const label = String(inputEvent.label ?? cameraStatusLabel(state));
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
      setCameraStatus("detectorStale", "Detect stale", false);
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
  element.textContent = visible ? cameraStatus.label : "";
}

function cameraStatusLabel(state) {
  switch (state) {
    case "starting":
      return "Cam start";
    case "live":
      return "Cam live";
    case "analysis":
      return "Cam live";
    case "blink":
      return "Blink";
    case "restarting":
      return "Cam restart";
    case "detectorStale":
      return "Detect stale";
    case "cameraStale":
      return "Cam stale";
    case "permissionDenied":
      return "Camera permission";
    case "stale":
      return "Detect stale";
    case "stopped":
    case "off":
      return "Camera off";
    default:
      return "Camera status";
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
  const key = `${scanner.stage}:${scanner.rowIndex}:${scanner.cellIndex}`;
  if (key === lastScanAnnouncementKey) return;
  lastScanAnnouncementKey = key;

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
  phase.textContent = statusPhaseLabel(scanner.stage);
  renderedPhaseElement = phase;

  const voice = document.createElement("div");
  voice.className = "voice";
  voice.textContent = uiConfig.rowScanVoice || uiConfig.scanVoice || uiConfig.activationVoice ? "Audio" : "Silent";
  renderedVoiceElement = voice;

  const cameraStatusElement = document.createElement("div");
  cameraStatusElement.className = "camera-status";
  cameraStatusElement.hidden = true;
  renderedCameraStatusElement = cameraStatusElement;

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

  status.append(phase, cameraStatusElement, voice, configButton);
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
  const nextProgressTargetKey = progressTargetKeyForScanner(scanner, reviewHoldActive);
  if (renderedPhaseElement) {
    renderedPhaseElement.textContent = statusPhaseLabel(scanner.stage);
  }
  if (renderedVoiceElement) {
    renderedVoiceElement.textContent = uiConfig.rowScanVoice || uiConfig.scanVoice || uiConfig.activationVoice ? "Audio" : "Silent";
  }
  updateCameraStatusPresentation();

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
    const cameraHold = cameraHoldActive && (activeRow || activeCell);
    const nextClassName = tileClass(candidate, activeRow, activeCell, reviewHold, cameraHold);
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
  renderedCameraStatusElement = null;
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

function tileClass(candidate, activeRow, activeCell, reviewHold = false, cameraHold = false) {
  const classes = ["tile"];
  classes.push(`action-${candidate.action}`);
  if (candidate.action !== TileAction.Append) classes.push("command");
  if (candidate.action === TileAction.Noop) classes.push("noop");
  if (candidate.action === TileAction.CommitCandidate && candidate.replaceLength > 0) classes.push("replacement");
  if (activeRow) classes.push("active-row", "is-current");
  if (activeCell) classes.push("active-cell", "is-current");
  if (reviewHold) classes.push("review-hold");
  if (cameraHold) classes.push("camera-hold");
  return classes.join(" ");
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
  const labels = observedBoardElement?.querySelectorAll(".tile-label") ?? [];
  for (const label of labels) label.style.fontSize = "";

  for (const label of labels) {
    const tile = label.closest(".tile");
    if (!tile || label.clientWidth <= 0 || label.clientHeight <= 0 || tile.clientHeight <= 0) continue;

    const maximumPx = Number.parseFloat(getComputedStyle(tile).fontSize);
    if (!Number.isFinite(maximumPx) || tileLabelFits(label)) continue;

    let lowerPx = 4;
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

function tileLabelFits(label) {
  return label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight;
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

function statusPhaseLabel(stage) {
  if (cameraHoldActive) return "Blink";
  if (reviewHoldActive) return "Review";
  return phaseLabel(stage);
}

function openConfig() {
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

function closeConfig() {
  configOpen = false;
  calibrationOpen = false;
  appInfoOpen = false;
  speechVoicesOpen = false;
  stopSpeechVoiceRefresh();
  stopCalibrationTimer();
  reviewHoldActive = false;
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
      <strong>Version ${escapeHtml(String(info.versionName))} (${escapeHtml(String(info.versionCode))})</strong>
      <p>An augmentative and alternative communication app for composing and speaking messages with touch, switch, or camera input.</p>
    </header>
    <section class="info-section" aria-labelledby="info-data-heading">
      <h2 id="info-data-heading">Your data</h2>
      <dl class="info-list">
        <div><dt>Communication data</dt><dd>Stored locally on this device</dd></div>
        <div><dt>Text history</dt><dd>Saved locally; oldest entries are recycled at storage limits</dd></div>
        <div><dt>Export</dt><dd>Saved to a user-chosen text file only when the user selects Export text</dd></div>
        <div><dt>Backup</dt><dd>Android cloud and device-transfer backup disabled</dd></div>
        <div><dt>Camera</dt><dd>Processed on device; frames are not stored by SayToMe AAC</dd></div>
        <div><dt>Core communication</dt><dd>Works offline after installation</dd></div>
      </dl>
    </section>
    <section class="info-section" aria-labelledby="info-project-heading">
      <h2 id="info-project-heading">Help and information</h2>
      <div class="info-links">
        <button class="secondary-button" type="button" data-url="https://poi890poi.github.io/shine_aac/privacy-policy/">Privacy policy</button>
        <button class="secondary-button" type="button" data-url="https://poi890poi.github.io/shine_aac/support/">Support</button>
        <button class="secondary-button" type="button" data-url="https://github.com/poi890poi/shine_aac">Source code</button>
      </div>
    </section>
    <div class="config-actions info-actions">
      <button class="primary-button" type="button" data-action="back">Back</button>
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
      ${speechVoiceSettingHtml(uiConfig.speechVoiceName)}
      <label class="field check-field">
        <input name="restartScanFromTop" type="checkbox" ${uiConfig.restartScanFromTop ? "checked" : ""}>
        Restart scan at top after input
      </label>
      <label class="field">Switch input
        <select name="switchInputProfile">
          ${switchInputProfileOptionsHtml(uiConfig.switchInputProfile)}
        </select>
      </label>
      <div class="field">
        <button class="secondary-button" type="button" data-action="camera-calibration">Camera setup</button>
      </div>
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
      <button class="secondary-button" type="button" data-action="app-info">App info</button>
      <button class="secondary-button" type="button" data-action="reset">Reset</button>
      <button class="secondary-button" type="button" data-action="calibrate">Input test</button>
      <button class="secondary-button" type="button" data-action="export-text">Export text</button>
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
    if (action === "app-info") openAppInfo();
    if (action === "calibrate") openCalibration();
    if (action === "camera-calibration") {
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
    closeTextHistoryLine("reset", "config");
    saveConfig(config);
    uiConfig = normalizeUiConfig({
      rowScanVoice: data.get("rowScanVoice") === "on",
      scanVoice: data.get("scanVoice") === "on",
      activationVoice: data.get("activationVoice") === "on",
      speechVoiceName: String(data.get("speechVoiceName") ?? uiConfig.speechVoiceName ?? ""),
      restartScanFromTop: data.get("restartScanFromTop") === "on",
      switchInputProfile: String(data.get("switchInputProfile") ?? "hardware-buttons"),
      holdAfterSuggestionChange: data.get("holdAfterSuggestionChange") === "on"
    });
    saveUiConfig(uiStorageKey, uiConfig);
    session = createSession({ config });
    clearSessionDraft();
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
      ? "Choose a switch input profile that includes this source."
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
        <span>Hardware input</span>
        <strong>${hardwareInputEnabled() ? "On" : "Off"}</strong>
      </div>
      <div class="calibration-card ${last?.disabledBySettings ? "warn" : ""}">
        <span>Camera input</span>
        <strong>${cameraInputEnabled() ? "On" : "Off"}</strong>
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

function switchInputProfileOptionsHtml(selectedProfile) {
  const options = [
    ["hardware-buttons", "Phone/external buttons"],
    ["camera-long-blink", "Camera long blink"],
    ["hardware-and-camera", "Buttons + camera"],
    ["off", "Off"]
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

render();
scheduleScan();
syncNativeUiConfig(uiConfig);
announceCurrentScanTarget();
demoMode.startFromEnvironment();
