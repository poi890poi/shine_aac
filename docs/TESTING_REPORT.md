# SHINE AAC Testing Report

Generated: 2026-07-03

## Summary

The platform-independent AAC core now has deterministic tests for scanner behavior, board/suggestion behavior, and realistic one-switch human input sequences. These tests run on Windows without Android SDK, emulator, APK install, or device connection.

Latest command:

```powershell
npm run test:core
```

Latest result:

```text
40 tests passed
0 tests failed
```

## Covered Areas

### Scanner Mechanics

- row scanning wraps correctly
- row selection enters transition pause
- transition pause advances to first cell
- activation during transition pause cancels the locked row
- first cell can be selected
- later cells scan and wrap inside the selected row
- empty rows are skipped
- early row activation is not remapped to a previous row
- early symbol activation compensates to the previous symbol in the same selected row

### Board And Suggestions

- default board contains A-Z
- default spelling order starts with high-frequency English letters
- old built-in layouts migrate to current defaults
- custom current-version layouts are preserved
- custom symbols/actions parse correctly
- board rows chunk by configured column count
- default suggestion dictionary is built from broad ranked vocabulary lists
- partial words suggest completions such as `wa` -> `WANT`, `WATER`, `WATCH`
- expanded vocabulary suggests `MOVIE` for `movi`
- exact current word is not suggested again
- after `I` and `YOU`, action words rank higher
- after `WANT` and `NEED`, need/noun words rank higher
- suggestion row keeps a stable width with useful `SPC` or high-frequency-letter fallback targets instead of dead empty cells
- `UNDO` and `SPC` can appear without changing row width
- expanded vocabulary suggests `DRINK` after `I want `
- the default board no longer spends a row on a single `?`
- old built-in suggestion dictionaries migrate, custom dictionaries remain

### Human-Like Input Sequences

- enter `I want water ` through one-switch row/column transitions
- word selections automatically add trailing spaces, while letter selections do not
- use `SPC` without creating duplicate spaces
- use `DEL`, `SPC`, `CLR`, and repeated `UNDO` to repair text
- type `movi`, select `MOVIE`, and get `movie ` rather than `movi movie`
- accidentally choose `DRINK`, use `UNDO`, then choose `FOOD`
- accidentally activate a row, cancel during transition pause, and keep the message unchanged
- activate very early on a symbol and select the previous symbol by latency compensation
- verify locked suggestion rows do not change while column scanning is in progress

### Browser UI E2E

- launches the Windows/browser app in Microsoft Edge with a clean temporary profile
- verifies the board and message panel render
- drives visible row/column scanning through browser input events
- enters `I want water `
- uses `UNDO` to repair `WATER`, then selects `FOOD`
- uses `CLR`
- types `movi`, completes it to `movie `, then uses `DEL`
- verifies a Pixel 4a 5G-sized viewport fits without scrolling
- writes `docs/WEB_E2E_REPORT.md`
- writes `e2e-artifacts/web-e2e-final.png`

### Android APK E2E

- builds and installs the packaged debug APK
- enables a WebView test bridge through app-private preferences
- drives the app with real ADB touch taps, not direct state mutation
- synchronizes on fresh render-state logs before each row and cell tap
- enters `I want water ` through the packaged scanner
- captures `e2e-artifacts/real-touch-final.png`

## Important Design Assertions

- The core does not depend on Android, Compose, browser APIs, React, Capacitor, or Flutter.
- Tests drive `pressSwitch()` and `advanceSession()` for human-like sequences instead of directly mutating message text.
- Suggestions that complete a partial token replace that token.
- Static board positions remain stable while dynamic suggestions update.
- A selected suggestion row is locked until selection completes or is cancelled.
- The default transition pause is `0 ms`, so the row-selected escape state is skipped unless a helper enables it.
- Browser and packaged-app E2E disable audio feedback in test settings for deterministic automation; the app default remains audio-on.
- Hidden debug output is not accepted as proof of rendered UI behavior.

## Remaining Gaps

- Android/iOS packaged smoke tests should be rewritten after the web/Capacitor shell exists.
- Timing comfort still needs human UX testing on real devices.
- Text-to-speech behavior is not covered by the core because it belongs to platform shells.
- Persistence migration needs platform-shell tests once storage adapters are introduced.

## How To Review Remotely

Open this report and the core test files:

- `docs/TESTING_REPORT.md`
- `packages/aac-core/test/scanner.test.js`
- `packages/aac-core/test/board.test.js`
- `packages/aac-core/test/session.test.js`
- `packages/aac-core/test/human-sequences.test.js`

The fastest local verification command is:

```powershell
npm run test:core
```
