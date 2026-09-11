# Continuous visible-camera research harness

`scripts/face-visible-session.py` measures an already installed preview APK while the real camera drives a visible AAC board. It is experimental research tooling, not a release test replacement. Complete `device-test.bat`, physical optical framing/calibration, and the independent gesture cases first. A failed candidate gesture case blocks that candidate's sustained admission. See the [campaign contract](reports/pre-release/face-app-20260911/contract.md).

Obtain an acknowledged device window from other active tasks. Run both the DUT and presenter inside `Invoke-AndroidDeviceLease` from `scripts/with-android-device-lease.ps1`. Keep those leases through the restoration envelope and display-OFF verification. The Python tools do not acquire the shared Windows mutex themselves.

Wrap the workload in `scripts/face-device-session-guard.py`. Supply every leased serial, the DUT, the exact original installed preview APK as `--baseline-apk`, the candidate as `--candidate`, a new ignored output directory under `.tmp`, then `--` and the workload command. The guard checks the original APK hash before any candidate install. It retains private preference snapshots, restores exact preference bytes and display settings, restores the camera permission grant state and original APK, and verifies both displays OFF. `cleanup.json`'s `passed` describes cleanup; inspect `commandExitCode` separately for test success. Permission flag equivalence is not measured.

Workload arguments:

| Argument | Meaning |
|---|---|
| `--dut-serial`, `--presenter-serial` | Distinct, explicitly leased devices |
| `--backend CPU` or `GPU` | Must match actual backend telemetry, with no fallback |
| `--seconds` | Multiple of 15, from 60 through 3600; pilot before extending |
| `--reference-battery-c` | DUT battery temperature recorded at campaign discovery |
| `--output` | New output directory; keep raw evidence under ignored `.tmp` |

The guard supplies the preview-package environment. The workload uses only the licensed, checksum-verified rig manifest and a previously validated blink fixture for these exact device roles. It holds both displays OFF for at least three minutes and rejects a DUT starting battery temperature outside ±1 °C of discovery. It then installs a temporary public demo profile, warms up on relaxed-face input, and runs fixed 15-second cycles: alternating five-second deliberate closures and 350-ms short controls. Pose choices rotate through the three declared closed-eye source frames. Presentation acknowledgement overhead is retained in the actual acknowledged intervals; these are not photodiode measurements of screen onset.

The workload never extends a closure until activation. Each deliberate cycle must produce exactly one activation and each control zero. It rejects missed cycle deadlines, backend fallback, app process changes, sampled focus/awake loss, missing thermal evidence, moderate thermal status, or battery temperature at least 42 °C. Thermal stops are incomplete runs, never pauses followed by a resumed duration claim.

`face_visible_metrics.py` retains uniquely identified log events across overlapping reads and rotation. It pairs per-frame stage/block evidence by PID, camera timestamp and actual backend. Missing pairs and identity conflicts invalidate accounting. Early/late windows use elapsed capture time. The selected camera must report REALTIME timestamp source before camera-to-classifier age is labeled as comparable to the monotonic completion clock. Native backend or camera reinitialization invalidates a continuous run, even within the same process.

Interpretation limits:

- Fresh usable classifier results do not establish gesture correctness or visible feedback latency. Retained output is unobservable and reported unknown.
- Focus/awake samples every cycle do not prove visibility at every instant. Android `gfxinfo` and endpoint screenshots do not cover every rendering defect or every WebView presentation.
- Repeated known public poses do not establish unseen-user accuracy or clinical performance.
- Battery temperature is not SoC or ambient temperature. USB-powered tests do not establish energy consumption or battery life.
- Never publish raw preference snapshots, original user configuration, or unfiltered AAC board logs. Publish a reviewed whitelist of profiler records, native gesture events, measurement summaries and cleanup status.

Host verification: `python -m unittest discover -s scripts -p "test_face_visible*.py"`. These tests protect accounting and admission rules; they do not constitute a physical-device pass.
