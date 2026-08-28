# AI Agent Guide

This project is easy to damage by mixing AAC design, UI rendering, and Android tooling into one debugging loop. Follow these rules when modifying it.

## Start With The Core

Business logic belongs in `packages/aac-core` first:

- scanner transitions
- suggestions
- board layout data
- message editing
- undo behavior
- config migration
- timing policy calculations

Add or update core tests before changing a platform UI. If the behavior cannot be expressed as a core test, explain why in the commit or handoff.

## Language/Profile Work

Do not add a new language by editing English defaults in place. Language support must be profile-based.

Before adding `zh-TW`, graphical symbols, or another language:

1. Read `docs/MULTILINGUAL_DESIGN.md`.
2. Preserve current `en-US` behavior with tests.
3. Add or modify profile-specific files.
4. Add isolation tests proving profiles do not share mutable layout or dictionary arrays.
5. Add message-composition tests for spacing/no-spacing behavior.

Shared core may own scanning, board validation, history, input latency compensation, and profile loading. Profile code owns symbols, dictionary, suggestion ranking, tokenizer, auto-spacing/no-spacing, speech locale, and layout defaults.

Never implement Mandarin by adding Chinese words to `DefaultSuggestionDictionary`. Never implement graphical symbols by only adding emoji-like text labels to the English board.

## Do Not Trust Hidden Debug Output

For UI claims, verify the rendered UI. A log line, broadcast receiver, hidden semantics value, or test-only state dump is not enough to prove that the user can see or activate the result.

Acceptable checks:

- core state assertions for core rules
- browser/desktop E2E assertions against visible elements
- screenshots when layout is involved
- packaged app smoke tests that verify visible text or clearly visible state

## Preserve Single-Switch Semantics

The main board should expose one communication action: activate the current scan target. Do not add direct tile tapping as a hidden shortcut and then use it to pass tests. Configuration controls can use normal touch because they are intended for helpers.

## Preserve Stability

- The suggestion row stays in the same position.
- Phrase and Zhuyin suggestions share the same neutral candidate style. `replaceLength`
  is composition metadata only and must never create an active, selected, or scan-progress
  appearance. Only the current scan cell may use active-cell styling.
- Suggestion cells should prefer relevant fallback targets over dead empty cells when the row is active; never fill typed-buffer suggestions with unrelated words.
- Static board rows do not shift when suggestions change.
- A row selected for column scanning is locked until the scan returns to row mode.
- Switching language/profile must not mutate another profile's layout, dictionary, timing, or composition rules.

## Error Recovery Is Part Of Throughput

Optimizing input speed is not only about fewer scan steps. It also means reducing costly mistakes:

- activation during `RowSelected` cancels the locked row
- `UNDO` appears when history exists
- trailing spaces are visible
- word selections add a trailing space automatically
- scanning restarts at the suggestion row after input by default
- latency compensation is limited to symbols in the same selected row
- progress hints are full-height fills inside the active target; do not add extra latency bars unless user testing clearly calls for them
- auditory scan and activation feedback are useful access features, but tests may disable them for determinism

When candidate styling changes, exercise both a completed phrase and an unfinished
Zhuyin buffer. The regression must assert that their inactive candidate tiles have the
same rendered background, border, shadow, and outline, rather than inferring appearance
from scanner state alone.

## Testing Order

Use this order unless the user explicitly asks for a platform-only task:

```powershell
npm run test:core
.\e2e-web.bat
.\build-test.bat -SdkDir E:\Android\Sdk
```

Add browser or packaged-app E2E tests as those shells are introduced. Avoid spending time in Android emulator debugging before the core and desktop UI tests are green.

For language/profile work, also include targeted tests for:

- `en-US` auto-space remains unchanged
- `zh-TW` has no automatic spaces
- profile selector loads the selected profile
- profile customizations are scoped per profile
