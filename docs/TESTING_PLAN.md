# SHINE AAC Testing Plan

Generated: 2026-07-10

This document defines how SHINE AAC should be tested before release candidates. It is a stable methodology document, not a generated result report. Current results belong in `docs/TESTING_REPORT.md`, `docs/COMMUNICATION_BENCHMARK_REPORT.md`, `docs/WEB_E2E_REPORT.md`, and `docs/APK_REPORT.md`.

## Principles

- Test communication ability, not only software mechanics. A pass means the app can express meaningful messages through the same core pathways a user would have.
- Keep demos separate from product logic. A demo script may become a test case, but it must not create dedicated vocabulary, hidden shortcuts, or phrase-specific rules.
- Prefer general mechanisms. Fix dictionaries, ranking, layout density, migration, and scanner behavior in ways that improve broad access, not a single example.
- Use existing source data where possible. `zh-TW` dictionary quality should be judged against source-backed Traditional Chinese/Zhuyin data, not generated filler or hand-picked rescue phrases.
- Measure reachability and efficiency without real-time waits. Virtual core benchmarks should scan the same visible rows and suggestions, but they should count selections, activations, advances, and estimated configured time instead of sleeping.
- Use real-time scanning only where it matters. Browser and APK E2E should verify that the UI, timing loop, persistence, input adapters, and WebView shell behave correctly, using a small set of representative flows.
- Keep language profiles isolated. English, `zh-TW`, and future symbol profiles must not mutate each other's layout, spacing, dictionary, or migration behavior.
- Treat failures as design information. A failing benchmark should usually trigger a general data, ranking, or access-rule improvement, not a special-case exception.
- Report gaps honestly. A high glyph reachability score does not mean real daily conversation coverage is complete.

## Test Layers

| Layer | Purpose | Speed Model | Main Evidence |
| --- | --- | --- | --- |
| Quick core tests | Pure scanner, board, message, profile, migration, and suggestion behavior outside the long benchmark suite | Fast deterministic execution for day-to-day development | `npm run test:quick` |
| Full core tests | Quick core tests plus virtual communication benchmarks | Long deterministic execution; expected to take much longer than a normal edit cycle | `npm run test:core` or `npm test` |
| Fast zh-TW dictionary inventory | Broad source symbol/glyph/word inventory, estimated reachability, and estimated activation cost | Graph analysis only; no real sleeps and no full virtual utterance scanning | `docs/ZHTW_DICTIONARY_INVENTORY_REPORT.md` |
| Virtual communication benchmarks | Reachability and efficiency for words, phrases, utterances, and multilingual paths | No real sleeps; count activations and advances, estimate configured scan time | `docs/COMMUNICATION_BENCHMARK_REPORT.md` |
| Browser E2E | Rendered web UI, scanning loop, localStorage migration, viewport fit, demo/smoke flows | Normal UI event timing, reduced case count | `docs/WEB_E2E_REPORT.md` |
| APK/build checks | Android package build, asset inclusion, native shell integration, installable artifact | Build-time plus selected device/emulator smoke flows | `docs/APK_REPORT.md` |
| Human UX verification | Comfort, clarity, timing feel, speech output, and caregiver comprehension | Real device and real user/helper judgment | UX checklist in release notes/report |

## Change-Scoped Test Selection

Not every change needs the full test pyramid. Tests should match the modified surface first, then broaden only when the change crosses boundaries or is being prepared for publication.

