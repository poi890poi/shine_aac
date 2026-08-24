# Layout quality audit

Layout QA uses structural evidence. It does not tone-match screenshots or
modify normal app behavior to satisfy a test.

## Evidence layers

1. **Rendered geometry**
   - Read DOM rectangles and computed styles from the real Android WebView.
   - Read native control rectangles from UIAutomator.
   - Detect clipping, horizontal overflow, overlapping controls, touch targets
     below 48dp, repeated-row gaps, alignment drift, loose text leading, and
     padding disproportionate to the text size.
2. **Theme surfaces**
   - In a dark theme, inspect every visible opaque background surface.
   - Flag bright surfaces that occupy at least 1% of the visible panel.
   - Small bright controls and text are excluded by the area threshold.
3. **Native content allocation**
   - Some rendered surfaces, including Camera Setup's `TextureView`, are not
     exposed to accessibility tools.
   - Infer the camera-preview band from the accessible header/status and
     controls-panel landmarks. Flag a preview below 25% of screen height.
   - Normalize native button widths to dp and compare secondary control cells
     with Unicode glyph-width estimates. Identify the primary action row from
     geometry so prominent Start/Done actions are not treated as wasted space.
4. **Screenshot review**
   - Capture every major surface with state, locale, theme, font scale, and
     build identity in its filename/manifest.
   - Keep after-only review archives separate from intentionally broken
     before evidence.
   - Use screenshot inspection for visual hierarchy and aesthetics that are
     not safely reducible to a numeric rule.

## Calibration evidence

The heuristics are regression-tested against observed failures rather than
invented examples:

- Configuration checkbox rows: the reported layout had five 12 CSS-pixel
  gaps between consecutive 48px targets. A compact list has at most 4px.
- Camera preview at 200% font: the broken capture used 205/2168 (9.5%) of
  screen height; the corrected capture uses 850/2168 (39.2%).
- Camera Setup controls: the equal-weight layout stretched short secondary
  labels to 88-137dp cells. The corrected app uses Android's measured text
  width plus 16dp padding, with a 48dp minimum touch width; the independent
  UIAutomator audit reports no disproportionately padded secondary cells.
- Dark theme: a large opaque white surface is a finding; a small bright
  checkbox is not.

Threshold findings are review candidates, not automatic authorization to
change production UI. A screenshot and geometry report must confirm the
problem in normal use before an app fix is made.

## Required state matrix

At minimum, release layout evidence covers:

- Traditional Chinese and English;
- default, high-contrast light, and high-contrast dark presets;
- communication board, Configuration, voice selection, App Info, Input Test,
  reset confirmation, text export, and Camera Setup;
- normal font scale, plus the 200% corner-case pass;
- portrait and constrained landscape evidence;
- default values and representative longest translated labels.

## Reports

`device-test.bat` is the release-facing entry point. It produces screenshots,
UI hierarchies, layout metrics, and ranked findings under `test-results/`.
`scripts/device-config-audit.mjs` performs the WebView geometry/theme audit;
`scripts/device-acceptance-test.py` performs native and lifecycle checks.

P2-P4 output must include the exact screenshot and machine-readable geometry
used to produce the finding. Uncertain aesthetic findings are shown to the
user for judgment instead of being silently "fixed."
