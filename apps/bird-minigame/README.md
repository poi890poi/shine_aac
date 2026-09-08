# Bird Mini-Game

Read [Game design specification](GAME_DESIGN.md) first. It records the agreed Super
Blitz-inspired flower mechanic, rejected alternatives, lifecycle, and acceptance
checks.

This module owns the Taiwan endemic-bird mini-game POC, character rules,
research notes, and generated pilots. It is deliberately
self-contained under `apps/bird-minigame`; it does not change the AAC web app or
Android packaging unless an explicit integration change is made later.

## MVP

The completed standalone POC includes 16 Taiwanese bird species, with the Taiwan
Blue Magpie (`Urocissa caerulea`) selected initially. It is a
fixed-screen, single-action garden game: the bird crosses automatically and
descends each pass. Activate to release a white liquid dropping. Equally
spaced flowers shorten on impact, react with comic faces, and make room for safe
landing. Collisions preserve flower progress. Pointer input, Space, Enter, and
`shine-aac:activate` all perform the same drop action.

The demo page imports the reusable host boundary from `src/embed.js`:

```js
import { mountBirdGame } from "./src/embed.js";

const game = mountBirdGame(document.querySelector("#game-slot"), {
  getAacConfig: () => session.config, // active AAC columns, re-read on start/reset
  speciesSelection: 'random', // SHINE host samples once for each new round
  physics: { passSeconds: 6, dropMode: 'recharge' },
  inputTarget: document,
  onEvent(event) {
    // start, drop, hit, cleared, pass, collision, landing, won, pause, resume, reset, exit
  }
});

game.activate(); // Start if ready; otherwise drop once. Entry does not also drop.
game.pause();
game.resume();
game.reset();
game.exit();
game.destroy();
```

The default `'recharge'` mode starts with three charges. Explicit
`dropMode: 'flyby'` keeps one drop per pass. Recharge uses a stored reserve
with `ammoCapacity: 3`, `refillSeconds: 6` and `ammoSide: 'left'` (or `'right'`).
Capacity accepts 1–5 and interval accepts positive seconds. Both modes retain one
active dropping, ignore extra input without queuing, and show a fixed corner HUD.
The helper panel has an icon-only mode selector between rounds. Standalone
`?dropMode=recharge` starts with the reserve mode selected. The chosen mode survives
replay/reset in the mounted game; there is no persistent storage or automatic mode
switch during progression. See [comparison and invariants](research/AMMO_FEATHERS_UPDATE.md).

Collision feather effects use the fixed native-pixel template and motion parameters
in `src/game-feedback.js`; their shared lifetime is `COLLISION_FEATHER_SECONDS` in
the core. Character source sheets and their crop/pivot records are unchanged.

Production flower tuning lives in `rules/sprite-layout.json` under `flower.variants`:
named petal ramps, fixed uniform `headScale`, `curvePixels`, `stemHalfWidth`,
`stemRamp`, `leafSize` and `leafLevels`.
Presets repeat by AAC column: coral, lavender, buttercup and sky. `leafScale` and
`leafAnchorX` control shared leaf size/attachment. Palette preparation preserves
alpha and the approved face/petal contours; no new sprite sheet is required.
Cloud silhouettes live in `rules/pixel-style.json` under `cloud.shapes`, with
independent lobe arrangements and width/height multipliers.

`src/game-core.js` contains deterministic normalized-coordinate physics with no
DOM dependency. `src/bird-renderer.js` presents the common native pixel surface.
`src/pixel-art.js` draws clouds and grass with `rules/pixel-style.json`; its older
procedural bird/flower functions remain historical test fixtures. Production and
the art-lab atlas use approved sprite contours through `src/sprite-assets.js`.
`src/embed.js` is the only API a SHINE AAC host needs. It owns no persistence or AAC
state. An `onExit(reason)` callback lets the host restore its own surface. Audio is
scoped to the controller, can be muted, and is stopped on pause/exit/destroy.

Pass `aacConfig: session.config` for a snapshot, or `getAacConfig` for a live host
getter. Counts 3–8 map to one flower per column. The count is fixed during a round
and refreshed on start/reset, so an external settings change does not erase hits
mid-round. Invalid counts fail explicitly. Standalone `?columns=6` previews six
columns; absent configuration uses AAC's default of four. This does not install
the game inside the AAC app or read AAC storage from an unrelated browser origin.

## Shared art specification and tuning

Read [pixel-art references](research/pixel-art-references.md) and
[the parameter guide](rules/PIXEL_STYLE.md). Open `art-lab.html` on the existing
local preview server to compare all objects at the same pixel size, change the
shared styling, preview AAC column counts, and export a complete JSON specification.
Copy a chosen export to `rules/pixel-style.json`, increment `ruleVersion`, then run
the tests/build and review the native-size comparison sheet and a phone round.
`game.setPixelStyle(specification)` applies a validated style live after
`await game.ready`, without changing game state. `pixelStyle` can also be supplied
at mount time. It is an entire specification, not a shallow partial override.

The original bitmap sources remain visual references. Their per-object resampling
options (`spriteUrl`, `flowerUrl`, `neutralFlowerUrl`) are retired from the native
renderer. The global specification is included in generated art prompts, so later
artist edits and generated candidates use the same standard. Passing automated
checks is not a substitute for reviewing the actual art.

The initial wind-gate prototype was an implementation error. Its `targetScore`,
`FLAP`, `flap`, and `over` semantics are retired; the design specification and regression
tests now protect the agreed garden mechanic.

## Workflow

1. Record species identity and normalized component ratios in
   `rules/species-proportions.json`.
2. Apply the shared exaggeration policy from `rules/cartoon-style.json`.
3. Choose a documented mechanism from `rules/flight-rigs.json`.
4. Apply species feather-flex parameters from `rules/feather-dynamics.json`;
   tail length is measured along the curved centerline, not its chord.
5. Render deterministic proportion and tail-curve guides, then generate a neutral character
   anchor with `prompts/character-anchor.md`.
6. Edit that approved anchor into poses with `prompts/flight-pose-edit.md`.
7. Validate metadata and invariant coverage before accepting an asset.

The four-column or 4x4 presentation sheet is an assembly product. It must not be
used as the primary generation target because multi-character generation causes
anatomy and style to drift between cells.

## Commands

```powershell
npm --prefix apps/bird-minigame test
npm --prefix apps/bird-minigame run build
npm --prefix apps/bird-minigame run dev
npm --prefix apps/bird-minigame run prompt -- yellow_tit anchor
npm --prefix apps/bird-minigame run prompt -- mikado_pheasant pose power_downstroke
powershell -ExecutionPolicy Bypass -File apps/bird-minigame/scripts/render-proportion-guide.ps1 -SpeciesId mikado_pheasant
powershell -ExecutionPolicy Bypass -File apps/bird-minigame/scripts/render-tail-curve-atlas.ps1
```

The prompt command prints a reproducible prompt assembled from the checked-in
rules. Image generation remains a reviewed production step; generated files go
under `assets/generated/`.

Numeric prompt instructions alone are not an acceptance mechanism. The proportion
guide is the visual geometry source of truth, and the generated anchor must match
its silhouette within the tolerance in `rules/image-validation.json`.

The first controlled generation results are recorded in
`research/generation-trials.json`. They deliberately retain rejected outputs
locally so visually attractive failures do not silently become production art.
