#!/usr/bin/env node

// Real-device configuration and UX audit for SHINE AAC's debug-built APK.
// Run with Node's built-in WebSocket support:
//   node --experimental-websocket scripts/device-config-audit.mjs

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  findBrightDarkThemeSurfaces,
  findControlOverlaps,
  findExcessiveCellPadding,
  findLooseLineHeights,
  findRepeatedRowAlignmentDrift,
  findRepeatedRowGaps,
} from "./layout-quality-heuristics.mjs";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const outDir = resolve(root, "test-results", `config-${stamp}`);
const screenshotDir = resolve(outDir, "screenshots");
mkdirSync(screenshotDir, { recursive: true });

const adb = process.env.ADB || "E:\\Android\\Sdk\\platform-tools\\adb.exe";
const packageName = "org.shineaac.app";
const activity = `${packageName}/.MainActivity`;
const port = Number(process.env.SHINE_AAC_DEVICE_CDP_PORT || 9224);
const restoreUiOverride = process.env.SHINE_AAC_CONFIG_AUDIT_RESTORE_UI_JSON || "";
const findings = [];
const passes = [];
let cdp;
let originalStorage;

function adbRun(args, encoding = "utf8") {
  return execFileSync(adb, args, { cwd: root, encoding, windowsHide: true });
}

function add(priority, title, detail, evidence = []) {
  findings.push({ priority, title, detail, evidence });
}

function pass(title, detail = "") {
  passes.push({ title, detail });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function screenshot(name) {
  const path = resolve(screenshotDir, `${name}.png`);
  writeFileSync(path, adbRun(["exec-out", "screencap", "-p"], null));
  return `screenshots/${name}.png`;
}

async function waitFor(predicate, label, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "JavaScript evaluation failed");
  return response.result?.value;
}

async function connect() {
  const pid = adbRun(["shell", "pidof", packageName]).trim().split(/\s+/)[0];
  if (!pid) throw new Error("SHINE AAC process is not running");
  adbRun(["forward", `tcp:${port}`, `localabstract:webview_devtools_remote_${pid}`]);
  let targets = [];
  await waitFor(async () => {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      return targets.length > 0;
    } catch {
      return false;
    }
  }, "Android WebView debug target");
  const target = targets.find((item) => /android_asset|apps\/web/i.test(item.url || "")) || targets[0];
  cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
}

async function openConfig() {
  await evaluate(`document.querySelector('.config-button')?.click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-panel form'))`), "configuration form");
}

async function formSnapshot() {
  return evaluate(`(() => {
    const form = document.querySelector('.config-panel form');
    if (!form) return null;
    const value = (name) => {
      const element = form.elements[name];
      if (!element) return null;
      if (element.type === 'checkbox') return element.checked;
      if (element.tagName === 'TEXTAREA') return { length: element.value.length, lines: element.value.split('\\n').length };
      return element.value;
    };
    const names = [...form.elements].map((element) => element.name).filter(Boolean);
    const options = (name) => [...(form.elements[name]?.options ?? [])].map((option) => ({ value: option.value, label: option.textContent.trim() }));
    return {
      names,
      values: Object.fromEntries([...new Set(names)].map((name) => [name, value(name)])),
      options: {
        profileId: options('profileId'), scanMode: options('scanMode'),
        scanTimingPreset: options('scanTimingPreset'), scanPassLimit: options('scanPassLimit'),
        switchInputProfile: options('switchInputProfile'), contrastTheme: options('contrastTheme')
      }
    };
  })()`);
}

async function auditLayout() {
  return evaluate(`(() => {
    const panel = document.querySelector('.config-panel');
    const form = panel?.querySelector('form');
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...form.querySelectorAll('button,input,select,textarea')].filter(visible).map((element) => {
      const own = element.getBoundingClientRect();
      const label = element.labels?.[0];
      const target = (element.type === 'checkbox' && label) ? label.getBoundingClientRect() : own;
      const name = element.getAttribute('aria-label') || label?.innerText?.trim() || element.innerText?.trim() || element.name || '';
      return { name, type: element.type || element.tagName, width: target.width, height: target.height };
    });
    const panelRect = panel.getBoundingClientRect();
    const overflow = [...form.querySelectorAll('.field,.settings-row,.config-actions button')].filter(visible).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < panelRect.left - 1 || rect.right > panelRect.right + 1 || element.scrollWidth > element.clientWidth + 2;
    }).map((element) => element.innerText?.trim().slice(0, 80) || element.className);
    const tinyText = [...form.querySelectorAll('label,button,small,strong')].filter(visible).filter((element) => parseFloat(getComputedStyle(element).fontSize) < 14).map((element) => ({ text: element.innerText.trim().slice(0, 80), px: getComputedStyle(element).fontSize }));
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      panel: { width: panelRect.width, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight },
      unnamed: controls.filter((item) => !item.name),
      smallTargets: controls.filter((item) => item.width < 48 || item.height < 48),
      overflow,
      tinyText
    };
  })()`);
}

