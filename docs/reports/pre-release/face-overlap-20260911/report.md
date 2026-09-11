# CPU/GPU overlap review — 11 September 2026

**Decision: retain both mechanisms as test-only experiments.** Overlapping CPU image preparation with one GPU analyzer is the smaller, promising candidate for the phone's 66 ms path. Concurrent complete CPU/GPU analyzers roughly double saturated fresh throughput, but add little throughput at normal sampling intervals and mix separate tracking histories. Neither has enough evidence for a production default change.

**Subsequent evidence:** the [30-minute screen and foreground scheduling control](../face-sustained-20260911/report.md) supersedes the phone preparation-overlap priority above. This earlier benchmark did not launch a foreground Activity. The later ABBA visibility control reproduced much slower phone GPU timings without an Activity, while the visible-app sustained phone run recorded no preparation/native-call overlap and no p95 advantage from the worker. Preserve these earlier measurements as results of their original scheduling context, not as visible-app performance estimates. Production defaults remain unchanged.

## Contract and impact

Type: benchmark tooling and performance investigation. Parent revision `ba0536673abce9ebc0f75557526d9367c10909e9`. The installed app remains the prior CPU-default APK (SHA-256 `ae791b04bd47747c3241ebab46db6ad3fe491cbb4fcc32ff9e94afe7b02b30e6`). Only the instrumentation APK was installed. There are no changes to runtime camera code, model, calibration, thresholds, sampling defaults, user settings, artwork, or AAC behavior. This is not a release or a claim of faster deployed app behavior.

Compare serial preparation + GPU inference with: (1) CPU preparation of the next frame overlapping GPU inference; (2) two complete independent analyzers, one CPU and one GPU. The second comparison keeps both models resident and warmed in baseline and candidate; baseline uses only GPU. Compare within each ABBA batch, not across differently warmed/resident baselines. The dual variant has serial preparation, isolating it from the preparation candidate.

GPU resources are created, invoked and closed on dedicated owner threads. Buffers survive accepted inference; normal teardown drains workers. One latest raw slot and, for preparation mode, one latest prepared slot bound work. Native work has no additional queue. Outputs are accepted only in increasing input order. Native exceptions fail the benchmark instead of silently changing backend. Native logs identify Mali-G52 on Samsung SM-X200 and Adreno 650 on SM-G781B; the dual graph also initializes the CPU XNNPACK delegate. Native call overlap proves concurrent calls, not a measurement of GPU kernel occupancy.

## Method and evidence boundaries

Each comparison uses serial/candidate/candidate/serial order, 30 warmup frames per resident worker, then 145 immutable public frames. Actual prior camera geometry was 320×240, used for primary results. 480×360 is a separate sensitivity experiment. Fixtures are decoded and resized before timing. Timed preparation copies raw pixels and applies inverse-source orientation/mirroring back to the reference; every ARGB pixel is checked before timing.

At 66 and 100 ms, a synthetic producer records intended capture deadlines, actual arrival and all preparation/inference/completion/delivery times. Stale raw/prepared work may be replaced. At period 0 the synthetic producer backpressures to process every frame: those ages include source backpressure and **are not camera latency**. VIDEO timestamps follow capture time in corrected paced runs. Earlier 66 ms source-clock runs are retained only as auxiliary evidence; primary 66 ms comparisons were repeated with corrected clocks. All statistics use retained samples and nearest-rank p95; tables average the two run-level p95 values, not a pooled p95.

The measured native interval includes the complete synchronous task call, including internal CPU work. Result age ends at benchmark consumer delivery; it excludes real camera acquisition and UI rendering. CPU time sums all process threads and is not battery energy. Prerecorded input memory is retained (about 44 MB for 145 320×240 RGBA frames), so benchmark fixture memory is not a production memory estimate. Normal lifetime/bounds assertions passed; cancellation injection and sustained thermal/rendering-contention tests were not run. No claimed long-duration stability or hardware-kernel utilization measurement.

