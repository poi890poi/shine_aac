# Cosmetic follow-up

Grass transition follow-up: intentional scenery design change. Replace the hard
rice/meadow seam with a connected uneven edge, rice-green patches and varied
overlapping blades. Bound changes to a 24px margin above the prior seam, keeping
landing height, flowers/stems/leaves, clouds and all other scenery unchanged.
Verify the actual raster has varying edge heights and no gaps below the fringe;
inspect the composed scene at native size. No changes to gameplay or Android.

Type: intentional design change. Larger charge indicators (2×), flower crowns
(1.15×), three flat cloud tones, and sparse clustered pixel grass improve readability
and distinguish the foreground as a meadow. Controls live in src/visual-tuning.js.

Scope: only cosmetic rendering. Keep flower stems and leaves pixel-identical,
source character expressions intact, cloud alpha/placement/drift unchanged, and
mountains/cottages/rice untouched. No changes to drop budget, collisions, landing
physics, AAC columns, Android integration, persistent settings or stored data.

Risks: larger crowns may overlap at eight columns; shade reduction may flatten
clouds too much. Check native-size screenshots, all expressions and AAC 3/4/8,
compare lower plants to the historical renderer, verify cloud alpha exactly and
inspect the foreground/transparent HUD. Historical baselines are never regenerated.
