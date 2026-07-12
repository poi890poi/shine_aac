# Android Add-on Delivery

## Decision

Use Google-supported delivery mechanisms rather than a custom APK/plugin loader.

For camera blink detection, use the Google Play Services ML Kit face detector dependency:

```kotlin
implementation("com.google.android.gms:play-services-mlkit-face-detection:17.1.0")
```

This keeps the AAC app on the unbundled ML Kit path. The face model is downloaded by Google Play Services instead of being bundled into the APK.

For future generic add-ons, use Play Feature Delivery dynamic feature modules when publishing as an Android App Bundle through Google Play. Dynamic feature modules are the Google-supported way to download, install, and remove app features on demand. They are not a good fit for local sideloaded debug APK testing, so debug builds should keep using normal module dependencies or separate test APKs.

## Current Add-ons

| Add-on | Runtime | Delivery |
| --- | --- | --- |
| Camera long-blink switch | `android-inputs` | Google Play Services ML Kit face model |
| Hardware buttons | base app | install-time |

## Notes

- Do not build a custom APK plugin loader for AAC input modules. It would add signing, trust, update, and compatibility problems.
- Keep input devices behind `InputAdapter` and `InputSink` so future input types can be added without changing scanner logic.
- If Play Feature Delivery is added later, the base app should own a small generic add-on manager UI and dynamic feature modules should register input adapters through stable interfaces.