async function auditVisualQuality(rootSelector, repeatedRowSelector = "", requiredVisibleSelectors = []) {
  const raw = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const inViewport = (rect) => rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
    const name = (element) => element.getAttribute('aria-label') || element.labels?.[0]?.innerText?.trim() || element.innerText?.trim().slice(0, 80) || element.name || element.tagName;
    const selector = (element) => {
      if (element.id) return '#' + CSS.escape(element.id);
      const classes = [...element.classList].slice(0, 3).map((item) => '.' + CSS.escape(item)).join('');
      const fieldName = element.getAttribute('name');
      return element.tagName.toLowerCase() + classes + (fieldName ? '[name="' + fieldName + '"]' : '');
    };
    const parseColor = (value) => {
      const parts = String(value).match(/[\\d.]+/g)?.map(Number) ?? [];
      return { red: parts[0] ?? 0, green: parts[1] ?? 0, blue: parts[2] ?? 0, alpha: parts[3] ?? 1 };
    };
    const clippedArea = (rect) => {
      const width = Math.max(0, Math.min(rect.right, rootRect.right, innerWidth) - Math.max(rect.left, rootRect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, rootRect.bottom, innerHeight) - Math.max(rect.top, rootRect.top, 0));
      return width * height;
    };

    const repeatedRows = [];
    if (${JSON.stringify(repeatedRowSelector)}) {
      const candidates = [...root.querySelectorAll(${JSON.stringify(repeatedRowSelector)})];
      const parents = [...new Set(candidates.map((element) => element.parentElement))];
      for (const parent of parents) {
        let items = [];
        const flush = () => {
          if (items.length > 1) repeatedRows.push({ role: ${JSON.stringify(repeatedRowSelector)}, items });
          items = [];
        };
        for (const child of [...parent.children].filter(visible)) {
          if (child.matches(${JSON.stringify(repeatedRowSelector)})) {
            const rect = child.getBoundingClientRect();
            items.push({ name: name(child), top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
          } else {
            flush();
          }
        }
        flush();
      }
    }

    const textSamples = [...root.querySelectorAll('h1,h2,h3,p,label,button,small,strong,dt,dd')].filter(visible).map((element) => {
      const style = getComputedStyle(element);
      return {
        text: element.innerText?.trim().slice(0, 80) || element.textContent?.trim().slice(0, 80) || element.tagName,
        fontSizePx: Number.parseFloat(style.fontSize),
        lineHeightPx: style.lineHeight === 'normal' ? null : Number.parseFloat(style.lineHeight),
      };
    });

    const backgroundSamples = [root, ...root.querySelectorAll('*')].filter(visible).map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const color = style.backgroundColor;
      const parsed = parseColor(color);
      return { selector: selector(element), color, ...parsed, area: clippedArea(rect) };
    }).filter((sample) => sample.area > 0);

    const cellSamples = [...root.querySelectorAll('button,input,select,.settings-row,.speech-voice-row,.mode-button,.calibration-step,.tile')].filter(visible).map((element) => {
      const style = getComputedStyle(element);
      return {
        selector: selector(element),
        text: name(element),
        fontSizePx: Number.parseFloat(style.fontSize) || 0,
        paddingTopPx: Number.parseFloat(style.paddingTop) || 0,
        paddingRightPx: Number.parseFloat(style.paddingRight) || 0,
        paddingBottomPx: Number.parseFloat(style.paddingBottom) || 0,
        paddingLeftPx: Number.parseFloat(style.paddingLeft) || 0,
      };
    });

    const controls = [...root.querySelectorAll('button,input,select,textarea,[role="button"]')].filter(visible).map((element) => {
      const rect = element.type === 'checkbox' && element.labels?.[0]
        ? element.labels[0].getBoundingClientRect()
        : element.getBoundingClientRect();
      return { name: name(element), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }).filter((item) => inViewport(item));

    const requiredVisibility = ${JSON.stringify(requiredVisibleSelectors)}.map((requiredSelector) => {
      const element = root.querySelector(requiredSelector);
      if (!element) return { selector: requiredSelector, present: false, visible: false };
      const rect = element.getBoundingClientRect();
      const viewportBottom = Math.min(innerHeight, rootRect.bottom);
      return {
        selector: requiredSelector,
        present: true,
        visible: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth && rect.top >= Math.max(0, rootRect.top) && rect.bottom <= viewportBottom,
        top: rect.top,
        bottom: rect.bottom,
        viewportBottom,
      };
    });

    return {
      rootArea: Math.max(0, Math.min(rootRect.width, innerWidth) * Math.min(rootRect.height, innerHeight)),
      repeatedRows,
      textSamples,
      backgroundSamples,
      cellSamples,
      controls,
      requiredVisibility,
    };
  })()`);
  if (!raw) return null;
  return {
    repeatedRowGaps: findRepeatedRowGaps(raw.repeatedRows),
    repeatedRowAlignmentDrift: findRepeatedRowAlignmentDrift(raw.repeatedRows),
    looseLineHeights: findLooseLineHeights(raw.textSamples),
    excessiveCellPadding: findExcessiveCellPadding(raw.cellSamples),
    brightDarkSurfaces: findBrightDarkThemeSurfaces(raw.backgroundSamples, raw.rootArea),
    controlOverlaps: findControlOverlaps(raw.controls),
    raw,
  };
}

function recordVisualQuality(label, quality, evidence, options = {}) {
  if (!quality) {
    add("P1", `${label} layout audit unavailable`, "The expected layout root was absent.", evidence);
    return;
  }
  if (options.spacing && quality.repeatedRowGaps.length) {
    const largest = Math.max(...quality.repeatedRowGaps.map((item) => item.gapPx));
    add("P3", `${label} repeated rows are too widely spaced`, `${quality.repeatedRowGaps.length} adjacent repeated-row gap(s) exceed 4 CSS px; largest ${largest}px.`, evidence);
  }
  if (quality.looseLineHeights.length) {
    add("P3", `${label} contains unusually loose text leading`, `${quality.looseLineHeights.length} text element(s) exceed a 1.6 line-height/font-size ratio.`, evidence);
  }
  if (quality.excessiveCellPadding.length) {
    add("P4", `${label} contains unusually padded cells`, `${quality.excessiveCellPadding.length} cell(s) have padding disproportionate to their text size.`, evidence);
  }
  if (quality.repeatedRowAlignmentDrift.length) {
    add("P3", `${label} contains misaligned repeated rows`, `${quality.repeatedRowAlignmentDrift.length} repeated row(s) drift by more than 2 CSS px.`, evidence);
  }
  if (options.darkTheme && quality.brightDarkSurfaces.length) {
    add("P2", `${label} contains bright patches in dark theme`, `${quality.brightDarkSurfaces.length} opaque bright surface(s) occupy at least 1% of the visible panel.`, evidence);
  }
  if (quality.controlOverlaps.length) {
    add("P2", `${label} contains overlapping controls`, `${quality.controlOverlaps.length} control pair(s) overlap.`, evidence);
  }
  const hiddenRequired = quality.raw.requiredVisibility.filter((item) => !item.visible);
  if (hiddenRequired.length) {
    add("P2", `${label} persistent actions are outside the viewport`, `${hiddenRequired.length} required action region(s) are absent or outside the visible panel.`, evidence);
  }
  if (
    (!options.spacing || !quality.repeatedRowGaps.length) &&
    !quality.looseLineHeights.length &&
    !quality.excessiveCellPadding.length &&
    !quality.repeatedRowAlignmentDrift.length &&
    (!options.darkTheme || !quality.brightDarkSurfaces.length) &&
    !quality.controlOverlaps.length &&
    !hiddenRequired.length
  ) {
    pass(`${label} visual geometry`, "no excessive repeated-row gaps, loose leading, padded cells, alignment drift, bright dark-theme patches, or control overlaps detected");
  }
}

async function captureConfigPages(prefix) {
  const positions = await evaluate(`(() => {
    const panel = document.querySelector('.config-panel');
    const max = Math.max(0, panel.scrollHeight - panel.clientHeight);
    return [0, Math.round(max * 0.33), Math.round(max * 0.66), max];
  })()`);
  for (let index = 0; index < positions.length; index += 1) {
    await evaluate(`document.querySelector('.config-panel').scrollTop=${positions[index]}`);
    await delay(250);
    screenshot(`${prefix}-${index + 1}`);
  }
}

async function setAndSave(values) {
  await evaluate(`(() => {
    const form = document.querySelector('.config-panel form');
    const values = ${JSON.stringify(values)};
    for (const [name, value] of Object.entries(values)) {
      const element = form.elements[name];
      if (!element) throw new Error('Missing setting: ' + name);
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = String(value);
      element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    }
    form.requestSubmit();
  })()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-button')) && !document.querySelector('.config-panel')`), "saved board");
}

