import { spawn } from "node:child_process";
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
const appUrl = `http://127.0.0.1:${webPort}/apps/web/`;
const HttpStartupTimeoutMs = 30000;
const UiWaitTimeoutMs = 30000;
const DemoStartTimeoutMs = 10000;
const DemoStopTimeoutMs = 60000;
const CalibrationWaitTimeoutMs = 10000;
const BrowserSmokeScanMs = 500;

const steps = [];
let serverProcess;
let edgeProcess;
let cdp;

async function main() {
try {
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
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
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
  await waitForUi();
  steps.push(pass("browser-load", "rendered board and message panel"));

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.reload();
  `);
  await waitForUi();
  steps.push(pass("test-config", "seeded browser smoke scan timing through browser localStorage"));

  await scenarioFirstColumnProgressTiming();
  await scenarioCameraHoldPausesScan();
  await scenarioCameraHoldActivationIsImmediate();
  await scenarioPhraseAndUndo();
  await scenarioClearAndMovie();
  await scenarioReviewHold();
  await scenarioInputCalibration();
  await scenarioDeveloperDemoMode();
  await assertNoViewportOverflow("pixel-4a-5g-layout");
  await scenarioZhTwLayoutMigration();
  await scenarioZhTwResetUsesPackagedDefaults();
  await scenarioZhTwLanguageSwitchReviewHold();
  await assertNoViewportOverflow("zh-tw-pixel-4a-5g-layout");

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
  await selectLabel("I", { rowIndex: 0 });
  await assertMessage("I ");
  await assertSuggestionLabels(["UNDO", "WANT", "NEED", "FEEL"]);
  await selectLabel("WANT", { rowIndex: 0 });
  await assertMessage("I want ");
  await assertSuggestionLabels(["UNDO", "DRINK", "WATER", "FOOD"]);
  await selectLabel("WATER", { rowIndex: 0 });
  await assertMessage("I want water ");
  steps.push(pass("phrase", "entered I want water with automatic trailing space through visible row/column scanning"));

  await selectLabel("UNDO", { rowIndex: 0 });
  await assertMessage("I want ");
  await selectLabel("FOOD", { rowIndex: 0 });
  await assertMessage("I want food ");
  steps.push(pass("undo-correction", "undid WATER and selected FOOD"));
}

async function scenarioFirstColumnProgressTiming() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      columns: 4,
      scanIntervalMs: 1200,
      transitionPauseMs: 0,
      firstCellPauseMs: 1800,
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.reload();
  `);
  await waitForUi();

  let snapshot = await getSnapshot();
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

  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioCameraHoldPausesScan() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      columns: 4,
      scanIntervalMs: 1200,
      transitionPauseMs: 0,
      firstCellPauseMs: 1200,
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false,
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
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioCameraHoldActivationIsImmediate() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      columns: 4,
      scanIntervalMs: 1200,
      transitionPauseMs: 0,
      firstCellPauseMs: 1200,
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false,
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
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.reload();
  `);
  await waitForUi();
}

async function scenarioClearAndMovie() {
  await selectLabel("CLR");
  await assertMessage("");
  steps.push(pass("clear", "selected CLR from the visible board"));

  for (const label of ["M", "O", "V", "I"]) {
    await selectLabel(label, { occurrence: "last" });
  }
  await assertMessage("movi");
  await assertSuggestionLabels(["UNDO", "SPC", "MOVIE", "E"]);
  await selectLabel("MOVIE", { rowIndex: 0 });
  await assertMessage("movie ");
  steps.push(pass("completion", "typed movi and completed to movie with automatic trailing space"));

  await selectLabel("DEL");
  await assertMessage("movie");
  steps.push(pass("delete", "selected DEL and removed the automatic trailing space"));
}

async function scenarioReviewHold() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: true
    }));
    location.reload();
  `);
  await waitForUi();
  await selectLabel("I", { rowIndex: 0 });
  await assertMessage("I ");

  let snapshot = await getSnapshot();
  if (!snapshot.reviewHold) throw new Error("Review hold should be active after suggestion-changing input");
  if (snapshot.phase !== "Review") throw new Error(`Expected Review phase during hold, got ${snapshot.phase}`);
  if ((snapshot.activeProgress ?? 0) < 99) throw new Error(`Expected held progress fill, got ${snapshot.activeProgress}`);
  const heldRow = snapshot.activeRow?.rowIndex;
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
  steps.push(pass("review-hold", "default hold pauses after suggestion changes and resumes on next activation"));

  await evaluate(`
    {
      const stored = JSON.parse(localStorage.getItem("shine-aac-web-config-v1") ?? "{}");
      localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
        ...stored,
        scanIntervalMs: ${BrowserSmokeScanMs},
        transitionPauseMs: 0,
        firstCellPauseMs: ${BrowserSmokeScanMs},
        inputLatencyCompensationMs: 0
      }));
    }
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.reload();
  `);
  await waitForUi();
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