| Change Type | Examples | Required Before Commit | Required Before APK Handoff | Required Before Major Release / Publish |
| --- | --- | --- | --- | --- |
| Documentation/store text only | `docs/`, Play listing copy, release notes | spell/check affected docs; no app tests unless generated references changed | none | full release packet review |
| Store assets only | feature graphic, screenshots, Play icon files not packaged in app | verify dimensions and visual output | none unless app resources changed | Play asset checklist |
| Launcher/app resources | Android icon, strings, manifest resources | `.\gradlew.bat assembleDebug` | `.\build-test.bat -SdkDir <sdk>` if APK is handed off | full Android build/package |
| Web UI rendering only | CSS/layout/progress animation/message display | `npm run test:web:e2e` or narrower browser scenario covering the changed UI | `.\build-test.bat -SdkDir <sdk>` plus APK install/smoke when handed off | full core, web, Android package, UX checklist |
| Web integration behavior | demo activation, config modal, localStorage migration, UI event handling | targeted browser E2E scenario plus affected unit tests if core state changes | APK runtime smoke if WebView/touch/hardware path is involved | full core, web, Android runtime smoke |
| Android native shell | TTS bridge, hardware keys, WebView setup, app lifecycle | `.\gradlew.bat testDebugUnitTest` and `.\build-test.bat -SdkDir <sdk>` | targeted APK runtime smoke or `.\e2e-switch-test.bat -SdkDir <sdk>` when stable | full Android package/runtime plus manual device check |
| Core scanner/message/profile logic | `packages/aac-core`, scanner, suggestions, dictionary ranking, migration | targeted core test file or fixture plus relevant benchmark generator | full `npm run test:core` before APK handoff if behavior affects users | full core, benchmark, web, Android, UX checklist |
| `zh-TW` dictionary/ranking/data | generated Chewing data, phonetic access rules, benchmark fixtures | targeted source/data analyzer and affected core tests | full `npm run test:core` before handing APK to Taiwan testers | full publish regression |
| Cross-cutting release change | versioning, packaging, native plus web, profile defaults | affected targeted tests plus `.\package-release.bat -SdkDir <sdk>` | full handoff verification with SHA-256 and URL | full release gate |

Default rule: run the smallest test set that can fail because of the change. Use `npm run test:quick` for ordinary core/web development confidence when communication benchmarks are not the changed surface. Full regression is required for major changes, publish candidates, before public/closed testing submissions, and when a narrow test reveals unexplained behavior.

When a command is expected to be long, give it a long timeout rather than reporting a harness timeout as a test failure. `npm test`, `npm run test:core`, and `npm run test:core:benchmarks` include the communication benchmark suite and are allowed to run for a long time. If a long-running command appears stalled, inspect process/log state and report it as an infrastructure issue separately from product quality.

## Core Unit Methods

Core tests must run without Android SDK, browser APIs, WebView, network, audio devices, or platform storage. They should test pure functions and session transitions.

Command split:

- `npm run test:quick`: day-to-day deterministic core verification, excluding the intentionally long communication benchmark file.
- `npm run test:core` or `npm test`: full core verification, including communication benchmarks.
- `npm run test:core:benchmarks`: communication benchmark test file only.
- `npm run report:communication`: regenerate `docs/COMMUNICATION_BENCHMARK_REPORT.md` from benchmark metrics.
- `npm run baseline:communication`: deliberately replace the frozen task-level communication baseline after a reviewed improvement has been accepted; normal report generation never moves the baseline.
- `npm run report:efficiency`: regenerate the zh-TW dictionary inventory, phonetic access, and communication efficiency reports.

Required coverage:

- scanner state transitions, row selection, cell selection, wrapping, skipped empty rows, and latency compensation
- message operations including append, space, delete, clear, undo, and candidate replacement
- board chunking, row density, static row stability, and action parsing
- profile-specific spacing, labels, dictionaries, speech metadata, and migration
- `zh-TW` suggestion quality, including exact phonetic matches, valid continuations, source-backed candidates, bounded pages, and no unrelated filler
- multilingual `zh-TW` paths where occasional English is entered through the normal `EN` entry point and returned to Zhuyin through the normal close/back mechanism

Core tests may call helpers that simulate visible tile selection. They must not directly mutate message text to make a benchmark pass.

## Virtual Benchmark Methods

Virtual benchmarks are the primary place to measure whether communication is possible and efficient.

For broad `zh-TW` dictionary quality, run the fast inventory report first. It should report total available Zhuyin symbols, source glyphs, source word/phrase labels, phonetic-path reachability, direct candidate reachability, composability from glyphs, and estimated activations. This report is allowed to estimate all dictionary labels quickly because it uses the access graph rather than full row/column scan simulation.

Any systemic input-efficiency change must regenerate the dictionary inventory, phonetic coverage, and communication benchmark reports. The review should compare the current run against the previous-version baseline sections and confirm that improvements are broad: dictionary coverage must not regress, high-rank glyph/phrase reachability must remain stable or improve, and efficiency gains must not come from hand-crafted shortcuts or overfitting a small demo path.

