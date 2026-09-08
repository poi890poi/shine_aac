# Tablet adaptation and integrated garden verification — September 8, 2026

The approved standalone game was committed and pushed first as `e5d1fbf`.
Item 1 of the earlier tablet plan was then implemented in separate commits:

| Change | Commit |
| --- | --- |
| Current-window responsive layout | `713ad31` |
| 68% board, multiline supporting pane, recent spoken messages | `7906bfa` |
| Locked conversation with three bottom controls | `c4b8549` |
| Adaptive Settings categories/detail and retained selection | `016849e` |
| Accessible helpers and predictable keyboard activation | `7c47cd5` |
| Retained Camera Setup and consistent preview/overlay geometry | `9177b10` |

Supporting commits update behavioral tests (`e2a03d9`), add an isolated tablet
Preview build (`b1ac8d7`), and correct the two-pane Settings test selector and
failure cleanup (`7de9d0f`). No third-party app workspace was implemented.

## Integrated behavior and boundaries

The Bird garden helper opens the existing approved module inside SHINE AAC.
Flower columns follow AAC configuration; bird species are random per round.
Three ammo charges and the approved scenery, artwork, sounds and game physics
are reused. Only the column count crosses into the game; drafts, dictionary and
conversation history stay in AAC. Scanning suspends during play. Back or app
backgrounding destroys the game document and returns to the preserved scan target
on hold. The next activation resumes communication.

Native packaging serves game modules and artwork from intercepted local HTTPS
asset requests while retaining AAC's existing file origin and stored data.
The full-screen host removes camera-cutout padding during play and restores AAC
system-bar clearance on exit. Browser messages require the expected frame and a
per-session token. Camera and hardware activations use one host routing path.

Primary classification: feature, with tablet design changes and supporting tests.
Main risks: lost scan/draft state, duplicate activation, retained animation/audio,
viewport clipping, and camera geometry regressions. There is no stored preference
schema migration, AAC core scanner change or detector threshold change.

## Automated checks

- 79 mini-game and 49 web unit tests passed (128 combined).
- 205 focused AAC core tests passed, including scanner, session and history.
- 48 android-inputs unit tests and app native unit tests passed.
- Architecture boundary check and Markdown links passed.
- Tablet browser matrix passed: wide landscape, wide portrait, narrow and short
  windows, preserved board geometry/state, helper targets and keyboard behavior.
- Locked-conversation browser E2E passed.
- Source and Android-packaged garden browser checks both passed: six columns,
  random mode, hardware/camera event routing, one drop from a burst, ammo 3→2,
  pause/resume, rejection of forged messages, Back/background exit and preserved
  draft, undo and scan target.

## Physical evidence

The phone runs `org.shineaac.app`. The tablet's existing app is Play-signed, so
the same runtime was installed alongside it as `org.shineaac.app.preview`
(SHINE AAC Preview), preserving the original app and its data.

| Check | Phone | Tablet Preview |
| --- | --- | --- |
| Ordinary device gate | 28 PASS, no findings | 28 PASS, no findings |
| Native Settings audit | 19 PASS | 19 PASS after fixing an ambiguous test selector |
| Settings recreation instrumentation | PASS | PASS |
| Retained Camera Setup/TextureView rotation instrumentation | — | PASS |
| Integrated garden physical hardware start/drop and AAC return | PASS | PASS |
| Integrated game physical canvas | 1080 × 2400 | 1920 × 1200 |
| Configured flower columns | 4 | 6 |

General gate evidence is local under `test-results/device-20260908-230649`
(phone) and `test-results/device-20260908-231148` (tablet). Native audit evidence:
`test-results/native-config-20260908-231059` and
`test-results/native-config-20260908-232712`.

Final integration evidence is local under
`.tmp/tablet-adaptation/garden-RFCR91GWXLX-1788882500903` and
`.tmp/tablet-adaptation/garden-R9JT201YLJF-1788882524365`.
Each test compares the pulled installed APK against the input APK, captures the
physical game screen, exercises native hardware start/drop and Back, and checks
the unchanged AAC board and draft without writing their content into the report.
Both device displays were verified OFF after the final tests.

Tested APK SHA-256:

- Phone: `b0395c48598c48533d49bc0d1a949236480439a554cadfe7468a8e4400d9f36d`
- Tablet Preview: `c354ab7c2fa3374a6a358269b69defd269870045867cfd82b083b612ea9508aa`

## Outstanding optical gate

`optical-rig-test.bat --geometry-only --no-build --no-install --presenter-mode
android --dut-serial RFCR91GWXLX --presenter-serial R9JT201YLJF` did not pass.
Evidence: `test-results/optical-20260908-223248/FINDINGS.md` and
`camera-cycle.json`. Atlas discovery timed out; captures decoded only zero or one
verified tags and showed a cropped tablet edge in the phone preview. The physical
camera/tablet alignment must be corrected before rerunning geometry, calibration
and optical activation. Only declared public rig stimuli were used.

No physical camera-activation PASS or completed release is claimed. Source and
browser event-routing tests do not replace this gate. The implementation is
committed for review, with optical acceptance still outstanding.