## Camera-sized paced comparisons

| Device / input | Mode | Fresh results/s | Mean of run p95 age (ms) | CPU ms/fresh result | Accepted per run | Late per run |
|---|---|---:|---:|---:|---|---|
| tablet-prepared-clock-66 | serial | 15.15 | 70.1 | 78.6 | 145/145 | 0/0 |
| tablet-prepared-clock-66 | prepared | 15.16 | 69.2 | 79.3 | 145/145 | 0/0 |
| tablet-prepared-320-100 | serial | 10.02 | 71.0 | 82.2 | 145/145 | 0/0 |
| tablet-prepared-320-100 | prepared | 10.02 | 71.2 | 83.2 | 145/145 | 0/0 |
| tablet-dual-clock-66 | serial | 15.16 | 69.1 | 77.8 | 145/145 | 0/0 |
| tablet-dual-clock-66 | dual | 15.16 | 73.1 | 78.5 | 145/145 | 0/0 |
| tablet-dual-clock-100 | serial | 10.03 | 69.8 | 81.7 | 145/145 | 0/0 |
| tablet-dual-clock-100 | dual | 10.02 | 70.4 | 81.7 | 145/145 | 0/0 |
| phone-prepared-clock-66 | serial | 14.70 | 128.0 | 79.4 | 141/140 | 0/0 |
| phone-prepared-clock-66 | prepared | 15.18 | 76.8 | 77.5 | 145/145 | 0/0 |
| phone-prepared-320-100 | serial | 10.03 | 78.4 | 78.4 | 145/145 | 0/0 |
| phone-prepared-320-100 | prepared | 10.03 | 80.2 | 79.5 | 145/145 | 0/0 |
| phone-dual-clock-66 | serial | 15.01 | 114.9 | 74.8 | 144/143 | 0/0 |
| phone-dual-clock-66 | dual | 15.17 | 81.5 | 75.2 | 145/145 | 0/0 |
| phone-dual-clock-100 | serial | 10.03 | 74.2 | 75.3 | 145/145 | 0/0 |
| phone-dual-clock-100 | dual | 10.03 | 75.6 | 75.3 | 145/145 | 0/0 |

At 66 ms, preparation overlap improved the phone's repeat p95 result age and avoided baseline drops. Tablet results were essentially tied. At 100 ms, both devices already consumed all frames; overlap did not improve fresh output rate. Dual analyzers likewise helped phone queueing at 66 ms but had no repeatable tablet advantage. The CPU analyzer remained idle where GPU finished before each next capture.

## Saturated comparison — not a proposed cadence change

| Device / input | Mode | Fresh results/s | Mean of run p95 age (ms) | CPU ms/fresh result | Accepted per run | Late per run |
|---|---|---:|---:|---:|---|---|
| tablet-prepared-320-0 | serial | 15.99 | 132.6 | 77.1 | 145/145 | 0/0 |
| tablet-prepared-320-0 | prepared | 17.15 | 182.6 | 77.3 | 145/145 | 0/0 |
| tablet-dual-clock-0 | serial | 15.97 | 132.1 | 76.5 | 145/145 | 0/0 |
| tablet-dual-clock-0 | dual | 31.31 | 119.9 | 76.3 | 143/144 | 2/1 |
| phone-prepared-320-0 | serial | 16.54 | 147.1 | 74.1 | 145/145 | 0/0 |
| phone-prepared-320-0 | prepared | 18.71 | 194.4 | 73.0 | 145/145 | 0/0 |
| phone-dual-clock-0 | serial | 17.70 | 146.7 | 69.5 | 145/145 | 0/0 |
| phone-dual-clock-0 | dual | 33.93 | 107.0 | 66.2 | 135/129 | 10/16 |

Maximum fresh throughput rose from about 16 to 31 results/s on tablet and 18 to 34 on phone with dual analyzers. Late outputs were explicitly discarded; raw throughput would overstate useful throughput. Process CPU consumption per second rises with increased output rate even where CPU time per result is similar or lower. This does not establish lower single-frame or gesture latency.

