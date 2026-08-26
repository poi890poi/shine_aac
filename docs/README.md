# SHINE AAC documentation

This page is the entry point for maintained project documentation. Historical evidence is retained under `reports/`, `releases/`, and `archive/` so current guidance remains easy to find.

## Product and accessibility

- [Project constitution](PROJECT_CONSTITUTION.md) — disability, AAC, and engineering invariants
- [Architecture](ARCHITECTURE.md) — core/platform boundaries and dependency direction
- [Input adapters](INPUT_ADAPTERS.md) — switch event contract and implemented sources
- [Multilingual design](MULTILINGUAL_DESIGN.md) — language-profile ownership and isolation
- [Text scaling policy](TEXT_SCALING_POLICY.md) — readable type and Android scaling
- [Alternative input survey](ALTERNATIVE_INPUT_SURVEY.md) — evaluated access methods

## Development

- [Agent onboarding](AGENT_ONBOARDING.md) — repository orientation and first checks
- [AI agent guide](AI_AGENT_GUIDE.md) — safe implementation order and UI evidence rules
- [Testing plan](TESTING_PLAN.md) — verification pyramid and expected coverage
- [Device acceptance](DEVICE_ACCEPTANCE_TEST.md) — packaged Android lifecycle and accessibility checks
- [Optical rig](OPTICAL_RIG_TEST.md) — licensed public-media camera verification
- [Scan performance guardrails](SCAN_PERFORMANCE_GUARDRAILS.md) — hot-path and timing invariants

## Release and delivery

- [Release process](RELEASE_PROCESS.md) — branch, artifact, tag, and remote verification requirements
- [Current release notes](releases/v0.4.0.md)
- [Offline resources](OFFLINE_RESOURCES.md)
- [Play submission packet](PLAY_SUBMISSION_PACKET.md)
- [Privacy policy](PRIVACY_POLICY.md) and [Play data safety](PLAY_DATA_SAFETY.md)

## Reports and history

- Current focused reports remain in this directory so release links stay stable.
- Per-release notes are under [`releases/`](releases/).
- Historical pre-release test evidence is under [`reports/pre-release/`](reports/pre-release/).
- Superseded long-form documentation is under [`archive/`](archive/).

## Verification

Run checks from fastest to most device-specific:

```powershell
npm run test:quick
npm run check:architecture
npm run check:docs
npm run test:web:e2e
.\gradlew.bat :optical-core:test :android-inputs:testDebugUnitTest :app:testDebugUnitTest
.\build-test.bat
.\device-test.bat
.\optical-rig-test.bat
```

Camera, detector, calibration, or activation changes require both physical-device and optical-rig gates when the rig is available. Automated optical tests may use only checksum-verified public media declared in `testdata/optical-rig/sources.json`.
