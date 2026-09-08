# Leaf attachment / stem continuity defect

Actual: scaling/mirroring leaves creates thick, stepped and differently colored
stem fragments at each attachment. Expected: the existing curved stem's width,
outline, palette and continuous path remain independent of leaf variation.

Cause reproduced in the actual renderer: leafRect [65,345,190,105] is a crop of
the whole plant, including its thick source stalk. paintReviewedFlower draws that
crop after the independent procedural stem; leaf size scales the captured stalk
as well. The crop is anchored at its top instead of the leaf's connection point.
Across 80 variant/height/expression cases, leaf rendering changed 24,304 pixels
inside the independently rendered stem. The regression fails before the fix.

Earlier preservation checks compared two paths sharing the same flawed leaf
renderer. They establish sameness, not component isolation or stem continuity.
Keep those historical images immutable; explicitly request the legacy rendering
for historical comparisons and test the corrected component boundary separately.

Fix boundary: isolate a source leaf using a documented crop/mask and attachment
landmark. Compose paired leaves behind the authoritative stem/head pass. Keep
stem geometry/palette, flower heads, leaf levels/sizes, birds/scenery and physics.
Check stem pixels against a stem-only render across all variants and short/tall
plants; inspect the attachment close-ups and run the APK physical gate.

Automated result: 80 cases now change zero stem pixels while retaining 34,052
visible leaf pixels outside the stem/head. 73 unit tests pass. Frozen historical
leaf composite still reproduces the old reference exactly via explicit legacy
mode; source images remain unchanged. Cloud alpha/palette and flower-head scale
checks pass. Native-size before/after: tmp/leaf-fix-20260907/.

APK 0.1.1-poc, code 2, same POC debug signer. HTTPS GET verified SHA-256:
3e45ac6e85c5aa8c44c6e51a05e783d0b7e02b3bf33a71115494bc7b803ab165.
The first physical run timed out on CDP Input.dispatchTouchEvent before gameplay;
its screenshot and pulled installed APK are retained in tmp/leaf-fix-apk-20260907.
Display-off cleanup passed. Retry evidence is kept separately.

Retry physical gate PASS: tmp/leaf-fix-apk-retry-20260907/apk-verification.json.
All 16 choices, 14 flybys, miss, 12 hits, two collisions and side-approach landing;
exact installed APK bytes verified. Display OFF after the run. No camera/activation
algorithm change or SHINE AAC release; this is the standalone POC update.

The two legacy unit fixtures were updated to supply isolated leaf components and
assert two separate leaf draws per attachment; the actual source-sheet crop must
never be used for a leaf draw. All 73 unit tests pass after this fixture update.
