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
- Android camera long blink through on-device ML Kit face detection: `activate`

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

`Config` provides two general hardware choices in its existing switch-input
selector:

- `Buttons — keep volume control` is the default. Camera/focus keys, supported
  media keys, and external controller buttons activate scanning, while volume
  keys remain available to adjust Android media volume.
- `Buttons — volume activates` uses the same hardware path and also consumes
  volume-up and volume-down as activation events. This supports devices such as
  Bluetooth shutter remotes that present themselves as volume controls.

Changing back to `Buttons — keep volume control` immediately restores normal
volume adjustment. Phone volume and remote-generated volume events are treated
alike because Android does not provide a reliable universal distinction between
them.

`Camera long blink` and `Hardware + camera` enable blink input. Open `Camera
setup`, grant camera permission, and use `Next camera` to cycle through every
compatible front, rear, or USB/external camera exposed by Android Camera2. The
selected camera is retained for live scanning; if its camera ID changes after an
external camera reconnects, the app falls back to another camera with the same
lens-facing type. Camera setup adapts its preview and analysis streams to sizes
the selected camera actually supports. USB support depends on the Android device
and firmware exposing the webcam through Camera2; direct USB-video access is not
used.

`Config` also includes `Input test`, a helper-facing calibration mode. It pauses normal scanning and records activation events without editing the message. The page has two source categories:

- Reliable switch: for touch, keyboard, volume keys, and external switches that should produce one clean activation per intentional action.
- Noisy sensor: for future camera, EMG, or other threshold-based adapters where false activations at rest, missed actions, and repeated fires need to be measured separately.

The same `window.ShineAacInput.receive(...)` entry point is used in calibration and communication mode, so future adapters can be tested before they are trusted for message entry.

## Next Steps

1. Add direct support for more keyboard key mappings.
2. Improve Android accessibility labels/focus for OS-level Switch Access.
3. Test cheap Bluetooth camera shutter remotes and USB foot pedals.
4. Expand camera gestures beyond long blink only after real-device validation.
