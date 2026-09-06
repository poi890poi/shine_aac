# Text-free flyby and comic recovery — 2026-09-06

Type: user-requested interface and behavior change. Scope: standalone mini-game;
no Android integration, communication-state or detector changes.

The user requested implementation and video, then clarified no droplet button,
closer Super Blitz behavior, funny upward recovery on contact with a flower, and
enough lift for two or three further flybys. Three is the chosen default.

## Decisions

- Remove visible text and the action button. Keep direct playfield/switch input,
  accessible icon controls, invisible screen-reader status, and an optional
  icon-only helper panel outside the garden.
- One drop per flyby. The ready/spent marker follows the bird and is not a button.
  Misses and successful hits spend the same allowance; no queued activation.
- Keep descent every pass. This supersedes the earlier proposed no-hit height
  hold, following the user's clarification to keep the Super Blitz rhythm.
- On contact, recoil briefly, flutter wings, show comic stars and wobble petals;
  then climb in place. Preserve every flower height, current pass, projectile and
  drop allowance. The default lift includes three descent steps, bird clearance,
  and a 0.025 normalized margin above the tallest remaining flower.
- Remove the former collision restart and escalating guided-stop behavior.
  The recovery itself provides the extra chances without extra user actions.

## Risks and checks

Longer rounds follow from the single-drop rule; flower hit counts are unchanged.
Extra activations, pause, collision and pass boundaries must not refill or queue
an allowance. Tests exercise actual reducer transitions after projectile resolution.
Three subsequent clear passes are simulated at 30/60/120 Hz. Existing all-column
completion tests allow longer real-time rounds, without skipping input/physics.

The phone UI check inspects rendered text nodes in ready, paused, settings and
exited states, asserts no action button, checks accessible icon labels, taps the
playfield, and verifies that a subsequent switch activation cannot drop again.
It always turns the display off and verifies OFF in a finally block.

Reference checked: [Super Blitz, C64](https://www.lemon64.com/game/super-blitz)
and [game description](https://www.mobygames.com/game/37806/super-blitz/).
The fixed-screen one-input flight rhythm informs the interaction. Its destructive
crash outcome is deliberately replaced by the user-requested comic lift.

## Results

- 34 mini-game tests passed, including actual three-pass clearance at 30/60/120 Hz.
- Physical Samsung SM-G781B Chrome UI checks passed, with no visible game text,
  no action button, accessible icon labels, one touch drop, ignored extra host
  activation, retained spent state across pause, and switch replay after exit.
- The final phone recording used browser touch events on the physical device.
  It did not overwrite game state or physics. Ordinary no-input descent produced
  the first collision on pass 6; the bird rose from y=0.515 to y=0.212. Subsequent
  passes 7, 8 and 9 had no collision. A second collision occurred on pass 13.
  Twelve hits cleared the garden and reached landing at approximately 129 seconds.
- Capture is direct H.264 at 540×1200. Delivery crops browser chrome, retaining
  the game and icon controls. The short demo joins three real-time excerpts;
  the full-round video preserves the complete timeline. Recording is silent.
- The capture and phone-check scripts turn the display off in finally blocks;
  both successful runs verified `mScreenState=OFF`. An earlier take obscured by
  a browser share sheet was discarded. The generic menu key was replaced with
  explicit keyguard dismissal to prevent that automation error.

Evidence: `tmp/textfree-20260906/phone-check.json`, `recording.json`, original
capture and delivered clips. These are phone-browser checks, not an Android
package release or physical detector acceptance.