async function scenarioDeveloperDemoMode() {
  await evaluate(`
    localStorage.removeItem("shine-aac-demo-mode");
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 18,
      profileId: "en-US",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.href = ${JSON.stringify(appUrl)};
  `);
  await waitForUi();
  await longPressSelector(".config-button", 2000);
  await waitForDemoActive();
  await assertMessage("I need help ", 20000);
  await delay(3000);
  if (!await isDemoActive()) throw new Error("Rich demo should remain active after the first utterance");
  const snapshot = await getSnapshot();
  await clickTarget(snapshot.activeRow ?? snapshot.activeCell);
  await waitForDemoInactive();
  steps.push(pass("demo-mode", "hidden Config long-press starts extended conversation demo and tap exits it"));
}

async function scenarioZhTwHomeDemoMode() {
  const expected = "今天比較累但是心情好想聽你講這樣很舒服謝謝";
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 18,
      profileId: "zh-TW",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.href = ${JSON.stringify(`${appUrl}?demo=zh-tw-home`)};
  `);
  await waitForRenderedBoard();
  await waitForDemoActive();
  await assertMessage(expected, 420000);
  await assertMessageScrolledToEnd();
  await waitForDemoInactive();
  await evaluate(`globalThis.ShineAacDemoError = ""`);
  steps.push(pass("zh-tw-demo-mode", "automated the zh-TW home conversation through normal visible suggestions"));
}

async function scenarioZhTwLayoutMigration() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 8,
      profileId: "zh-TW",
      columns: 4,
      scanIntervalMs: ${BrowserSmokeScanMs},
      transitionPauseMs: 0,
      firstCellPauseMs: ${BrowserSmokeScanMs},
      inputLatencyCompensationMs: 0,
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
    location.reload();
  `);
  await waitForLabels(["ㄅ", "ㄧ", "ㄩ", "EN"]);

  let snapshot = await getSnapshot();
  let labels = snapshot.rows.flat().map((tile) => tile.label);
  assertArrayEqual(snapshot.rows[4].map((tile) => tile.label), ["是", "不", "幫忙", "痛"], "zh-TW static core response row");
  for (const expected of ["EN", "ㄅ", "ㄧ", "ㄩ", "說", "刪", "清除"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW layout missing ${expected}`);
  }
  for (const rejected of ["E", "T", "空格", "我要喝水", "我要吃飯", "。", "謝謝", "ㄅㄆㄇㄈ", "注音", "需要", "表達"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW layout should not include ${rejected}`);
  }
  await assertTileLabelsFit(["ㄅ", "ㄓ", "ㄧ", "EN", "不"]);

  await selectLabel("ㄅ");
  snapshot = await getSnapshot();
  labels = snapshot.rows.flat().map((tile) => tile.label);
  if (!labels.includes("復原")) throw new Error("zh-TW undo suggestion should be localized as 復原");
  if (labels.includes("UNDO")) throw new Error("zh-TW undo suggestion should not render as UNDO");
  if (!labels.includes("ㄚ")) throw new Error("zh-TW following Zhuyin suggestion missing ㄚ after ㄅ");
  await selectLabel("ㄧ");
  await assertMessage("ㄅㄧ");
  snapshot = await getSnapshot();
  labels = snapshot.rows.flat().map((tile) => tile.label);
  for (const expected of ["不要", "比", "筆"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW replacement suggestion missing ${expected}`);
  }
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
  steps.push(pass("zh-tw-layout", "migrated old zh-TW config to direct Zhuyin symbols and replacement suggestions"));
}

async function scenarioZhTwResetUsesPackagedDefaults() {
  await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      document.querySelector('[data-action="reset"]')?.click();
    })()
  `);
  await waitForLabels(["ㄅ", "ㄧ", "ㄩ", "EN"]);
  const snapshot = await getSnapshot();
  const labels = snapshot.rows.flat().map((tile) => tile.label);
  for (const expected of ["EN", "ㄅ", "ㄧ", "ㄩ", "說", "刪", "清除"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW reset layout missing ${expected}`);
  }
  for (const rejected of ["E", "T", "空格", "我要喝水", "我要吃飯", "。", "謝謝", "ㄅㄆㄇㄈ", "注音", "需要", "表達"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW reset layout should not include ${rejected}`);
  }
  const stored = await evaluate(`
    (() => {
      const config = JSON.parse(localStorage.getItem("shine-aac-web-config-v1"));
      return {
        configVersion: config.configVersion,
        profileId: config.profileId,
        symbols: config.symbols,
        symbolLines: config.symbols.split(/\\n/),
        suggestionDictionary: config.suggestionDictionary
      };
    })()
  `);
  if (stored.configVersion < 18 || stored.profileId !== "zh-TW") {
    throw new Error(`zh-TW reset saved wrong config metadata: ${JSON.stringify(stored)}`);
  }
  if (
    !stored.symbols.includes("ㄅ") ||
    !stored.symbols.includes("EN=<category:english>") ||
    !stored.symbols.includes("說=<speak>") ||
    !stored.symbols.includes("刪=<delete>") ||
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
  steps.push(pass("zh-tw-reset", "reset restored packaged zh-TW defaults instead of stale stored layout"));
}

async function scenarioZhTwLanguageSwitchReviewHold() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: true
    }));
    location.reload();
  `);
  await waitForLabels(["\u3105", "\u3127", "\u3129", "EN"]);

  await selectLabel("EN");
  let snapshot = await getSnapshot();
  if (!snapshot.reviewHold) throw new Error("Language switch to EN should use suggestion-change review hold");
  if (!snapshot.rows.flat().some((tile) => tile.label === "\u6ce8\u97f3")) {
    throw new Error("English category should show 注音 close tile");
  }
  if (!snapshot.rows.flat().some((tile) => tile.label === "E")) {
    throw new Error("English category should show English spelling symbols");
  }
  await clickTarget(snapshot.activeRow);
  await delay(40);

  await selectLabel("\u6ce8\u97f3", { rowIndex: 0 });
  snapshot = await getSnapshot();
  if (!snapshot.reviewHold) throw new Error("Language switch back to Zhuyin should use suggestion-change review hold");
  if (!snapshot.rows.flat().some((tile) => tile.label === "EN")) {
    throw new Error("Zhuyin board should show EN entry point after closing English category");
  }
  await clickTarget(snapshot.activeRow);
  await delay(40);

  await evaluate(`
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      rowScanVoice: false,
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true,
      holdAfterSuggestionChange: false
    }));
    location.reload();
  `);
  await waitForLabels(["\u3105", "\u3127", "\u3129", "EN"]);
  steps.push(pass("zh-tw-language-switch-review-hold", "EN and 注音 language switches use the suggestion-change review hold setting"));
}

async function selectLabel(label, options = {}) {
  const position = await findLabel(label, options);
  await selectCell(position.rowIndex, position.cellIndex);
}

async function selectCell(rowIndex, cellIndex) {
  const initialSnapshot = await getSnapshot();
  const rowTimeoutMs = Math.max(30000, (initialSnapshot.rows.length + 2) * 1500);
  const rowSnapshot = await waitForActive(
    ({ activeRow }) => activeRow?.rowIndex === rowIndex,
    `row ${rowIndex}`,
    rowTimeoutMs
  );
  await clickTarget(rowSnapshot.activeRow);
  const cellSnapshot = await waitForActive(
    ({ activeCell }) => activeCell?.rowIndex === rowIndex && activeCell?.cellIndex === cellIndex,
    `cell ${rowIndex}:${cellIndex}`,
    cellIndex === 0 ? 30000 : 12000
  );
  await clickTarget(cellSnapshot.activeCell);
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

async function waitForActive(predicate, description, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot();
    if (predicate(snapshot)) return snapshot;
    await delay(20);
  }
  throw new Error(`Timed out waiting for active ${description}`);
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
    if (snapshot?.rows?.length > 0 && snapshot.rows.flat().some((tile) => tile.label === "WANT")) return;
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

async function isDemoActive() {
  return evaluate(`document.body.classList.contains("demo-active")`);
}

async function waitForLabels(expectedLabels) {
  const deadline = Date.now() + UiWaitTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot().catch(() => null);
    const labels = snapshot?.rows?.flat().map((tile) => tile.label) ?? [];
    if (expectedLabels.every((label) => labels.includes(label))) return;
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
          const scaleMatch = transform.match(/scaleX\\(([^)]+)\\)/);
          if (scaleMatch) {
            progress = Number.parseFloat(scaleMatch[1]) * 100;
          } else if (transform.startsWith("matrix(")) {
            progress = Number.parseFloat(transform.slice(7).split(",")[0]) * 100;
          }
          return {
            rowIndex,
            cellIndex,
            label: tile.dataset.label ?? "",
            action: tile.dataset.action ?? "",
            activeRow: tile.classList.contains("active-row"),
            activeCell: tile.classList.contains("active-cell"),
            reviewHold: tile.classList.contains("review-hold"),
            cameraHold: tile.classList.contains("camera-hold"),
            progress,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
        })
      );
      const activeRow = rows.flat().find((tile) => tile.activeRow) ?? null;
      const activeCell = rows.flat().find((tile) => tile.activeCell) ?? null;
      const messageNode = document.querySelector('[data-testid="message"]');
      const message = messageNode?.dataset.rawMessage ?? null;
      const phase = document.querySelector(".phase")?.textContent ?? "";
      const current = activeCell ?? activeRow;
      return {
        message,
        rows,
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
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
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

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    sendFrame(this.socket, payload);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10000).unref();
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
