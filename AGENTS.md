# Workspace handoff rules

- Coordinate shared Android devices across active tasks: request a window, receive
  acknowledgement, perform testing and cleanup, then explicitly release ownership.
  An idle thread is not a release. Before any ADB operation, use
  `Invoke-AndroidDeviceLease` from `scripts/with-android-device-lease.ps1` for every
  serial in the session; hold it through settings restoration and display-OFF
  verification. The shared Windows mutex is `Local\Codex.Android.<serial>`.
  Contention must stop before device commands. These are advisory locks, so all
  cooperating tasks must use the same contract; they do not prevent manual ADB.

- After physical-device testing or media capture, turn off displays that the agent
  woke or used for testing, including on failure or interruption. Verify the device
  display state before handoff. Do not leave test displays awake between runs or
  change the user's persistent display settings; preserve an explicit request to
  leave a display on for their immediate use.

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

- Optical activation evidence must survive Android log rotation: retain uniquely
  identified observed events across reads; never infer a missed gesture by
  subtracting totals from independently rotating log buffers. Cover rollover,
  overlapping reads, missing identity, zero inputs, and duplicate inputs in tests.