function mismatchedValues(snapshot, expected) {
  return Object.entries(expected).filter(([name, value]) =>
    snapshot.values[name] !== value && String(snapshot.values[name]) !== String(value)
  );
}

async function verifyRoundTrip(label, values) {
  await setAndSave(values);
  await openConfig();
  const snapshot = await formSnapshot();
  const mismatches = mismatchedValues(snapshot, values);
  if (mismatches.length) {
    add("P1", `${label} failed to persist`, JSON.stringify(mismatches), ["option-matrix.json"]);
  } else {
    pass(label, `${Object.keys(values).length} value(s) saved and reloaded`);
  }
  return snapshot;
}

async function contrastSamples(selectors) {
  return evaluate(`(() => {
    const parse = (value) => {
      const match = String(value).match(/[\\d.]+/g);
      return match ? match.slice(0, 3).map(Number) : [0, 0, 0];
    };
    const luminance = (rgb) => {
      const channels = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const sample = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const foreground = parse(style.color);
      let surface = element;
      while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
      const backgroundColor = surface ? getComputedStyle(surface).backgroundColor : getComputedStyle(document.body).backgroundColor;
      const background = parse(backgroundColor);
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return { selector, color: style.color, background: backgroundColor, ratio: (light + 0.05) / (dark + 0.05), text: element.textContent.trim() };
    };
    return ${JSON.stringify(selectors)}.map(sample).filter(Boolean);
  })()`);
}