The communication report compares every matched task against the frozen snapshot in `packages/aac-core/test/communication-benchmark-baseline.json`. Acceptance gates require total and P90 switch effort and estimated scan time to remain stable or improve, require every established communication-function group to remain stable or improve in aggregate, and allow no task to gain more than one additional `更多` selection. A lower raw `更多` count is not an improvement when these gates fail. Normal report generation rejects added or removed task ids; the explicit baseline-update command may accept a reviewed task-set change without treating newly added coverage as a performance regression. Update the frozen snapshot only after reviewing the paired task deltas and accepting the candidate; never update it merely to make a regression pass.

The runner should:

- start from a real profile configuration
- inspect visible rows and suggestion rows exactly as the app core would expose them
- select visible tiles through the same action types used by the app
- count output selections, switch activations, scanner advances, undo/delete/clear, category open/close, candidate commits, and suggestion paging
- estimate scan time from configured scan timing, without sleeping
- fail when a target cannot be reached, exceeds a configured limit, or uses an invalid shortcut

The runner should not:

- add temporary vocabulary for a benchmark
- bypass the board or suggestion provider
- assume a candidate exists because a script needs it
- use browser or APK timing as a proxy for reachability

`zh-TW` benchmarks should prefer composing through fundamental glyphs and source-backed phrases instead of adding long scripted phrases. Long conversation examples should be represented as token sequences that prove the core can combine smaller units.

Long composite phrases are efficiency shortcuts, not mandatory coverage units. If the component glyphs or smaller words are reachable, the expression is possible; the report should measure the longer phrase as direct-candidate compression and separately report exact-or-composable coverage. Ranking changes must improve efficiency without hiding existing useful candidates.

When a benchmark has an expected final message, the report should compare the scripted fixture path with a generic least-cost `zh-TW` path search. Scripted paths are useful regression examples, but the optimizer estimate is the better metric for minimum activations because it can compare direct phrases, smaller words, glyph composition, context-sensitive visible suggestions, and embedded Latin runs without adding special-case app logic.

## Browser E2E Methods

Browser E2E verifies integration and rendering, not broad language coverage.

Required coverage:

- app launches from a clean browser profile
- board, message text, suggestions, config controls, and tabs render
- one-switch row/column scanning can enter a short message
- undo, delete, clear, and suggestion completion work in the rendered UI
- text history updates one live line while the current text area is edited, closes that line only on an explicit text-area reset, and preserves version 1 snapshots during migration
- text export contains one plain-text line per text-area session; Android opens a user-chosen file destination instead of a share/clipboard flow
- profile migration from stale stored data is visible after reload
- `zh-TW` labels fit inside cells at phone viewport sizes
- `zh-TW` `EN` entry point exposes English symbols without replacing the first-level Chinese surface
- demo activation clears the draft and scanner holds, then restarts scanning from the top row
- a reduced-column `zh-TW` demo must use normal bounded `更多` paging to select a displaced continuation and complete its candidate; the test must not add vocabulary or bypass visible scanning
- intentional demo exit must stop cleanly without leaking a failure into later app behavior
- internal back navigation returns App Info and Input Test to Configuration, then Configuration to the communication board; only back from the root board may exit the app
- reset restores packaged defaults
- viewport and canvas/pixel checks prove the UI is not blank or clipped

Browser E2E should use a small number of normal-speed scanning cases. It should not run the full reachability corpus through real-time scanning.

## APK And Device Methods

APK checks prove that the release artifact is buildable and installable, and that Android shell behavior does not diverge from web/core behavior.

Required build checks:

- version code and version name are current
- Gradle build succeeds
- packaged assets include the current web bundle, icon, store materials when applicable, and config defaults
- generated APK/AAB checksum is recorded
- release artifact is pushed to a stable download URL before it is handed to testers

Required smoke checks when Android runtime is available:

- install or launch the packaged APK
- verify the app reaches the main board
- verify hardware or accessibility switch input reaches the scanner path when enabled
- verify persisted config can load and reset
- verify `zh-TW` profile renders the expected Chinese labels and `EN` entry point
- verify Android predictive/back-swipe dispatch returns from an internal page to its parent before Activity exit
- verify speech output manually when TTS or audio behavior changed

APK runtime checks can be small. They do not replace core benchmark coverage.

