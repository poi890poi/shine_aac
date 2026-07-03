# Agent Onboarding

Generated: 2026-07-03

This document is for agentic AI joining the SHINE AAC project midstream.

## First Read

Read these before editing code:

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/AI_AGENT_GUIDE.md`
4. `docs/INPUT_ADAPTERS.md`
5. `docs/MULTILINGUAL_DESIGN.md`
6. `docs/TESTING_REPORT.md`

## Current Architecture

The app is a shared JavaScript AAC core plus a browser/WebView UI.

```text
packages/aac-core
  pure AAC logic and tests

apps/web
  rendering, timers, browser input, browser speech

app/src/main/java/.../MainActivity.kt
  Android WebView shell
  Android TTS bridge
  Android hardware-button input bridge
```

Do not put AAC business rules in Android Kotlin unless the rule is truly platform-specific.

## Current Git Milestones

- `v0.1.0-mvp`: first MVP demo build.
- `v0.1.1-mvp-ux`: known-good UX checkpoint before phone-button input.
- `3501464 Add phone button input adapter`: first input-adapter implementation on top of `v0.1.1-mvp-ux`.

## Non-Negotiable Behaviors

- Main communication uses one action: activate current scan target.
- Direct tile tapping is not the communication model.
- Suggestion row remains fixed at the top.
- Locked suggestion row must not change while column scanning.
- Word selections auto-add a trailing space in English.
- Letter selections do not auto-space.
- `zh-TW` must not auto-space Mandarin words.
- `UNDO` must remain cheap and reachable.
- Progress hint is a full-height fill inside the active target.
- Phone/external buttons go through the input adapter event path.

## Input Work

All input sources should emit intent events:

```text
activate
next
previous
pause
```

Current implemented sources:

- touch anywhere on board
- keyboard `Space` / `Enter`
- Android volume/media/camera-style hardware keys

Future input sources such as external Bluetooth switches, Camera Switches, voice commands, or head gestures must emit the same intent events. They must not directly edit the message.

## Language Work

Do not treat language support as translation.

Required approach:

1. Extract current English into an `en-US` profile.
2. Add `zh-TW` as an independent profile.
3. Add `symbols-basic` as an independent profile.
4. Keep shared scanner/history/input logic in common core.
5. Keep layout, tokenizer, composition, dictionary, suggestion ranking, and speech locale inside profiles.

First `zh-TW` target should be phrase-first and easy to switch in configuration. It should not attempt full Mandarin text entry immediately.

## Verification Checklist

For ordinary core/UI changes:

```powershell
npm run test:core
npm run test:web:e2e
.\build-test.bat -SdkDir E:\Android\Sdk
```

For Android input changes:

```powershell
.\e2e-switch-test.bat -NoBuild -SdkDir E:\Android\Sdk
```

For layout changes, inspect screenshots under `e2e-artifacts`.

## Common Failure Modes

- Fixing Android behavior by forking core logic in Kotlin.
- Adding a language by modifying English arrays.
- Letting dynamic suggestions change while a row is locked.
- Treating hidden debug text as proof of visible UI.
- Adding more styling complexity instead of simplifying the scan target.
- Forgetting that tests may disable audio feedback for determinism.
