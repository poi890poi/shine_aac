# Two-line status approval and larger cloud review

The user approved keeping two status lines at all times because small, long
lines are difficult to read. This is an accessibility behavior invariant.

The status reserves two current-font line heights even during a short pause.
The phase and its supplementary instruction are separated by a line break in
both full renders and incremental scanner updates. Text is not reduced in size,
truncated or hidden to achieve the layout. Exceptional wrapping at enlarged font
sizes may grow beyond two lines rather than conceal information.

Type: approved presentation change and replay-layout bug fix. The owning boundary
is the web status renderer/CSS shared by browser and Android. Scanner timing,
activation behavior, saved preferences and game artwork are unchanged. Main risk:
status changes moving the communication board. The existing replay geometry
regression continues to compare every tile, message, panel and Settings rectangle;
an added assertion verifies a real line break, preserved whitespace and sufficient
status height.

Source and packaged speech-lock E2E suites pass. The supported tablet/window and
conversation layout matrix passes. Preview APK build succeeds. `device-test.bat
--garden` passed on the tablet Preview package, verifying its installed APK,
physical game entry/start/drop, fullscreen display and preserved AAC content on
return. Internal evidence: `.tmp/tablet-adaptation/garden-R9JT201YLJF-1788959335736`.
This is integration coverage; replay geometry is covered by the browser suites.
The tablet display was verified OFF. The phone was not used. No new optical
acceptance claim is made; previously recorded calibration/session failures remain
open because this change does not touch camera or activation behavior.

## Cloud proposal only

The user found the mountain scaling proposal too minor and asked to try much
larger, more plentiful clouds. Mountains retain their existing app scale.

[Cloud comparison](reviews/2026-09-09/cloud-composition-review.png) shows the current
six clouds and two seeded arrangements using eleven: six far and five near.
Far scales center on 0.30 (formerly 0.14); near scales center on 0.56 (formerly
0.22–0.24), with 18% scale variation and bounded position variation. All six
reviewed cloud silhouettes and the flat three-tone palette are reused. Far/slow
and near/fast movement rules are retained; the review itself is static.

The initial experiment placed clouds too low and covered the meadow. The revised
preview confines them to the sky. Arrangement B leaves more sky around the bird;
the image is for user review before any game code change. Flowers, curved stems,
leaf attachments, bird and mountains use identical fixtures across comparisons.
[Mountain attribution](reviews/2026-09-09/artwork-attribution.txt) applies.

`scripts/cloud-composition-review.mjs` keeps count, scale, variation and seeded
positions reusable in a review-only experiment. It overrides browser responses;
it does not alter product assets. The earlier replay comparison is pinned to its
pre-approval commit so it remains reproducible after this approved change.
