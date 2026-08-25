export const moeBopomofoVoiceName = "shine-aac-moe-bopomofo";
export const androidSystemVoiceName = "android-system-default";
export const currentUiConfigVersion = 1;
export const SpeechAfterReadModes = Object.freeze(["off", "replay", "conversation"]);

export const defaultUiConfig = Object.freeze({
  uiConfigVersion: currentUiConfigVersion,
  rowScanVoice: false,
  scanVoice: true,
  activationVoice: true,
  speechVoiceName: moeBopomofoVoiceName,
  speechAfterReadMode: "off",
  restartScanFromTop: true,
  verticalGroupProgress: false,
  holdToAdvance: false,
  hardwareButtons: true,
  cameraSwitch: false,
  switchInputProfile: "hardware-buttons",
  contrastTheme: "system"
});

export const ContrastThemes = Object.freeze([
  "system",
  "standard",
  "high-contrast",
  "high-contrast-dark"
]);

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
  const requestedSpeechVoiceName = typeof config.speechVoiceName === "string"
    ? config.speechVoiceName.slice(0, 200)
    : "";
  const speechVoiceName = requestedSpeechVoiceName || moeBopomofoVoiceName;
  // "default" was the original fixed light palette. Keep that explicit
  // choice stable for existing users while new installs follow Android's
  // light/dark appearance through the custom System board preset.
  const requestedContrastTheme = config.contrastTheme === "default"
    ? "standard"
    : config.contrastTheme;
  const contrastTheme = ContrastThemes.includes(requestedContrastTheme)
    ? requestedContrastTheme
    : defaultUiConfig.contrastTheme;
  const speechAfterReadMode = SpeechAfterReadModes.includes(config.speechAfterReadMode)
    ? config.speechAfterReadMode
    : defaultUiConfig.speechAfterReadMode;
  const normalized = {
    ...defaultUiConfig,
    ...config,
    uiConfigVersion: currentUiConfigVersion,
    // Blank is the pre-selector device-default value. Migrate it to the
    // lightweight Ministry of Education Bopomofo option.
    speechVoiceName,
    speechAfterReadMode,
    holdToAdvance: config.holdToAdvance === true,
    switchInputProfile: profile,
    contrastTheme,
    hardwareButtons: profile === "hardware-buttons" ||
      profile === "volume-buttons" ||
      profile === "hardware-and-camera",
    cameraSwitch: profile === "camera-long-blink" || profile === "hardware-and-camera"
  };
  delete normalized.holdAfterSuggestionChange;
  return normalized;
}

export function normalizeSwitchInputProfile(profile, config = {}) {
  if (
    profile === "off" ||
    profile === "hardware-buttons" ||
    profile === "volume-buttons" ||
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
