# Reviewed countryside POC integration

Type: accepted artwork integration and recording tooling. Scope: standalone browser
POC, no Android native app changes. The user accepted the complete scenery, requested
a commit and a new full-length video, then explicitly selected the connected phone.

The earlier running game still drew procedural clouds and the simpler leaf layout.
The live renderer now loads reviewed cloud art, static Beidawu conversion, equal
sunny cottages and rice fields. It uses the same complete flower drawing and leaf
presets as the accepted review. Far clouds drift at 1.35 native pixels/second, near
clouds at 4.2; reduced motion freezes both. The scene reference width is 480, height
adapts to the viewport, and display enlargement uses whole integer factors.

The source image/matte/crops and shared conversion recipes are retained. The mountain
photo is Greenigor's “日出前的北大武山”, viewed from Neipu, Pingtung, CC BY-SA 4.0.
The adapted mountain and review/video imagery carry that attribution and license.
No new mountain geometry, bird shape, flower expression, drop rule or physics change.

Verification: the packaged renderer's protected 480×640 flower/cloud layer has zero
pixel differences from the frozen accepted reference. The browser check also finds
visible mountain pixels and exercises 3, 4 and 8 AAC columns. Unit tests cover cloud
layer ordering, slow/fast drift and reduced-motion freeze, plus existing game rules.

Recording uses the real packaged POC on the phone at normal speed, with browser
playfield touch inputs and no physics/state overrides. Event traces establish miss,
hit, collision, recovery and landing coverage. Full-length export removes only the
phone/browser surroundings; it neither cuts intervals nor accelerates the round.
Phone/tablet displays used for capture are put to sleep and their OFF state verified.

The first tablet capture is rejected because Android's Chrome compatibility notice
obscured/dimmed it. A second tablet take was stopped when the user connected and
selected the phone. Only the clean final phone capture is the deliverable.
