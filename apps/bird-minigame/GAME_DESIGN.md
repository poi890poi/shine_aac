# Taiwan Bird Garden — game design specification

Status: gameplay prototype demonstrated; latest procedural bird and flower art
rejected by the user. Shape-consistency methods require correction; see
`research/SHAPE_CONSISTENCY_AUDIT.md`.
Last updated: 2026-09-05.

This is the source of truth for the standalone bird mini-game and its later SHINE
AAC integration. Read it before changing gameplay, art, input, or rewards. Tests
must protect its requirements. A plausible implementation is not evidence that
it matches the design.

## Intent and MVP scope

An original, friendly game inspired by the Commodore 64 **Super Blitz** timing
loop. A bird flies automatically across a fixed garden. The player chooses when
to release a white liquid dropping. Hits shorten flowers, making room for the
bird to descend and land safely.

The current MVP is a standalone browser app using **one Taiwan Blue Magpie**.
It must be reusable through a small host API for later SHINE AAC integration.
It is not the communication board or Guided Practice. It does not train flapping
or require repeated activations to keep the bird airborne.

No hosted app publication is required. Test the local game on the connected phone.
Capture short H.264 MP4 demonstrations directly; do not create MJPEG recordings.

## Agreed game rules

1. The garden occupies one **fixed screen**, including in portrait. Neither the
   camera nor the flower field scrolls. Flower count matches the active AAC
   `columns` value (3–8). Portrait adapts the whole scene scale and spacing;
   it must never silently reduce the flower count.
2. Flower columns have fixed, equal horizontal spacing and one common ground
   line. Heights differ. Flowers stay in their original columns throughout a round.
3. The bird crosses automatically from left to right. Each completed pass brings
   it lower; after a short transition it returns from the left. Player input never
   controls altitude, flap velocity, steering, or horizontal flight speed.
4. One activation releases one **white, liquid bird dropping**. It falls toward
   the flowers beneath the release point. There is at most one active dropping.
   Additional activations must not produce a projectile queue or rapid-fire burst.
5. A hit lowers the struck flower. Its head moves down and its continuous stem
   becomes shorter. Hit counts are internal state, never visible bamboo joints,
   stacked blocks, or detachable stem segments.
6. A hit produces a white splash and a brief exaggerated **衰洨臉**: asymmetrical
   eyes, a crooked/resigned mouth, or drooping petals. It is comic misfortune,
   without injured/dead faces, bruising, or distress imagery.
7. Misses do not cost lives or reset flowers. The remaining targets are available
   on a later pass.
8. A bird must still collide with a flower that remains too tall for its current
   flight path. It cannot pass through a blocking flower simply because lives are
   absent. Use a soft recovery; every successful shortening remains intact.
9. The objective is **safe landing**, optionally followed by automatically picking
   up a small item such as a twig or worm. A gate count or arbitrary score target
   is not the completion condition. No second timed action is required to finish.
10. The game remains playable with one switch. Touching the playfield, the action
    button, Space, Enter, and the host activation event perform the same action.

## Baseline tuning and recovery

These numbers are implementation defaults, not immutable user requirements.
Change them deliberately, retaining the rules above, and record material changes.

| Parameter | MVP baseline | Purpose |
| --- | --- | --- |
| Flower columns | AAC configuration, 3–8; standalone fallback 4 | One flower per AAC column |
| Pass duration | 6 seconds | Standard timing; allow helper-selected 8/6/4 seconds |
| Entry warning | 0.7 seconds | Predictable restart from the left |
| Active droppings | 1 | Clear cause and effect |
| Hit reaction | Approximately 0.8 seconds | Readable comic feedback |
| Flower reduction | Several hits, depending on height | Preserve height progression |
| Inactivity exit | 90 seconds | Return control if the activity is abandoned |

Standard collision recovery cancels the pass, identifies the blocking flower,
briefly recoils the bird, and restarts at the previous safe altitude. It does not
undo any hit. The bird body/head core collides; long tail feathers and raised
wings are visual only. A flower's central upper area blocks; petal edges should
not make near misses unfair.

Repeated collisions on the same flower should make the next attempt easier:
slower passage after repeated difficulty, then a guided retry that waits in a
safe dropping position for one activation. Assistance never shortens a flower
without a hit. The exact collision animation and assistance thresholds may be
tuned; no lives, game-over loop, or lost flower progress may be introduced.

The MVP clears every configured flower to ground level before the automatic final
landing. An optional pickup animation is a later cosmetic addition, not a separate
challenge or prerequisite for finishing the MVP.

## Art, motion, and sound

- The ground is a green grass meadow, including after landing: uneven blade tips
  and scattered tufts across its depth. No runway strip, lane markings, evenly
  spaced horizontal dashes, or exposed road surface. This is a user requirement.
- `rules/pixel-style.json` defines the shared native pixel grid, outline thickness,
  light direction, color ramps, cluster density, trial component dimensions, and animation
  cadence. All objects are authored directly on the same grid. Display uses whole
  physical pixels and a uniform scale, never independently stretched axes.
- The bird, flowers, clouds, and grass must share contour/detail density. Reducing
  resolution or color depth is not an art style. Do not resample detailed bitmap
  sprites, stretch stems, smooth-rotate pixels, or apply a final palette filter.
- C64-era cartoonish, low-resolution pixel art with hard pixel edges and a limited
  palette. No smooth gradients, modern glow, or glossy obstacle graphics.
- A light sky keeps the dark/blue bird visible. White droplets/clouds need an
  outline so they remain visible against the sky.
- Flower stems are continuous and organic. Flower heads can overlap at denser
  future settings; their horizontal centres still keep equal spacing.
