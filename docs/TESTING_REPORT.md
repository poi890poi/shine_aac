# SHINE AAC Testing Report

Generated: 2026-07-04

## Summary

The platform-independent AAC core now has deterministic tests for scanner behavior, board/suggestion behavior, and realistic one-switch human input sequences. These tests run on Windows without Android SDK, emulator, APK install, or device connection.

Latest command:

```powershell
npm --prefix packages/aac-core test
```

Latest result:

```text
69 tests passed
0 tests failed
```

## Covered Areas

### Scanner Mechanics

- row scanning wraps correctly
- row selection enters transition pause
- transition pause advances to first cell
- activation during transition pause cancels the locked row
- default session scanning skips transition pause and moves directly to the first cell
- positive transition pause remains available when explicitly configured
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
- category and Zhuyin group actions serialize and parse correctly for editable layouts
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
- old built-in `zh-TW` layouts migrate to the current direct-Zhuyin first layer
- custom `zh-TW` board layouts are preserved during migration
- old built-in `zh-TW` dictionaries migrate from long first-person phrases to short AAC labels
- English remains the default language profile and keeps word auto-spacing
- `zh-TW` has an independent direct-Zhuyin board and dictionary
- `zh-TW` appends selected words and phrases without automatic spaces
- `zh-TW` exposes direct Zhuyin symbols, `更多`, and essential controls while omitting low-information punctuation from the default board
- `zh-TW` function labels render and persist in Chinese, including `復原` and `更多`
- old `zh-TW` MVP boards with English `MORE` migrate to the localized `更多` function label
- `zh-TW` uses three suggestion rows for ranked glyph/phrase candidates instead of second-layer or third-layer Zhuyin pages
- `zh-TW` candidate suggestions can replace the trailing typed Zhuyin buffer in one undoable action
- `zh-TW` suggestion rows offer valid following Zhuyin symbols, such as `ㄚ` after `ㄅ`
- standalone finals that have no dictionary-backed first-symbol entries are not exposed as first-layer dead-end symbols
- `zh-TW` initial-only Zhuyin such as `ㄅ` surfaces matching ranked phrases such as `不要` and `幫忙`
- `zh-TW` phrase-initial Zhuyin shortcuts such as `ㄅㄧ` surface useful phrases such as `不要`
- sparse Zhuyin buffers such as `ㄧㄡ` backfill useful suggestions such as `有`, `又`, and `有沒有`
- dictionary-backed sparse Zhuyin buffers fill the available 4x3 suggestion area with generic ranked backfill instead of empty cells
- `zh-TW` Zhuyin voice feedback uses Mandarin-readable names such as `玻` and `烏` instead of raw Bopomofo symbols
- `zh-TW` static Zhuyin symbols all have exact dictionary-backed suggestions
- every full `zh-TW` dictionary key is discoverable through suggestion pages
- every `zh-TW` dictionary key is progressively navigable through visible symbols and bounded suggestion pages
- `更多` preserves the current phonetic buffer instead of resetting to default suggestions
- unsupported standalone finals do not show unrelated replacement backfill
- `更多` advances only the `zh-TW` suggestion rows and leaves the static board unchanged
- `zh-TW` dictionary entries include Zhuyin keys and frequency metadata
- language profile defaults do not share mutable arrays

### Human-Like Input Sequences

- enter `I want water ` through one-switch row/column transitions
- word selections automatically add trailing spaces, while letter selections do not
- use `SPC` without creating duplicate spaces
- use `DEL`, `SPC`, `CLR`, and repeated `UNDO` to repair text
- type `movi`, select `MOVIE`, and get `movie ` rather than `movi movie`
- accidentally choose `DRINK`, use `UNDO`, then choose `FOOD`
- with transition pause explicitly configured, accidentally activate a row, cancel during transition pause, and keep the message unchanged
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
- seeds an old stored `zh-TW` layout and verifies it migrates to direct Zhuyin symbols
- verifies reset restores the packaged `zh-TW` defaults and persists direct Zhuyin symbols instead of stale user layout text
- verifies rendered `zh-TW` labels such as `ㄅ`, `ㄓ`, `ㄧ`, `更多`, and replacement suggestions fit without clipping
- verifies the dynamic `zh-TW` undo suggestion renders as `復原` instead of `UNDO`
- verifies `ㄅㄧ` can be replaced by the suggestion `不要`
- writes `docs/WEB_E2E_REPORT.md`
- writes `e2e-artifacts/web-e2e-final.png`

### Android APK E2E

- builds and installs the packaged debug APK
- enables a WebView test bridge through app-private preferences
- drives the app with Android hardware key events, not direct state mutation
- verifies the phone-button input adapter path with `keyevent 24`
- synchronizes on fresh render-state logs before each row and cell activation
- enters `I want water ` through the packaged scanner
- launches the packaged APK with `zh-TW` e2e preferences and verifies rendered WebView state includes dictionary-backed first-layer Zhuyin symbols such as `ㄅ`, `ㄧ`, `ㄩ`, plus `更多`
- captures `e2e-artifacts/hardware-button-final.png`

## Important Design Assertions

- The core does not depend on Android, Compose, browser APIs, React, Capacitor, or Flutter.
- Tests drive `pressSwitch()` and `advanceSession()` for human-like sequences instead of directly mutating message text.
- Suggestions that complete a partial token replace that token.
- Static board positions remain stable while dynamic suggestions update.
- A selected suggestion row is locked until selection completes or is cancelled.
- The default transition pause is `0 ms`, so row selection moves directly to the first cell; the first cell gets a longer hold to avoid a rushed first column.
- Browser and packaged-app E2E disable audio feedback in test settings for deterministic automation; the app default remains audio-on.
- Hidden debug output is not accepted as proof of rendered UI behavior.

## Remaining Gaps

- Android/iOS packaged smoke tests should be rewritten after the web/Capacitor shell exists.
- Timing comfort still needs human UX testing on real devices.
- Text-to-speech behavior is not covered by the core because it belongs to platform shells.
- Platform-shell persistence now has a `zh-TW` render smoke test, but broader custom-board migration cases still need more device coverage.

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
