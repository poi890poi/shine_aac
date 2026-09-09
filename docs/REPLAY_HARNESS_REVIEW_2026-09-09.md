# Replay harness correction and visual proposals

Type: test-tooling bug fix, plus review-only design artifacts. No application
styles, game assets, detector thresholds or saved user settings are changed.

## Evidence and invariant

The earlier optical run `optical-20260909-091016` retained thirteen rendered
rows during replay while scanning only three actions on the board. The harness
waited for a row that could never become active. It must discover the requested
command by meaning, wait for a fresh reachable speech-lock action, and present
one optical activation without a redundant row selection. Ordinary row/cell
selection retains its existing path. Target timeouts without a presented gesture
must be reported as unavailable targets, not missed optical activations.

Startup must also accept restored locked messages and release a review hold only
when one is present. An unconditional startup activation could execute an action.

The action alias table covers the existing English/Chinese Edit, Speak and Clear
copy. New translated command labels require extending that table. The app's
reported action guides test timing; the resulting message remains an independent
outcome check. No input is injected to substitute for physical camera gestures.

## Verification and preserved failures

- 126 Python tests pass, including replay with thirteen rendered rows, unreachable
  actions, stale state, wrong phase/surface/action, target-only timeouts and
  restored-lock startup. These are harness tests, not physical acceptance.
- Full optical run `optical-20260909-142240` passed atlas geometry and upright
  presenter rotation (87.29 degrees CCW), then failed native long-blink calibration
  quality. Full optical acceptance remains failed; cheek/stress gates did not run.
- Focused run `optical-20260909-142843` reused the identity-checked prior session
  fixture and exposed the startup row assumption. It stopped before the demo.
- Focused retry `optical-20260909-143115` accepted startup and completed several
  physical blink selections, then failed because the message was empty at the
  first speech step. Its logs, gesture timeline and media are preserved for
  diagnosis. It does not establish successful replay selection or a complete
  normal-use session. No detector-failure cause is inferred from this result.
- Both phone and tablet displays were verified `mScreenState=OFF` after cleanup.

## Proposals awaiting image review

- [Replay comparison](reviews/2026-09-09/replay-layout-review.png): reserve two
  status lines using the current font's line height. In this 393 × 851 synthetic
  fixture the current board moves from y=139.6875 to 146.6875; the proposed board
  stays at 146.6875. This is a seven-pixel movement in this fixture, distinct from
  the earlier eighteen-pixel E2E transition. Larger fonts and other languages
  still require validation before implementation; this is not a universal fit
  guarantee. No text is truncated.
- [Portrait composition](reviews/2026-09-09/portrait-composition-review.png):
  enlarge the existing mountain image 1.45× while retaining its base behind the
  bushes. This raises the summit and crops more of the sides. The deterministic
  six-column scene preserves flower heads, curved stems, leaves, clouds, bird and
  gameplay coordinates. Helper controls remain unchanged in the application.
- [Mountain credits](reviews/2026-09-09/artwork-attribution.txt) apply to the
  scenery comparison. These are static renderer/browser previews, not APK changes.

`scripts/replay-composition-review.mjs` reproduces the comparisons using isolated
browser overrides and asserts that the current fixture moves while the proposed
one stays still. Review images must precede any corresponding app visual edits.
