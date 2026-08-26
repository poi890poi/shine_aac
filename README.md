# SHINE AAC

SHINE AAC is an offline-first augmentative and alternative communication app for people who may have only one reliable movement. It combines switch scanning, English and Taiwan Mandarin communication boards, speech, hardware switches, and camera-based long-blink or cheek-twitch input.

## Start here

- Users and helpers: [Traditional Chinese operation guide](docs/index.html)
- Developers: [Documentation map](docs/README.md)
- Architecture: [System boundaries](docs/ARCHITECTURE.md)
- Accessibility principles: [Project constitution](docs/PROJECT_CONSTITUTION.md)
- Release work: [Release process](docs/RELEASE_PROCESS.md)

## Repository map

```text
packages/aac-core/  Deterministic AAC board, language, scanner, and session rules
optical-core/       Pure blink/cheek calibration and gesture state machines
apps/web/           Browser UI shared by desktop and Android WebView
android-inputs/     CameraX, Camera2, UVC, MediaPipe, and ML Kit integration
app/                Thin Android shell: WebView, speech, settings, and packaging
blinktest/          Standalone diagnostic application using production dependencies
scripts/            Build, analysis, browser, device, and optical-rig automation
testdata/           Licensed manifests and deterministic test fixtures
docs/               User guides, architecture, policies, reports, and release history
```

Dependency direction:

```text
app ──> android-inputs ──> optical-core
 │
 └── packages the web app ──> packages/aac-core
```

Platform code may capture input and render results. Deterministic communication and gesture rules belong in the corresponding core module.

## Fast verification

```powershell
npm run test:quick
.\gradlew.bat :optical-core:test :android-inputs:testDebugUnitTest :app:testDebugUnitTest
```

For rendered-browser, Android-device, camera, and release gates, follow [docs/README.md](docs/README.md#verification).

## Run the browser app

```powershell
.\run-web.bat
```

Open `http://127.0.0.1:5173/apps/web/` and use touch, a mouse click, `Space`, or `Enter` as the single switch action.

SHINE AAC is licensed under the terms in [LICENSE](LICENSE).
