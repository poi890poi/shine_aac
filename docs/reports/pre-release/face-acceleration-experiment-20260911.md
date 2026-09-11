# Face-analysis acceleration experiment — 11 September 2026

GPU acceleration works, but it does not solve the latency problem. On the tablet's physical camera pipeline, average analysis time fell from 64.13 to 59.36 ms (7.4%). Fixed-frame replay improved by 8.5% on the tablet and 16.8% on the phone. The proposed p95 target below 33 ms was not met. Keep GPU as an opt-in debug experiment; ordinary debug and release builds remain CPU with profiling disabled.

## Contract and impact

Type: performance experiment, native-resource lifecycle refactor, and benchmark tooling. Parent application revision: `bc11c58ba090097a0a3b724002357a51d3cc8875`. The former tablet report measured 63.02 ms mean and 90.858 ms maximum; it did not collect a per-frame p95.

The experiment preserves the model, VIDEO tracking, one face, 0.55 confidence thresholds, blendshapes, camera geometry/mirroring, calibration, gesture classifiers, sampling cadence (100 ms blink / 66 ms cheek / 200 ms idle), latest-frame policy, stored preferences, AAC interaction and artwork. No layout or visual design changes were made.

The shared analyzer now creates, invokes and closes its native task on one dedicated owner thread. Interrupted callers wait for accepted native work to finish before releasing image memory, then recover their interrupt flag. Debug metadata selects CPU/GPU and stage profiling. GPU initialization failure logs its cause and explicitly falls back to CPU. Runtime inference failures do not automatically switch backend. No GPU fallback occurred in the measured runs.

Risks include GPU context ownership, teardown during inference, device-specific driver behavior, startup delay, score differences near gesture thresholds and competition with rendering. These prevent promoting GPU based on speed alone. A GPU request in release packaging was verified to remain CPU with profiling disabled.

## Methods and evidence boundaries

Physical optical sequence: Samsung SM-X200 tablet as camera device, Samsung SM-G781B phone as stimulus presenter, CPU/GPU/GPU/CPU order. Nine existing focused public-stimulus cases per run, including five positive sequences and four negative controls. These are fresh physical captures of established test cases, not a new participant or cheek-gesture holdout. Several positive fixtures hold a closed-eye pose until activation within a generous timeout; their PASS does not establish normal-use response timing. Negative controls use fixed durations.

Fixed-frame sequence: both devices separately, 30 warmup frames followed by 145 measured frames per run, CPU/GPU/GPU/CPU order. All four public sources declared in `testdata/optical-rig/sources.json` (blinking, smiling, surprised, frowning) were checksum-verified and decoded at 10 fps into 480 × 360 letterboxed images. The manifest retains source page, author, license and source checksum; each generated frame has SHA-256 identity. No private captures or user uploads were used. These four clips provide a narrow public-actor sample, not a population-level validation dataset. Input images, model and state progression are identical across delegates. Installed APK hashes were checked, and every non-signature/non-manifest APK entry was byte-identical between CPU and GPU artifacts.

The optical metric covers the whole analysis callback, including preprocessing, model work, result processing and gesture dispatch scheduling. It excludes capture and final UI rendering. Frame age is measured at callback completion, not end-to-end activation latency. The fixed-frame metric covers bitmap-to-observation and excludes fixture decoding/copy, camera acquisition and camera orientation. Its absolute timings must not be mixed with optical or direct-task ablation timings.

Report statistics use individual retained samples, deduplicate overlapping epoch-stamped case logs, and use nearest-rank p95. Runtime counters print the requested 480 × 360 size; the new stage telemetry revealed the actual camera images were 320 × 240. GPU logs identify Mali-G52 on the tablet and Adreno 650 on the phone. All fixed-replay thermal snapshots before/after runs reported Android thermal status 0; no energy or long-duration thermal measurement was made.

## Physical tablet camera results

| Run | Frames | Mean ms | Median ms | p95 ms | Max ms | Frame-age p95 ms |
|---|---:|---:|---:|---:|---:|---:|
| CPU 015532 | 901 | 63.37 | 62.42 | 76.81 | 96.28 | 104 |
| GPU 020150 | 900 | 59.45 | 59.18 | 67.64 | 79.77 | 101 |
| GPU 020700 | 901 | 59.27 | 58.99 | 67.71 | 75.67 | 102 |
| CPU 021207 | 901 | 64.90 | 64.31 | 77.75 | 106.35 | 107 |

