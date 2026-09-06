# Shape-preserving sprite generation trial — 2026-09-05

Subsequent decision: the user approved these designs and requested integration.
The live app now uses `magpie-v1.png` and `flower-v1.png` with exterior matte
preparation, preserving the original files. See `research/APP_ART_LANDING_UPDATE.md`
and the updated manifest. The initial findings below remain the trial history;
the original RGB files still require that display preparation.

Standard commit: `c1eca51`. Generator: built-in image generation, three calls.
Status: **not suitable for production**. User visual approval is pending. Files
are preserved as trial evidence; no live renderer or sprite reference was changed.

| Output | Visual finding | Mechanical result |
| --- | --- | --- |
| magpie-v1.png | Earlier rounded torso, black head, broad primary-feather wings and three poses retained substantially better than the rejected primitives. Long tails remain too straight; common native grid and flat shading not established. | RGB, fully opaque; 1536×1024 instead of 1536×512; painted checkerboard. |
| flower-v1.png | Earlier seven-petal crown, curved stalk, two leaves and four recognizable expressions recovered. Some petal/face contours drift between cells, so this is not a fixed component template. | RGB, fully opaque; 1254×1254 instead of 1024×1024; painted checkerboard. |
| magpie-alpha-v2.png | Focused background-only edit attempted. It changed the checkerboard instead of removing it; original tail issue remains. | RGB, fully opaque; genuine-alpha requirement failed again. |

The neutral source visibly has seven petals. Its design was preserved in the
prompt instead of using the rejected procedural configuration's eight-petal setting.
That draft configuration is not authority for changing the established character.

The prompts requested a common four-output-pixel unit. Neither stating that unit
nor observing blocky edges proves grid compliance. The returned flower dimensions
are not even divisible by four. Both assets still contain many intermediate tones;
these are not validated flat-palette, native-grid production sprites. Color counts
in the report include the background and must not be described as character-only
palette measurements.

Read `mechanical-inspection.json` for hashes, actual dimensions, PNG mode and alpha
extrema. Reproduce those checks with a Pillow-enabled Python environment:

```
python apps/bird-minigame/scripts/inspect-sprite-candidates.py
```

The inspection reads existing pixels and writes JSON only. It does not edit images
or certify shape/quality. Visual findings above are the assistant's review, not a
fabricated user approval. Exact prompts and input hashes are in `manifest.json`.

Next production work remains the standard's approved component contours/pivots,
an enforceable shared pixel grid and palette, real alpha, tail arc-length control,
and native-size matched review. These generation trials do not implement that rig.
