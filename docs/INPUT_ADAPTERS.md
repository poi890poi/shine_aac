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

## Next Steps

1. Add direct support for more keyboard key mappings.
2. Add a helper-facing input test screen showing each detected source.
3. Improve Android accessibility labels/focus for OS-level Switch Access.
4. Test cheap Bluetooth camera shutter remotes and USB foot pedals.
5. Add camera/gesture adapters only after the event boundary is stable.
