# Alternative Input Survey

Generated: 2026-07-03

## Goal

SHINE AAC should treat input as a replaceable adapter. The communication core should continue to receive a small set of intent events, while platform-specific code decides how a user produces those events.

Initial event model:

```text
activate
next
previous
pause
```

The MVP only requires `activate`. Additional events can enable step scanning, group scanning, or emergency escape without changing message editing or vocabulary logic.

## Findings

Android already provides several broadly available access paths. Google Switch Access supports external USB/Bluetooth switches, standard keyboards, built-in device buttons, one-switch auto scanning, two-switch step scanning, group selection, spoken feedback, and Camera Switches. Camera Switches use the front camera and facial gestures such as looking left/right, smiling, raising eyebrows, or opening the mouth. Google Voice Access can control Android by spoken commands and supports offline recognition language packs on newer Android versions.

AAC guidance also warns that access method selection must be individualized. Motor, vision, cognition, fatigue, device mounting, communication context, and helper availability matter as much as raw speed.

## Candidate Inputs

| Input method | Cost | Accessibility | Coverage | Notes |
| --- | --- | --- | --- | --- |
| Whole-screen touch as one switch | Free | Already implemented | Medium | Good for users who can make one coarse touch. Poor for users with no reliable arm/hand motion. |
| External Bluetooth/USB switch or keyboard key | Low to medium | Strong | High | Most reliable next step. Android already supports switches/keyboards; app can also listen for key events directly. Requires hardware, mounting, and pairing. |
| Phone volume buttons | Free | Medium | Medium | Useful developer/test fallback and may help some users. Physically awkward if the phone is mounted. Risk of OS volume behavior conflicts. |
| Android Switch Access integration | Free plus optional hardware | Strong | High | Leverages OS accessibility scanning, external switches, keyboard switches, spoken feedback, and Camera Switches. Best near-term compatibility path, but app must expose accessible labels and predictable focus order. |
| Front-camera facial gesture input | Free on most smartphones | Medium | Medium to high | Promising for users without hand control. Needs stable mount, clear face view, lighting, fatigue tuning, and privacy consideration. Built-in Camera Switches may be better than custom vision for the next milestone. |
| Voice command / Voice Access | Free | Strong for users with reliable speech | Medium | Low motor burden. Not useful for users whose speech is impaired; microphone/privacy/noise issues. Offline language packs reduce network dependence. |
| Head tracking / dwell | Free to medium | Medium | Medium | Useful for some users with head control. Usually needs platform accessibility support or custom camera processing. Higher false-positive risk than switch events. |
| Sip-and-puff or specialty switch | Medium to high | Strong for some severe motor impairments | Lower | Clinically important but hardware-dependent. Treat as external switch input where possible. |
| Eye tracking | High unless OS/device provides it | Strong for some users | Lower initially | Powerful but hardware and calibration heavy. Not the next low-cost smartphone-first path. |

## Recommendation

Next milestone should implement an `InputAdapter` boundary in the platform shell, then add these in order:

1. Keyboard/external switch adapter: map `Space`, `Enter`, headset/media button, and configurable keys to `activate`.
2. Android accessibility compatibility pass: accessible labels, focus order, large target semantics, and documentation for using Android Switch Access and Camera Switches with the app.
3. Optional direct volume-button adapter in Android native code.
4. Camera/facial gesture investigation: prefer Android Camera Switches first; only build custom camera detection if OS-level Camera Switches cannot drive the app well enough.
5. Voice command mode: useful for a different population than switch scanning, so keep it optional and separate from AAC speech output.

## Design Constraints

- Keep AAC business logic platform-independent.
- Do not make camera, microphone, or network access required for the default app.
- Input adapters should emit intent events, not modify messages directly.
- Every new input method needs a visible/audible feedback path and a false-positive recovery path.
- Human UX testing should measure fatigue, false activations, missed activations, and setup burden, not just whether a demo works once.

## Sources

- Android Switch Access: https://support.google.com/accessibility/android/answer/6122836
- Android Switch Access setup and spoken feedback: https://support.google.com/accessibility/android/answer/6301490
- Android Camera Switches: https://support.google.com/accessibility/android/answer/11150722
- Android Voice Access: https://support.google.com/accessibility/android/answer/6151848
- AAC overview, access methods, rate enhancement, and vocabulary organization: https://en.wikipedia.org/wiki/Augmentative_and_alternative_communication
- Switch access scanning: https://en.wikipedia.org/wiki/Switch_access_scanning
