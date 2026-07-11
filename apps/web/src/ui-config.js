export const defaultUiConfig = Object.freeze({
  rowScanVoice: false,
  scanVoice: true,
  activationVoice: true,
  restartScanFromTop: true,
  hardwareButtons: true,
  cameraSwitch: false,
  switchInputProfile: "hardware-buttons",
  holdAfterSuggestionChange: true
});

export function loadUiConfig(storageKey) {
  const nativeConfig = loadNativeUiConfig();
  if (nativeConfig) return normalizeUiConfig(nativeConfig);

  try {
    return normalizeUiConfig({ ...defaultUiConfig, ...JSON.parse(localStorage.getItem(storageKey) ?? "null") });
  } catch {
    return defaultUiConfig;
  }
}

export function saveUiConfig(storageKey, config) {
  const normalized = normalizeUiConfig(config);
  localStorage.setItem(storageKey, JSON.stringify(normalized));
  syncNativeUiConfig(normalized);
}

export function syncNativeUiConfig(config) {
  if (!globalThis.ShineAacAndroid?.setUiConfigJson) return;
  try {
    globalThis.ShineAacAndroid.setUiConfigJson(JSON.stringify(config));
  } catch {
    // Native sync is best effort; browser builds do not provide it.
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

export function normalizeUiConfig(config) {
  const profile = normalizeSwitchInputProfile(config.switchInputProfile, config);
  return {
    ...defaultUiConfig,
    ...config,
    switchInputProfile: profile,
    hardwareButtons: profile === "hardware-buttons" || profile === "hardware-and-camera",
    cameraSwitch: profile === "camera-long-blink" || profile === "hardware-and-camera"
  };
}

export function normalizeSwitchInputProfile(profile, config = {}) {
  if (
    profile === "off" ||
    profile === "hardware-buttons" ||
    profile === "camera-long-blink" ||
    profile === "hardware-and-camera"
  ) {
    return profile;
  }
  const hardware = config.hardwareButtons !== false;
  const camera = config.cameraSwitch === true;
  if (hardware && camera) return "hardware-and-camera";
  if (camera) return "camera-long-blink";
  if (hardware) return "hardware-buttons";
  return "off";
}
