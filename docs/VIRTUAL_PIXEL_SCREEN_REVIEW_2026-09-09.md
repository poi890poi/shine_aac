# One virtual pixel screen

The user requires uniform pixel size **and alignment**, clarified as rendering the
whole game on a low-resolution virtual screen, then enlarging that screen. Moving
small sprites independently on a high-resolution surface is not the requested
architecture. This is a release invariant in the artwork standard.

Type: artwork/rendering design review and executable diagnostic tooling. Product
rendering and packaged assets remain unchanged pending image review.

## Evidence and corrected approach

Existing draw paths resize birds (including a 1.3 display multiplier), flower heads
(1.4), cloud crops and mountain images separately. Several bird assets have already
been sampled once before their later display enlargement. The current viewport
also derives its canvas dimensions from physical dimensions and device density.
Disabling smoothing does not by itself establish a stable virtual resolution or
consistent apparent source-pixel detail.

The initial 2/3-pixel coarse-grid trials passed alignment tests but visibly damaged
eyes, flower expressions and stems. They are rejected; their ignored review
outputs are preserved. A scenery-only adjustment was also insufficient as the
complete architectural answer to the user's clarification.

The revised prototype renders every game layer into a fixed **360 × 800** virtual
canvas and sends only that completed canvas to a **720 × 1600** display canvas.
The display performs one nearest-neighbor 2× draw at origin (0,0); it never receives
individual sprite draws. Resizing the browser display does not resize the virtual
framebuffer. This resolution is a review candidate chosen to retain the approved
character detail; it is not a final device-layout policy.

Cloud count and dimensions retain the size-approved arrangement B. A separate
review-only scenery preparation step samples the clouds/mountains at their final
native dimensions, smooths inherited enlarged stair steps, then restores binary
alpha and the existing three-tone palettes. This changes scenery edge pixels and
therefore needs visual review. It is not a final-frame color/depth filter. Bird,
flower, curved-stem, leaf and grass rendering is retained on the virtual canvas.

## Verification and limits

`scripts/shared-pixel-grid-review.mjs` reproduces native, enlarged and detail views
from the committed recipe in `apps/bird-minigame/research/shared-grid-review.json`.
It checks that each displayed 2×2 pixel cell is uniform across still and moving
frames. A deliberate one-display-pixel-offset overlay fails this check. Subpixel
bird movement must leave the displayed frame identical; a one-virtual-pixel step
must change the frame. These checks demonstrate alignment and quantized movement,
not anatomical quality. The rejected coarse candidate is retained as a warning
against equating this metric with shape quality.

[Virtual-screen image at 2×](reviews/2026-09-09/virtual-screen-2x.png) and
[exact 3× detail comparison](reviews/2026-09-09/shared-grid-details.png) are review
artifacts. [Mountain credits](reviews/2026-09-09/artwork-attribution.txt) apply.

All-species poses, flower expressions, collision feathers, landing, the 3–8 column
matrix, phone/tablet fitting and physical smoothness still need verification once
the visual direction is approved and integrated. Helper controls retain their
previously reviewed accessible styling; this experiment concerns pixelated game
art and the ammo indicator. No device was used and no APK was installed in this
review. Previously recorded optical failures remain open.