## Timed public blink holdout

After defining the scheduling candidates, a fresh timing sequence was generated from the existing public sources: open rests, one 300 ms closure, two 1600 ms closures, and smiling/surprised/frowning negative controls. Source poses are fixed in the generator; no classifier thresholds were tuned on candidate output. The sequence contains 233 frames at 66 ms or 149 at 100 ms (duration rounding is recorded in its manifest).

The existing default BlinkGestureClassifier consumes only accepted observations with a 1000 ms hold and null observations at missing frame indices. Expected result: exactly two activations, one in each long hold, zero in all other cases. This is a new timing sequence, **not a new participant or independent facial dataset**. No personal calibration, app geometry quality gate, watchdog, UI, cheek-gesture validation or physical optical path is exercised.

| Device / candidate / cadence | Runs | Expected / observed activations | Delivery from closure onset (ms) |
|---|---:|---|---|
| tablet-prepared-timed-66 | 4 | 2 each / 2/2/2/2 | 1117–1121 |
| tablet-prepared-timed-100 | 4 | 2 each / 2/2/2/2 | 1062–1074 |
| tablet-dual-timed-66 | 4 | 2 each / 2/2/2/2 | 1117–1122 |
| phone-prepared-timed-66 | 4 | 2 each / 2/2/2/2 | 1109–1205 |
| phone-prepared-timed-100 | 4 | 2 each / 2/2/2/2 | 1063–1078 |
| phone-dual-timed-66 | 4 | 2 each / 2/2/2/2 | 1112–1179 |

Timed-sequence latency and input accounting:

| Device / input | Mode | Fresh results/s | Mean of run p95 age (ms) | CPU ms/fresh result | Accepted per run | Late per run |
|---|---|---:|---:|---:|---|---|
| tablet-prepared-timed-66 | serial | 15.14 | 69.1 | 77.7 | 233/233 | 0/0 |
| tablet-prepared-timed-66 | prepared | 15.15 | 69.6 | 78.9 | 233/233 | 0/0 |
| tablet-prepared-timed-100 | serial | 10.03 | 70.7 | 82.2 | 149/149 | 0/0 |
| tablet-prepared-timed-100 | prepared | 10.02 | 74.1 | 83.5 | 149/149 | 0/0 |
| tablet-dual-timed-66 | serial | 14.95 | 113.7 | 79.9 | 231/230 | 0/0 |
| tablet-dual-timed-66 | dual | 15.14 | 79.7 | 80.6 | 233/233 | 0/0 |
| phone-prepared-timed-66 | serial | 14.97 | 123.4 | 74.5 | 229/231 | 0/0 |
| phone-prepared-timed-66 | prepared | 15.16 | 74.9 | 74.3 | 233/233 | 0/0 |
| phone-prepared-timed-100 | serial | 10.03 | 78.2 | 77.8 | 149/149 | 0/0 |
| phone-prepared-timed-100 | prepared | 10.03 | 78.0 | 78.8 | 149/149 | 0/0 |
| phone-dual-timed-66 | serial | 15.03 | 115.9 | 73.1 | 231/231 | 0/0 |
| phone-dual-timed-66 | dual | 15.17 | 77.5 | 73.3 | 233/233 | 0/0 |


The timed tablet dual comparison improved p95 result age from 113.7 to 79.7 ms, unlike the essentially tied natural-sequence comparison. Its blink activation delivery remained about 1117–1122 ms across all four runs. This is evidence of workload-dependent queueing relief, not a uniform tablet or activation-latency improvement. Two repeats per condition and short sequences do not establish sustained behavior.

Full per-case counts and activation delivery times are in results.json. All shared-input face-presence comparisons matched. Dual-worker expression-score differences reached 0.317 on the tablet and 0.306 on the phone in saturated runs (scores range 0–1); timed-run maxima were 0.162 and 0.131. Those maxima are over all 52 expressions, not only blink scores. Agreement of scores/landmarks is reported only on shared input IDs; it is not accuracy. Dual analyzers process different frame subsequences with independent VIDEO histories. Their score differences combine backend and history effects and cannot establish calibrated gesture equivalence.

