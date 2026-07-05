export const defaultUiConfig = Object.freeze({
  rowScanVoice: false,
  scanVoice: true,
  activationVoice: true,
  restartScanFromTop: true,
  hardwareButtons: true,
  holdAfterSuggestionChange: true
});

export function loadUiConfig(storageKey) {
  const nativeConfig = loadNativeUiConfig();
  if (nativeConfig) return nativeConfig;

  try {
    return { ...defaultUiConfig, ...JSON.parse(localStorage.getItem(storageKey) ?? "null") };
  } catch {
    return defaultUiConfig;
  }
}

export function saveUiConfig(storageKey, config) {
  localStorage.setItem(storageKey, JSON.stringify(config));
  syncNativeUiConfig(config);
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
