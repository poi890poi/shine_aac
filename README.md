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
- Direct-touch selection for users who can tap individual cells.
- A message buffer with speak, delete, and clear controls.
- Android Text-to-Speech output.
- Adjustable scan speed.
- A starter communication board with urgent needs, common words, letters, space, delete, speak, and clear.

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