async function auditContrast(label, selectors, evidence) {
  const samples = await contrastSamples(selectors);
  const failures = samples.filter((sample) => sample.ratio < 4.5);
  if (failures.length) {
    add(
      "P1",
      `${label} contains text below 4.5:1 contrast`,
      failures.map((sample) => `${sample.text.slice(0, 50) || sample.selector}: ${sample.ratio.toFixed(2)}:1`).join(", "),
      evidence
    );
  } else {
    pass(`${label} contrast`, `${samples.length} representative surfaces meet or exceed 4.5:1`);
  }
  return samples;
}

async function restoreOriginal() {
  if (!originalStorage) return;
  await evaluate(`(() => {
    const values = ${JSON.stringify(originalStorage)};
    for (const [key, value] of Object.entries(values)) {
      if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    }
    const ui = values['shine-aac-web-ui-v1'];
    if (ui && globalThis.ShineAacAndroid?.setUiConfigJson) {
      globalThis.ShineAacAndroid.setUiConfigJson(ui);
    }
    location.reload();
  })()`);
  await delay(1800);
  const restoredStorage = await evaluate(`({
    'shine-aac-web-config-v1': localStorage.getItem('shine-aac-web-config-v1'),
    'shine-aac-web-ui-v1': localStorage.getItem('shine-aac-web-ui-v1')
  })`);
  writeFileSync(resolve(outDir, "restoration.json"), JSON.stringify({ expected: originalStorage, actual: restoredStorage }, null, 2));
  if (JSON.stringify(restoredStorage) !== JSON.stringify(originalStorage)) {
    add("P1", "Original configuration restore verification failed", "Restored localStorage differs from the pre-test snapshot", ["restoration.json"]);
  } else {
    pass("original configuration restore", "both board and native-mirrored UI stores match the pre-test snapshot");
  }
}

