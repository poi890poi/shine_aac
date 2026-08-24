import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const artifactDir = join(repoRoot, "e2e-artifacts");
mkdirSync(artifactDir, { recursive: true });

const webPort = Number(process.env.SHINE_AAC_WEB_PORT ?? 5173);
const debugPort = Number(process.env.SHINE_AAC_CDP_PORT ?? 9223);
const edgePath = process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profileDir = join(process.env.TEMP ?? artifactDir, `shine-aac-edge-${Date.now()}`);
const packagedWebViewMode = process.argv.includes("--packaged-webview");
const timingOnlyMode = process.argv.includes("--timing-only");
const cumulativeTimingMode = process.argv.includes("--cumulative-timing");
const zhTwLayoutOnlyMode = process.argv.includes("--zh-tw-layout-only");
const zhTwLanguageSwitchOnlyMode = process.argv.includes("--zh-tw-language-switch-only");
const blockModeOnly = process.argv.includes("--block-only") ||
  process.argv.includes("--four-block-only") ||
  process.argv.includes("--five-block-only");
const noBrowserSandboxMode = process.argv.includes("--no-browser-sandbox");
const packagedReferenceMode = Boolean(process.env.SHINE_AAC_APP_PATH);
const appPath = process.env.SHINE_AAC_APP_PATH ?? (packagedWebViewMode
  ? "/app/build/generated/assets/shineWeb/www/apps/web/"
  : "/apps/web/");
const appUrl = `http://127.0.0.1:${webPort}${appPath}`;
const HttpStartupTimeoutMs = 30000;
const UiWaitTimeoutMs = 30000;
const DemoStartTimeoutMs = 10000;
const DemoStopTimeoutMs = 60000;
const CalibrationWaitTimeoutMs = 10000;
const BrowserSmokeScanMs = 500;
const CumulativeScanIntervalMs = Number(process.env.SHINE_AAC_SCAN_INTERVAL_MS ?? 300);
const CumulativeScanTransitionCount = Number(process.env.SHINE_AAC_SCAN_TRANSITIONS ?? 80);
const CpuThrottleRate = Number(process.env.SHINE_AAC_CPU_THROTTLE ?? 1);

const steps = [];
let serverProcess;
let edgeProcess;
let cdp;

async function main() {
try {
  if (packagedWebViewMode) {
    const buildResult = spawnSync(process.execPath, [join(repoRoot, "scripts/build-webview-assets.mjs")], {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true
    });
    if (buildResult.status !== 0) {
      throw new Error(`Packaged WebView build failed: ${buildResult.stderr || buildResult.stdout}`);
    }
    steps.push(pass("packaged-webview-build", "built Android WebView assets with esbuild"));
  }
  serverProcess = spawn(process.execPath, [join(repoRoot, "apps/web/server.mjs"), "--port", String(webPort)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  serverProcess.stdout.on("data", (data) => process.stdout.write(data));
  serverProcess.stderr.on("data", (data) => process.stderr.write(data));
  await waitForHttp(appUrl, HttpStartupTimeoutMs);
  steps.push(pass("server", `served ${appUrl}`));

  edgeProcess = spawn(edgePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-features=Vulkan,WebGPU",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    ...(noBrowserSandboxMode ? ["--no-sandbox", "--disable-gpu-sandbox"] : []),
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "about:blank"
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  edgeProcess.stderr.on("data", (data) => {
    const text = data.toString();
    if (!text.includes("DevTools listening")) process.stderr.write(text);
  });

  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, HttpStartupTimeoutMs);
  const target = await createTarget(appUrl);
  cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  if (CpuThrottleRate > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CpuThrottleRate });
    steps.push(pass("cpu-throttle", `${CpuThrottleRate}x CPU slowdown`));
  }
  await waitForRenderedBoard();
  steps.push(pass("browser-load", "rendered board and message panel"));

  const firstRunSnapshot = await getSnapshot();
  const firstRunLabels = firstRunSnapshot.rows.flat().map((tile) => tile.label);
  if (!cumulativeTimingMode && (!firstRunLabels.includes("\u3105") || firstRunLabels.includes("I"))) {
    throw new Error(`Clean first launch did not use the zh-TW profile: ${JSON.stringify(firstRunLabels)}`);
  }
  const firstRunHeader = await evaluate(`({
    phase: document.querySelector(".phase")?.textContent ?? "",
    voice: document.querySelector(".voice")?.textContent ?? "",
    settings: document.querySelector(".config-button")?.textContent ?? ""
  })`);
  if (!packagedReferenceMode && (
    firstRunHeader.phase !== "暫停確認" ||
    /Rows|First|Symbols/.test(firstRunHeader.phase) ||
    !firstRunHeader.voice.startsWith("語音：") ||
    firstRunHeader.settings !== "⚙ 設定"
  )) {
    throw new Error(`Clean first launch header is not instructional zh-TW: ${JSON.stringify(firstRunHeader)}`);
  }
  if (!cumulativeTimingMode) {
    steps.push(pass("first-run-profile", "clean storage opens the zh-TW board with instructional status and a distinct Settings control"));
    await scenarioInitialFirstRowHold(firstRunSnapshot);
  }

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true
    }));
    localStorage.removeItem("shine-aac-text-history-v1");
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();
  steps.push(pass("test-config", "seeded browser smoke scan timing through browser localStorage"));

  if (blockModeOnly) {
    await scenarioSingletonRowAutoActivation();
    await scenarioBlockRowColumnMode();
    writeReport(true);
    console.log("BLOCK E2E PASS");
    process.exitCode = 0;
    return;
  }

  if (zhTwLayoutOnlyMode) {
    await scenarioZhTwLayoutMigration();
    writeReport(true);
    console.log("ZH-TW LAYOUT E2E PASS");
    process.exitCode = 0;
    return;
  }
  if (zhTwLanguageSwitchOnlyMode) {
    await scenarioZhTwLanguageSwitchReviewHold();
    writeReport(true);
    console.log("ZH-TW LANGUAGE SWITCH E2E PASS");
    process.exitCode = 0;
    return;
  }

  if (cumulativeTimingMode) {
    await scenarioCumulativeScanTiming();
    writeReport(true);
    console.log("CUMULATIVE SCAN TIMING E2E PASS");
    process.exitCode = 0;
    return;
  }

  if (!timingOnlyMode) await scenarioVisibleEscapeLadder();

  await scenarioStrictScanTiming();
  if (timingOnlyMode) {
    writeReport(true);
    console.log("SCAN TIMING E2E PASS");
    process.exitCode = 0;
    return;
  }

  await scenarioFirstColumnProgressTiming();
  await scenarioCameraHoldPausesScan();
  await scenarioCameraHoldActivationIsImmediate();
  await scenarioEnglishFilledRows();
  await scenarioPhraseAndUndo();
  await scenarioClearAndMovie();
  await scenarioHistoryUpgradeMigration();
  await scenarioReviewHold();
  await scenarioInputCalibration();
  await scenarioConfigProfileRelevance();
  await scenarioAppInfoPage();
  await scenarioTextExportResult();
  await scenarioSpeechVoiceSettings();
  await scenarioBackNavigation();
  await scenarioDeveloperDemoMode();
  await assertNoViewportOverflow("pixel-4a-5g-layout");
  await scenarioTabletViewportCompatibility();
  await scenarioLargeTextLabelCompatibility();
  await scenarioLongEnglishSuggestionSpans();
  await scenarioZhTwLayoutMigration();
  await scenarioAutoScanMorePages();
  await scenarioDeferredZhuyinFirstPass();
  await scenarioZhTwResetUsesPackagedDefaults();
  await scenarioFunctionLabelScaleMatrix();
  await scenarioZhTwLocaleConsistency();
  await scenarioZhTwLanguageSwitchReviewHold();
  await assertNoViewportOverflow("zh-tw-pixel-4a-5g-layout");
  await scenarioZhTwHomeDemoMode();
  await scenarioSingletonRowAutoActivation();
  await scenarioBlockRowColumnMode();

  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const screenshotPath = join(artifactDir, "web-e2e-final.png");
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  steps.push(pass("screenshot", screenshotPath));

  writeReport(true);
  console.log("WEB E2E PASS");
  process.exitCode = 0;
} catch (error) {
  steps.push(fail("fatal", error?.stack ?? String(error)));
  writeReport(false);
  console.error("WEB E2E FAIL");
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
} finally {
  cdp?.close();
  edgeProcess?.kill();
  serverProcess?.kill();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}
}

async function scenarioPhraseAndUndo() {
  await assertMessage("");
  await selectLabel("I");
  await assertMessage("I ");
  await assertSuggestionLabels(["UNDO", "THE", "TO", "OF"]);
  await selectLabel("WANT");
  await assertMessage("I want ");
  await assertSuggestionLabels(["UNDO", "THE", "TO", "OF"]);
  await selectLabel("WATER");
  await assertMessage("I want water ");
  steps.push(pass("phrase", "entered I want water with automatic trailing space through visible row/column scanning"));

  await selectLabel("UNDO", { rowIndex: 0 });
  await assertMessage("I want ");
  await selectLabel("FOOD");
  await assertMessage("I want food ");
  steps.push(pass("undo-correction", "undid WATER and selected FOOD"));

  const history = await evaluate(`
    (() => {
      const stored = JSON.parse(localStorage.getItem("shine-aac-text-history-v1") ?? "{}");
      return {
        version: stored.version,
        entries: stored.entries ?? [],
        exported: globalThis.ShineAacTextHistory.exportText()
      };
    })()
  `);
  if (history.version !== 3) throw new Error(`Text history version missing: ${JSON.stringify(history)}`);
  if (history.entries.length !== 1 || history.entries[0].text !== "I want food " || history.entries[0].closed !== false) {
    throw new Error(`Text history did not update one live line through edits: ${JSON.stringify(history.entries)}`);
  }
  if (history.exported !== "I want food \n") {
    throw new Error(`Text history export was not one plain-text line: ${JSON.stringify(history.exported)}`);
  }
  steps.push(pass("text-history", "updated one live history line through composition, undo, and correction"));

  await evaluate(`location.reload()`);
  await waitForUi();
  await assertMessage("I want food ");
  steps.push(pass("session-draft", "restored current composed message after reload"));
}

