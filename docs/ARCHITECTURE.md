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
- Transition escape after row selection is optional. The MVP default is `0 ms`, which skips that state because it was confusing in real use; a positive value can re-enable it for users who need the extra cancel window.
- Early symbol activations can be latency-compensated to the previous symbol inside the same row. Row activations are not remapped to previous rows.
- The progress hint belongs near the active row or symbol, because that is where the user's gaze already is.
- The message display must make trailing spaces visible with a cursor.
- Throughput matters, but explainability matters too. Frequency-ordered letters and high-value whole words reduce scan time while remaining understandable to helpers.
- Configuration is caregiver/developer territory. Runtime communication should stay simple and predictable for the AAC user.

## MVP Notes

The early demonstration MVP should stay simple and robust:

- Offline suggestion backend first. The current backend is a small dictionary plus prefix completion and simple transition ranking. It should remain swappable, but the app must work without network access.
- Prioritize high-impact throughput improvements: high-value whole words, frequency-ordered letters, cheap `UNDO`, visible spaces, and stable suggestions.
- Avoid adding complex behaviors until they can be verified in `packages/aac-core` without Android.
- A one-column row can be useful for extremely common symbols, but the default board should not spend limited space on low-value singleton rows.

## Portability Rule

If a rule could be tested without a screen, operating system, or hardware device, it belongs in `packages/aac-core`. Platform code may call it, but should not quietly fork it.