Measured CPU/GPU native-call overlap was about 3.26–3.27 seconds per saturated tablet run and 2.85–2.87 seconds per saturated phone run. At 100 ms it was zero on both devices. These are host task-call intervals; GPU-enabled tasks themselves also use CPU blendshape processing, and this is not a GPU-kernel occupancy measurement.

## Negative findings and decisions

- Initial pixel verification failed because Bitmap.sameAs compared differing alpha metadata even though every ARGB pixel matched. The gate now compares exact ARGB arrays; the original failed attempt is retained and excluded from timing claims.
- Earlier paced 66 ms runs used 100 ms native timestamps. They were superseded, not silently pooled into corrected results.
- Preparation overlap: retain for a targeted phone 66 ms runtime experiment. No general tablet/100 ms benefit established. Saturated throughput gains alone are insufficient for promotion.
- Dual CPU/GPU: retain for throughput research. Normal-cadence gains do not currently justify the extra model, ownership and tracking-state complexity. Do not promote without calibrated cheek/blink and optical activation evidence, rendering contention, lifecycle interruption and sustained resource tests.
- Sampling faster than 66 ms is a separate behavior/resource experiment; no sampling default changed here. Models or thresholds were not retuned.

## Verification, provenance and reproduction

Instrumentation builds successfully; all 140 host regression tests pass. Benchmark tooling is committed as `ced75d2`. There are 72 primary runs plus 16 retained auxiliary runs; all 24 timed runs passed the expected total and per-case activations. Completed thermal snapshots reported Android status 0. Every completed device run checks immutable inputs, normal image lifetime/bounds, accepted-order and drop conservation. This is physical-device instrumentation evidence, not a new device-test.bat or optical-rig-test.bat app release PASS. Those gates are required before promoting a runtime change.

All stimuli derive exclusively from the four publicly licensed sources in testdata/optical-rig/sources.json; source SHA-1 and frame SHA-256 are checked. Author: Clément Bucco-Lechat; license: CC BY-SA 3.0. No private captures or user uploads were used. Sources: [Blinking](https://commons.wikimedia.org/wiki/File:20140529_-_Blinking.webm), [Smiling](https://commons.wikimedia.org/wiki/File:20140529_-_Smiling.webm), [Surprised](https://commons.wikimedia.org/wiki/File:20140529_-_Surprised.webm), [Frowning](https://commons.wikimedia.org/wiki/File:20140529_-_Frowning.webm).

Test APK SHA-256: `2d2bc76cb8422548b1f504affe0f2443802bee38dee0114a9ce2983a2aff724f`. Code: FaceOverlapBenchmarkTest.kt, scripts/face-overlap-benchmark.py, scripts/report-face-overlap-benchmark.py, scripts/prepare-face-overlap-stimuli.py. Generate the natural fixed fixtures with `python scripts/face-analysis-benchmark.py prepare --output <new directory>` and timed fixtures with `python scripts/prepare-face-overlap-stimuli.py --period-ms 66 --output <new directory>` (or 100). Run the host runner only within an acknowledged Invoke-AndroidDeviceLease window. Select --candidate prepared or dual, --frame-width 320, --period-ms 0/66/100, the verified frames/app/test APKs and a new output directory. Timed fixtures must use their declared cadence. The test opts in only through its explicit instrumentation class.

Raw benchmark output and native/thermal/cleanup logs remain under the internal workspace .tmp/face-overlap-research/<batch>. The public evidence ZIP includes only selected benchmark outputs and verified manifests; private preference snapshots are excluded. evidence-sha256.json identifies retained files. All device batches verified unchanged app preferences and camera permission. Test displays were put to sleep after each run and verified before lease release; the phone's existing always-on display setting was preserved.