async function scenarioStrictScanTiming() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 24,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: 600,
      transitionPauseMs: 0,
      firstCellPauseMs: 600,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();

  await evaluate(`
    (() => {
      globalThis.__strictScanTiming?.observer?.disconnect();
      const appElement = document.querySelector("#app");
      const state = {
        events: [],
        lastTarget: "",
        activationScheduled: false,
        selectionScheduled: false,
        reviewReleaseScheduled: false,
        resetRequestedAt: 0,
        observer: null,
        transitionListener: null
      };
      const targetState = () => {
        const phase = document.querySelector(".phase")?.dataset.scanPhase ?? "";
        const tile = document.querySelector(".tile.is-current");
        const row = tile?.closest(".row");
        const board = row?.closest(".board");
        const rowIndex = row && board ? [...board.children].indexOf(row) : -1;
        const cellIndex = tile && row ? [...row.children].indexOf(tile) : -1;
        return { phase, rowIndex, cellIndex, signature: phase + ":" + rowIndex + ":" + cellIndex };
      };
      const record = (kind, details = {}) => {
        state.events.push({ kind, at: performance.now(), ...targetState(), ...details });
      };
      const recordTarget = () => {
        const current = targetState();
        if (current.rowIndex < 0 || current.signature === state.lastTarget) return;
        state.lastTarget = current.signature;
        state.events.push({ kind: "target", at: performance.now(), ...current });
        if (current.phase === "Review" && state.selectionScheduled && !state.reviewReleaseScheduled) {
          state.reviewReleaseScheduled = true;
          window.setTimeout(() => {
            record("activation", { purpose: "selection-hold-release" });
            globalThis.ShineAacInput.receive({ intent: "activate", source: "timing-probe" });
          }, 40);
        }
      };
      state.observer = new MutationObserver(recordTarget);
      state.observer.observe(appElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      state.transitionListener = (event) => {
        if (event.propertyName !== "transform" || !event.target.matches(".progress-fill")) return;
        const firstActiveFill = document.querySelector(".tile.is-current .progress-fill");
        if (event.target !== firstActiveFill) return;
        const kind = event.type === "transitionrun" ? "progress-run" : "progress-end";
        const durationMs = Number.parseFloat(getComputedStyle(event.target).transitionDuration) * 1000;
        record(kind, { durationMs });
        const current = targetState();
        if (
          kind === "progress-run" &&
          current.phase === "Rows" &&
          current.rowIndex === 1 &&
          !state.activationScheduled
        ) {
          state.activationScheduled = true;
          window.setTimeout(() => {
            record("activation", { purpose: "row" });
            globalThis.ShineAacInput.receive({ intent: "activate", source: "timing-probe" });
          }, Math.min(400, Math.max(120, durationMs * 0.35)));
        }
        if (
          kind === "progress-run" &&
          current.phase === "Symbols" &&
          current.cellIndex === 2 &&
          !state.selectionScheduled
        ) {
          state.selectionScheduled = true;
          window.setTimeout(() => {
            record("activation", { purpose: "selection" });
            globalThis.ShineAacInput.receive({ intent: "activate", source: "timing-probe" });
          }, Math.min(400, Math.max(120, durationMs * 0.35)));
        }
      };
      appElement.addEventListener("transitionrun", state.transitionListener);
      appElement.addEventListener("transitionend", state.transitionListener);
      globalThis.__strictScanTiming = state;

      document.querySelector(".config-button")?.click();
      const resetButton = document.querySelector('[data-action="reset"]');
      if (!resetButton) throw new Error("Timing probe could not open configuration");
      state.events.length = 0;
      state.lastTarget = "";
      state.resetRequestedAt = performance.now();
      resetButton.click();
      window.setTimeout(() => {
        record("activation", { purpose: "startup-hold" });
        globalThis.ShineAacInput.receive({ intent: "activate", source: "timing-probe" });
      }, 40);
    })()
  `);
  await delay(8000);
  const trace = await evaluate(`
    (() => {
      const state = globalThis.__strictScanTiming;
      state?.observer?.disconnect();
      if (state?.transitionListener) {
        document.querySelector("#app")?.removeEventListener("transitionrun", state.transitionListener);
        document.querySelector("#app")?.removeEventListener("transitionend", state.transitionListener);
      }
      return { resetRequestedAt: state?.resetRequestedAt ?? 0, events: state?.events ?? [] };
    })()
  `);

  const eventAfter = (kind, afterAt, predicate = () => true) => trace.events.find((event) =>
    event.kind === kind && event.at >= afterAt && predicate(event)
  );
  const resetTarget = eventAfter("target", trace.resetRequestedAt, (event) => event.phase === "Rows");
  const rowRun = eventAfter("progress-run", resetTarget?.at ?? trace.resetRequestedAt, (event) => event.phase === "Rows");
  const nextRowTarget = eventAfter("target", rowRun?.at ?? trace.resetRequestedAt, (event) => event.phase === "Rows" && event.rowIndex === 1);
  const nextRowRun = eventAfter("progress-run", nextRowTarget?.at ?? trace.resetRequestedAt, (event) => event.phase === "Rows" && event.rowIndex === 1);
  const activation = eventAfter("activation", nextRowRun?.at ?? trace.resetRequestedAt, (event) => event.purpose === "row");
  const firstTarget = eventAfter("target", activation?.at ?? trace.resetRequestedAt, (event) => event.phase === "First");
  const firstRun = eventAfter("progress-run", firstTarget?.at ?? trace.resetRequestedAt, (event) => event.phase === "First");
  const secondTarget = eventAfter("target", firstRun?.at ?? trace.resetRequestedAt, (event) => event.phase === "Symbols" && event.cellIndex === 1);
  const secondRun = eventAfter("progress-run", secondTarget?.at ?? trace.resetRequestedAt, (event) => event.phase === "Symbols" && event.cellIndex === 1);
  const thirdTarget = eventAfter("target", secondRun?.at ?? trace.resetRequestedAt, (event) => event.phase === "Symbols" && event.cellIndex === 2);
  const thirdRun = eventAfter("progress-run", thirdTarget?.at ?? trace.resetRequestedAt, (event) => event.phase === "Symbols" && event.cellIndex === 2);
  const selectionActivation = eventAfter("activation", thirdRun?.at ?? trace.resetRequestedAt, (event) => event.purpose === "selection");
  const postSelectionHold = eventAfter("target", selectionActivation?.at ?? trace.resetRequestedAt, (event) => event.phase === "Review");
  const holdReleaseActivation = eventAfter("activation", postSelectionHold?.at ?? trace.resetRequestedAt, (event) => event.purpose === "selection-hold-release");
  const postSelectionTarget = eventAfter("target", holdReleaseActivation?.at ?? trace.resetRequestedAt, (event) => event.phase === "Rows");
  const postSelectionRun = eventAfter("progress-run", postSelectionTarget?.at ?? trace.resetRequestedAt, (event) => event.phase === "Rows");
  const required = {
    resetTarget,
    rowRun,
    nextRowTarget,
    nextRowRun,
    activation,
    firstTarget,
    firstRun,
    secondTarget,
    secondRun,
    thirdTarget,
    thirdRun,
    selectionActivation,
    postSelectionHold,
    holdReleaseActivation,
    postSelectionTarget,
    postSelectionRun
  };
  if (Object.values(required).some((event) => !event)) {
    throw new Error(`Strict scan timing trace is incomplete: ${JSON.stringify(trace)}`);
  }
  if (postSelectionHold.rowIndex !== 0 || postSelectionHold.cellIndex !== 0) {
    throw new Error(`State-change hold should stay on row 1: ${JSON.stringify(postSelectionHold)}`);
  }

  const metrics = {
    resetToTargetMs: resetTarget.at - trace.resetRequestedAt,
    resetTargetToProgressMs: rowRun.at - resetTarget.at,
    rowDeadlineDriftMs: nextRowTarget.at - (rowRun.at + rowRun.durationMs),
    nextRowTargetToProgressMs: nextRowRun.at - nextRowTarget.at,
    activationToTargetMs: firstTarget.at - activation.at,
    activationTargetToProgressMs: firstRun.at - firstTarget.at,
    firstDeadlineDriftMs: secondTarget.at - (firstRun.at + firstRun.durationMs),
    secondTargetToProgressMs: secondRun.at - secondTarget.at,
    laterDeadlineDriftMs: thirdTarget.at - (secondRun.at + secondRun.durationMs),
    thirdTargetToProgressMs: thirdRun.at - thirdTarget.at,
    selectionToHoldMs: postSelectionHold.at - selectionActivation.at,
    holdReleaseToTargetMs: postSelectionTarget.at - holdReleaseActivation.at,
    selectionTargetToProgressMs: postSelectionRun.at - postSelectionTarget.at
  };
  const maximumVisibleGapMs = 80;
  const maximumDeadlineDriftMs = 50;
  const failures = [
    ["reset to target", metrics.resetToTargetMs, maximumVisibleGapMs],
    ["reset target to progress", metrics.resetTargetToProgressMs, maximumVisibleGapMs],
    ["next row target to progress", metrics.nextRowTargetToProgressMs, maximumVisibleGapMs],
    ["activation to target", metrics.activationToTargetMs, maximumVisibleGapMs],
    ["activation target to progress", metrics.activationTargetToProgressMs, maximumVisibleGapMs],
    ["second target to progress", metrics.secondTargetToProgressMs, maximumVisibleGapMs],
    ["third target to progress", metrics.thirdTargetToProgressMs, maximumVisibleGapMs],
    ["selection to hold", metrics.selectionToHoldMs, maximumVisibleGapMs],
    ["hold release to target", metrics.holdReleaseToTargetMs, maximumVisibleGapMs],
    ["selection target to progress", metrics.selectionTargetToProgressMs, maximumVisibleGapMs]
  ].filter(([, value, limit]) => value < 0 || value > limit);
  for (const [name, value] of [
    ["row deadline drift", metrics.rowDeadlineDriftMs],
    ["first deadline drift", metrics.firstDeadlineDriftMs],
    ["later deadline drift", metrics.laterDeadlineDriftMs]
  ]) {
    if (Math.abs(value) > maximumDeadlineDriftMs) failures.push([name, value, maximumDeadlineDriftMs]);
  }
  if (failures.length > 0) {
    throw new Error(`Strict scan timing gaps exceeded limits: ${JSON.stringify({ metrics, failures, events: trace.events })}`);
  }
  steps.push(pass("strict-scan-timing", `non-polling trace ${JSON.stringify(metrics)}`));
  await selectLabel("CLR", { activationDelayMs: 300 });
  await assertMessage("");
  await evaluate(`
    localStorage.removeItem("shine-aac-text-history-v1");
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();
}

async function scenarioCumulativeScanTiming() {
  const intervalMs = Math.max(100, CumulativeScanIntervalMs);
  const transitionCount = Math.max(20, Math.trunc(CumulativeScanTransitionCount));
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 24,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${intervalMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${intervalMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      switchInputProfile: "hardware-buttons"
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();

  const rowMetrics = await measureAutomaticScanTransitions("row", transitionCount, intervalMs);
  const cellMetrics = await measureCellScanTransitions(transitionCount, intervalMs);
  const metrics = {
    appPath,
    intervalMs,
    transitionCount,
    cpuThrottleRate: CpuThrottleRate,
    row: rowMetrics,
    cell: cellMetrics.transitions,
    rowActivationToFirstCellMs: cellMetrics.rowActivationToFirstCellMs,
    cellActivationToFirstRowMs: cellMetrics.cellActivationToFirstRowMs
  };
  const outputPath = join(artifactDir, "scan-timing-benchmark.json");
  writeFileSync(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`SCAN_TIMING_METRICS ${JSON.stringify(metrics)}`);
  const maximumExcessPerTransitionMs = Number(process.env.SHINE_AAC_SCAN_MAX_EXCESS_MS ?? 15);
  const maximumP95ExcessMs = Number(process.env.SHINE_AAC_SCAN_MAX_P95_EXCESS_MS ?? 35);
  const maximumSingleExcessMs = Number(process.env.SHINE_AAC_SCAN_MAX_SINGLE_EXCESS_MS ?? 100);
  const maximumActivationMs = Number(process.env.SHINE_AAC_SCAN_MAX_ACTIVATION_MS ?? 75);
  const failures = [
    ["row mean absolute drift", Math.abs(rowMetrics.excessPerTransitionMs), maximumExcessPerTransitionMs],
    ["cell mean absolute drift", Math.abs(cellMetrics.transitions.excessPerTransitionMs), maximumExcessPerTransitionMs],
    ["row p95 excess", rowMetrics.p95IntervalMs - intervalMs, maximumP95ExcessMs],
    ["cell p95 excess", cellMetrics.transitions.p95IntervalMs - intervalMs, maximumP95ExcessMs],
    ["row maximum excess", rowMetrics.maximumIntervalMs - intervalMs, maximumSingleExcessMs],
    ["cell maximum excess", cellMetrics.transitions.maximumIntervalMs - intervalMs, maximumSingleExcessMs],
    ["row activation to first cell", cellMetrics.rowActivationToFirstCellMs, maximumActivationMs],
    ["cell activation to first row", cellMetrics.cellActivationToFirstRowMs, maximumActivationMs]
  ].filter(([, measured, maximum]) => measured > maximum);
  if (failures.length > 0) {
    throw new Error(`Cumulative scan timing acceptance failed: ${JSON.stringify(failures)}`);
  }
  steps.push(pass("cumulative-scan-timing", JSON.stringify(metrics)));
}

async function measureAutomaticScanTransitions(mode, transitionCount, intervalMs) {
  return evaluate(`
    (() => new Promise((resolve, reject) => {
      const desiredMode = ${JSON.stringify(mode)};
      const transitionCount = ${transitionCount};
      const intervalMs = ${intervalMs};
      const samples = [];
      let lastSignature = "";
      let timeoutId = 0;
      const currentTarget = () => {
        const selector = desiredMode === "row" ? ".tile.active-row" : ".tile.active-cell";
        const tile = document.querySelector(selector);
        const row = tile?.closest(".row");
        const board = row?.closest(".board");
        if (!tile || !row || !board) return null;
        const rowIndex = [...board.children].indexOf(row);
        const cellIndex = [...row.children].indexOf(tile);
        return { rowIndex, cellIndex, signature: rowIndex + ":" + cellIndex };
      };
      const finish = () => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
        const measuredSamples = samples.slice(1);
        const intervals = measuredSamples.slice(1).map((sample, index) => sample.at - measuredSamples[index].at);
        const sorted = [...intervals].sort((left, right) => left - right);
        const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
        const actualTotalMs = measuredSamples.at(-1).at - measuredSamples[0].at;
        const expectedTotalMs = transitionCount * intervalMs;
        resolve({
          samples: transitionCount,
          expectedTotalMs,
          actualTotalMs,
          meanIntervalMs: actualTotalMs / transitionCount,
          excessTotalMs: actualTotalMs - expectedTotalMs,
          excessPerTransitionMs: (actualTotalMs - expectedTotalMs) / transitionCount,
          minimumIntervalMs: sorted[0] ?? 0,
          medianIntervalMs: percentile(0.5),
          p95IntervalMs: percentile(0.95),
          maximumIntervalMs: sorted.at(-1) ?? 0
        });
      };
      const record = () => {
        const target = currentTarget();
        if (!target || target.signature === lastSignature) return;
        lastSignature = target.signature;
        samples.push({ at: performance.now(), ...target });
        if (samples.length >= transitionCount + 2) finish();
      };
      const observer = new MutationObserver(record);
      observer.observe(document.querySelector("#app"), {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      record();
      timeoutId = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("Cumulative " + desiredMode + " scan timed out after " + samples.length + " targets"));
      }, transitionCount * intervalMs + 20000);
    }))()
  `);
}

async function measureCellScanTransitions(transitionCount, intervalMs) {
  const activationAndTransitions = await evaluate(`
    (() => new Promise((resolve, reject) => {
      const transitionCount = ${transitionCount};
      const intervalMs = ${intervalMs};
      const samples = [];
      let lastSignature = "";
      let firstCellAt = 0;
      let timeoutId = 0;
      const activatedAt = performance.now();
      const currentCell = () => {
        const tile = document.querySelector(".tile.active-cell");
        const row = tile?.closest(".row");
        const board = row?.closest(".board");
        if (!tile || !row || !board) return null;
        const rowIndex = [...board.children].indexOf(row);
        const cellIndex = [...row.children].indexOf(tile);
        return { rowIndex, cellIndex, signature: rowIndex + ":" + cellIndex };
      };
      const finish = () => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
        const measuredSamples = samples.slice(1);
        const intervals = measuredSamples.slice(1).map((sample, index) => sample.at - measuredSamples[index].at);
        const sorted = [...intervals].sort((left, right) => left - right);
        const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
        const actualTotalMs = measuredSamples.at(-1).at - measuredSamples[0].at;
        const expectedTotalMs = transitionCount * intervalMs;
        resolve({
          rowActivationToFirstCellMs: firstCellAt - activatedAt,
          transitions: {
            samples: transitionCount,
            expectedTotalMs,
            actualTotalMs,
            meanIntervalMs: actualTotalMs / transitionCount,
            excessTotalMs: actualTotalMs - expectedTotalMs,
            excessPerTransitionMs: (actualTotalMs - expectedTotalMs) / transitionCount,
            minimumIntervalMs: sorted[0] ?? 0,
            medianIntervalMs: percentile(0.5),
            p95IntervalMs: percentile(0.95),
            maximumIntervalMs: sorted.at(-1) ?? 0
          }
        });
      };
      const record = () => {
        const target = currentCell();
        if (!target || target.signature === lastSignature) return;
        const now = performance.now();
        if (!firstCellAt) firstCellAt = now;
        lastSignature = target.signature;
        samples.push({ at: now, ...target });
        if (samples.length >= transitionCount + 2) finish();
      };
      const observer = new MutationObserver(record);
      observer.observe(document.querySelector("#app"), {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      globalThis.ShineAacInput.receive({ intent: "activate", source: "timing-probe" });
      record();
      timeoutId = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("Cumulative cell scan timed out after " + samples.length + " targets"));
      }, transitionCount * intervalMs + 20000);
    }))()
  `);

  const cellActivationToFirstRowMs = await evaluate(`
    (() => new Promise((resolve, reject) => {
      let timeoutId = 0;
      const activatedAt = performance.now();
      const findRow = () => document.querySelector(".tile.active-row");
      const finish = () => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
        resolve(performance.now() - activatedAt);
      };
      const observer = new MutationObserver(() => {
        if (findRow()) finish();
      });
      observer.observe(document.querySelector("#app"), {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
      globalThis.ShineAacInput.receive({ intent: "activate", source: "timing-probe" });
      if (findRow()) finish();
      timeoutId = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("Cell activation did not return to row scanning"));
      }, 5000);
    }))()
  `);
  return { ...activationAndTransitions, cellActivationToFirstRowMs };
}

async function scenarioFirstColumnProgressTiming() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: 1200,
      transitionPauseMs: 0,
      firstCellPauseMs: 1800,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      verticalGroupProgress: true,
    }));
    location.reload();
  `);
  await waitForUi();

  let snapshot = await getSnapshot();
  if (snapshot.activeRow?.progressDirection !== "down" || !snapshot.activeRow.progressTransform.startsWith("scaleY(")) {
    throw new Error(`Row progress should descend from the top: ${JSON.stringify(snapshot.activeRow)}`);
  }
  const initialRowProgress = snapshot.activeRow?.progress ?? 100;
  if (initialRowProgress > 25) {
    throw new Error(`Row progress should start from the post-render scan deadline, got ${initialRowProgress}`);
  }

  await delay(520);
  snapshot = await getSnapshot();
  const midRowProgress = snapshot.activeRow?.progress ?? 0;
  if (midRowProgress < 25 || midRowProgress > 70) {
    throw new Error(`Row progress should track scanIntervalMs before activation, got ${midRowProgress}`);
  }

  const rowSnapshot = await waitForActive(
    ({ activeRow }) => activeRow?.rowIndex === 0 && activeRow.progress >= 85,
    "row 0 with late progress",
    5000
  );
  await clickTarget(rowSnapshot.activeRow);

  await waitForActive(({ activeCell }) => activeCell?.rowIndex === 0 && activeCell.cellIndex === 0, "first cell");
  await delay(60);
  snapshot = await getSnapshot();
  if (snapshot.activeCell?.progressDirection !== "right" || !snapshot.activeCell.progressTransform.startsWith("scaleX(")) {
    throw new Error(`Cell progress should remain left-to-right: ${JSON.stringify(snapshot.activeCell)}`);
  }
  const firstCellEarlyProgress = snapshot.activeCell?.progress ?? 100;
  if (firstCellEarlyProgress > 20) {
    throw new Error(`First column progress should restart from its own hold, got ${firstCellEarlyProgress}`);
  }

  await delay(760);
  snapshot = await getSnapshot();
  const firstCellMidProgress = snapshot.activeCell?.progress ?? 0;
  if (firstCellMidProgress < 25 || firstCellMidProgress > 80) {
    throw new Error(`First column progress should track firstCellPauseMs, got ${firstCellMidProgress}`);
  }

  await waitForActive(({ activeCell }) => activeCell?.rowIndex === 0 && activeCell.cellIndex === 1, "second cell", 3000);
  await delay(60);
  snapshot = await getSnapshot();
  const secondCellEarlyProgress = snapshot.activeCell?.progress ?? 100;
  if (secondCellEarlyProgress > 20) {
    throw new Error(`Second column progress should still restart normally, got ${secondCellEarlyProgress}`);
  }

  steps.push(pass("first-column-progress", "first and later cell progress fills restart and track their own scan durations"));
  steps.push(pass(
    "directional-row-cell-progress",
    "row progress descends from the top while individual-cell progress remains left-to-right"
  ));

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioCameraHoldPausesScan() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: 1200,
      transitionPauseMs: 0,
      firstCellPauseMs: 1200,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      switchInputProfile: "camera-long-blink"
    }));
    location.reload();
  `);
  await waitForUi();
  await delay(360);
  let snapshot = await getSnapshot();
  const heldRow = snapshot.activeRow?.rowIndex;
  const heldProgress = snapshot.activeProgress;

  await evaluate(`
    window.ShineAacInput.receive({ intent: "holdStart", source: "android-camera-long-blink" });
  `);
  await delay(80);
  snapshot = await getSnapshot();
  if (snapshot.phase !== "Blink") throw new Error(`Expected Blink phase during camera hold, got ${snapshot.phase}`);
  if (!snapshot.cameraHold) throw new Error("Expected active tile to show camera hold state");
  if (snapshot.activeRow?.rowIndex !== heldRow) throw new Error("Camera hold should keep the active row fixed");
  const frozenProgress = snapshot.activeProgress;
  if (Math.abs(frozenProgress - heldProgress) > 18) {
    throw new Error(`Camera hold should freeze near the detected progress, before=${heldProgress}, after=${frozenProgress}`);
  }

  await delay(620);
  snapshot = await getSnapshot();
  if (snapshot.activeRow?.rowIndex !== heldRow) throw new Error("Camera hold should not advance while eyes are closed");
  if (Math.abs(snapshot.activeProgress - frozenProgress) > 8) {
    throw new Error(`Camera hold progress should stay frozen, got ${snapshot.activeProgress}, expected ${frozenProgress}`);
  }

  await evaluate(`
    window.ShineAacInput.receive({ intent: "holdEnd", source: "android-camera-long-blink" });
  `);
  await delay(320);
  snapshot = await getSnapshot();
  if (snapshot.phase === "Blink") throw new Error("Camera hold should clear after holdEnd");
  if (snapshot.cameraHold) throw new Error("Camera hold class should clear after holdEnd");
  if (snapshot.activeRow?.rowIndex !== heldRow) throw new Error("Camera hold resume should continue the same scan target first");
  if (snapshot.activeProgress <= frozenProgress + 8) {
    throw new Error(`Camera hold resume should continue progress, frozen=${frozenProgress}, resumed=${snapshot.activeProgress}`);
  }
  steps.push(pass("camera-hold-pause", "camera hold freezes current scan target and resumes progress after eyes open"));

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioCameraHoldActivationIsImmediate() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: 1200,
      transitionPauseMs: 0,
      firstCellPauseMs: 1200,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      switchInputProfile: "camera-long-blink"
    }));
    location.reload();
  `);
  await waitForUi();
  await delay(420);
  let snapshot = await getSnapshot();
  const heldRow = snapshot.activeRow?.rowIndex;

  await evaluate(`
    window.ShineAacInput.receive({ intent: "holdStart", source: "android-camera-long-blink" });
  `);
  await delay(620);
  snapshot = await getSnapshot();
  if (snapshot.phase !== "Blink") throw new Error(`Expected Blink phase before camera activation, got ${snapshot.phase}`);
  if (snapshot.activeRow?.rowIndex !== heldRow) throw new Error("Camera hold should keep the row fixed before activation");

  await evaluate(`
    window.ShineAacInput.receive({ intent: "activate", source: "android-camera-long-blink", detail: "longBlinkMs=900" });
  `);
  await delay(80);
  snapshot = await getSnapshot();
  if (snapshot.phase === "Blink") throw new Error("Camera activation should clear Blink phase immediately");
  if (snapshot.cameraHold) throw new Error("Camera activation should clear camera hold styling immediately");
  if (snapshot.phase === "Rows") {
    throw new Error("Camera activation should advance scanner without waiting for holdEnd progress resume");
  }
  steps.push(pass("camera-hold-activation", "accepted long blink activates from frozen scan position without a holdEnd resume delay"));

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioClearAndMovie() {
  await selectLabel("CLR");
  await assertMessage("");
  steps.push(pass("clear", "selected CLR from the visible board"));

  let snapshot = await getSnapshot();
  const visibleICount = snapshot.rows.flat().filter((tile) => tile.label === "I").length;
  if (visibleICount !== 1) {
    throw new Error(`English board should expose exactly one I key, got ${visibleICount}`);
  }

  for (const label of ["M", "O", "V", "I"]) {
    await selectLabel(label, { occurrence: "last" });
  }
  await assertMessage("movi");
  await assertSuggestionLabels(["UNDO", "MOVIE", "MOVING"]);
  snapshot = await getSnapshot();
  const oneCharacterSuggestions = snapshot.rows.slice(0, 2).flat().filter((tile) =>
    tile.action === "append" && Array.from(tile.label.trim()).length <= 1
  );
  if (oneCharacterSuggestions.length > 0) {
    throw new Error(`English suggestion rows exposed one-character items: ${JSON.stringify(oneCharacterSuggestions)}`);
  }
  const spellingSuggestionRows = await evaluate(`document.querySelectorAll(".dynamic-suggestion-row").length`);
  if (spellingSuggestionRows !== 2) {
    throw new Error(`English spelling should keep two ranked suggestion rows, got ${spellingSuggestionRows}`);
  }
  steps.push(pass("english-nonredundancy", "exposed one context-aware I key and no one-character English suggestions"));
  await selectLabel("MOVIE", { rowIndex: 0 });
  await assertMessage("movie ");
  const boundarySuggestionRows = await evaluate(`document.querySelectorAll(".dynamic-suggestion-row").length`);
  if (boundarySuggestionRows !== 2) {
    throw new Error(`English word boundary should preserve two suggestion rows, got ${boundarySuggestionRows}`);
  }
  steps.push(pass("completion", "typed movi and completed to movie with automatic trailing space"));

  await selectLabel("UNDO", { rowIndex: 0 });
  await assertMessage("movi");
  steps.push(pass("undo-completion", "selected UNDO and restored the spelling before whole-word completion"));
  await selectLabel("MOVIE", { rowIndex: 0 });
  await assertMessage("movie ");

  const history = await evaluate(`
    (() => {
      const stored = JSON.parse(localStorage.getItem("shine-aac-text-history-v1") ?? "{}");
      return {
        version: stored.version,
        entries: stored.entries ?? [],
        exported: globalThis.ShineAacTextHistory.exportText()
      };
    })()
  `);
  if (history.version !== 3 || history.entries.length !== 2) {
    throw new Error(`Text reset did not create exactly one new history line: ${JSON.stringify(history)}`);
  }
  if (history.entries[0].text !== "I want food " || history.entries[0].closed !== true) {
    throw new Error(`Previous history line was not closed by CLR: ${JSON.stringify(history.entries)}`);
  }
  if (history.entries[1].text !== "movie " || history.entries[1].closed !== false) {
    throw new Error(`Current history line did not stay live through UNDO: ${JSON.stringify(history.entries)}`);
  }
  if (history.exported !== "I want food \nmovie \n") {
    throw new Error(`Text history export did not use one line per reset: ${JSON.stringify(history.exported)}`);
  }
  steps.push(pass("text-history-reset", "started a new history line only after CLR and kept later edits on that line"));
}

