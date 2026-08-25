# Offline resource management

SHINE AAC keeps the communication board and established switch inputs usable
without a network connection. Optional models and future model updates are
managed from **Settings → Data and support → Offline resources**. Android can
also open the same native page from **App info → Storage**.

## What the page shows

- **Cheek-twitch model** — recognizes cheek movement for camera switch input.
  Version 0.4.0 includes the verified model in the app as an offline fallback.
  A newer model can be downloaded and used without replacing that fallback.
- **Long-blink face detection** — a required app component used by long-blink
  setup and runtime input. It is included with the app and cannot be removed
  from the resource page.
- **Taiwan Mandarin voice** — the small built-in Traditional Chinese voice
  pack. It remains included and offline.

The status under each item distinguishes an included resource from a
downloaded update. Removing a downloaded cheek-model update immediately
returns the app to the included version; it does not disable camera input or
remove the user's gesture calibration.

## Download safety and storage

Downloads use Android WorkManager with a connected-network constraint, bounded
timeouts, retry limits, and a maximum accepted file size. The file is written
to a temporary name in app-private internal storage. SHINE AAC checks both the
expected byte length and SHA-256 digest before installing it in a versioned
directory. An incomplete or modified file is rejected and never selected by
the detector.

The app does not request shared-storage permission. Android removes managed
downloads when the app is uninstalled or its data is cleared. A running cheek
detector holds its own direct model buffer, so removing an update cannot
invalidate an in-progress camera session.

## Offline fallback policy

Version 0.4.0 is a transition release: it introduces verified download and
resource-management infrastructure while retaining the cheek model in the
APK/AAB. This avoids breaking an existing AAC user's configured input after an
update while offline. A later Google Play release may move optional native
code or models to Play Feature Delivery only after a safe migration period.
Direct debug APKs should remain self-contained for testing and sideloading.

## Caregiver check after an update

1. Open **Offline resources** and confirm the expected status.
2. If an update is offered, keep the app open or leave Android to complete the
   queued download when a network is available.
3. Open **Camera setup** and run **Input test** with the user's normal camera,
   distance, zoom, and lighting.
4. Turn off Wi-Fi and mobile data and repeat an activation before relying on
   the device offline.

If a download fails, retry on a stable connection. The included model remains
active. If a downloaded update behaves worse for a particular user, choose
**Remove download** and repeat Camera setup with the included version.
