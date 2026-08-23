# Workspace handoff rules

- A local filesystem path is not a user-downloadable artifact in a remote Codex session.
- When the user asks to download an APK, AAB, document, image, or other generated file, publish it through a client-accessible attachment or HTTPS URL and verify that delivery endpoint before responding.
- Local workspace links may be provided only when explicitly labeled as internal paths, never as the primary download.

* Android physical-device changes must run `device-test.bat` before being called
  device-tested. Camera-switch/detector/calibration/activation changes must also run
  `optical-rig-test.bat` when the monitor rig is available. Never infer a physical PASS
  solely from source review, unit tests, or emulator behavior.
