# Ammo and collision feedback — 2026-09-06

Follow-up design adjustment: remove the opaque ammo panel so the scene remains
visible between icons and inside empty charges. Keep a dark one-pixel contour
around each charge and the refill bar for contrast against sky and clouds.
Scope is HUD paint only; budget, timing, controls and character art are unchanged.
Verification targets untouched background pixels, readable contours and distinct
empty/partial/full fills, followed by rebuilding the package.

Type: intentional behavior/design change and optional gameplay feature.
Scope: standalone browser game; core budget, renderer, helper settings, host physics
configuration. No Android integration, storage migration, release or app publication.

Previously readiness followed the bird's head and every flyby allowed one drop.
Now readiness occupies a fixed upper corner. Classic flyby mode remains the default;
optional recharge mode starts with three charges and restores one every six seconds.
The next empty icon fills gradually; full and empty icons differ by fill, not color
alone. No numbers, countdown text or action button. Select the mode between rounds,
not automatically during progression, so the switch's meaning stays predictable.

## Reference comparison and decision

- Blizzard's [Tracer in Heroes of the Storm](https://heroes-site-production-eks-prod-use1-01.heroesofthestorm.blizzard.com/en-gb/heroes/tracer/)
  stores up to three Blink charges. This supports a small, countable reserve; our
  six-second recharge tuning is a design choice, not a claim about that game's timing.
- Bungie's [Destiny 2 update 9.5.0](https://www.bungie.net/7/en/News/Article/destiny_update_9_5_0)
  describes ability feedback in the lower-left HUD. We adapt the fixed-corner
  placement to the upper-left, away from this game's flowers. We copy no artwork.

| Mode | Benefit | Tradeoff |
| --- | --- | --- |
| One per flyby (default) | Predictable single-switch timing; no resource counting | A miss must wait for another flyby |
| Three charges / six-second refill | Stored retries on the same flyby; idle time restores opportunity | An additional resource to watch; initial burst clears flowers faster |

The default pass plus entry is about 6.7 seconds. One charge per six active seconds
keeps sustained supply near that cadence while adding a three-charge buffer. These
are starting values for user review, not a validated accessibility optimum.

## Invariants and failure paths

Only an accepted drop spends budget. One projectile at a time in either mode; extra
activations never queue. Classic refills only at the next flyby. Recharge is serial,
capped, preserves partial progress on spending, and does not bank time at capacity.
Pause freezes it; reset starts full; collisions and flybys grant no bonus charge.
Normal active time during recovery still advances recharge. Landing/exit stop it.
Host configuration sets mode, capacity, interval and HUD side; helper changes do not
alter an active round. Flower columns, recovery clearance and landing are preserved.

Collision emits one bounded feather burst from the bird's body, not continuous
shedding each frame. Four small blue/white pixel feather effects flutter and fall
for 2.4 seconds, with a fixed contour and shared native pixel grid. The approved bird
and flower sheets/crops are unchanged. Pause freezes the effect, reset clears it,
reduced motion hides it. Effect templates are cosmetic candidates for visual review;
unit tests do not establish artwork approval.

## Verification results

- 48 Node tests pass. Both modes complete through real drop physics and land at
  30/60/120 Hz. Added budget boundary, interruption/reset, no bonus refill,
  feather spawn/lifetime and fixed HUD raster checks. Landing timer freeze was
  additionally checked after the initial full suite (14 feature tests pass).
- Packaged build succeeds. Physical Samsung SM-G781B browser checks pass for
  default flyby spending, mode selection between rounds, touch and host switch
  input, three accepted charges, rejection when empty, serial recharge, paused
  timer, replay preserving mode, no visible game text/action button and no overflow.
- Actual phone recording uses normal timing and no state overrides. Charge refills
  occurred at 7.965, 13.980 and 19.973 recording seconds; ordinary descent caused
  collision on pass six at 39.331 seconds. Four feathers were visible near the
  collision point while the original bird climbed away. This is an assistant
  visual review of the cosmetic effect, not new user approval of artwork.
- Evidence: `tmp/ammo-feathers-20260906/phone-check.json`, `phone.mp4`, `feathers.png`,
  `empty.png` and `demo.mp4`. Short clip trims waiting time and browser chrome only.
  The phone display was slept in `finally` and verified `mScreenState=OFF`.
- Browser-only acceptance; no Android APK/integration or release gate is claimed.
