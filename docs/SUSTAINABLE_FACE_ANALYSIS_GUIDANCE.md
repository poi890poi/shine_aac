# Sustainable face analysis: platform guidance and SHINE decisions

Reviewed 11 September 2026 against official Android, Arm, Qualcomm, MediaTek, MediaPipe and ML Kit documentation. Repository baseline: `2b4275b`. This is a research and benchmark-design document; it changes no application behavior and claims no new thermal or power test PASS.

## Decision

Optimize for **reliable communication throughout a session at the lowest practical energy cost**. Peak FPS is diagnostic. A candidate must preserve calibrated gestures, timely fresh observations and a responsive AAC interface after the device has warmed up.

Our existing evidence favors testing one GPU analyzer with overlapped preparation on the phone. It does not establish an energy saving. Two complete CPU/GPU analyzers nearly doubled saturated throughput but changed expression scores; their usefulness at normal cadence depends on the device and stimulus. Keep both experiments out of production defaults until sustained, calibrated app tests pass. See the [existing overlap report](reports/pre-release/face-overlap-20260911/report.md).

## What the platform guidance actually says

### Android: cooperate with the power system and measure the whole device

Android recommends proactively adjusting work using thermal information. Some implementations can remain at `THERMAL_STATUS_NONE` despite throttling, so our recorded status 0 is insufficient evidence of stability. The thermal guide recommends conservative polling no faster than once every 10 seconds on older implementations. [Android Thermal API](https://developer.android.com/games/optimize/adpf/thermal).

Despite its name, `getThermalHeadroom()` reports thermal-envelope utilization: higher is worse; 1.0 corresponds to severe throttling, and values can exceed 1.0. It is not remaining time, degrees Celsius, or a universal cross-device threshold. The current API reference discusses roughly one-second sampling, whereas the compatibility guide says ten seconds. Use one collector at a conservative ten-second interval initially, retain unsupported/NaN as unknown, and use callbacks when supported. Status listeners require API 29, headroom API 30, headroom thresholds API 35, and headroom listeners API 36. [PowerManager reference](https://developer.android.com/reference/android/os/PowerManager).

Performance hint sessions describe periodic work and its target/actual duration to Android. Power-efficiency preference is available from API 35; ordinary sessions start at API 31. These are optional, capability-dependent experiments. Measure the actual participating CPU threads before adding hints; timing only a wrapper thread waiting for native work would be misleading. Do not replace the scheduler with permanent big-core affinity or speculative boosting. [PerformanceHintManager.Session](https://developer.android.com/reference/android/os/PerformanceHintManager.Session).

Sustained Performance Mode is a distinct, optional platform feature. AOSP describes approximately 30-minute validation and a possible lower but steadier operating point. Its CTS criteria are OEM requirements, not automatic SHINE acceptance criteria. Benchmark supported sustained mode independently; the mode's name does not prove that our workload is thermally stable. [AOSP performance management](https://source.android.com/docs/core/power/performance).

Android Studio's documented ODPM rail measurements are available on Pixel 6 and later Pixel devices. They measure device subsystems rather than one app. Other devices may expose charge/current gauges. Our Samsung rigs therefore need capability checks; no assumed CPU/GPU rail watts. [Power Profiler](https://developer.android.com/studio/profile/power-profiler).

### Arm: inspect CPU execution, memory traffic and graphics competition

Arm's Streamline guidance uses per-core CPU activity, GPU activity and GPU memory bandwidth, with annotated model boundaries. It specifically discusses combined face-model and graphics workloads. Apply this to distinguish preprocessing, model execution, memory stalls and rendering contention on the Mali tablet, using only counters actually exposed by its driver. [Arm Streamline for ML](https://developer.arm.com/community/arm-community-blogs/b/ai-blog/posts/arm-streamline-for-ml-workloads).

Arm's camera examples separate optimized image processing through KleidiCV from LiteRT/XNNPACK inference through KleidiAI. This supports examining copies, conversion and inference independently. New SME2 demonstrations do not establish a speedup on our older rigs: check instruction support, runtime integration and model operators. A library upgrade is its own experiment, with accuracy and thermal validation. [Arm camera pipeline performance](https://learn.arm.com/learning-paths/mobile-graphics-and-gaming/ai-camera-pipelines/5-performances/), [KleidiAI architecture](https://github.com/ARM-software/kleidiai).

SHINE implication: test the smallest effective worker count where the runtime exposes it, avoid unnecessary allocation/copy cycles, and measure contention with camera preview, AAC rendering, speech and the mini game. CPU utilization or instruction count alone is not energy consumption.

### Qualcomm: profile host and accelerator; performance modes are not thermal guarantees

QNN HTP offers burst, sustained-high-performance, balanced and power-saver profiles. They change clock/bus votes, sleep behavior and polling. The documented sustained-high-performance mode maintains elevated votes between inferences; its name does not mean the handset can dissipate that workload indefinitely. Some high-performance profiles enable RPC polling, which is a separate resource cost. Compare balanced and power-saving profiles against a deadline before choosing a burst profile. QNN profiling separates host and accelerator timing. These options apply to a QNN experiment, not our current MediaPipe Java delegate. [QNN HTP backend](https://docs.qualcomm.com/doc/80-63442-10/topic/htp_backend.html).

Snapdragon Profiler exposes CPU/GPU/DSP, memory, power and thermal metrics where supported. Qualcomm warns that USB interferes with power measurement and recommends Wi-Fi ADB for better measurement. Keep the Wi-Fi/debugging condition identical between variants, or buffer measurements locally and retrieve them afterward. [Snapdragon Profiler support](https://www.qualcomm.com/developer/software/snapdragon-profiler/support).

The reviewed LiteRT QNN integration lists Snapdragon 8 Gen 1 and newer selected flagship SoCs. This does not establish support on every Snapdragon handset or prove that an older chip can never use another SDK path. Validate the exact SoC, OS, driver, SDK and model operators before investing in a port. [LiteRT Qualcomm integration](https://developers.google.com/edge/litert/next/qualcomm).

### MediaTek: separate low-power intent, throughput preference and actual SDK behavior

Neuron APIs distinguish low-power, fast-single-answer and sustained-speed preferences; sustained-speed means successive-frame throughput. The runtime also exposes QoS deadlines, priorities and boost hints. These represent different objectives, and maximum boost is not an appropriate default for continuous AAC input. [MediaTek API reference](https://developer.mediatek.com/AI/6423c95ac612745b3a4baa2e.html), [Neuron tooling and QoS](https://developer.mediatek.com/ai/64254ccbf55b040d6989a99a.html).

A critical version caveat: MediaTek's FAQ states that the Neuron Runtime preference field is reserved/ineffective in NP4–6 and actual operating level follows boost value. It also distinguishes runtime, middleware and driver timing. Therefore a successfully set option is not proof that a power policy took effect. Record the SDK generation and observe its consequences. This caveat concerns the specified Runtime generations; do not generalize it to all Neuron Delegate or current LiteRT APIs. [MediaTek NeuroPilot FAQ](https://developer.mediatek.com/ai/642fd80a4054c120c42632ae.html).

Current LiteRT NeuroPilot support names selected Dimensity SoCs, including 7300, 8300 and 9000–9500 variants. MediaTek's Genio profiler guidance is platform-specific and mentions restricted documentation; it does not establish retail-phone counter availability. Our current evidence does not validate a MediaTek NPU path. [LiteRT MediaTek integration](https://developers.google.com/edge/litert/next/mediatek), [MediaTek profiling guidance](https://genio-community.mediatek.com/t/how-to-monitor-npu-resource-utilization-during-inference/477/2).

### MediaPipe and LiteRT: keep state coherent and audit execution boundaries

MediaPipe VIDEO/LIVE_STREAM modes use tracking to avoid running face detection on every frame. One-face mode enables smoothing. These support keeping one coherent tracking history and correct capture timestamps. Switching to an asynchronous API by itself does not demonstrate faster inference. Our current code already requests one face, VIDEO tracking and latest-frame camera delivery. [Face Landmarker Android guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/android).

LiteRT warns that unsupported GPU operations can split execution between CPU and GPU and make synchronization expensive. The legacy GPU delegate executes floating-point work; quantized inputs/outputs can add CPU conversion each inference. Four-channel image handling can avoid some copies, but requesting CameraX RGBA is not proof of an end-to-end zero-copy camera path. Audit actual conversion, rotation, upload/readback and operator placement. GPU efficiency is workload-dependent. [GPU delegate guidance](https://developers.google.com/edge/litert/performance/gpu).

The current SHINE path copies CameraX RGBA pixels into a bitmap and transforms it before inference. Native evidence shows CPU blendshape work even with the GPU selected. Earlier ablation found removing blendshapes saved only about 5–6 ms in stable GPU comparisons and removed required gesture signals, so that shortcut remains rejected. Sources: `CameraSwitchInputAdapter.kt`, `CheekFaceAnalyzer.kt`, and the [earlier acceleration report](reports/pre-release/face-acceleration-experiment-20260911.md).

Modern LiteRT CompiledModel supports Qualcomm/MediaTek NPUs, hardware-buffer interoperability and compilation caching, with vendor runtime requirements. It is a promising separate subgraph experiment, not a drop-in NPU switch in the current MediaPipe task. Preserve preprocessing, tracking and score semantics around any migrated graph. [LiteRT NPU guide](https://developers.google.com/edge/litert/next/npu).

Do not start a new generic NNAPI migration: Android deprecated NNAPI in Android 15 and warns that future devices may largely use its CPU backend. Older NeuroPilot material built around NNAPI must be interpreted in that context. [Android NNAPI guidance](https://developer.android.com/ndk/guides/neuralnetworks).

### ML Kit: a separate blink-detector candidate, not equivalent expression output

ML Kit recommends FAST mode, only needed features, latest-frame/drop-while-busy handling, and appropriate camera formats. It advises at least 480×360 input, roughly 100×100 face pixels, and 200×200 for contours. Its classifications include eye openness and smiling, rather than MediaPipe's 52 blendshapes. [ML Kit face detection](https://developers.google.com/ml-kit/vision/face-detection/android).

For SHINE, a minimal ML Kit blink path could be studied separately. Its resolution recommendation means our measured 320×240 camera input is not an unchanged comparison. Keep the repository's whole-face framing with margin; do not fill the frame to imitate a generic sample. Eye-open scores require new calibration/quality validation and cannot reuse MediaPipe thresholds by assumption. It does not replace the current cheek signal.

## Sustainable benchmark protocol

The following is our proposed engineering protocol, not a vendor performance claim or an already implemented test gate.

### Workloads and experimental order

1. Measure the current CPU-default application as the real baseline. Include camera, preview, scanning, intermittent speech and realistic interaction. Use public licensed optical stimuli and established framing; no private captures.
2. Compare CPU against one GPU analyzer at unchanged 100 ms blink and 66 ms cheek cadence. Keep idle behavior separate. This tests backend choice alone.
3. Compare serial GPU preparation against bounded preparation overlap at 66 ms. This tests scheduling alone. Keep one tracking history and one native invocation per worker in flight.
4. Reserve dual analyzers, thread-count changes, power hints, sustained mode, model/runtime upgrades and NPU ports for separate comparisons. Advance candidates through a short correctness screen before spending a full thermal run on them.

Run each screened condition for at least 30 uninterrupted minutes, with cold-start evidence separate from steady operation. Extend a surviving candidate to 60 minutes if thermal/performance trends are still changing or for a representative long-session release check. Counterbalance A/B order across independent sessions; restore comparable initial temperature and battery state between runs. Cooldown is for between-run comparability, not a substitute for continuous load within a run.

Record device/SoC/OS/driver, APK/model hashes, backend, cadence, display brightness/refresh, ambient temperature, case and mounting, battery state, charging state, network state and profiling overhead. Battery-powered use and charging use are separate scenarios; charging may be common for a mounted AAC tablet. Do not fake unplugging through battery-service overrides. Preserve settings and the shared lease/display-OFF cleanup contract.

Use normal OS governors and thermal protections for sustainability comparisons. Fixed-performance mode may help a separate diagnostic microbenchmark, but does not represent ordinary battery/thermal behavior. Reject the candidate if it only wins by suppressing realistic power management.

### Measurements and interpretation

| Dimension | Retained evidence | Decision use |
|---|---|---|
| Communication reliability | Identified intended gestures, actual activations, misses, false/duplicate activations, face/quality loss and recovery | Hard prerequisite; no speed/energy trade for incorrect communication |
| Responsiveness | Capture-to-result and independently observed activation-to-feedback p50/p95/p99; native/preparation times; UI jank | Compare early and late windows; separate intentional hold duration from processing delay |
| Freshness | Fresh accepted rate, age, gaps, dropped raw/prepared frames, stale result discards | Extra computed frames count only if fresh and usable |
| Thermal behavior | Status events, supported current/forecast headroom, named sensor readings, frequency trends; time to degradation and recovery | Status 0 is not a PASS; battery temperature is not skin/SoC temperature |
| Energy | Total device Wh/session and mean W; incremental cost versus a matched no-inference control; measurement coverage | CPU time and battery percentage alone do not establish energy savings |
| Resource use | Per-core CPU, GPU/accelerator and memory bandwidth where available; RSS, allocation/GC, startup/teardown | Detect contention, leaks, retained second-model cost and profiler disturbance |

Compute energy from a supported energy counter or calibrated power integration. A charge counter plus voltage can provide a labeled estimate. Unsupported counters and missing sensor access remain missing; report uncertainty instead of invented precision. For serious cross-backend energy claims, prefer a validated external power setup or supported rail instrumentation. A USB input meter measures power entering the device, not isolated inference power or battery discharge.

Use equal-duration sessions as the primary energy comparison: AAC spends much of its time waiting for a gesture. Also report energy per fresh usable observation and per independently confirmed activation on the same scripted workload. These secondary denominators must not hide idle waste, misses or extra activations.

Compare rolling one-minute metrics, plus matched stimulus segments in early and final five-minute windows. Frequency reduction alone does not prove thermal throttling; correlate it with workload, sensors and late-session degradation. A still-rising temperature or worsening late performance means equilibrium was not demonstrated, even if no severe status occurred.

### Candidate admission and thermal adaptation

Require repeatable improvement beyond measurement noise in energy or late-session responsiveness, with no missed/false/duplicate activation regression, no worsening of the other objective beyond the predeclared tolerance, and no extra thermal instability. Set numerical tolerances before the sustained comparison, using instrument precision and the baseline's repeat variability. Retain trade-offs explicitly rather than collapsing everything into one FPS score.

If thermal adaptation is later implemented, first remove unnecessary diagnostic work and reduce decorative rendering work while retaining the approved art, readable layout and communication feedback. Lowering camera FPS, resolution, active sampling cadence or changing backend/model can alter calibrated behavior and must be validated separately. Never silently change hold thresholds or interpret missing observations as successful gestures. If an active hold cannot retain its required evidence, follow a tested conservative cancellation/recovery rule.

Use hysteresis and a cooldown dwell for recovery so settings do not oscillate. Preserve one stable backend during an active gesture. The policy should acknowledge unavailable thermal telemetry and prioritize usable communication over maintaining decorative animation rate. This is a proposed design; it has not been installed on either device.

## Recommended next work

| Priority | Experiment | Why this comes next |
|---|---|---|
| 1 | Add sustained telemetry and capability reporting to the app benchmark harness | Current short-run status snapshots cannot answer the thermal/energy question |
| 2 | Run CPU versus GPU, then the phone's preparation-overlap comparison, with unchanged semantics | Strongest existing evidence and smallest implementation scope |
| 3 | Reduce verified camera/preprocessing copies and unnecessary allocation; measure runtime thread count where configurable | Can remove work rather than keep more hardware busy |
| 4 | Evaluate supported Android efficiency hints and sustained mode individually | Potential scheduling benefit without replacing the model |
| 5 | Profile/port a supported model subgraph to Qualcomm or MediaTek NPU on a named compatible device | Potentially larger efficiency opportunity, with substantial integration and validation cost |
| 6 | Study minimal ML Kit blink detection or a smaller purpose-built model | Separate detector/calibration change; cheek support remains unresolved |

No device was woken for this study. No new SDK was installed, private data uploaded, runtime altered or thermal benchmark claimed. Vendor documents describe possibilities; only measured performance, energy and gesture correctness on our target devices can choose the production path.
