# Tablet adaptation and bird garden integration

This policy implements item 1 of the September 3 tablet plan. Each numbered
change has an independent commit. Third-party app control and the proposed
SHINE Workspace remain a separate design task.

1. Responsive layout (design): use current window width and height, including
   split-screen. Expanded communication needs at least 840 by 600 CSS pixels.
   Resize must not change configured columns, tile order, scanner position,
   timing, draft, undo history or selected language.
2. Board (design): retain about 68% of expanded width for communication; the
   remaining pane presents a multiline draft, two recent spoken messages,
   camera/scanning status and helper controls outside the AAC scan sequence.
3. Locked conversation (design): a single bottom row of three existing actions;
   the rest of the window presents the message and recent conversation.
4. Settings (feature): category list beside section detail in expanded windows;
   preserve selected section and edits across resize and Activity recreation.
5. Camera setup (design/bug fix): stable preview beside controls when space
   permits, retain calibration progress through resize, and use consistent
   rotation/mirroring/overlay coordinates. Camera resources still have one owner.
6. Accessibility (design): readable scalable text, at least 48px helper targets,
   visible keyboard focus, stable traversal and non-color scan cues. Do not
   replace the configured AAC switch semantics with direct tile selection.
7. Bird garden integration (feature, after tablet work): reuse the approved
   module, configured AAC columns and exclusive activation routing. Choose a
   random bird per round. Preserve the communication session on entry/return;
   suspend scanning during play and release game animation/audio on exit.

Owners: web presentation owns board layout; native Settings owns preferences;
android-inputs owns camera setup and transforms; aac-core remains the sole
owner of communication scanning and actions; bird-minigame owns gameplay/art.
No stored configuration schema change is intended.

Risks and checks: resize can accidentally rebuild scan state or collapse targets;
fragment replacement can lose section selection; calibration recreation can
lose samples; two input listeners can activate both applications. Cover these
with behavioral browser/native tests, packaged asset checks, device-test.bat
on phone and tablet, and the declared public-stimulus optical rig for camera
and input changes. Source/unit checks alone are not physical acceptance.
Always turn off used test displays and verify their state after each run.

## Device installation

The phone uses the pinned direct-install debug certificate. The tablet's existing
0.4.1 installation has the Google Play signing certificate, so local APKs cannot
update it. Preserve that installation and its data: build the same runtime with
`-PshineAacTabletPreview=true` to install `org.shineaac.app.preview`, labelled
SHINE AAC Preview. It uses separate storage and the normal debug test key.
Run `device-test.bat --no-build --no-install` with `ANDROID_SERIAL` selecting
the tablet and `SHINE_AAC_TEST_PACKAGE=org.shineaac.app.preview`. The default
package, signing identity and release process remain unchanged.

Camera rotation follows Android's [resizable Camera2 preview guidance](https://developer.android.com/codelabs/android-camera2-preview).
TextureView supplies sensor orientation and front-camera mirroring; the app
compensates display rotation and fits the upright image into the same rectangle
used for normalized overlay coordinates. Direct USB frames retain their own
upright, unmirrored convention and centered digital zoom.