async function main() {
  adbRun(["shell", "input", "keyevent", "224"]); // WAKEUP
  adbRun(["shell", "wm", "dismiss-keyguard"]);
  adbRun(["shell", "am", "force-stop", packageName]);
  adbRun(["shell", "am", "start", "-n", activity]);
  await delay(1800);
  await connect();
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-button'))`), "board");
  originalStorage = await evaluate(`({
    'shine-aac-web-config-v1': localStorage.getItem('shine-aac-web-config-v1'),
    'shine-aac-web-ui-v1': localStorage.getItem('shine-aac-web-ui-v1')
  })`);
  if (restoreUiOverride) {
    originalStorage["shine-aac-web-ui-v1"] = JSON.stringify(JSON.parse(restoreUiOverride));
  }

  await openConfig();
  const baseline = await formSnapshot();
  const expected = [
    "profileId", "columns", "scanMode", "scanTimingPreset", "scanIntervalMs",
    "transitionPauseMs", "firstCellPauseMs", "inputLatencyCompensationMs",
    "scanPassLimit", "autoScanSuggestionPages", "deferUnsupportedZhuyinOnFirstPass",
    "rowScanVoice", "scanVoice", "activationVoice", "speechVoiceName",
    "restartScanFromTop", "verticalGroupProgress", "switchInputProfile",
    "contrastTheme", "suggestionDictionary", "symbols"
  ];
  const missing = expected.filter((name) => !baseline.names.includes(name));
  if (missing.length) add("P1", "Configuration controls missing", missing.join(", "));
  else pass("configuration inventory", `${expected.length} persisted settings present`);

  const layout = await auditLayout();
  const baselineQuality = await auditVisualQuality(".config-panel", ".check-field");
  if (layout.unnamed.length) add("P2", "Unnamed configuration controls", `${layout.unnamed.length} control(s) lack an accessible name`, ["baseline.json"]);
  if (layout.smallTargets.length) add("P2", "Configuration targets below 48dp", `${layout.smallTargets.length} control(s) have a target below 48 CSS px`, ["baseline.json"]);
  if (layout.overflow.length) add("P2", "Configuration horizontal clipping/overflow", `${layout.overflow.length} element(s) overflow the panel`, ["baseline.json"]);
  if (layout.tinyText.length) add("P3", "Small configuration text", `${layout.tinyText.length} visible text element(s) render below 14 CSS px`, ["baseline.json"]);
  recordVisualQuality("Configuration", baselineQuality, ["baseline.json", "screenshots/zh-default-config-2.png"], { spacing: true });
  await captureConfigPages("zh-default-config");
  writeFileSync(resolve(outDir, "baseline.json"), JSON.stringify({ baseline, layout, visualQuality: baselineQuality }, null, 2));

  const matrix = {
    profileId: "en-US", columns: 4, scanMode: "block-row-column",
    scanTimingPreset: "cameraLongBlink", scanPassLimit: 0,
    autoScanSuggestionPages: true, deferUnsupportedZhuyinOnFirstPass: false,
    rowScanVoice: true, scanVoice: true, activationVoice: true,
    restartScanFromTop: false, verticalGroupProgress: false,
    switchInputProfile: "volume-buttons", contrastTheme: "high-contrast-dark"
  };
  await setAndSave(matrix);
  screenshot("en-block-dark-board");
  const boardContrast = await auditContrast("High-contrast dark board", [
    ".review-hold-row .tile", ".tile.action-clear", ".tile.action-backspace", ".tile.function-key"
  ], ["screenshots/en-block-dark-board.png", "matrix.json"]);
  await openConfig();
  const saved = await formSnapshot();
  const mismatches = mismatchedValues(saved, matrix);
  if (mismatches.length) add("P1", "Major settings failed to persist", JSON.stringify(mismatches), ["matrix.json"]);
  else pass("major settings persistence", `${Object.keys(matrix).length} representative changes persisted`);
  await captureConfigPages("en-block-dark-config");
  const configContrast = await auditContrast("High-contrast dark Configuration", [
    ".config-panel h1", ".config-panel .field", ".settings-row", ".settings-row small",
    ".config-actions .secondary-button", ".config-actions .primary-button"
  ], ["screenshots/en-block-dark-config-1.png", "screenshots/en-block-dark-config-4.png"]);
  const darkConfigQuality = await auditVisualQuality(".config-panel");
  recordVisualQuality("High-contrast dark Configuration", darkConfigQuality, ["screenshots/en-block-dark-config-1.png", "screenshots/en-block-dark-config-4.png", "matrix.json"], { darkTheme: true });

  const beforeCancel = await evaluate(`({ config: localStorage.getItem('shine-aac-web-config-v1'), ui: localStorage.getItem('shine-aac-web-ui-v1') })`);
  await evaluate(`(() => {
    const form = document.querySelector('.config-panel form');
    form.elements.profileId.value='zh-TW'; form.elements.profileId.dispatchEvent(new Event('change',{bubbles:true}));
    form.elements.contrastTheme.value='high-contrast'; form.elements.contrastTheme.dispatchEvent(new Event('change',{bubbles:true}));
    form.querySelector('[data-action="cancel"]').click();
  })()`);
  await openConfig();
  const afterCancel = await evaluate(`({ config: localStorage.getItem('shine-aac-web-config-v1'), ui: localStorage.getItem('shine-aac-web-ui-v1') })`);
  if (JSON.stringify(beforeCancel) !== JSON.stringify(afterCancel)) add("P1", "Cancel persisted unsaved configuration", "Language/theme edits changed storage after Cancel");
  else pass("configuration cancel", "unsaved language/theme edits were discarded");

  await evaluate(`document.querySelector('[data-action="speech-voices"]')?.click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('[data-testid="speech-voice-page"]'))`), "speech voice page");
  const voices = await evaluate(`(() => ({
    title: document.querySelector('#speech-voice-title')?.textContent,
    rows: document.querySelectorAll('.speech-voice-row').length,
    unnamedButtons: [...document.querySelectorAll('.speech-voice-icon-button')].filter((button) => !button.getAttribute('aria-label')).length,
    selectedStyle: (() => {
      const element = document.querySelector('.speech-voice-row:has(input:checked) .speech-voice-title');
      if (!element) return null;
      const style = getComputedStyle(element);
      return { color: style.color, background: getComputedStyle(element.closest('.speech-voice-row')).backgroundColor };
    })()
  }))()`);
  screenshot("speech-voices");
  const voiceContrast = await auditContrast("High-contrast dark voice settings", [
    "#speech-voice-title", ".speech-voice-intro", ".speech-engine-row", ".speech-engine-row small",
    ".speech-voice-section h2", ".speech-voice-row.selected .speech-voice-title", ".speech-voice-row.selected small"
  ], ["screenshots/speech-voices.png"]);
  const voiceQuality = await auditVisualQuality("[data-testid=\"speech-voice-page\"]");
  recordVisualQuality("High-contrast dark voice settings", voiceQuality, ["screenshots/speech-voices.png", "matrix.json"], { darkTheme: true });
  if (voices.unnamedButtons) add("P2", "Unnamed voice controls", `${voices.unnamedButtons} voice control(s) lack labels`, ["screenshots/speech-voices.png"]);
  else pass("speech voice accessibility", `${voices.rows} voice choices exposed with named controls`);
  await evaluate(`document.querySelector('[data-speech-action="back"]')?.click()`);

  await evaluate(`document.querySelector('[data-action="app-info"]')?.click()`);
  await delay(250); screenshot("app-info");
  const appInfoContrast = await auditContrast("High-contrast dark App Info", [
    ".info-header h1", ".info-header strong", ".info-header p", ".info-list dt", ".info-list dd"
  ], ["screenshots/app-info.png"]);
  const appInfoQuality = await auditVisualQuality(".info-panel");
  recordVisualQuality("High-contrast dark App Info", appInfoQuality, ["screenshots/app-info.png", "matrix.json"], { darkTheme: true });
  const appInfo = await evaluate(`document.querySelector('.info-panel')?.innerText ?? ''`);
  if (!/SayToMe AAC/.test(appInfo) || !/0\.3\.4/.test(appInfo) || !/58/.test(appInfo)) add("P1", "English App Info identity or version metadata incorrect", appInfo, ["screenshots/app-info.png"]);
  else pass("App Info", "shows English product name, version 0.3.4, and code 58");
  adbRun(["shell", "input", "keyevent", "4"]); await delay(400);

  await evaluate(`document.querySelector('[data-action="calibrate"]')?.click()`);
  await delay(250); screenshot("input-test");
  const inputTestContrast = await auditContrast("High-contrast dark Input Test", [
    ".calibration-panel h1", ".calibration-intro", ".calibration-intro span", ".mode-button",
    ".calibration-step", ".calibration-step small", ".calibration-live", ".calibration-live span"
  ], ["screenshots/input-test.png"]);
  const inputTestQuality = await auditVisualQuality(".calibration-panel", "", [".config-actions"]);
  recordVisualQuality("High-contrast dark Input Test", inputTestQuality, ["screenshots/input-test.png", "matrix.json"], { darkTheme: true });
  const inputTest = await evaluate(`document.querySelector('.calibration-panel')?.innerText ?? ''`);
  if (!inputTest) add("P1", "Input Test did not open", "No calibration panel appeared", ["screenshots/input-test.png"]);
  else pass("Input Test flow", "opened and returned to configuration");
  adbRun(["shell", "input", "keyevent", "4"]); await delay(400);

  const optionMatrix = [];
  const cases = [
    ...["default", "slower", "cameraLongBlink", "firstCellSupport", "cancelable"].map((value) => [`timing preset ${value}`, { scanTimingPreset: value }]),
    ...["row-column", "block-row-column"].map((value) => [`scan method ${value}`, { scanMode: value }]),
    ...[1, 2, 3, 0].map((value) => [`scan pass limit ${value}`, { scanPassLimit: value }]),
    ...["default", "high-contrast", "high-contrast-dark"].map((value) => [`contrast theme ${value}`, { contrastTheme: value }]),
    ...["hardware-buttons", "volume-buttons", "camera-long-blink", "hardware-and-camera", "off"].map((value) => [`switch input ${value}`, { switchInputProfile: value }]),
    ["numeric lower bounds", { columns: 2, scanIntervalMs: 300, transitionPauseMs: 0, firstCellPauseMs: 300, inputLatencyCompensationMs: 0 }],
    ["numeric upper bounds", { columns: 8, scanIntervalMs: 5000, transitionPauseMs: 4000, firstCellPauseMs: 6000, inputLatencyCompensationMs: 1200 }],
    ["language English", { profileId: "en-US" }],
    ["language Traditional Chinese", { profileId: "zh-TW" }]
  ];
  for (const [label, values] of cases) {
    const snapshot = await verifyRoundTrip(label, values);
    optionMatrix.push({ label, values, saved: snapshot.values });
    if (label === "contrast theme high-contrast") {
      await evaluate(`document.querySelector('[data-action="cancel"]')?.click()`);
      screenshot("high-contrast-light-board");
      await openConfig();
    }
  }

  await verifyRoundTrip("reset setup", {
    profileId: "zh-TW",
    columns: 2,
    scanMode: "block-row-column",
    scanPassLimit: 0,
    rowScanVoice: true,
    scanVoice: false,
    activationVoice: false,
    switchInputProfile: "off",
    contrastTheme: "high-contrast-dark"
  });
  await evaluate(`document.querySelector('[data-action="reset"]')?.click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('[data-testid="reset-confirmation"]'))`), "reset confirmation");
  screenshot("reset-confirmation");
  const resetConfirmation = await evaluate(`document.querySelector('[data-testid="reset-confirmation"]')?.innerText ?? ''`);
  if (!/文字記錄會保留/.test(resetConfirmation)) add("P1", "Reset confirmation omits data-retention scope", resetConfirmation, ["screenshots/reset-confirmation.png"]);
  await evaluate(`document.querySelector('[data-reset-action="cancel"]')?.click()`);
  const afterResetCancel = await formSnapshot();
  const resetCancelMismatches = mismatchedValues(afterResetCancel, {
    profileId: "zh-TW", columns: 2, scanMode: "block-row-column", scanPassLimit: 0,
    rowScanVoice: true, scanVoice: false, activationVoice: false,
    switchInputProfile: "off", contrastTheme: "high-contrast-dark"
  });
  if (resetCancelMismatches.length) add("P1", "Canceling reset changed configuration", JSON.stringify(resetCancelMismatches), ["screenshots/reset-confirmation.png"]);
  else pass("reset cancellation", "confirmation explains retained history and Cancel preserves the form");
  await evaluate(`document.querySelector('[data-action="reset"]')?.click()`);
  await evaluate(`document.querySelector('[data-reset-action="confirm"]')?.click()`);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-button')) && !document.querySelector('.config-panel')`), "reset board");
  await openConfig();
  const resetSnapshot = await formSnapshot();
  const expectedReset = {
    profileId: "zh-TW", columns: "6", scanMode: "row-column", scanTimingPreset: "default",
    scanIntervalMs: "1800", transitionPauseMs: "0", firstCellPauseMs: "2400",
    inputLatencyCompensationMs: "250", scanPassLimit: "2",
    autoScanSuggestionPages: false, deferUnsupportedZhuyinOnFirstPass: true,
    rowScanVoice: false, scanVoice: true, activationVoice: true,
    restartScanFromTop: true, verticalGroupProgress: false,
    switchInputProfile: "hardware-buttons", contrastTheme: "default"
  };
  const resetMismatches = mismatchedValues(resetSnapshot, expectedReset);
  if (resetMismatches.length) add("P1", "Reset did not restore packaged defaults", JSON.stringify(resetMismatches), ["option-matrix.json"]);
  else pass("configuration reset", "restored zh-TW board and UI defaults");

  await evaluate(`document.querySelector('[data-action="export-text"]')?.click()`);
  await delay(900);
  const activityDump = adbRun(["shell", "dumpsys", "activity", "activities"]);
  const exportActivity = activityDump.split(/\r?\n/).find((line) => /mResumedActivity|topResumedActivity/.test(line))?.trim() || "";
  screenshot("export-document-picker");
  if (!/documentsui|files|picker/i.test(exportActivity)) {
    add("P1", "Export text did not open Android document picker", exportActivity || "No resumed activity", ["screenshots/export-document-picker.png"]);
  } else {
    pass("text export launch", exportActivity);
  }
  adbRun(["shell", "input", "keyevent", "4"]);
  await delay(600);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.config-panel form'))`), "configuration after export cancellation");
  pass("text export cancellation", "returned to Configuration without saving a document");

  writeFileSync(resolve(outDir, "matrix.json"), JSON.stringify({
    matrix,
    saved,
    voices,
    contrast: { board: boardContrast, configuration: configContrast, voiceSettings: voiceContrast, appInfo: appInfoContrast, inputTest: inputTestContrast },
    visualQuality: { configuration: darkConfigQuality, voiceSettings: voiceQuality, appInfo: appInfoQuality, inputTest: inputTestQuality }
  }, null, 2));
  writeFileSync(resolve(outDir, "option-matrix.json"), JSON.stringify({ cases: optionMatrix, reset: resetSnapshot }, null, 2));
}

