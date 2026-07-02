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

# Current Android App
The Android app is implemented with Kotlin and Jetpack Compose. It provides:

- Row/column switch scanning with a large switch input.
- Single-action switch selection: tap anywhere to select the highlighted row, then tap anywhere again to select the highlighted symbol.
- A row-to-symbol transition pause so accidental second taps do not immediately select the first or second symbol.
- A longer first-symbol hold so column 1 is not rushed after the mode change.
- Input-latency compensation: very early activations are treated as intended selections of the previous row or symbol.
- A progress hint bar: the yellow lead-in shows the latency-compensation window, and the teal fill shows current scan progress.
- A blinking message cursor so trailing spaces are visible.
- A dynamic suggestion row for predicted words, completions, and simple action/noun phrases.
- A message buffer with speak, delete, and clear actions represented as scan targets.
- Android Text-to-Speech output.
- Adjustable scan speed, transition pause, first-symbol hold, and input-latency compensation.
- A configurable communication board with urgent needs, common words, full alphabet, space, delete, speak, and clear.

## Switch Scanning Design
This app targets automatic row-column scanning for users who may have only one reliable action, such as a touch, switch, blink, or other binary signal. The communication surface intentionally avoids direct cell tapping: the same single action is used everywhere on the main board.

The scan state machine has four stages:

1. `Rows`: rows are highlighted in sequence.
2. `RowSelected`: the selected row stays locked for a configurable transition pause. Switch activations during this transient state are ignored.
3. `FirstCell`: the first symbol in the locked row is highlighted for a longer configurable hold.
4. `Cells`: the remaining symbols in the locked row are highlighted in sequence.

The `RowSelected` transient state exists because many users produce a second accidental activation shortly after the row selection. Without this pause, the system can jump into symbol scanning and select the first or second symbol before the user has had time to perceive the mode change. The selected row remains highlighted during the pause, then `FirstCell` gives the first symbol extra dwell time before the normal symbol scan continues.

The app also compensates for visual-motor latency. If an activation occurs during the first configurable latency window of a row or symbol highlight, the scanner treats it as an intended selection of the previous highlight. The default is 250 ms, which is in the range commonly used as a practical approximation for human visual reaction time; it must remain configurable because real access latency varies with vision, cognition, fatigue, switch site, switch hardware, and motor control.

The message area always shows a blinking `|` cursor after the current message. This makes trailing spaces visible; without a cursor, a message ending in a space and the same message without a space look identical.

The progress hint under the status text is deliberately simple:

- Yellow segment: the early-input latency-compensation window. Activations here are interpreted as the previous highlight.
- Teal fill: elapsed time in the current scan phase.

This gives users and helpers a visible timing cue without adding another action requirement.

Other options considered:

- Slower global scan speed: simple, but it slows every symbol rather than only the risky row-to-symbol transition.
- Require confirm-on-release or press-and-hold: useful for some switches, but harder for users whose reliable signal is only a short activation.
- Step scanning with separate next/select actions: cognitively clear, but requires more switch actions or a second input.
- Auditory cue before cell scanning: likely useful later, especially for low-vision users, but the visual transient pause is the first implemented safeguard.
- Input-latency compensation: implemented now; improves throughput by forgiving late human activations without slowing the whole scan.
- Probabilistic single-switch selection such as Nomon: promising and potentially faster, but row-column scanning is simpler and easier to explain for the first working version.

## Symbol Ordering
The default spelling area is not alphabetical. It starts with high-frequency English letters:

```text
E T A O I N S R H L D C U M F P G W Y B V K X J Q Z
```

This is intended to reduce average scan time. In row-column scanning, symbols earlier in the board require fewer scan steps. Alphabetical order is easier to inspect, but it puts common letters such as `E`, `T`, `A`, `O`, and `I` across the alphabet rather than near the beginning.

The board also places high-value whole words and actions before spelling symbols because whole-word selection can save many switch activations. The default vocabulary is only a starter set; caregivers should customize it to the individual user, context, language, and communication partners.

## Word Suggestions
The first scan row is dynamic when suggestions are available. It is still selected with the same single-switch row/column flow; it is not a direct-touch row.

Suggestions are intentionally simple and AAC-focused:

- If the user is typing a partial word, suggestions complete that word. For example, `wa` can produce `WANT`, `WATER`, and `WATCH`.
- If the message ends at a word boundary, suggestions favor simple grammar patterns rather than complete sentence prediction.
- After `I` or `YOU`, action words such as `WANT`, `NEED`, `HELP`, `GO`, `STOP`, `WATCH`, `LOOK`, `MOVE`, and `TURN` rank higher.
- After `WANT` or `NEED`, common nouns/needs such as `WATER`, `FOOD`, `TOILET`, `PAIN`, `HOT`, `COLD`, `TIRED`, `SLEEP`, `MORE`, and `DONE` rank higher.

The goal is not to force complete grammatical sentences. Many AAC users communicate efficiently with telegraphic phrases such as `I WANT WATER`, `PAIN`, `HELP TOILET`, or `TURN LEFT`.

Configuration is accessed with the `Config` button in the top panel. It is intended for a fully functional user, caregiver, clinician, or developer. The main switch-scanning loop pauses while configuration is open. Configuration currently supports:

- number of columns
- switch scan speed
- row-to-symbol transition pause
- first-symbol hold
- input-latency compensation window
- suggestion dictionary
- custom symbols and words

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
```

The suggestion dictionary uses the same one-item-per-line format. Helpers can add names, routines, places, needs, favorite activities, or therapy-specific vocabulary:

```text
MOM=mom
DAD=dad
NURSE=nurse
MUSIC=music
TV=TV
BED=bed
```

Configuration is stored on the device. The app migrates old built-in default layouts to the current frequency-ordered default, but it preserves layouts that were saved under the current config version. The `Reset` button restores the built-in frequency-ordered layout, default column count, switch speed, row-to-symbol pause, first-symbol hold, and input-latency compensation window.

To build locally, install the Android SDK and either set `ANDROID_HOME` or create `local.properties` with:

```properties
sdk.dir=C\:\\path\\to\\Android\\Sdk
```

The most automatic path on Windows, after the Android SDK is installed, is:

```powershell
.\build-test.bat
```

The script detects the Android SDK, writes the ignored `local.properties` file, runs JVM unit tests, and builds the debug APK at:

```text
app\build\outputs\apk\debug\app-debug.apk
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

To test on a physical Android device instead:

```powershell
.\build-test.bat -Install
```

Enable Developer Options and USB debugging on the device first.

# References
- [Augmentative and alternative communication](https://en.wikipedia.org/wiki/Augmentative_and_alternative_communication)
- [Switch access scanning](https://en.wikipedia.org/wiki/Switch_access_scanning)
- [Switch access scanning and major challenges](https://easeapps.xyz/105-switch-access-scanning-and-major-challenges/)
- [ASHA Practice Portal: Augmentative and Alternative Communication](https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/)
- [English Letter Frequency Counts: Mayzner Revisited, Peter Norvig](https://www.norvig.com/mayzner.html)
- [Letter frequency](https://en.wikipedia.org/wiki/Letter_frequency)
- [Fast and flexible selection with a single switch](https://arxiv.org/abs/0909.2450)
- [A Performance Evaluation of Nomon: A Flexible Interface for Noisy Single-Switch Users](https://arxiv.org/abs/2204.01619)
