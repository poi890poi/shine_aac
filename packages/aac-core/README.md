# SHINE AAC Core

`@shine-aac/core` is the platform-independent business logic for SHINE AAC.

It has no Android, browser, React, Compose, Capacitor, or Flutter dependency. The core is plain ES modules plus Node's built-in test runner so it can be verified quickly on Windows before any platform shell is involved.

## Owns

- board configuration defaults
- symbol and dictionary parsing/serialization
- suggestion row generation
- message editing, undo, delete, space, clear, and speak effects
- automatic trailing spaces for word selections
- ranked offline suggestion vocabulary lists
- one-switch row/column scanner state transitions
- optional row-to-symbol cancel pause
- first-cell hold
- input latency compensation within a selected row
- locked dynamic row behavior during column scanning

## Does Not Own

- rendering
- touch, keyboard, switch, camera, or audio input capture
- text-to-speech implementation
- persistence storage APIs
- Android/iOS/web packaging
- screenshots or UI automation

Platform apps should adapt these boundaries instead of reimplementing AAC rules inside the UI layer.

## Source tree

```text
src/index.js       Stable package facade
src/core/          AAC implementation
src/data/          Generated, source-pinned language data
test/              Deterministic behavior and benchmark tests
```

Consumers import `@shine-aac/core`; they do not import `src/core/engine.js` directly.

## Verify

```powershell
npm --prefix packages/aac-core test
```

or from the repository root:

```powershell
npm run test:core
```
