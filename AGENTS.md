# Workspace handoff rules

- A local filesystem path is not a user-downloadable artifact in a remote Codex session.
- When the user asks to download an APK, AAB, document, image, or other generated file, publish it through a client-accessible attachment or HTTPS URL and verify that delivery endpoint before responding.
- Local workspace links may be provided only when explicitly labeled as internal paths, never as the primary download.
