# Bird Garden standalone POC APK

Package: `org.shineaac.birdgarden`, version `0.1.1-poc` (code 2).

0.1.1 fixes leaf variation overwriting the stem: isolated leaves attach behind
the existing continuous stem. The old 0.1.0 APK remains a separate artifact.
Installs alongside `org.shineaac.app`; does not modify SHINE AAC or its data.
All game code/art is packaged offline. No Android permissions, network dependency,
native JavaScript bridge, account or production signing-key change is needed.
The development APK uses the existing Android debug certificate.

Build from repository root:

```
gradlew.bat :bird-poc:assembleDebug
device-test.bat --bird-poc apps/bird-minigame/android/build/outputs/apk/debug/bird-poc-debug.apk
```

Set `BIRD_NODE` to Node 24+ for the physical test's WebSocket connection; set
`ANDROID_SERIAL` to choose a connected phone. The gate installs the exact APK,
pulls it back to compare SHA-256, selects all 16 birds, and records an actual
full round with miss/hit/collision/recovery/landing and fixed scenery. The gate
always sleeps and verifies the phone display. Normal `device-test.bat` continues
to run the SHINE AAC acceptance and native-settings audits.

The POC picker is manual. Future host integration uses the existing random-species
API. Scenery has an independent seed sampled once at start/replay, with 5–8 bushes,
three green palettes and three photographic Beidawu haze/framing variants.
Other named mountain source photographs have not yet been integrated.

Rotate without recreating the WebView, pause on backgrounding, and require an
explicit resume/replay when returning. WebView debugging is enabled in debug
builds for POC verification. This APK is a test build, not a tagged AAC release.
