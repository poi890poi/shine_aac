# Android Add-on Delivery

## Decision

Use Google-supported delivery mechanisms rather than a custom APK/plugin loader.

Camera blink and cheek detection share the bundled MediaPipe Face Landmarker:

```kotlin
implementation("com.google.mediapipe:tasks-vision:1.0.0")
```

The face model is available immediately after install, so both optical gestures work offline without a first-use download.

For future generic add-ons, use Play Feature Delivery dynamic feature modules when publishing as an Android App Bundle through Google Play. Dynamic feature modules are the Google-supported way to download, install, and remove app features on demand. They are not a good fit for local sideloaded debug APK testing, so debug builds should keep using normal module dependencies or separate test APKs.

## Current Add-ons

| Add-on | Runtime | Delivery |
| --- | --- | --- |
| Camera long-blink and cheek input | `android-inputs` | Bundled MediaPipe face model |
| Hardware buttons | base app | install-time |

## Notes

- Do not build a custom APK plugin loader for AAC input modules. It would add signing, trust, update, and compatibility problems.
- Keep input devices behind `InputAdapter` and `InputSink` so future input types can be added without changing scanner logic.
- If Play Feature Delivery is added later, the base app should own a small generic add-on manager UI and dynamic feature modules should register input adapters through stable interfaces.
