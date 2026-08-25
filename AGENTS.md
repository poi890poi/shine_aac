# Workspace handoff rules

- A local filesystem path is not a user-downloadable artifact in a remote Codex session.
- When the user asks to download an APK, AAB, document, image, or other generated file, publish it through a client-accessible attachment or HTTPS URL and verify that delivery endpoint before responding.
- Local workspace links may be provided only when explicitly labeled as internal paths, never as the primary download.

* Android physical-device changes must run `device-test.bat` before being called
  device-tested. Camera-switch/detector/calibration/activation changes must also run
  `optical-rig-test.bat` when the monitor rig is available. Never infer a physical PASS
  solely from source review, unit tests, or emulator behavior.

* Required optical/release gates must use only publicly licensed stimuli declared in
  `testdata/optical-rig/sources.json` with a source page, author, license, and checksum.
  Never discover or replay user uploads, private captures, or
  `testdata/optical-rig/local/` from an automated or release test.

* Cheek-camera framing targets a face at about 70% of preview height. Full-frame faces
  are invalid test geometry; app and rig evidence must show the whole face with margin.

* Do not report Windows as locked from a failed screenshot/GDI probe. Distinguish the
  `Default` input desktop, a secure desktop such as `Winlogon`, and presenter-window
  automation failures; only the secure-desktop evidence supports a lock inference.
  Run `optical-rig-test.bat` with visible interactive-desktop/GUI permission, never in
  a sandboxed process desktop. A presenter acknowledgement proves rendering in that
  process; the camera-decoded atlas is the proof that the physical monitor showed it.

* Treat user-requested behavior as a release invariant: record it in repository policy
  and an executable regression test before declaring the fix durable. Before merging a
  release candidate, audit non-ancestor fix branches, reflogs, stashes, and locked
  worktree artifacts for fixes not represented by an equivalent test on the candidate.

* A release is not complete until its annotated `vX.Y.Z` tag is pushed and the remote
  peeled tag target is verified to equal the intended release commit.