async function scenarioHistoryUpgradeMigration() {
  const versionOne = await evaluate(`
    (() => {
      localStorage.setItem("shine-aac-text-history-v1", JSON.stringify({
        version: 1,
        entries: [
          { id: "legacy-1", profileId: "en-US", source: "switch", effect: "message", text: "m" },
          { id: "legacy-2", profileId: "en-US", source: "switch", effect: "message", text: "mo" },
          { id: "legacy-3", profileId: "en-US", source: "switch", effect: "message", text: "movi" },
          { id: "legacy-4", profileId: "en-US", source: "switch", effect: "message", text: "movie" }
        ]
      }));
      globalThis.ShineAacTextHistory.record();
      return {
        stored: JSON.parse(localStorage.getItem("shine-aac-text-history-v1") ?? "{}"),
        exported: globalThis.ShineAacTextHistory.exportText()
      };
    })()
  `);
  if (versionOne.stored.version !== 3 || versionOne.stored.entries.length !== 1) {
    throw new Error(`Version 1 snapshots were not compacted: ${JSON.stringify(versionOne)}`);
  }
  if (versionOne.stored.entries[0].text !== "movie " || versionOne.stored.entries[0].closed !== false || versionOne.exported !== "movie \n") {
    throw new Error(`Version 1 migration did not retain one live final line: ${JSON.stringify(versionOne)}`);
  }

  const versionTwo = await evaluate(`
    (() => {
      localStorage.setItem("shine-aac-text-history-v1", JSON.stringify({
        version: 2,
        entries: [
          { id: "polluted-1", profileId: "en-US", source: "switch", effect: "message", text: "m", closed: true },
          { id: "polluted-2", profileId: "en-US", source: "switch", effect: "message", text: "mo", closed: true },
          { id: "polluted-3", profileId: "en-US", source: "switch", effect: "message", text: "movi", closed: true },
          { id: "polluted-4", profileId: "en-US", source: "switch", effect: "message", text: "movie", closed: true }
        ]
      }));
      globalThis.ShineAacTextHistory.record();
      return {
        stored: JSON.parse(localStorage.getItem("shine-aac-text-history-v1") ?? "{}"),
        exported: globalThis.ShineAacTextHistory.exportText()
      };
    })()
  `);
  if (versionTwo.stored.version !== 3 || versionTwo.stored.entries.length !== 1) {
    throw new Error(`Code-42 version 2 snapshots were not repaired: ${JSON.stringify(versionTwo)}`);
  }
  if (versionTwo.stored.entries[0].text !== "movie " || versionTwo.stored.entries[0].closed !== false || versionTwo.exported !== "movie \n") {
    throw new Error(`Version 2 repair did not retain one live final line: ${JSON.stringify(versionTwo)}`);
  }
  steps.push(pass("text-history-migration", "compacted version 1 and code-42 version 2 per-input snapshots into one live line"));
}

async function scenarioTextExportResult() {
  await evaluate(`
    (() => {
      globalThis.__textExportTest = { exports: [], opens: 0 };
      globalThis.ShineAacAndroid = {
        exportTextHistory: (text, fileName) => globalThis.__textExportTest.exports.push({ text, fileName }),
        openLastTextExport: () => { globalThis.__textExportTest.opens += 1; }
      };
      document.querySelector('.config-button')?.click();
      document.querySelector('[data-action="export-text"]')?.click();
    })()
  `);
  let state = await evaluate(`
    (() => ({
      calls: globalThis.__textExportTest.exports,
      exportLabel: document.querySelector('[data-action="export-text"]')?.textContent?.trim()
    }))()
  `);
  if (state.calls.length !== 1 || !state.calls[0].fileName.endsWith(".txt") || state.exportLabel !== "Export text") {
    throw new Error(`Text export did not reach the native save flow: ${JSON.stringify(state)}`);
  }

  await evaluate(`
    globalThis.ShineAacTextExport.completed(JSON.stringify({
      fileName: "communication-2026-08-08.txt",
      canOpen: true
    }))
  `);
  state = await evaluate(`
    (() => {
      const dialog = document.querySelector('[data-testid="text-export-result"]');
      return {
        page: globalThis.ShineAacNavigation.currentPage(),
        title: dialog?.querySelector('h1')?.textContent,
        fileName: dialog?.querySelector('.text-export-file strong')?.textContent,
        openLabel: dialog?.querySelector('[data-action="open-export"]')?.textContent
      };
    })()
  `);
  if (
    state.page !== "text-export-result" ||
    state.title !== "Text exported" ||
    state.fileName !== "communication-2026-08-08.txt" ||
    state.openLabel !== "Open text file"
  ) {
    throw new Error(`Successful export did not offer the saved file directly: ${JSON.stringify(state)}`);
  }
  await evaluate(`document.querySelector('[data-action="open-export"]')?.click()`);
  state = await evaluate(`({
    opens: globalThis.__textExportTest.opens,
    page: globalThis.ShineAacNavigation.currentPage(),
    dialog: Boolean(document.querySelector('[data-testid="text-export-result"]'))
  })`);
  if (state.opens !== 1 || state.page !== "config" || state.dialog) {
    throw new Error(`Open exported text action did not return cleanly to Config: ${JSON.stringify(state)}`);
  }

  await evaluate(`
    globalThis.ShineAacTextExport.failed(JSON.stringify({
      fileName: "communication-2026-08-08.txt",
      canOpen: false,
      message: "The file could not be written."
    }))
  `);
  state = await evaluate(`
    (() => {
      const dialog = document.querySelector('[data-testid="text-export-result"]');
      return {
        title: dialog?.querySelector('h1')?.textContent,
        detail: dialog?.querySelector('p')?.textContent,
        hasOpen: Boolean(dialog?.querySelector('[data-action="open-export"]'))
      };
    })()
  `);
  if (state.title !== "Could not export text" || state.detail !== "The file could not be written." || state.hasOpen) {
    throw new Error(`Failed export did not show a clear retry result: ${JSON.stringify(state)}`);
  }
  await evaluate(`
    (() => {
      document.querySelector('[data-action="close-export"]')?.click();
      document.querySelector('[data-action="cancel"]')?.click();
      delete globalThis.ShineAacAndroid;
      delete globalThis.__textExportTest;
    })()
  `);
  steps.push(pass("text-export-result", "shows the saved filename, opens the exact Android document directly, and reports write failures"));
}

async function scenarioReviewHold() {
  await selectLabel("CLR");
  await assertMessage("");
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: false
    }));
    location.reload();
  `);
  await waitForUi();
  await selectLabel("I");
  await assertMessage("I ");

  let snapshot = await getSnapshot();
  if (!snapshot.reviewHold) throw new Error("Review hold should be active after suggestion-changing input");
  if (snapshot.phase !== "Review") throw new Error(`Expected Review phase during hold, got ${snapshot.phase}`);
  if ((snapshot.activeProgress ?? 0) < 99) throw new Error(`Expected held progress fill, got ${snapshot.activeProgress}`);
  const heldRow = snapshot.activeRow?.rowIndex;
  if (heldRow !== 0) throw new Error(`State-change hold should return to row 1, got row ${heldRow}`);
  await delay(700);
  snapshot = await getSnapshot();
  if (snapshot.activeRow?.rowIndex !== heldRow) {
    throw new Error("Review hold should not advance scanning before the next activation");
  }

  await clickTarget(snapshot.activeRow);
  await delay(40);
  snapshot = await getSnapshot();
  if (snapshot.reviewHold) throw new Error("Review hold should release on activation without selecting a tile");
  if (snapshot.message !== "I ") throw new Error(`Review release should not change message, got ${snapshot.message}`);
  steps.push(pass("review-hold", "state changes always hold row 1 and resume on the next activation"));

  await selectLabel("CLR");
  await assertMessage("");
  await evaluate(`
    {
      const stored = JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}");
      localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
        ...stored,
        scanIntervalMs: ${BrowserSmokeScanMs},
        transitionPauseMs: 0,
        firstCellPauseMs: ${BrowserSmokeScanMs},
        inputLatencyCompensationMs: 0,
        scanPassLimit: 0
      }));
    }
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioTabletViewportCompatibility() {
  const viewports = [
    { name: "tablet-portrait-layout", width: 800, height: 1280, deviceScaleFactor: 1.5 },
    { name: "tablet-landscape-layout", width: 1280, height: 800, deviceScaleFactor: 1.5 }
  ];

  for (const viewport of viewports) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      mobile: true
    });
    await evaluate(`
      localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
        profileId: "en-US",
        columns: 4,
        scanIntervalMs: ${BrowserSmokeScanMs},
        transitionPauseMs: 0,
        firstCellPauseMs: ${BrowserSmokeScanMs},
        inputLatencyCompensationMs: 0,
        scanPassLimit: 0
      }));
      localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
        rowScanVoice: false,
        scanVoice: false,
        activationVoice: false,
        restartScanFromTop: true,
      }));
      localStorage.removeItem("shine-aac-session-draft-v1");
      location.reload();
    `);
    await waitForUi();
    await assertNoViewportOverflow(viewport.name);
    await assertConfigActionsVisible(viewport.name);
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  await evaluate(`location.reload()`);
  await waitForUi();
}

async function scenarioLargeTextLabelCompatibility() {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 18,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0,
      symbols: [
        "I", "WANT", "WATER", "HELP",
        "YES", "NO", "TALK", "TOILET",
        "SAY=<speak>", "CLR=<clear>", "UNDO=<undo>"
      ].join("\\n")
    }));
    location.reload();
  `);
  await waitForUi();
  await evaluate(`
    (() => {
      const style = document.createElement("style");
      style.id = "e2e-large-aac-text";
      style.textContent = ".tile { font-size: 56px !important; }";
      document.head.append(style);
      window.dispatchEvent(new Event("resize"));
    })()
  `);
  await delay(250);

  const result = await evaluate(`
    (() => {
      const labels = [...document.querySelectorAll(".tile-label")].filter((label) => label.textContent.length > 0);
      const violations = labels.flatMap((label) => {
        const tile = label.closest(".tile");
        const labelRect = label.getBoundingClientRect();
        const tileRect = tile.getBoundingClientRect();
        const failed = label.scrollWidth > label.clientWidth + 1 ||
          label.scrollHeight > label.clientHeight + 1 ||
          labelRect.left < tileRect.left - 1 || labelRect.right > tileRect.right + 1 ||
          labelRect.top < tileRect.top - 1 || labelRect.bottom > tileRect.bottom + 1;
        return failed ? [{
          text: label.textContent,
          fontSize: label.style.fontSize,
          clientWidth: label.clientWidth,
          scrollWidth: label.scrollWidth,
          clientHeight: label.clientHeight,
          scrollHeight: label.scrollHeight,
          labelRect: { left: labelRect.left, top: labelRect.top, right: labelRect.right, bottom: labelRect.bottom },
          tileRect: { left: tileRect.left, top: tileRect.top, right: tileRect.right, bottom: tileRect.bottom }
        }] : [];
      });
      return {
        labelCount: labels.length,
        fittedCount: labels.filter((label) => label.style.fontSize.length > 0).length,
        belowReadableCount: labels.filter((label) => {
          const tile = label.closest(".tile");
          const acceptedFloor = Math.min(Number.parseFloat(getComputedStyle(tile).fontSize), 18);
          return Number.parseFloat(getComputedStyle(label).fontSize) + 0.75 < acceptedFloor;
        }).length,
        violations
      };
    })()
  `);
  if (result.fittedCount === 0 || result.belowReadableCount > 0 || result.violations.length > 0) {
    throw new Error(`Large AAC text did not fit every fixed cell: ${JSON.stringify(result)}`);
  }
  await assertFunctionKeyPartsFit("large-text-function-key-layout");
  await assertNoViewportOverflow("large-text-phone-layout");
  steps.push(pass("large-text-cell-fit", `fit ${result.labelCount} realistic board labels on one line at 18px or larger without clipping`));

  await evaluate(`document.querySelector("#e2e-large-aac-text")?.remove(); window.dispatchEvent(new Event("resize"));`);
}

async function scenarioLongEnglishSuggestionSpans() {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 23,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0,
      suggestionDictionary: [
        "ACCESSIBILITY=accessibility",
        "ACCESSIBLE=accessible",
        "ACCESSING=accessing",
        "ACCESS=access"
      ].join("\\n"),
      symbols: [
        "I", "WANT", "WATER", "HELP",
        "YES", "NO", "TALK", "TOILET",
        "SAY=<speak>", "CLR=<clear>", "UNDO=<undo>"
      ].join("\\n")
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();
  await delay(300);

  const defaultLayout = await evaluate(`
    (() => {
      const row = document.querySelector(".dynamic-suggestion-row");
      const wordTiles = [...row.querySelectorAll('.tile[data-action="append"]')]
        .filter((tile) => tile.dataset.label.length > 1);
      const first = wordTiles[0];
      const label = first?.querySelector(".tile-label");
      return {
        visualColumns: Number(row?.dataset.visualColumns),
        wordCount: wordTiles.length,
        firstLabel: first?.dataset.label,
        firstSpan: Number(first?.dataset.columnSpan),
        tileFontSize: Number.parseFloat(getComputedStyle(first).fontSize),
        labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
        clipped: label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1
      };
    })()
  `);
  if (
    defaultLayout.firstLabel !== "ACCESSIBILITY" ||
    defaultLayout.firstSpan < 2 ||
    defaultLayout.wordCount >= defaultLayout.visualColumns ||
    Math.abs(defaultLayout.tileFontSize - defaultLayout.labelFontSize) > 0.1 ||
    defaultLayout.clipped
  ) {
    throw new Error(`Long English suggestion did not span at normal text size: ${JSON.stringify(defaultLayout)}`);
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 694,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  await evaluate(`
    (() => {
      const style = document.createElement("style");
      style.id = "e2e-long-suggestion-scale";
      style.textContent = ".tile { font-size: 40px !important; }";
      document.head.append(style);
      window.dispatchEvent(new Event("resize"));
    })()
  `);
  await delay(350);
  const scaledLayout = await evaluate(`
    (() => {
      const first = document.querySelector('.dynamic-suggestion-row .tile[data-label="ACCESSIBILITY"]');
      const label = first?.querySelector(".tile-label");
      return {
        span: Number(first?.dataset.columnSpan),
        tileFontSize: Number.parseFloat(getComputedStyle(first).fontSize),
        labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
        clipped: label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1
      };
    })()
  `);
  if (
    scaledLayout.span < defaultLayout.firstSpan ||
    Math.abs(scaledLayout.tileFontSize - scaledLayout.labelFontSize) > 0.1 ||
    scaledLayout.clipped
  ) {
    throw new Error(`Long English suggestion did not adapt at 200% text size: ${JSON.stringify(scaledLayout)}`);
  }
  await assertNoViewportOverflow("long-English-suggestion-span-layout");
  steps.push(pass(
    "long-English-suggestion-spans",
    `kept ACCESSIBILITY at the normal word size while expanding from ${defaultLayout.firstSpan} to ${scaledLayout.span} columns`
  ));

  await evaluate(`document.querySelector("#e2e-long-suggestion-scale")?.remove();`);
}

async function scenarioInputCalibration() {
  await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      document.querySelector('[data-action="calibrate"]')?.click();
    })()
  `);
  await waitForCalibration("reliable");
  await assertCalibrationActionsVisible();

  for (let count = 0; count < 5; count += 1) {
    await evaluate(`window.ShineAacInput.receive({ intent: "activate", source: "keyboard", key: " " })`);
    await delay(320);
  }
  let calibration = await getCalibrationSnapshot();
  if (!calibration.text.includes("Good") || !calibration.text.includes("5 / 5 clean presses")) {
    throw new Error(`Button/switch calibration did not reach good state: ${calibration.text}`);
  }
  if (!calibration.text.includes("keyboard")) {
    throw new Error(`Button/switch calibration did not record keyboard source: ${calibration.text}`);
  }

  await evaluate(`document.querySelector('[data-calibration-class="unreliable"]')?.click()`);
  await waitForCalibration("unreliable");
  await evaluate(`document.querySelector('[data-calibration-action="start-rest"]')?.click()`);
  await evaluate(`window.ShineAacInput.receive({ intent: "activate", source: "camera-mouth-open", confidence: 0.82 })`);
  await delay(40);
  await evaluate(`window.ShineAacInput.receive({ intent: "activate", source: "camera-mouth-open", confidence: 0.84 })`);
  calibration = await getCalibrationSnapshot();
  if (!calibration.text.includes("2 at rest") || !calibration.text.includes("False activations while resting")) {
    throw new Error(`Noisy calibration did not flag rest activations: ${calibration.text}`);
  }

  await evaluate(`document.querySelector('[data-calibration-action="start-trials"]')?.click()`);
  await evaluate(`window.ShineAacInput.receive({ intent: "activate", source: "emg-threshold", confidence: 0.72 })`);
  await delay(40);
  await evaluate(`window.ShineAacInput.receive({ intent: "activate", source: "emg-threshold", confidence: 0.69 })`);
  calibration = await getCalibrationSnapshot();
  if (!calibration.text.includes("EXTRA FIRES") || !calibration.text.includes("emg-threshold")) {
    throw new Error(`Noisy calibration did not record duplicate trial source: ${calibration.text}`);
  }

  await evaluate(`
    (() => {
      document.querySelector('[data-calibration-action="back"]')?.click();
      document.querySelector('[data-action="cancel"]')?.click();
    })()
  `);
  await waitForUi();
  await assertMessage("");
  steps.push(pass("input-calibration", "records reliable switch activations and noisy sensor rest/trial diagnostics without changing the message"));
}

