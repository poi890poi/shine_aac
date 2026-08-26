# Optical core

`optical-core` contains deterministic blink and cheek gesture rules. It has no Android, camera, MediaPipe, ML Kit, USB, UI, or persistence dependency.

It owns:

- blink thresholds and calibration-quality policy
- long-blink classification state
- cheek feature models and robust baseline detection
- unlabeled positive-sample discovery
- automatic cheek-calibration session state
- binary hold/activation classification

Android camera integrations convert detector output into these model inputs. Setup and normal operation must call the same core rules.

Verify it independently:

```powershell
.\gradlew.bat :optical-core:test
```
