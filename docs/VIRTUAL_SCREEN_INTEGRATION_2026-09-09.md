# Virtual-screen integration and UTF-8 credits

The user approved the image and requested implementation, also reporting garbled
artwork credits. These are two separately reviewable changes: approved rendering
behavior and an artifact-encoding fix.

## Rendering behavior

The renderer owns an offscreen virtual canvas. All birds, flowers, curved stems,
leaves, mountains, clouds, bushes, grass, drops, feathers and ammo paint there.
The physical canvas receives one integer nearest-neighbor copy of the completed
frame at origin (0,0). It receives no individual sprite/effect draws.

The 360×800 portrait reference is retained at integer display densities. Other
aspect ratios adapt the virtual extent; the physical tablet used 640×400 enlarged
3× to 1920×1200. Non-divisible display dimensions clip only the last partial pixel
at the right/bottom instead of stretching or fractionally centering the frame.
Floating-point simulation remains unchanged; rendering rounds positions on the
virtual grid. The existing accessible helper controls retain their styling.

The approved cloud recipe has six far and five near clouds, seeded once per
round with separate cosmetic randomness. Seed 29 matches arrangement B exactly.
Clouds and mountains are prepared at their target virtual sizes and restored to
binary alpha and their indexed palettes. Prepared images are cached with a bound
of eight sizes per source to avoid unbounded memory growth across rounds/resizes.
Clouds paint behind terrain so large low clouds cannot cover foreground grass.
The approved portrait remains pixel-identical after this depth ordering.

Primary risks were shape loss from coarse resampling, mixed pixel origins,
display-density changes, repeated preparation cost, foreground cloud overlap,
and changes to gameplay or communication state. Bird/flower source assets and
physics are unchanged. Historical review generators are pinned to their original
source commits so they do not quietly rewrite earlier comparisons.

## Verification

- 81 game unit tests pass, including the approved cloud fixture, repeatable seed
  variation, far/near ordering/speed, reduced motion and integer viewport fitting.
- `scripts/virtual-screen-test.mjs` passes: zero changed pixels against the approved
  720×1600 portrait; all sixteen birds across running/rescue/landing/won samples;
  3–8 columns; phone/tablet portrait/landscape and fractional density cases.
- Every sampled output frame shares one grid and origin. Fractional bird movement
  leaves the frame unchanged until a virtual-pixel boundary; a one-pixel step
  changes it. A deliberately shifted display overlay fails. Display draw calls
  are checked to receive only complete virtual frames.
- Source and packaged garden integration pass, including the hidden entry, input
  routing, random species, three charges, pause/exit and preserved AAC state.
- Preview APK build passes. `device-test.bat --garden` passes on the tablet:
  exact installed APK verified, native entry, physical touch start/drop,
  fullscreen and preserved AAC board/draft. Ready and running physical canvases
  both have zero pixel-grid violations, origin (0,0), and 3× enlargement.
  Internal evidence: `.tmp/tablet-adaptation/garden-R9JT201YLJF-1788966925388`.
- Tablet display verified OFF after testing. Phone was not used. Camera/detector
  behavior was not changed or newly certified; prior optical failures remain open.
- Full browser round reaches won and includes miss, hit, collision, falling
  feathers and landing. Video is silent at approximately 10 fps. Its initial
  six-second diagnostic has no blank samples or long held frames; p95 interval
  40.1 ms and maximum gap 160 ms under concurrent build load. This is not a claim
  of measured physical-device frame rate. Internal evidence:
  `.tmp/virtual-screen-motion`.

## Credit encoding and delivery

Source credit JSON/text was valid UTF-8. The published text response omitted its
charset (`text/plain`), allowing viewers to choose a legacy encoding. The live
server now declares `charset=utf-8` for text and HTML. The reusable generator
`scripts/artwork-credits.mjs` emits self-identifying UTF-8 text with a BOM, plus
[readable HTML credits](reviews/2026-09-09/artwork-credits.html) with an explicit
charset. It verifies the decoded Chinese titles and absence of replacement text.
The previous public text URL was replaced with the corrected file as well.

The tablet Preview APK ZIP, full-round video, HTML credits and legacy text URL
were downloaded through the authorized HTTPS tunnel and compared byte-for-byte
with their local artifacts. The text/HTML response charsets and decoded Chinese
titles were verified. The ZIP includes the Preview APK, SHA-256, installation
notes and both credit formats. This is a Preview build, not a tagged release.
