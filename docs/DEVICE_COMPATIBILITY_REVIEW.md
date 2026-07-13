# Device Compatibility Review

Generated: 2026-07-13
Commit reviewed: pending post-c17f05f compatibility hardening
Version reviewed: 0.2.34 (37)

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
| DC-001 | Critical | Main AAC screen | Bottom row could be blocked by Samsung/system navigation controls because the WebView filled the window without system-bar padding. | Fixed in `6e54589`; needs device confirmation | Test on Samsung phone with gesture and button navigation after next APK build |
| DC-002 | Critical | Main AAC screen | Display timeout could interrupt active AAC use. | Fixed in `6e54589`; needs device confirmation | Verify screen remains awake for at least the device timeout period |
| DC-003 | Critical | Camera setup | Native camera setup had the same system-control and timeout class of risk. | Fixed in `77b5520`; needs device confirmation | Open Camera setup on device and verify bottom controls remain reachable |
| DC-004 | High | Rotation/recreation | Composed message was lost when Android recreated/reloaded the WebView. | Fixed in `066fc34`; browser E2E covers reload persistence | Verify on Android by rotating/locking/unlocking once a new APK is built |
| DC-005 | High | Tablet/large screen | The app was phone-first and manifest-locked to portrait. | Partially fixed | Manifest lock removed; phones are portrait-locked at runtime below 600dp, tablet-class screens can rotate. Still needs tablet emulator smoke for native runtime |
| DC-006 | High | Future Android target SDK | `screenOrientation="portrait"` is a temporary phone release mitigation. Large-screen Android behavior can ignore orientation restrictions for newer target SDKs. | Open | Design and verify adaptive landscape/tablet layout before API 36/production tablet support |
| DC-007 | High | Camera switch on tablet/landscape | Camera setup uses a fixed ML Kit rotation and preview/overlay assumptions. Tablet landscape and different sensor orientations are not proven. | Open | Verify and, if needed, derive image rotation from camera/display orientation before claiming camera switch tablet support |
| DC-008 | Medium | Web viewport sizing | Web CSS used `100vh` for the shell and lacked tablet landscape coverage. | Fixed in web/E2E; needs device confirmation | Uses dynamic viewport units and tablet landscape split layout; browser E2E covers phone, tablet portrait, and tablet landscape overflow |
| DC-009 | Medium | Config/input-test panels | Config and calibration panels are scrollable, but bottom action reachability under system UI needs direct device/emulator evidence. | Partially fixed | Browser E2E verifies config actions on tablet portrait/landscape; native system-bar confirmation still needs APK smoke |
| DC-010 | Medium | Accessibility scaling | Large font/display-size behavior has not been reviewed. AAC users and helpers may use enlarged UI settings. | Open | Add manual Android smoke with increased font/display size |

## Release Decision

Internal phone testing may continue after a new APK build only if the tester checklist explicitly includes:

- main board bottom row clear of system controls
- camera setup controls clear of system controls
- screen stays awake
- composed text survives rotation/reload/background

Tablet support should not be claimed as fully verified yet. Browser viewport checks now cover tablet portrait and tablet landscape, and the manifest no longer locks tablet-class screens to portrait. Because no physical tablet is available, native Android tablet compatibility still needs Android tablet emulator smoke before wider release. Store tablet screenshots are not sufficient evidence; they prove visual marketing assets, not runtime compatibility with Android system UI, activity lifecycle, camera orientation, or resizable windows.

## Required Next Review Run

Before the next release candidate:

1. Build a fresh debug APK from the current commits.
2. Run phone smoke on the Samsung device:
   - launch main AAC screen
   - enter text
   - wait past the device display timeout
   - rotate or trigger recreation
   - open config and input test
   - open camera setup
   - verify bottom controls are not blocked
3. Run tablet-class emulator smoke:
   - Pixel Tablet portrait
   - Pixel Tablet landscape
   - main board, config, input test, camera setup
   - large font/display size if practical
4. Extend automated browser E2E to include tablet portrait and landscape viewport fit checks.
5. Update this report with pass/fail evidence before uploading a new tester build.
