# Tablet viewport, mountain variety, comic audio and default charges

Mixed scope: tablet layout defect plus intentional audio/default behavior changes.
The 34rem/48rem app-shell cap and integer contain scale leave large blank margins.
Use the full viewport, overlay helper controls, immersive native system bars, and
integer physical-pixel scaling with adaptive native canvas dimensions. Preserve
sprite proportions, heads, isolated leaves/stems, and collision/landing rules.

Make recharge mode (capacity 3, refill 6 active seconds) the shared default. Keep
explicit flyby mode and its tests. Replace uniform beep sequences with short
bounded synthesized effects: descending whistle, plop, boing, miss and fanfare.
Retain mute/pause cleanup and no unsolicited music. Verify audio offline renders,
playback scheduling and mute behavior; do not call silent screenrecord audio proof.

Only Beidawu photo framing/palettes exist in 0.1.1; these are not distinct mountain
profiles. Seek verified licensed low-ground sources, preserve their real silhouette,
record provenance and native conversion recipe. Do not invent named profiles.

Regression: responsive canvas coverage and non-stretching pixel scale, charge
defaults with explicit legacy mode, audio duration/peak and lifecycle, protected
leaf/stem tests, and device-test.bat on tablet. Verify test displays OFF after use.

Implementation and evidence:
- Shared sizes: ammo 3 (was 2), bird multiplier 1.3, flower crown 1.4 (was 1.15).
  The leaf/stem independent passes and original cloud silhouettes stay intact.
- Landing defect: renderer selected standing frames for the whole approach.
  Airborne phases now use the existing species flight cycle. Ground alignment
  references the standing eye/foot landmark consistently across flight frames,
  preventing frame-dependent vertical jumps during deceleration.
- Landscape gameplay uses a common vertical projection below the enlarged HUD.
  The background/clouds use the complete viewport; no letterbox or resized cloud
  field. All gameplay objects share the projection so drops and flowers align.
- Beidawu's three moods were one photo. Add a separate Hualien-station panorama
  looking toward Qilai; source/licensing and cross-reference identification are
  recorded in rules/mountain-variants.json. Each source retains its own alpha.
  A Yushan river-valley candidate is researched but not integrated pending the
  user's answer about allowing viewpoints beyond the previously named locations.
- 78 unit tests; rendered verification covers all 16 airborne landing cycles,
  five viewport sizes, narrow landscape HUD clearance, 4/8 flower columns and
  seven synthesized effects. Offline sound tests prove mute/stop silence and
  unmute playback. Leaf coverage: 80 cases, zero changed stem pixels; cosmetic
  coverage: 48 cases, zero stem/leaf changes and zero changed cloud alpha.
- Native tablet rotation is checked against screenshot pixel dimensions, with
  temporary rotation settings restored. Touch unlocks the actual AudioContext.
  Early test failures were a missing instrumentation variable and a WebView CDP
  touch timeout during the picker; the latter now uses native Android taps.
  Every attempt verified display OFF in finally. Full-round evidence includes
  actual miss/hit/cleared/collision/landing/won events, without physics overrides.
- Demo sound is reconstructed using the identical synthesis module and actual
  event timestamps. It is explicitly not captured device audio.

Final tablet evidence: tmp/tablet-accessible-20260907/apk-verification.json.
APK 0.1.2-poc, versionCode 3; SHA-256
cc12deff73bc5412419e1ebb984371515ecae4508f4bf56fd61cb60d11be0779.
Installed bytes match the built APK. Full physical gate PASS, 16 picker species,
three-charge default, running AudioContext, normal-timing round score 12, all
flowers cleared and automatic landing. Exact coverage: portrait 1200x1920 and
landscape 1920x1200. Both tablet and phone displays verified OFF afterward.
Final video: 124.8 seconds, H.264 600x960 with event-synced AAC soundtrack;
34 measured events, no time cuts. Soundtrack peak 0.175, no clipping.

Delivery status: publication through the already-running Cloudflare download
endpoint was rejected by automatic approval review twice, including after APK
inventory/no-permissions checks. No new files were copied to the public share and
the server was not restarted. Explicit destination approval requested; local APK,
media and tests are complete. Do not report HTTPS delivery until approved and
the downloaded bytes have been verified.
