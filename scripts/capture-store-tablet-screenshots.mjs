import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  CurrentConfigVersion,
  createBoardConfig,
  serializeDictionary,
  serializeSymbols
} from "../packages/aac-core/src/index.js";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const webPort = Number(process.env.SHINE_AAC_WEB_PORT ?? 5174);
const debugPort = Number(process.env.SHINE_AAC_CDP_PORT ?? 9224);
const edgePath = process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profileDir = join(process.env.TEMP ?? repoRoot, `shine-aac-store-screens-${Date.now()}`);
const appUrl = `http://127.0.0.1:${webPort}/apps/web/`;
const outputRoot = join(repoRoot, "store-assets", "screenshots");
const zhTwConfig = createBoardConfig({ profileId: "zh-TW" });
const seededConfig = JSON.stringify({
  configVersion: CurrentConfigVersion,
  profileId: zhTwConfig.profileId,
  columns: zhTwConfig.columns,
  scanIntervalMs: zhTwConfig.scanIntervalMs,
  transitionPauseMs: zhTwConfig.transitionPauseMs,
  firstCellPauseMs: zhTwConfig.firstCellPauseMs,
  inputLatencyCompensationMs: zhTwConfig.inputLatencyCompensationMs,
  suggestionDictionary: serializeDictionary(zhTwConfig.suggestionDictionary),
  symbols: serializeSymbols(zhTwConfig.symbols)
});
const seededUiConfig = JSON.stringify({
  rowScanVoice: false,
  scanVoice: false,
  activationVoice: false,
  restartScanFromTop: true,
  switchInputProfile: "hardware-buttons",
});

const devices = [
  {
    name: "7-inch-tablet",
    outputDir: join(outputRoot, "tablet-7"),
    cssWidth: 600,
    cssHeight: 960,
    deviceScaleFactor: 2
  },
  {
    name: "10-inch-tablet",
    outputDir: join(outputRoot, "tablet-10"),
    cssWidth: 800,
    cssHeight: 1280,
    deviceScaleFactor: 2
  }
];

const shots = [
  {
    file: "01-row-scanning.png",
    setup: `
      localStorage.removeItem("shine-aac-text-history-v1");
      document.body.classList.remove("config-open");
    `
  },
  {
    file: "02-symbol-scanning-suggestions.png",
    setup: `
      globalThis.ShineAacInput.receive({ intent: "activate", source: "store-screenshot" });
      await new Promise((resolve) => setTimeout(resolve, 120));
      globalThis.ShineAacInput.receive({ intent: "activate", source: "store-screenshot" });
      await new Promise((resolve) => setTimeout(resolve, 180));
    `
  },
  {
    file: "03-configuration-basic.png",
    setup: `
      document.querySelector(".config-button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
    `
  },
  {
    file: "04-configuration-input-options.png",
    setup: `
      document.querySelector(".config-button")?.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
      document.querySelector(".config-panel")?.scrollTo({ top: 520, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 80));
    `
  }
];

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
    await waitForHttp(appUrl, 30000);

    edgeProcess = spawn(edgePath, [
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--disable-background-networking",
      "--disable-crash-reporter",
      "--disable-breakpad",
      "--disable-features=CalculateNativeWinOcclusion,Vulkan",
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
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 30000);

    for (const device of devices) {
      mkdirSync(device.outputDir, { recursive: true });
      for (const shot of shots) {
        await captureShot(device, shot);
      }
    }
  } finally {
    cdp?.close();
    edgeProcess?.kill();
    serverProcess?.kill();
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup. Edge can briefly hold Crashpad files after a headless crash.
    }
  }
}

async function captureShot(device, shot) {
  const target = await createTarget("about:blank");
  cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: device.cssWidth,
    height: device.cssHeight,
    deviceScaleFactor: device.deviceScaleFactor,
    mobile: true
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      localStorage.setItem("shine-aac-web-config-v1", ${JSON.stringify(seededConfig)});
      localStorage.setItem("shine-aac-web-ui-v1", ${JSON.stringify(seededUiConfig)});
      localStorage.removeItem("shine-aac-text-history-v1");
    `
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await waitForUi();
  await evaluate(`(async () => { ${shot.setup} })()`);
  await delay(250);
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const outputPath = join(device.outputDir, shot.file);
  writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
  console.log(`Generated ${outputPath}`);
  cdp.close();
  cdp = null;
}

async function waitForUi() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ok = await evaluate(`
      Boolean(document.querySelector('[data-testid="board"]')?.querySelector(".tile"))
    `).catch(() => false);
    if (ok) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for web UI");
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
  const header = [0x81];
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

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(error?.stack ?? String(error));
  process.exit(1);
}