## Design And Compatibility Review Gate

Design review is a release gate, not a visual polish pass. It must review every user-visible Activity and every supported form factor before an APK is handed to testers.

Required review scope:

- Main AAC communication screen.
- Configuration panel, export flow, and input-test panel.
- Android's text-document picker can create the suggested `.txt` file, cancellation leaves history intact, and the saved UTF-8 content matches the browser history export.
- Native camera-switch setup screen.
- Android permission dialogs and external chooser handoffs that affect the user flow.
- Phone portrait, phone landscape or explicit portrait-lock behavior, 7-inch tablet, 10-inch tablet, foldable/tablet landscape, and multi-window or resizable windows when available.
- System UI modes: gesture navigation, three-button navigation, status bar, display cutout, keyboard/IME if any text field can be focused, and large display/font settings.
- Lifecycle events: rotation, app background/foreground, Activity recreation, screen timeout, permission denial/retry, and WebView reload.

Required compatibility checks:

- No tappable or critical content is hidden behind system bars, navigation buttons, display cutouts, camera holes, taskbars, or keyboard UI.
- Screen stays awake while communication or camera setup is foregrounded.
- Current composed text and repair history survive rotation, reload, background/foreground, and short Activity recreation.
- Orientation restrictions are treated as temporary phone behavior only; tablet and future large-screen readiness must be reviewed as resizable/adaptive behavior.
- Every scrollable or fixed-height view has a reachable bottom action area under short-height and landscape windows.
- Camera preview and overlay alignment are verified in portrait and landscape on phone/tablet-sized windows before camera switch support is claimed on those form factors.
- Text, controls, and scan targets remain readable and tappable at increased font/display size.

Required evidence before closed/open testing:

- `npm run test:web:e2e` with phone portrait plus tablet portrait and tablet landscape viewport checks.
- Android emulator or real-device smoke on at least one phone and one tablet-class configuration. If no physical tablet is available, use Android Studio Pixel Tablet or equivalent emulator and document that limitation.
- Manual screenshots or automated captures for main board, config, input test, and camera setup with system navigation controls visible.
- A current `docs/DEVICE_COMPATIBILITY_REVIEW.md` report listing pass/fail/open risks and release decision.

Known Android guidance that must be considered:

- Apps targeting SDK 35 can be displayed edge-to-edge on Android 15+, so system bar insets are mandatory for tappable content.
- Android 16 large-screen behavior can ignore orientation and resizability restrictions for apps targeting API 36 on screens with smallest width at least 600dp; tablet readiness cannot rely on `screenOrientation="portrait"`.
- Keeping the screen on is an Activity-level foreground behavior; every foreground communication/setup Activity that must not time out needs its own keep-awake handling.

## Data Requirements

Every evaluation data source should declare its purpose and provenance.

| Data Type | Requirement | Accepted Source Examples | Not Accepted As Evidence |
| --- | --- | --- | --- |
| Static core vocabulary | Broad AAC relevance and stable source | Project Core, ASHA-aligned functional areas, clinician/caregiver review | One demo script |
| `zh-TW` glyph/phrase dictionary | Traditional Chinese text, Zhuyin keys, rank or frequency metadata | New Chewing `libchewing-data`, other licensed Taiwan Mandarin corpora | Generated phrases without source ranking |
| Daily utterance cases | Real communication function, source/review note, target concept list | academic/clinical daily conversation material, caregiver/clinician-reviewed Taiwan examples | AI-generated filler counted as corpus coverage |
| Multilingual examples | Occasional English embedded in `zh-TW` use | realistic media/app names, caregiver terms, device labels | changing first-level Chinese layout into an English keyboard |
| UX feedback | Device, user/helper role, profile, task, observation, severity | Taiwan pilot notes, tester sessions | vague approval without task evidence |

Minimum fields for a benchmark fixture:

```text
id
profileId
source
sourceExample
purpose
targetConcepts
acceptableTokenSequences
expectedFinalMessages
maxSelections
```

Optional fields:

```text
maxSwitchActivations
maxScannerAdvances
maxEstimatedScanTimeSeconds
notes
reviewer
dataLicense
```

## Standard Stats Template

Every pre-release test report should include this table.

