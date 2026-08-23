# SHine INtegrated Expression: AAC for Communication Impairment
SHINE AAC is an affordable and versatile augmentative and alternative communication (AAC) solution designed for individuals with restricted motor functions.

# Background
> "Augmentative and alternative communication (AAC) encompasses the communication methods used to supplement or replace speech or writing for those with impairments in the production or comprehension of spoken or written language. AAC is used by those with a wide range of speech and language impairments, including congenital impairments such as cerebral palsy, intellectual impairment and autism, and acquired conditions such as amyotrophic lateral sclerosis and Parkinson's disease."
> 
> -- [Wikipedia, the free encyclopedia that anyone can edit](https://en.wikipedia.org/wiki/Augmentative_and_alternative_communication)
> 

This project specially focuses on those with very limited motor functions. People with very limited motor functions cannot control their bodies with enough power, speed, or precision to operate any common input device including pens, touch panels, mouses, buttons, or AAC devices based on above input devices. These people have a wide range of types and degrees of impairments and require highly customized system to suit their conditions. For example, one might use eyelids to give signals while one might use fingers. And the bit depth (number of unique symbols) and throughput (symbols in a given time) are very limited. Our hands can easily output thousands of different symbols. But eyelids have only two states: open or closed. The device will be designed to take any types of input and output any symbols.

- The system should be affordable and operate with consumer devices including PCs, laptops, smartphones, or tablets.
- The system could include hardware devices or could be pure software (utilize common devices of a smartphone such as microphone, touch screen, or camera).
- The system mostly bases on [Switch Access Scanning](https://en.wikipedia.org/wiki/Switch_access_scanning) for its minimal requirement of motor capabilities.
- The system must have a customizable input: device, mode of operation, number of states (signals), expected throughput (signals per minute).
- The system must have a customizable output: number of symbols and each symbol could be cusomized.

# Software Design
![Model](https://github.com/poi890poi/shine_aac/blob/main/SHINE%20AAC.drawio.png?raw=true)

# Architecture Direction
The project is moving toward a platform-independent AAC core plus thin platform shells. Business rules that can be tested without a screen or device belong in `packages/aac-core`, where they can be verified quickly on Windows and reused by a browser UI, Android package, or future iOS package.

Useful docs:

- [Project Constitution](docs/PROJECT_CONSTITUTION.md)
- [Agent Onboarding](docs/AGENT_ONBOARDING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [AI Agent Guide](docs/AI_AGENT_GUIDE.md)
- [Release Process](docs/RELEASE_PROCESS.md)
- [v0.3.2 Release Notes](docs/releases/v0.3.2.md)
- [AAC Core](packages/aac-core/README.md)
- [Testing Report](docs/TESTING_REPORT.md)
- [Text And Display Scaling Policy](docs/TEXT_SCALING_POLICY.md)
- [Windows/Browser App Report](docs/WINDOWS_APP_REPORT.md)
- [Play Internal Testing Report](docs/PLAY_INTERNAL_TESTING_REPORT.md)
- [Side-load APK Report](docs/APK_REPORT.md)
- [Alternative Input Survey](docs/ALTERNATIVE_INPUT_SURVEY.md)
- [Input Adapters](docs/INPUT_ADAPTERS.md)
- [Multilingual Design](docs/MULTILINGUAL_DESIGN.md)

Run core tests without Android:

```powershell
npm run test:core
```

Run the Windows/browser app:

```powershell
.\run-web.bat
```

Then open `http://127.0.0.1:5173/apps/web/`. Use mouse click, touch, `Space`, or `Enter` as the single switch input.

Run browser E2E against the Windows/browser app:

```powershell
.\e2e-web.bat
```

# Current Android App
The Android app is now a thin Kotlin WebView shell that packages the shared Windows/browser app and `packages/aac-core` logic. It provides:

- Row/column switch scanning plus an optional block/row/column mode, both using the same board and suggestions.
- Single-action switch selection: tap anywhere to select the highlighted block when enabled, row, and then symbol.
- An optional row-to-symbol cancel pause so accidental row selections can be escaped before symbol scanning starts. The MVP default is `0 ms`, which skips this state entirely because the current transition/escape interaction was hurting basic use.
- A configurable first-target hold for the first symbol in a row and the first row after entering a block. Its built-in default is `2400 ms`, longer than the normal `1800 ms` scan interval.
- An optional review hold after suggestion changes. It is off by default so selecting a word immediately resumes scanning; helpers can opt in when a user needs an explicit review pause.
- Input-latency compensation: very early symbol activations are treated as intended selections of the previous symbol in the same row. Row activations are never remapped to a previous row.
- A progress hint embedded in the active row or symbol, so the timing cue follows the scanning cursor.
- A blinking message cursor so trailing spaces are visible.
- Two dynamic English suggestion rows for undo, space, and neutral frequency-ranked word predictions or completions; one-character predictions are excluded.
- A fully occupied four-column English board: `LIKE` replaces the old mid-board clear key, `?` closes text without a stray space, and `CLR` occupies the bottom-right position shared with the Taiwan Mandarin board.
- Taiwan Mandarin suggestions combine up to three recent committed Han glyphs with the active Zhuyin prefix, reserving ordinary candidates while promoting a bounded set of source-backed continuations.
- A message buffer with speak, delete, and clear actions represented as scan targets.
- Android Text-to-Speech output.
- Voice feedback for row scanning, symbol scanning, and activated targets, configurable by a helper. Row-scan voice is off by default; symbol and activation voice remain on.
- A developer-only demo mode. On a phone, long-press `Config` to start the extended everyday conversation demo; tap anywhere to exit. Browser builds can also start it with `?demo=water` or `localStorage["shine-aac-demo-mode"]="water"`. It emits the same activation intents as real input, including word selections, alphabet spelling across deeper rows, speech, clear, and `UNDO` correction.
- Different visual styles for text-entry targets, space, speak, and repair functions such as `CLR`, `UNDO`, and `DEL`.
- Adjustable scan speed, transition pause, first-target hold, suggestion-review hold, and input-latency compensation.
- A configurable communication board with urgent needs, common words, full alphabet, space, delete, speak, and clear.

## Switch Scanning Design
This app targets automatic scanning for users who may have only one reliable action, such as a touch, switch, blink, or other binary signal. The communication surface intentionally avoids direct cell tapping: the same single action is used everywhere on the main board. Row/column scanning remains available, while block/row/column scanning can reduce long row searches without changing the communication layout.

Row/column mode uses these stages:

1. `Rows`: rows are highlighted in sequence.
2. `RowSelected`: when enabled, the selected row stays locked for a configurable transition pause. A switch activation during this transient state cancels the locked row and returns to row scanning.
3. `FirstCell`: the first symbol in the locked row is highlighted with its own configurable hold.
4. `Cells`: the remaining symbols in the locked row are highlighted in sequence.

Block/row/column mode begins with `Blocks`, then scans only the rows inside the selected block before using the same cell stages. The selected block retains a purple outline during row scanning. The first row shown after entering a block uses the same configurable first-target hold as the first symbol in a row; the built-in default is `2400 ms`, compared with the normal `1800 ms` scan interval. A single-row block and a single-item row advance automatically, so an extra switch activation is not required. Scan mode is deliberately independent from language, board columns, symbol placement, and suggestions.

The `RowSelected` transient state exists because many users produce a second accidental activation shortly after the row selection. Without this pause, the system can jump into symbol scanning and select the first or second symbol before the user has had time to perceive the mode change. However, this extra state was confusing in current MVP testing, so the built-in default transition pause is `0 ms`. When the value is `0`, the code skips `RowSelected` completely and goes straight to `FirstCell`. Helpers can enable the pause later by setting a positive transition time.

The app also compensates for visual-motor latency during symbol scanning. If an activation occurs during the first configurable latency window of a symbol highlight, the scanner treats it as an intended selection of the previous symbol in the same row. The default is 250 ms, which is in the range commonly used as a practical approximation for human visual reaction time; it must remain configurable because real access latency varies with vision, cognition, fatigue, switch site, switch hardware, and motor control. Row scanning deliberately does not remap to the previous row because selecting the same column in a previous row is surprising and rarely useful.

The message area always shows a blinking `|` cursor after the current message. This makes trailing spaces visible; without a cursor, a message ending in a space and the same message without a space look identical.

Word selections automatically add a trailing space. Letter selections do not. This removes routine `SPC` selections after words while keeping letter-by-letter spelling predictable. If the user completes a partial word such as `movi` with `MOVIE`, the message becomes `movie `.

Mistakes must be cheap to repair. The app keeps a short message history and exposes `UNDO` in the suggestion row whenever there is something to undo. `UNDO` restores the previous message state, so it can repair a mistaken word, letter, clear, or space with one selection instead of requiring several corrective inputs. Built-in boards therefore do not show a separate backspace key.

The progress hint is drawn inside the active highlighted target so it stays close to the user's gaze target and is easy to see. Block and row progress descends from top to bottom, matching the board's scan direction; individual-symbol progress continues from left to right:

- Full-box highlight: the current block, row, or symbol.
- Teal fill: elapsed time in the current scan phase.

This gives users and helpers a visible timing cue without adding another action requirement.

Other options considered:

- Slower global scan speed: simple, but it slows every symbol rather than only the risky row-to-symbol transition.
- Require confirm-on-release or press-and-hold: useful for some switches, but harder for users whose reliable signal is only a short activation.
- Step scanning with separate next/select actions: cognitively clear, but requires more switch actions or a second input.
- Auditory cue before cell scanning: likely useful later, especially for low-vision users, but the visual transient pause is the first implemented safeguard.
- Input-latency compensation: implemented within a row; improves throughput by forgiving late human activations without creating cross-row surprises.
- Probabilistic single-switch selection such as Nomon: promising and potentially faster, but row-column scanning is simpler and easier to explain for the first working version.

## Symbol Ordering
The default spelling area is not alphabetical. It starts with high-frequency English letters:

```text
E T A O I N S R H L D C U M F P G W Y B V K X J Q Z
```

This is intended to reduce average scan time. In row-column scanning, symbols earlier in the board require fewer scan steps. Alphabetical order is easier to inspect, but it puts common letters such as `E`, `T`, `A`, `O`, and `I` across the alphabet rather than near the beginning.

The board also places high-value whole words and actions before spelling symbols because whole-word selection can save many switch activations. The default vocabulary is only a starter set; caregivers should customize it to the individual user, context, language, and communication partners.

## Word Suggestions
The first two English scan rows are reserved for suggestions. They remain present so the rest of the board keeps a stable spatial layout. They use the same single-switch scanning flow as every other row and are not direct-touch controls.

Suggestion rows stay in fixed positions at the top. A selected row is locked during cell scanning so a dynamic update cannot swap the tile being selected.

Suggestions are intentionally simple and AAC-focused:

- Each row shows up to four targets on the default four-column English board.
- `UNDO` appears first when a previous message state exists.
- `SPC` appears when the message has text and does not already end in a space.
- If the user is typing a partial word, suggestions complete that word. For example, `wa` can produce `WANT`, `WATER`, and `WATCH`; `movi` can produce `MOVIE`.
- If the partial word already exactly matches a dictionary item, that same word is not suggested again.
- At a word boundary, suggestions use the same neutral AOSP frequency ranking rather than handcrafted sentence patterns.
- One-character candidates are excluded because the complete fixed alphabet is already available below the suggestions.
- The single fixed `I` remains at its frequency-ordered alphabet position. It enters `I ` at a word boundary and lowercase `i` while spelling inside a word.

The built-in English suggestion dictionary is a filtered, neutral frequency-ranked slice of the Android Open Source Project LatinIME en-US dictionary. It is not manually tuned around demo phrases or individual complaints.

Helpers can still replace or extend this dictionary in configuration. The backend is intentionally simple and offline, but the code keeps it isolated so a maintained package, downloaded language model, or online predictor could replace it later.

The goal is not to force complete grammatical sentences. Many AAC users communicate efficiently with telegraphic phrases such as `I WANT WATER`, `I NEED DRINK`, `PAIN`, `HELP TOILET`, or `TURN LEFT`.

The board no longer includes a single `?` row. A one-column row can be useful for very high-frequency symbols because it reduces selection to one level, but it should be introduced deliberately for a specific user rather than consuming scarce default board space.

Configuration is accessed with the `Config` button in the top panel. It is intended for a fully functional user, caregiver, clinician, or developer. The main switch-scanning loop pauses while configuration is open. Configuration currently supports:

- scanning mode: rows/columns or blocks/rows/columns
- number of columns
- switch scan speed
- row-to-symbol transition pause
- first-row / first-symbol hold
- input-latency compensation window
- optional automatic scanning across `更多` suggestion pages, with synchronized horizontal page progress; activation selects the visible page as a row block, enters its row scan directly, and two missed passes pause
- optional first-pass deferral of Zhuyin symbols that do not continue any source-backed single-glyph reading
- suggestion dictionary
- custom symbols and words
- row-scan voice feedback, symbol-scan voice feedback, activation voice feedback, and a dedicated Android-style Taiwan voice list separating downloaded, online, and downloadable voices with radio selection, inline preview/download actions, engine metadata, and restart-from-top behavior
- phone/external hardware button activation
- input testing for reliable switches and noisy sensor-style adapters

Symbol format is one item per line:

```text
WATCH=watch
MOM=mom
A
B
SPC=<space>
DEL=<delete>
SAY=<speak>
CLR=<clear>
UNDO=<undo>
```

The suggestion dictionary uses the same one-item-per-line format. Helpers can add names, routines, places, needs, favorite activities, or therapy-specific vocabulary. The built-in starter dictionary includes a small set of needs, actions, people, directions, and leisure/context words such as `MOVIE`, `MUSIC`, `TV`, `BOOK`, and `PHONE`.

```text
MOM=mom
DAD=dad
NURSE=nurse
MUSIC=music
TV=TV
MOVIE=movie
BED=bed
```

Configuration is stored on the device. The app migrates old built-in default layouts and old built-in suggestion dictionaries to the current defaults, but it preserves custom layouts and custom dictionaries. The `Reset` button restores the built-in frequency-ordered layout, default column count, switch speed, row-to-symbol pause, first-target hold, automatic `更多` page scanning off, first-pass Zhuyin deferral off, suggestion-review hold off, voice defaults, and input-latency compensation window.

To build locally, install the Android SDK and either set `ANDROID_HOME` or create `local.properties` with:

```properties
sdk.dir=C\:\\path\\to\\Android\\Sdk
```

The most automatic path on Windows, after the Android SDK is installed, is:

```powershell
.\build-test.bat
```

The script detects the Android SDK, writes the ignored `local.properties` file, runs JVM unit tests, and builds the intermediate debug APK at:

```text
app\build\outputs\apk\debug\app-debug.apk
```

For a shareable file, create a versioned release artifact:

```powershell
.\package-release.bat -SdkDir E:\Android\Sdk
```

The output is under `releases\vX.Y.Z\`, for example:

```text
releases\v0.2.2\shine-aac-v0.2.2-code5-debug.apk
```

Useful variants:

```powershell
# Install the minimal command-line Android SDK, then test and build.
.\build-test.bat -SetupSdk

# If C: is low on space, install the SDK on a larger drive.
.\setup-sdk.bat -SdkDir E:\Android\Sdk
.\build-test.bat -SdkDir E:\Android\Sdk

# Install or repair the minimal command-line Android SDK only.
.\setup-sdk.bat

# Point at a non-standard SDK location.
.\build-test.bat -SdkDir C:\Users\Lee\AppData\Local\Android\Sdk

# Search all fixed drives for an old SDK install.
.\build-test.bat -DeepSearch

# Clean, test, and build.
.\build-test.bat -Clean

# Build and install on a connected Android device or emulator.
.\build-test.bat -Install

# Only run local unit tests.
.\build-test.bat -SkipAssemble
```

## Test the APK
The easiest Windows PC path is the Android Emulator:

```powershell
# First run only: install emulator packages, create an AVD, build, install, and launch.
.\run-apk.bat -SetupEmulator

# If C: is low on space, keep the emulator SDK on a larger drive.
.\run-apk.bat -SetupEmulator -SdkDir E:\Android\Sdk

# Later runs: build, install, and launch on the existing emulator.
.\run-apk.bat
```

Useful variants:

```powershell
# Reuse the existing APK without rebuilding.
.\run-apk.bat -NoBuild

# Force a cold emulator boot if snapshots get weird.
.\run-apk.bat -ColdBoot
```

For a basic real-APK regression check, run the one-switch E2E test:

```powershell
.\e2e-switch-test.bat -SdkDir E:\Android\Sdk
```

It builds the debug APK, installs it on the emulator, clears app data, enables a test-only WebView render-state bridge, drives the row/column scanner with Android hardware key events, enters `I want water `, and verifies the final message from the same render pass that updates the display. Screenshots and test artifacts are saved under `e2e-artifacts\`.

To test on a physical Android device instead:

```powershell
.\build-test.bat -Install
```

Enable Developer Options and USB debugging on the device first.

# License
SHINE AAC is licensed under the [Apache License 2.0](LICENSE).

# References
- [Augmentative and alternative communication](https://en.wikipedia.org/wiki/Augmentative_and_alternative_communication)
- [Switch access scanning](https://en.wikipedia.org/wiki/Switch_access_scanning)
- [Switch access scanning and major challenges](https://easeapps.xyz/105-switch-access-scanning-and-major-challenges/)
- [ASHA Practice Portal: Augmentative and Alternative Communication](https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/)
- [Semantic compaction](https://en.wikipedia.org/wiki/Semantic_compaction)
- [General Service List](https://en.wikipedia.org/wiki/General_Service_List)
- [Most common words in English](https://en.wikipedia.org/wiki/Most_common_words_in_English)
- [English Letter Frequency Counts: Mayzner Revisited, Peter Norvig](https://www.norvig.com/mayzner.html)
- [Letter frequency](https://en.wikipedia.org/wiki/Letter_frequency)
- [Android Switch Access](https://support.google.com/accessibility/android/answer/6122836)
- [Android Camera Switches](https://support.google.com/accessibility/android/answer/11150722)
- [Android Voice Access](https://support.google.com/accessibility/android/answer/6151848)
- [Fast and flexible selection with a single switch](https://arxiv.org/abs/0909.2450)
- [A Performance Evaluation of Nomon: A Flexible Interface for Noisy Single-Switch Users](https://arxiv.org/abs/2204.01619)

## Physical-device acceptance

With one authorized Android device connected:

```bat
device-test.bat
```

The standard physical test includes automatic thermal cooldown/resume and writes
ranked evidence to `test-results/device-*`.

For camera-switch changes, use the monitor-to-camera regression rig:

```bat
optical-rig-test.bat
```

After one successful rig calibration, reuse its ignored session fixture for
focused cases without repeating the native calibration flow:

```bat
optical-rig-test.bat --runtime-only --case blink_long_positive_02 --repeat 5
```

The fixture is test-session state only. The runner restores the phone's original
camera/calibration preferences and Switch input selection after every run.
When the rig is idle, keep the monitor unobtrusive with:

```bat
optical-rig-idle.bat
```

To replay a real SHINE cheek calibration session:

```bat
python scripts\import-cheek-calibration.py path\to\cheek-calibration-....zip
optical-rig-test.bat --with-local-cheek
```

See `docs/DEVICE_ACCEPTANCE_TEST.md` and `docs/OPTICAL_RIG_TEST.md`.