async function scenarioAppInfoPage() {
  const info = await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      document.querySelector('[data-action="app-info"]')?.click();
      const panel = document.querySelector('[data-testid="app-info"]');
      if (!panel) throw new Error("App Info panel not found");
      return {
        text: panel.innerText,
        links: [...panel.querySelectorAll("[data-url]")].map((node) => node.textContent.trim()),
        hasBack: Boolean(panel.querySelector('[data-action="back"]'))
      };
    })()
  `);
  for (const expected of ["SayToMe AAC", "Version", "Your data", "Privacy policy", "Support", "Source code"]) {
    if (!info.text.includes(expected)) throw new Error(`App Info missing user-facing content: ${expected}`);
  }
  for (const rejected of ["Configuration format", "WebView", "What to test in this version"]) {
    if (info.text.includes(rejected)) throw new Error(`App Info exposes non-user content: ${rejected}`);
  }
  if (info.links.length !== 3 || !info.hasBack) {
    throw new Error(`App Info actions are incomplete: ${JSON.stringify(info)}`);
  }
  await evaluate(`
    (() => {
      document.querySelector('[data-action="back"]')?.click();
      document.querySelector('[data-action="cancel"]')?.click();
    })()
  `);
  await waitForUi();
  steps.push(pass("app-info", "shows version, user data facts, and help links without diagnostics or release-test instructions"));
}

async function scenarioSpeechVoiceSettings() {
  const opened = await evaluate(`
    (() => {
      globalThis.__speechVoiceTest = {
        calls: [],
        state: {
          ready: true,
          languageAvailable: true,
          enginePackage: "com.google.android.tts",
          engineLabel: "Test Taiwan Speech",
          voices: [
            {
              name: "shine-aac-moe-bopomofo", displayName: "教育部人聲注音",
              providerName: "教育部＋裝置語音", extraDetail: "注音符號用教育部 · 其他文字用裝置語音",
              builtIn: true, networkRequired: false, downloadRequired: false, quality: 400,
              features: ["style=官方人聲"]
            },
            { name: "cmn-tw-x-ctc-local", networkRequired: false, downloadRequired: false, quality: 400, features: [] },
            { name: "cmn-tw-x-ctc-network", networkRequired: true, downloadRequired: false, quality: 400, features: [] },
            { name: "cmn-tw-x-ctd-local", networkRequired: false, downloadRequired: false, quality: 400, features: [] },
            { name: "cmn-tw-x-ctd-network", networkRequired: true, downloadRequired: false, quality: 400, features: [] },
            { name: "cmn-tw-x-cte-local", networkRequired: false, downloadRequired: false, quality: 400, features: [] },
            { name: "cmn-tw-x-cte-network", networkRequired: true, downloadRequired: false, quality: 400, features: [] },
            { name: "zh-TW-language", networkRequired: false, downloadRequired: true, quality: 400, features: [] }
          ]
        }
      };
      globalThis.ShineAacAndroid = {
        getSpeechVoicesJson: () => JSON.stringify(globalThis.__speechVoiceTest.state),
        previewSpeechVoice: (name) => globalThis.__speechVoiceTest.calls.push(["preview", name]),
        downloadSpeechVoice: (name) => globalThis.__speechVoiceTest.calls.push(["download", name]),
        installSpeechData: () => globalThis.__speechVoiceTest.calls.push(["manage"]),
        openSpeechSettings: () => globalThis.__speechVoiceTest.calls.push(["settings"]),
        setUiConfigJson: (json) => globalThis.__speechVoiceTest.calls.push(["save", JSON.parse(json).speechVoiceName])
      };
      document.querySelector(".config-button")?.click();
      const setting = document.querySelector('[data-action="speech-voices"]');
      const summaryFontSize = parseFloat(getComputedStyle(setting?.querySelector('[data-speech-voice-summary]')).fontSize);
      setting?.click();
      const page = document.querySelector('[data-testid="speech-voice-page"]');
      return {
        foundSetting: Boolean(setting),
        page: globalThis.ShineAacNavigation?.currentPage?.(),
        title: page?.querySelector("h1")?.textContent,
        text: page?.innerText,
        readyRows: page?.querySelectorAll('[name="speech-voice-choice"]').length,
        previewButtons: page?.querySelectorAll('[data-speech-action="preview"]').length,
        downloadButtons: page?.querySelectorAll('[data-speech-action="download"]').length,
        hasSelect: Boolean(page?.querySelector("select")),
        summaryFontSize,
        smallestActionHeight: Math.min(...[...page.querySelectorAll("button")].map((node) => node.getBoundingClientRect().height))
      };
    })()
  `);
  if (
    !opened.foundSetting ||
    opened.page !== "speech-voices" ||
    opened.title !== "台灣語音" ||
    !opened.text.includes("Test Taiwan Speech") ||
    !opened.text.includes("語音 I") ||
    !opened.text.includes("語音 II") ||
    !opened.text.includes("語音 III") ||
    !opened.text.includes("教育部人聲注音") ||
    !opened.text.includes("注音符號用教育部") ||
    !opened.text.includes("2017 © 教育部") ||
    opened.text.includes("台灣女聲＋官方音節／注音") ||
    opened.text.includes("Google 裝置語音＋教育部注音") ||
    opened.text.includes("全字庫音節") ||
    !opened.text.includes("女性") ||
    !opened.text.includes("男性") ||
    !opened.text.includes("台灣中文語音資料") ||
    !opened.text.includes("可用 (4)") ||
    !opened.text.includes("線上語音 (3)") ||
    !opened.text.includes("可下載 (1)") ||
    opened.text.includes("LANGUAGE") ||
    opened.text.includes("台灣語音 1") ||
    opened.readyRows !== 8 ||
    opened.previewButtons !== 8 ||
    opened.downloadButtons !== 1 ||
    opened.hasSelect ||
    opened.summaryFontSize < 14 ||
    opened.smallestActionHeight < 48
  ) {
    throw new Error(`Speech voice page does not match the accessible list design: ${JSON.stringify(opened)}`);
  }

  const actions = await evaluate(`
    (() => {
      const testStyle = document.createElement("style");
      testStyle.id = "speech-voice-scroll-test-style";
      testStyle.textContent = ".speech-voice-panel { max-height: 260px !important; }";
      document.head.append(testStyle);
      const firstPanel = document.querySelector('[data-testid="speech-voice-page"] .speech-voice-panel');
      firstPanel.scrollTop = firstPanel.scrollHeight;
      const scrollBefore = firstPanel.scrollTop;
      document.querySelector('[data-speech-action="preview"][data-voice-name="cmn-tw-x-ctc-local"]')?.click();
      document.querySelector('[data-speech-action="download"][data-voice-name="zh-TW-language"]')?.click();
      document.querySelector('[name="speech-voice-choice"][value="cmn-tw-x-ctd-local"]')?.click();
      return {
        calls: globalThis.__speechVoiceTest.calls,
        selected: JSON.parse(localStorage.getItem("shine-aac-web-ui-v1") ?? "{}").speechVoiceName,
        scrollBefore,
        scrollAfter: document.querySelector('[data-testid="speech-voice-page"] .speech-voice-panel')?.scrollTop
      };
    })()
  `);
  if (
    !actions.calls.some(([action, name]) => action === "preview" && name === "cmn-tw-x-ctc-local") ||
    !actions.calls.some(([action, name]) => action === "download" && name === "zh-TW-language") ||
    actions.selected !== "cmn-tw-x-ctd-local" ||
    actions.scrollBefore <= 0 ||
    Math.abs(actions.scrollAfter - actions.scrollBefore) > 2
  ) {
    throw new Error(`Speech voice actions or immediate selection failed: ${JSON.stringify(actions)}`);
  }

  const refreshed = await evaluate(`
    (() => {
      globalThis.__speechVoiceTest.state.voices[7].downloadRequired = false;
      globalThis.ShineAacSpeechVoices.refresh();
      const page = document.querySelector('[data-testid="speech-voice-page"]');
      const downloaded = page.querySelector('[data-voice-name="zh-TW-language"]');
      const result = {
        text: page.innerText,
        downloadedSelectable: Boolean(downloaded?.querySelector('[name="speech-voice-choice"]')),
        downloadedPreviewable: Boolean(downloaded?.querySelector('[data-speech-action="preview"]'))
      };
      page.querySelector('[name="speech-voice-choice"][value="android-system-default"]')?.click();
      globalThis.ShineAacNavigation.back();
      result.pageAfterBack = globalThis.ShineAacNavigation.currentPage();
      result.summary = document.querySelector('[data-speech-voice-summary]')?.textContent;
      document.querySelector('[data-action="cancel"]')?.click();
      document.querySelector("#speech-voice-scroll-test-style")?.remove();
      delete globalThis.ShineAacAndroid;
      delete globalThis.__speechVoiceTest;
      return result;
    })()
  `);
  if (
    !refreshed.text.includes("語音下載完成") ||
    !refreshed.text.includes("可用 (4)") ||
    refreshed.text.includes("可用 (5)") ||
    !refreshed.text.includes("其他語音資料") ||
    !refreshed.downloadedSelectable ||
    !refreshed.downloadedPreviewable ||
    refreshed.pageAfterBack !== "config" ||
    !refreshed.summary.includes("裝置預設")
  ) {
    throw new Error(`Speech voice refresh or back navigation failed: ${JSON.stringify(refreshed)}`);
  }
  await waitForUi();
  steps.push(pass("speech-voice-settings", "uses a dedicated accessible list with engine, ready/downloadable states, inline preview, immediate selection, and refresh"));
}

async function scenarioBackNavigation() {
  const appInfoPage = await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      document.querySelector('[data-action="app-info"]')?.click();
      return globalThis.ShineAacNavigation?.currentPage?.();
    })()
  `);
  if (appInfoPage !== "app-info") throw new Error(`Expected App Info page, got ${appInfoPage}`);

  const appInfoHandled = await evaluate(`globalThis.ShineAacNavigation?.back?.()`);
  const configAfterInfo = await evaluate(`({
    page: globalThis.ShineAacNavigation?.currentPage?.(),
    title: document.querySelector(".config-panel h1")?.textContent
  })`);
  if (!appInfoHandled || configAfterInfo.page !== "config" || configAfterInfo.title !== "Configuration") {
    throw new Error(`Back from App Info should return to Configuration: ${JSON.stringify(configAfterInfo)}`);
  }

  const calibrationOpenResult = await evaluate(`
    (() => {
      const button = document.querySelector('[data-action="calibrate"]');
      button?.click();
      return {
        foundButton: Boolean(button),
        page: globalThis.ShineAacNavigation?.currentPage?.(),
        hasCalibration: Boolean(document.querySelector(".calibration-panel"))
      };
    })()
  `);
  if (!calibrationOpenResult.foundButton || calibrationOpenResult.page !== "calibration" || !calibrationOpenResult.hasCalibration) {
    throw new Error(`Could not open Input Test after App Info back: ${JSON.stringify(calibrationOpenResult)}`);
  }
  const calibrationHandled = await evaluate(`globalThis.ShineAacNavigation?.back?.()`);
  const configAfterCalibration = await evaluate(`({
    page: globalThis.ShineAacNavigation?.currentPage?.(),
    title: document.querySelector(".config-panel h1")?.textContent
  })`);
  if (!calibrationHandled || configAfterCalibration.page !== "config" || configAfterCalibration.title !== "Configuration") {
    throw new Error(`Back from Input Test should return to Configuration: ${JSON.stringify(configAfterCalibration)}`);
  }

  const configHandled = await evaluate(`globalThis.ShineAacNavigation?.back?.()`);
  await waitForRenderedBoard();
  await assertFirstRowHold(await getSnapshot(), "return from Settings");
  const rootResult = await evaluate(`({
    handled: globalThis.ShineAacNavigation?.back?.(),
    page: globalThis.ShineAacNavigation?.currentPage?.()
  })`);
  if (!configHandled || rootResult.handled || rootResult.page !== "board") {
    throw new Error(`Back should return to the board before allowing app exit: ${JSON.stringify(rootResult)}`);
  }

  steps.push(pass("back-navigation", "system back contract returns App Info and Input Test to Configuration, then Configuration to the board"));
}

