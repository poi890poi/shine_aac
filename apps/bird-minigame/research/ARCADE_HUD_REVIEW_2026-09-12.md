# Single-row arcade HUD review

Status: A approved by the user's subsequent “Ok go,” and implemented in
`src/game-ui.js`. The original review preceded app changes. Its frozen proposal
painter remains independent of the live painter for comparison.

## References and interpretation

- [1942, arcade screenshot](https://www.honestgamers.com/12515/arcade/1942/review.html):
  compact HUD typography and repeated reserve symbols separated from action.
  [Capcom's current release](https://store.steampowered.com/app/1556702/Capcom_Arcade_Stadium1942/)
  identifies the preserved game; no artwork is extracted for SHINE.
- [Gradius, official Arcade Archives screenshots](https://www.arcadearchives.com/en/title/aca-020/):
  deliberate pixel lettering and a stable power-up strip, with a small highlight
  identifying status. Reference is the 1985 arcade title, not an unlabeled NES port.
- [Moon Patrol, museum record](https://www.arcade-museum.com/Videogame/moon-patrol):
  separate indicator lights communicate conditions. This is a reference for
  distinct signal states, not a reason to reproduce its multiple HUD regions.
- [Twin Bee, original Konami flyer](https://flyers.arcade-museum.com/videogames/show/4909):
  secondary visual reference for the colorful arcade setting.

The design takeaway is compact, consistently drawn symbols with restrained
highlighting. These references do not establish that all 1980s games used one
row, nor did their cabinet controls require on-screen touch buttons. SHINE's
one-row layout and accessible touch targets are a deliberate adaptation to the
user's requirements. Do not copy score text, lives, brands or original sprites.

## Proposals

A, recommended: floating sprite symbols, one-pixel contours and a restrained
cream/gold ramp shared by controls and highlighted status. No rounded app-button
plates or solid HUD panel. Ammo retains its final 21×26 native silhouette; only
spacing becomes compact. Refill appears inside the next drop, avoiding a second
status row. The camera lens communicates status and a compact adjacent gauge
shows relative signal. Three chevrons retain the three-speed meaning.

B: identical one-row layout with stepped pixel tiles around the three controls.
This gives a stronger button affordance but occupies more of the sky visually.

Both proposals keep Settings, Pause and Exit in the row. The implementation
retains transparent semantic buttons, keyboard/focus behavior and at least 48
CSS-pixel hit areas, while painting their visible art into the shared framebuffer.
Exceptionally narrow windows move Exit into the helper menu to preserve target
size and status clearance. Start/Replay use larger native masks; helper icons
share the same palette and outlines. POC bird choices use flat stepped cards so
the birds do not blend into the flowers behind them. SHINE keeps random selection.

No status text, score, flashing decoration, gameplay/speed changes, detector
changes, flower movement, sprite resampling or background redesign is included.
The AAC board's previously approved two-line replay status is unrelated and stays
unchanged: this request applies to the game's HUD.

## Evidence

Run `node apps/bird-minigame/scripts/review-arcade-hud.mjs` from the repository
root with the installed Playwright package configured by SHINE_PLAYWRIGHT_ROOT.
It renders 1280×800 and 360×800 views through the real virtual framebuffer. The
entire live scene matches the frozen approved A painter pixel for pixel. The
alternative B differs only inside the HUD region. These are scope checks, not
independent proof of low-vision usability.

Original pre-approval images remain under `tmp/arcade-hud-review/`; the new
comparison writes separately to `tmp/arcade-hud-implementation/`. Functional
screenshots and results are in `tmp/game-ui/` (all paths relative to this game).

## Implementation impact and verification

This is an approved presentation change: smooth DOM icons and the separate
camera/speed row become native sprites in one row. No saved-data or host API
migration is required. Gameplay, detection, scenery and AAC replay layout retain
their established behavior. The main risks are hit-target/art misalignment,
invisible controls intercepting play, lost keyboard access and resize lifecycle.

The browser gate exercises six viewport/density combinations, every POC page,
helper controls, Start, drop, pause/resume, keyboard input, Exit and hidden-window
restoration. It checks target bounds/overlap, minimum size and actual physical
pixel blocks. The controller completes three real simulated landing rounds and
uses the semantic Start/Replay control to advance through all three speed levels.

A renderer regression initially exposed a zero-size callback after its container
was removed. The native viewport rejects zero dimensions, so the renderer now
defers that resize until the container is visible. The formerly failing gate
passes with exact GPU/Canvas parity, resize and context restoration. Its new
`--functional-only` option excludes timing benchmarks from functional checks.

The integrated Android gate checks actual tablet touch controls and AAC return;
see `docs/GARDEN_TRAINING_0_5_0.md` at the repository root for installed APK identity
and final delivery status. No optical accuracy or sustained-performance claim is
made by these UI checks.