- Use the existing blue-magpie sprite and flower-expression sheet as identity and
  expression references. Preserve their designed contours using the workflow in
  `rules/ARTWORK_STANDARD.md`; the rejected primitive renderer is not a shape authority.
  A neutral flower needs an unsplashed face; hit expressions appear only after hits.
- Follow `rules/species-proportions.json`, `rules/cartoon-style.json`,
  `rules/flight-rigs.json`, and `rules/feather-dynamics.json`. Long feathers curve
  naturally downward while retaining their specified length. Do not regenerate
  unrelated artwork as a substitute for obeying those parameters.
- Clouds move slowly behind the action and never affect collisions. Reduced
  motion stops decorative cloud motion and suppresses unnecessary recoil/shaking.
- Cute, brief effects accompany release, impact, recovery, and landing. Provide
  mute; sound never carries essential information alone. No continuous music is
  needed. Later integration must stop effects for AAC speech and on exit.

## Reusable module and lifecycle

`src/game-core.js` owns deterministic rules and state without DOM or Android
dependencies. The renderer displays that state; it must not decide hits, shorten
flowers, or award completion independently. `src/embed.js` owns the host boundary.

The controller supplies start, activate, pause, resume, reset, exit, state read,
and destroy operations. Host events expose release, hit, clear, pass, collision,
landing, completion, and exit. Touch/keyboard and `shine-aac:activate` must invoke
the same controller action. Consuming an entry activation must not also drop.

Pause freezes gameplay and projectiles. Helper exit remains reachable. Leaving
the page or backgrounding exits the activity. Inactivity must continue to be
handled while paused. Teardown removes listeners and cancels animation/audio.
The standalone demo stores no user data and never touches AAC state.

## Later integration and later content

These are agreed product directions, not work to silently add to the one-bird MVP:

- Helper opens the easter egg by tapping About seven times. Entry consumes the
  seventh tap. Helper exit or inactivity timeout returns to communication.
- Preserve the exact previous AAC screen/configuration/draft. Stop or isolate AAC
  scanning, speech, and timers while the game owns input; restore safely on return.
  Game input is never communication usage and cannot unlock AAC functionality.
- Choose from Taiwan-endemic birds when entering a future multi-bird version,
  weighted by encounter rarity. The present MVP always uses the Blue Magpie.
- Additional bird-specific pickups and more expressive rescue animations can
  follow after the mechanic and one-bird presentation are verified.

## Explicitly rejected mechanics

- Flappy Bird-style gravity and flap-to-rise input.
- Moving wind gates, pipes, or a five-gate win condition.
- Scrolling flower fields or a camera that follows the bird.
- Bamboo/segmented stems or visible stacked hit blocks.
- Brown solid cartoon poop in place of white liquid bird droppings.
- Bombs, buildings, life counters, or collisions that erase flower progress.
- Automatic speed increases that make the round harder without helper choice.

## Acceptance evidence

Before calling a gameplay correction complete, verify:

- No input: automatic horizontal passes and descent, with flower x positions fixed.
- One input: one dropping, no change to flight path, no projectile queue.
- Hit/miss: only the struck flower shortens; white impact and expression are visible;
  a miss preserves every flower.
- Too-tall flower: body collision and soft recovery, with all prior hits retained.
- Repeated difficulty: guided retry remains possible through the same one action.
- Complete garden: automatic landing and completion, with no additional timing task.
- Pause/resume, inactivity, helper exit, background, and destroy work independently
  of the communication app.
- Equivalent timing at 30/60/120 Hz; portrait keeps all flowers and the action
  control visible, without scrolling the playfield.
- Regression tests exercise the real core/controller boundary. Screenshots and a
  short direct-H.264 phone recording show flowers, a released dropping, impact,
  and height reduction. Label simulated and physical evidence separately.

Android integration changes require the repository's `device-test.bat` gate;
camera-related changes also require the applicable optical gate. Browser-only
phone demonstrations do not establish Android release acceptance.

## Decision provenance and drift diagnosis

The core agreement was made on 2026-09-03 in session
`01a051f2-8009-7513-9491-b08174f5cf50`: Super Blitz inspiration, white liquid
droppings, continuous stems, fixed spacing, no scrolling, forgiving collisions,
landing goal, and flower hit faces. Session
`01a069cb-59e0-7340-8349-49c8f3abadfd` refined bird proportions/curvature and then
requested the standalone, reusable, one-bird MVP.

The first implementation incorrectly introduced gravity, flapping, wind gates,
and a gate-count goal. Its tests validated those invented mechanics. The flower
concept asset existed but was not connected to the game. This was implementation
drift, not a user-requested redesign. Recovering the earlier requirements and
testing them directly is the correction.

## Verification record — 2026-09-05

| Check | Evidence |
| --- | --- |
| Automated regressions | 14 tests passed through `npm test` in this module |
| Simulation timing | Full drop-to-landing flow passed at 30, 60, and 120 Hz |
| Character rules | Validator passed for all 16 reference species; MVP uses one |
| Production package | `npm run build` completed |
| Phone browser | Samsung SM-G781B, serial RFCR91GWXLX, Chrome; local packaged files over USB |
| Portrait/input checks | Flower field and action button fit; browser touch, Space, host event, pause/resume, helper exit passed |
| Complete phone round | ADB taps on the visible action button produced 12 hits, cleared all four flowers, and reached landing/completion in approximately 28 seconds |
| Recording | 36-second direct H.264 MP4, approximately 2.5 MB; no MJPEG intermediate |

The phone playback used automated button taps informed by observed game state;
it did not rewrite flower heights, physics, score, or completion. It demonstrates
the browser implementation on a physical phone, not usability with an AAC user
or Android release acceptance. Sound effects are implemented but the screen
recording is silent. Bird pickup, additional species selection, and integration
into the SHINE AAC About screen remain outside this MVP.