async function scenarioDeveloperDemoMode() {
  await evaluate(`
    localStorage.removeItem("shine-aac-demo-mode");
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 18,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: 1800,
      transitionPauseMs: 0,
      firstCellPauseMs: 2400,
      inputLatencyCompensationMs: 250,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      switchInputProfile: "camera-long-blink"
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.href = ${JSON.stringify(appUrl)};
  `);
  await waitForUi();
  await selectLabel("I", { activationDelayMs: 300 });
  await assertMessage("I ");
  await releaseFirstRowHold();
  let snapshot = await getSnapshot();
  await clickTarget(snapshot.activeRow);
  await evaluate(`
    window.ShineAacInput.receive({ intent: "holdStart", source: "android-camera-long-blink" });
  `);
  await delay(80);
  snapshot = await getSnapshot();
  if (!snapshot.activeCell || snapshot.phase !== "Blink") {
    throw new Error(`Demo reset precondition did not freeze cell scanning: ${JSON.stringify(snapshot)}`);
  }
  await longPressSelector(".config-button", 2000);
  await waitForDemoActive();
  snapshot = await getSnapshot();
  if (snapshot.message !== "") throw new Error(`Demo activation should clear the text area, got ${snapshot.message}`);
  if (snapshot.phase !== "Rows" || snapshot.activeRow?.rowIndex !== 0 || snapshot.activeCell) {
    throw new Error(`Demo activation should restart row scanning from the top: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.reviewHold || snapshot.cameraHold) throw new Error("Demo activation should release all scanning holds");
  const activeDemoStats = await evaluate(`globalThis.ShineAacDemoStats ?? {}`);
  const expectedDemoTiming = {
    scanIntervalMs: 600,
    transitionPauseMs: 0,
    firstCellPauseMs: 600,
    inputLatencyCompensationMs: 0
  };
  if (JSON.stringify(activeDemoStats.timing) !== JSON.stringify(expectedDemoTiming)) {
    throw new Error(`Demo should use temporary fast timing: ${JSON.stringify(activeDemoStats.timing)}`);
  }
  const storedConfigDuringDemo = await evaluate(`JSON.parse(localStorage.getItem("shine-aac-web-config-v1"))`);
  if (
    storedConfigDuringDemo.scanIntervalMs !== 1800 ||
    storedConfigDuringDemo.firstCellPauseMs !== 2400 ||
    storedConfigDuringDemo.inputLatencyCompensationMs !== 250
  ) {
    throw new Error(`Demo timing should not overwrite saved accessibility timing: ${JSON.stringify(storedConfigDuringDemo)}`);
  }
  const storedDraft = await evaluate(`localStorage.getItem("shine-aac-session-draft-v1")`);
  if (storedDraft !== null) throw new Error(`Demo activation should clear the saved draft, got ${storedDraft}`);
  await assertMessage("I need help ", 90000);
  const ladderStats = await evaluate(`globalThis.ShineAacDemoStats ?? {}`);
  if (
    ladderStats.itemEscapeReturns !== 1 ||
    ladderStats.scanStops !== 1 ||
    ladderStats.wakeOnlyResumes !== 1
  ) {
    throw new Error(`Demo did not complete the visible escape ladder: ${JSON.stringify(ladderStats)}`);
  }
  await delay(3000);
  if (!await isDemoActive()) throw new Error("Rich demo should remain active after the first utterance");
  snapshot = await getSnapshot();
  await clickTarget(snapshot.activeRow ?? snapshot.activeCell);
  await waitForDemoInactive();
  const storedConfigAfterDemo = await evaluate(`JSON.parse(localStorage.getItem("shine-aac-web-config-v1"))`);
  if (
    storedConfigAfterDemo.scanIntervalMs !== 1800 ||
    storedConfigAfterDemo.firstCellPauseMs !== 2400 ||
    storedConfigAfterDemo.scanPassLimit !== 0
  ) {
    throw new Error(`Stopping Demo should preserve saved accessibility timing: ${JSON.stringify(storedConfigAfterDemo)}`);
  }
  steps.push(pass("demo-mode", "visibly demonstrates item escape, stopped scanning, and wake-only resume before communication; preserves accessibility settings"));
}

async function scenarioZhTwHomeDemoMode() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 22,
      profileId: "zh-TW",
      columns: 6,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    location.href = ${JSON.stringify(`${appUrl}?demo=zh-tw-home`)};
  `);
  await waitForRenderedBoard();
  await waitForDemoActive();
  const demoStats = await waitForZhuyinCommit();
  if (!await isDemoActive()) throw new Error("zh-TW demo stopped after its first direct Zhuyin commit");
  if (Number(demoStats.greedySuggestionSelections ?? 0) < 1 || Number(demoStats.greedyCharacters ?? 0) < 1) {
    throw new Error(`zh-TW Demo should greedily use a visible matching candidate: ${JSON.stringify(demoStats)}`);
  }
  const snapshot = await getSnapshot();
  await clickTarget(snapshot.activeRow ?? snapshot.activeCell);
  await waitForDemoInactive();
  await evaluate(`globalThis.ShineAacDemoError = ""`);
  steps.push(pass("zh-tw-demo-mode", `greedily completed a visible candidate after direct first-layer Zhuyin input (${demoStats.greedyCharacters} matched characters)`));
}

async function scenarioZhTwLayoutMigration() {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 8,
      profileId: "zh-TW",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0,
      suggestionDictionary: [
        "我要喝水",
        "我要吃飯",
        "我要上廁所",
        "我需要幫忙",
        "我很痛",
        "叫護理師"
      ].join("\\n"),
      symbols: [
        "是",
        "不是",
        "要",
        "不",
        "我",
        "你",
        "幫忙",
        "痛",
        "喝水",
        "吃飯",
        "廁所",
        "休息",
        "熱",
        "冷",
        "累",
        "睡覺",
        "家人",
        "護理師",
        "醫生",
        "藥",
        "停",
        "注音=<mode:zhuyin>",
        "說=<speak>",
        "刪=<delete>",
        "清除=<clear>"
      ].join("\\n")
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: true,
      restartScanFromTop: true,
    }));
    location.reload();
  `);
  await waitForLabels(["ㄅ", "ㄧ", "ㄩ", "ㄚ", "ㄦ", "英文"]);
  await evaluate(`
    globalThis.__zhuyinSpeechCalls = [];
    globalThis.ShineAacAndroid = {
      setSpeechLocale: () => {},
      speak: (text) => globalThis.__zhuyinSpeechCalls.push(["general", text]),
      speakZhuyin: (text) => globalThis.__zhuyinSpeechCalls.push(["zhuyin", text])
    };
  `);

  let snapshot = await getSnapshot();
  let labels = snapshot.rows.flat().map((tile) => tile.label);
  assertArrayEqual(snapshot.rows[4].map((tile) => tile.label), ["是", "不", "幫忙", "痛"], "zh-TW static core response row");
  for (const expected of ["英文", "ㄅ", "ㄧ", "ㄩ", "ㄚ", "ㄡ", "ㄦ", "朗讀", "清除"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW layout missing ${expected}`);
  }
  for (const rejected of ["E", "T", "空格", "我要喝水", "我要吃飯", "。", "謝謝", "ㄅㄆㄇㄈ", "注音", "需要", "表達"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW layout should not include ${rejected}`);
  }
  await assertTileLabelsFit(["ㄅ", "ㄓ", "ㄧ", "英文", "不"]);
  await assertFunctionKeyPartsFit("zh-tw-dense-function-key-layout");

  await selectLabel("ㄅ");
  const zhuyinSpeechCalls = await evaluate(`globalThis.__zhuyinSpeechCalls`);
  if (!zhuyinSpeechCalls.some(([kind, text]) => kind === "zhuyin" && text === "玻")) {
    throw new Error(`Zhuyin activation did not request the official audio route: ${JSON.stringify(zhuyinSpeechCalls)}`);
  }
  steps.push(pass("zh-tw-official-zhuyin-route", "Zhuyin activation uses the dedicated Ministry of Education audio route"));
  snapshot = await getSnapshot();
  labels = snapshot.rows.flat().map((tile) => tile.label);
  if (!labels.includes("復原")) throw new Error("zh-TW undo suggestion should be localized as 復原");
  if (labels.includes("UNDO")) throw new Error("zh-TW undo suggestion should not render as UNDO");
  if (labels.includes("重選")) throw new Error("zh-TW should not expose the removed 重選 command");
  if (!labels.includes("ㄚ")) throw new Error("zh-TW static first layer lost ㄚ after entering ㄅ");
  const redundantSuggestionSymbols = snapshot.rows.slice(0, 4).flat().filter((tile) => /^[ㄅ-ㄩㄚ-ㄦ]$/.test(tile.label));
  if (redundantSuggestionSymbols.length > 0) {
    throw new Error(`zh-TW suggestions duplicate static Zhuyin symbols: ${redundantSuggestionSymbols.map((tile) => tile.label).join(",")}`);
  }
  await selectLabel("ㄧ");
  await assertMessage("ㄅㄧ");
  snapshot = await getSnapshot();
  labels = snapshot.rows.flat().map((tile) => tile.label);
  for (const expected of ["不要", "比", "筆"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW replacement suggestion missing ${expected}`);
  }
  if (labels.includes("重選")) throw new Error("zh-TW multi-symbol buffer should rely on 復原 without 重選");
  await selectLabel("復原");
  await assertMessage("ㄅ");
  await assertFirstRowHold(await getSnapshot(), "復原");
  await selectLabel("ㄧ");
  await assertTileLabelsFit(["不要", "比", "筆", "清除"]);
  await selectLabel("不要");
  await assertMessage("不要");
  await selectLabel("清除");
  await assertMessage("");
  await selectLabel("ㄇ");
  await selectLabel("ㄟ");
  await assertMessage("ㄇㄟ");
  snapshot = await getSnapshot();
  labels = snapshot.rows.slice(0, 4).flat().map((tile) => tile.label);
  for (const expected of ["沒", "每", "美", "更多"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW ㄇㄟ suggestions missing ${expected}`);
  }
  for (const rejected of ["慢", "門", "媽媽", "要", "不要"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW ㄇㄟ suggestions should not include unrelated/static ${rejected}`);
  }
  const meiPages = new Set(labels);
  for (let page = 0; page < 2 && !meiPages.has("沒有"); page += 1) {
    await selectLabel("更多");
    snapshot = await getSnapshot();
    labels = snapshot.rows.slice(0, 4).flat().map((tile) => tile.label);
    labels.forEach((label) => meiPages.add(label));
  }
  if (!meiPages.has("沒有")) throw new Error("zh-TW ㄇㄟ suggestion pages should keep phrase 沒有 reachable");
  const pageBeforeMistake = snapshot.rows.slice(0, 4).flat().map((tile) => tile.label);
  const mistakenCandidate = snapshot.rows.slice(0, 4).flat().find((tile) => tile.action === "commit-candidate");
  if (!mistakenCandidate) throw new Error("zh-TW paged suggestions should include a candidate for the undo regression");
  await selectLabel(mistakenCandidate.label);
  await selectLabel("復原");
  await assertMessage("ㄇㄟ");
  snapshot = await getSnapshot();
  assertArrayEqual(
    snapshot.rows.slice(0, 4).flat().map((tile) => tile.label),
    pageBeforeMistake,
    "candidate page restored after 復原"
  );
  await evaluate(`
    delete globalThis.ShineAacAndroid;
    delete globalThis.__zhuyinSpeechCalls;
  `);
  steps.push(pass("zh-tw-layout", "migrated old zh-TW config to direct Zhuyin symbols and replacement suggestions"));
}

async function scenarioAutoScanMorePages() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 31,
      profileId: "zh-TW",
      columns: 6,
      scanMode: "block-row-column",
      scanIntervalMs: 180,
      transitionPauseMs: 0,
      firstCellPauseMs: 240,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0,
      autoScanSuggestionPages: true
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      verticalGroupProgress: false
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForLabels(["更多", "ㄅ"]);

  await selectLabel("更多");

  const firstPage = await waitForActive(
    (snapshot) => snapshot.phase === "SuggestionPages" && snapshot.activeBlock,
    "automatic suggestion page block",
    3000
  );
  const activePageRows = new Set(
    firstPage.rows.flat().filter((tile) => tile.activeBlock).map((tile) => tile.rowIndex)
  );
  if (JSON.stringify([...activePageRows]) !== JSON.stringify([0, 1, 2, 3])) {
    throw new Error(`More auto-scan should highlight four suggestion rows: ${JSON.stringify([...activePageRows])}`);
  }
  const pageProgressDirections = await evaluate(`
    [...document.querySelectorAll(".tile.active-block .progress-fill")]
      .map((fill) => fill.dataset.progressDirection)
  `);
  if (pageProgressDirections.length === 0 || pageProgressDirections.some((direction) => direction !== "right")) {
    throw new Error(`More auto-scan should use horizontal page progress: ${JSON.stringify(pageProgressDirections)}`);
  }
  const firstLabels = firstPage.rows.slice(0, 4).flat().map((tile) => tile.label);

  const deadline = Date.now() + 3000;
  let nextPage = null;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot();
    const labels = snapshot.rows.slice(0, 4).flat().map((tile) => tile.label);
    if (snapshot.phase === "SuggestionPages" && JSON.stringify(labels) !== JSON.stringify(firstLabels)) {
      nextPage = snapshot;
      break;
    }
    await delay(20);
  }
  if (!nextPage) throw new Error("More auto-scan did not advance to another suggestion page");
  const visiblePageLabels = nextPage.rows.slice(0, 4).flat().map((tile) => tile.label);

  await evaluate(`globalThis.ShineAacInput.receive({ intent: "activate", source: "more-page-e2e" })`);
  await delay(30);
  const resumed = await getSnapshot();
  const visibleLabels = resumed.rows.slice(0, 4).flat().map((tile) => tile.label);
  if (
    resumed.phase !== "Rows" ||
    resumed.activeBlock ||
    resumed.activeRow?.rowIndex !== 0 ||
    JSON.stringify(visibleLabels) !== JSON.stringify(visiblePageLabels)
  ) {
    throw new Error(`Activation did not exit More auto-paging into normal scanning on the visible page: ${JSON.stringify({
      phase: resumed.phase,
      activeBlock: resumed.activeBlock,
      activeRow: resumed.activeRow,
      samePage: JSON.stringify(visibleLabels) === JSON.stringify(visiblePageLabels)
    })}`);
  }
  const selectedPageRows = await evaluate(`
    [...document.querySelectorAll(".row")]
      .map((row, rowIndex) => row.classList.contains("selected-block-row") ? rowIndex : -1)
      .filter((rowIndex) => rowIndex >= 0)
  `);
  if (JSON.stringify(selectedPageRows) !== JSON.stringify([0, 1, 2, 3])) {
    throw new Error(`Visible More page did not remain the active row block: ${JSON.stringify(selectedPageRows)}`);
  }

  const persisted = await evaluate(`JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}").autoScanSuggestionPages`);
  if (persisted !== true) throw new Error("More auto-scan option was not persisted");
  steps.push(pass(
    "auto-scan-more-pages",
    "opt-in More navigation previews pages horizontally; activation selects the visible four-row page and enters row scanning"
  ));
}

async function scenarioConfigProfileRelevance() {
  const result = await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      const form = document.querySelector(".config-panel form");
      const profile = form.elements.profileId;
      const field = form.querySelector("[data-zhuyin-first-pass-field]");
      const checkbox = form.elements.deferUnsupportedZhuyinOnFirstPass;
      const englishInitiallyHidden = field.hidden;
      profile.value = "zh-TW";
      profile.dispatchEvent(new Event("change", { bubbles: true }));
      const zhTwState = { hidden: field.hidden, checked: checkbox.checked };
      profile.value = "en-US";
      profile.dispatchEvent(new Event("change", { bubbles: true }));
      const englishState = { hidden: field.hidden, checked: checkbox.checked };
      form.querySelector('[data-action="cancel"]')?.click();
      return { englishInitiallyHidden, zhTwState, englishState };
    })()
  `);
  if (
    !result.englishInitiallyHidden ||
    result.zhTwState.hidden ||
    !result.zhTwState.checked ||
    !result.englishState.hidden ||
    result.englishState.checked
  ) {
    throw new Error(`Zhuyin-only setting visibility does not follow the language profile: ${JSON.stringify(result)}`);
  }
  steps.push(pass("config-profile-relevance", "shows the Zhuyin-only option only for zh-TW and resets it when returning to English"));
}

async function scenarioEnglishFilledRows() {
  await assertMessage("");
  const snapshot = await getSnapshot();
  const labels = (row) => row.map((tile) => tile.label);

  if (
    JSON.stringify(labels(snapshot.rows[5] ?? [])) !== JSON.stringify(["LOOK", "SAY", "LIKE", "SPC"]) ||
    JSON.stringify(labels(snapshot.rows.at(-2) ?? [])) !== JSON.stringify(["V", "K", "X", "?"]) ||
    JSON.stringify(labels(snapshot.rows.at(-1) ?? [])) !== JSON.stringify(["J", "Q", "Z", "CLR"])
  ) {
    throw new Error(`English spare-cell layout is incorrect: ${JSON.stringify(snapshot.rows.map(labels))}`);
  }

  await selectLabel("HELP", { occurrence: "last" });
  await selectLabel("?", { occurrence: "last" });
  await assertMessage("help? ");
  await selectLabel("CLR", { occurrence: "last" });
  await assertMessage("");
  steps.push(pass("english-filled-rows", "filled both spare cells, kept ? at the bottom, and moved CLR to the matching final position"));
  await evaluate(`
    localStorage.removeItem("shine-aac-text-history-v1");
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();
}

async function scenarioDeferredZhuyinFirstPass() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 32,
      profileId: "zh-TW",
      columns: 6,
      scanMode: "row-column",
      scanIntervalMs: 180,
      transitionPauseMs: 0,
      firstCellPauseMs: 240,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 2,
      autoScanSuggestionPages: false,
      deferUnsupportedZhuyinOnFirstPass: true
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForLabels(["ㄈ", "ㄨ", "ㄩ", "清除"]);
  await selectLabel("清除");
  await assertMessage("");
  await selectLabel("ㄈ");
  await assertMessage("ㄈ");

  const presentation = await evaluate(`
    (() => {
      const byLabel = (label) => [...document.querySelectorAll(".tile")]
        .find((tile) => tile.dataset.label === label && tile.dataset.action === "append");
      const deferred = byLabel("ㄩ");
      const supported = byLabel("ㄨ");
      return {
        deferredClass: deferred?.classList.contains("scan-deferred") === true,
        supportedClass: supported?.classList.contains("scan-deferred") === true,
        borderStyle: deferred ? getComputedStyle(deferred).borderStyle : "",
        progressBackground: deferred
          ? getComputedStyle(deferred.querySelector(".progress-fill")).backgroundColor
          : "",
        description: deferred?.getAttribute("aria-description") ?? ""
      };
    })()
  `);
  if (
    !presentation.deferredClass ||
    presentation.supportedClass ||
    presentation.borderStyle !== "dashed" ||
    presentation.progressBackground !== "rgba(0, 0, 0, 0)" ||
    !presentation.description.includes("第二輪")
  ) {
    throw new Error(`Deferred Zhuyin styling is not clear and temporary: ${JSON.stringify(presentation)}`);
  }

  await selectLabel("ㄩ", { activationDelayMs: 30 });
  await assertMessage("ㄈㄩ");
  const failOpenCount = await evaluate(`document.querySelectorAll(".tile.scan-deferred").length`);
  if (failOpenCount !== 0) {
    throw new Error(`Invalid Zhuyin buffer should fail open, found ${failOpenCount} deferred cells`);
  }
  const persisted = await evaluate(`JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}").deferUnsupportedZhuyinOnFirstPass`);
  if (persisted !== true) throw new Error("Zhuyin first-pass deferral option was not persisted");
  steps.push(pass(
    "deferred-zhuyin-first-pass",
    "unsupported ㄈㄩ is visibly deferred on pass one, selectable on pass two, and invalid buffers fail open"
  ));
}

