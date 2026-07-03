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
- Empty suggestion cells remain as placeholders.
- Static board rows do not shift when suggestions change.
- A row selected for column scanning is locked until the scan returns to row mode.

## Error Recovery Is Part Of Throughput

Optimizing input speed is not only about fewer scan steps. It also means reducing costly mistakes:

- activation during `RowSelected` cancels the locked row
- `UNDO` appears when history exists
- trailing spaces are visible
- latency compensation is limited to symbols in the same selected row

## Testing Order

Use this order unless the user explicitly asks for a platform-only task:

```powershell
npm run test:core
.\build-test.bat -SdkDir E:\Android\Sdk
```

Add browser or packaged-app E2E tests as those shells are introduced. Avoid spending time in Android emulator debugging before the core and desktop UI tests are green.
