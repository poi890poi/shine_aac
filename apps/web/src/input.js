export const InputIntent = Object.freeze({
  Activate: "activate",
  Next: "next",
  Previous: "previous",
  Pause: "pause"
});

export function isHardwareInput(source = "") {
  const normalized = String(source);
  return normalized.startsWith("android-hardware") ||
    normalized.startsWith("android-volume") ||
    normalized.startsWith("android-media");
}

export function isCameraInput(source = "") {
  return String(source).startsWith("android-camera");
}
