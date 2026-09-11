# CPU/GPU overlap experiment — contract

Parent: ba0536673abce9ebc0f75557526d9367c10909e9. Type: test-only performance experiment.
Compare one GPU worker with sequential preparation against CPU preparation overlapped
with GPU inference. Then compare one GPU worker against independent CPU/GPU workers,
with both models resident for that comparison. Preserve task model, VIDEO mode,
confidence thresholds, single face and expression output. No app camera, calibration,
classifier, sampling, artwork or preference change is authorized by a timing result alone.

Use only checksum-verified public frames derived from testdata/optical-rig/sources.json.
Maximum-throughput runs backpressure their synthetic source so each method sees all
identical frames. Paced 100 ms and 66 ms runs retain latest input and bound ready work;
33 ms, if run, is a separate stress condition, not a proposed default sampling change.
Native create/invoke/close stays on each worker's own thread; each MPImage owns a fresh
bitmap until inference completes. Drain accepted work before teardown. Record prepared,
processed, dropped and late results separately, monotonic accepted output, per-frame
capture/prepare/inference/completion/delivery timestamps, CPU time and thermal state.

Quality: require face/usable coverage to survive and compare native scores/landmarks
against same-input baselines. Such agreement is not independent gesture accuracy.
Keep input identity and actual output order; never hide late results in average FPS.
Performance: prioritize p95 source-to-delivery age and fresh useful output rate, not
throughput alone. A meaningful candidate needs repeatable benefit without worse p95,
quality, unbounded memory, lifecycle hazards or excessive CPU contention. Do not claim
energy savings from CPU time. Trace CPU/GPU work if aggregate results are ambiguous.

ABBA comparisons on tablet and phone. Only surviving runtime changes require fresh
physical optical and full device gates before being called app-device-tested. Test-only
results do not establish real gesture activation latency. No release/default promotion.
Preserve app data and device permissions, hold acknowledged shared leases, restore
settings and verify sleep/display states before explicitly releasing the shared phone.
