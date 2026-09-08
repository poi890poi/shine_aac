# Mountain library batch — September 8, 2026

Type: scenery design and offline artwork tooling. The requested outcome is a
substantial set of different photographic mountain silhouettes, delivered as one
batch. Two profiles plus recolors are inadequate. Target: eight distinct named
mountain profiles, with haze variations counted separately.

The batch review preserves the approved birds, flower heads, curved stems, isolated
leaves, cloud shapes and shading, bushes, grass, HUD, gameplay and device settings.
It owns photo selection, source records, conversion recipes and review artifacts.

The existing live profiles are Beidawu/Pingtung and the Qilai-direction panorama
from Hualien. Additional Taiwanese mountains and lower-valley viewpoints are being
prepared as review candidates; expanding beyond the four original location pairs
is pending the user's response. Candidate output must not overwrite live assets.

Principal risks: misidentified peaks, looking down from a high viewpoint, obscured
skylines, sky becoming solid land, photographic buildings entering the scenery,
and counting different crops of one mountain as different identities. Review each
source against its pixel conversion, retain authors/licenses/hashes, and require
distinct source identities and output masks. Color changes must preserve alpha.

Verification: repeatable conversion, source hashes, binary alpha, the shared four
mountain colors, eight unique identities/silhouettes, and a labelled full-batch
review. Technical checks do not constitute user artwork acceptance. No APK or
physical-device PASS is claimed for candidate-only work.

Rejected source candidates:

- Qixing, Commons 96539059: elevated overlook includes a valley viewed from above.
- Guanyin, Commons 135664200: clouds obscure the ridgeline.
- Dulan, Commons 31338062: wires, roof and trees cross the mountain outline.
- Qixing, Commons 56153091: foreground foliage blocks the outline.

The Qixing candidate from Peellden is a ground/hillside view looking up at the
volcanic massif, rather than a lowland plain. It is explicitly labelled as a
different viewpoint category. The Yushan candidate looks up from Chenyoulan River
Bridge in Nantou, not Chiayi. These exceptions require the scope decision above.

## Candidate result

Eight profile records, indexed PNGs, source crops, hashes and author/license links
are in `assets/candidates/mountain-batch-20260908/`. The `review` directory includes
`mountains-eight-review.png` (photo/conversion comparison),
`mountains-eight-scenes.png` (all eight in the actual scene renderer), individual
scene PNGs and the exact common bird/flower foreground.

Profiles: Beidawu/Pingtung, Qilai-direction/Hualien, Yushan/Chenyoulan valley,
Dulan/Taitung, Guanyin/Tamsui, Qixing/lower hillside, Huoyan/Da'an river bed, and
Dajian/Kenting. Six additions plus the two existing profiles; moods do not count.
Qilai is explicitly a directional panorama with intervening foothills.

The common converter now supports an optional blue-minus-red ceiling for a
source-specific blue-sky matte. Legacy recipes do not use it and their outputs
remain unchanged. Review found that a tight ceiling damaged Dajian's blue-lit
slopes; removing that ceiling and using its luminance separation fixes the cuts.
An independent set of source-pixel sky/land brackets detects the rejected mask.
Huoyan and Guanyin received stricter luminance masks after sky fragments appeared.

Verification: six new batch tests and eleven existing conversion tests pass.
The batch tests check eight distinct source identities and alpha silhouettes,
frozen source hashes, exact output reproduction, shared palette, binary connected
alpha, contour invariance under color cleanup, source brackets and a blue-sky
fixture. The browser renders all eight with one unchanged bird/flower bitmap and
the existing cloud renderer. Visual review is still a separate user decision.

Original downloads for the last three photos were rate-limited. Their already
retrieved 960-pixel Wikimedia previews are the explicitly recorded conversion
sources (twice the 480-pixel output width); hashes describe those actual files.
No hidden retry or substitute source is claimed. Author and license metadata is
preserved for each image.

No live catalog, APK or installed device changed for this candidate batch. No
physical display was used or woken. Geographic expansion is still pending the
user's earlier structured question. No external publication was attempted.

## Authorized APK integration — September 8

The user requested tablet APK installation after the complete eight-profile review
and the explicit expanded-location question. This authorizes that reviewed set;
no additional confirmation is needed. The preceding candidate/pending entries are
historical. Type: scenery design integration and Android build/install, 0.1.3-poc.

Promote the exact eight reviewed PNGs and source records. Catalog growth from two
to eight uses the existing per-round seeded selection and three independent haze
moods. No gameplay, character, flower/stem/leaf, cloud, grass, audio, HUD sizing or
full-screen changes. Additional indexed images are small; source JPGs remain
outside the APK. Principal integration risks are missing packaged images, stale
catalog/credits and asset changes; compare packaged hashes to the reviewed batch,
run the live scenery browser check, and run device-test.bat --bird-poc on the tablet.
Restore rotation settings and verify the physical display OFF in cleanup.

### First physical run and harness diagnosis

The first tablet installation succeeded (versionCode 4, versionName 0.1.3-poc,
installed bytes identical). Both orientation checks passed. The full round then
failed with phase `exited`, after pass 5, rather than `won`. No physical PASS is
claimed for `tmp/tablet-eight-mountains-20260908`.

Observed configuration: screen_off_timeout 30000 ms. Native selector/start taps
reset Android user activity, but subsequent CDP playfield touch injection occurs
inside WebView. The harness had no keep-awake mechanism. `embed.js` exits on
document.hidden/pagehide. Screen OFF after failure alone cannot establish the
trigger because cleanup also sleeps the display. Falsifiable diagnosis: native
idle sleep interrupts the long CDP-only portion; a same-APK rerun with periodic
native wake input should remain foreground and complete. This is a test-harness
change, not an APK or gameplay fix.

The retry sends KEYCODE_WAKEUP every ten seconds only while the test is active.
Cleanup clears the interval and awaits any pending wake before KEYCODE_SLEEP and
the OFF assertion, preventing a late wake after handoff. It never changes timeout
or stay-awake settings. Retry evidence is separate, under
`tmp/tablet-eight-mountains-20260908-awake`.

### Installation result

Installed 0.1.3-poc / versionCode 4 on Samsung SM-X200, R9JT201YLJF.
APK SHA-256: `3170652cbf398e6970887a1d0ac7405a00df317683a1f2343480639a514a14eb`.
All eight image bytes in the APK match their reviewed hashes; all source credits
are included. The installed APK was pulled back and its whole-file hash matched.

79 unit tests pass. The packaged browser check loads all eight profiles and all
three haze settings, preserves each photo's alpha, rejects repeated silhouettes,
and verifies stable scenery across pause/resize and varied scenery on new rounds.

The same-APK physical rerun passes `device-test.bat --bird-poc`: portrait
1200x1920 and landscape 1920x1200 fill the screen, all 16 bird choices respond to
physical taps, audio unlocks, and a 122.507-second normal round records miss, hit,
two collisions, recovery, side-approach landing and won with score 12. The round
used the new Huoyan profile (index 6), fixed through all phases. The successful
keep-awake-only rerun supports the native inactivity-timeout diagnosis; no APK
change was needed after the first attempt.

The harness verified the tablet display OFF in both cleanup layers, followed by
an independent OFF check. Its screen timeout remains 30000 ms. No physical-device
settings were left changed. No external publication or release tagging performed.
