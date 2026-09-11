# Sustained face-analysis benchmark — 2026-09-11

This is a test-only continuous pipeline screen. The production application remains unchanged and CPU-default. Both devices were USB powered; energy consumption and battery life were not measured.

Phone: Samsung SM-G781B, Snapdragon SM8250, Adreno 650. Tablet: Samsung SM-X200, Unisoc T618, Mali-G52 (not MediaTek). Phone condition order was CPU / GPU / preparation overlap; tablet order was GPU / CPU / preparation overlap. Each condition ran continuously for about 30 minutes after warmup.

| Device / condition | Minutes | Overall p95 age | Early p95 | Late p95 | Late/early | Activations | Failed cases |
|---|---:|---:|---:|---:|---:|---:|---:|
| phone / cpu | 30.24 | 39.4 ms | 39.6 ms | 40.0 ms | 1.011 | 236/236 | 0 |
| phone / gpu | 30.24 | 41.0 ms | 41.5 ms | 40.8 ms | 0.983 | 236/236 | 0 |
| phone / prepared | 30.24 | 41.2 ms | 41.9 ms | 41.0 ms | 0.980 | 236/236 | 0 |
| tablet / cpu | 30.24 | 84.3 ms | 91.6 ms | 82.5 ms | 0.901 | 236/236 | 0 |
| tablet / gpu | 30.24 | 61.7 ms | 64.0 ms | 60.6 ms | 0.947 | 236/236 | 0 |
| tablet / prepared | 30.24 | 62.5 ms | 64.8 ms | 61.4 ms | 0.947 | 236/236 | 0 |

Early and late windows contain equal complete stimulus cycles (approximately five minutes), starting at the same fixture phase. A late/early ratio above 1.10 flags degradation for investigation; it does not establish thermal causation.

