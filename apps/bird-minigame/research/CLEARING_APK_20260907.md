# Clearing POC APK change audit

Intentional scenery change and Android POC packaging. Replace cottages/rice with
the approved open clearing, fixed three-tone bush silhouettes and bounded seeded
variation. Keep bird/flower/cloud source art, stems/leaves, drop/collision/landing
physics, AAC columns and existing signing keys unchanged. The 16-bird POC picker
remains manual; host integration still defaults to random birds per new round.

Each round owns one scenery seed. Cosmetic randomness must not consume the bird
selection RNG or regenerate on ticks, flybys, pause, rotation, or collision. Keep
the landing area clear. Mountain variation preserves the verified Beidawu source
profile with modest uniform framing and discrete atmospheric palettes; do not
invent a named mountain or treat an unverified photo as an approved source. Other
named mountain photographs remain a separate asset-review step.

Risks: clutter, mountain disappearance, offscreen gaps at different aspect ratios,
random rerolls, offline WebView asset loading and lifecycle audio. Verify seeded
variation/stability, protected art, native-size screenshots and packaged APK on
the physical phone. Use device-test.bat for physical acceptance. Sleep and verify
the display after every test run. Deliver APK through verified HTTPS GET, with its
SHA-256 and build type. This POC APK is not a tagged SHINE AAC production release.

## Delivered evidence

Built `:bird-poc:assembleDebug`, package `org.shineaac.birdgarden`, 0.1.0-poc,
version code 1. Existing Android debug certificate; no requested permissions.
73 unit tests pass. Browser checks cover all birds, scenery/resize/replay lifecycle,
mountain alpha, and protected flower/stem/leaf/cloud rendering.

`device-test.bat --bird-poc` PASS on RFCR91GWXLX: installed APK pulled back and
SHA-256 compared; all 16 picture choices selected; yellow tit completes 14 flybys,
one miss, 12 hits, two collisions, recovery and side-approach landing. Scenery seed
remains identical across pause/resume and the whole round. Display verified OFF.
Evidence: `tmp/clearing-apk-20260907/apk-verification.json` and `recording.json`.

APK SHA-256: `09391287ce6e017cca0c036b3935f2d05e36b12f30dddebbb31a733621d7cd65`.
Published HTTPS APK was downloaded and matched the tested bytes:
https://though-ham-hang-applications.trycloudflare.com/bird-garden-0.1.0-poc.apk

Scope: standalone POC, manual bird selector, offline assets. No native camera or
activation algorithm change, so optical rig gate is not applicable. Other named
mountains are not in this APK; three Beidawu photographic moods are available.
