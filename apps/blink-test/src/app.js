const video = document.querySelector("#video");
const overlay = document.querySelector("#overlay");
const roiBox = document.querySelector("#roiBox");
const ctx = overlay.getContext("2d", { willReadFrequently: true });

const controls = {
  startButton: document.querySelector("#startButton"),
  calibrateOpenButton: document.querySelector("#calibrateOpenButton"),
  calibrateClosedButton: document.querySelector("#calibrateClosedButton"),
  clearButton: document.querySelector("#clearButton"),
  roiX: document.querySelector("#roiX"),
  roiY: document.querySelector("#roiY"),
  roiW: document.querySelector("#roiW"),
  roiH: document.querySelector("#roiH"),
  metric: document.querySelector("#metric"),
  autoThreshold: document.querySelector("#autoThreshold"),
  threshold: document.querySelector("#threshold"),
  hysteresis: document.querySelector("#hysteresis"),
  longBlinkMs: document.querySelector("#longBlinkMs"),
  doubleGapMs: document.querySelector("#doubleGapMs"),
  ignoreShortMs: document.querySelector("#ignoreShortMs"),
  cooldownMs: document.querySelector("#cooldownMs")
};

const output = {
  eyeState: document.querySelector("#eyeState"),
  scoreText: document.querySelector("#scoreText"),
  eventCount: document.querySelector("#eventCount"),
  openText: document.querySelector("#openText"),
  closedText: document.querySelector("#closedText"),
  thresholdText: document.querySelector("#thresholdText"),
  closureText: document.querySelector("#closureText"),
  eventLog: document.querySelector("#eventLog")
};

let rafId = 0;
let openBaseline = null;
let closedBaseline = null;
let latestFeatures = null;
let latestScore = 0;
let closed = false;
let closedStartedAt = 0;
let lastShortBlinkAt = 0;
let lastEventAt = 0;
let eventCount = 0;

controls.startButton.addEventListener("click", startCamera);
controls.calibrateOpenButton.addEventListener("click", () => calibrate("open"));
controls.calibrateClosedButton.addEventListener("click", () => calibrate("closed"));
controls.clearButton.addEventListener("click", clearLog);

for (const input of [controls.roiX, controls.roiY, controls.roiW, controls.roiH]) {
  input.addEventListener("input", updateRoiBox);
}

for (const input of [
  controls.metric,
  controls.autoThreshold,
  controls.threshold,
  controls.hysteresis,
  controls.longBlinkMs,
  controls.doubleGapMs,
  controls.ignoreShortMs,
  controls.cooldownMs
]) {
  input.addEventListener("input", updateReadout);
}

updateRoiBox();
updateReadout();

async function startCamera() {
  controls.startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    logEvent("Camera started", "event-close");
    loop();
  } catch (error) {
    controls.startButton.disabled = false;
    logEvent(`Camera failed: ${error.message}`, "event-long");
  }
}

function loop() {
  if (!video.videoWidth || !video.videoHeight) {
    rafId = requestAnimationFrame(loop);
    return;
  }

  if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }

  ctx.save();
  ctx.translate(overlay.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
  ctx.restore();
  latestFeatures = readRoiFeatures();
  latestScore = scoreFeatures(latestFeatures);
  updateBlinkState(performance.now(), latestScore);
  updateReadout();
  rafId = requestAnimationFrame(loop);
}

function readRoiFeatures() {
  const roi = roiPixels();
  const image = ctx.getImageData(roi.x, roi.y, roi.w, roi.h);
  const data = image.data;
  let sum = 0;
  let sumSquares = 0;
  let gradients = 0;
  let previous = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const luma = (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
    sum += luma;
    sumSquares += luma * luma;
    if (count > 0) gradients += Math.abs(luma - previous);
    previous = luma;
    count += 1;
  }

  const mean = count ? sum / count : 0;
  const variance = count ? Math.max(0, sumSquares / count - mean * mean) : 0;
  const contrast = Math.sqrt(variance);
  const edge = count ? gradients / count : 0;

  return { mean, contrast, edge };
}

function scoreFeatures(features) {
  if (!features) return 0;
  const open = openBaseline ?? features;
  const closedSample = closedBaseline;

  switch (controls.metric.value) {
    case "brightnessRise":
      return clamp(features.mean - open.mean + 0.5, 0, 1);
    case "brightnessDrop":
      return clamp(open.mean - features.mean + 0.5, 0, 1);
    case "combined": {
      const contrastDrop = normalizedDrop(features.contrast + features.edge, open.contrast + open.edge);
      const brightnessDelta = closedSample
        ? normalizedToward(features.mean, open.mean, closedSample.mean)
        : clamp(Math.abs(features.mean - open.mean) * 3, 0, 1);
      return clamp((contrastDrop * 0.7) + (brightnessDelta * 0.3), 0, 1);
    }
    case "contrastDrop":
    default:
      return normalizedDrop(features.contrast + features.edge, open.contrast + open.edge);
  }
}

function normalizedDrop(value, openValue) {
  if (openValue <= 0.0001) return 0;
  return clamp((openValue - value) / openValue, 0, 1);
}