![Latency and thermal trends](https://recreational-instruments-paid-moses.trycloudflare.com/face-sustained-trends-20260911.png)

| Device / condition | Battery first → last | Headroom max | CPU core-equivalent | Fresh frames / input | Display states during run |
|---|---:|---:|---:|---:|---|
| phone / cpu | 30.6 → 32.8 C | 0.813 | 0.52 | 27494 / 27494 | ON |
| phone / gpu | 30.6 → 32.8 C | 0.790 | 0.55 | 27494 / 27494 | ON |
| phone / prepared | 30.6 → 32.8 C | 0.787 | 0.56 | 27494 / 27494 | ON |
| tablet / cpu | 29.9 → 35.1 C | unavailable | 1.17 | 27494 / 27494 | ON |
| tablet / gpu | 30.0 → 34.5 C | unavailable | 1.07 | 27494 / 27494 | ON |
| tablet / prepared | 29.9 → 34.4 C | unavailable | 1.09 | 27494 / 27494 | ON |

CPU core-equivalent is process CPU time divided by elapsed time; it is not power. Thermal headroom is utilization of the thermal envelope: larger is worse. Battery temperature is not SoC/skin temperature. Thermal traces include setup and final output serialization, and are not aligned exactly with the timed-input axis; brief sensor peaks can include those phases.

| Device / condition | p99 age | Maximum age | p95 fresh-result gap | Maximum fresh-result gap |
|---|---:|---:|---:|---:|
| phone / cpu | 42.7 ms | 79.8 ms | 73.9 ms | 100.4 ms |
| phone / gpu | 42.1 ms | 49.4 ms | 71.5 ms | 83.2 ms |
| phone / prepared | 42.6 ms | 51.0 ms | 71.2 ms | 82.2 ms |
| tablet / cpu | 95.8 ms | 122.8 ms | 82.7 ms | 98.6 ms |
| tablet / gpu | 64.9 ms | 74.2 ms | 71.7 ms | 84.4 ms |
| tablet / prepared | 65.6 ms | 75.5 ms | 71.9 ms | 86.9 ms |

Fresh-result gaps measure spacing between consecutive accepted deliveries. Maxima are individual observations, not repeatable guarantees.

## Method and limits

- Single native model per condition, 320×240 public frames, 66 ms source cadence, unchanged one-face/tracking settings and 1000 ms default blink hold. All complete positive/negative cases are evaluated separately. Native owner-thread lifetime and input buffer ownership are retained.
- The existing debug preview APK is unchanged. SettingsActivity is launched with a temporary keep-screen-on flag and display state is sampled. The sustained APK did not record window focus/keyguard state; those checks belong to the separate short control. Camera capture, preview, AAC scanning, speech and game rendering are absent. The default blink benchmark classifier does not validate cheek gestures or every user calibration.
- One continuous observation per condition and device. This is not a counterbalanced within-device replication or a release PASS; known repeated stimuli do not establish accuracy on unseen people.
- Initial temperature matching uses battery temperature before setup, not at the first timed input; model setup can warm the device after admission. Ambient temperature, case insulation and external power are unmeasured. Both devices retained recorded manual brightness 255 / mode 0. Normal USB charging can move between full and charging states; raw status is retained.
- Native task timing includes CPU work even in GPU mode. Initialization logs identify the actual delegate partitions; GL renderer initialization alone is not treated as GPU inference evidence. The GPU path still executes blendshape calculation on CPU. No CPU/GPU landmark agreement is computed from compact long-run records.
- In-process thermal/PSS telemetry runs every 10 seconds; host diagnostics every 30 seconds. Their overhead is unquantified and shared across conditions. Compact sample metadata accumulates until output, so PSS growth is not interpreted as a production memory leak.
- No production settings, permissions or display preferences are intentionally changed. Cleanup evidence is retained separately. No physical camera/optical-rig or complete-app device-test PASS is claimed.

## Provenance and evidence

Public optical stimuli are declared in testdata/optical-rig/sources.json: Clément Bucco-Lechat, Wikimedia Commons, CC BY-SA 3.0. The immutable timed fixture manifest, APK identities and per-run numeric evidence are retained. The initial tablet host attempt stopped before instrumentation output; its cause is unresolved. An independent installed-hash check matched and the retry passed; no result was fabricated for the failed attempt.

[Detailed results](https://recreational-instruments-paid-moses.trycloudflare.com/face-sustained-results-20260911.json) · [Evidence ZIP](https://recreational-instruments-paid-moses.trycloudflare.com/face-sustained-evidence-20260911.zip)

## Interpretation and decisions

The measured result age starts at the scheduled source-frame time and ends at delivery to the test classifier. It is not camera-to-screen latency. The 66 ms source cadence is about 15.2 frames/second; faster native inference need not increase delivered throughput when every scheduled frame is already processed.

Phone: GPU p95 age changed by +3.8% relative to CPU; preparation overlap changed p95 by +0.7% relative to serial GPU. The overlap-capable run recorded 0.0 ms of simultaneous preparation/native-call intervals across 30.24 minutes (complete coverage). These intervals do not identify GPU-kernel concurrency. The ranking is descriptive, from one sustained observation per condition.

Tablet: GPU p95 age changed by -26.8% relative to CPU; preparation overlap changed p95 by +1.3% relative to serial GPU. The overlap-capable run recorded 61.9 ms of simultaneous preparation/native-call intervals across 30.24 minutes (complete coverage). These intervals do not identify GPU-kernel concurrency. The ranking is descriptive, from one sustained observation per condition.

Keep the production CPU default. The tablet GPU result warrants a counterbalanced repeat and full-camera integration testing. The phone has no GPU p95 advantage here, although its observed GPU maximum age is lower than CPU; that tail difference needs replication before making a benefit claim. A preparation worker needs measurable overlap and a repeatable benefit before adding its scheduling and ownership complexity. A higher sampling cadence is a separate experiment and must preserve calibrated gesture behavior; it must not be changed together with the backend.

None of the completed conditions crossed the predeclared 1.10 late/early p95 degradation screen. That does not establish long-term thermal safety, energy efficiency or all-user accuracy. External device-input power measurement and longer real-app sessions are still required for energy and battery-life decisions.

## Foreground scheduling control

Phone GPU serial control (Activity present/absent/absent/present): present p95 [45.6, 44.0] ms; absent [124.0, 116.4] ms. Awake, unlocked, focus, artifact-identity and individual gesture gates: PASS.

Tablet GPU serial control (Activity present/absent/absent/present): present p95 [72.0, 72.6] ms; absent [89.0, 83.4] ms. Awake, unlocked, focus, artifact-identity and individual gesture gates: NOT USABLE. One or more control runs failed their context/gesture gate

Tablet repeat with temporary wake lock GPU serial control (Activity present/absent/absent/present): present p95 [72.9, 73.7] ms; absent [77.7, 75.7] ms. Awake, unlocked, focus, artifact-identity and individual gesture gates: NOT USABLE. One or more control runs failed their context/gesture gate

These short controls use a separate test APK. On the phone, Activity-present runs report top-app scheduling groups and Activity-absent runs report foreground groups. The result reproduces the earlier approximately 124 ms versus 44 ms discrepancy while reversing the condition order, supporting scheduling context as a major cause. It does not isolate individual governor, frequency or CPU-affinity mechanisms. This is not justification to force CPU frequencies or bypass thermal management. Future performance comparisons must use the same app-visibility context.

Both tablet batches are rejected: Activity-absent runs ended non-interactive. A leased read confirmed the unchanged 30-second screen timeout; setup plus replay exceeded it. The separate repeat tried the same temporary screen-bright wake lock in both Activity states, but the screen still slept despite the lock object reporting held. That countermeasure failed. Its specific platform-policy cause remains unresolved; the ineffective option was removed from active tooling and archived with the rejected evidence. No tablet visibility ratio is accepted or pooled into the sustained results. The phone control remains usable. No persistent display settings or permission grants changed. [Android wake-lock API](https://developer.android.com/reference/android/os/PowerManager#SCREEN_BRIGHT_WAKE_LOCK) and [test permission identity](https://developer.android.com/reference/android/app/UiAutomation) describe the attempted test mechanism.

[Foreground control details](https://recreational-instruments-paid-moses.trycloudflare.com/face-sustained-foreground-20260911.json)

## Validation, unsuccessful attempts and cleanup

The host regression suite passed 150 tests and all three instrumentation APK builds passed. Six successful short admission pilots each passed all 40 positive/negative case occurrences. Each completed sustained condition processes 27,494 scheduled frames and evaluates 1,180 individual case occurrences, expecting 236 activations. These are 10 scripted case definitions repeated 118 times, not 1,180 independent subjects or novel cases. Normal teardown verifies zero owned images; interruption injection remains untested.

The original 15-minute cooldown waits expired after the first condition on each device. The tablet also exceeded a subsequent 30-minute cooldown after CPU. All timeouts are preserved; completed conditions were never rerun or overwritten. Additional waiting kept the same temperature bands (phone 28.2–30.2 C, tablet 28.0–30.0 C). Before the final tablet continuation, a leased read verified 29.9 C, display OFF/Dozing and 0.4% aggregate CPU. The timeout is an orchestration failure, not a failed native condition or a relaxed thermal gate.

Per-run records verify unchanged application preferences and camera permission, the immutable baseline app hash, and display OFF/Dozing cleanup. Final control-driver cleanup records document display sleep before explicit device release to the collaborating task. No persistent display settings were changed.

Main sustained instrumentation source: commit 72fedee, test APK SHA-256 3329f2890a00273b5316887e91cf158e97812910db94930032ff77b0dfd51cdb. Original foreground control source: 68e2594, test APK e65bc16adce7101714bb870e14b21a4b7fc90a84a7c3b2d4e2b048bdf9168556. Separate tablet wake-lock repeat APK: bcf10a544bfe228b5f513d07be896d8e43676e2732f7bdd10eba3e5f4e49f4f9. Unchanged baseline app: ae791b04bd47747c3241ebab46db6ad3fe491cbb4fcc32ff9e94afe7b02b30e6. Run manifests retain these identities and the fixture hash; corresponding Kotlin source snapshots are in the evidence ZIP.
