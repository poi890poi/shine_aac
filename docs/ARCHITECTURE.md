# SHINE AAC Architecture

## Direction

SHINE AAC should be developed as a reusable AAC product, not as an Android-only experiment. The business logic lives in a platform-independent core. Platform shells render the current state, collect input events, speak text, persist configuration, and package the app for a device.

Preferred near-term direction:

1. Keep `packages/aac-core` as the source of truth for AAC logic.
2. Build and verify a Windows/browser UI against that core.
3. Package the browser UI for Android and future iOS with a thin native wrapper such as Capacitor.
4. Keep Android device testing as a smoke test for packaging and input delivery, not as the primary place to debug scanning rules.

## Boundary

```text
AAC core
  scanner state machine
  suggestion generation
  message editing
  board layout model
  config migration
  deterministic tests

Platform shell
  rendering
  switch/touch/keyboard/camera input adapters
  timer scheduling
  text-to-speech
  persistence
  install/package/device smoke tests
```

The core exposes pure functions. Given the same state and event, it returns the same next state. That makes it easy to test independently and reuse from different UI frameworks.

## Verification Pyramid

1. Core unit tests: fast, deterministic, no device, no browser, no Android SDK.
2. Desktop UI E2E tests: verify the actual visible message and scanning cursor in a browser.
3. Packaged app smoke tests: verify Android/iOS launch, input delivery, persistence, and speech integration.
4. Human UX tests: focus on timing comfort, gaze-following progress hints, error recovery, and vocabulary usefulness.

Hidden debug channels must not be treated as proof of user-visible behavior. Automated tests should assert the same rendered state a user sees whenever the test claims to verify UI behavior.

## Design Principles

- One reliable action is enough. The main board must work with a single binary input.
- Direct touch on a tile is not the communication model; touch is only one possible way to trigger the single switch event.
- Mistakes must be cheap. A selected row can be cancelled when a transition pause is enabled, and `UNDO` repairs the previous message state with one selection.
- Dynamic suggestions must not move the static board. The suggestion row remains fixed and should prefer useful fallback targets such as `SPC` or high-frequency letters over blank cells.
- Dynamic suggestions must not change while a selected row is being scanned. The selected row is locked until the cell choice is complete or cancelled.
- Transition escape after row selection is enabled by default. The default timing favors slower, lower-fatigue switch access: a nonzero transition pause gives an escape window after row selection, and the first cell receives a longer hold because it is otherwise easy to overshoot.
- Early symbol activations can be latency-compensated to the previous symbol inside the same row. Row activations are not remapped to previous rows.
- The progress hint belongs near the active row or symbol, because that is where the user's gaze already is.
- The message display must make trailing spaces visible with a cursor.
- Throughput matters, but explainability matters too. Frequency-ordered letters and high-value whole words reduce scan time while remaining understandable to helpers.
- Word selections auto-add a trailing space. Letter selections do not. This reduces routine `SPC` selections while preserving spelling.
- After a successful input, the UI should restart scanning at the top by default so updated suggestions are reachable immediately. Keep this configurable because some users may prefer local row repetition for spelling.
- Auditory feedback is part of access. Platform shells may speak the current scan target and the activated target, with a way for helpers to disable it for users who find it distracting.
- Configuration is caregiver/developer territory. Runtime communication should stay simple and predictable for the AAC user.

## MVP Notes

The early demonstration MVP should stay simple and robust:

- Offline suggestion backend first. The current backend combines AAC core vocabulary, common English service words, starter fringe words, prefix completion, and simple transition ranking. It should remain swappable, but the app must work without network access.
- Prioritize high-impact throughput improvements: high-value whole words, frequency-ordered letters, cheap `UNDO`, visible spaces, and stable suggestions.
- Avoid adding complex behaviors until they can be verified in `packages/aac-core` without Android.
- A one-column row can be useful for extremely common symbols, but the default board should not spend limited space on low-value singleton rows.
- Input source is a platform adapter. The core should receive intent events such as `activate`, `next`, `previous`, or `pause`; camera, voice, keyboard, switch, and OS accessibility details belong in platform code.
- Language is a profile, not a translation table. Each language or symbol set can own its own board, timing defaults, tokenizer, message composition rules, suggestion provider, and speech locale.

## Profile Isolation

Language and symbol-set profiles are allowed to differ deeply. `en-US`, `zh-TW`, and `symbols-basic` may have different rows, columns, scan speed, first-cell hold, spacing rules, dictionaries, and speech locales.

Rules:

- Shared core may load profiles, validate profile data, and run the scanner.
- Profiles own their default symbols, dictionaries, suggestion ranking, tokenizer, and message composition.
- Profile data must be immutable or copied before customization.
- Caregiver customizations must be stored per profile.
- Switching profiles must never silently overwrite another profile's custom layout.
- A profile can reuse shared helpers, but must not import another profile's mutable defaults.

The safest implementation path is to extract the current English behavior into an `en-US` profile first, then add `zh-TW` as a separate profile. This makes the English regression tests the guardrail while Mandarin is developed.

## Portability Rule

If a rule could be tested without a screen, operating system, or hardware device, it belongs in `packages/aac-core`. Platform code may call it, but should not quietly fork it.
