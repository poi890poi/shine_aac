# Approved UI review decisions — 9 September 2026

Classification: approved layout and navigation changes, with regression coverage.
The user approved the first tablet-panel proposal, designated Bird Garden as an
Easter egg, and excluded landscape support on small panels. Other visual review
items remain discussion points; no game artwork or composition change is approved.

- Expanded AAC layout retains the 32/68 supporting-pane/board allocation. Give
  the draft a minimum 180 px area, readable recent spoken messages, and bottom
  anchored helpers. A panel without history must also anchor its helpers correctly.
  Locked conversation keeps its existing large message and three-action row.
- Bird Garden must not appear in the main board, status area, normal configuration
  action list, or AAC scan targets. Open it by seven activations of the existing
  version entry in Settings → Data and support → About. No rapid-tapping deadline
  or persistent unlock preference. Navigating back out of About resets the count.
  Exit returns to AAC.
- Android compact screens below 600 dp smallest width remain portrait-only under
  the existing MainActivity policy. Forced compact-landscape browser captures are
  unsupported diagnostics, not release blockers. Tablet landscape remains supported.

Risks: history text can be squeezed by flex sizing; missing history can leave
helpers in the wrong grid row; hidden entry can accidentally reset AAC content or
be exposed in ordinary controls. Browser source/packaged regressions must cover
the actual entry, six taps without launch, reset on leaving About, seven taps to
launch, default ammo/columns, and preserved communication content on exit.
Native packaging and physical entry require the standard device gate before a
device-tested claim. The MinIME task's phone reservation was respected; this change
was tested on the tablet Preview app.

The portrait flower/horizon proportions and smooth helper-button styling are
optional aesthetic choices pending further review. The replay-lock layout shift
and optical rig's incorrect row target are tracked independently. Their failures
must not be silently waived as a consequence of this approval.

## Implemented result and verification

- [Updated tablet layout](reviews/2026-09-09/approved-tablet-layout.png) and
  [updated phone layout](reviews/2026-09-09/approved-phone-layout.png) use synthetic
  messages. Downloads were published and verified byte-for-byte.
- Supported tablet/window and conversation regressions pass, including fully
  readable history and bottom anchored helpers with no history.
- Source and packaged garden integration pass: hidden entry, six-tap negative
  control, About counter reset, seven-tap launch, random species, AAC columns,
  default ammo, input routing and preserved communication state.
- 49 web unit tests and 13 Android app unit tests pass. Android tests include the
  compact/tablet orientation boundary. Preview debug build succeeds.
- `device-test.bat --garden` passes on tablet `org.shineaac.app.preview` using
  real version-row taps, physical touch start/drop, six flower columns, ammo 3→2,
  fullscreen rendering and Back to the preserved board/draft. Its saved
  `camera-long-blink` input preference was preserved. This run does not claim
  physical hardware or camera activation coverage. Internal evidence:
  `.tmp/tablet-adaptation/garden-R9JT201YLJF-1788931299414`.
- The gate now chooses hardware input only when the saved profile enables it;
  otherwise it reports physical touch coverage. Earlier attempts incorrectly sent
  a hardware key under camera-only settings. Failure evidence is preserved, and
  cleanup now polls the display transition before requiring OFF.
- The replay-lock geometry regression still fails after removing the garden
  button. It remains open for separate review. Full acceptance/release readiness
  is not claimed. No new optical gate was run for these layout/entry changes.

The tablet Preview was installed; the Play-signed tablet app was preserved. The
test display was verified OFF after use. Game sprite/scenery/physics code is
unchanged by this approval.
