# Device Compatibility Review

Generated: 2026-07-18
Current automated candidate commit: `b48860b35c3a3517988b7f703c3953268713671a`
Current automated candidate version: 0.2.37 (40)

## 0.2.37 Automated Candidate Rerun

Source and packaged browser viewport checks passed for phone portrait, tablet portrait, tablet landscape, and large text. The exact code-40 APK passed install, packaged demo activation, hardware-key composition, native draft recreation, and zh-TW render checks on the dedicated API 34 emulator after its unhealthy saved state was wiped and rebuilt.

This rerun does not close the physical Samsung, real-person camera, Mandarin TTS, or human AAC UX items below.

## 0.2.35 Pre-release Rerun

The current runtime rerun passed on an API 34 phone emulator and an Android `sw800dp` tablet-class configuration at 1600x2560 portrait and 2560x1600 landscape.

- Main board, Config, Input Test, and Camera Setup stayed clear of visible system controls.
- MainActivity and CameraSwitchCalibrationActivity both exposed `KEEP_SCREEN_ON`.
- The composed message `I want water ` survived portrait-to-landscape Activity recreation.
- Camera permission denial exposed the recovery action, and an emulated front camera produced a nonblank Camera2 preview in landscape.
- No app crash or ANR appeared during these checks.

The 2026-07-15 large-text rerun additionally passed with Android font scale 2.0 on phone and tablet-class windows. AAC cell labels are now fitted from measured container geometry instead of label-length rules. Camera Setup reserves a stable preview pane, scrolls controls independently, and aspect-fits the camera buffer in phone portrait plus tablet portrait/landscape.

Physical Samsung confirmation, real-person camera detection/alignment, TTS listening, and human AAC UX review remain open. Full evidence is recorded in `docs/PRE_RELEASE_TEST_REPORT_0.2.35.md`.

This review replaces the previous informal UX/design review gate for device behavior. The prior review missed foreseeable Android integration risks because it checked app logic, screenshots, and store assets, but did not require every Activity to be tested against system bars, screen timeout, lifecycle recreation, orientation, and tablet-class windows.

## Guidance Basis

- Android edge-to-edge guidance: system bars and display cutouts must be handled with window insets when content can draw behind system UI.
- Android keep-screen-on guidance: keep-awake behavior is a foreground Activity/window responsibility.
- Android large-screen guidance: apps must be reviewed for orientation, aspect ratio, resizability, and adaptive layouts; future large-screen Android behavior can ignore orientation and resizability restrictions for API 36 targets on screens at least 600dp wide.

References:

- https://developer.android.com/develop/ui/views/layout/edge-to-edge
- https://developer.android.com/develop/ui/views/layout/insets
- https://developer.android.com/develop/background-work/background-tasks/awake/screen-on
- https://developer.android.com/develop/ui/compose/layouts/adaptive/app-orientation-aspect-ratio-resizability
- https://developer.android.com/quality/large-screens

## Root Cause

The previous review failed because it did not have an explicit device-compatibility checklist. It asked whether the rendered AAC board looked acceptable, but did not ask:

- Which Activities exist, and does each handle system bars?
- Does each foreground communication/setup Activity prevent screen timeout?
- What happens when Android recreates the Activity?
- What happens on Samsung gesture navigation and three-button navigation?
- What happens on tablet-class screens, landscape, foldables, and future target SDK behavior?

That made the review dependent on whichever phone condition happened to be tested.

## Current Activity Inventory

| Activity | Module | User-visible in release app | Current status |
| --- | --- | --- | --- |
| `org.shineaac.app.MainActivity` | `app` | Yes | Insets handled, keep-awake enabled, phone portrait policy only below 600dp |
| `org.shineaac.inputs.CameraSwitchCalibrationActivity` | `android-inputs` | Yes, through Camera setup | Insets handled, keep-awake enabled |
| `org.shineaac.blinktest.MainActivity` | `blinktest` | No, separate developer diagnostic app | Not release-gated |

## Rerun Findings

| ID | Severity | Area | Finding | Status | Required action |
| --- | --- | --- | --- | --- | --- |
| DC-001 | Critical | Main AAC screen | Bottom row could be blocked by Samsung/system navigation controls because the WebView filled the window without system-bar padding. | Fixed; tablet emulator confirmed | Confirm on the target Samsung phone with gesture and button navigation |
| DC-002 | Critical | Main AAC screen | Display timeout could interrupt active AAC use. | Fixed; emulator window flag confirmed | Confirm by waiting past the configured timeout on the target phone |
| DC-003 | Critical | Camera setup | Native camera setup had the same system-control and timeout class of risk. | Fixed; tablet emulator confirmed | Confirm system-control clearance and timeout behavior on the target phone |
| DC-004 | High | Rotation/recreation | Composed message was lost when Android recreated/reloaded the WebView. | Fixed; browser and Android lifecycle checks passed | Keep lifecycle persistence in the release smoke suite |
| DC-005 | High | Tablet/large screen | The app was phone-first and manifest-locked to portrait. | Fixed for current target; tablet emulator confirmed | Manifest lock removed; phones are portrait-locked below 600dp and tablet-class screens use the adaptive layout |
| DC-006 | High | Future Android target SDK | `screenOrientation="portrait"` is a temporary phone release mitigation. Large-screen Android behavior can ignore orientation restrictions for newer target SDKs. | Open | Design and verify adaptive landscape/tablet layout before API 36/production tablet support |
| DC-007 | High | Camera switch on tablet/landscape | Camera setup used fixed image-rotation assumptions. | Fixed; unit-tested and emulated-camera startup confirmed | Real-person face/eye classification still requires a physical-device test |
| DC-008 | Medium | Web viewport sizing | Web CSS used `100vh` for the shell and lacked tablet landscape coverage. | Fixed; browser and tablet emulator confirmed | Dynamic viewport units and the tablet landscape layout remain release-gated by E2E |
| DC-009 | Medium | Config/input-test panels | Bottom action reachability under system UI needed direct Android evidence. | Fixed; tablet emulator confirmed | Config and Input Test actions remained clear of the visible Android taskbar |
| DC-010 | Medium | Accessibility scaling | Large text could break AAC cells and consume the Camera Setup preview. | Fixed; browser and API 34 emulator confirmed at font scale 2.0 | Confirm vendor-specific font/display scaling during physical Samsung UX review |

## Release Decision

The code-40 debug APK passed current automated and emulator pre-release checks and may proceed to owner/internal UX testing. The physical-device checklist still includes:

- main board bottom row clear of system controls
- camera setup controls clear of system controls
- screen stays awake
- composed text survives rotation/reload/background

Tablet runtime compatibility is verified on an API 34 `sw800dp` emulator in portrait and landscape. A physical tablet remains desirable for human UX, vendor-specific system UI, performance, and real-camera validation. Store tablet screenshots are not runtime evidence by themselves.

## Required Next Review Run

Before the next release candidate:

1. Run phone smoke on the Samsung device:
   - launch main AAC screen
   - enter text
   - wait past the device display timeout
   - rotate or trigger recreation
   - open config and input test
   - open camera setup
   - verify bottom controls are not blocked
2. Run real-person camera alignment, blink detection, and calibration on the target device.
3. Listen to Mandarin TTS on the target device.
4. Run tablet large-font/display-size smoke when practical.
5. Complete the human AAC UX review before production release.