async function scenarioZhTwResetUsesPackagedDefaults() {
  await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      document.querySelector('[data-action="reset"]')?.click();
    })()
  `);
  await waitForLabels(["ㄅ", "ㄧ", "ㄩ", "英文"], { preserveInitialHold: true });
  const snapshot = await getSnapshot();
  await assertFirstRowHold(snapshot, "zh-TW reset");
  const labels = snapshot.rows.flat().map((tile) => tile.label);
  for (const expected of ["英文", "ㄅ", "ㄧ", "ㄩ", "朗讀", "清除"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW reset layout missing ${expected}`);
  }
  for (const rejected of ["E", "T", "空格", "我要喝水", "我要吃飯", "。", "謝謝", "ㄅㄆㄇㄈ", "注音", "需要", "表達"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW reset layout should not include ${rejected}`);
  }
  const renderedColumns = await evaluate(`
    Array.from(document.querySelectorAll(".row")).map((row) =>
      getComputedStyle(row).gridTemplateColumns.split(/\\s+/).filter(Boolean).length
    )
  `);
  const coreRowIndex = snapshot.rows.findIndex((row) => row.some((tile) => tile.label === "是"));
  const zhuyinRowIndex = snapshot.rows.findIndex((row) => row.some((tile) => tile.label === "ㄅ"));
  const finalZhuyinRowIndex = snapshot.rows.findIndex((row) => row.some((tile) => tile.label === "ㄦ"));
  const actionRowIndex = snapshot.rows.findIndex((row) => row.some((tile) => tile.label === "英文"));
  if (
    renderedColumns[coreRowIndex] !== 4 ||
    renderedColumns[zhuyinRowIndex] !== 6 ||
    renderedColumns[finalZhuyinRowIndex] !== 5 ||
    renderedColumns[actionRowIndex] !== 3
  ) {
    throw new Error(`zh-TW reset should render 4/6-5/3 core, stable Zhuyin, and action columns: ${JSON.stringify(renderedColumns)}`);
  }
  const presentation = await evaluate(`
    (() => {
      const clear = document.querySelector('[data-action="clear"]');
      const speak = document.querySelector('[data-action="speak"]');
      const input = document.querySelector('.tile.action-append:not(.function-key)');
      const noops = Array.from(document.querySelectorAll('.tile.noop'));
      return {
        clearBorderWidth: clear ? getComputedStyle(clear).borderTopWidth : null,
        speakBorderWidth: speak ? getComputedStyle(speak).borderTopWidth : null,
        clearBoxShadow: clear ? getComputedStyle(clear).boxShadow : null,
        speakBoxShadow: speak ? getComputedStyle(speak).boxShadow : null,
        inputBorderWidth: input ? getComputedStyle(input).borderTopWidth : null,
        inputBackground: input ? getComputedStyle(input).backgroundColor : null,
        controls: Array.from(document.querySelectorAll('.tile.function-key')).map((tile) => ({
          action: tile.dataset.action,
          visibleLabel: tile.dataset.label,
          ariaLabel: tile.getAttribute('aria-label'),
          borderWidth: getComputedStyle(tile).borderTopWidth,
          background: getComputedStyle(tile).backgroundColor
        })),
        inputsMarkedAsControls: document.querySelectorAll('.tile.action-append.function-key, .tile.action-commit-candidate.function-key').length,
        noops: noops.map((tile) => ({
          visibility: getComputedStyle(tile).visibility,
          role: tile.getAttribute('role'),
          ariaHidden: tile.getAttribute('aria-hidden')
        }))
      };
    })()
  `);
  if (
    presentation.clearBorderWidth !== presentation.inputBorderWidth ||
    presentation.speakBorderWidth !== presentation.inputBorderWidth ||
    presentation.clearBoxShadow === presentation.speakBoxShadow
  ) {
    throw new Error(`zh-TW clear control should retain a distinct destructive treatment within the function-key system: ${JSON.stringify(presentation)}`);
  }
  const requiredControlActions = ["clear", "speak", "open-category", "more-suggestions"];
  if (
    presentation.inputsMarkedAsControls !== 0 ||
    presentation.controls.some((control) => control.action === "backspace") ||
    requiredControlActions.some((action) => !presentation.controls.some((control) => control.action === action)) ||
    presentation.controls.some((control) =>
      Array.from(control.visibleLabel ?? "").length !== 2 ||
      control.borderWidth !== presentation.inputBorderWidth ||
      control.background === presentation.inputBackground
    )
  ) {
    throw new Error(`zh-TW function keys should share word-key metrics and use spacing-independent styling: ${JSON.stringify(presentation.controls)}`);
  }
  if (presentation.noops.some((tile) => tile.visibility !== "hidden" || tile.role !== "presentation" || tile.ariaHidden !== "true")) {
    throw new Error(`zh-TW empty placeholders should be invisible and non-semantic: ${JSON.stringify(presentation.noops)}`);
  }
  const stored = await evaluate(`
    (() => {
      const config = JSON.parse(localStorage.getItem("shine-aac-web-config-v1"));
      return {
        configVersion: config.configVersion,
        profileId: config.profileId,
        columns: config.columns,
        scanIntervalMs: config.scanIntervalMs,
        firstCellPauseMs: config.firstCellPauseMs,
        symbols: config.symbols,
        symbolLines: config.symbols.split(/\\n/),
        suggestionDictionary: config.suggestionDictionary
      };
    })()
  `);
  if (stored.configVersion < 22 || stored.profileId !== "zh-TW" || stored.columns !== 6) {
    throw new Error(`zh-TW reset saved wrong config metadata: ${JSON.stringify(stored)}`);
  }
  if (stored.scanIntervalMs !== 1800 || stored.firstCellPauseMs !== 2400) {
    throw new Error(`zh-TW reset should preserve the slower first-target hold: ${JSON.stringify(stored)}`);
  }
  if (
    !stored.symbols.includes("ㄅ") ||
    !stored.symbols.includes("英文=<category:english>") ||
    !stored.symbols.includes("朗讀=<speak>") ||
    stored.symbols.includes("刪除=<delete>") ||
    !stored.symbols.includes("清除=<clear>") ||
    stored.symbols.includes("SAY=<speak>") ||
    stored.symbols.includes("DEL=<delete>") ||
    stored.symbols.includes("CLR=<clear>") ||
    stored.symbols.includes("更多=<more>") ||
    stored.symbols.includes("ㄅㄆㄇㄈ=<zhuyin-group:labial>") ||
    stored.symbolLines.includes("E")
  ) {
    throw new Error(`zh-TW reset did not persist packaged direct Zhuyin board: ${stored.symbols}`);
  }
  if (stored.suggestionDictionary.includes("我要喝水")) {
    throw new Error("zh-TW reset persisted old long suggestion dictionary");
  }
  await releaseFirstRowHold();
  steps.push(pass("zh-tw-reset", "reset restored packaged zh-TW defaults and held the first row for deliberate startup"));
}

async function scenarioInitialFirstRowHold(snapshot) {
  await assertFirstRowHold(snapshot, "initial launch");
  await releaseFirstRowHold();
  steps.push(pass("initial-first-row-hold", "initial launch holds row 1 with a calm, visible whole-row treatment until activation"));
}

async function assertFirstRowHold(snapshot, context) {
  if (!snapshot.reviewHold || snapshot.phase !== "Review" || snapshot.activeRow?.rowIndex !== 0 || snapshot.activeCell) {
    throw new Error(`${context} should hold the first row before scanning: ${JSON.stringify(snapshot)}`);
  }
  const presentation = await evaluate(`
    (() => {
      const tile = document.querySelector(".tile.active-row.review-hold");
      const row = tile?.closest(".row.review-hold-row");
      const frame = row ? getComputedStyle(row, "::after") : null;
      const tileStyle = tile ? getComputedStyle(tile) : null;
      const progressFill = tile?.querySelector(".progress-fill");
      const progressStyle = progressFill ? getComputedStyle(progressFill) : null;
      const rectValues = (element) => {
        const rect = element?.getBoundingClientRect();
        return rect ? [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10) / 10) : null;
      };
      const framedGeometry = rectValues(row);
      row?.classList.remove("review-hold-row");
      const unframedGeometry = rectValues(row);
      row?.classList.add("review-hold-row");
      return tile && row && frame && tileStyle && progressStyle ? {
        frameBorderStyle: frame.borderTopStyle,
        frameBorderWidth: frame.borderTopWidth,
        frameBorderColor: frame.borderTopColor,
        framePointerEvents: frame.pointerEvents,
        rowPosition: getComputedStyle(row).position,
        tileBackgroundColor: tileStyle.backgroundColor,
        tileOutlineStyle: tileStyle.outlineStyle,
        progressBackgroundColor: progressStyle.backgroundColor,
        framedGeometry,
        unframedGeometry,
        progress: Number.parseFloat(tile.querySelector(".progress-fill")?.style.transform?.match(/[0-9.]+/)?.[0] ?? "0")
      } : null;
    })()
  `);
  if (
    !presentation ||
    presentation.frameBorderStyle !== "solid" ||
    presentation.frameBorderWidth !== "3px" ||
    presentation.frameBorderColor !== "rgb(34, 111, 119)" ||
    presentation.framePointerEvents !== "none" ||
    presentation.rowPosition !== "relative" ||
    presentation.tileBackgroundColor !== "rgb(238, 244, 243)" ||
    presentation.tileOutlineStyle !== "none" ||
    presentation.progressBackgroundColor !== "rgba(0, 0, 0, 0)" ||
    JSON.stringify(presentation.framedGeometry) !== JSON.stringify(presentation.unframedGeometry)
  ) {
    throw new Error(`${context} should show a non-interactive calm whole-row pause treatment: ${JSON.stringify(presentation)}`);
  }
}

async function releaseFirstRowHold() {
  const snapshot = await getSnapshot();
  if (!snapshot.reviewHold) return;
  await clickTarget(snapshot.activeBlock ?? snapshot.activeRow);
  await delay(40);
  const released = await getSnapshot();
  const releasedAtFirstTarget = released.activeBlock
    ? released.activeBlock.rowIndex === 0 && released.phase === "Blocks"
    : released.activeRow?.rowIndex === 0 && released.phase === "Rows";
  if (released.reviewHold || !releasedAtFirstTarget) {
    throw new Error(`Initial hold did not release into scanning: ${JSON.stringify(released)}`);
  }
}

async function scenarioFunctionLabelScaleMatrix() {
  const cases = [
    { name: "function-label-default-default", width: 393, height: 851, fontSize: null },
    { name: "function-label-default-larger-display", width: 320, height: 694, fontSize: null },
    { name: "function-label-200pct-default", width: 393, height: 851, fontSize: 40 },
    { name: "function-label-200pct-larger-display", width: 320, height: 694, fontSize: 40 }
  ];

  for (const testCase of cases) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: testCase.width,
      height: testCase.height,
      deviceScaleFactor: 2.75,
      mobile: true
    });
    await evaluate(`
      (() => {
        document.querySelector("#e2e-function-label-scale")?.remove();
        const fontSize = ${JSON.stringify(testCase.fontSize)};
        if (fontSize) {
          const style = document.createElement("style");
          style.id = "e2e-function-label-scale";
          style.textContent = ".tile { font-size: " + fontSize + "px !important; }";
          document.head.append(style);
        }
        window.dispatchEvent(new Event("resize"));
      })()
    `);
    await delay(250);
    await assertFunctionKeyPartsFit(testCase.name);
    const labelReadabilityViolations = await evaluate(`
      [...document.querySelectorAll(".tile-label")].flatMap((label) => {
        const text = label.textContent?.trim() ?? "";
        if (Array.from(text).length === 0) return [];
        const range = document.createRange();
        range.selectNodeContents(label);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        const lineTops = [...new Set(rects.map((rect) => Math.round(rect.top)))];
        const tile = label.closest(".tile");
        const labelFontSize = Number.parseFloat(getComputedStyle(label).fontSize);
        const acceptedFloor = Math.min(Number.parseFloat(getComputedStyle(tile).fontSize), 18);
        return lineTops.length > 1 || labelFontSize + 0.75 < acceptedFloor
          ? [{ text, fontSize: labelFontSize, acceptedFloor, lineTops }]
          : [];
      })
    `);
    if (labelReadabilityViolations.length > 0) {
      throw new Error(`${testCase.name} wrapped or undersized labels: ${JSON.stringify(labelReadabilityViolations)}`);
    }
    await assertNoViewportOverflow(`${testCase.name}-viewport`);
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    writeFileSync(join(artifactDir, `${testCase.name}.png`), Buffer.from(screenshot.data, "base64"));
  }

  await evaluate(`document.querySelector("#e2e-function-label-scale")?.remove(); window.dispatchEvent(new Event("resize"));`);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    mobile: true
  });
  await delay(250);
}

async function scenarioZhTwLanguageSwitchReviewHold() {
  await evaluate(`
    (() => {
      const config = JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}");
      config.configVersion = 24;
      config.profileId = "zh-TW";
      config.columns = 6;
      config.scanIntervalMs = ${BrowserSmokeScanMs};
      config.transitionPauseMs = 0;
      config.firstCellPauseMs = ${BrowserSmokeScanMs};
      config.inputLatencyCompensationMs = 0;
      delete config.symbols;
      delete config.suggestionDictionary;
      localStorage.setItem("shine-aac-web-config-v1", JSON.stringify(config));
    })();
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    location.reload();
  `);
  await waitForLabels(["\u3105", "\u3127", "\u3129", "英文"]);

  await selectLabel("英文");
  let snapshot = await getSnapshot();
  if (!snapshot.reviewHold) throw new Error("Language switch to 英文 should use suggestion-change review hold");
  if (!snapshot.rows.flat().some((tile) => tile.label === "\u6ce8\u97f3")) {
    throw new Error("English category should show 注音 close tile");
  }
  if (!snapshot.rows.flat().some((tile) => tile.label === "E")) {
    throw new Error("English category should show English spelling symbols");
  }
  await clickTarget(snapshot.activeRow);
  await delay(40);

  await selectLabel("\u6ce8\u97f3", { rowIndex: 2 });
  snapshot = await getSnapshot();
  if (!snapshot.reviewHold) throw new Error("Language switch back to Zhuyin should use suggestion-change review hold");
  if (!snapshot.rows.flat().some((tile) => tile.label === "英文")) {
    throw new Error("Zhuyin board should show 英文 entry point after closing English category");
  }
  await clickTarget(snapshot.activeRow);
  await delay(40);

  await evaluate(`
    (() => {
      const config = JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}");
      config.inputLatencyCompensationMs = 0;
      localStorage.setItem("shine-aac-web-config-v1", JSON.stringify(config));
    })();
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
    }));
    location.reload();
  `);
  await waitForLabels(["\u3105", "\u3127", "\u3129", "英文"]);
  await selectLabel("英文");
  snapshot = await getSnapshot();
  for (const expected of ["THE", "TO", "YES", "HELP", "SPC", "注音", "朗讀", "復原", "清除"]) {
    if (!snapshot.rows.flat().some((tile) => tile.label === expected)) {
      throw new Error(`zh-TW English board missing shared suggestion/control tile ${expected}`);
    }
  }
  const embeddedEnglishColumnCounts = await evaluate(`
    [...document.querySelectorAll(".row")].map((row) => row.dataset.visualColumns)
  `);
  if (embeddedEnglishColumnCounts.some((columns) => columns !== "4")) {
    throw new Error(`zh-TW English board inherited non-English columns: ${JSON.stringify(embeddedEnglishColumnCounts)}`);
  }
  const visibleLabels = snapshot.rows.flat().map((tile) => tile.label).filter(Boolean);
  const duplicateLabels = [...new Set(
    visibleLabels.filter((label, index) => visibleLabels.indexOf(label) !== index)
  )];
  if (duplicateLabels.length > 0) {
    throw new Error(`zh-TW English board introduced repeated visible keys: ${duplicateLabels.join(",")}`);
  }
  await selectLabel("P");
  await selectLabel("H");
  snapshot = await getSnapshot();
  const completion = snapshot.rows[0].find((tile) => tile.action === "append" && /^[A-Z]{2,}$/.test(tile.label));
  if (!completion) {
    throw new Error(`zh-TW English board did not reuse English completions: ${JSON.stringify(snapshot.rows[0])}`);
  }
  await selectLabel(completion.label, { rowIndex: 0 });
  await assertMessage(`${completion.label.toLowerCase()} `);
  await selectLabel("注音", { rowIndex: 2 });
  await assertMessage(completion.label.toLowerCase());
  steps.push(pass("zh-tw-language-switch-review-hold", "英文 and 注音 switches preserve review hold; the embedded English board reuses English suggestions"));
}

async function scenarioZhTwLocaleConsistency() {
  const result = await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      const configText = document.querySelector(".config-panel")?.innerText ?? "";
      document.querySelector('[data-action="calibrate"]')?.click();
      const testText = document.querySelector(".calibration-panel")?.innerText ?? "";
      globalThis.ShineAacNavigation?.back?.();
      document.querySelector('[data-action="app-info"]')?.click();
      const infoText = document.querySelector('[data-testid="app-info"]')?.innerText ?? "";
      globalThis.ShineAacNavigation?.back?.();
      setTimeout(() => location.reload(), 0);
      return { configText, testText, infoText };
    })()
  `);
  for (const [area, text, required, rejected] of [
    ["config", result.configText, ["設定", "語言", "掃描速度預設", "開關輸入", "儲存"], ["Configuration", "Language", "Scan preset", "Switch input", "Save"]],
    ["input test", result.testText, ["輸入測試", "按鍵或開關", "感測器", "返回設定"], ["Input Test", "Button or switch", "Sensor", "Back to config"]],
    ["app info", result.infoText, ["版本", "您的資料", "隱私權政策", "返回"], ["Version", "Your data", "Privacy policy", "Back"]]
  ]) {
    if (required.some((label) => !text.includes(label)) || rejected.some((label) => text.includes(label))) {
      throw new Error(`zh-TW ${area} locale is inconsistent: ${JSON.stringify(text)}`);
    }
  }
  await waitForRenderedBoard();
  steps.push(pass("zh-tw-locale", "configuration, input test, and app information remain consistently Traditional Chinese"));
}

async function selectLabel(label, options = {}) {
  const position = await findLabel(label, options);
  await selectCell(position.rowIndex, position.cellIndex, options);
}

async function selectCell(rowIndex, cellIndex, { activationDelayMs = 0 } = {}) {
  await releaseFirstRowHold();
  const initialSnapshot = await getSnapshot();
  const rowTimeoutMs = Math.max(30000, (initialSnapshot.rows.length + 2) * 1500);
  let rowWasAutomaticallyActivated = false;
  if (initialSnapshot.activeBlock) {
    const blockActivation = await activateWhenRenderedTargetIsCurrent("active-block", rowIndex, 0, rowTimeoutMs);
    rowWasAutomaticallyActivated = blockActivation.activeBlockRowCount === 1;
    if (
      rowWasAutomaticallyActivated &&
      (initialSnapshot.rows[rowIndex] ?? []).filter((tile) => tile.action !== "noop").length === 1
    ) return;
  }
  if (!rowWasAutomaticallyActivated) {
    await activateWhenRenderedTargetIsCurrent("active-row", rowIndex, 0, rowTimeoutMs);
  }
  const afterRowActivation = await getSnapshot();
  if ((afterRowActivation.rows[rowIndex] ?? []).filter((tile) => tile.action !== "noop").length === 1) return;
  await activateWhenRenderedTargetIsCurrent(
    "active-cell",
    rowIndex,
    cellIndex,
    cellIndex === 0 ? 30000 : 12000,
    activationDelayMs
  );
}

