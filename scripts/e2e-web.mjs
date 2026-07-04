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
  await waitForHttp(appUrl, 6000);
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

  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 8000);
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
      scanIntervalMs: 500,
      transitionPauseMs: 0,
      firstCellPauseMs: 500,
      inputLatencyCompensationMs: 0
    }));
    localStorage.setItem("shine-aac-web-ui-v1", JSON.stringify({
      scanVoice: false,
      activationVoice: false,
      restartScanFromTop: true
    }));
    location.reload();
  `);
  await waitForUi();
  steps.push(pass("test-config", "seeded fast scan timing through browser localStorage"));

  await scenarioPhraseAndUndo();
  await scenarioClearAndMovie();
  await assertNoViewportOverflow("pixel-4a-5g-layout");
  await scenarioZhTwLayoutMigration();
  await scenarioZhTwResetUsesPackagedDefaults();
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
  await assertSuggestionLabels(["UNDO", "WANT", "NEED", "HELP"]);
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

async function scenarioZhTwLayoutMigration() {
  await evaluate(`
    localStorage.setItem("shine-aac-web-config-v1", JSON.stringify({
      configVersion: 8,
      profileId: "zh-TW",
      columns: 4,
      scanIntervalMs: 500,
      transitionPauseMs: 0,
      firstCellPauseMs: 500,
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
        "不要",
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
  await waitForLabels(["ㄅ", "ㄧ", "ㄩ", "更多"]);

  let snapshot = await getSnapshot();
  let labels = snapshot.rows.flat().map((tile) => tile.label);
  assertArrayEqual(snapshot.rows[3].map((tile) => tile.label), ["是", "不是", "要", "不要"], "zh-TW static core response row");
  for (const expected of ["ㄅ", "ㄧ", "ㄩ", "更多", "說", "刪", "清除"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW layout missing ${expected}`);
  }
  for (const rejected of ["我要喝水", "我要吃飯", "。", "謝謝", "ㄅㄆㄇㄈ", "注音", "需要", "表達"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW layout should not include ${rejected}`);
  }
  await assertTileLabelsFit(["ㄅ", "ㄓ", "ㄧ", "更多", "不要"]);

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
  for (const expected of ["不要", "不要動"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW replacement suggestion missing ${expected}`);
  }
  await assertTileLabelsFit(["不要", "不要動", "幫忙", "不是"]);
  await selectLabel("不要");
  await assertMessage("不要");
  steps.push(pass("zh-tw-layout", "migrated old zh-TW config to direct Zhuyin symbols and replacement suggestions"));
}

async function scenarioZhTwResetUsesPackagedDefaults() {
  await evaluate(`
    (() => {
      document.querySelector(".config-button")?.click();
      document.querySelector('[data-action="reset"]')?.click();
    })()
  `);
  await waitForLabels(["ㄅ", "ㄧ", "ㄩ", "更多"]);
  const snapshot = await getSnapshot();
  const labels = snapshot.rows.flat().map((tile) => tile.label);
  for (const expected of ["ㄅ", "ㄧ", "ㄩ", "更多", "說", "刪", "清除"]) {
    if (!labels.includes(expected)) throw new Error(`zh-TW reset layout missing ${expected}`);
  }
  for (const rejected of ["我要喝水", "我要吃飯", "。", "謝謝", "ㄅㄆㄇㄈ", "注音", "需要", "表達"]) {
    if (labels.includes(rejected)) throw new Error(`zh-TW reset layout should not include ${rejected}`);
  }
  const stored = await evaluate(`
    (() => {
      const config = JSON.parse(localStorage.getItem("shine-aac-web-config-v1"));
      return {
        configVersion: config.configVersion,
        profileId: config.profileId,
        symbols: config.symbols,
        suggestionDictionary: config.suggestionDictionary
      };
    })()
  `);
  if (stored.configVersion < 11 || stored.profileId !== "zh-TW") {
    throw new Error(`zh-TW reset saved wrong config metadata: ${JSON.stringify(stored)}`);
  }
  if (!stored.symbols.includes("ㄅ") || !stored.symbols.includes("更多=<more>") || stored.symbols.includes("ㄅㄆㄇㄈ=<zhuyin-group:labial>")) {
    throw new Error(`zh-TW reset did not persist packaged direct Zhuyin board: ${stored.symbols}`);
  }
  if (stored.suggestionDictionary.includes("我要喝水")) {
    throw new Error("zh-TW reset persisted old long suggestion dictionary");
  }
  steps.push(pass("zh-tw-reset", "reset restored packaged zh-TW defaults instead of stale stored layout"));
}

async function selectLabel(label, options = {}) {
  const position = await findLabel(label, options);
  await selectCell(position.rowIndex, position.cellIndex);
}

async function selectCell(rowIndex, cellIndex) {
  const rowSnapshot = await waitForActive(({ activeRow }) => activeRow?.rowIndex === rowIndex, `row ${rowIndex}`);
  await clickTarget(rowSnapshot.activeRow);
  const cellSnapshot = await waitForActive(
    ({ activeCell }) => activeCell?.rowIndex === rowIndex && activeCell?.cellIndex === cellIndex,
    `cell ${rowIndex}:${cellIndex}`,
    cellIndex === 0 ? 16000 : 8000
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

async function assertMessage(expected) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
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

async function waitForUi() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const snapshot = await getSnapshot().catch(() => null);
    if (snapshot?.rows?.length > 0 && snapshot.rows.flat().some((tile) => tile.label === "WANT")) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for web UI");
}

async function waitForLabels(expectedLabels) {
  const deadline = Date.now() + 8000;
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
          return {
            rowIndex,
            cellIndex,
            label: tile.dataset.label ?? "",
            action: tile.dataset.action ?? "",
            activeRow: tile.classList.contains("active-row"),
            activeCell: tile.classList.contains("active-cell"),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
        })
      );
      const activeRow = rows.flat().find((tile) => tile.activeRow) ?? null;
      const activeCell = rows.flat().find((tile) => tile.activeCell) ?? null;
      const messageNode = document.querySelector('[data-testid="message"]');
      const message = messageNode?.dataset.rawMessage ?? null;
      return { message, rows, activeRow, activeCell };
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
