# SHINE AAC Windows/Browser App Report

Generated: 2026-07-03

## Status

A first Windows-friendly browser app shell exists at `apps/web`.

It is not an Electron/MSIX packaged desktop app yet. It is a local browser app served by a tiny Node server, which is the fastest reliable path for design testing on Windows before Android/iOS packaging.

## Run

```powershell
.\run-web.bat
```

Open:

```text
http://127.0.0.1:5173/apps/web/
```

Input:

- click anywhere in the main app
- touch anywhere in the main app
- press `Space`
- press `Enter`

These all trigger the same single switch action.

## Implemented

- visible message panel with blinking cursor
- row/column scanning board
- progress fill on the active row or symbol
- latency compensation hint on active symbol cells
- suggestion row
- locked suggestion row during column scanning
- `UNDO`, `SPC`, `DEL`, `CLR`, `SAY`
- browser speech output through Web Speech API
- helper configuration panel
- local browser persistence with `localStorage`
- direct use of `packages/aac-core` for scanner, suggestions, board data, and message editing

## Automatic Verification

Passed:

```powershell
node --check apps\web\server.mjs
node --check apps\web\src\app.js
node --check scripts\e2e-web.mjs
npm run test:core
.\e2e-web.bat
.\gradlew.bat testDebugUnitTest
```

Browser E2E command:

```powershell
.\e2e-web.bat
```

Latest browser E2E result:

```text
PASS
```

The E2E launches Microsoft Edge with a clean temporary profile, drives the visible web UI through DevTools, selects targets by the rendered active row/cell, and writes:

- `docs/WEB_E2E_REPORT.md`
- `e2e-artifacts/web-e2e-final.png`

Served files were also checked through HTTP:

```text
http://127.0.0.1:5173/apps/web/                  200
http://127.0.0.1:5173/apps/web/src/app.js        200
http://127.0.0.1:5173/packages/aac-core/src/index.js 200
```

## Not Yet Verified

- The in-app browser connector failed before attaching in this environment.
- Manual UX testing is still needed for scan timing comfort, visual layout, and real switch rhythm.

## Next Testing Step

Use the web app manually on Windows and focus on:

- Can you enter `I want water`?
- Is the first column still rushed?
- Is the progress hint easy to follow?
- Is `UNDO` reachable and predictable?
- Does `SPC` make trailing spaces clear?
- Does configuration feel safe for a helper?

After that, add Playwright or another dependable browser automation path for visible-UI E2E tests.