async function activateWhenRenderedTargetIsCurrent(className, rowIndex, cellIndex, timeoutMs, stableMs = 0) {
  const activation = await evaluate(`
    new Promise((resolve, reject) => {
      const deadline = performance.now() + ${timeoutMs};
      let activeSince = 0;
      const check = () => {
        const row = document.querySelectorAll(".row")[${rowIndex}];
        const tile = row?.querySelectorAll(".tile")[${cellIndex}];
        const active = tile?.classList.contains(${JSON.stringify(className)}) === true;
        if (active) {
          if (!activeSince) activeSince = performance.now();
          if (performance.now() - activeSince >= ${stableMs}) {
            const activeBlockRowCount = new Set(
              [...document.querySelectorAll(".tile.active-block")]
                .map((candidate) => [...document.querySelectorAll(".row")].indexOf(candidate.closest(".row")))
            ).size;
            globalThis.ShineAacInput.receive({ intent: "activate", source: "e2e-scanner" });
            resolve({ activeBlockRowCount });
            return;
          }
        } else {
          activeSince = 0;
        }
        if (performance.now() >= deadline) {
          reject(new Error("Timed out waiting for ${className} ${rowIndex}:${cellIndex}"));
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    })
  `);
  await delay(10);
  return activation;
}

async function findLabel(label, { rowIndex, occurrence = 0 } = {}) {
  const snapshot = await getSnapshot();
  const matches = [];
  snapshot.rows.forEach((row, candidateRowIndex) => {
    if (rowIndex !== undefined && candidateRowIndex !== rowIndex) return;
    row.forEach((tile, cellIndex) => {
      if (tile.label === label) matches.push({ rowIndex: candidateRowIndex, cellIndex });
    });
  });
  const index = occurrence === "last" ? matches.length - 1 : occurrence;
  const match = matches[index];
  if (!match) throw new Error(`Could not find label ${label}`);
  return match;
}

async function scenarioVisibleEscapeLadder() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 26,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: 120,
      transitionPauseMs: 0,
      firstCellPauseMs: 300,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 2
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();

  const stopped = await waitForActive(
    (snapshot) => snapshot.phase === "Stopped",
    "bounded row scanning to stop",
    5000
  );
  const stoppedUi = await evaluate(`({
    label: document.querySelector(".phase")?.textContent ?? "",
    highlighted: document.querySelectorAll(".tile.is-current").length,
    stoppedClass: document.body.classList.contains("scan-stopped")
  })`);
  if (
    stopped.message !== "" ||
    stoppedUi.label !== "Stopped · Press switch" ||
    stoppedUi.highlighted !== 0 ||
    !stoppedUi.stoppedClass
  ) {
    throw new Error(`Stopped scan state is not explicit and inert: ${JSON.stringify({ stopped, stoppedUi })}`);
  }

  await evaluate(`globalThis.ShineAacInput.receive({ intent: "activate", source: "escape-ladder-e2e" })`);
  const resumed = await waitForActive(
    (snapshot) => snapshot.phase === "Rows" && snapshot.activeRow?.rowIndex === 0,
    "wake activation to resume without selection"
  );
  if (resumed.message !== "") throw new Error(`Wake activation selected content: ${JSON.stringify(resumed)}`);

  await evaluate(`globalThis.ShineAacInput.receive({ intent: "activate", source: "escape-ladder-e2e" })`);
  const returned = await waitForActive(
    (snapshot) => snapshot.phase === "Rows" && snapshot.activeRow?.rowIndex === 0,
    "two missed item passes to return to the selected row",
    5000
  );
  const returnedLabel = await evaluate(`document.querySelector(".phase")?.textContent ?? ""`);
  if (!returnedLabel.startsWith("Back to rows · Pass 1 / 2") || returned.message !== "") {
    throw new Error(`Cell escape did not return visibly and safely: ${JSON.stringify({ returned, returnedLabel })}`);
  }
  steps.push(pass("visible-escape-ladder", "two missed item passes return to the same row; two board passes stop; wake activation only resumes"));

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForUi();
}

async function scenarioBlockRowColumnMode() {
  for (const profile of [
    { profileId: "en-US", columns: 4 },
    { profileId: "zh-TW", columns: 6 }
  ]) {
    const rowColumnBoard = await captureBoardPresentation("row-column", profile);
    const blockRowColumnBoard = await captureBoardPresentation("block-row-column", profile);
    assertArrayEqual(
      blockRowColumnBoard,
      rowColumnBoard,
      `${profile.profileId} suggestions and layout must be scan-mode independent`
    );
  }

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 28,
      profileId: "zh-TW",
      columns: 6,
      scanMode: "block-row-column",
      scanIntervalMs: 120,
      transitionPauseMs: 0,
      firstCellPauseMs: 180,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      uiConfigVersion: 1,
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      verticalGroupProgress: true
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.reload();
  `);
  await waitForRenderedBoard();
  await releaseFirstRowHold();

  const blockSnapshot = await waitForActive(
    (snapshot) => snapshot.phase === "Blocks" && snapshot.activeBlock !== null,
    "four-block highlight"
  );
  const activeBlockRows = [...new Set(
    blockSnapshot.rows.flat().filter((tile) => tile.activeBlock).map((tile) => tile.rowIndex)
  )];
  if (activeBlockRows.join(",") !== "0,1,2,3") {
    throw new Error(`Four-block highlight did not start with the expected 4-row group: ${JSON.stringify(activeBlockRows)}`);
  }
  if (
    blockSnapshot.activeBlock.progressDirection !== "down" ||
    !blockSnapshot.activeBlock.progressTransform.startsWith("scaleY(")
  ) {
    throw new Error(`Block progress should descend from the top: ${JSON.stringify(blockSnapshot.activeBlock)}`);
  }

  await clickTarget(blockSnapshot.activeBlock);
  const rowSnapshot = await waitForActive(
    (snapshot) => snapshot.phase === "Rows" && snapshot.activeRow !== null,
    "row within selected block"
  );
  if (rowSnapshot.activeRow.progressDirection !== "down" || !rowSnapshot.activeRow.progressTransform.startsWith("scaleY(")) {
    throw new Error(`Nested row progress should descend from the top: ${JSON.stringify(rowSnapshot.activeRow)}`);
  }
  const selectedBlockRows = await evaluate(`
    [...document.querySelectorAll(".row")]
      .map((row, rowIndex) => row.classList.contains("selected-block-row") ? rowIndex : -1)
      .filter((rowIndex) => rowIndex >= 0)
  `);
  assertArrayEqual(selectedBlockRows, [0, 1, 2, 3], "selected-block context during row scanning");

  await evaluate(`location.reload()`);
  await waitForRenderedBoard();
  await releaseFirstRowHold();

  await selectLabel("痛");
  await assertMessage("痛");
  const storedMode = await evaluate(`JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}").scanMode`);
  if (storedMode !== "block-row-column") {
    throw new Error(`Four-block mode did not persist: ${JSON.stringify(storedMode)}`);
  }

  await evaluate(`
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.href = ${JSON.stringify(`${appUrl}?demo=zh-tw-home`)};
  `);
  await waitForRenderedBoard();
  await waitForDemoActive();
  const demoStats = await waitForZhuyinCommit();
  const demoMode = await evaluate(`JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}").scanMode`);
  if (demoMode !== "block-row-column" || !await isDemoActive()) {
    throw new Error(`Auto Demo did not remain active in four-block mode: ${JSON.stringify({ demoMode, demoStats })}`);
  }
  const demoSnapshot = await getSnapshot();
  await clickTarget(demoSnapshot.activeBlock ?? demoSnapshot.activeRow ?? demoSnapshot.activeCell);
  await waitForDemoInactive();
  await evaluate(`globalThis.ShineAacDemoError = ""`);
  steps.push(pass(
    "block-row-column",
    "reused the exact en-US and zh-TW suggestions/layout, showed downward block/row progress, persisted 4-3-3-3 mode, selected through block/row/cell, and completed an Auto Demo Zhuyin commit"
  ));
}

async function scenarioSingletonRowAutoActivation() {
  for (const scanMode of ["row-column", "block-row-column"]) {
    await evaluate(`
      localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
        configVersion: 28,
        profileId: "en-US",
        columns: 4,
        scanMode: ${JSON.stringify(scanMode)},
        scanIntervalMs: 120,
        transitionPauseMs: 850,
        firstCellPauseMs: 180,
        inputLatencyCompensationMs: 0,
        scanPassLimit: 0,
        symbols: "ONLY=only"
      }));
      localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
        uiConfigVersion: 1,
        rowScanVoice: false,
        scanVoice: false,
        activationVoice: false,
        restartScanFromTop: true
      }));
      localStorage.removeItem("shine-aac-session-draft-v1");
      location.href = ${JSON.stringify(appUrl)} + "?singleton=" + ${JSON.stringify(scanMode)};
    `);
    await waitForLabels(["ONLY"]);
    await releaseFirstRowHold();
    await selectLabel("ONLY");
    await assertMessage("only ");
    await selectLabel("UNDO");
    await assertMessage("");
  }
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 28,
      profileId: "en-US",
      columns: 4,
      scanMode: "block-row-column",
      scanIntervalMs: 120,
      transitionPauseMs: 850,
      firstCellPauseMs: 180,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0,
      symbols: "ALPHA=alpha\\nBETA=beta"
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.href = ${JSON.stringify(appUrl)} + "?singleton=one-row-block";
  `);
  await waitForLabels(["ALPHA", "BETA"]);
  await releaseFirstRowHold();
  await selectLabel("BETA");
  await assertMessage("beta ");
  await selectLabel("UNDO");
  await assertMessage("");
  steps.push(pass(
    "singleton-row-auto-activation",
    "both modes skip redundant singleton item activation; block mode also skips redundant activation for a one-row block"
  ));
}

async function captureBoardPresentation(scanMode, { profileId, columns }) {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 28,
      profileId: ${JSON.stringify(profileId)},
      columns: ${JSON.stringify(columns)},
      scanMode: ${JSON.stringify(scanMode)},
      scanIntervalMs: 600,
      transitionPauseMs: 0,
      firstCellPauseMs: 600,
      inputLatencyCompensationMs: 0,
      scanPassLimit: 0
    }));
    localStorage.removeItem("shine-aac-session-draft-v1");
    location.href = ${JSON.stringify(appUrl)};
  `);
  await waitForRenderedBoard();
  await releaseFirstRowHold();
  await delay(250);
  return evaluate(`
    (() => {
      const board = document.querySelector('[data-testid="board"]');
      const boardRect = board.getBoundingClientRect();
      const relativeRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round((rect.left - boardRect.left) * 10) / 10,
          y: Math.round((rect.top - boardRect.top) * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10
        };
      };
      return [...board.querySelectorAll('.row')].map((row) => ({
        visualColumns: row.dataset.visualColumns,
        gridTemplateColumns: row.style.gridTemplateColumns,
        rect: relativeRect(row),
        tiles: [...row.querySelectorAll('.tile')].map((tile) => ({
          label: tile.dataset.label,
          action: tile.dataset.action,
          columnSpan: tile.dataset.columnSpan,
          gridColumn: tile.style.gridColumn,
          rect: relativeRect(tile)
        }))
      }));
    })()
  `);
}

async function waitForActive(predicate, description, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot();
    if (predicate(snapshot)) return snapshot;
    await delay(20);
  }
  const snapshot = await getSnapshot();
  throw new Error(`Timed out waiting for active ${description}: ${JSON.stringify({
    phase: snapshot.phase,
    activeRow: snapshot.activeRow,
    activeCell: snapshot.activeCell,
    reviewHold: snapshot.reviewHold,
    message: snapshot.message
  })}`);
}

async function clickTarget(target) {
  if (!target) throw new Error("No active target to click");
  const point = await scrollTileIntoView(target.rowIndex, target.cellIndex);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1
  });
  await delay(10);
}

async function longPressSelector(selector, durationMs) {
  const point = await evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error("selector not found");
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1
  });
  await delay(durationMs);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1
  });
  await delay(40);
}

async function scrollTileIntoView(rowIndex, cellIndex) {
  return evaluate(`
    (() => {
      const row = document.querySelectorAll(".row")[${rowIndex}];
      const tile = row?.querySelectorAll(".tile")[${cellIndex}];
      if (!tile) throw new Error("tile not found");
      tile.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = tile.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
}

async function assertMessage(expected, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const demoError = await evaluate(`globalThis.ShineAacDemoError || ""`).catch(() => "");
    if (demoError) throw new Error(demoError);
    const snapshot = await getSnapshot();
    if (snapshot.message === expected) return;
    await delay(20);
  }
  const snapshot = await getSnapshot();
  throw new Error(`Expected message ${JSON.stringify(expected)}, got ${JSON.stringify(snapshot.message)}`);
}

async function assertSuggestionLabels(expected) {
  const snapshot = await getSnapshot();
  const labels = snapshot.rows[0].map((tile) => tile.label);
  assertArrayEqual(labels, expected, "suggestions");
}

async function assertNoViewportOverflow(name) {
  const layout = await evaluate(`
    (() => {
      const board = document.querySelector('[data-testid="board"]');
      const app = document.querySelector("#app");
      const body = document.body;
      const doc = document.documentElement;
      const boardRect = board.getBoundingClientRect();
      const appRect = app.getBoundingClientRect();
      return {
        innerHeight,
        bodyScrollHeight: body.scrollHeight,
        documentScrollHeight: doc.scrollHeight,
        appBottom: appRect.bottom,
        boardClientHeight: board.clientHeight,
        boardScrollHeight: board.scrollHeight,
        boardBottom: boardRect.bottom,
        rows: board.querySelectorAll(".row").length
      };
    })()
  `);
  const overflows =
    layout.bodyScrollHeight > layout.innerHeight + 1 ||
    layout.documentScrollHeight > layout.innerHeight + 1 ||
    layout.appBottom > layout.innerHeight + 1 ||
    layout.boardScrollHeight > layout.boardClientHeight + 1 ||
    layout.boardBottom > layout.innerHeight + 1;
  if (overflows) {
    throw new Error(`${name} overflow: ${JSON.stringify(layout)}`);
  }
  steps.push(pass(name, `fits ${layout.rows} rows in ${layout.innerHeight}px viewport without scrolling`));
}

async function assertMessageScrolledToEnd() {
  const metrics = await evaluate(`
    (() => {
      const node = document.querySelector('[data-testid="message"]');
      const style = getComputedStyle(node);
      return {
        whiteSpace: style.whiteSpace,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollLeft: node.scrollLeft,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        visibleEnd: node.scrollLeft + node.clientWidth
      };
    })()
  `);
  if (metrics.whiteSpace !== "nowrap") {
    throw new Error(`Message should stay on one line: ${JSON.stringify(metrics)}`);
  }
  if (metrics.overflowX !== "auto" || metrics.overflowY !== "hidden") {
    throw new Error(`Message should scroll horizontally only: ${JSON.stringify(metrics)}`);
  }
  if (metrics.scrollHeight > metrics.clientHeight + 1) {
    throw new Error(`Message should not grow vertically: ${JSON.stringify(metrics)}`);
  }
  if (metrics.scrollWidth <= metrics.clientWidth) {
    throw new Error(`Long message should overflow horizontally: ${JSON.stringify(metrics)}`);
  }
  if (metrics.visibleEnd < metrics.scrollWidth - 1) {
    throw new Error(`Long message should auto-scroll to the latest symbols: ${JSON.stringify(metrics)}`);
  }
  steps.push(pass("message-scroll-end", "long single-line message scrolls horizontally and keeps latest symbols visible"));
}

async function waitForUi() {
  const deadline = Date.now() + UiWaitTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot().catch(() => null);
    if (snapshot?.rows?.length > 0 && snapshot.rows.flat().some((tile) => tile.label === "WANT")) {
      await releaseFirstRowHold();
      return;
    }
    await delay(50);
  }
  throw new Error("Timed out waiting for web UI");
}

async function waitForRenderedBoard() {
  const deadline = Date.now() + UiWaitTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot().catch(() => null);
    if (snapshot?.rows?.length > 0) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for rendered board");
}

async function waitForDemoActive() {
  const deadline = Date.now() + DemoStartTimeoutMs;
  while (Date.now() < deadline) {
    const active = await evaluate(`document.body.classList.contains("demo-active")`);
    if (active) return;
    await delay(50);
  }
  throw new Error("Demo mode did not start from hidden gesture");
}

async function waitForDemoInactive(timeoutMs = DemoStopTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const active = await evaluate(`document.body.classList.contains("demo-active")`);
    if (!active) return;
    await delay(50);
  }
  throw new Error("Demo mode did not stop after completing scenario");
}

async function waitForZhuyinCommit(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const demoError = await evaluate(`globalThis.ShineAacDemoError || ""`).catch(() => "");
    if (demoError) throw new Error(demoError);
    const stats = await evaluate(`globalThis.ShineAacDemoStats ?? {}`);
    if (Number(stats.zhuyinCommits ?? 0) > 0) return stats;
    await delay(20);
  }
  const stats = await evaluate(`globalThis.ShineAacDemoStats ?? {}`);
  throw new Error(`zh-TW demo did not complete a candidate from the first-layer Zhuyin board: ${JSON.stringify(stats)}`);
}

async function waitForCalibration(kind) {
  const deadline = Date.now() + CalibrationWaitTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getCalibrationSnapshot().catch(() => null);
    if (snapshot?.kind === kind) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${kind} calibration`);
}

async function assertCalibrationActionsVisible() {
  const layout = await evaluate(`
    (() => {
      const actions = document.querySelector(".calibration-panel .config-actions");
      if (!actions) throw new Error("calibration actions not found");
      const rect = actions.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        innerHeight,
        visible: rect.top >= 0 && rect.bottom <= innerHeight && rect.height > 0
      };
    })()
  `);
  if (!layout.visible) throw new Error(`Calibration actions are not visible: ${JSON.stringify(layout)}`);
}