All 36 focused optical case checks passed: each run observed the expected six activations across five positive sequences and none across four negative controls. This is a scoped activation result, not a full release or real-user accuracy claim. CPU run 4 also recorded a nonblocking P2 timing finding: its legacy timing window exceeded 100 ms (101.0 ms); the new retained whole-block maximum was 106.35 ms. The latency finding remains open.

GPU runs retained 900 and 901 fresh usable observations; CPU's second run retained 901. There were no absent/unusable/error observations in those retained stage logs. CPU's first run omitted stage records from the log filter, so its observation counts and decomposition are unavailable, not zero. Its 901 block samples remain valid. This dataset does not meaningfully exercise tracking loss, so loss/recovery episode statistics cannot establish robustness.

Mean stage costs, in milliseconds:

| Run | Copy | Rotate/mirror | Wrap | Native call + owner handoff | Result/cleanup |
|---|---:|---:|---:|---:|---:|
| GPU 020150 | 0.54 | 2.21 | 0.20 | 53.07 | 2.83 |
| GPU 020700 | 0.55 | 2.25 | 0.20 | 52.78 | 2.90 |
| CPU 021207 | 0.52 | 1.89 | 0.18 | 59.14 | 2.65 |

Copy plus orientation costs only about 2–3 ms. Even completely removing it cannot close a roughly 26 ms gap to a 33 ms analysis target. The native-call measurement includes MediaPipe preprocessing and result delivery; it does not isolate accelerator kernels. Do not infer a particular submodel bottleneck from this aggregate.

## Fixed-frame results on both devices

| Device | Run | Mean ms | Median ms | p95 ms | Max ms | Init ms |
|---|---|---:|---:|---:|---:|---:|
| SM-G781B phone | cpu-1 | 64.60 | 65.76 | 83.14 | 86.05 | 166 |
| SM-G781B phone | gpu-2 | 54.45 | 54.17 | 69.13 | 71.42 | 970 |
| SM-G781B phone | gpu-3 | 54.08 | 53.87 | 69.53 | 76.10 | 992 |
| SM-G781B phone | cpu-4 | 65.79 | 65.79 | 81.22 | 85.97 | 200 |
| SM-X200 tablet | cpu-1 | 64.17 | 63.10 | 78.64 | 96.05 | 336 |
| SM-X200 tablet | gpu-2 | 59.14 | 58.76 | 64.01 | 69.24 | 494 |
| SM-X200 tablet | gpu-3 | 58.77 | 59.02 | 62.53 | 72.84 | 453 |
| SM-X200 tablet | cpu-4 | 64.69 | 63.58 | 78.52 | 87.74 | 273 |

Every run returned 145/145 present and usable faces. There were no CPU/GPU presence or usability disagreements. CPU repeats had identical expression scores; the two GPU repeats were also identical within each device. Against CPU, absolute expression-score differences were: phone mean 0.00156 / p95 0.00825 / max 0.03328, tablet mean 0.00070 / p95 0.00349 / max 0.02967. Numerical agreement is not independent accuracy; small score changes can matter near a calibrated threshold. Continuous landmark/jump error was not scored against an independent reference.

Phone GPU initialization took about 970–992 ms versus CPU 166–200 ms. Tablet GPU startup was 453–494 ms versus CPU 273–336 ms. This startup tradeoff is material for camera setup and lifecycle transitions.

## Expression-model diagnostic and negative results

A separate direct-FaceLandmarker ABBA diagnostic kept prebuilt MPImages valid and compared full outputs against landmarks only. It uses a different timing boundary from the app-wrapper benchmark; subtracting their absolute values would not establish wrapper overhead.

| Device/backend | Full first mean ms | Landmarks only means ms | Full last mean ms |
|---|---:|---:|---:|
| Phone CPU | 57.53 | 46.61 / 46.44 | 52.89 |
| Phone GPU | 39.45 | 33.87 / 33.48 | 39.14 |
| Tablet CPU | 57.46 | 53.23 / 56.01 | 66.85 |
| Tablet GPU | 58.43 | 53.03 / 52.81 | 57.95 |

