# SHINE AAC Web App

This is the first Windows-friendly SHINE AAC app shell. It runs in a normal browser and imports the platform-independent core directly from `packages/aac-core`.

## Run

```powershell
.\run-web.bat
```

Open:

```text
http://127.0.0.1:5173/apps/web/
```

Use mouse click, touch, `Space`, or `Enter` as the single switch input. Configuration is available from the top panel and is stored in browser `localStorage`.

Composed message text is saved locally as bounded text history. In the zh-TW profile, the configuration panel labels this action `匯出文字記錄`. The browser downloads a UTF-8 plain-text transcript and offers `查看匯出內容` for immediate confirmation. Android uses the system Save As picker, reports the actual saved filename, and offers `開啟文字檔` for the exact document. If local history grows too large, the app removes the oldest saved entries first.

## Test

```powershell
.\e2e-web.bat
```

The E2E runner launches Microsoft Edge with a clean temporary profile, drives the rendered UI through DevTools, and writes `docs/WEB_E2E_REPORT.md`.

## Boundary

The web app owns rendering, browser speech, keyboard/mouse/touch input, local storage, and the scan timer. It does not own AAC rules. Scanner behavior, suggestions, message editing, undo, and board data come from `@shine-aac/core`.