async function assertConfigActionsVisible(name) {
  await evaluate(`document.querySelector(".config-button")?.click()`);
  const layout = await evaluate(`
    (() => {
      const panel = document.querySelector(".config-panel");
      const actions = document.querySelector(".config-panel .config-actions");
      if (!panel || !actions) throw new Error("config panel actions not found");
      panel.scrollTop = panel.scrollHeight;
      const rect = actions.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        innerHeight,
        visible: rect.top >= 0 && rect.bottom <= innerHeight && rect.height > 0
      };
    })()
  `);
  await evaluate(`document.querySelector('[data-action="cancel"]')?.click()`);
  if (!layout.visible) throw new Error(`${name} config actions are not visible: ${JSON.stringify(layout)}`);
  steps.push(pass(`${name}-config-actions`, "config action bar remains reachable"));
}

async function isDemoActive() {
  return evaluate(`document.body.classList.contains("demo-active")`);
}

async function waitForLabels(expectedLabels, { preserveInitialHold = false } = {}) {
  const deadline = Date.now() + UiWaitTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot().catch(() => null);
    const labels = snapshot?.rows?.flat().map((tile) => tile.label) ?? [];
    if (expectedLabels.every((label) => labels.includes(label))) {
      if (!preserveInitialHold) await releaseFirstRowHold();
      return;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for labels ${expectedLabels.join(", ")}`);
}

async function assertTileLabelsFit(labels) {
  const metrics = await evaluate(`
    ((labels) => {
      return labels.map((label) => {
        const tile = [...document.querySelectorAll(".tile")].find((candidate) => candidate.dataset.label === label);
        const node = tile?.querySelector(".tile-label");
        if (!tile || !node) return { label, missing: true };
        return {
          label,
          missing: false,
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight
        };
      });
    })(${JSON.stringify(labels)})
  `);
  const clipped = metrics.filter((metric) =>
    metric.missing ||
    metric.scrollWidth > metric.clientWidth + 1 ||
    metric.scrollHeight > metric.clientHeight + 1
  );
  if (clipped.length > 0) throw new Error(`Tile labels clipped: ${JSON.stringify(clipped)}`);
}

async function assertFunctionKeyPartsFit(name) {
  const result = await evaluate(`
    (() => {
      const tolerance = 1;
      const minimumAcceptedFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--minimum-function-label-size")
      ) || 20;
      const inputTiles = [...document.querySelectorAll(".tile:not(.function-key):not(.noop)")];
      const tileSpacingProperties = [
        "display", "alignItems", "justifyContent",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
        "borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"
      ];
      const labelMetricProperties = [
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontWeight"
      ];
      const violations = [...document.querySelectorAll(".tile.function-key")].flatMap((tile) => {
        const label = tile.querySelector(".tile-label");
        if (!label) return [{ action: tile.dataset.action, missingLabel: true }];
        const tileRect = tile.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const textRange = document.createRange();
        textRange.selectNodeContents(label);
        const textRect = textRange.getBoundingClientRect();
        const peer = inputTiles.find((inputTile) =>
          Math.abs(inputTile.getBoundingClientRect().width - tileRect.width) <= 2
        ) ?? inputTiles[0];
        const tileStyle = getComputedStyle(tile);
        const labelStyle = getComputedStyle(label);
        const peerStyle = peer ? getComputedStyle(peer) : null;
        const peerLabel = peer?.querySelector(".tile-label");
        const peerLabelStyle = peerLabel ? getComputedStyle(peerLabel) : null;
        const lineHeightRatio = Number.parseFloat(labelStyle.lineHeight) / Number.parseFloat(labelStyle.fontSize);
        const peerLineHeightRatio = peerLabelStyle
          ? Number.parseFloat(peerLabelStyle.lineHeight) / Number.parseFloat(peerLabelStyle.fontSize)
          : Number.NaN;
        const sharedMetrics = Boolean(peerStyle && peerLabelStyle) &&
          tileSpacingProperties.every((property) => tileStyle[property] === peerStyle[property]) &&
          labelMetricProperties.every((property) => labelStyle[property] === peerLabelStyle[property]) &&
          Math.abs(lineHeightRatio - peerLineHeightRatio) <= 0.01;
        const metricDifferences = !peerStyle || !peerLabelStyle ? ["missing-comparable-word-key"] : [
          ...tileSpacingProperties
            .filter((property) => tileStyle[property] !== peerStyle[property])
            .map((property) => property + ":" + tileStyle[property] + "!=" + peerStyle[property]),
          ...labelMetricProperties
            .filter((property) => labelStyle[property] !== peerLabelStyle[property])
            .map((property) => "label." + property + ":" + labelStyle[property] + "!=" + peerLabelStyle[property]),
          ...(Math.abs(lineHeightRatio - peerLineHeightRatio) > 0.01
            ? ["label.lineHeightRatio:" + lineHeightRatio + "!=" + peerLineHeightRatio]
            : [])
        ];
        const inside = [labelRect, textRect].every((rect) =>
          rect.left >= tileRect.left - tolerance && rect.right <= tileRect.right + tolerance &&
          rect.top >= tileRect.top - tolerance && rect.bottom <= tileRect.bottom + tolerance
        );
        const unclipped = label.scrollWidth <= label.clientWidth + tolerance &&
          label.scrollHeight <= label.clientHeight + tolerance;
        const labelFontSize = Number.parseFloat(labelStyle.fontSize);
        const tileFontSize = Number.parseFloat(tileStyle.fontSize);
        const meetsMinimum = Number.isFinite(labelFontSize) &&
          labelFontSize + 0.75 >= Math.min(tileFontSize, minimumAcceptedFontSize);
        const noCompetingCues = !tile.querySelector(".function-cue, .function-icon");
        return sharedMetrics && inside && unclipped && meetsMinimum && noCompetingCues ? [] : [{
          action: tile.dataset.action,
          labelText: label.textContent,
          sharedMetrics,
          metricDifferences,
          inside,
          unclipped,
          meetsMinimum,
          noCompetingCues,
          labelFontSize,
          tileFontSize,
          minimumAcceptedFontSize,
          tile: { left: tileRect.left, top: tileRect.top, right: tileRect.right, bottom: tileRect.bottom },
          label: { left: labelRect.left, top: labelRect.top, right: labelRect.right, bottom: labelRect.bottom },
          text: { left: textRect.left, top: textRect.top, right: textRect.right, bottom: textRect.bottom }
        }];
      });
      const functionFontSizes = [...document.querySelectorAll(".tile.function-key .tile-label")]
        .map((label) => Number.parseFloat(getComputedStyle(label).fontSize))
        .filter(Number.isFinite);
      return {
        count: document.querySelectorAll(".tile.function-key").length,
        minimumRenderedFontSize: functionFontSizes.length ? Math.min(...functionFontSizes) : null,
        maximumRenderedFontSize: functionFontSizes.length ? Math.max(...functionFontSizes) : null,
        violations
      };
    })()
  `);
  if (result.count === 0 || result.violations.length > 0) {
    throw new Error(`${name} failed: ${JSON.stringify(result)}`);
  }
  steps.push(pass(name, `${result.count} function keys share word-key metrics; rendered ${result.minimumRenderedFontSize}-${result.maximumRenderedFontSize}px with a 20px normal-board floor`));
}

async function legacyAssertFunctionKeyPartsFit(name) {
  const result = await evaluate(`
    (() => {
      const tolerance = 1;
      const minimumAcceptedFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--minimum-function-label-size")
      ) || 20;
      const allInputLabels = [...document.querySelectorAll(".tile:not(.function-key):not(.noop) .tile-label")];
      const violations = [...document.querySelectorAll(".tile.function-key")].flatMap((tile) => {
        const cue = tile.querySelector(".function-cue");
        const label = tile.querySelector(".tile-label");
        const icon = tile.querySelector(".function-icon");
        if (!cue || !label || !icon) return [{ action: tile.dataset.action, missingPart: true }];
        const tileRect = tile.getBoundingClientRect();
        const cueRect = cue.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();
        const textRange = document.createRange();
        textRange.selectNodeContents(label);
        const textRect = textRange.getBoundingClientRect();
        const cueVisible = getComputedStyle(cue).display !== "none" && cueRect.width > 0 && cueRect.height > 0;
        const iconVisible = getComputedStyle(icon).display !== "none" && iconRect.width > 0 && iconRect.height > 0;
        const visibleRects = [textRect, ...(cueVisible ? [cueRect] : []), ...(iconVisible ? [iconRect] : [])];
        const inside = visibleRects.every((rect) =>
          rect.left >= tileRect.left - tolerance && rect.right <= tileRect.right + tolerance &&
          rect.top >= tileRect.top - tolerance && rect.bottom <= tileRect.bottom + tolerance
        );
        const rectanglesOverlap = (left, right) =>
          left.left < right.right - tolerance && left.right > right.left + tolerance &&
          left.top < right.bottom - tolerance && left.bottom > right.top + tolerance;
        const separated = (!iconVisible || !rectanglesOverlap(textRect, iconRect)) &&
          (!cueVisible || (!rectanglesOverlap(textRect, cueRect) && (!iconVisible || !rectanglesOverlap(cueRect, iconRect))));
        const unclipped = label.scrollWidth <= label.clientWidth + tolerance &&
          label.scrollHeight <= label.clientHeight + tolerance;
        const labelLength = Array.from(label.textContent ?? "").length;
        const comparableInputSizes = allInputLabels.flatMap((inputLabel) => {
          const inputTile = inputLabel.closest(".tile");
          if (!inputTile || Array.from(inputLabel.textContent ?? "").length !== labelLength) return [];
          const inputRect = inputTile.getBoundingClientRect();
          if (Math.abs(inputRect.width - tileRect.width) > 2) return [];
          return [Number.parseFloat(getComputedStyle(inputLabel).fontSize)];
        }).filter(Number.isFinite);
        const labelFontSize = Number.parseFloat(getComputedStyle(label).fontSize);
        const tileFontSize = Number.parseFloat(getComputedStyle(tile).fontSize);
        const comparisonFontSize = comparableInputSizes.length > 0
          ? Math.min(...comparableInputSizes)
          : tileFontSize;
        const readableAsInput = Number.isFinite(labelFontSize) && Number.isFinite(comparisonFontSize) &&
          labelFontSize + 0.75 >= Math.min(tileFontSize, comparisonFontSize);
        const meetsMinimum = Number.isFinite(labelFontSize) &&
          labelFontSize + 0.75 >= Math.min(tileFontSize, minimumAcceptedFontSize);
        return inside && separated && unclipped && readableAsInput && meetsMinimum ? [] : [{
          action: tile.dataset.action,
          text: label.textContent,
          cueVisible,
          iconVisible,
          inside,
          separated,
          unclipped,
          readableAsInput,
          meetsMinimum,
          minimumAcceptedFontSize,
          labelFontSize,
          comparisonFontSize,
          comparableInputSizes,
          tile: { left: tileRect.left, top: tileRect.top, right: tileRect.right, bottom: tileRect.bottom },
          cue: { left: cueRect.left, top: cueRect.top, right: cueRect.right, bottom: cueRect.bottom },
          label: { left: labelRect.left, top: labelRect.top, right: labelRect.right, bottom: labelRect.bottom },
          text: { left: textRect.left, top: textRect.top, right: textRect.right, bottom: textRect.bottom },
          icon: { left: iconRect.left, top: iconRect.top, right: iconRect.right, bottom: iconRect.bottom }
        }];
      });
      return { count: document.querySelectorAll(".tile.function-key").length, violations };
    })()
  `);
  if (result.count === 0 || result.violations.length > 0) {
    throw new Error(`${name} failed: ${JSON.stringify(result)}`);
  }
  steps.push(pass(name, `${result.count} function keys meet the 20px/default-input label floor without clipping; non-text cues collapse before labels shrink`));
}

function assertArrayEqual(actual, expected, description) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${description} ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function getSnapshot() {
  return evaluate(`
    (() => {
      const rows = [...document.querySelectorAll(".row")].map((row, rowIndex) =>
        [...row.querySelectorAll(".tile")].map((tile, cellIndex) => {
          const rect = tile.getBoundingClientRect();
          const progressFill = tile.querySelector(".progress-fill");
          const inlineTransform = progressFill?.style.transform ?? "";
          const computedTransform = progressFill ? getComputedStyle(progressFill).transform : "";
          const transform = computedTransform && computedTransform !== "none" ? computedTransform : inlineTransform;
          let progress = Number.parseFloat(progressFill?.style.width || "0");
          const progressDirection = progressFill?.dataset.progressDirection ?? "right";
          const scaleMatch = transform.match(/scale[XY]\\(([^)]+)\\)/);
          if (scaleMatch) {
            progress = Number.parseFloat(scaleMatch[1]) * 100;
          } else if (transform.startsWith("matrix(")) {
            const matrix = transform.slice(7).split(",");
            progress = Number.parseFloat(matrix[progressDirection === "down" ? 3 : 0]) * 100;
          }
          return {
            rowIndex,
            cellIndex,
            label: tile.dataset.label ?? "",
            action: tile.dataset.action ?? "",
            activeBlock: tile.classList.contains("active-block"),
            activeRow: tile.classList.contains("active-row"),
            activeCell: tile.classList.contains("active-cell"),
            reviewHold: tile.classList.contains("review-hold"),
            cameraHold: tile.classList.contains("camera-hold"),
            progressDirection,
            progressTransform: inlineTransform,
            progress,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
        })
      );
      const activeRow = rows.flat().find((tile) => tile.activeRow) ?? null;
      const activeCell = rows.flat().find((tile) => tile.activeCell) ?? null;
      const activeBlock = rows.flat().find((tile) => tile.activeBlock) ?? null;
      const messageNode = document.querySelector('[data-testid="message"]');
      const message = messageNode?.dataset.rawMessage ?? null;
      const phaseElement = document.querySelector(".phase");
      const phase = phaseElement?.dataset.scanPhase ?? phaseElement?.textContent ?? "";
      const current = activeCell ?? activeRow ?? activeBlock;
      return {
        message,
        rows,
        activeBlock,
        activeRow,
        activeCell,
        phase,
        reviewHold: rows.flat().some((tile) => tile.reviewHold),
        cameraHold: rows.flat().some((tile) => tile.cameraHold),
        activeProgress: current?.progress ?? 0
      };
    })()
  `);
}

async function getCalibrationSnapshot() {
  return evaluate(`
    (() => {
      const panel = document.querySelector(".calibration-panel");
      if (!panel) throw new Error("calibration panel not found");
      return {
        kind: document.querySelector('[data-testid="calibration-unreliable"]') ? "unreliable" : "reliable",
        text: panel.innerText
      };
    })()
  `);
}

async function evaluate(expression) {
  const timeoutMs = cumulativeTimingMode
    ? Math.max(45000, CumulativeScanTransitionCount * CumulativeScanIntervalMs + 30000)
    : 45000;
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, timeoutMs);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

async function createTarget(url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create browser target: ${response.status}`);
  return response.json();
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // retry
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function writeReport(ok) {
  const lines = [
    "# SHINE AAC Web E2E Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Result: ${ok ? "PASS" : "FAIL"}`,
    "",
    "| Step | Status | Detail |",
    "| --- | --- | --- |",
    ...steps.map((step) => `| ${step.name} | ${step.status} | ${step.detail.replaceAll("|", "\\|").replaceAll("\n", "<br>")} |`),
    "",
    "Artifacts:",
    "",
    "- `e2e-artifacts/web-e2e-final.png`"
  ];
  writeFileSync(join(repoRoot, "docs/WEB_E2E_REPORT.md"), `${lines.join("\n")}\n`);
}

function pass(name, detail) {
  return { name, status: "PASS", detail };
}

function fail(name, detail) {
  return { name, status: "FAIL", detail };
}

class CdpClient {
  static async connect(url) {
    const socket = await connectWebSocket(url);
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    socket.on("data", (data) => this.read(data));
    socket.on("error", (error) => {
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
    });
  }

  send(method, params = {}, timeoutMs = 10000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    sendFrame(this.socket, payload);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs).unref();
    });
  }

  read(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (true) {
      const frame = readFrame(this.buffer);
      if (!frame) return;
      this.buffer = this.buffer.subarray(frame.bytesRead);
      if (frame.opcode === 8) {
        this.close();
        return;
      }
      if (frame.opcode !== 1) continue;
      const message = JSON.parse(frame.payload.toString("utf8"));
      if (!message.id || !this.pending.has(message.id)) continue;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  }

  close() {
    this.socket.end();
  }
}

async function connectWebSocket(url) {
  const parsed = new URL(url);
  const key = randomBytes(16).toString("base64");
  const expectedAccept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  const socket = net.createConnection(Number(parsed.port), parsed.hostname);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });

  socket.write([
    `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
    `Host: ${parsed.host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "",
    ""
  ].join("\r\n"));

  let handshake = Buffer.alloc(0);
  while (!handshake.includes("\r\n\r\n")) {
    handshake = Buffer.concat([handshake, await onceData(socket)]);
  }
  const headerEnd = handshake.indexOf("\r\n\r\n") + 4;
  const headers = handshake.subarray(0, headerEnd).toString("utf8");
  if (!headers.startsWith("HTTP/1.1 101") || !headers.includes(`Sec-WebSocket-Accept: ${expectedAccept}`)) {
    throw new Error(`WebSocket handshake failed:\n${headers}`);
  }
  const extra = handshake.subarray(headerEnd);
  if (extra.length > 0) socket.unshift(extra);
  return socket;
}

function onceData(socket) {
  return new Promise((resolve, reject) => {
    socket.once("data", resolve);
    socket.once("error", reject);
  });
}

function sendFrame(socket, text) {
  const payload = Buffer.from(text, "utf8");
  const mask = randomBytes(4);
  const header = [];
  header.push(0x81);
  if (payload.length < 126) {
    header.push(0x80 | payload.length);
  } else if (payload.length < 65536) {
    header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  } else {
    throw new Error("Payload too large");
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  socket.write(Buffer.concat([Buffer.from(header), mask, masked]));
}

function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    length = high * 2 ** 32 + low;
    offset += 8;
  }
  const masked = Boolean(buffer[1] & 0x80);
  let mask;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return { opcode, payload, bytesRead: offset + length };
}

await main();