All eight ablation runs on each device retained all 145 faces. Stable GPU anchors indicate expression scoring contributes about 5–6 ms, rather than dominating the residual cost. The tablet CPU anchors drifted from 57.46 to 66.85 ms; its exact CPU ablation cost is inconclusive. Removing expression output would break both current input methods and is rejected as an app optimization.

An initial fixed-image harness run crashed because MPImage.close() recycled a fixture bitmap that the harness attempted to reuse. Inspection of the shipped BitmapImageContainer bytecode confirmed ownership. The corrected test creates a fresh owned bitmap outside the timer for each sample and asserts the fixture remains intact. The failed run is retained under `replay-RFCR91GWXLX` and contributes no performance samples; all accepted runs are under `replay-v2-*`.


Public stimuli: [blinking](https://commons.wikimedia.org/wiki/File:20140529_-_Blinking.webm), [smiling](https://commons.wikimedia.org/wiki/File:20140529_-_Smiling.webm), [surprised](https://commons.wikimedia.org/wiki/File:20140529_-_Surprised.webm), [frowning](https://commons.wikimedia.org/wiki/File:20140529_-_Frowning.webm). All four are by Clément Bucco-Lechat, CC BY-SA 3.0. Source SHA-1 values are retained in the repository manifest and downloadable results; generated frames were resized and letterboxed for this experiment.

## Decisions and next experiments

- Land dedicated native ownership, interruption/close regression tests, debug-only backend selection and opt-in telemetry. These make future comparisons reproducible without changing activation rules.
- Retain GPU as experimental. Its measured speedup is real but modest, startup is slower, and subtle-gesture/device/rendering coverage is insufficient for a default switch.
- Defer camera-copy removal. Its measured upper bound is only a few milliseconds; the earlier direct-MPImage branch `f65d963` remains unmerged.
- Defer faster sampling. It changes workload and temporal behavior without reducing inference cost. Evaluate it independently only after model cost is reduced.
- Reject disabling blendshapes for the current app. It removes required signals and still leaves tablet GPU inference around 53 ms in the diagnostic.
- Next useful investigation: model/operator profiling followed by a smaller landmark/gesture pipeline or supported vendor acceleration, one change at a time. A replacement must preserve sensitivity to weak gestures on independent licensed stimuli and fresh user-approved validation. No speedup from these untested options is claimed.

Google's [GPU delegate guide](https://developers.google.com/edge/litert/android/gpu) requires creation and invocation on the same thread. The [Face Landmarker Android guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/android) documents the task's delegate/configuration path. Upstream [face blendshape graph](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/face_landmarker/face_blendshapes_graph.cc) explains the separate expression graph; actual device logs, rather than upstream assumptions, establish the delegated detector/landmark nodes and CPU XNNPACK expression work in these experiments. SurfaceFlinger composes display buffers; it does not accelerate this neural-network inference task.

## Verification and cleanup

- 124 native unit tests passed (51 Android inputs, 60 optical core, 13 app); 133 host tests passed. Debug CPU/GPU/default builds, final benchmark test build and release manifest gate passed.
- `device-test.bat` acceptance: tablet `device-20260911-023754` and phone permission recheck `device-20260911-025201` each passed 52 checks with zero findings. These include five camera return cycles, interruption, screen-off, process recreation and large-font access.
- Native Settings audits each passed 20 checks: phone `native-config-20260911-023215`, tablet `native-config-20260911-024509`, on the same CPU-default preview artifact. The later duplicate phone audit `native-config-20260911-025855` was interrupted by the host failure; it is not counted as a PASS.
- The first phone acceptance run `device-20260911-022803` encountered Android's ungranted-camera permission dialog. The saved screenshot proves Camera Setup opened behind the prompt; those launch findings do not establish a native-task crash. The recheck temporarily granted permission and passed. Original permission and flags were restored during recovery.
- Both opt-in benchmark classes were skipped when included together in a general instrumentation selection: two assumption skips verified in `benchmark-opt-in-guard.log`. This prevents accidental benchmark execution in the ordinary suite.
- Completed experiment batches verified both displays OFF. The host interruption stopped the last audit and delayed its cleanup. On recovery, the existing ADB identity was reloaded (no key replacement), the app was force-stopped, and the test-generated camera preference file was backed up and removed because it did not exist before testing. AAC/camera preferences on both devices then matched the private pre-test snapshots exactly.
- Final recovered power states: tablet `mScreenState=OFF`; phone non-interactive/Dozing with `mScreenState=DOZE_SUSPEND`, preserving its existing always-on-display preference. Do not describe the latter as a fully powered-off panel. The device lease was held through recovery/readback, then the peer received explicit phone release. No persistent display setting was changed.

Native unit coverage includes common-owner creation/inference/close, idempotent close, use-after-close rejection, retained ownership under caller interruption, accepted-work draining and original initialization failure propagation. The host parser regression checks sample p95, overlapping log deduplication unavailable stage data, and display cleanup despite a failed force-stop. Benchmark tests require explicit class selection and do not run accidentally in the ordinary instrumentation suite.

Required full optical normal-use timing, the existing long-text accessibility finding, and cheek fixture geometry limitations from the prior pre-release review remain unresolved. This experiment does not clear those gates and is not a release. No release version/tag or user-visible design was changed.

## Reproduction and artifact identity

Run every device command inside `Invoke-AndroidDeviceLease` after requesting and receiving the shared-device window, holding the lease through restoration and verified display OFF. Use the interactive-desktop permission required by the optical rig.

Build CPU and GPU preview artifacts separately with `:app:assembleDebug -PshineAacTabletPreview=true -PshineFaceProfiling=true -PshineFaceDelegate=cpu` (then `gpu`), preserving each APK before the next build. Build tests with `:app:assembleDebugAndroidTest -PshineAacTabletPreview=true`. Ordinary preview defaults use only `-PshineAacTabletPreview=true`.

Prepare public fixtures with `python scripts/face-analysis-benchmark.py prepare --output .tmp/face-acceleration-research/public-face-benchmark`. Run `scripts/face-analysis-benchmark.py run` with `--serial`, `--frames`, `--cpu-apk`, `--gpu-apk`, `--test-apk`, and `--output`. The runner verifies source/frame and installed APK hashes, thermal state and actual backend before accepting results. For the expression diagnostic, explicitly select `org.shineaac.app.FaceSubgraphBenchmarkTest` via `am instrument -w -r -e class` with the same fixtures installed.

Use `scripts/report-face-analysis-benchmark.py` with repeated `--optical` and `--replay` directories and `--output` to regenerate aggregate JSON. Physical lifecycle gate: `device-test.bat --no-build --no-install --apk <default-preview-apk>` with the package/serial environment set. The optical ABBA runs use `optical-rig-test.bat --runtime-only --no-build --no-install --presenter-mode android --dut-serial <tablet> --presenter-serial <phone>` with repeated `--case` arguments: `blink_natural_1x`, `blink_short_control`, `blink_long_positive_01`, `blink_long_positive_02`, `blink_slow_continuous_02`, `blink_long_positive_03`, `blink_two_gestures_recovery`, `smile_negative`, `surprise_negative`. Use the calibrated, verified public rig-session fixture and the package environment matching the installed preview.

Evidence root (internal): `.tmp/face-acceleration-research/`; optical folders are `test-results/optical-20260911-015532`, `020150`, `020700`, `021207` with the full date prefix on each. Raw evidence is retained locally, not published with private settings or camera captures. The downloadable aggregate contains public-frame model results and timing summaries only.

| Artifact | SHA-256 |
|---|---|
| Profiled CPU APK | `ecd89c774a50aa583f7cf234ed897d1e7e9f7a89467dec631b2656b3c15336d0` |
| Profiled GPU APK | `785f9dd93e218f377db8b85a71370b87a37ccd45ace2ab2e272846bcab6a02f9` |
| Default CPU preview APK | `ae791b04bd47747c3241ebab46db6ad3fe491cbb4fcc32ff9e94afe7b02b30e6` |
| Measured instrumentation APK | `6479ded569a941185f42c3921f579ef56e219b12f2c7d9c39e5948300612d013` |
| Public frame manifest | `d4d340b0fe88930e1f10dc703c4bdd2a7d85caaed75878debb863f21155f2c63` |