```markdown
## Test Summary

Generated: YYYY-MM-DDTHH:mm:ss+08:00
Commit: <git sha>
Version: <versionName> (<versionCode>)
Artifact: <APK/AAB name or none>

| Layer | Command / Method | Scope | Result | Count / Stats | Report |
| --- | --- | --- | --- | --- | --- |
| Core unit | `npm test` | scanner, board, profiles, suggestions, benchmarks | PASS/FAIL | N passed, 0 failed, duration | `docs/TESTING_REPORT.md` |
| Communication benchmark | `node scripts/report-communication-benchmarks.mjs` | virtual reachability and efficiency | PASS/FAIL | tasks, pass rate, avg/median selections, avg/median activations, avg/median estimated time | `docs/COMMUNICATION_BENCHMARK_REPORT.md` |
| Browser E2E | `npm run test:web:e2e` | rendered UI and browser storage | PASS/FAIL | steps, viewport checks, artifacts, duration | `docs/WEB_E2E_REPORT.md` |
| Android build | `.\build-test.bat -SdkDir <sdk>` | Gradle debug build | PASS/FAIL | APK path, size, warnings | `docs/APK_REPORT.md` |
| APK package | `.\package-release.bat -SdkDir <sdk>` | downloadable prerelease artifact | PASS/FAIL | file name, SHA-256, URL | `docs/APK_REPORT.md` |
| APK runtime smoke | device/emulator/manual script | Android WebView and input adapter | PASS/FAIL/SKIPPED | device, Android version, cases | `docs/APK_REPORT.md` |
| Human UX | manual pilot checklist | comfort and comprehension | PASS/FAIL/OPEN | tester role, device, issues | release notes or UX log |
```

Communication benchmark detail should include:

```markdown
| Metric | Unit | Current | Target | Status |
| --- | --- | ---: | ---: | --- |
| Benchmark pass rate | tasks | N / N | 100% | pass/gap |
| Direct zh-TW phonetic coverage | weighted coverage | X% | >= 98% | pass/gap |
| Top zh-TW glyph reachability | unique glyphs | X / Y | >= 99% | pass/gap |
| Top zh-TW phrase reachability | unique phrases | X / Y | >= 95% | pass/gap |
| Multi-concept utterance coverage | utterances | X | 120 | gap |
| Average output selections | selected tiles | X | trend down | info |
| Median output selections | selected tiles | X | trend down | info |
| Average switch activations | activations | X | <= 6 | pass/gap |
| Median switch activations | activations | X | <= 4 | pass/gap |
| Average estimated scan time | seconds | X | <= 15 | pass/gap |
| Median estimated scan time | seconds | X | <= 10 urgent phrase target | pass/gap |
```

UX verification should include:

```markdown
| Case | Profile | Device | Tester Role | Expected | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Launch and understand early-development warning | all | model / Android version | owner/helper/user | warning is clear but not frightening | PASS/FAIL |  |
| Compose urgent need | zh-TW |  |  | short need can be entered and spoken | PASS/FAIL |  |
| Compose longer feeling/thought | zh-TW |  |  | message remains readable and recoverable | PASS/FAIL |  |
| Use occasional English | zh-TW |  |  | `EN` opens English symbols and closes back predictably | PASS/FAIL |  |
| Clear/undo/delete repair | all |  |  | helper can recover from mistakes | PASS/FAIL |  |
| One-line message display | all |  |  | long text scrolls horizontally without growing layout | PASS/FAIL |  |
| Scan timing comfort | all |  |  | timing is usable without rushed first cell | PASS/FAIL |  |
| Speech output | all |  |  | volume, language, and pronunciation are acceptable | PASS/FAIL |  |
```

## Release Gate

A prerelease APK may be shared for UX testing when:

- core tests pass
- communication benchmark generation succeeds and reports known gaps
- browser E2E passes or any failure is documented as unrelated to the APK under test
- Android build/package succeeds
- the APK is available from a pushed remote URL with SHA-256
- tester instructions clearly state this is an early development version

Google Play production readiness requires more:

- signed release AAB with private keystore handling confirmed
- Play listing, data safety, privacy policy, icon, feature graphic, screenshots, and contact details complete
- Taiwan pilot UX feedback reviewed
- accessibility and clinical-risk wording reviewed
- known critical bugs closed or explicitly documented for closed testing only
