# Input Adapters

Generated: 2026-07-03

## Model

All input sources should emit intent events:

```text
activate
next
previous
pause
```

The current one-switch scanner only needs `activate`. Two-switch, group scanning, camera gestures, voice commands, or external switches can add the other intents later without changing message editing or vocabulary logic.

## Implemented Sources

- Touch anywhere on the communication screen: `activate`
- Keyboard `Space` or `Enter`: `activate`
- Android hardware buttons through the WebView shell: `activate`

Android hardware keys currently mapped:

- Volume up
- Volume down
- Camera key, when present
- Headset hook
- Media play/pause
- Gamepad/select/start style buttons

The WebView exposes:

```js
window.ShineAacInput.receive({ intent: "activate", source: "android-volume-up" });
```

Native Android code should call this entry point. Future input adapters should do the same instead of directly mutating UI state.

## Configuration

`Config` includes `Phone/external buttons activate switch`. It defaults on. When disabled, Android native code allows volume/media keys to fall back to normal system behavior where possible.

`Config` also includes `Input test`, a helper-facing calibration mode. It pauses normal scanning and records activation events without editing the message. The page has two source categories:

- Reliable switch: for touch, keyboard, volume keys, and external switches that should produce one clean activation per intentional action.
- Noisy sensor: for future camera, EMG, or other threshold-based adapters where false activations at rest, missed actions, and repeated fires need to be measured separately.

The same `window.ShineAacInput.receive(...)` entry point is used in calibration and communication mode, so future adapters can be tested before they are trusted for message entry.

## Next Steps

1. Add direct support for more keyboard key mappings.
2. Improve Android accessibility labels/focus for OS-level Switch Access.
3. Test cheap Bluetooth camera shutter remotes and USB foot pedals.
4. Add camera/gesture adapters only after the event boundary is stable.