try {
  await main();
} catch (error) {
  add("P0", "Configuration audit aborted", error.stack || String(error));
} finally {
  try { await restoreOriginal(); } catch (error) { add("P1", "Original configuration restore failed", String(error)); }
  try { cdp?.close(); } catch {}
  try { adbRun(["forward", "--remove", `tcp:${port}`]); } catch {}
  try { adbRun(["shell", "input", "keyevent", "223"]); } catch {} // SLEEP
}

const order = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
findings.sort((left, right) => order[left.priority] - order[right.priority] || left.title.localeCompare(right.title));
const lines = ["# SHINE AAC real-device configuration audit", "", "## Findings", ""];
if (!findings.length) lines.push("No automated findings.", "");
for (const finding of findings) {
  lines.push(`- **${finding.priority} — ${finding.title}:** ${finding.detail}`);
  if (finding.evidence.length) lines.push(`  Evidence: ${finding.evidence.map((item) => `\`${item}\``).join(", ")}`);
}
lines.push("", "## Passed checks", "", ...passes.map((item) => `- ${item.title}${item.detail ? `: ${item.detail}` : ""}`), "");
for (const priority of ["P0", "P1", "P2", "P3", "P4"]) lines.push(`${priority}: ${findings.filter((item) => item.priority === priority).length}`);
lines.push(`Passed checks: ${passes.length}`);
writeFileSync(resolve(outDir, "FINDINGS.md"), lines.join("\n"));
writeFileSync(resolve(outDir, "summary.json"), JSON.stringify({ findings, passes }, null, 2));
console.log(lines.slice(-6).join("\n"));
console.log(`Report: ${resolve(outDir, "FINDINGS.md")}`);
process.exitCode = findings.some((item) => item.priority === "P0" || item.priority === "P1") ? 1 : 0;