function normalizedToward(value, openValue, closedValue) {
  const distance = closedValue - openValue;
  if (Math.abs(distance) <= 0.0001) return 0;
  return clamp((value - openValue) / distance, 0, 1);
}

function updateBlinkState(now, score) {
  const threshold = activeThreshold();
  const hysteresis = Number(controls.hysteresis.value);
  const closeAt = threshold + hysteresis;
  const openAt = threshold - hysteresis;

  if (!closed && score >= closeAt) {
    closed = true;
    closedStartedAt = now;
  } else if (closed && score <= openAt) {
    closed = false;
    const duration = now - closedStartedAt;
    handleClosure(now, duration);
  }

  output.eyeState.textContent = closed ? "closed" : "open";
}

function handleClosure(now, duration) {
  const longBlinkMs = Number(controls.longBlinkMs.value);
  const doubleGapMs = Number(controls.doubleGapMs.value);
  const ignoreShortMs = Number(controls.ignoreShortMs.value);
  const cooldownMs = Number(controls.cooldownMs.value);

  output.closureText.textContent = `${Math.round(duration)} ms`;

  if (duration < ignoreShortMs) return;
  if (now - lastEventAt < cooldownMs) {
    lastShortBlinkAt = now;
    return;
  }

  if (duration >= longBlinkMs) {
    emitDetectedEvent("LONG BLINK", `${Math.round(duration)} ms`, "event-long");
    lastShortBlinkAt = 0;
    return;
  }

  if (lastShortBlinkAt && now - lastShortBlinkAt <= doubleGapMs) {
    emitDetectedEvent("DOUBLE BLINK", `${Math.round(now - lastShortBlinkAt)} ms gap`, "event-double");
    lastShortBlinkAt = 0;
    return;
  }

  lastShortBlinkAt = now;
  logEvent(`blink ${Math.round(duration)} ms`, "event-close");
}

function emitDetectedEvent(name, detail, className) {
  lastEventAt = performance.now();
  eventCount += 1;
  output.eventCount.textContent = String(eventCount);
  logEvent(`${name} (${detail})`, className);
}

function calibrate(kind) {
  if (!latestFeatures) {
    logEvent("Start camera before calibration", "event-long");
    return;
  }
  const sample = { ...latestFeatures };
  if (kind === "open") {
    openBaseline = sample;
    closed = false;
    logEvent("Open baseline captured", "event-close");
  } else {
    closedBaseline = sample;
    logEvent("Closed sample captured", "event-close");
  }
  updateReadout();
}

function activeThreshold() {
  if (!controls.autoThreshold.checked) return Number(controls.threshold.value);
  if (openBaseline && closedBaseline) {
    const scoreWhenClosed = scoreFeatures(closedBaseline);
    return clamp(scoreWhenClosed * 0.5, 0.05, 0.95);
  }
  return Number(controls.threshold.value);
}

function updateReadout() {
  output.scoreText.textContent = latestScore.toFixed(3);
  output.openText.textContent = formatFeatures(openBaseline);
  output.closedText.textContent = formatFeatures(closedBaseline);
  output.thresholdText.textContent = activeThreshold().toFixed(3);
  controls.threshold.disabled = controls.autoThreshold.checked;
  updateRoiBox();
}

function formatFeatures(features) {
  if (!features) return "not set";
  return `brightness ${features.mean.toFixed(3)}, contrast ${features.contrast.toFixed(3)}, edge ${features.edge.toFixed(3)}`;
}

function roiPixels() {
  const xPct = Number(controls.roiX.value) / 100;
  const yPct = Number(controls.roiY.value) / 100;
  const wPct = Number(controls.roiW.value) / 100;
  const hPct = Number(controls.roiH.value) / 100;
  const x = Math.round(overlay.width * xPct);
  const y = Math.round(overlay.height * yPct);
  const w = Math.max(4, Math.round(overlay.width * wPct));
  const h = Math.max(4, Math.round(overlay.height * hPct));
  return {
    x: clampInt(x, 0, Math.max(0, overlay.width - 4)),
    y: clampInt(y, 0, Math.max(0, overlay.height - 4)),
    w: clampInt(w, 4, Math.max(4, overlay.width - x)),
    h: clampInt(h, 4, Math.max(4, overlay.height - y))
  };
}

function updateRoiBox() {
  roiBox.style.left = `${controls.roiX.value}%`;
  roiBox.style.top = `${controls.roiY.value}%`;
  roiBox.style.width = `${controls.roiW.value}%`;
  roiBox.style.height = `${controls.roiH.value}%`;
}

function clearLog() {
  output.eventLog.replaceChildren();
  eventCount = 0;
  output.eventCount.textContent = "0";
  output.closureText.textContent = "none";
  lastShortBlinkAt = 0;
  lastEventAt = 0;
}

function logEvent(text, className) {
  const item = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  item.textContent = `${time} ${text}`;
  item.className = className;
  output.eventLog.prepend(item);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value, min, max) {
  return Math.trunc(clamp(value, min, max));
}

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(rafId);
  const stream = video.srcObject;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }
});
