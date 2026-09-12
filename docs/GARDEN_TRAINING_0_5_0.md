# Version 0.5.0: garden training and feedback

Classification: user-requested behavior and presentation changes, plus version
metadata. Version is 0.5.0, code 63. This is a build version, not a published release.

About keeps the seven-tap hidden entry in native Settings and the browser. Each
tap before entry shows the number remaining in the current language. There is no
rapid-tapping deadline or permanent unlock. Leaving About resets the countdown.

Three native-pixel chevrons show slow, medium or fast. A new garden visit starts
slow (60% of the allowed maximum); medium is 80%, fast is 100%. Successful landing
advances the next round one level. Hits, misses and ordinary passes do not speed
up a round. Collision recovery decreases one level, at most once per flyby, with
the slow level as floor. Flowers and ammo progress are preserved. Helpers can
choose one of the three levels between rounds, without exceeding the timing cap.

The first 8% of the field is additional left approach space. The remaining width
is divided into the configured 3–8 equal flower cells. The rightmost centre retains
only a normal half-cell margin, not a second approach buffer. At maximum speed,
centre-to-centre travel takes at least scanIntervalMs and visible x=0 to the first
centre takes at least firstCellPauseMs. All lower levels give more time. These are
movement timings, not a claim that continuous targeting is identical to discrete
AAC scanning or that every user's gesture will succeed. Long configured timing
also extends the inactivity allowance to cover two slow passes.

The game receives only columns, the two timing values and a small camera-status
record. It never receives frames, calibration models, drafts or history. A native
pixel camera icon and adjacent gauge distinguish live, waiting and unavailable
states. The gauge shows score relative to the configured activation threshold, not a
probability or a second classifier. Stale/unavailable states clear their fill;
hardware-only input hides the icon. Accessible names describe state and speed;
the game retains zero visible text and no extra activation control.

Art source bytes, stems, native pixel size, cloud composition, drop/landing rules,
camera inference, gesture thresholds, CPU default and saved AAC preferences are
unchanged. Main risks are input-status becoming stale, lost scan timing at the
iframe boundary, unintended within-round acceleration, and spacing/contact drift.
Behavioral regressions cover these boundaries; simulated status is not optical
verification. No benchmark or stress run is part of this change.

## Tablet landscape work remaining

The original item 1 is implemented: current-window layout, 68% board / 32%
supporting pane, readable draft/recent messages, bottom helpers, locked conversation
controls, adaptive Settings, retained Camera Setup and accessible helper targets.
The later two-line replay-status correction is also implemented. Small-panel
landscape remains excluded; the garden remains an Easter egg.

Remaining recorded design scope:

1. SHINE Workspace and third-party app control: still a separate, unimplemented
   design task. The repository has not specified a complete approved interaction
   or window layout for it; do not invent one as part of this garden change.

The optional game helper-button styling is now implemented following approval of
proposal A: one borderless native-pixel HUD row, matching Start/Replay and helper
icons, and accessible semantic touch targets.

Separate verification work remains: meaningful complete AAC sessions, sustained
normal-use latency/thermal measurements, and broader theme/font/window/visual
checks. These are validation gaps, not unfinished landscape layout features.
Guided Practice is a separate pre-implementation specification, not a completed
tablet feature or an implicit part of this request.

Sources: [tablet policy](TABLET_ADAPTATION.md),
[tablet implementation record](TABLET_GARDEN_VERIFICATION_2026-09-08.md),
[approved UI decisions](UI_REVIEW_DECISIONS_2026-09-09.md),
[two-line status correction](TWO_LINE_STATUS_AND_CLOUD_REVIEW_2026-09-09.md).

## Verification and delivery status

- 96 game regressions pass, including real drop-to-landing flows at 30/60/120 Hz.
- The browser controller completes three full simulated rounds at levels 0, 1,
  and 2, then verifies the cap, collision decrease and paused recovery. Inputs
  follow observed flower positions; no flower state is rewritten. This is
  functional simulation, not a real-user or sustained-performance benchmark.
- Source and packaged browser integration pass countdown/reset, host timing,
  live-to-stale indicator, input exclusivity and preserved AAC state on return.
- Android Preview build and app unit tests pass. Packaged metadata is 0.5.0-preview
  (63), CPU, with profiling, full diagnostics and input timing disabled.
- Landscape and portrait previews match approved A pixel for pixel. Six browser
  viewport/density combinations pass target alignment, native physical pixels,
  POC selection, helper/control interactions and hidden-window restoration.
- GPU/Canvas parity, resize, context restoration and Canvas fallback pass the
  focused native renderer gate with benchmarking explicitly disabled.
- The tablet functional integration gate passed actual touch Start/drop,
  pause/helper/sound/resume, fullscreen native pixel alignment and preserved AAC
  return. The final rebuild adds the diagnosed hidden-container resize guard;
  its installation verification is recorded below. Optical and sustained-use
  performance gates are outside this UI change. No commit or publication yet.

Internal evidence: `.tmp/garden-v050/`. Reproduce controller checks with
`node scripts/garden-training-test.mjs`, integration with
`node scripts/garden-integration-test.mjs`, and module regressions with
`npm --prefix apps/bird-minigame test` using a Node version supporting test globs.

### Final tablet installation, September 12

0.5.0-preview (63) is installed on R9JT201YLJF. SHA-256 of the built APK and the
APK pulled back from the tablet both equal
`95daf1d401477cde16d8c65973e6568ec2509e66cf636da3e6f9194fbb89bf24`.
The exact final APK passes `device-test.bat --garden`: native seven-tap entry,
physical touch Start/drop, pause/helper/sound/resume, fullscreen display, and
preserved AAC board, draft and input preference on return. The saved camera-long-
blink profile was retained; this gate exercised touch, not optical gestures.

Mali-G52 WebGL rendered a 640×400 native frame at 3× into 1920×1200, with zero
pixel-grid violations in ready and running states. Rotation preferences were
restored, display OFF was verified under the device lease, and the tablet window
was explicitly released. A repeat installation gate was necessary after the
hidden-container resize fix; neither run enabled renderer timing benchmarks.

Internal evidence: `.tmp/tablet-adaptation/garden-R9JT201YLJF-1789174742530/`.
Internal APK: `.tmp/garden-v050/shine-aac-0.5.0-arcade-preview.apk`.
These are workspace evidence paths, not public download URLs. The change remains
uncommitted and unpublished.
